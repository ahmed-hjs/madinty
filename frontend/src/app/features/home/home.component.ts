import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  HostListener,
  NgZone,
  OnDestroy,
  OnInit,
  ViewChild,
  computed,
  effect,
  inject,
  signal,
  untracked,
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import * as L from 'leaflet';

import {
  CATEGORIES,
  CATEGORY_LIST,
  CategoryId,
  Priority,
  Report,
  STATUSES,
  STATUS_COLOR,
  STATUS_LIST,
  StatusId,
  timeAgo,
} from '../../core/models/report.model';
import { PublicStats, ReportService } from '../../core/services/report.service';
import { HttpErrorResponse } from '@angular/common/http';
import { apiErrorMessage } from '../../core/utils/errors';
import { AuthService } from '../../core/services/auth.service';
import { AuthModalService, AuthView } from '../auth/auth-modal.service';
import { IconComponent } from '../../shared/icon/icon.component';
import { buildPinIcon } from '../../shared/map/map-pin';

type FilterKey = 'category' | 'status' | 'period' | 'priority';
type Period = 'all' | '24h' | '7d' | '30d';

interface Filters {
  category: CategoryId | 'all';
  status: StatusId | 'all';
  period: Period;
  priority: Priority | 'all';
}

interface MenuOption {
  value: string;
  label: string;
}

const TUNIS: L.LatLngExpression = [36.8065, 10.1815];
const PERIOD_HOURS: Record<Exclude<Period, 'all'>, number> = { '24h': 24, '7d': 168, '30d': 720 };

const PAD_TL: L.PointTuple = [380, 90];
const PAD_BR: L.PointTuple = [310, 90];

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [RouterLink, IconComponent],
  templateUrl: './home.component.html',
  styleUrl: './home.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HomeComponent implements OnInit, AfterViewInit, OnDestroy {
  private readonly reportService = inject(ReportService);
  private readonly router = inject(Router);
  private readonly zone = inject(NgZone);
  private readonly authModal = inject(AuthModalService);
  protected readonly auth = inject(AuthService);
  readonly profileOpen = signal(false);

  @ViewChild('mapEl', { static: true }) mapEl!: ElementRef<HTMLDivElement>;

  readonly categories = CATEGORY_LIST;
  readonly statuses = STATUS_LIST;
  readonly statusColor = STATUS_COLOR;
  readonly menuKeys: FilterKey[] = ['category', 'status', 'period', 'priority'];

  readonly menus: Record<FilterKey, { label: string; options: MenuOption[] }> = {
    category: {
      label: 'Catégorie',
      options: [{ value: 'all', label: 'Toutes' }, ...CATEGORY_LIST.map((c) => ({ value: c.id, label: c.label }))],
    },
    status: {
      label: 'Statut',
      options: [{ value: 'all', label: 'Tous' }, ...STATUS_LIST.map((s) => ({ value: s.id, label: s.label }))],
    },
    period: {
      label: 'Période',
      options: [
        { value: 'all', label: 'Toutes' },
        { value: '24h', label: '24 dernières heures' },
        { value: '7d', label: '7 derniers jours' },
        { value: '30d', label: '30 derniers jours' },
      ],
    },
    priority: {
      label: 'Priorité',
      options: [
        { value: 'all', label: 'Toutes' },
        { value: 'haute', label: 'Haute' },
        { value: 'moyenne', label: 'Moyenne' },
        { value: 'basse', label: 'Basse' },
      ],
    },
  };

  readonly loading = signal(true);
  readonly loadError = signal(false);
  readonly supportError = signal<string | null>(null);
  readonly reports = signal<Report[]>([]);
  readonly stats = signal<PublicStats>({ total: 0, resolvedPct: 0, avgDays: 0 });
  readonly filters = signal<Filters>({ category: 'all', status: 'all', period: 'all', priority: 'all' });
  readonly query = signal('');
  readonly heatmap = signal(false);
  readonly openMenu = signal<FilterKey | null>(null);
  readonly selectedId = signal<string | null>(null);
  private readonly mapReady = signal(false);
  private readonly loadedAt = signal(Date.now());
  private readonly now = signal(Date.now());

  readonly filtered = computed(() => {
    const f = this.filters();
    const q = this.normalize(this.query());
    const now = Date.now();
    return this.reports().filter((r) => {
      if (f.category !== 'all' && r.category !== f.category) return false;
      if (f.status !== 'all' && r.status !== f.status) return false;
      if (f.priority !== 'all' && r.priority !== f.priority) return false;
      if (f.period !== 'all' && now - new Date(r.createdAt).getTime() > PERIOD_HOURS[f.period] * 36e5) return false;
      if (q && !this.normalize(`${r.title} ${r.address} ${r.id}`).includes(q)) return false;
      return true;
    });
  });

  readonly latest = computed(() =>
    [...this.filtered()].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 5),
  );

  readonly hasActiveFilters = computed(
    () => Object.values(this.filters()).some((v) => v !== 'all') || this.query().trim() !== '',
  );

  readonly updatedLabel = computed(() => {
    const min = Math.floor((this.now() - this.loadedAt()) / 6e4);
    return min < 1 ? 'il y a 1 min' : `il y a ${min} min`;
  });

  private map?: L.Map;
  private tiles?: L.TileLayer;
  private readonly pinLayer = L.layerGroup();
  private readonly heatLayer = L.layerGroup();
  private readonly pins = new Map<string, { marker: L.Marker; report: Report }>();
  private fitted = false;
  private redrawing = false;
  private tick?: ReturnType<typeof setInterval>;
  private darkQuery?: MediaQueryList;
  private readonly onSchemeChange = () => this.applyTiles();

  constructor() {
    effect(() => {
      this.auth.user();
      untracked(() => this.loadReports());
    });

    effect(() => {
      const list = this.filtered();
      if (!this.mapReady()) return;
      this.renderPins(list);
      this.renderHeat(list);
      if (!this.fitted && list.length) {
        this.fitted = true;
        this.fitToReports(list, false);
      }
    });

    effect(() => {
      const on = this.heatmap();
      if (!this.mapReady()) return;
      if (on) this.heatLayer.addTo(this.map!);
      else this.heatLayer.remove();
    });

    effect(() => {
      const id = this.selectedId();
      if (!this.mapReady()) return;
      this.pins.forEach(({ marker }, key) => {
        marker.getElement()?.classList.toggle('is-selected', key === id);
        marker.setZIndexOffset(key === id ? 1000 : 0);
      });
    });
  }

  private loadReports(): void {
    this.reportService.getPublicReports().subscribe({
      next: (list) => {
        this.reports.set(list);
        this.loadedAt.set(Date.now());
        this.loadError.set(false);
        this.loading.set(false);
      },
      error: () => {
        this.loadError.set(true);
        this.loading.set(false);
      },
    });
    this.reportService.getPublicStats().subscribe({ next: (s) => this.stats.set(s), error: () => undefined });
  }

  retry(): void {
    this.loading.set(true);
    this.loadReports();
  }

  ngOnInit(): void {
    this.zone.runOutsideAngular(() => {
      this.tick = setInterval(() => this.zone.run(() => this.now.set(Date.now())), 30_000);
    });
  }

  ngAfterViewInit(): void {
    this.zone.runOutsideAngular(() => {
      this.map = L.map(this.mapEl.nativeElement, {
        center: TUNIS,
        zoom: 13,
        zoomControl: false,
        minZoom: 8,
        maxZoom: 19,
        zoomSnap: 0.5,
        zoomDelta: 1,
        wheelPxPerZoomLevel: 90,
      });
      this.pinLayer.addTo(this.map);
      this.applyTiles();
      this.darkQuery = window.matchMedia('(prefers-color-scheme: dark)');
      this.darkQuery.addEventListener('change', this.onSchemeChange);
    });
    this.mapReady.set(true);
  }

  ngOnDestroy(): void {
    clearInterval(this.tick);
    this.darkQuery?.removeEventListener('change', this.onSchemeChange);
    this.map?.remove();
  }

  @HostListener('document:click')
  closeMenus(): void {
    if (this.openMenu()) this.openMenu.set(null);
    if (this.profileOpen()) this.profileOpen.set(false);
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.openMenu.set(null);
    this.profileOpen.set(false);
  }

  toggleMenu(key: FilterKey, event: Event): void {
    event.stopPropagation();
    this.openMenu.update((cur) => (cur === key ? null : key));
  }

  setFilter(key: FilterKey, value: string): void {
    this.filters.update((f) => ({ ...f, [key]: value }) as Filters);
    this.openMenu.set(null);
  }

  pillLabel(key: FilterKey): string {
    const value = this.filters()[key];
    if (value === 'all') return this.menus[key].label;
    return this.menus[key].options.find((o) => o.value === value)?.label ?? this.menus[key].label;
  }

  resetFilters(): void {
    this.filters.set({ category: 'all', status: 'all', period: 'all', priority: 'all' });
    this.query.set('');
  }

  onSearch(value: string): void {
    this.query.set(value);
  }

  focusFirstResult(): void {
    const first = this.filtered()[0];
    if (first) this.selectFromList(first);
  }

  toggleHeatmap(): void {
    this.heatmap.update((v) => !v);
  }

  zoomIn(): void {
    this.map?.zoomIn();
  }

  zoomOut(): void {
    this.map?.zoomOut();
  }

  toggleProfile(event: Event): void {
    event.stopPropagation();
    this.openMenu.set(null);
    this.profileOpen.update((v) => !v);
  }

  logout(): void {
    this.profileOpen.set(false);
    this.auth.logout();
  }

  initials(fullName: string): string {
    const parts = fullName.trim().split(/\s+/).filter(Boolean);
    return ((parts[0]?.[0] ?? '') + (parts.length > 1 ? (parts[parts.length - 1][0] ?? '') : '')).toUpperCase() || '?';
  }

  openAuth(view: AuthView): void {
    this.authModal.open(view);
  }

  report(): void {
    this.authModal.requireLogin(() => {
      void this.router.navigateByUrl('/citoyen/nouveau');
    }, 'Connectez-vous pour signaler un problème.');
  }

  support(r: Report, button?: HTMLButtonElement): void {
    this.authModal.requireLogin(() => {
      const current = this.reports().find((x) => x.dbId === r.dbId) ?? r;
      if (current.supportedByMe || current.isMine) return;
      if (button) button.disabled = true;
      this.supportError.set(null);
      this.reportService.support(r.dbId).subscribe({
        next: (res) => this.patchReport(r.dbId, { supports: res.supports_count, supportedByMe: true }),
        error: (e: HttpErrorResponse) => {
          if (e.status === 409) return this.patchReport(r.dbId, { supportedByMe: true });
          if (e.status === 403) this.patchReport(r.dbId, { isMine: true });
          if (button) button.disabled = false;
          this.supportError.set(apiErrorMessage(e, 'Impossible de soutenir ce signalement.'));
          setTimeout(() => this.supportError.set(null), 5000);
        },
      });
    }, 'Connectez-vous pour soutenir ce signalement.');
  }

  private patchReport(dbId: number, patch: Partial<Report>): void {
    this.reports.update((list) => list.map((x) => (x.dbId === dbId ? { ...x, ...patch } : x)));
  }

  selectFromList(report: Report): void {
    const entry = this.pins.get(report.id);
    if (!entry || !this.map) return;
    this.selectedId.set(report.id);
    this.zone.runOutsideAngular(() => {
      this.map!.flyTo(entry.marker.getLatLng(), Math.max(this.map!.getZoom(), 15), { duration: 0.6 });
      this.map!.once('moveend', () => entry.marker.openPopup());
    });
  }

  category(r: Report) {
    return CATEGORIES[r.category];
  }

  statusLabel(r: Report): string {
    return STATUSES[r.status].label;
  }

  ago(r: Report): string {
    return timeAgo(r.createdAt);
  }

  formatNumber(n: number): string {
    return n.toLocaleString('fr-FR');
  }

  trackById = (_: number, r: Report) => r.id;

  private isDark(): boolean {
    const forced = document.documentElement.dataset['theme'];
    if (forced) return forced === 'dark';
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  }

  private applyTiles(): void {
    if (!this.map) return;
    this.tiles?.remove();
    this.tiles = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(this.map);
  }

  private renderPins(list: Report[]): void {
    this.zone.runOutsideAngular(() => {
      const selected = untracked(() => this.selectedId());
      this.redrawing = true;
      this.pinLayer.clearLayers();
      this.pins.clear();
      for (const report of list) {
        const marker = L.marker([report.lat, report.lng], {
          icon: buildPinIcon(report, report.id === selected),
          title: report.title,
          alt: `${report.title}, ${STATUSES[report.status].label}`,
          keyboard: true,
        });
        marker.bindPopup(() => this.buildPopup(report), {
          className: 'madinty-popup',
          closeButton: false,
          minWidth: 264,
          maxWidth: 264,
          offset: [0, -4],
          autoPanPaddingTopLeft: PAD_TL,
          autoPanPaddingBottomRight: PAD_BR,
        });
        marker.on('click', () => this.zone.run(() => this.selectedId.set(report.id)));
        marker.on('popupclose', () =>
          this.zone.run(() => {
            if (!this.redrawing && this.selectedId() === report.id) this.selectedId.set(null);
          }),
        );
        marker.addTo(this.pinLayer);
        this.pins.set(report.id, { marker, report });
      }
      this.redrawing = false;
      const kept = selected ? this.pins.get(selected) : undefined;
      if (kept) {
        const popup = kept.marker.getPopup();
        const autoPan = popup?.options.autoPan;
        if (popup) popup.options.autoPan = false;
        kept.marker.openPopup();
        if (popup) popup.options.autoPan = autoPan;
        this.redrawing = false;
      } else if (selected) {
        this.zone.run(() => this.selectedId.set(null));
      }
    });
  }

  private renderHeat(list: Report[]): void {
    this.zone.runOutsideAngular(() => {
      this.heatLayer.clearLayers();
      const weight: Record<Priority, number> = { haute: 1.4, moyenne: 1, basse: 0.7 };
      for (const r of list) {
        const w = weight[r.priority];
        const common = { stroke: false, interactive: false, fillColor: '#EA4335' } as const;
        L.circle([r.lat, r.lng], { ...common, radius: 520 * w, fillColor: '#FBBC04', fillOpacity: 0.1 }).addTo(this.heatLayer);
        L.circle([r.lat, r.lng], { ...common, radius: 340 * w, fillOpacity: 0.1 }).addTo(this.heatLayer);
        L.circle([r.lat, r.lng], { ...common, radius: 180 * w, fillOpacity: 0.14 }).addTo(this.heatLayer);
      }
    });
  }

  private fitToReports(list: Report[], animate: boolean): void {
    if (!this.map || !list.length) return;
    const bounds = L.latLngBounds(list.map((r) => [r.lat, r.lng] as L.LatLngTuple));
    this.zone.runOutsideAngular(() =>
      this.map!.fitBounds(bounds, { paddingTopLeft: PAD_TL, paddingBottomRight: PAD_BR, maxZoom: 14, animate }),
    );
  }

  private buildPopup(r: Report): HTMLElement {
    const cat = CATEGORIES[r.category];
    const el = (tag: string, cls?: string, text?: string) => {
      const n = document.createElement(tag);
      if (cls) n.className = cls;
      if (text) n.textContent = text;
      return n;
    };

    const root = el('div', 'fiche');

    const photo = el('div', 'fiche-photo');
    photo.style.setProperty('--c', cat.color);
    photo.setAttribute('role', 'img');
    photo.setAttribute('aria-label', 'Photo du signalement (démonstration)');
    root.append(photo);

    root.append(el('h3', 'fiche-title', r.title));

    const tags = el('div', 'fiche-tags');
    tags.append(el('span', `pill-status st-${r.status}`, STATUSES[r.status].label));
    tags.append(el('span', 'pill-cat', cat.label));
    if (r.priority === 'haute') tags.append(el('span', 'pill-prio', 'Priorité haute'));
    root.append(tags);

    const foot = el('div', 'fiche-foot');
    foot.append(el('span', 'fiche-supports', `♥ ${r.supports} ${r.supports > 1 ? 'soutiens' : 'soutien'}`));
    const link = el('a', 'fiche-link', 'Voir le détail →') as HTMLAnchorElement;
    link.href = `/signalements/${r.id}`;
    link.addEventListener('click', (e) => {
      e.preventDefault();
      this.zone.run(() => this.router.navigateByUrl(`/signalements/${r.id}`));
    });
    foot.append(link);
    root.append(foot);

    const done = r.supportedByMe;
    const label = done ? '✓ Soutenu' : r.isMine ? 'Votre signalement' : '♥ Soutenir';
    const support = el('button', `fiche-support${done ? ' is-done' : ''}`, label) as HTMLButtonElement;
    support.type = 'button';
    support.disabled = done || r.isMine;
    support.addEventListener('click', () => this.zone.run(() => this.support(r, support)));
    root.append(support);

    return root;
  }

  private normalize(s: string): string {
    return s
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .trim();
  }
}

import { HttpErrorResponse } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnDestroy,
  computed,
  effect,
  inject,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import * as L from 'leaflet';
import { map } from 'rxjs';
import { API_ORIGIN } from '../../core/config/api.config';
import { AuthService } from '../../core/services/auth.service';
import { apiErrorMessage } from '../../core/utils/errors';
import { CATEGORIES, STATUSES, timeAgo, toCategoryId, toPriority, toReport, toStatusId } from '../../core/models/report.model';
import { ReportDetail, ReportImage, ReportService } from '../../core/services/report.service';
import { IconComponent } from '../../shared/icon/icon.component';
import { buildPinIcon } from '../../shared/map/map-pin';
import { SiteFooterComponent } from '../../shared/site-footer/site-footer.component';
import { SiteHeaderComponent } from '../../shared/site-header/site-header.component';
import { SupportButtonComponent } from '../../shared/support-button/support-button.component';

@Component({
  selector: 'app-signalement-detail',
  standalone: true,
  imports: [RouterLink, IconComponent, SiteHeaderComponent, SiteFooterComponent, SupportButtonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './signalement-detail.component.html',
  styleUrl: './signalement-detail.component.scss',
})
export class SignalementDetailComponent implements OnDestroy {
  private readonly api = inject(ReportService);
  private readonly auth = inject(AuthService);
  private readonly ref = toSignal(inject(ActivatedRoute).paramMap.pipe(map((p) => p.get('ref') ?? '')), { initialValue: '' });

  protected readonly r = signal<ReportDetail | null>(null);
  protected readonly loading = signal(true);
  protected readonly error = signal<'notfound' | 'network' | null>(null);

  protected readonly contesting = signal(false);
  protected readonly message = signal('');
  protected readonly photo = signal<File | null>(null);
  protected readonly busy = signal(false);
  protected readonly actionError = signal<string | null>(null);

  protected readonly cat = computed(() => {
    const d = this.r();
    return d ? CATEGORIES[toCategoryId(d.icon_key)] : null;
  });
  protected readonly statusId = computed(() => (this.r() ? toStatusId(this.r()!.status, this.r()!.priority) : 'recu'));
  protected readonly statusLabel = computed(() => {
    const s = this.r()?.status;
    return s === 'Rejeté' || s === 'Clos' ? s : STATUSES[this.statusId()].label;
  });
  protected readonly highPriority = computed(() => (this.r() ? toPriority(this.r()!.priority) === 'haute' : false));

  protected readonly photos = computed(() => (this.r()?.images ?? []).filter((i) => i.context === 'Signalement'));
  protected readonly proofs = computed(() => (this.r()?.images ?? []).filter((i) => i.context === 'Intervention'));

  protected readonly daysLeft = computed(() => {
    const dl = this.r()?.contest_deadline;
    if (!dl) return 0;
    return Math.max(0, Math.ceil((new Date(dl).getTime() - Date.now()) / 864e5));
  });
  protected readonly canDecide = computed(() => {
    const d = this.r();
    return !!d && d.is_author && d.status === 'Résolu' && this.daysLeft() > 0 && !d.contestation;
  });

  private readonly mapEl = viewChild<ElementRef<HTMLDivElement>>('mapEl');
  private map?: L.Map;

  constructor() {
    effect(() => {
      this.ref();
      this.auth.user();
      untracked(() => this.load());
    });
    effect(() => {
      const el = this.mapEl();
      const d = this.r();
      untracked(() => {
        this.map?.remove();
        this.map = undefined;
        if (el && d) this.initMap(el.nativeElement, d);
      });
    });
  }

  ngOnDestroy(): void {
    this.map?.remove();
  }

  protected load(): void {
    this.loading.set(this.r() === null);
    this.error.set(null);
    this.api.get(this.ref()).subscribe({
      next: (d) => {
        this.r.set(d);
        this.loading.set(false);
      },
      error: (e: HttpErrorResponse) => {
        this.r.set(null);
        this.error.set(e.status === 404 ? 'notfound' : 'network');
        this.loading.set(false);
      },
    });
  }

  private initMap(el: HTMLDivElement, d: ReportDetail): void {
    const m = L.map(el, { center: [Number(d.latitude), Number(d.longitude)], zoom: 16, zoomControl: false, scrollWheelZoom: false });
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(m);
    L.marker([Number(d.latitude), Number(d.longitude)], { icon: buildPinIcon(toReport(d)), interactive: false }).addTo(m);
    this.map = m;
  }

  protected onSupported(res: { count: number; supported: boolean }): void {
    this.r.update((d) => (d ? { ...d, supports_count: res.count, supported_by_me: res.supported } : d));
  }

  protected confirm(): void {
    const d = this.r();
    if (!d || this.busy()) return;
    this.busy.set(true);
    this.actionError.set(null);
    this.api.confirm(d.id).subscribe({
      next: () => {
        this.busy.set(false);
        this.load();
      },
      error: (e: HttpErrorResponse) => {
        this.busy.set(false);
        this.actionError.set(apiErrorMessage(e));
      },
    });
  }

  protected pickPhoto(input: HTMLInputElement): void {
    const f = input.files?.[0] ?? null;
    input.value = '';
    if (f && (!['image/jpeg', 'image/png'].includes(f.type) || f.size > 5 * 1024 * 1024)) {
      this.actionError.set('Photo JPG ou PNG de 5 Mo maximum.');
      return;
    }
    this.actionError.set(null);
    this.photo.set(f);
  }

  protected sendContest(): void {
    const d = this.r();
    const msg = this.message().trim();
    if (!d || this.busy()) return;
    if (msg.length < 3 || msg.length > 300) {
      this.actionError.set('Décrivez ce qui persiste (3 à 300 caractères).');
      return;
    }
    this.busy.set(true);
    this.actionError.set(null);
    this.api.contest(d.id, msg, this.photo()).subscribe({
      next: () => {
        this.busy.set(false);
        this.contesting.set(false);
        this.message.set('');
        this.photo.set(null);
        this.load();
      },
      error: (e: HttpErrorResponse) => {
        this.busy.set(false);
        this.actionError.set(apiErrorMessage(e));
      },
    });
  }

  protected src = (i: ReportImage) => `${API_ORIGIN}${i.url}`;
  protected ago = timeAgo;
  protected date = (iso: string) =>
    new Date(iso).toLocaleString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

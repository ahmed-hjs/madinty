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
import { RouterLink } from '@angular/router';
import * as L from 'leaflet';
import { apiErrorMessage } from '../../core/utils/errors';
import {
  CATEGORIES,
  Report,
  STATUSES,
  timeAgo,
  toCategoryId,
  toStatusId,
} from '../../core/models/report.model';
import {
  ApiCategory,
  CreatedReport,
  NearbyReport,
  ReportService,
} from '../../core/services/report.service';
import { IconComponent } from '../../shared/icon/icon.component';
import { buildPinIcon } from '../../shared/map/map-pin';
import { SiteFooterComponent } from '../../shared/site-footer/site-footer.component';
import { SiteHeaderComponent } from '../../shared/site-header/site-header.component';
import { SupportButtonComponent } from '../../shared/support-button/support-button.component';

const TUNIS: L.LatLngTuple = [36.8065, 10.1815];
const MAX_PHOTOS = 5;
const MAX_SIZE = 5 * 1024 * 1024;

interface Photo {
  file: File;
  url: string;
}

@Component({
  selector: 'app-nouveau-signalement',
  standalone: true,
  imports: [RouterLink, IconComponent, SiteHeaderComponent, SiteFooterComponent, SupportButtonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './nouveau-signalement.component.html',
  styleUrl: './nouveau-signalement.component.scss',
})
export class NouveauSignalementComponent implements OnDestroy {
  private readonly api = inject(ReportService);

  protected readonly steps = ['Détails', 'Localisation', 'Vérification', 'Envoi'];
  protected readonly step = signal(1);

  protected readonly categories = signal<ApiCategory[]>([]);
  protected readonly catState = signal<'loading' | 'ok' | 'error'>('loading');
  protected readonly categoryId = signal<number | null>(null);
  protected readonly title = signal('');
  protected readonly description = signal('');
  protected readonly photos = signal<Photo[]>([]);
  protected readonly photoError = signal<string | null>(null);
  protected readonly showErrors = signal(false);

  protected readonly position = signal<{ lat: number; lng: number }>({ lat: TUNIS[0], lng: TUNIS[1] });
  protected readonly positionSet = signal(false);
  protected readonly address = signal('');
  protected readonly locating = signal(false);
  protected readonly locateError = signal<string | null>(null);

  protected readonly nearby = signal<NearbyReport[]>([]);
  protected readonly nearbyState = signal<'idle' | 'loading' | 'ok' | 'error'>('idle');

  protected readonly sending = signal(false);
  protected readonly sendError = signal<string | null>(null);
  protected readonly created = signal<CreatedReport | null>(null);
  protected readonly photoWarning = signal<string | null>(null);

  protected readonly category = computed(() => this.categories().find((c) => c.id === this.categoryId()) ?? null);
  protected readonly catMeta = (c: ApiCategory) => CATEGORIES[toCategoryId(c.icon_key)];

  protected readonly titleError = computed(() => {
    const n = this.title().trim().length;
    return n < 3 ? 'Titre requis (3 caractères minimum).' : n > 255 ? '255 caractères maximum.' : null;
  });
  protected readonly descError = computed(() => {
    const n = this.description().trim().length;
    return n < 10 ? 'Décrivez le problème en 10 caractères minimum.' : n > 5000 ? '5 000 caractères maximum.' : null;
  });
  protected readonly detailsValid = computed(
    () => this.categoryId() !== null && !this.titleError() && !this.descError(),
  );

  protected readonly coords = computed(() => `${this.position().lat.toFixed(5)}, ${this.position().lng.toFixed(5)}`);

  private readonly mapEl = viewChild<ElementRef<HTMLDivElement>>('mapEl');
  private map?: L.Map;
  private marker?: L.Marker;

  constructor() {
    this.api.categories().subscribe({
      next: (list) => {
        this.categories.set(list);
        this.catState.set('ok');
      },
      error: () => this.catState.set('error'),
    });

    effect(() => {
      const el = this.mapEl();
      untracked(() => {
        this.destroyMap();
        if (el) this.initMap(el.nativeElement);
      });
    });

    effect(() => {
      this.categoryId();
      this.position();
      untracked(() => this.refreshMarker());
    });
  }

  ngOnDestroy(): void {
    this.destroyMap();
    this.photos().forEach((p) => URL.revokeObjectURL(p.url));
  }

  protected next(): void {
    const s = this.step();
    if (s === 1) {
      this.showErrors.set(true);
      if (!this.detailsValid()) return;
      this.step.set(2);
    } else if (s === 2) {
      if (!this.positionSet()) return;
      this.step.set(3);
      this.loadNearby();
    }
  }

  protected back(): void {
    if (this.step() > 1 && this.step() < 4) this.step.update((s) => s - 1);
  }

  protected addPhotos(input: HTMLInputElement): void {
    this.photoError.set(null);
    const added: Photo[] = [];
    for (const file of Array.from(input.files ?? [])) {
      if (!['image/jpeg', 'image/png'].includes(file.type)) {
        this.photoError.set('Format accepté : JPG ou PNG.');
      } else if (file.size > MAX_SIZE) {
        this.photoError.set('Photo trop volumineuse (5 Mo maximum).');
      } else if (this.photos().length + added.length >= MAX_PHOTOS) {
        this.photoError.set(`${MAX_PHOTOS} photos maximum.`);
      } else {
        added.push({ file, url: URL.createObjectURL(file) });
      }
    }
    input.value = '';
    if (added.length) this.photos.update((p) => [...p, ...added]);
  }

  protected removePhoto(photo: Photo): void {
    URL.revokeObjectURL(photo.url);
    this.photos.update((p) => p.filter((x) => x !== photo));
    this.photoError.set(null);
  }

  protected locate(): void {
    this.locateError.set(null);
    if (!('geolocation' in navigator)) {
      this.locateError.set('La géolocalisation n’est pas disponible sur cet appareil.');
      return;
    }
    this.locating.set(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        this.locating.set(false);
        this.setPosition(pos.coords.latitude, pos.coords.longitude, true);
      },
      () => {
        this.locating.set(false);
        this.locateError.set('Position introuvable. Placez le repère sur la carte.');
      },
      { enableHighAccuracy: true, timeout: 10_000 },
    );
  }

  private setPosition(lat: number, lng: number, recenter = false): void {
    this.position.set({ lat, lng });
    this.positionSet.set(true);
    if (recenter) this.map?.setView([lat, lng], Math.max(this.map.getZoom(), 17));
  }

  private initMap(el: HTMLDivElement): void {
    const start = this.positionSet() ? ([this.position().lat, this.position().lng] as L.LatLngTuple) : TUNIS;
    this.map = L.map(el, { center: start, zoom: this.positionSet() ? 17 : 13, zoomControl: true });
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(this.map);
    this.map.on('click', (e: L.LeafletMouseEvent) => this.setPosition(e.latlng.lat, e.latlng.lng));
    if (this.positionSet()) this.refreshMarker();
  }

  private destroyMap(): void {
    this.map?.remove();
    this.map = undefined;
    this.marker = undefined;
  }

  private previewReport(): Report {
    const cat = this.category();
    return {
      dbId: 0,
      id: 'MD-NEW',
      title: this.title(),
      address: '',
      category: cat ? toCategoryId(cat.icon_key) : 'autre',
      status: 'recu',
      priority: 'moyenne',
      supports: 0,
      createdAt: new Date().toISOString(),
      lat: this.position().lat,
      lng: this.position().lng,
      supportedByMe: false,
      isMine: true,
    };
  }

  private refreshMarker(): void {
    if (!this.map || !this.positionSet()) return;
    const { lat, lng } = this.position();
    const icon = buildPinIcon(this.previewReport());
    if (!this.marker) {
      this.marker = L.marker([lat, lng], { icon, draggable: true, keyboard: true, title: 'Glissez le repère pour ajuster' });
      this.marker.on('dragend', () => {
        const p = this.marker!.getLatLng();
        this.setPosition(p.lat, p.lng);
      });
      this.marker.addTo(this.map);
    } else {
      this.marker.setIcon(icon);
      this.marker.setLatLng([lat, lng]);
    }
  }

  private loadNearby(): void {
    const cat = this.categoryId();
    if (cat === null) return;
    this.nearbyState.set('loading');
    this.api.nearby(this.position().lat, this.position().lng, cat).subscribe({
      next: (list) => {
        this.nearby.set(list);
        this.nearbyState.set('ok');
      },
      error: () => {
        this.nearby.set([]);
        this.nearbyState.set('error');
      },
    });
  }

  protected onSupported(id: number, result: { count: number; supported: boolean }): void {
    this.nearby.update((list) =>
      list.map((n) => (n.id === id ? { ...n, supports_count: result.count, supported_by_me: result.supported } : n)),
    );
  }

  protected statusId = (n: NearbyReport) => toStatusId(n.status);
  protected statusLabel = (n: NearbyReport) => STATUSES[toStatusId(n.status)].label;
  protected ago = timeAgo;
  protected distance = (m: number) => (m < 1000 ? `${m} m` : `${(m / 1000).toFixed(1)} km`);

  protected submit(): void {
    const cat = this.categoryId();
    if (this.sending() || cat === null || !this.detailsValid()) return;
    this.sending.set(true);
    this.sendError.set(null);
    const address = this.address().trim();
    this.api
      .create({
        title: this.title().trim(),
        description: this.description().trim(),
        category_id: cat,
        latitude: this.position().lat,
        longitude: this.position().lng,
        ...(address ? { address } : {}),
      })
      .subscribe({
        next: (report) => {
          this.created.set(report);
          this.uploadPhotos(report);
        },
        error: (e: HttpErrorResponse) => {
          this.sending.set(false);
          this.sendError.set(apiErrorMessage(e, 'Le signalement n’a pas pu être envoyé.'));
        },
      });
  }

  private uploadPhotos(report: CreatedReport): void {
    const files = this.photos().map((p) => p.file);
    const done = () => {
      this.sending.set(false);
      this.step.set(4);
    };
    if (!files.length) return done();
    this.api.uploadPhotos(report.id, files).subscribe({
      next: done,
      error: (e: HttpErrorResponse) => {
        this.photoWarning.set(apiErrorMessage(e, 'Les photos n’ont pas pu être envoyées.'));
        done();
      },
    });
  }
}

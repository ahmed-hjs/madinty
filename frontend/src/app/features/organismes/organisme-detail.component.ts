import { ChangeDetectionStrategy, Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { HttpErrorResponse } from '@angular/common/http';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { map } from 'rxjs';
import { timeAgo } from '../../core/models/report.model';
import { OrgDetail, PublicService, domainVisual, orgInitials } from '../../core/services/public.service';
import { IconComponent } from '../../shared/icon/icon.component';
import { SiteFooterComponent } from '../../shared/site-footer/site-footer.component';
import { SiteHeaderComponent } from '../../shared/site-header/site-header.component';

@Component({
  selector: 'app-organisme-detail',
  standalone: true,
  imports: [RouterLink, IconComponent, SiteHeaderComponent, SiteFooterComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './organisme-detail.component.html',
  styleUrl: './organisme-detail.component.scss',
})
export class OrganismeDetailComponent {
  private readonly api = inject(PublicService);
  private readonly slug = toSignal(inject(ActivatedRoute).paramMap.pipe(map((p) => p.get('slug') ?? '')), {
    initialValue: '',
  });

  protected readonly org = signal<OrgDetail | null>(null);
  protected readonly loading = signal(true);
  protected readonly error = signal<'notfound' | 'network' | null>(null);

  protected readonly initials = orgInitials;
  protected readonly visual = domainVisual;

  protected readonly bars = computed(() => {
    const rows = this.org()?.par_categorie ?? [];
    const max = Math.max(1, ...rows.map((r) => r.total));
    return rows.map((r) => ({ ...r, pct: Math.max(6, Math.round((r.total / max) * 100)), visual: domainVisual(r.label) }));
  });

  constructor() {
    effect(() => {
      this.slug();
      untracked(() => this.load());
    });
  }

  protected load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.api.organization(this.slug()).subscribe({
      next: (o) => {
        this.org.set(o);
        this.loading.set(false);
      },
      error: (e: HttpErrorResponse) => {
        this.error.set(e.status === 404 ? 'notfound' : 'network');
        this.loading.set(false);
      },
    });
  }

  protected days(v: number | null): string {
    return v === null ? '—' : `${String(v).replace('.', ',')} j`;
  }

  protected ago(iso: string | null): string {
    return iso ? timeAgo(iso) : '';
  }
}

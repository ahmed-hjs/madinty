import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IconComponent } from '../../shared/icon/icon.component';
import { SiteFooterComponent } from '../../shared/site-footer/site-footer.component';
import { SiteHeaderComponent } from '../../shared/site-header/site-header.component';
import { OrgSummary, PublicService, domainVisual, orgInitials } from '../../core/services/public.service';

@Component({
  selector: 'app-organismes',
  standalone: true,
  imports: [RouterLink, IconComponent, SiteHeaderComponent, SiteFooterComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './organismes.component.html',
  styleUrl: './organismes.component.scss',
})
export class OrganismesComponent {
  private readonly api = inject(PublicService);

  protected readonly orgs = signal<OrgSummary[]>([]);
  protected readonly loading = signal(true);
  protected readonly failed = signal(false);

  protected readonly initials = orgInitials;
  protected readonly visual = domainVisual;

  constructor() {
    this.load();
  }

  protected load(): void {
    this.loading.set(true);
    this.failed.set(false);
    this.api.organizations().subscribe({
      next: (list) => {
        this.orgs.set(list);
        this.loading.set(false);
      },
      error: () => {
        this.failed.set(true);
        this.loading.set(false);
      },
    });
  }
}

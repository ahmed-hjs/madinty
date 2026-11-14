import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { apiErrorMessage } from '../../core/utils/errors';
import { STATUSES, timeAgo, toStatusId } from '../../core/models/report.model';
import { MineItem, ReportService, SupportedItem } from '../../core/services/report.service';
import { SiteFooterComponent } from '../../shared/site-footer/site-footer.component';
import { SiteHeaderComponent } from '../../shared/site-header/site-header.component';

type Tab = 'all' | 'active' | 'confirm' | 'supported';

@Component({
  selector: 'app-mes-signalements',
  standalone: true,
  imports: [RouterLink, SiteHeaderComponent, SiteFooterComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './mes-signalements.component.html',
  styleUrl: './mes-signalements.component.scss',
})
export class MesSignalementsComponent {
  private readonly api = inject(ReportService);

  protected readonly tab = signal<Tab>('all');
  protected readonly mine = signal<MineItem[]>([]);
  protected readonly supported = signal<SupportedItem[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly busyId = signal<number | null>(null);
  protected readonly actionError = signal<string | null>(null);

  protected readonly toConfirm = (m: MineItem) =>
    m.status === 'Résolu' && !!m.contest_deadline && new Date(m.contest_deadline).getTime() > Date.now() && !m.contested;

  protected readonly confirmCount = computed(() => this.mine().filter(this.toConfirm).length);

  protected readonly visible = computed(() => {
    const list = this.mine();
    switch (this.tab()) {
      case 'active':
        return list.filter((m) => !['Résolu', 'Clos', 'Rejeté'].includes(m.status));
      case 'confirm':
        return list.filter(this.toConfirm);
      default:
        return list;
    }
  });

  protected readonly tabs: { id: Tab; label: string }[] = [
    { id: 'all', label: 'Tous' },
    { id: 'active', label: 'En cours' },
    { id: 'confirm', label: 'À confirmer' },
    { id: 'supported', label: 'Soutenus' },
  ];

  constructor() {
    this.load();
  }

  protected load(): void {
    this.loading.set(true);
    this.error.set(null);
    let pending = 2;
    const done = () => --pending === 0 && this.loading.set(false);
    const fail = (e: HttpErrorResponse) => {
      this.error.set(apiErrorMessage(e, 'Impossible de charger vos signalements.'));
      done();
    };
    this.api.mine().subscribe({ next: (l) => (this.mine.set(l), done()), error: fail });
    this.api.supported().subscribe({ next: (l) => (this.supported.set(l), done()), error: fail });
  }

  protected confirm(m: MineItem): void {
    if (this.busyId() !== null) return;
    this.busyId.set(m.id);
    this.actionError.set(null);
    this.api.confirm(m.id).subscribe({
      next: () => {
        this.mine.update((l) => l.map((x) => (x.id === m.id ? { ...x, status: 'Clos' } : x)));
        this.busyId.set(null);
      },
      error: (e: HttpErrorResponse) => {
        this.actionError.set(apiErrorMessage(e));
        this.busyId.set(null);
      },
    });
  }

  protected statusId = (status: string) => toStatusId(status);
  protected label = (status: string) => (status === 'Rejeté' || status === 'Clos' ? status : STATUSES[toStatusId(status)].label);
  protected ago = timeAgo;
}

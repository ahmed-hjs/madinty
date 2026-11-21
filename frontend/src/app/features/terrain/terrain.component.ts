import { DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { API_ORIGIN } from '../../core/config/api.config';
import { TeamIntervention, TeamInterventionDetail, TeamService } from '../../core/services/team.service';
import { apiErrorMessage } from '../../core/utils/errors';
import { SiteFooterComponent } from '../../shared/site-footer/site-footer.component';
import { SiteHeaderComponent } from '../../shared/site-header/site-header.component';

type Tab = 'a_faire' | 'en_cours' | 'terminees';

@Component({
  selector: 'app-terrain',
  standalone: true,
  imports: [DatePipe, FormsModule, SiteHeaderComponent, SiteFooterComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './terrain.component.html',
  styleUrl: './terrain.component.scss',
})
export class TerrainComponent {
  private readonly api = inject(TeamService);

  protected readonly tab = signal<Tab>('a_faire');
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly actionError = signal<string | null>(null);
  protected readonly notice = signal<string | null>(null);
  protected readonly busy = signal(false);
  protected readonly interventions = signal<TeamIntervention[]>([]);
  protected readonly selected = signal<TeamInterventionDetail | null>(null);
  protected readonly stateCounts = signal<Record<Tab, number>>({ a_faire: 0, en_cours: 0, terminees: 0 });
  protected readonly workReport = signal('');
  protected readonly selectedPhotos = signal<File[]>([]);
  protected readonly uploadingKind = signal<'Avant' | 'Après' | null>(null);

  constructor() {
    this.load();
  }

  protected load(): void {
    this.loading.set(true);
    this.error.set(null);
    let remaining = 3;
    const done = () => {
      remaining -= 1;
      if (remaining === 0) this.loading.set(false);
    };
    const fail = (e: HttpErrorResponse) => {
      this.error.set(apiErrorMessage(e, 'Impossible de charger vos missions.'));
      done();
    };
    const states: Tab[] = ['a_faire', 'en_cours', 'terminees'];
    for (const state of states) {
      this.api.interventions(state).subscribe({
        next: (items) => {
          this.stateCounts.update((counts) => ({ ...counts, [state]: items.length }));
          if (state === this.tab()) this.interventions.set(items);
          done();
        },
        error: fail,
      });
    }
  }

  protected selectTab(state: Tab): void {
    this.tab.set(state);
    this.actionError.set(null);
    this.notice.set(null);
    this.error.set(null);
    this.loading.set(true);
    this.api.interventions(state).subscribe({
      next: (items) => {
        this.interventions.set(items);
        this.stateCounts.update((counts) => ({ ...counts, [state]: items.length }));
        this.loading.set(false);
      },
      error: (e: HttpErrorResponse) => {
        this.error.set(apiErrorMessage(e, 'Impossible de charger cette liste de missions.'));
        this.loading.set(false);
      },
    });
  }

  protected open(item: TeamIntervention): void {
    this.actionError.set(null);
    this.selected.set(null);
    this.api.intervention(item.id).subscribe({
      next: (detail) => {
        this.selected.set(detail);
        this.workReport.set(detail.work_report || '');
      },
      error: (e: HttpErrorResponse) => this.actionError.set(apiErrorMessage(e)),
    });
  }

  protected close(): void {
    this.selected.set(null);
    this.selectedPhotos.set([]);
  }

  protected start(): void {
    const item = this.selected();
    if (!item || this.busy() || item.status !== 'Affectée') return;
    this.runAction(this.api.progress(item.id, { status: 'En cours' }), 'Mission démarrée.', 'En cours');
  }

  protected saveReport(): void {
    const item = this.selected();
    if (!item || this.busy()) return;
    this.runAction(this.api.progress(item.id, { work_report: this.workReport() }), 'Compte rendu enregistré.', item.status);
  }

  protected submit(): void {
    const item = this.selected();
    const report = this.workReport().trim();
    if (!item || this.busy() || !report) return;
    this.runAction(this.api.submit(item.id, report), 'Mission soumise à validation.', 'À valider');
  }

  protected onFilesSelected(event: Event): void {
    const input = event.target;
    if (!(input instanceof HTMLInputElement)) return;
    const files = Array.from(input.files || []);
    if (files.length > 5) {
      this.actionError.set('Vous pouvez envoyer cinq photos au maximum par envoi.');
      input.value = '';
      this.selectedPhotos.set([]);
      return;
    }
    this.actionError.set(null);
    this.selectedPhotos.set(files);
  }

  protected upload(kind: 'Avant' | 'Après'): void {
    const item = this.selected();
    const files = this.selectedPhotos();
    if (!item || !files.length || this.busy()) return;
    this.busy.set(true);
    this.uploadingKind.set(kind);
    this.actionError.set(null);
    this.api.uploadPhotos(item.id, kind, files).subscribe({
      next: () => {
        this.selectedPhotos.set([]);
        this.reloadDetail(item.id);
        this.uploadingKind.set(null);
        this.busy.set(false);
      },
      error: (e: HttpErrorResponse) => {
        this.actionError.set(apiErrorMessage(e, 'Impossible d’envoyer les photos.'));
        this.uploadingKind.set(null);
        this.busy.set(false);
      },
    });
  }

  protected photos(kind: 'Avant' | 'Après') {
    return this.selected()?.images.filter((image) => image.kind === kind) || [];
  }

  protected imageUrl(path: string): string {
    return path.startsWith('http') ? path : `${API_ORIGIN}${path}`;
  }

  private runAction(request: ReturnType<TeamService['progress']> | ReturnType<TeamService['submit']>, success: string, status: string): void {
    const current = this.selected();
    if (!current) return;
    this.busy.set(true);
    this.actionError.set(null);
    this.notice.set(null);
    request.subscribe({
      next: () => {
        this.selected.update((value) =>
          value
            ? { ...value, status, ...(status === 'À valider' ? { work_report: this.workReport() } : {}) }
            : value,
        );
        this.reloadListItem(current.id, current.status, status);
        this.notice.set(success);
        this.busy.set(false);
      },
      error: (e: HttpErrorResponse) => {
        this.actionError.set(apiErrorMessage(e));
        this.busy.set(false);
      },
    });
  }

  private reloadDetail(id: number): void {
    this.api.intervention(id).subscribe({
      next: (detail) => this.selected.set(detail),
      error: (e: HttpErrorResponse) => this.actionError.set(apiErrorMessage(e, 'Photos envoyées, mais le détail de la mission n’a pas pu être actualisé.')),
    });
  }

  private reloadListItem(id: number, previousStatus: string, status: string): void {
    const previousState = this.stateFor(previousStatus);
    const state = this.stateFor(status);
    if (previousState !== state) {
      this.stateCounts.update((counts) => ({
        ...counts,
        [previousState]: Math.max(0, counts[previousState] - 1),
        [state]: counts[state] + 1,
      }));
    }
    this.api.interventions(this.tab()).subscribe({
      next: (items) => {
        this.interventions.set(items);
        if (this.tab() === state && !items.some((item) => item.id === id)) {
          this.stateCounts.update((counts) => ({ ...counts, [state]: items.length }));
        }
      },
      error: (e: HttpErrorResponse) => this.actionError.set(apiErrorMessage(e, 'La mission a été mise à jour, mais la liste n’a pas pu être actualisée.')),
    });
  }

  private stateFor(status: string): Tab {
    if (status === 'Terminée') return 'terminees';
    if (status === 'À valider' || status === 'En cours') return 'en_cours';
    return 'a_faire';
  }
}

import { DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { apiErrorMessage } from '../../core/utils/errors';
import {
  OrganizationContestation,
  OrganizationIntervention,
  OrganizationInterventionDetail,
  OrganizationReport,
  OrganizationReportDetail,
  OrganizationReportList,
  OrganizationService,
  OrganizationTeam,
  OrganizationIndicators,
} from '../../core/services/organization.service';
import { toStatusId, timeAgo } from '../../core/models/report.model';
import { SiteFooterComponent } from '../../shared/site-footer/site-footer.component';
import { SiteHeaderComponent } from '../../shared/site-header/site-header.component';

type Tab = 'dashboard' | 'reports' | 'interventions' | 'contests';

@Component({
  selector: 'app-organisme',
  standalone: true,
  imports: [FormsModule, DatePipe, SiteHeaderComponent, SiteFooterComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './organisme.component.html',
  styleUrl: './organisme.component.scss',
})
export class OrganismeComponent {
  private readonly api = inject(OrganizationService);

  protected readonly tab = signal<Tab>('dashboard');
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly actionError = signal<string | null>(null);
  protected readonly busy = signal(false);
  protected readonly reportList = signal<OrganizationReportList | null>(null);
  protected readonly reports = signal<OrganizationReport[]>([]);
  protected readonly selectedReport = signal<OrganizationReportDetail | null>(null);
  protected readonly teams = signal<OrganizationTeam[]>([]);
  protected readonly interventions = signal<OrganizationIntervention[]>([]);
  protected readonly selectedIntervention = signal<OrganizationInterventionDetail | null>(null);
  protected readonly contests = signal<OrganizationContestation[]>([]);
  protected readonly indicators = signal<OrganizationIndicators | null>(null);

  protected statusFilter = '';
  protected search = '';
  protected interventionFilter = '';
  protected contestFilter: 'a_examiner' | 'traitees' = 'a_examiner';
  protected priority = 'Moyenne';
  protected justification = '';
  protected rejectReason = 'Informations insuffisantes';
  protected decisionComment = '';
  protected assignTeamId: number | null = null;
  protected plannedDate = '';
  protected assignInstructions = '';

  protected readonly rejectionReasons = ['Hors compétence', 'Autre organisme concerné', 'Informations insuffisantes', 'Autre'];
  protected readonly priorities = ['Basse', 'Moyenne', 'Haute', 'Critique'];

  constructor() {
    this.load();
  }

  protected setTab(tab: Tab): void {
    this.tab.set(tab);
    this.actionError.set(null);
  }

  protected load(): void {
    this.loading.set(true);
    this.error.set(null);
    let pending = 5;
    const done = () => --pending === 0 && this.loading.set(false);
    const fail = (e: HttpErrorResponse) => {
      this.error.set(apiErrorMessage(e, 'Impossible de charger l’espace organisme.'));
      done();
    };
    this.api.reports().subscribe({ next: (v) => (this.reportList.set(v), this.reports.set(v.items), done()), error: fail });
    this.api.teams().subscribe({ next: (v) => (this.teams.set(v), done()), error: fail });
    this.api.interventions().subscribe({ next: (v) => (this.interventions.set(v), done()), error: fail });
    this.api.contestations('a_examiner').subscribe({ next: (v) => (this.contests.set(v), done()), error: fail });
    this.api.indicators(6).subscribe({ next: (v) => (this.indicators.set(v), done()), error: fail });
  }

  protected reloadReports(): void {
    this.api.reports(this.statusFilter || undefined, this.search || undefined).subscribe({
      next: (v) => (this.reportList.set(v), this.reports.set(v.items)),
      error: (e: HttpErrorResponse) => this.actionError.set(apiErrorMessage(e)),
    });
  }

  protected openReport(report: OrganizationReport): void {
    this.actionError.set(null);
    this.api.report(report.id).subscribe({
      next: (v) => {
        this.selectedReport.set(v);
        this.priority = v.priority || 'Moyenne';
        this.assignTeamId = this.teams()[0]?.id ?? null;
        this.justification = '';
      },
      error: (e: HttpErrorResponse) => this.actionError.set(apiErrorMessage(e)),
    });
  }

  protected closeReport(): void {
    this.selectedReport.set(null);
  }

  protected decideReport(action: 'verify' | 'accept' | 'reject'): void {
    const report = this.selectedReport();
    if (!report || this.busy()) return;
    this.busy.set(true);
    this.actionError.set(null);
    const payload = action === 'reject'
      ? { action, reason: this.rejectReason, comment: this.decisionComment }
      : { action, comment: this.decisionComment };
    this.api.decideReport(report.id, payload).subscribe({
      next: (v) => {
        this.selectedReport.update((r) => r ? { ...r, status: v.status } : r);
        this.reloadReports();
        this.busy.set(false);
      },
      error: (e: HttpErrorResponse) => (this.actionError.set(apiErrorMessage(e)), this.busy.set(false)),
    });
  }

  protected updatePriority(): void {
    const report = this.selectedReport();
    if (!report || !this.justification.trim() || this.busy()) return;
    this.busy.set(true);
    this.api.setPriority(report.id, this.priority, this.justification).subscribe({
      next: (v) => {
        this.selectedReport.update((r) => r ? { ...r, priority: v.priority } : r);
        this.reloadReports();
        this.busy.set(false);
      },
      error: (e: HttpErrorResponse) => (this.actionError.set(apiErrorMessage(e)), this.busy.set(false)),
    });
  }

  protected assignIntervention(): void {
    const report = this.selectedReport();
    if (!report || !this.assignTeamId || this.busy()) return;
    this.busy.set(true);
    this.api.createIntervention({
      report_id: report.id,
      team_id: this.assignTeamId,
      priority: this.priority,
      planned_date: this.plannedDate || undefined,
      instructions: this.assignInstructions || undefined,
    }).subscribe({
      next: () => {
        this.selectedReport.update((r) => r ? { ...r, status: 'Affecté' } : r);
        this.reloadReports();
        this.reloadInterventions();
        this.busy.set(false);
      },
      error: (e: HttpErrorResponse) => (this.actionError.set(apiErrorMessage(e)), this.busy.set(false)),
    });
  }

  protected reloadInterventions(): void {
    this.api.interventions(this.interventionFilter || undefined).subscribe({
      next: (v) => this.interventions.set(v),
      error: (e: HttpErrorResponse) => this.actionError.set(apiErrorMessage(e)),
    });
  }

  protected openIntervention(intervention: OrganizationIntervention): void {
    this.api.intervention(intervention.id).subscribe({
      next: (v) => this.selectedIntervention.set(v),
      error: (e: HttpErrorResponse) => this.actionError.set(apiErrorMessage(e)),
    });
  }

  protected closeIntervention(): void {
    this.selectedIntervention.set(null);
  }

  protected validateIntervention(approve: boolean): void {
    const intervention = this.selectedIntervention();
    if (!intervention || this.busy()) return;
    this.busy.set(true);
    this.api.validateIntervention(intervention.id, {
      approve,
      comment: this.decisionComment || undefined,
      allow_without_photo: approve,
    }).subscribe({
      next: () => {
        this.selectedIntervention.update((v) => v ? { ...v, status: approve ? 'Terminée' : 'En cours' } : v);
        this.reloadInterventions();
        this.busy.set(false);
      },
      error: (e: HttpErrorResponse) => (this.actionError.set(apiErrorMessage(e)), this.busy.set(false)),
    });
  }

  protected reloadContests(): void {
    this.api.contestations(this.contestFilter).subscribe({
      next: (v) => this.contests.set(v),
      error: (e: HttpErrorResponse) => this.actionError.set(apiErrorMessage(e)),
    });
  }

  protected decideContestation(contest: OrganizationContestation, payload: { decision?: 'Acceptée' | 'Rejetée'; reason?: string; escalate?: boolean }): void {
    if (this.busy()) return;
    this.busy.set(true);
    this.actionError.set(null);
    this.api.decideContestation(contest.id, payload).subscribe({
      next: () => (this.reloadContests(), this.busy.set(false)),
      error: (e: HttpErrorResponse) => (this.actionError.set(apiErrorMessage(e)), this.busy.set(false)),
    });
  }

  protected statusId = (status: string) => toStatusId(status);
  protected ago = timeAgo;
}

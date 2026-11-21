import { DatePipe, DecimalPipe, JsonPipe, KeyValuePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Observable, forkJoin } from 'rxjs';
import {
  AdminAuditLog,
  AdminCategory,
  AdminContestation,
  AdminDashboard,
  AdminOrganization,
  AdminRole,
  AdminService,
  AdminSetting,
  AdminUser,
  AdminUserState,
} from '../../core/services/admin.service';
import { AuthService } from '../../core/services/auth.service';
import { apiErrorMessage } from '../../core/utils/errors';
import { SiteFooterComponent } from '../../shared/site-footer/site-footer.component';
import { SiteHeaderComponent } from '../../shared/site-header/site-header.component';

type Tab = 'overview' | 'users' | 'organizations' | 'categories' | 'contests' | 'settings' | 'audit';
type CategoryDraft = {
  label: string;
  organization_id: number;
  severity_weight: number;
  risk_weight: number;
};

@Component({
  selector: 'app-admin',
  standalone: true,
  imports: [DatePipe, DecimalPipe, FormsModule, JsonPipe, KeyValuePipe, SiteHeaderComponent, SiteFooterComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './admin.component.html',
  styleUrl: './admin.component.scss',
})
export class AdminComponent {
  private readonly api = inject(AdminService);
  protected readonly auth = inject(AuthService);

  protected readonly tab = signal<Tab>('overview');
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly actionError = signal<string | null>(null);
  protected readonly notice = signal<string | null>(null);
  protected readonly busy = signal(false);

  protected readonly dashboard = signal<AdminDashboard | null>(null);
  protected readonly users = signal<AdminUser[]>([]);
  protected readonly organizations = signal<AdminOrganization[]>([]);
  protected readonly categories = signal<AdminCategory[]>([]);
  protected readonly contests = signal<AdminContestation[]>([]);
  protected readonly settings = signal<AdminSetting[]>([]);
  protected readonly auditLogs = signal<AdminAuditLog[]>([]);
  protected readonly editingCategory = signal<AdminCategory | null>(null);
  protected readonly contestReasons = signal<Record<number, string>>({});

  protected readonly roles: AdminRole[] = ['Citoyen', 'Administrateur', 'Organisme', "Responsable d'équipe"];
  protected readonly states: AdminUserState[] = ['Actif', 'Inactif', 'Suspendu'];
  protected readonly usersByRole = computed(() => {
    const groups: Record<AdminRole, number> = {
      Citoyen: 0,
      Administrateur: 0,
      Organisme: 0,
      "Responsable d'équipe": 0,
    };
    for (const user of this.users()) groups[user.role] += 1;
    return groups;
  });
  protected readonly signalementTotal = computed(() =>
    Object.values(this.dashboard()?.signalements_par_statut || {}).reduce((sum, count) => sum + count, 0),
  );
  protected readonly visibleUsers = computed(() => {
    const query = this.userSearch().trim().toLocaleLowerCase();
    return this.users().filter((user) => {
      const selectedRole = this.userRole();
      const roleMatches = !selectedRole || user.role === selectedRole;
      const queryMatches =
        !query ||
        `${user.full_name} ${user.email} ${user.organization_name || ''}`.toLocaleLowerCase().includes(query);
      return roleMatches && queryMatches;
    });
  });

  protected readonly userSearch = signal('');
  protected readonly userRole = signal<AdminRole | ''>('');
  protected newUser = { full_name: '', email: '', password: '', role: 'Citoyen' as AdminRole, organization_id: null as number | null };
  protected newCategory = { label: '', organization_id: null as number | null, description: '', severity_weight: 2, risk_weight: 2 };
  protected categoryDraft: CategoryDraft = { label: '', organization_id: 0, severity_weight: 2, risk_weight: 2 };
  protected contestDelayMinutes = 10080;

  constructor() {
    this.load();
  }

  protected setTab(tab: Tab): void {
    this.tab.set(tab);
    this.actionError.set(null);
    this.notice.set(null);
  }

  protected load(): void {
    this.loading.set(true);
    this.error.set(null);
    forkJoin({
      dashboard: this.api.dashboard(),
      users: this.api.users(),
      organizations: this.api.organizations(),
      categories: this.api.categories(),
      contests: this.api.contestations(),
      settings: this.api.settings(),
      auditLogs: this.api.auditLogs(100),
    }).subscribe({
      next: (data) => {
        this.dashboard.set(data.dashboard);
        this.users.set(data.users);
        this.organizations.set(data.organizations);
        this.categories.set(data.categories);
        this.contests.set(data.contests);
        this.settings.set(data.settings);
        const contestSetting = data.settings.find((setting) => setting.key === 'contest_delay_minutes');
        if (contestSetting) this.contestDelayMinutes = Number(contestSetting.value);
        this.auditLogs.set(data.auditLogs);
        this.loading.set(false);
      },
      error: (e: HttpErrorResponse) => {
        this.error.set(apiErrorMessage(e, 'Impossible de charger l’espace administration.'));
        this.loading.set(false);
      },
    });
  }

  protected createUser(): void {
    if (this.busy()) return;
    const requiresOrganization = this.newUser.role === 'Organisme' || this.newUser.role === "Responsable d'équipe";
    if (requiresOrganization && !this.newUser.organization_id) {
      this.actionError.set('Choisissez un organisme pour ce rôle.');
      return;
    }
    this.run(
      this.api.createUser({
        ...this.newUser,
        organization_id: requiresOrganization ? this.newUser.organization_id || undefined : undefined,
      }),
      'Le compte a été créé.',
      () => {
        this.newUser = { full_name: '', email: '', password: '', role: 'Citoyen', organization_id: null };
        this.load();
      },
    );
  }

  protected updateUser(user: AdminUser, change: { role?: AdminRole; state?: AdminUserState }): void {
    if (this.busy() || String(user.id) === String(this.auth.user()?.id)) return;
    this.busy.set(true);
    this.clearMessages();
    this.api.updateUser(user.id, change).subscribe({
      next: (updated) => {
        this.users.update((items) => items.map((item) => item.id === user.id ? { ...item, ...updated } : item));
        this.notice.set(`Le compte de ${user.full_name} a été mis à jour.`);
        this.busy.set(false);
      },
      error: (e: HttpErrorResponse) => this.fail(e),
    });
  }

  protected createCategory(): void {
    if (this.busy() || !this.newCategory.organization_id) return;
    this.run(
      this.api.createCategory({
        ...this.newCategory,
        organization_id: this.newCategory.organization_id,
        description: this.newCategory.description || undefined,
      }),
      'La catégorie a été créée.',
      () => {
        this.newCategory = { label: '', organization_id: null, description: '', severity_weight: 2, risk_weight: 2 };
        this.load();
      },
    );
  }

  protected editCategory(category: AdminCategory): void {
    this.editingCategory.set(category);
    this.categoryDraft = {
      label: category.label,
      organization_id: category.organization_id,
      severity_weight: Number(category.severity_weight),
      risk_weight: Number(category.risk_weight),
    };
  }

  protected closeCategoryEditor(): void {
    this.editingCategory.set(null);
  }

  protected saveCategory(): void {
    const category = this.editingCategory();
    if (!category || this.busy()) return;
    this.run(
      this.api.updateCategory(category.id, this.categoryDraft),
      'La catégorie a été mise à jour.',
      () => {
        this.editingCategory.set(null);
        this.load();
      },
    );
  }

  protected toggleCategory(category: AdminCategory): void {
    if (this.busy()) return;
    this.run(
      this.api.updateCategory(category.id, { is_active: !category.is_active }),
      category.is_active ? 'Catégorie désactivée.' : 'Catégorie réactivée.',
      () => this.load(),
    );
  }

  protected saveContestDelay(): void {
    if (this.busy()) return;
    this.run(
      this.api.updateSetting('contest_delay_minutes', this.contestDelayMinutes),
      'Le délai de contestation a été enregistré.',
      () => this.load(),
    );
  }

  protected decideContestation(contest: AdminContestation, decision: 'Acceptée' | 'Rejetée'): void {
    const reason = this.contestReasons()[contest.id]?.trim();
    if (!reason || this.busy()) return;
    this.run(
      this.api.decideContestation(contest.id, decision, reason),
      `Contestation ${decision.toLocaleLowerCase()} avec succès.`,
      () => this.load(),
    );
  }

  protected setContestationReason(id: number, reason: string): void {
    this.contestReasons.update((values) => ({ ...values, [id]: reason }));
  }

  protected isCurrentUser(user: AdminUser): boolean {
    return String(user.id) === String(this.auth.user()?.id);
  }

  protected contestReason(id: number): string {
    return this.contestReasons()[id] || '';
  }

  private clearMessages(): void {
    this.actionError.set(null);
    this.notice.set(null);
  }

  private fail(error: HttpErrorResponse): void {
    this.actionError.set(apiErrorMessage(error));
    this.busy.set(false);
  }

  private run<T>(request: Observable<T>, success: string, afterSuccess: () => void): void {
    this.busy.set(true);
    this.clearMessages();
    request.subscribe({
      next: () => {
        this.notice.set(success);
        this.busy.set(false);
        afterSuccess();
      },
      error: (e: HttpErrorResponse) => this.fail(e),
    });
  }
}

import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_URL } from '../config/api.config';

export type AdminRole = 'Citoyen' | 'Administrateur' | 'Organisme' | "Responsable d'équipe";
export type AdminUserState = 'Actif' | 'Inactif' | 'Suspendu';

export interface AdminUser {
  id: number;
  full_name: string;
  email: string;
  role: AdminRole;
  state: AdminUserState;
  organization_id: number | null;
  organization_name: string | null;
  created_at: string;
}

export type AdminUserMutation = Pick<AdminUser, 'id' | 'full_name' | 'email' | 'role' | 'state' | 'organization_id'>;

export interface AdminOrganization {
  id: number;
  name: string;
  slug: string | null;
  type: string | null;
  teams: number;
  categories: number;
}

export interface AdminCategory {
  id: number;
  organization_id: number;
  organization_name: string;
  label: string;
  description: string | null;
  severity_weight: number;
  risk_weight: number;
  is_active: boolean;
}

export interface AdminSetting {
  key: string;
  value: string;
  updated_at: string;
}

export interface AdminAuditLog {
  id: number;
  action: string;
  resource: string;
  resource_id: number | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  actor: string | null;
}

export interface AdminDashboard {
  signalements_par_statut: Record<string, number>;
  utilisateurs_par_role: Record<string, number>;
  contestations_a_examiner: number;
}

export interface AdminContestation {
  id: number;
  report_reference: string;
  title: string;
  message: string;
  decision: string | null;
  decision_reason: string | null;
  escalated_to_admin: boolean;
  created_at: string;
}

@Injectable({ providedIn: 'root' })
export class AdminService {
  private readonly http = inject(HttpClient);
  private readonly base = `${API_URL}/admin`;

  dashboard(): Observable<AdminDashboard> {
    return this.http.get<AdminDashboard>(`${this.base}/dashboard`);
  }

  users(role?: AdminRole): Observable<AdminUser[]> {
    let params = new HttpParams();
    if (role) params = params.set('role', role);
    return this.http.get<AdminUser[]>(`${this.base}/users`, { params });
  }

  createUser(payload: {
    full_name: string;
    email: string;
    password: string;
    role: AdminRole;
    organization_id?: number;
  }): Observable<AdminUserMutation> {
    return this.http.post<AdminUserMutation>(`${this.base}/users`, payload);
  }

  updateUser(id: number, payload: { role?: AdminRole; state?: AdminUserState }): Observable<AdminUserMutation> {
    return this.http.patch<AdminUserMutation>(`${this.base}/users/${id}`, payload);
  }

  organizations(): Observable<AdminOrganization[]> {
    return this.http.get<AdminOrganization[]>(`${this.base}/organizations`);
  }

  categories(): Observable<AdminCategory[]> {
    return this.http.get<AdminCategory[]>(`${this.base}/categories`);
  }

  createCategory(payload: {
    label: string;
    organization_id: number;
    description?: string;
    severity_weight?: number;
    risk_weight?: number;
  }): Observable<AdminCategory> {
    return this.http.post<AdminCategory>(`${this.base}/categories`, payload);
  }

  updateCategory(id: number, payload: {
    organization_id?: number;
    is_active?: boolean;
    label?: string;
    severity_weight?: number;
    risk_weight?: number;
  }): Observable<AdminCategory> {
    return this.http.patch<AdminCategory>(`${this.base}/categories/${id}`, payload);
  }

  settings(): Observable<AdminSetting[]> {
    return this.http.get<AdminSetting[]>(`${this.base}/settings`);
  }

  updateSetting(key: string, value: number): Observable<AdminSetting> {
    return this.http.put<AdminSetting>(`${this.base}/settings/${encodeURIComponent(key)}`, { value });
  }

  auditLogs(limit = 50): Observable<AdminAuditLog[]> {
    const params = new HttpParams().set('limit', limit);
    return this.http.get<AdminAuditLog[]>(`${this.base}/audit-logs`, { params });
  }

  contestations(): Observable<AdminContestation[]> {
    return this.http.get<AdminContestation[]>(`${this.base}/contestations`);
  }

  decideContestation(id: number, decision: 'Acceptée' | 'Rejetée', reason: string): Observable<{ ok: boolean }> {
    return this.http.post<{ ok: boolean }>(`${this.base}/contestations/${id}/decision`, { decision, reason });
  }
}

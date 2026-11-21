import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_URL } from '../config/api.config';

export interface OrganizationReport {
  id: number;
  reference: string;
  title: string;
  status: string;
  priority: string | null;
  priority_score: number | null;
  created_at: string;
  category_id: number;
  category_label: string;
  supports_count: number;
}

export interface OrganizationReportList {
  items: OrganizationReport[];
  counts_by_status: Record<string, number>;
}

export interface OrganizationReportDetail extends OrganizationReport {
  description: string;
  address: string | null;
  latitude: number | string;
  longitude: number | string;
  organization_name: string;
  rejection_reason: string | null;
  rejection_comment: string | null;
  supports_count: number;
  images: { id: number; context: string; kind: string | null; url: string }[];
  history: { old_status: string | null; new_status: string; comment: string | null; created_at: string; actor: string }[];
  possible_duplicates: { id: number; reference: string; title: string; status: string; distance_m: number }[];
  interventions: { id: number; reference: string; status: string }[];
}

export interface OrganizationTeam {
  id: number;
  name: string;
  domain: string | null;
  members_count: number;
  lead_id: number | null;
  lead_name: string | null;
  en_cours: number;
  a_faire: number;
}

export interface OrganizationIntervention {
  id: number;
  reference: string;
  status: string;
  priority: string | null;
  planned_date: string | null;
  report_id: number;
  report_reference: string;
  title: string;
  team_name: string | null;
}

export interface OrganizationInterventionDetail extends OrganizationIntervention {
  work_report: string | null;
  instructions: string | null;
  submitted_at: string | null;
  report: { title: string; address: string | null; description: string; category_label: string };
  images: { id: number; context: string; kind: string | null; url: string }[];
  history: { old_status: string | null; new_status: string; comment: string | null; created_at: string }[];
}

export interface OrganizationContestation {
  id: number;
  report_id: number;
  report_reference: string;
  title: string;
  message: string;
  decision: 'Acceptée' | 'Rejetée' | null;
  decision_reason: string | null;
  escalated_to_admin: boolean;
  created_at: string;
  work_report: string | null;
  images: { id: number; url: string }[];
}

export interface OrganizationIndicators {
  perimetre: string;
  periode: string;
  total: number;
  a_examiner: number;
  en_cours: number;
  en_attente: number;
  taux_resolution: number;
  delai_moyen_jours: number | null;
  delai_median_jours: number | null;
  taux_contestation: number;
  par_categorie: { label: string; total: number; resolus: number; delai_moyen_jours: number | null }[];
  par_mois: { mois: string; recus: number; resolus: number }[];
  note: string;
}

@Injectable({ providedIn: 'root' })
export class OrganizationService {
  private readonly http = inject(HttpClient);
  private readonly base = `${API_URL}/organisme`;

  reports(status?: string, q?: string): Observable<OrganizationReportList> {
    let params = new HttpParams();
    if (status) params = params.set('status', status);
    if (q) params = params.set('q', q);
    return this.http.get<OrganizationReportList>(`${this.base}/reports`, { params });
  }

  report(id: number): Observable<OrganizationReportDetail> {
    return this.http.get<OrganizationReportDetail>(`${this.base}/reports/${id}`);
  }

  decideReport(id: number, payload: { action: 'verify' | 'accept' | 'reject'; reason?: string; comment?: string }): Observable<{ status: string }> {
    return this.http.post<{ status: string }>(`${this.base}/reports/${id}/decision`, payload);
  }

  setPriority(id: number, priority: string, justification: string): Observable<{ priority: string }> {
    return this.http.post<{ priority: string }>(`${this.base}/reports/${id}/priority`, { priority, justification });
  }

  teams(): Observable<OrganizationTeam[]> {
    return this.http.get<OrganizationTeam[]>(`${this.base}/teams`);
  }

  interventions(status?: string): Observable<OrganizationIntervention[]> {
    let params = new HttpParams();
    if (status) params = params.set('status', status);
    return this.http.get<OrganizationIntervention[]>(`${this.base}/interventions`, { params });
  }

  intervention(id: number): Observable<OrganizationInterventionDetail> {
    return this.http.get<OrganizationInterventionDetail>(`${this.base}/interventions/${id}`);
  }

  createIntervention(payload: {
    report_id: number;
    team_id: number;
    lead_id?: number;
    priority?: string;
    planned_date?: string;
    instructions?: string;
  }): Observable<OrganizationIntervention> {
    return this.http.post<OrganizationIntervention>(`${this.base}/interventions`, payload);
  }

  validateIntervention(id: number, payload: { approve: boolean; comment?: string; allow_without_photo?: boolean }): Observable<unknown> {
    return this.http.post(`${this.base}/interventions/${id}/validate`, payload);
  }

  contestations(state: 'a_examiner' | 'traitees'): Observable<OrganizationContestation[]> {
    const params = new HttpParams().set('state', state);
    return this.http.get<OrganizationContestation[]>(`${this.base}/contestations`, { params });
  }

  decideContestation(id: number, payload: { decision?: 'Acceptée' | 'Rejetée'; reason?: string; escalate?: boolean }): Observable<{ ok: boolean }> {
    return this.http.post<{ ok: boolean }>(`${this.base}/contestations/${id}/decision`, payload);
  }

  indicators(months = 6): Observable<OrganizationIndicators> {
    const params = new HttpParams().set('months', months);
    return this.http.get<OrganizationIndicators>(`${this.base}/indicators`, { params });
  }
}

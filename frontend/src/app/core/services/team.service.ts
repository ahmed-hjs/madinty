import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_URL } from '../config/api.config';

export type TeamInterventionState = 'a_faire' | 'en_cours' | 'terminees';

export interface TeamIntervention {
  id: number;
  reference: string;
  status: string;
  priority: string | null;
  planned_date: string | null;
  report_reference: string;
  title: string;
  address: string | null;
  category_label: string;
}

export interface TeamInterventionDetail extends TeamIntervention {
  report_id: number;
  team_id: number;
  lead_id: number;
  organization_id: number;
  instructions: string | null;
  work_report: string | null;
  submitted_at: string | null;
  report: {
    id: number;
    reference: string;
    title: string;
    description: string;
    address: string | null;
    latitude: number | string;
    longitude: number | string;
    category_label: string;
  };
  images: { id: number; kind: 'Avant' | 'Après' | null; url: string }[];
}

@Injectable({ providedIn: 'root' })
export class TeamService {
  private readonly http = inject(HttpClient);
  private readonly base = `${API_URL}/equipe`;

  interventions(state?: TeamInterventionState): Observable<TeamIntervention[]> {
    let params = new HttpParams();
    if (state) params = params.set('state', state);
    return this.http.get<TeamIntervention[]>(`${this.base}/interventions`, { params });
  }

  intervention(id: number): Observable<TeamInterventionDetail> {
    return this.http.get<TeamInterventionDetail>(`${this.base}/interventions/${id}`);
  }

  progress(id: number, payload: { status?: 'En cours'; work_report?: string }): Observable<{ status: string }> {
    return this.http.post<{ status: string }>(`${this.base}/interventions/${id}/progress`, payload);
  }

  uploadPhotos(id: number, kind: 'Avant' | 'Après', files: File[]): Observable<{ id: number; kind: string; url: string }[]> {
    const form = new FormData();
    form.append('kind', kind);
    files.forEach((file) => form.append('photos', file, file.name));
    return this.http.post<{ id: number; kind: string; url: string }[]>(`${this.base}/interventions/${id}/images`, form);
  }

  submit(id: number, work_report: string): Observable<{ status: string }> {
    return this.http.post<{ status: string }>(`${this.base}/interventions/${id}/submit`, { work_report });
  }
}

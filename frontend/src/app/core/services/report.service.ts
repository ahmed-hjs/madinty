import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { API_URL } from '../config/api.config';
import { ApiReport, Report, toReport } from '../models/report.model';

export interface PublicStats {
  total: number;
  resolvedPct: number;
  avgDays: number;
}

export interface ApiCategory {
  id: number;
  label: string;
  description: string | null;
  icon_key: string;
  organization_id: number;
  organization_name: string;
}

export interface NewReportPayload {
  title: string;
  description: string;
  category_id: number;
  latitude: number;
  longitude: number;
  address?: string;
}

export interface CreatedReport {
  id: number;
  reference: string;
  title: string;
  status: string;
  organization_name: string;
}

export interface NearbyReport {
  id: number;
  reference: string;
  title: string;
  status: string;
  created_at: string;
  distance_m: number;
  supports_count: number;
  supported_by_me: boolean;
  is_mine: boolean;
}

export interface ReportImage {
  id: number;
  context: 'Signalement' | 'Intervention' | 'Contestation';
  kind: 'Avant' | 'Après' | null;
  url: string;
}

export interface HistoryItem {
  old_status: string | null;
  new_status: string;
  comment: string | null;
  created_at: string;
  actor: string;
}

export interface ContestationInfo {
  id: number;
  message: string;
  decision: 'Acceptée' | 'Rejetée' | null;
  decision_reason: string | null;
  created_at: string;
}

export interface ReportDetail extends ApiReport {
  description: string;
  contest_deadline: string | null;
  resolution_round: number;
  organization_id: number;
  organization_name: string;
  is_author: boolean;
  images: ReportImage[];
  work_report?: string | null;
  rejection_reason?: string | null;
  rejection_comment?: string | null;
  history?: HistoryItem[];
  contestation?: ContestationInfo | null;
}

export interface MineItem {
  id: number;
  reference: string;
  title: string;
  status: string;
  created_at: string;
  contest_deadline: string | null;
  resolution_round: number;
  category_label: string;
  organization_name: string;
  supports_count: number;
  contested: boolean;
}

export interface SupportedItem {
  id: number;
  reference: string;
  title: string;
  status: string;
  created_at: string;
  category_label: string;
}

export interface SupportResult {
  supports_count: number;
  supported_by_me: boolean;
}

@Injectable({ providedIn: 'root' })
export class ReportService {
  private readonly http = inject(HttpClient);

  getPublicReports(): Observable<Report[]> {
    const params = new HttpParams().set('limit', 500);
    return this.http.get<ApiReport[]>(`${API_URL}/reports`, { params }).pipe(map((rows) => rows.map(toReport)));
  }

  getPublicStats(): Observable<PublicStats> {
    return this.http
      .get<{ signalements: number; taux_resolution: number; delai_moyen_jours: number | null }>(`${API_URL}/public/stats`)
      .pipe(
        map((s) => ({
          total: s.signalements,
          resolvedPct: s.taux_resolution,
          avgDays: Math.round(s.delai_moyen_jours ?? 0),
        })),
      );
  }

  categories(): Observable<ApiCategory[]> {
    return this.http.get<ApiCategory[]>(`${API_URL}/categories`);
  }

  get(ref: string): Observable<ReportDetail> {
    return this.http.get<ReportDetail>(`${API_URL}/reports/${encodeURIComponent(ref)}`);
  }

  create(payload: NewReportPayload): Observable<CreatedReport> {
    return this.http.post<CreatedReport>(`${API_URL}/reports`, payload);
  }

  uploadPhotos(reportId: number, files: File[]): Observable<ReportImage[]> {
    const form = new FormData();
    files.forEach((f) => form.append('photos', f, f.name));
    return this.http.post<ReportImage[]>(`${API_URL}/reports/${reportId}/images`, form);
  }

  nearby(latitude: number, longitude: number, categoryId: number): Observable<NearbyReport[]> {
    const params = new HttpParams().set('latitude', latitude).set('longitude', longitude).set('category_id', categoryId);
    return this.http.get<NearbyReport[]>(`${API_URL}/reports/nearby`, { params });
  }

  support(reportId: number): Observable<SupportResult> {
    return this.http.post<SupportResult>(`${API_URL}/reports/${reportId}/support`, {});
  }

  mine(): Observable<MineItem[]> {
    return this.http.get<MineItem[]>(`${API_URL}/reports/mine`);
  }

  supported(): Observable<SupportedItem[]> {
    return this.http.get<SupportedItem[]>(`${API_URL}/reports/supported`);
  }

  confirm(reportId: number): Observable<{ status: string }> {
    return this.http.post<{ status: string }>(`${API_URL}/reports/${reportId}/confirm`, {});
  }

  contest(reportId: number, message: string, photo?: File | null): Observable<unknown> {
    const form = new FormData();
    form.append('message', message);
    if (photo) form.append('photos', photo, photo.name);
    return this.http.post(`${API_URL}/reports/${reportId}/contest`, form);
  }
}

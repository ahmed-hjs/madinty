import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_URL } from '../config/api.config';

export interface OrgSummary {
  id: number;
  name: string;
  slug: string;
  type: string;
  description: string;
  domaines: string[];
}

export interface OrgStats {
  signalements: number;
  resolus: number;
  en_attente: number;
  taux_resolution: number;
  delai_moyen_jours: number | null;
  delai_median_jours: number | null;
}

export interface OrgDetail {
  organisme: { id: number; name: string; slug: string; type: string; description: string };
  contact: { email: string | null; telephone: string | null; horaires: string | null };
  domaines: { id: number; label: string }[];
  statistiques: OrgStats;
  par_categorie: { label: string; total: number }[];
  derniers_resolus: { reference: string; title: string; status: string; resolved_at: string | null }[];
  perimetre_et_limites: string;
}

export interface ContactPayload {
  name: string;
  email: string;
  subject: string;
  message: string;
}

export interface DomainVisual {
  icon: string | null;
  color: string;
}

const strip = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export function domainVisual(label: string): DomainVisual {
  const l = strip(label);
  if (l.includes('eclairage') || l.includes('electri')) return { icon: 'eclairage', color: '#F59E0B' };
  if (l.includes('voirie') || l.includes('trottoir')) return { icon: 'voirie', color: '#6366F1' };
  if (l.includes('dechet') || l.includes('propret')) return { icon: 'proprete', color: '#14B8A6' };
  if (l.includes('eau') || l.includes('fuite') || l.includes('egout') || l.includes('assainissement'))
    return { icon: 'eau', color: '#0EA5E9' };
  if (l.includes('mobilier') || l.includes('espaces verts')) return { icon: 'mobilier', color: '#A855F7' };
  return { icon: null, color: '#5F6368' };
}

export function orgInitials(name: string): string {
  const words = name
    .split(/\s+/)
    .filter((w) => w.length > 2 || /^[A-Z]/.test(w))
    .filter((w) => !['de', 'du', 'des', 'la', 'le', 'les'].includes(w.toLowerCase()));
  if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase();
  return (words[0] ?? name).slice(0, 2).toUpperCase();
}

@Injectable({ providedIn: 'root' })
export class PublicService {
  private readonly http = inject(HttpClient);

  organizations(): Observable<OrgSummary[]> {
    return this.http.get<OrgSummary[]>(`${API_URL}/public/organizations`);
  }

  organization(slug: string): Observable<OrgDetail> {
    return this.http.get<OrgDetail>(`${API_URL}/public/organizations/${encodeURIComponent(slug)}`);
  }

  sendContact(payload: ContactPayload): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${API_URL}/public/contact`, payload);
  }
}

import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, map } from 'rxjs';
import { API_URL } from '../config/api.config';
import { Session, User, homeRouteFor, normalizeRole } from '../models/auth.model';

const STORAGE_KEY = 'madinty.session';

interface RawUser {
  id: number | string;
  fullName?: string;
  full_name?: string;
  email: string;
  role: string;
}

interface AuthResponse {
  token: string;
  user: RawUser;
}

export interface RegisterPayload {
  fullName: string;
  email: string;
  password: string;
  privacyAccepted: boolean;
}

function toUser(raw: RawUser): User {
  return {
    id: raw.id,
    fullName: raw.fullName ?? raw.full_name ?? '',
    email: raw.email,
    role: normalizeRole(raw.role),
  };
}

function isExpired(token: string): boolean {
  try {
    const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))) as { exp?: number };
    return typeof payload.exp === 'number' && payload.exp * 1000 <= Date.now();
  } catch {
    return false;
  }
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly session = signal<Session | null>(this.restore());

  readonly user = computed(() => this.session()?.user ?? null);
  readonly token = computed(() => this.session()?.token ?? null);
  readonly isAuthenticated = computed(() => this.session() !== null);

  login(email: string, password: string, remember: boolean): Observable<User> {
    return this.http
      .post<AuthResponse>(`${API_URL}/auth/login`, { email, password })
      .pipe(map((res) => this.open(res, remember)));
  }

  register(payload: RegisterPayload): Observable<User> {
    return this.http
      .post<AuthResponse>(`${API_URL}/auth/register`, {
        full_name: payload.fullName,
        email: payload.email,
        password: payload.password,
        privacy_accepted: payload.privacyAccepted,
      })
      .pipe(map((res) => this.open(res, true)));
  }

  forgotPassword(email: string): Observable<void> {
    return this.http.post<void>(`${API_URL}/auth/forgot-password`, { email });
  }

  resetPassword(token: string, password: string): Observable<User> {
    return this.http
      .post<AuthResponse>(`${API_URL}/auth/reset-password`, { token, password })
      .pipe(map((res) => this.open(res, false)));
  }

  logout(): void {
    this.clearStorage();
    this.session.set(null);
    void this.router.navigateByUrl('/');
  }

  homeRoute(): string {
    return homeRouteFor(this.user()?.role);
  }

  private open(res: AuthResponse, remember: boolean): User {
    const session: Session = { token: res.token, user: toUser(res.user) };
    this.clearStorage();
    try {
      (remember ? localStorage : sessionStorage).setItem(STORAGE_KEY, JSON.stringify(session));
    } catch {
    }
    this.session.set(session);
    return session.user;
  }

  private restore(): Session | null {
    try {
      const raw = localStorage.getItem(STORAGE_KEY) ?? sessionStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const session = JSON.parse(raw) as Session;
      if (!session?.token || !session.user || isExpired(session.token)) {
        this.clearStorage();
        return null;
      }
      return session;
    } catch {
      return null;
    }
  }

  private clearStorage(): void {
    try {
      localStorage.removeItem(STORAGE_KEY);
      sessionStorage.removeItem(STORAGE_KEY);
    } catch {
    }
  }
}

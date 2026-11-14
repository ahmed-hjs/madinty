import { Injectable, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { User, homeRouteFor } from '../../core/models/auth.model';

export type AuthView = 'login' | 'register' | 'forgot' | 'reset';

export interface OpenOptions {
  reason?: string;
  onSuccess?: () => void;
}

@Injectable({ providedIn: 'root' })
export class AuthModalService {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private onSuccess: (() => void) | null = null;

  readonly isOpen = signal(false);
  readonly view = signal<AuthView>('login');
  readonly reason = signal<string | null>(null);
  readonly resetToken = signal('');

  constructor() {
    this.openResetFromUrl();
  }

  open(view: AuthView = 'login', options: OpenOptions = {}): void {
    this.view.set(view);
    this.reason.set(options.reason ?? null);
    this.onSuccess = options.onSuccess ?? null;
    this.isOpen.set(true);
  }

  show(view: AuthView): void {
    this.view.set(view);
  }

  close(): void {
    this.isOpen.set(false);
    this.onSuccess = null;
  }

  requireLogin(action: () => void, reason?: string): void {
    if (this.auth.isAuthenticated()) {
      action();
    } else {
      this.open('login', { reason, onSuccess: action });
    }
  }

  completeLogin(user: User): void {
    const resume = this.onSuccess;
    this.close();
    const home = homeRouteFor(user.role);
    const hasSpace = this.router.config.some((route) => `/${route.path}` === home);
    if (user.role !== 'citizen' && hasSpace) {
      void this.router.navigateByUrl(home);
      return;
    }
    if (resume) setTimeout(resume, 0);
  }

  private openResetFromUrl(): void {
    if (typeof window === 'undefined') return;
    const url = new URL(window.location.href);
    const token = url.searchParams.get('jeton');
    if (!token) return;
    this.resetToken.set(token);
    this.view.set('reset');
    this.isOpen.set(true);
    url.searchParams.delete('jeton');
    window.history.replaceState(window.history.state, '', url.pathname + url.search + url.hash);
  }
}

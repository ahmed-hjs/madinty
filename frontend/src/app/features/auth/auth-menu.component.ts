import { Component, inject } from '@angular/core';
import { AuthService } from '../../core/services/auth.service';
import { AuthModalService } from './auth-modal.service';

@Component({
  selector: 'app-auth-menu',
  template: `
    <div class="menu">
      @if (auth.user(); as user) {
        <span class="avatar" aria-hidden="true">{{ initials(user.fullName) }}</span>
        <span class="name">{{ user.fullName }}</span>
        <button type="button" class="pill pill--outline" (click)="auth.logout()">Se déconnecter</button>
      } @else {
        <button type="button" class="pill pill--outline" (click)="modal.open('login')">Connexion</button>
        <button type="button" class="pill pill--solid" (click)="modal.open('register')">S’inscrire</button>
      }
    </div>
  `,
  styles: [
    `
      :host {
        --m-blue: #1a73e8;
        --m-link: #1a73e8;
        --m-border: #dadce0;
        --m-text: #202124;
        --m-neutral: #f1f3f4;
      }
      @media (prefers-color-scheme: dark) {
        :host {
          --m-link: #8ab4f8;
          --m-border: #3c4043;
          --m-text: #e8eaed;
          --m-neutral: #272b31;
        }
      }
      .menu {
        display: flex;
        align-items: center;
        gap: 8px;
      }
      .pill {
        min-height: 40px;
        padding: 0 16px;
        border-radius: 999px;
        font: inherit;
        font-weight: 600;
        cursor: pointer;
      }
      .pill--outline {
        border: 1px solid var(--m-border);
        background: transparent;
        color: var(--m-link);
      }
      .pill--solid {
        border: 1px solid var(--m-blue);
        background: var(--m-blue);
        color: #ffffff;
      }
      .avatar {
        display: grid;
        place-items: center;
        width: 36px;
        height: 36px;
        border-radius: 50%;
        background: var(--m-neutral);
        color: var(--m-text);
        font-size: 13px;
        font-weight: 700;
      }
      .name {
        color: var(--m-text);
        font-weight: 600;
      }
      @media (max-width: 640px) {
        .name {
          display: none;
        }
      }
    `,
  ],
})
export class AuthMenuComponent {
  protected readonly auth = inject(AuthService);
  protected readonly modal = inject(AuthModalService);

  protected initials(fullName: string): string {
    const parts = fullName.trim().split(/\s+/).filter(Boolean);
    return ((parts[0]?.[0] ?? '') + (parts.length > 1 ? (parts[parts.length - 1][0] ?? '') : '')).toUpperCase();
  }
}

import { ChangeDetectionStrategy, Component, HostListener, inject, signal } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { AuthModalService } from '../../features/auth/auth-modal.service';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-site-header',
  standalone: true,
  imports: [RouterLink, RouterLinkActive],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './site-header.component.html',
  styleUrl: './site-header.component.scss',
})
export class SiteHeaderComponent {
  protected readonly auth = inject(AuthService);
  private readonly modal = inject(AuthModalService);
  protected readonly profileOpen = signal(false);

  @HostListener('document:click')
  closeProfile(): void {
    if (this.profileOpen()) this.profileOpen.set(false);
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.profileOpen.set(false);
  }

  protected openAuth(view: 'login' | 'register'): void {
    this.modal.open(view);
  }

  protected toggleProfile(event: Event): void {
    event.stopPropagation();
    this.profileOpen.update((v) => !v);
  }

  protected logout(): void {
    this.profileOpen.set(false);
    this.auth.logout();
  }

  protected initials(fullName: string): string {
    const parts = fullName.trim().split(/\s+/).filter(Boolean);
    return ((parts[0]?.[0] ?? '') + (parts.length > 1 ? (parts[parts.length - 1][0] ?? '') : '')).toUpperCase() || '?';
  }
}

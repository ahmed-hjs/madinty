import { Component, ElementRef, ViewEncapsulation, effect, inject, viewChild } from '@angular/core';
import { AuthModalService } from './auth-modal.service';
import { ForgotViewComponent } from './views/forgot-view.component';
import { LoginViewComponent } from './views/login-view.component';
import { RegisterViewComponent } from './views/register-view.component';
import { ResetViewComponent } from './views/reset-view.component';

const FOCUSABLE =
  'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

@Component({
  selector: 'app-auth-modal',
  imports: [LoginViewComponent, RegisterViewComponent, ForgotViewComponent, ResetViewComponent],
  encapsulation: ViewEncapsulation.None,
  templateUrl: './auth-modal.component.html',
  styleUrl: './auth-modal.component.scss',
  host: { '(document:keydown)': 'onKeydown($event)' },
})
export class AuthModalComponent {
  protected readonly modal = inject(AuthModalService);
  private readonly dialog = viewChild<ElementRef<HTMLElement>>('dialog');
  private opener: HTMLElement | null = null;
  private wasOpen = false;

  constructor() {
    effect(() => {
      const open = this.modal.isOpen();
      this.modal.view();
      const dialog = this.dialog();

      document.body.style.overflow = open ? 'hidden' : '';
      if (open && !this.wasOpen) this.opener = document.activeElement as HTMLElement | null;
      if (!open && this.wasOpen) {
        this.opener?.focus?.();
        this.opener = null;
      }
      this.wasOpen = open;

      if (open && dialog) setTimeout(() => this.focusFirst(dialog.nativeElement));
    });
  }

  protected onBackdropMouseDown(event: MouseEvent): void {
    if (event.target === event.currentTarget) this.modal.close();
  }

  onKeydown(event: KeyboardEvent): void {
    if (!this.modal.isOpen()) return;
    if (event.key === 'Escape') {
      this.modal.close();
      return;
    }
    if (event.key !== 'Tab') return;

    const root = this.dialog()?.nativeElement;
    if (!root) return;
    const items = this.focusables(root);
    if (items.length === 0) return;
    const first = items[0];
    const last = items[items.length - 1];
    const active = document.activeElement;
    if (event.shiftKey && (active === first || !root.contains(active))) {
      last.focus();
      event.preventDefault();
    } else if (!event.shiftKey && (active === last || !root.contains(active))) {
      first.focus();
      event.preventDefault();
    }
  }

  private focusFirst(root: HTMLElement): void {
    const target = root.querySelector<HTMLElement>('input:not([disabled]):not([type="checkbox"])');
    (target ?? root).focus();
  }

  private focusables(root: HTMLElement): HTMLElement[] {
    return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((el) => el.offsetParent !== null);
  }
}

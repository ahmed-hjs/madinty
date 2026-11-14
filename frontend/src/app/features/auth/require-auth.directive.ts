import { Directive, ElementRef, OnDestroy, OnInit, inject, input } from '@angular/core';
import { AuthService } from '../../core/services/auth.service';
import { AuthModalService } from './auth-modal.service';

@Directive({ selector: '[appRequireAuth]' })
export class RequireAuthDirective implements OnInit, OnDestroy {
  readonly reason = input('', { alias: 'appRequireAuth' });

  private readonly element = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private readonly auth = inject(AuthService);
  private readonly modal = inject(AuthModalService);

  private readonly onClick = (event: Event): void => {
    if (this.auth.isAuthenticated()) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    this.modal.open('login', {
      reason: this.reason() || undefined,
      onSuccess: () => this.element.click(),
    });
  };

  ngOnInit(): void {
    this.element.addEventListener('click', this.onClick, true);
  }

  ngOnDestroy(): void {
    this.element.removeEventListener('click', this.onClick, true);
  }
}

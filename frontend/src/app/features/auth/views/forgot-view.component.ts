import { HttpErrorResponse } from '@angular/common/http';
import { Component, DestroyRef, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { AuthService } from '../../../core/services/auth.service';
import { networkOrServerMessage } from '../../../core/utils/errors';
import { emailValidator } from '../../../core/utils/validators';
import { AuthModalService } from '../auth-modal.service';

const COOLDOWN_SECONDS = 30;

function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  return `${local.charAt(0)}•••@${domain}`;
}

@Component({
  selector: 'app-forgot-view',
  imports: [ReactiveFormsModule],
  templateUrl: './forgot-view.component.html',
})
export class ForgotViewComponent {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly auth = inject(AuthService);
  protected readonly modal = inject(AuthModalService);
  private timer: ReturnType<typeof setInterval> | undefined;

  protected readonly form = this.fb.group({
    email: ['', [Validators.required, emailValidator]],
  });
  protected readonly loading = signal(false);
  protected readonly submitted = signal(false);
  protected readonly sent = signal(false);
  protected readonly masked = signal('');
  protected readonly cooldown = signal(0);
  protected readonly error = signal<string | null>(null);

  constructor() {
    inject(DestroyRef).onDestroy(() => clearInterval(this.timer));
  }

  protected showError(): boolean {
    const control = this.form.controls.email;
    return control.invalid && (control.touched || this.submitted());
  }

  protected emailMessage(): string {
    return this.form.controls.email.hasError('required')
      ? 'Saisissez votre adresse e-mail.'
      : 'Adresse e-mail invalide.';
  }

  protected submit(): void {
    this.submitted.set(true);
    this.error.set(null);
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    if (this.loading() || this.cooldown() > 0) return;

    const email = this.form.controls.email.value.trim();
    this.loading.set(true);
    this.auth.forgotPassword(email).subscribe({
      next: () => this.onSent(email),
      error: (err: HttpErrorResponse) => {
        const technical = networkOrServerMessage(err);
        if (technical) {
          this.loading.set(false);
          this.error.set(technical);
        } else {
          this.onSent(email);
        }
      },
    });
  }

  private onSent(email: string): void {
    this.loading.set(false);
    this.masked.set(maskEmail(email));
    this.sent.set(true);
    clearInterval(this.timer);
    this.cooldown.set(COOLDOWN_SECONDS);
    this.timer = setInterval(() => {
      this.cooldown.update((value) => value - 1);
      if (this.cooldown() <= 0) clearInterval(this.timer);
    }, 1000);
  }
}

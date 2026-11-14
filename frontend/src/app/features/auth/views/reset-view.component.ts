import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { AuthService } from '../../../core/services/auth.service';
import { networkOrServerMessage } from '../../../core/utils/errors';
import { passwordChecks } from '../../../core/utils/password';
import { passwordsMatch, strongPassword } from '../../../core/utils/validators';
import { PasswordFieldComponent } from '../../../shared/password-field/password-field.component';
import { PasswordStrengthComponent } from '../../../shared/password-strength/password-strength.component';
import { AuthModalService } from '../auth-modal.service';

@Component({
  selector: 'app-reset-view',
  imports: [ReactiveFormsModule, PasswordFieldComponent, PasswordStrengthComponent],
  templateUrl: './reset-view.component.html',
})
export class ResetViewComponent {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly auth = inject(AuthService);
  protected readonly modal = inject(AuthModalService);
  private readonly token = this.modal.resetToken();

  protected readonly form = this.fb.group(
    {
      password: ['', [Validators.required, strongPassword]],
      confirm: ['', [Validators.required]],
    },
    { validators: passwordsMatch('password', 'confirm') },
  );
  protected readonly password = toSignal(this.form.controls.password.valueChanges, { initialValue: '' });
  protected readonly checks = computed(() => passwordChecks(this.password()));

  protected readonly linkInvalid = signal(this.token === '');
  protected readonly sameAsOld = signal(false);
  protected readonly loading = signal(false);
  protected readonly submitted = signal(false);
  protected readonly error = signal<string | null>(null);

  protected fieldError(name: 'password' | 'confirm'): string | null {
    const control = this.form.controls[name];
    if (!(control.touched || this.submitted())) return null;
    if (name === 'password') {
      if (control.hasError('required')) return 'Choisissez un nouveau mot de passe.';
      return control.hasError('weak') ? '8 caractères minimum, avec une majuscule et un chiffre.' : null;
    }
    if (control.hasError('required')) return 'Confirmez votre mot de passe.';
    return this.form.hasError('mismatch') ? 'Les mots de passe ne correspondent pas.' : null;
  }

  protected submit(): void {
    this.submitted.set(true);
    this.error.set(null);
    this.sameAsOld.set(false);
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.loading.set(true);
    this.auth.resetPassword(this.token, this.form.controls.password.value).subscribe({
      next: (user) => {
        this.loading.set(false);
        this.modal.completeLogin(user);
      },
      error: (err: HttpErrorResponse) => {
        this.loading.set(false);
        const technical = networkOrServerMessage(err);
        if (technical) {
          this.error.set(technical);
          return;
        }
        const code = (err.error as { code?: string } | null)?.code;
        if (code === 'SAME_AS_OLD') {
          this.sameAsOld.set(true);
          this.error.set('Votre nouveau mot de passe doit être différent de l’ancien.');
        } else if (code === 'INVALID_TOKEN' || err.status === 400 || err.status === 404 || err.status === 410) {
          this.linkInvalid.set(true);
        } else {
          this.error.set('Impossible d’enregistrer le mot de passe pour le moment. Réessayez.');
        }
      },
    });
  }
}

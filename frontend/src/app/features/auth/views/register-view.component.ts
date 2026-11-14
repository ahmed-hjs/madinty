import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { AuthService } from '../../../core/services/auth.service';
import { networkOrServerMessage } from '../../../core/utils/errors';
import { emailValidator, passwordsMatch, strongPassword } from '../../../core/utils/validators';
import { PasswordFieldComponent } from '../../../shared/password-field/password-field.component';
import { PasswordStrengthComponent } from '../../../shared/password-strength/password-strength.component';
import { AuthModalService } from '../auth-modal.service';

type FieldName = 'fullName' | 'email' | 'password' | 'confirm' | 'consent';

@Component({
  selector: 'app-register-view',
  imports: [ReactiveFormsModule, PasswordFieldComponent, PasswordStrengthComponent],
  templateUrl: './register-view.component.html',
})
export class RegisterViewComponent {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly auth = inject(AuthService);
  protected readonly modal = inject(AuthModalService);

  protected readonly form = this.fb.group(
    {
      fullName: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(100)]],
      email: ['', [Validators.required, emailValidator]],
      password: ['', [Validators.required, strongPassword]],
      confirm: ['', [Validators.required]],
      consent: [false, [Validators.requiredTrue]],
    },
    { validators: passwordsMatch('password', 'confirm') },
  );
  protected readonly password = toSignal(this.form.controls.password.valueChanges, { initialValue: '' });
  protected readonly loading = signal(false);
  protected readonly submitted = signal(false);
  protected readonly error = signal<string | null>(null);

  protected fieldError(name: FieldName): string | null {
    const control = this.form.controls[name];
    if (!(control.touched || this.submitted())) return null;
    switch (name) {
      case 'fullName':
        if (control.hasError('required')) return 'Saisissez votre nom complet.';
        if (control.hasError('minlength')) return 'Votre nom doit contenir au moins 2 caractères.';
        return null;
      case 'email':
        if (control.hasError('required')) return 'Saisissez votre adresse e-mail.';
        return control.hasError('email') ? 'Adresse e-mail invalide.' : null;
      case 'password':
        if (control.hasError('required')) return 'Choisissez un mot de passe.';
        return control.hasError('weak') ? '8 caractères minimum, avec une majuscule et un chiffre.' : null;
      case 'confirm':
        if (control.hasError('required')) return 'Confirmez votre mot de passe.';
        return this.form.hasError('mismatch') ? 'Les mots de passe ne correspondent pas.' : null;
      case 'consent':
        return control.hasError('required')
          ? 'Vous devez accepter la politique de confidentialité pour créer un compte.'
          : null;
      default:
        return null;
    }
  }

  protected submit(): void {
    this.submitted.set(true);
    this.error.set(null);
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const { fullName, email, password } = this.form.getRawValue();
    this.loading.set(true);
    this.auth
      .register({ fullName: fullName.trim(), email: email.trim(), password, privacyAccepted: true })
      .subscribe({
        next: (user) => {
          this.loading.set(false);
          this.modal.completeLogin(user);
        },
        error: (err: HttpErrorResponse) => {
          this.loading.set(false);
          this.error.set(networkOrServerMessage(err) ?? this.registerMessage(err));
        },
      });
  }

  private registerMessage(err: HttpErrorResponse): string {
    if (err.status === 409) return 'Cette adresse e-mail est déjà utilisée. Connectez-vous ou réinitialisez votre mot de passe.';
    if (err.status === 400 || err.status === 422) return 'Certaines informations sont invalides. Vérifiez le formulaire.';
    return 'Inscription impossible pour le moment. Réessayez.';
  }
}

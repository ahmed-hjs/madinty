import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';
import { passwordChecks } from './password';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function emailValidator(control: AbstractControl): ValidationErrors | null {
  const value = String(control.value ?? '').trim();
  return !value || EMAIL_PATTERN.test(value) ? null : { email: true };
}

export function strongPassword(control: AbstractControl): ValidationErrors | null {
  const value = String(control.value ?? '');
  if (!value) return null;
  const checks = passwordChecks(value);
  return checks.length && checks.upperDigit ? null : { weak: true };
}

export function passwordsMatch(passwordKey: string, confirmKey: string): ValidatorFn {
  return (group: AbstractControl): ValidationErrors | null => {
    const a = group.get(passwordKey)?.value as string | undefined;
    const b = group.get(confirmKey)?.value as string | undefined;
    return a && b && a !== b ? { mismatch: true } : null;
  };
}

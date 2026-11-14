import { HttpErrorResponse } from '@angular/common/http';

export function networkOrServerMessage(err: HttpErrorResponse): string | null {
  if (err.status === 0) return 'Impossible de joindre le serveur. Vérifiez votre connexion et réessayez.';
  if (err.status === 429) return 'Trop de tentatives. Patientez quelques minutes avant de réessayer.';
  if (err.status >= 500) return 'Une erreur est survenue de notre côté. Réessayez dans un instant.';
  return null;
}

export function apiErrorMessage(err: HttpErrorResponse, fallback = 'Une erreur est survenue. Réessayez.'): string {
  const generic = networkOrServerMessage(err);
  if (generic) return generic;
  const body = err.error as { error?: string; details?: { message: string }[] } | null;
  if (body?.details?.length) return body.details.map((d) => d.message).join(' ');
  return body?.error ?? fallback;
}

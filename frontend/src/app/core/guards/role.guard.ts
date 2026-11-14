import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthModalService } from '../../features/auth/auth-modal.service';
import { AuthService } from '../services/auth.service';
import { Role, homeRouteFor } from '../models/auth.model';

export const roleGuard =
  (role: Role): CanActivateFn =>
  (_route, state) => {
    const router = inject(Router);
    const modal = inject(AuthModalService);
    const user = inject(AuthService).user();
    if (!user) {
      modal.open('login', {
        reason: 'Connectez-vous pour accéder à cet espace.',
        onSuccess: () => void router.navigateByUrl(state.url),
      });
      return router.createUrlTree(['/']);
    }
    return user.role === role ? true : router.createUrlTree([homeRouteFor(user.role)]);
  };

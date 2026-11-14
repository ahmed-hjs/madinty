import { Routes } from '@angular/router';
import { HomeComponent } from './features/home/home.component';
import { roleGuard } from './core/guards/role.guard';

export const routes: Routes = [
  { path: '', component: HomeComponent, title: 'MADINTY — Signalez. Suivez. Améliorez votre ville.' },
  {
    path: 'organismes',
    title: 'Organismes partenaires — MADINTY',
    loadComponent: () => import('./features/organismes/organismes.component').then((m) => m.OrganismesComponent),
  },
  {
    path: 'organismes/:slug',
    title: 'Organisme partenaire — MADINTY',
    loadComponent: () =>
      import('./features/organismes/organisme-detail.component').then((m) => m.OrganismeDetailComponent),
  },
  {
    path: 'comment-ca-marche',
    title: 'Comment ça marche — MADINTY',
    loadComponent: () => import('./features/info/how-it-works.component').then((m) => m.HowItWorksComponent),
  },
  {
    path: 'contact',
    title: 'Contact — MADINTY',
    loadComponent: () => import('./features/info/contact.component').then((m) => m.ContactComponent),
  },
  {
    path: 'signalements/:ref',
    title: 'Signalement — MADINTY',
    loadComponent: () =>
      import('./features/signalement/signalement-detail.component').then((m) => m.SignalementDetailComponent),
  },
  { path: 'citoyen', pathMatch: 'full', redirectTo: 'citoyen/mes-signalements' },
  {
    path: 'citoyen/nouveau',
    title: 'Nouveau signalement — MADINTY',
    canActivate: [roleGuard('citizen')],
    loadComponent: () =>
      import('./features/citoyen/nouveau-signalement.component').then((m) => m.NouveauSignalementComponent),
  },
  {
    path: 'citoyen/mes-signalements',
    title: 'Mes signalements — MADINTY',
    canActivate: [roleGuard('citizen')],
    loadComponent: () =>
      import('./features/citoyen/mes-signalements.component').then((m) => m.MesSignalementsComponent),
  },
  { path: '**', redirectTo: '' },
];

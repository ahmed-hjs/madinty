import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { AuthModalService } from '../auth/auth-modal.service';
import { SiteFooterComponent } from '../../shared/site-footer/site-footer.component';
import { SiteHeaderComponent } from '../../shared/site-header/site-header.component';

interface Step {
  title: string;
  text: string;
  who: 'Citoyen' | 'Système' | 'Organisme' | 'Responsable d’équipe';
}

@Component({
  selector: 'app-how-it-works',
  standalone: true,
  imports: [RouterLink, SiteHeaderComponent, SiteFooterComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './how-it-works.component.html',
  styleUrl: './how-it-works.component.scss',
})
export class HowItWorksComponent {
  private readonly modal = inject(AuthModalService);
  private readonly router = inject(Router);

  protected readonly steps: Step[] = [
    {
      who: 'Citoyen',
      title: 'Je signale',
      text: 'Je décris le problème (un lampadaire éteint, un nid-de-poule…), je choisis la catégorie, j’ajoute une photo et je place le repère sur la carte.',
    },
    {
      who: 'Système',
      title: 'On vérifie les doublons',
      text: 'MADINTY cherche les signalements proches et similaires, encore ouverts. Je peux en soutenir un existant au lieu d’en créer un nouveau.',
    },
    {
      who: 'Citoyen',
      title: 'Je confirme l’envoi',
      text: 'C’est moi qui décide s’il s’agit d’un nouveau problème. Un identifiant est attribué et le dossier part vers l’organisme responsable de la catégorie.',
    },
    {
      who: 'Citoyen',
      title: 'Les voisins soutiennent',
      text: 'D’autres habitants confirment qu’ils constatent le même problème. Un compte ne peut soutenir un signalement qu’une seule fois.',
    },
    {
      who: 'Organisme',
      title: 'L’organisme vérifie',
      text: 'Il accepte le signalement, ou le rejette avec un motif que je peux consulter. Il confirme ou ajuste la priorité en la justifiant.',
    },
    {
      who: 'Organisme',
      title: 'Une intervention est affectée',
      text: 'L’organisme crée une intervention et la confie à une équipe et à son responsable.',
    },
    {
      who: 'Responsable d’équipe',
      title: 'L’équipe intervient',
      text: 'Le responsable d’équipe se rend sur place, met à jour l’avancement et rédige un compte rendu avec des photos avant / après.',
    },
    {
      who: 'Organisme',
      title: 'Le dossier passe en « Résolu »',
      text: 'L’organisme contrôle le compte rendu puis passe le signalement à « Résolu ». Je suis notifié.',
    },
    {
      who: 'Citoyen',
      title: 'Je confirme ou je conteste',
      text: 'Je réponds « C’est réglé » ou « Ce n’est pas réglé » avec un court message. Sans réponse sous 7 jours, la résolution est confirmée et le dossier clos.',
    },
  ];

  protected readonly statuses = ['Soumis', 'En vérification', 'Accepté', 'Affecté', 'En cours', 'Résolu', 'Clos'];

  protected readonly roles = [
    {
      name: 'Citoyen',
      color: '#1A73E8',
      text: 'Signale, soutient, suit son dossier et confirme ou conteste la résolution.',
    },
    {
      name: 'Organisme',
      color: '#188038',
      text: 'Traite les signalements de ses catégories : vérifie, priorise, crée les interventions et valide les comptes rendus.',
    },
    {
      name: 'Responsable d’équipe',
      color: '#A142F4',
      text: 'Prend en charge les interventions de son équipe et documente le travail réalisé sur le terrain.',
    },
    {
      name: 'Administrateur',
      color: '#E37400',
      text: 'Gère les comptes, les catégories et les paramètres. Tranche en cas de désaccord sur une contestation.',
    },
  ];

  protected readonly faq = [
    {
      q: 'Dois-je créer un compte pour consulter la carte ?',
      a: 'Non. La carte, les fiches de signalements et les pages des organismes sont publiques. Le compte est demandé uniquement pour signaler un problème ou en soutenir un.',
    },
    {
      q: 'Mes informations personnelles sont-elles visibles ?',
      a: 'Non. Ni votre identité ni vos coordonnées ne sont jamais affichées publiquement. Les statistiques sont agrégées.',
    },
    {
      q: 'MADINTY garantit-il que mon problème sera traité ?',
      a: 'Non. La prise en charge dépend du partenariat, des compétences de l’organisme et des moyens disponibles. MADINTY rend le processus visible, traçable et mesurable.',
    },
    {
      q: 'Le problème réapparaît après la clôture, que faire ?',
      a: 'Créez un nouveau signalement : la recherche de doublons ignore les dossiers clos.',
    },
  ];

  protected report(): void {
    this.modal.requireLogin(() => {
      void this.router.navigateByUrl('/citoyen/nouveau');
    }, 'Connectez-vous pour signaler un problème.');
  }
}

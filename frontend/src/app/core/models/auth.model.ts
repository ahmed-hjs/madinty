export type Role = 'citizen' | 'organization' | 'team_lead' | 'admin';

export interface User {
  id: number | string;
  fullName: string;
  email: string;
  role: Role;
}

export interface Session {
  token: string;
  user: User;
}

export const ROLE_LABEL: Record<Role, string> = {
  citizen: 'Citoyen',
  organization: 'Organisme partenaire',
  team_lead: "Responsable d'équipe",
  admin: 'Administrateur',
};

const HOME: Record<Role, string> = {
  citizen: '/citoyen',
  organization: '/organisme',
  team_lead: '/terrain',
  admin: '/admin',
};

export function homeRouteFor(role?: Role | null): string {
  return role ? HOME[role] : '/';
}

export function normalizeRole(raw: unknown): Role {
  const r = String(raw ?? '')
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_');
  if (r.startsWith('admin')) return 'admin';
  if (r.startsWith('team') || r.includes('equipe') || r.includes('responsable') || r.includes('field')) {
    return 'team_lead';
  }
  if (r.startsWith('org')) return 'organization';
  return 'citizen';
}

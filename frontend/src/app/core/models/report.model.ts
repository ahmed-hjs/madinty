export type CategoryId = 'eclairage' | 'voirie' | 'proprete' | 'eau' | 'mobilier' | 'autre';
export type StatusId = 'recu' | 'en_cours' | 'resolu' | 'urgent';
export type Priority = 'haute' | 'moyenne' | 'basse';

export interface Report {
  dbId: number;
  id: string;
  title: string;
  address: string;
  category: CategoryId;
  status: StatusId;
  priority: Priority;
  supports: number;
  createdAt: string;
  lat: number;
  lng: number;
  supportedByMe: boolean;
  isMine: boolean;
}

export interface CategoryMeta {
  id: CategoryId;
  label: string;
  color: string;
  icon: string;
}

export interface StatusMeta {
  id: StatusId;
  label: string;
}

export const CATEGORY_LIST: CategoryMeta[] = [
  { id: 'eclairage', label: 'Éclairage', color: '#F59E0B', icon: 'eclairage' },
  { id: 'voirie', label: 'Voirie', color: '#6366F1', icon: 'voirie' },
  { id: 'proprete', label: 'Propreté', color: '#14B8A6', icon: 'proprete' },
  { id: 'eau', label: 'Eau', color: '#0EA5E9', icon: 'eau' },
  { id: 'mobilier', label: 'Mobilier', color: '#A855F7', icon: 'mobilier' },
  { id: 'autre', label: 'Autres', color: '#5F6368', icon: 'autre' },
];

export const CATEGORIES: Record<CategoryId, CategoryMeta> = Object.fromEntries(
  CATEGORY_LIST.map((c) => [c.id, c]),
) as Record<CategoryId, CategoryMeta>;

export const STATUS_LIST: StatusMeta[] = [
  { id: 'recu', label: 'Reçu' },
  { id: 'en_cours', label: 'En cours' },
  { id: 'resolu', label: 'Résolu' },
  { id: 'urgent', label: 'Urgent' },
];

export const STATUSES: Record<StatusId, StatusMeta> = Object.fromEntries(
  STATUS_LIST.map((s) => [s.id, s]),
) as Record<StatusId, StatusMeta>;

export const STATUS_COLOR: Record<StatusId, string> = {
  recu: '#FBBC04',
  en_cours: '#1A73E8',
  resolu: '#34A853',
  urgent: '#EA4335',
};

export const ICONS: Record<string, string> = {
  eclairage:
    '<path d="M9 18h6"/><path d="M10 21h4"/><path d="M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3z"/>',
  voirie: '<path d="M8 3 5 21"/><path d="m16 3 3 18"/><path d="M12 5v3M12 11v3M12 17v3"/>',
  proprete:
    '<path d="M4 7h16"/><path d="M9 7V4h6v3"/><path d="m6 7 1 13h10l1-13"/><path d="M10 11v6M14 11v6"/>',
  eau: '<path d="M12 3s6 6.2 6 10.5A6 6 0 0 1 6 13.5C6 9.2 12 3 12 3z"/>',
  mobilier: '<path d="M5 10V7h14v3"/><path d="M4 10h16v4H4z"/><path d="M6 14v5M18 14v5"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  minus: '<path d="M5 12h14"/>',
  heart: '<path d="M12 20s-7-4.6-7-10a4 4 0 0 1 7-2.5A4 4 0 0 1 19 10c0 5.4-7 10-7 10z"/>',
  chevron: '<path d="m6 9 6 6 6-6"/>',
  autre: '<circle cx="6" cy="12" r="1.2"/><circle cx="12" cy="12" r="1.2"/><circle cx="18" cy="12" r="1.2"/>',
  check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
  camera: '<path d="M4 8h3l1.5-2h7L17 8h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>',
  locate: '<circle cx="12" cy="12" r="3.5"/><path d="M12 3v3M12 18v3M3 12h3M18 12h3"/>',
  close: '<path d="M6 6l12 12M18 6 6 18"/>',
};

export const STATUS_SYMBOL: Record<StatusId, string> = {
  recu: '<circle cx="6" cy="6" r="2.8" fill="#fff"/>',
  en_cours: '<path d="M4.2 2.6v6.8L9.6 6z" fill="#fff"/>',
  resolu:
    '<path d="M2.6 6.2 5 8.6l4.6-5" stroke="#fff" stroke-width="1.8" fill="none" stroke-linecap="round" stroke-linejoin="round"/>',
  urgent:
    '<path d="M6 2.2v4.3" stroke="#fff" stroke-width="1.9" stroke-linecap="round"/><circle cx="6" cy="9" r="1.1" fill="#fff"/>',
};

export function timeAgo(iso: string): string {
  const h = Math.floor((Date.now() - new Date(iso).getTime()) / 36e5);
  if (h < 1) return "à l'instant";
  if (h < 24) return `il y a ${h} h`;
  if (h < 48) return 'hier';
  return `il y a ${Math.floor(h / 24)} j`;
}

export function toStatusId(status: string, priority?: string | null): StatusId {
  if (['Résolu', 'Clos'].includes(status)) return 'resolu';
  if (priority === 'Critique') return 'urgent';
  if (['Affecté', 'En cours'].includes(status)) return 'en_cours';
  return 'recu';
}

export function toPriority(priority?: string | null): Priority {
  if (priority === 'Haute' || priority === 'Critique') return 'haute';
  if (priority === 'Basse') return 'basse';
  return 'moyenne';
}

export function toCategoryId(iconKey?: string | null): CategoryId {
  return (iconKey && iconKey in CATEGORIES ? iconKey : 'autre') as CategoryId;
}

export interface ApiReport {
  id: number;
  reference: string;
  title: string;
  address: string | null;
  latitude: string | number;
  longitude: string | number;
  status: string;
  priority: string | null;
  created_at: string;
  category_id: number;
  category_label: string;
  icon_key: string;
  supports_count: number;
  is_mine: boolean;
  supported_by_me: boolean;
}

export function toReport(a: ApiReport): Report {
  return {
    dbId: a.id,
    id: a.reference,
    title: a.title,
    address: a.address ?? '',
    category: toCategoryId(a.icon_key),
    status: toStatusId(a.status, a.priority),
    priority: toPriority(a.priority),
    supports: a.supports_count,
    createdAt: a.created_at,
    lat: Number(a.latitude),
    lng: Number(a.longitude),
    supportedByMe: a.supported_by_me,
    isMine: a.is_mine,
  };
}

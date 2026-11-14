import * as L from 'leaflet';
import {
  CATEGORIES,
  ICONS,
  Report,
  STATUS_COLOR,
  STATUS_SYMBOL,
} from '../../core/models/report.model';

export function pinSvg(report: Report): string {
  const cat = CATEGORIES[report.category];
  const statusColor = STATUS_COLOR[report.status];

  const urgentRing =
    report.status === 'urgent'
      ? `<circle cx="20" cy="20" r="19.6" fill="none" stroke="#EA4335" stroke-width="1.8" opacity=".55"/>`
      : '';

  return `<svg width="44" height="56" viewBox="0 0 44 56" aria-hidden="true" focusable="false">
    <ellipse cx="20" cy="47.5" rx="9" ry="3" fill="#000" opacity=".16"/>
    <line x1="20" y1="34" x2="20" y2="46" stroke="${cat.color}" stroke-width="3.2" stroke-linecap="round"/>
    <circle cx="20" cy="47" r="3.4" fill="${cat.color}" stroke="#fff" stroke-width="1.8"/>
    ${urgentRing}
    <circle cx="20" cy="20" r="16" fill="${cat.color}" stroke="#fff" stroke-width="2.4"/>
    <g transform="translate(11 11) scale(.75)" fill="none" stroke="#fff" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round">${ICONS[cat.icon]}</g>
    <circle cx="33.5" cy="7.5" r="7.2" fill="${statusColor}" stroke="#fff" stroke-width="2"/>
    <g transform="translate(27.5 1.5)">${STATUS_SYMBOL[report.status]}</g>
  </svg>`;
}

export function buildPinIcon(report: Report, selected = false): L.DivIcon {
  return L.divIcon({
    className: `madinty-pin${selected ? ' is-selected' : ''}`,
    html: `<div class="pin">${pinSvg(report)}</div>`,
    iconSize: [44, 56],
    iconAnchor: [20, 47],
    popupAnchor: [0, -50],
  });
}

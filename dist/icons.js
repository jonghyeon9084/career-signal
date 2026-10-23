const paths={
  grid:'<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
  bookmark:'<path d="M6 4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v17l-6-4-6 4z"/>',
  'check-circle':'<circle cx="12" cy="12" r="9"/><path d="m8 12 3 3 5-6"/>',
  sheet:'<path d="M14 3H5v18h14V8zM14 3v5h5M8 12h8M8 16h8M12 12v7"/>',
  'arrow-up-right':'<path d="M6 18 18 6M6 6h12v12"/>',
  refresh:'<path d="M20 7v5h-5M4 17v-5h5M6.2 6a8 8 0 0 1 13.3 3M4.5 15a8 8 0 0 0 13.3 3"/>',
  calendar:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 11h18M8 15h2M14 15h2"/>',
  briefcase:'<rect x="3" y="7" width="18" height="14" rx="2"/><path d="M8 7V3h8v4M3 12a20 20 0 0 0 18 0M12 11v4"/>',
  clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  sparkles:'<path d="m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5zM20 2v4M18 4h4"/>',
  'arrow-right':'<path d="M4 12h16m-6-6 6 6-6 6"/>',
  search:'<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/>',
  'chevron-down':'<path d="m6 9 6 6 6-6"/>',
  x:'<path d="m6 6 12 12M6 18 18 6"/>',
  wallet:'<rect x="3" y="5" width="18" height="15" rx="2"/><path d="M3 8h18M17 12h4v5h-4a2.5 2.5 0 0 1 0-5Z"/>',
};
export const icon=name=>`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name]||paths.grid}</svg>`;
export function hydrateIcons(root=document){root.querySelectorAll('[data-icon]').forEach(el=>el.innerHTML=icon(el.dataset.icon));}

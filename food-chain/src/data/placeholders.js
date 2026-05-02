const KIND_GLYPH = {
  plant: `<g stroke="#2a2520" stroke-width="2" fill="none" stroke-linecap="round">
    <path d="M100 170 L100 100"/>
    <path d="M100 130 Q70 110 60 80 Q90 90 100 120"/>
    <path d="M100 130 Q130 110 140 80 Q110 90 100 120"/>
    <path d="M100 100 Q80 80 75 55 Q100 70 100 90"/>
    <path d="M100 100 Q120 80 125 55 Q100 70 100 90"/>
  </g>`,
  invertebrate: `<g stroke="#2a2520" stroke-width="2" fill="none" stroke-linecap="round">
    <ellipse cx="100" cy="110" rx="32" ry="20"/>
    <circle cx="130" cy="105" r="10"/>
    <path d="M138 100 L150 88 M138 105 L155 105 M138 110 L150 122"/>
    <path d="M75 100 L60 88 M75 110 L60 122 M85 95 L80 78 M115 95 L120 78"/>
  </g>`,
  fish: `<g stroke="#2a2520" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
    <path d="M55 110 Q90 80 130 110 Q90 140 55 110 Z"/>
    <path d="M130 110 L155 90 L150 110 L155 130 Z"/>
    <circle cx="75" cy="105" r="2.5" fill="#2a2520"/>
    <path d="M105 95 Q115 110 105 125"/>
  </g>`,
  amphibian: `<g stroke="#2a2520" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
    <path d="M60 130 Q70 90 100 88 Q130 90 140 130 Q120 145 100 142 Q80 145 60 130 Z"/>
    <circle cx="82" cy="100" r="6"/><circle cx="118" cy="100" r="6"/>
    <circle cx="82" cy="100" r="2" fill="#2a2520"/><circle cx="118" cy="100" r="2" fill="#2a2520"/>
    <path d="M55 135 Q45 145 50 158 M145 135 Q155 145 150 158"/>
  </g>`,
  reptile: `<g stroke="#2a2520" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
    <path d="M50 115 Q70 100 100 105 Q135 105 155 115 Q160 130 145 135 L60 135 Q45 130 50 115 Z"/>
    <path d="M155 115 Q170 110 175 95 Q170 90 165 100"/>
    <circle cx="158" cy="118" r="2" fill="#2a2520"/>
    <path d="M70 135 L65 150 M90 135 L88 152 M115 135 L117 152 M138 135 L143 150"/>
  </g>`,
  bird: `<g stroke="#2a2520" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
    <ellipse cx="105" cy="115" rx="35" ry="22"/>
    <circle cx="75" cy="95" r="14"/>
    <path d="M62 92 L48 88 L60 96"/>
    <circle cx="73" cy="93" r="2" fill="#2a2520"/>
    <path d="M115 100 Q135 85 145 95 Q130 105 120 105"/>
    <path d="M95 137 L92 155 M115 137 L118 155"/>
  </g>`,
  mammal: `<g stroke="#2a2520" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
    <ellipse cx="105" cy="115" rx="38" ry="22"/>
    <circle cx="68" cy="100" r="16"/>
    <path d="M58 88 L55 75 L66 85 M78 88 L80 75 L72 85"/>
    <circle cx="65" cy="100" r="2" fill="#2a2520"/>
    <path d="M82 110 L86 112"/>
    <path d="M85 137 L82 158 M105 137 L103 158 M125 137 L128 158 M140 130 Q150 125 148 115"/>
  </g>`,
};

const TROPHIC_TINT = {
  producer: '#c8d4b0',
  primary: '#e0c890',
  secondary: '#d4a888',
  tertiary: '#b8a890',
  decomposer: '#c4b89a',
};

export function makePlaceholder(species, idx) {
  const tint = TROPHIC_TINT[species.trophic] || '#d4c4a0';
  const glyph = KIND_GLYPH[species.kind] || KIND_GLYPH.invertebrate;
  const num = String(idx + 1).padStart(3, '0');
  const monogram = species.name.split(' ').map(w => w[0]).join('').slice(0, 3).toUpperCase();
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="200" height="200">
    <defs><filter id="grain"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="${idx}"/><feColorMatrix values="0 0 0 0 0.16 0 0 0 0 0.14 0 0 0 0 0.12 0 0 0 0.1 0"/></filter></defs>
    <rect width="200" height="200" fill="${tint}"/>
    <rect width="200" height="200" filter="url(#grain)" opacity="0.6"/>
    <rect x="6" y="6" width="188" height="188" fill="none" stroke="#2a2520" stroke-width="0.5" opacity="0.3"/>
    ${glyph}
    <text x="14" y="22" font-family="ui-monospace,monospace" font-size="9" fill="#2a2520" opacity="0.6" letter-spacing="1">№ ${num}</text>
    <text x="186" y="22" font-family="ui-monospace,monospace" font-size="9" fill="#2a2520" opacity="0.6" letter-spacing="1" text-anchor="end">${monogram}</text>
    <text x="100" y="180" font-family="Georgia,serif" font-style="italic" font-size="11" fill="#2a2520" opacity="0.7" text-anchor="middle">${species.latin.length > 26 ? species.latin.slice(0, 24) + '…' : species.latin}</text>
  </svg>`;
  return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
}

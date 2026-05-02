import { useState } from 'react';

export default function SpeciesPhoto({ species, className, style }) {
  const [src, setSrc] = useState(species.img);
  return (
    <div className={className} style={style}>
      <img
        src={src}
        alt={species.name}
        draggable="false"
        onError={() => { if (src !== species.fallback) setSrc(species.fallback); }}
        style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
      />
    </div>
  );
}

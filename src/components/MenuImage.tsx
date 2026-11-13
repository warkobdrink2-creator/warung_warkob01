import React, { useState } from 'react';
import { Utensils } from 'lucide-react';
import { resolveMenuImage } from '../lib/menuImages';

interface MenuImageProps {
  src?: string;
  alt: string;
  className?: string;
}

export const MenuImage: React.FC<MenuImageProps> = ({ src, alt, className = 'w-full h-full object-cover' }) => {
  const [failed, setFailed] = useState(false);
  const resolved = resolveMenuImage(src);

  if (!resolved || failed) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-slate-100 to-slate-200 text-slate-400 p-3 text-center">
        <Utensils className="w-6 h-6 mb-1.5 text-slate-400" />
        <span className="text-[11px] font-medium text-slate-500 line-clamp-2">{alt}</span>
      </div>
    );
  }

  return (
    <img
      src={resolved}
      alt={alt}
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className={className}
      loading="lazy"
    />
  );
};

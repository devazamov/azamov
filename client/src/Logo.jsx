import React from 'react';

// AZAMOV logosi — chat pufakchasi ichida gradientli "A" harfi
export default function Logo({ size = 90 }) {
  const id = 'azlg';
  return (
    <svg width={size} height={size} viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id={`${id}-bg`} x1="0" y1="0" x2="120" y2="120" gradientUnits="userSpaceOnUse">
          <stop stopColor="#37aee2" />
          <stop offset="0.55" stopColor="#3390ec" />
          <stop offset="1" stopColor="#8774e1" />
        </linearGradient>
        <linearGradient id={`${id}-a`} x1="40" y1="34" x2="80" y2="86" gradientUnits="userSpaceOnUse">
          <stop stopColor="#ffffff" />
          <stop offset="1" stopColor="#eaf3ff" />
        </linearGradient>
        <filter id={`${id}-sh`} x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="3" stdDeviation="4" floodColor="#1c5d9c" floodOpacity="0.35" />
        </filter>
      </defs>

      {/* Chat pufakchasi shakli (dumchasi bilan) */}
      <path
        filter={`url(#${id}-sh)`}
        fill={`url(#${id}-bg)`}
        d="M60 8C30.7 8 8 28.6 8 54.5c0 14.9 7.6 28.1 19.4 36.7 0 7.1-2.4 14.6-7.2 21.1-1 1.4.1 3.3 1.8 3 13-2.3 21.6-6.9 26.3-10.1 3.8.8 7.7 1.2 11.7 1.2 29.3 0 52-20.6 52-46.9C112 28.6 89.3 8 60 8Z"
      />

      {/* "A" harfi */}
      <path
        fill={`url(#${id}-a)`}
        d="M54.6 30.5c1-2.6 2.9-4 5.4-4s4.4 1.4 5.4 4l18.3 46.8c.4 1 .6 1.9.6 2.7 0 2.7-2 4.6-4.9 4.6-2.5 0-4-1.2-4.9-3.8l-3.6-9.8H49.1l-3.6 9.8c-.9 2.6-2.4 3.8-4.8 3.8-2.9 0-5-1.9-5-4.6 0-.8.2-1.7.6-2.7L54.6 30.5Zm13 31.9L60 41.1l-7.6 21.3h15.2Z"
      />
    </svg>
  );
}

import React from 'react';

interface BrandLogoProps {
  variant?: 'header' | 'dark' | 'light';
  size?: 'sm' | 'md' | 'lg';
}

export const BrandLogo: React.FC<BrandLogoProps> = ({
  variant = 'header',
  size = 'md',
}) => {
  const iconDims =
    size === 'sm'
      ? 'w-8 h-8'
      : size === 'lg'
      ? 'w-12 h-12'
      : 'w-9 h-9 sm:w-10 sm:h-10';

  const titleClass =
    size === 'sm'
      ? 'text-base font-bold'
      : size === 'lg'
      ? 'text-xl sm:text-2xl font-bold'
      : 'text-base sm:text-lg font-bold';

  const isDarkBg = variant === 'dark';

  return (
    <div className="inline-flex items-center gap-2.5 shrink-0 select-none">
      {/* Custom SVG Digital Shield + Checkmark Emblem */}
      <svg
        viewBox="0 0 48 48"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={`${iconDims} shrink-0 drop-shadow-xs`}
        aria-hidden="true"
      >
        <defs>
          <linearGradient
            id="dsShieldGrad"
            x1="4"
            y1="4"
            x2="44"
            y2="44"
            gradientUnits="userSpaceOnUse"
          >
            <stop offset="0%" stopColor="#10B981" />
            <stop offset="55%" stopColor="#059669" />
            <stop offset="100%" stopColor="#0F172A" />
          </linearGradient>
          <linearGradient
            id="dsCheckGrad"
            x1="15"
            y1="16"
            x2="34"
            y2="32"
            gradientUnits="userSpaceOnUse"
          >
            <stop offset="0%" stopColor="#FFFFFF" />
            <stop offset="100%" stopColor="#D1FAE5" />
          </linearGradient>
        </defs>
        {/* Outer Shield */}
        <path
          d="M24 3.5L7.5 10.2V22.8C7.5 33.4 14.55 42.95 24 45.5C33.45 42.95 40.5 33.4 40.5 22.8V10.2L24 3.5Z"
          fill="url(#dsShieldGrad)"
        />
        {/* Inner Subtle Rim */}
        <path
          d="M24 6.2L10 11.9V22.7C10 31.85 15.95 40.1 24 42.45C32.05 40.1 38 31.85 38 22.7V11.9L24 6.2Z"
          stroke="rgba(255,255,255,0.28)"
          strokeWidth="1.2"
        />
        {/* Digital Node Dots */}
        <circle cx="24" cy="12.5" r="1.5" fill="#A7F3D0" />
        {/* Crisp Verification Checkmark */}
        <path
          d="M16.5 24.5L21.5 29.5L32.5 18.5"
          stroke="url(#dsCheckGrad)"
          strokeWidth="3.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>

      <div className="flex flex-col leading-none text-left">
        <span
          className={`${titleClass} tracking-tight whitespace-nowrap ${
            isDarkBg ? 'text-white' : 'text-slate-900'
          }`}
        >
          ডিজিটাল সেবা
        </span>
        <span
          className={`text-[10px] sm:text-[11px] font-semibold tracking-wider uppercase mt-0.5 whitespace-nowrap ${
            isDarkBg ? 'text-emerald-300' : 'text-emerald-700'
          }`}
        >
          Digital Sheba
        </span>
      </div>
    </div>
  );
};

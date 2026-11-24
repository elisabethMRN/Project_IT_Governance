interface SimlabLogoProps {
  variant?: 'light' | 'dark';
  compact?: boolean;
}

export function SimlabLogo({ variant = 'light', compact = false }: SimlabLogoProps) {
  const isLight = variant === 'light';

  return (
    <div className="flex items-center gap-3 shrink-0">
      <div
        className={`flex h-9 w-9 items-center justify-center rounded-lg border shrink-0 ${
          isLight
            ? 'bg-teal-500/15 border-teal-400/30 text-teal-300'
            : 'bg-[#0F2744] border-[#1E3A5F] text-teal-400'
        }`}
        aria-hidden="true"
      >
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.9"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M9 3h6" />
          <path d="M10 3v5.5L5.2 17.6A2 2 0 0 0 7 20.5h10a2 2 0 0 0 1.8-2.9L14 8.5V3" />
          <path d="M7.2 14.5h9.6" />
        </svg>
      </div>
      {!compact && (
        <span
          className={`text-lg font-bold tracking-tight whitespace-nowrap ${
            isLight ? 'text-white' : 'text-[#0F2744]'
          }`}
        >
          SIMLAB
        </span>
      )}
    </div>
  );
}

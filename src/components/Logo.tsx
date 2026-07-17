type Props = { size?: number; withWordmark?: boolean; className?: string };

export function Logo({ size = 36, withWordmark = false, className = "" }: Props) {
  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <svg
        width={size}
        height={size}
        viewBox="0 0 48 48"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-label="ShramSethu logo"
      >
        <defs>
          <linearGradient id="ss-g" x1="0" y1="0" x2="48" y2="48" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#4F46E5" />
            <stop offset="100%" stopColor="#3B82F6" />
          </linearGradient>
          <linearGradient id="ss-g2" x1="0" y1="0" x2="48" y2="48" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#3B82F6" />
            <stop offset="100%" stopColor="#14B8A6" />
          </linearGradient>
        </defs>
        <circle cx="24" cy="24" r="22" fill="url(#ss-g)" />
        <circle cx="24" cy="24" r="18" fill="#fff" />
        <path d="M8 30 Q24 12 40 30" stroke="url(#ss-g)" strokeWidth="2.5" strokeLinecap="round" fill="none" />
        <line x1="14" y1="30" x2="14" y2="34" stroke="url(#ss-g2)" strokeWidth="2" strokeLinecap="round" />
        <line x1="34" y1="30" x2="34" y2="34" stroke="url(#ss-g2)" strokeWidth="2" strokeLinecap="round" />
        <line x1="8" y1="34" x2="40" y2="34" stroke="url(#ss-g)" strokeWidth="2" strokeLinecap="round" />
        <circle cx="24" cy="20" r="3.2" fill="url(#ss-g)" />
        <path d="M18 30 C18 26 20.5 24 24 24 C27.5 24 30 26 30 30 Z" fill="url(#ss-g)" />
      </svg>
      {withWordmark && (
        <div className="leading-tight">
          <div className="text-[15px] font-bold tracking-tight text-foreground">
            Shram<span className="text-gradient">Sethu</span>
          </div>
          <div className="text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
            Gig Identity · Finance
          </div>
        </div>
      )}
    </div>
  );
}
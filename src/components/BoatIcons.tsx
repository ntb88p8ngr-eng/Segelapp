interface IconProps {
  className?: string;
}

/** Sloop mit Groß und Fock — steht für den hellen Modus. */
export function SailboatIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path
        d="M13 2.8 20.4 15H13.4a.4.4 0 0 1-.4-.4V2.8Z"
        fill="currentColor"
      />
      <path
        d="M11 6.2 5.2 15h5.4a.4.4 0 0 0 .4-.4V6.2Z"
        fill="currentColor"
        opacity="0.6"
      />
      <path
        d="M2.6 16.4h18.8l-2.5 3.9a1.4 1.4 0 0 1-1.2.7H6.3a1.4 1.4 0 0 1-1.2-.7l-2.5-3.9Z"
        fill="currentColor"
      />
    </svg>
  );
}

/** Rahsegler mit Totenkopf und Jolly Roger — steht für den dunklen Modus. */
export function PirateShipIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      {/* Mast und Wimpel */}
      <path d="M11.4 2h1.2v13.4h-1.2V2Z" fill="currentColor" />
      <path d="M12.6 2.4 16.6 3.6 12.6 4.8V2.4Z" fill="currentColor" />

      {/* Rahsegel */}
      <path
        d="M5.6 6.2h12.8v7.2c0 .5-.4.9-.9.9H6.5a.9.9 0 0 1-.9-.9V6.2Z"
        fill="currentColor"
      />

      {/* Totenkopf: Schädel hell, Augen in Segelfarbe ausgespart */}
      <circle cx="12" cy="9.1" r="2.15" fill="#fff" />
      <rect x="11.1" y="10.7" width="1.8" height="1.15" rx="0.4" fill="#fff" />
      <circle cx="11.2" cy="8.9" r="0.55" fill="currentColor" />
      <circle cx="12.8" cy="8.9" r="0.55" fill="currentColor" />

      {/* Rumpf */}
      <path
        d="M2.6 16.4h18.8l-2.5 3.9a1.4 1.4 0 0 1-1.2.7H6.3a1.4 1.4 0 0 1-1.2-.7l-2.5-3.9Z"
        fill="currentColor"
      />
    </svg>
  );
}

import { degToCardinal } from "@/lib/format";

interface CompassRoseProps {
  directionDeg: number;
  size?: number;
}

export default function CompassRose({ directionDeg, size = 140 }: CompassRoseProps) {
  return (
    <div
      className="relative flex items-center justify-center"
      style={{ width: size, height: size }}
    >
      <svg
        width={size}
        height={size}
        viewBox="0 0 140 140"
        className="absolute inset-0"
      >
        <circle
          cx="70"
          cy="70"
          r="66"
          className="fill-surface stroke-line"
          strokeWidth="1.5"
        />
        {["N", "O", "S", "W"].map((label, i) => {
          const angle = i * 90;
          const rad = (angle * Math.PI) / 180;
          const x = 70 + 52 * Math.sin(rad);
          const y = 70 - 52 * Math.cos(rad);
          return (
            <text
              key={label}
              x={x}
              y={y}
              textAnchor="middle"
              dominantBaseline="middle"
              className="fill-ink-muted text-[11px] font-semibold"
            >
              {label}
            </text>
          );
        })}
        <g
          style={{
            transform: `rotate(${directionDeg}deg)`,
            transformOrigin: "70px 70px",
            transition: "transform 0.6s ease-out",
          }}
        >
          <path d="M70 18 L80 78 L70 66 L60 78 Z" className="fill-accent" />
        </g>
        <circle cx="70" cy="70" r="4" className="fill-accent" />
      </svg>
      <div className="absolute bottom-0 translate-y-full pt-2 text-center">
        <span className="text-sm font-medium text-ink-muted">
          {Math.round(directionDeg)}° {degToCardinal(directionDeg)}
        </span>
      </div>
    </div>
  );
}

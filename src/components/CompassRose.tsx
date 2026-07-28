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
          className="fill-white/5 stroke-slate-400/40"
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
              className="fill-slate-300 text-[11px] font-semibold"
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
          <path
            d="M70 18 L80 78 L70 66 L60 78 Z"
            className="fill-sky-400 drop-shadow-[0_0_6px_rgba(56,189,248,0.6)]"
          />
        </g>
        <circle cx="70" cy="70" r="4" className="fill-sky-200" />
      </svg>
      <div className="absolute bottom-0 translate-y-full pt-2 text-center">
        <span className="text-sm font-medium text-slate-300">
          {Math.round(directionDeg)}° {degToCardinal(directionDeg)}
        </span>
      </div>
    </div>
  );
}

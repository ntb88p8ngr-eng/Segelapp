"use client";

import { useEffect, useRef } from "react";

/** Bildschirmposition eines festen Kartenpunkts, plus Zoomstufe. */
export interface MapAnchor {
  x: number;
  y: number;
  zoom: number;
}

interface WindParticlesProps {
  /** Meteorologische Windrichtung in Grad: die Richtung, aus der der Wind kommt. */
  directionDeg: number;
  windSpeedKmh: number;
  gustKmh?: number | null;
  /** Strichfarbe als "r, g, b" — die Deckkraft setzt die Animation selbst. */
  streakColor?: string;
  /**
   * Liefert die aktuelle Bildschirmposition eines festen Kartenpunkts. Damit
   * folgen die Partikel der Karte, statt beim Verschieben stehenzubleiben.
   */
  getAnchor?: () => MapAnchor | null;
  className?: string;
}

interface Particle {
  x: number;
  y: number;
  /** Bisherige Lebensdauer in Sekunden. */
  age: number;
  /** Gesamte Lebensdauer in Sekunden, danach wird neu eingesetzt. */
  life: number;
  /** Individueller Geschwindigkeitsfaktor, erzeugt Tiefenwirkung. */
  speedFactor: number;
  width: number;
  alpha: number;
}

/** Ein Partikel pro ~7000 px², begrenzt damit auch große Screens flüssig bleiben. */
const DENSITY = 1 / 7000;
const MAX_PARTICLES = 260;

function createParticle(width: number, height: number, seedAge: boolean): Particle {
  const life = 2.5 + Math.random() * 3.5;
  return {
    x: Math.random() * width,
    y: Math.random() * height,
    age: seedAge ? Math.random() * life : 0,
    life,
    speedFactor: 0.55 + Math.random() * 0.9,
    width: 0.7 + Math.random() * 1.5,
    alpha: 0.35 + Math.random() * 0.45,
  };
}

export default function WindParticles({
  directionDeg,
  windSpeedKmh,
  gustKmh,
  streakColor = "186, 230, 253",
  getAnchor,
  className,
}: WindParticlesProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // Über ein Ref gehalten, damit ein Neuaufbau der Funktion die laufende
  // Animation nicht neu startet.
  const anchorFnRef = useRef(getAnchor);

  useEffect(() => {
    anchorFnRef.current = getAnchor;
  }, [getAnchor]);
  // Über Refs gehalten, damit Richtungs-/Geschwindigkeitswechsel die
  // laufende Animation nicht neu starten, sondern sanft übernommen werden.
  const targetRef = useRef({
    directionDeg,
    windSpeedKmh,
    gustKmh: gustKmh ?? null,
    streakColor,
  });

  useEffect(() => {
    targetRef.current = {
      directionDeg,
      windSpeedKmh,
      gustKmh: gustKmh ?? null,
      streakColor,
    };
  }, [directionDeg, windSpeedKmh, gustKmh, streakColor]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let particles: Particle[] = [];
    let width = 0;
    let height = 0;
    let frame = 0;
    let lastTime = performance.now();

    // Sanft nachgeführte Ist-Werte (Richtung als Vektor, damit der Übergang
    // von 350° auf 10° den kurzen Weg nimmt statt einmal herumzudrehen).
    let flowX = 0;
    let flowY = 0;
    let currentSpeed = 0;
    let initialised = false;

    function resize() {
      const rect = canvas!.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = rect.width;
      height = rect.height;
      canvas!.width = Math.round(width * dpr);
      canvas!.height = Math.round(height * dpr);
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);

      const target = Math.min(Math.round(width * height * DENSITY), MAX_PARTICLES);
      particles = Array.from({ length: target }, () =>
        createParticle(width, height, true),
      );
    }

    /** Richtungsvektor auf dem Bildschirm: Norden ist oben, Osten rechts. */
    function targetFlow() {
      // Meteorologische Richtung ist die Herkunft — die Strömung zeigt entgegengesetzt.
      const towardRad = ((targetRef.current.directionDeg + 180) * Math.PI) / 180;
      return { x: Math.sin(towardRad), y: -Math.cos(towardRad) };
    }

    // Letzte bekannte Lage des Kartenankers, um Verschiebungen zu erkennen.
    let lastAnchor: MapAnchor | null = null;

    /**
     * Verschiebt und skaliert die Partikel so, wie sich die Karte bewegt hat.
     * Damit kleben die Striche am Wasser statt am Bildschirm.
     */
    function followMap() {
      const anchor = anchorFnRef.current?.() ?? null;
      if (!anchor) return;

      if (lastAnchor) {
        if (anchor.zoom !== lastAnchor.zoom) {
          // Beim Zoomen bleiben die Abstände zum Ankerpunkt massstäblich.
          const scale = Math.pow(2, anchor.zoom - lastAnchor.zoom);
          for (const p of particles) {
            p.x = anchor.x + (p.x - lastAnchor.x) * scale;
            p.y = anchor.y + (p.y - lastAnchor.y) * scale;
          }
        } else {
          const dx = anchor.x - lastAnchor.x;
          const dy = anchor.y - lastAnchor.y;
          if (dx !== 0 || dy !== 0) {
            for (const p of particles) {
              p.x += dx;
              p.y += dy;
            }
            // Die stehengebliebenen Spuren sonst mitziehen zu wollen wäre
            // teuer — sie werden ohnehin binnen Sekundenbruchteilen weich
            // ausgeblendet.
            ctx!.clearRect(0, 0, width, height);
          }
        }
      }

      lastAnchor = anchor;
    }

    function draw(now: number) {
      const dt = Math.min((now - lastTime) / 1000, 0.05);
      lastTime = now;

      followMap();

      const target = targetFlow();
      const targetSpeed = targetRef.current.windSpeedKmh;

      if (!initialised) {
        flowX = target.x;
        flowY = target.y;
        currentSpeed = targetSpeed;
        initialised = true;
      } else {
        // Exponentielle Annäherung — Richtungswechsel wirken wie ein Drehen des Windes.
        const ease = 1 - Math.pow(0.001, dt);
        flowX += (target.x - flowX) * ease;
        flowY += (target.y - flowY) * ease;
        currentSpeed += (targetSpeed - currentSpeed) * ease;
      }

      const len = Math.hypot(flowX, flowY) || 1;
      const dirX = flowX / len;
      const dirY = flowY / len;

      // km/h -> px/s, gedeckelt damit starker Wind nicht unlesbar flimmert.
      const pxPerSecond = Math.min(20 + currentSpeed * 3.2, 240);
      // Böen geben den Strichen zusätzliche Länge, das wirkt unruhiger.
      const gust = targetRef.current.gustKmh;
      const gustBoost =
        gust != null && currentSpeed > 0
          ? Math.min(Math.max(gust / Math.max(currentSpeed, 1), 1), 2.2)
          : 1;

      // Alte Striche ausblenden, ohne den Hintergrund zu übermalen.
      ctx!.globalCompositeOperation = "destination-out";
      ctx!.fillStyle = "rgba(0, 0, 0, 0.09)";
      ctx!.fillRect(0, 0, width, height);
      ctx!.globalCompositeOperation = "source-over";

      ctx!.lineCap = "round";

      for (const p of particles) {
        p.age += dt;

        const step = pxPerSecond * p.speedFactor * dt;
        const prevX = p.x;
        const prevY = p.y;
        p.x += dirX * step;
        p.y += dirY * step;

        const outside =
          p.x < -60 || p.x > width + 60 || p.y < -60 || p.y > height + 60;
        if (p.age > p.life || outside) {
          Object.assign(p, createParticle(width, height, false));
          // Neu eingesetzte Partikel am windzugewandten Rand starten lassen,
          // sonst entstehen sichtbare Löcher in der Strömung.
          if (outside) {
            p.x = dirX > 0 ? -20 : dirX < 0 ? width + 20 : Math.random() * width;
            p.y = dirY > 0 ? -20 : dirY < 0 ? height + 20 : Math.random() * height;
            if (Math.abs(dirX) > Math.abs(dirY)) {
              p.y = Math.random() * height;
            } else {
              p.x = Math.random() * width;
            }
          }
          continue;
        }

        // Ein- und Ausblenden über die Lebensdauer, damit nichts hart aufpoppt.
        const lifeRatio = p.age / p.life;
        const fade = Math.sin(Math.PI * lifeRatio);
        const trail = step * 2.6 * gustBoost;

        ctx!.beginPath();
        ctx!.strokeStyle = `rgba(${targetRef.current.streakColor}, ${(p.alpha * fade).toFixed(3)})`;
        ctx!.lineWidth = p.width;
        ctx!.moveTo(prevX - dirX * trail, prevY - dirY * trail);
        ctx!.lineTo(p.x, p.y);
        ctx!.stroke();
      }

      frame = requestAnimationFrame(draw);
    }

    function drawStatic() {
      // Bei "prefers-reduced-motion" nur ein ruhiges Strichmuster zeichnen.
      const target = targetFlow();
      ctx!.clearRect(0, 0, width, height);
      ctx!.lineCap = "round";
      for (const p of particles) {
        ctx!.beginPath();
        ctx!.strokeStyle = `rgba(${targetRef.current.streakColor}, ${(p.alpha * 0.5).toFixed(3)})`;
        ctx!.lineWidth = p.width;
        ctx!.moveTo(p.x - target.x * 14, p.y - target.y * 14);
        ctx!.lineTo(p.x + target.x * 14, p.y + target.y * 14);
        ctx!.stroke();
      }
    }

    resize();

    const observer = new ResizeObserver(() => {
      resize();
      if (reduceMotion) drawStatic();
    });
    observer.observe(canvas);

    if (reduceMotion) {
      drawStatic();
    } else {
      frame = requestAnimationFrame(draw);
    }

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className={className}
      style={{ width: "100%", height: "100%", display: "block" }}
    />
  );
}

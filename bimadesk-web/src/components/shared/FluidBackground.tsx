import React, { useEffect, useRef } from "react";

/** A lightweight, dependency-free approximation of a fluid glassmorphism
 * background: soft blurred blobs tinted with the given colors, drifting
 * continuously, with an optional glow that follows the cursor. Sits fixed
 * behind the app content (pointer-events: none) so it never interferes with
 * interaction. Respects prefers-reduced-motion via the animations defined
 * in index.css. */
export function FluidBackground({
  colors = ["var(--accent-500)", "var(--accent-300)", "#06B6D4"],
  backgroundColor = "transparent",
  speed = 0.5,
  scale = 1,
  opacity = 1,
  mouseInteraction = true,
  className = "",
}: {
  colors?: string[];
  backgroundColor?: string;
  speed?: number;
  scale?: number;
  opacity?: number;
  mouseInteraction?: boolean;
  className?: string;
}) {
  const spotRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!mouseInteraction) return;
    let raf = 0;
    let targetX = 0.5;
    let targetY = 0.35;
    let x = targetX;
    let y = targetY;

    function onMove(e: MouseEvent) {
      targetX = e.clientX / window.innerWidth;
      targetY = e.clientY / window.innerHeight;
    }

    function tick() {
      x += (targetX - x) * 0.06;
      y += (targetY - y) * 0.06;
      if (spotRef.current) {
        spotRef.current.style.left = `${x * 100}%`;
        spotRef.current.style.top = `${y * 100}%`;
      }
      raf = requestAnimationFrame(tick);
    }

    window.addEventListener("mousemove", onMove);
    raf = requestAnimationFrame(tick);
    return () => {
      window.removeEventListener("mousemove", onMove);
      cancelAnimationFrame(raf);
    };
  }, [mouseInteraction]);

  const baseSize = 46 * scale;

  return (
    <div
      className={`pointer-events-none fixed inset-0 overflow-hidden ${className}`}
      style={{ backgroundColor, opacity, zIndex: 0 }}
      aria-hidden="true"
    >
      <div
        className="absolute rounded-full blur-3xl"
        style={{
          width: `${baseSize}vmax`,
          height: `${baseSize}vmax`,
          left: "-8%",
          top: "-10%",
          background: `radial-gradient(circle at 50% 50%, ${colors[0] ?? "var(--accent-500)"}, transparent 70%)`,
          opacity: 0.35,
          animation: `wb-fluid-drift-1 ${26 / speed}s ease-in-out infinite`,
        }}
      />
      <div
        className="absolute rounded-full blur-3xl"
        style={{
          width: `${baseSize * 0.8}vmax`,
          height: `${baseSize * 0.8}vmax`,
          right: "-6%",
          top: "5%",
          background: `radial-gradient(circle at 50% 50%, ${colors[1] ?? "var(--accent-300)"}, transparent 70%)`,
          opacity: 0.3,
          animation: `wb-fluid-drift-2 ${32 / speed}s ease-in-out infinite`,
        }}
      />
      <div
        className="absolute rounded-full blur-3xl"
        style={{
          width: `${baseSize * 0.7}vmax`,
          height: `${baseSize * 0.7}vmax`,
          left: "20%",
          bottom: "-15%",
          background: `radial-gradient(circle at 50% 50%, ${colors[2] ?? "#06B6D4"}, transparent 70%)`,
          opacity: 0.28,
          animation: `wb-fluid-drift-3 ${38 / speed}s ease-in-out infinite, wb-fluid-shimmer ${9 / speed}s ease-in-out infinite`,
        }}
      />
      {mouseInteraction && (
        <div
          ref={spotRef}
          className="absolute rounded-full blur-3xl transition-opacity"
          style={{
            width: "22vmax",
            height: "22vmax",
            left: "50%",
            top: "35%",
            transform: "translate(-50%, -50%)",
            background: `radial-gradient(circle at 50% 50%, rgba(var(--accent-rgb), 0.18), transparent 70%)`,
          }}
        />
      )}
    </div>
  );
}

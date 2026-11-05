"use client";

import { useEffect, useRef, useState } from "react";
import { animate, useReducedMotion } from "motion/react";

/**
 * Smoothly tweens a number when it changes (dashboard counters, cart totals).
 * Respects prefers-reduced-motion and never delays the underlying value.
 */
export function AnimatedNumber({
  value,
  format = (n) => Math.round(n).toLocaleString("en-PH"),
  duration = 0.6,
  className,
}: {
  value: number;
  format?: (n: number) => string;
  duration?: number;
  className?: string;
}) {
  const reduce = useReducedMotion();
  const [tweened, setDisplay] = useState(0);
  const from = useRef(0);
  const display = reduce ? value : tweened;

  useEffect(() => {
    if (reduce) {
      from.current = value;
      return;
    }
    const controls = animate(from.current, value, {
      duration,
      ease: [0.2, 0.8, 0.2, 1],
      onUpdate: (v) => setDisplay(v),
    });
    from.current = value;
    return () => controls.stop();
  }, [value, duration, reduce]);

  return (
    <span className={className} aria-label={format(value)}>
      <span aria-hidden>{format(display)}</span>
    </span>
  );
}

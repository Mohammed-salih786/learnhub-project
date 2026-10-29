"use client";
import { useEffect, useState } from "react";
import { useInView, useReducedMotion } from "framer-motion";
import { useRef } from "react";
export function CountUp({ value, suffix = "" }: { value: number; suffix?: string }) {
  const ref = useRef<HTMLSpanElement>(null); const inView = useInView(ref, { once: true }); const reduced = useReducedMotion(); const [current, setCurrent] = useState(reduced ? value : 0);
  useEffect(() => { if (!inView || reduced) return; let frame = 0; const start = performance.now(); const tick = (time: number) => { const progress = Math.min((time - start) / 650, 1); setCurrent(Math.round(value * progress)); if (progress < 1) frame = requestAnimationFrame(tick); }; frame = requestAnimationFrame(tick); return () => cancelAnimationFrame(frame); }, [inView, reduced, value]);
  return <span ref={ref}>{current}{suffix}</span>;
}

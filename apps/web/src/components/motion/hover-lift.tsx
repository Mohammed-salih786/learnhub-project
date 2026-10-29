"use client";
import { motion, useReducedMotion } from "framer-motion";
export function HoverLift({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  const reduced = useReducedMotion();
  return <motion.div className={className} whileHover={reduced ? undefined : { scale: 1.02, y: -3 }} transition={{ type: "spring", stiffness: 400, damping: 24 }}>{children}</motion.div>;
}

"use client";
import { motion, useReducedMotion } from "framer-motion";
export function StaggerGroup({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  const reduced = useReducedMotion();
  return <motion.div className={className} initial={reduced ? false : "hidden"} whileInView={reduced ? undefined : "show"} viewport={{ once: true, amount: 0.1 }} variants={{ hidden: {}, show: { transition: { staggerChildren: 0.08 } } }}>{children}</motion.div>;
}

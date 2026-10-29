"use client";

import { useEffect } from "react";
import { ThemeProvider } from "next-themes";

import { initAnalytics } from "@/lib/analytics";

export function Providers({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    initAnalytics();
  }, []);

  return (
    <ThemeProvider attribute="data-theme" defaultTheme="system" enableSystem themes={["light", "dark", "mint", "sunset", "glass", "pastel"]}>
      {children}
    </ThemeProvider>
  );
}

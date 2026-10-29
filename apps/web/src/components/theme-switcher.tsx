"use client";

import { Palette } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";

const themes = [
  { id: "light", label: "Light", color: "bg-indigo-500" },
  { id: "dark", label: "Aurora", color: "bg-violet-500" },
  { id: "mint", label: "Mint", color: "bg-emerald-500" },
  { id: "sunset", label: "Sunset", color: "bg-orange-500" },
  { id: "glass", label: "Glass", color: "bg-sky-400" },
  { id: "pastel", label: "Pastel", color: "bg-lavender-300" }
] as const;

export function ThemeSwitcher() {
  const { theme, resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  useEffect(() => {
    document.documentElement.classList.toggle("dark", resolvedTheme === "dark" || resolvedTheme === "glass");
  }, [resolvedTheme]);

  const current = themes.find((item) => item.id === (resolvedTheme || theme)) || themes[0];
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button type="button" aria-label="Choose theme" className="inline-flex h-9 items-center gap-2 rounded-lg border border-border bg-background px-3 text-sm hover:bg-muted">
          <Palette className="h-4 w-4" /><span className="hidden sm:inline">{mounted ? current.label : "Theme"}</span>
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content align="end" sideOffset={8} className="z-50 min-w-44 rounded-xl border border-border bg-popover p-1 text-popover-foreground shadow-soft">
          {themes.map((item) => (
            <DropdownMenu.Item key={item.id} onSelect={() => { if (document.startViewTransition) document.startViewTransition(() => setTheme(item.id)); else setTheme(item.id); }} className="flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-sm outline-none hover:bg-muted">
              <span className={`h-3 w-3 rounded-full ${item.color}`} />{item.label}
              {theme === item.id && <span className="ml-auto text-primary">✓</span>}
            </DropdownMenu.Item>
          ))}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

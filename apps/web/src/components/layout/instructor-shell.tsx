"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart2, BookOpen, Home, PlusCircle, User } from "lucide-react";

import { cn } from "@/lib/utils";

const navItems = [
  { href: "/instructor", label: "Dashboard", icon: Home },
  { href: "/instructor/courses", label: "Courses", icon: BookOpen },
  { href: "/instructor/courses/new", label: "New", icon: PlusCircle },
  { href: "/instructor/analytics", label: "Analytics", icon: BarChart2 },
  { href: "/instructor/profile", label: "Profile", icon: User }
];

export function InstructorShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Mobile header */}
      <header className="sticky top-0 z-40 border-b border-border/80 bg-background/90 backdrop-blur-xl md:hidden">
        <div className="flex items-center justify-between px-4 py-3">
          <Link href="/" className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-xs font-black text-primary-foreground">L</div>
            <span className="font-semibold text-sm">Instructor</span>
          </Link>
          <Link href="/instructor/courses/new" className="rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground">
            + New
          </Link>
        </div>
      </header>

      <div className="flex flex-1">
        {/* Desktop sidebar */}
        <aside className="sticky top-0 hidden h-screen w-56 shrink-0 border-r border-border bg-card/40 py-6 md:flex md:flex-col">
          <Link href="/" className="mb-6 flex items-center gap-3 px-5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-sm font-black text-primary-foreground">L</div>
            <span className="font-semibold">LearnHub</span>
          </Link>
          <nav className="flex-1 space-y-1 px-3">
            {navItems.map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                className={cn(
                  "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                  pathname === href || (href.length > 11 && pathname.startsWith(href))
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <Icon className="h-4 w-4" />
                {label}
              </Link>
            ))}
          </nav>
        </aside>

        <main className="flex-1 pb-20 md:pb-0">{children}</main>
      </div>

      {/* Mobile bottom nav */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-background/95 backdrop-blur-xl md:hidden">
        <div className="grid grid-cols-5">
          {navItems.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || (href.length > 11 && pathname.startsWith(href));
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "flex flex-col items-center gap-1 py-2.5 text-xs font-medium",
                  active ? "text-primary" : "text-muted-foreground"
                )}
              >
                <Icon className="h-4 w-4" />
                <span className="text-[10px]">{label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}

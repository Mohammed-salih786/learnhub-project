"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Menu, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { LogoutButton } from "@/components/layout/logout-button";
import { SiteFooter } from "@/components/layout/site-footer";

const navLinks = [
  { href: "/student/courses", label: "Courses" },
  { href: "/instructor", label: "Teach" },
  { href: "/student/checkout", label: "Pricing" }
];

export function PublicShell({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();
  const isAuthenticatedArea = ["/student", "/instructor", "/admin"].some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <header className="sticky top-0 z-40 border-b border-border/80 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-3" onClick={() => setMobileOpen(false)}>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-sm font-black text-primary-foreground">
              L
            </div>
            <p className="text-base font-semibold">LearnHub</p>
          </Link>

          {/* Desktop nav */}
          <nav className="hidden items-center gap-6 text-sm text-muted-foreground md:flex">
            {navLinks.map(({ href, label }) => (
              <Link key={href} href={href} className="hover:text-foreground transition-colors">
                {label}
              </Link>
            ))}
          </nav>

          {/* Desktop CTAs */}
          <div className="hidden items-center gap-2 md:flex">
            {isAuthenticatedArea ? (
              <LogoutButton />
            ) : (
              <>
                <Button variant="ghost" asChild size="sm">
                  <Link href="/login">Log in</Link>
                </Button>
                <Button asChild size="sm">
                  <Link href="/register">Start free</Link>
                </Button>
              </>
            )}
          </div>

          {/* Mobile hamburger */}
          <button
            className="flex items-center justify-center rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground md:hidden"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label="Toggle navigation"
            aria-expanded={mobileOpen}
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>

        {/* Mobile menu */}
        <div
          className={cn(
            "border-t border-border bg-background md:hidden",
            mobileOpen ? "block" : "hidden"
          )}
        >
          <nav className="flex flex-col px-4 py-4 space-y-1">
            {navLinks.map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                className="rounded-xl px-3 py-2.5 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
                onClick={() => setMobileOpen(false)}
              >
                {label}
              </Link>
            ))}
            <div className="mt-3 flex flex-col gap-2 pt-3 border-t border-border">
              {isAuthenticatedArea ? (
                <LogoutButton className="w-full" />
              ) : (
                <>
                  <Button variant="outline" asChild className="w-full">
                    <Link href="/login" onClick={() => setMobileOpen(false)}>Log in</Link>
                  </Button>
                  <Button asChild className="w-full">
                    <Link href="/register" onClick={() => setMobileOpen(false)}>Start free trial</Link>
                  </Button>
                </>
              )}
            </div>
          </nav>
        </div>
      </header>

      <div className="flex-1">{children}</div>
      <SiteFooter />
    </div>
  );
}

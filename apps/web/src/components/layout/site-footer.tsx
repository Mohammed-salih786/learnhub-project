import Image from "next/image";
import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="border-t border-border bg-card/40 px-4 py-4 text-muted-foreground">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-center gap-3 text-xs sm:flex-row">
        <span>Created by</span>
        <Image
          src="/macrovec-logo.png"
          alt="Macrovec"
          width={112}
          height={72}
          className="h-10 w-16 object-cover"
        />
      </div>
      <nav className="mt-2 flex justify-center gap-4 text-xs">
        <Link href="/privacy" className="hover:text-foreground">Privacy</Link>
        <Link href="/terms" className="hover:text-foreground">Terms</Link>
        <Link href="/refund" className="hover:text-foreground">Refunds</Link>
      </nav>
    </footer>
  );
}

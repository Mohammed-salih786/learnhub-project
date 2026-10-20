import Image from "next/image";

export function SiteFooter() {
  return (
    <footer className="border-t border-border bg-card/40 px-4 py-4 text-muted-foreground">
      <div className="mx-auto flex max-w-6xl items-center justify-center gap-2 text-xs">
        <span>Created by</span>
        <Image
          src="/macrovec-logo.png"
          alt="Macrovec"
          width={112}
          height={72}
          className="h-10 w-16 object-cover"
        />
      </div>
    </footer>
  );
}

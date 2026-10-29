import { PublicShell } from "@/components/layout/public-shell";

export function LegalPage({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <PublicShell>
      <main className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
        <p className="text-sm uppercase tracking-[0.2em] text-muted-foreground">LearnHub legal</p>
        <h1 className="mt-2 text-3xl font-black">{title}</h1>
        <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          Placeholder policy text for legal review. Have qualified Indian legal counsel review and replace this content before production launch.
        </p>
        <div className="prose prose-slate mt-8 max-w-none text-sm leading-7">{children}</div>
      </main>
    </PublicShell>
  );
}

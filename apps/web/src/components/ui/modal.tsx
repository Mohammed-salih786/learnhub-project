import * as React from "react";

export function Modal({ open, onOpenChange, title, description, children }: { open: boolean; onOpenChange: (value: boolean) => void; title: string; description?: string; children: React.ReactNode }) {
  const dialogRef = React.useRef<HTMLDivElement>(null);
  const onOpenChangeRef = React.useRef(onOpenChange);
  React.useEffect(() => { onOpenChangeRef.current = onOpenChange; }, [onOpenChange]);
  React.useEffect(() => {
    if (!open) return;
    const dialog = dialogRef.current;
    const selector = "button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href]";
    dialog?.querySelectorAll<HTMLElement>(selector)[0]?.focus();
    const trapFocus = (event: KeyboardEvent) => {
      if (event.key === "Escape") onOpenChangeRef.current(false);
      if (event.key !== "Tab" || !dialog) return;
      const items = dialog.querySelectorAll<HTMLElement>(selector);
      if (!items.length) return;
      const first = items[0]; const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    window.addEventListener("keydown", trapFocus);
    return () => window.removeEventListener("keydown", trapFocus);
  }, [open]);
  if (!open) return null;
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4" onClick={() => onOpenChange(false)}><div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="modal-title" className="w-full max-w-lg rounded-2xl border border-border bg-card p-6 shadow-soft" onClick={(event) => event.stopPropagation()}><div className="mb-4"><p id="modal-title" className="text-xl font-semibold">{title}</p>{description ? <p className="mt-1 text-sm text-muted-foreground">{description}</p> : null}</div>{children}</div></div>;
}
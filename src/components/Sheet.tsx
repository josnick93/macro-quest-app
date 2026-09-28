import { useEffect, type ReactNode } from "react";
import { X } from "lucide-react";

/** Ventana modal tipo "ventana de sistema" que sube desde abajo. */
export function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 sm:items-center" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="system-window system-scanline max-h-[90dvh] w-full max-w-lg animate-[sheet-in_0.3s_ease-out_both] overflow-y-auto p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="mb-4 flex items-center justify-between gap-3">
          <h2 className="neon-text text-sm font-semibold tracking-[0.18em] uppercase">{title}</h2>
          <button onClick={onClose} aria-label="Cerrar" className="text-muted-foreground flex h-10 w-10 items-center justify-center">
            <X className="h-5 w-5" />
          </button>
        </header>
        {children}
      </div>
    </div>
  );
}

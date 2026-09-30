import { useEffect, useRef, type ReactNode } from "react";
import { X } from "lucide-react";

/** Hojas abiertas, de abajo arriba: Escape solo cierra la de encima. */
const stack: symbol[] = [];

/** Ventana modal tipo "ventana de sistema" que sube desde abajo. */
export function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    const id = Symbol(title);
    stack.push(id);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && stack[stack.length - 1] === id) closeRef.current();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      stack.splice(stack.indexOf(id), 1);
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, []);

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
          <button onClick={onClose} aria-label="Cerrar" className="text-muted-foreground flex h-11 w-11 items-center justify-center">
            <X className="h-5 w-5" />
          </button>
        </header>
        {children}
      </div>
    </div>
  );
}

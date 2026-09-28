import { useEffect } from "react";
import { ChevronsUp } from "lucide-react";

export function LevelUpWindow({ level, onClose }: { level: number; onClose: () => void }) {
  useEffect(() => {
    const t = setTimeout(onClose, 4500);
    return () => clearTimeout(t);
  }, [onClose]);

  return (
    <div role="status" aria-live="polite" className="fixed inset-x-0 top-4 z-50 flex justify-center px-4">
      <div className="system-window system-scanline w-full max-w-sm animate-[level-up_0.5s_cubic-bezier(0.2,1.4,0.4,1)_both] px-5 py-4 shadow-[0_0_34px_oklch(0.72_0.16_250/55%)]">
        <div className="flex items-center gap-3">
          <ChevronsUp className="text-primary h-7 w-7" aria-hidden="true" />
          <div>
            <p className="font-display neon-text text-xs tracking-[0.3em] uppercase">Notificación del sistema</p>
            <p className="font-display text-xl font-bold">Has subido al nivel {level}</p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="border-border text-muted-foreground hover:text-foreground mt-3 w-full border py-2 text-xs tracking-[0.2em] uppercase"
        >
          Cerrar
        </button>
      </div>
    </div>
  );
}

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface Props {
  title?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  scan?: boolean;
}

export function SystemWindow({ title, action, children, className, scan = true }: Props) {
  return (
    <section
      className={cn(
        "system-window animate-[window-in_0.45s_cubic-bezier(0.2,0.8,0.2,1)_both] p-4",
        scan && "system-scanline",
        className,
      )}
    >
      {(title || action) && (
        <header className="mb-3 flex items-center justify-between gap-3">
          {title && <h2 className="neon-text text-sm font-semibold tracking-[0.18em] uppercase">{title}</h2>}
          {action}
        </header>
      )}
      {children}
    </section>
  );
}

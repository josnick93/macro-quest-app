import { NavLink } from "react-router-dom";
import { CalendarCheck, LineChart, Plus, User, UtensilsCrossed } from "lucide-react";
import { cn } from "@/lib/utils";

const TABS = [
  { to: "/", label: "Hoy", icon: CalendarCheck },
  { to: "/anadir", label: "Añadir", icon: Plus },
  { to: "/recetas", label: "Recetas", icon: UtensilsCrossed },
  { to: "/progreso", label: "Progreso", icon: LineChart },
  { to: "/perfil", label: "Perfil", icon: User },
] as const;

export function BottomNav() {
  return (
    <nav
      aria-label="Navegación principal"
      className="border-border/70 fixed inset-x-0 bottom-0 z-40 border-t bg-[oklch(0.11_0.025_258/88%)] pb-[env(safe-area-inset-bottom)] backdrop-blur-lg"
    >
      <ul className="mx-auto flex max-w-lg">
        {TABS.map(({ to, label, icon: Icon }) => (
          <li key={to} className="flex-1">
            <NavLink
              to={to}
              end={to === "/"}
              className={({ isActive }) =>
                cn(
                  "text-muted-foreground flex min-h-16 flex-col items-center justify-center gap-1 text-[11px]",
                  isActive && "!text-primary [text-shadow:0_0_12px_oklch(0.72_0.16_250/55%)]",
                )
              }
            >
              <Icon className="h-5 w-5" aria-hidden="true" />
              <span className="font-display tracking-[0.12em] uppercase">{label}</span>
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}

import { Check } from "lucide-react";
import type { Quest } from "@/lib/xp";
import { cn } from "@/lib/utils";

export function QuestItem({ quest }: { quest: Quest }) {
  return (
    <li className="flex items-center gap-3 py-2">
      <span
        className={cn(
          "flex h-6 w-6 shrink-0 items-center justify-center border",
          quest.done
            ? "border-success text-success bg-success/15 shadow-[0_0_12px_oklch(0.78_0.18_150/45%)]"
            : "border-border text-transparent",
        )}
        aria-hidden="true"
      >
        <Check className="h-4 w-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className={cn("block text-sm", quest.done && "text-muted-foreground line-through")}>{quest.label}</span>
        <span className="text-muted-foreground block text-xs tabular-nums">{quest.progress}</span>
      </span>
      <span className="font-display text-primary shrink-0 text-xs tracking-widest">+{quest.xp} XP</span>
    </li>
  );
}

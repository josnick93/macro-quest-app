import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { CopyPlus, Plus } from "lucide-react";
import { toast } from "sonner";

import { SystemWindow } from "@/components/SystemWindow";
import { StatBar } from "@/components/StatBar";
import { MacroRing } from "@/components/MacroRing";
import { XPBar } from "@/components/XPBar";
import { QuestItem } from "@/components/QuestItem";
import { LevelUpWindow } from "@/components/LevelUpWindow";
import { EntrySheet } from "@/components/EntrySheet";
import { MacroLine } from "@/components/MacroLine";
import { MEALS, type DiaryEntry } from "@/lib/types";
import { entryMacros, totalsFor } from "@/lib/nutrition";
import { dailyQuests, syncDayXp } from "@/lib/xp";
import { addDaysISO, formatLongDate, todayISO } from "@/lib/date";
import { useCopyDay, useDay, useGame, useRemoveEntry, useTargets, useUpdateEntry } from "@/lib/hooks";
import { repos } from "@/lib/repos";

export function TodayPage() {
  const date = todayISO();
  const targets = useTargets();
  const { data: entries } = useDay(date);
  const { data: game } = useGame();
  const removeEntry = useRemoveEntry();
  const updateEntry = useUpdateEntry();
  const copyDay = useCopyDay();
  const qc = useQueryClient();
  const [levelUp, setLevelUp] = useState<number | null>(null);
  const [editing, setEditing] = useState<DiaryEntry | null>(null);

  const totals = totalsFor(entries);
  const quests = dailyQuests(entries, totals, targets);

  useEffect(() => {
    const result = syncDayXp(game, date, entries, quests, addDaysISO(date, -1));
    if (result.gained > 0) {
      repos.profile.saveGame(result.state).then(() => {
        qc.setQueryData(["game"], result.state);
        if (result.levelUp) setLevelUp(result.levelUp);
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entries, game, date, targets.protein, targets.kcal]);

  const handleCopy = async () => {
    const count = await copyDay.mutateAsync({ from: addDaysISO(date, -1), to: date });
    if (count > 0) toast.success(`Copiadas ${count} entradas de ayer`);
    else toast.info("Ayer no registraste nada");
  };

  return (
    <div className="space-y-4">
      {levelUp && <LevelUpWindow level={levelUp} onClose={() => setLevelUp(null)} />}

      <XPBar xp={game.xp} streak={game.streak} />

      <header className="px-1">
        <h1 className="font-display text-2xl font-bold">Hoy</h1>
        <p className="text-muted-foreground text-xs capitalize">{formatLongDate(date)}</p>
      </header>

      <SystemWindow title="Energía">
        <MacroRing consumed={totals.kcal} target={targets.kcal} />
        <div className="mt-5 space-y-3">
          <StatBar label="Proteína" value={totals.protein} target={targets.protein} color="protein" />
          <StatBar label="Carbohidratos" value={totals.carbs} target={targets.carbs} color="carbs" />
          <StatBar label="Grasa" value={totals.fat} target={targets.fat} color="fat" />
        </div>
      </SystemWindow>

      <SystemWindow title="Misiones diarias">
        <ul className="divide-border/40 divide-y">
          {quests.map((q) => (
            <QuestItem key={q.id} quest={q} />
          ))}
        </ul>
      </SystemWindow>

      <div className="flex gap-2">
        <button onClick={handleCopy} className="system-window flex min-h-12 flex-1 items-center justify-center gap-2 px-3 text-sm">
          <CopyPlus className="h-4 w-4" aria-hidden="true" /> Copiar día anterior
        </button>
        <Link to="/anadir" className="btn-primary flex-1 text-sm">
          <Plus className="h-4 w-4" aria-hidden="true" /> Añadir alimento
        </Link>
      </div>

      {MEALS.map((meal) => {
        const list = entries.filter((e) => e.meal === meal.id);
        const mt = totalsFor(list);
        return (
          <SystemWindow
            key={meal.id}
            title={meal.label}
            action={
              <span className="flex items-center gap-2">
                <span className="text-muted-foreground text-xs tabular-nums">
                  {Math.round(mt.kcal)} kcal · P {Math.round(mt.protein)} g
                </span>
                <Link to={`/anadir?comida=${meal.id}`} aria-label={`Añadir a ${meal.label}`} className="text-primary">
                  <Plus className="h-5 w-5" />
                </Link>
              </span>
            }
          >
            {list.length === 0 ? (
              <p className="text-muted-foreground text-sm">Sin alimentos registrados.</p>
            ) : (
              <ul className="divide-border/40 divide-y">
                {list.map((e) => (
                  <li key={e.id}>
                    <button className="flex w-full items-center gap-3 py-2 text-left" onClick={() => setEditing(e)}>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm">{e.name}</span>
                        <span className="block text-xs">
                          <span className="text-muted-foreground tabular-nums">{Math.round(e.grams)} g · </span>
                          <MacroLine m={entryMacros(e)} />
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </SystemWindow>
        );
      })}

      {editing && (
        <EntrySheet
          entry={editing}
          onClose={() => setEditing(null)}
          onSave={(e) => {
            updateEntry.mutate(e);
            setEditing(null);
          }}
          onDelete={(id) => {
            removeEntry.mutate(id);
            setEditing(null);
            toast.success("Entrada borrada");
          }}
        />
      )}
    </div>
  );
}

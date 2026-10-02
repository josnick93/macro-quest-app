import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { CalendarSearch, CopyPlus, MoreHorizontal, Plus, Zap } from "lucide-react";
import { toast } from "sonner";

import { SystemWindow } from "@/components/SystemWindow";
import { StatBar } from "@/components/StatBar";
import { MacroRing } from "@/components/MacroRing";
import { XPBar } from "@/components/XPBar";
import { QuestItem } from "@/components/QuestItem";
import { LevelUpWindow } from "@/components/LevelUpWindow";
import { EntrySheet } from "@/components/EntrySheet";
import { MacroLine } from "@/components/MacroLine";
import { DatePager } from "@/components/DatePager";
import { DayNote } from "@/components/DayNote";
import { QuickAddSheet } from "@/components/QuickAddSheet";
import { CopyMealSheet } from "@/components/CopyMealSheet";
import { MealActionsSheet } from "@/components/MealActionsSheet";
import { SaveMealSheet } from "@/components/SaveMealSheet";
import { MicroList } from "@/components/MicroList";
import { defaultMeal, mealLabel } from "@/components/MealSelect";
import { MEALS, type DiaryEntry, type MealType, type NewEntry } from "@/lib/types";
import { entryMacros, microTotals, totalsFor } from "@/lib/nutrition";
import { currentStreak, dailyQuests } from "@/lib/xp";
import { copyEntries, quickEntry } from "@/lib/diary";
import { uid } from "@/lib/repos/local";
import { addDaysISO, isISODate, relativeDayLabel } from "@/lib/date";
import {
  useAddEntries,
  useDay,
  useGame,
  useProfile,
  useProfileSet,
  usePutEntries,
  useRemoveEntries,
  useSaveSavedMeal,
  useSettings,
  useTargets,
  useToday,
  useXpSync,
} from "@/lib/hooks";

type Panel =
  | { type: "entry"; entry: DiaryEntry }
  | { type: "quick"; meal: MealType }
  | { type: "copy"; meal?: MealType }
  | { type: "actions"; meal: MealType }
  | { type: "save"; meal: MealType }
  | null;

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

export function TodayPage() {
  const today = useToday();
  const [params, setParams] = useSearchParams();
  const paramDate = params.get("fecha");
  const date = isISODate(paramDate) ? paramDate : today;
  const setDate = (d: string) => setParams(d === today ? {} : { fecha: d }, { replace: true });

  const prevDate = addDaysISO(date, -1);
  const prevLabel = date === today ? "de ayer" : "del día anterior";

  const targets = useTargets(date);
  const profileQ = useProfile();
  const profileSet = useProfileSet();
  const dayQ = useDay(date);
  const entries = dayQ.data;
  const { data: previous } = useDay(prevDate);
  const { data: game } = useGame();
  const { data: settings } = useSettings();
  const addEntries = useAddEntries();
  const putEntries = usePutEntries();
  const removeEntries = useRemoveEntries();
  const saveSavedMeal = useSaveSavedMeal();
  const [levelUp, setLevelUp] = useState<number | null>(null);
  const [panel, setPanel] = useState<Panel>(null);

  const totals = totalsFor(entries);
  const quests = dailyQuests(entries, totals, targets);
  const isFuture = date > today;

  // Solo con datos reales cargados, y nunca XP por días futuros.
  useXpSync(date, entries, targets, dayQ.isFetched && profileQ.isFetched && !isFuture, setLevelUp);

  const addWithUndo = async (list: NewEntry[], message: string) => {
    if (list.length === 0) return;
    const added = await addEntries.mutateAsync(list);
    toast.success(message, { action: { label: "Deshacer", onClick: () => removeEntries.mutate(added.map((e) => e.id)) } });
  };

  const removeWithUndo = async (list: DiaryEntry[]) => {
    await removeEntries.mutateAsync(list.map((e) => e.id));
    toast.success(list.length === 1 ? `${list[0]!.name} borrado` : `${list.length} entradas borradas`, {
      action: { label: "Deshacer", onClick: () => putEntries.mutate(list) },
    });
  };

  const copyInto = (source: DiaryEntry[], meal?: MealType) => {
    setPanel(null);
    const where = meal ? ` a ${mealLabel(meal).toLowerCase()}` : "";
    return addWithUndo(copyEntries(source, date, meal), `${plural(source.length, "alimento copiado", "alimentos copiados")}${where}`);
  };

  const visibleMeals = MEALS.filter((m) => !settings.hiddenMeals.includes(m.id) || entries.some((e) => e.meal === m.id));
  const addLink = (meal?: MealType) => {
    const q = new URLSearchParams();
    if (meal) q.set("comida", meal);
    if (date !== today) q.set("fecha", date);
    const s = q.toString();
    return `/anadir${s ? `?${s}` : ""}`;
  };

  return (
    <div className="space-y-4">
      {levelUp && <LevelUpWindow level={levelUp} onClose={() => setLevelUp(null)} />}

      <XPBar xp={game.xp} streak={currentStreak(game.activeDays, today)} />

      <DatePager date={date} today={today} onChange={setDate} />
      {date !== today && (
        <button className="btn-ghost min-h-11 w-full text-xs" onClick={() => setDate(today)}>
          Volver a hoy
        </button>
      )}

      {profileSet === false && (
        <SystemWindow title="Objetivo sin configurar" scan={false}>
          <p className="text-sm">Las calorías que ves son de ejemplo. Dinos tus datos y calculamos las tuyas.</p>
          <Link to="/bienvenida" className="btn-primary mt-3 min-h-11 w-full">
            Configurar mi objetivo
          </Link>
        </SystemWindow>
      )}

      <SystemWindow title="Energía">
        <MacroRing consumed={totals.kcal} target={targets.kcal} />
        <div className="mt-5 space-y-3">
          <StatBar label="Proteína" value={totals.protein} target={targets.protein} color="protein" />
          <StatBar label="Carbohidratos" value={totals.carbs} target={targets.carbs} color="carbs" />
          <StatBar label="Grasa" value={totals.fat} target={targets.fat} color="fat" />
        </div>
        <MicroList micros={microTotals(entries)} className="mt-3 justify-center" />
      </SystemWindow>

      {!isFuture && (
        <SystemWindow title={date === today ? "Misiones diarias" : `Misiones · ${relativeDayLabel(date, today)}`}>
          <ul className="divide-border/40 divide-y">
            {quests.map((q) => (
              <QuestItem key={q.id} quest={q} />
            ))}
          </ul>
        </SystemWindow>
      )}

      <div className="grid grid-cols-3 gap-2">
        <button onClick={() => setPanel({ type: "quick", meal: defaultMeal() })} className="btn-ghost min-h-12 flex-col gap-0.5 px-1 text-xs">
          <Zap className="h-4 w-4" aria-hidden="true" /> Rápido
        </button>
        <button onClick={() => setPanel({ type: "copy" })} className="btn-ghost min-h-12 flex-col gap-0.5 px-1 text-xs">
          <CalendarSearch className="h-4 w-4" aria-hidden="true" /> Copiar día
        </button>
        <Link to={addLink()} className="btn-primary min-h-12 flex-col gap-0.5 px-1 text-xs">
          <Plus className="h-4 w-4" aria-hidden="true" /> Alimento
        </Link>
      </div>

      {visibleMeals.map((meal) => {
        const list = entries.filter((e) => e.meal === meal.id);
        const prev = previous.filter((e) => e.meal === meal.id);
        const mt = totalsFor(list);
        return (
          <SystemWindow
            key={meal.id}
            scan={false}
            title={meal.label}
            action={
              <span className="-my-2 -mr-2 flex items-center">
                <span className="text-muted-foreground mr-1 text-xs tabular-nums">{Math.round(mt.kcal)} kcal</span>
                <button
                  aria-label={`Más opciones de ${meal.label}`}
                  className="text-muted-foreground flex h-11 w-11 items-center justify-center"
                  onClick={() => setPanel({ type: "actions", meal: meal.id })}
                >
                  <MoreHorizontal className="h-5 w-5" />
                </button>
                <Link to={addLink(meal.id)} aria-label={`Añadir a ${meal.label}`} className="text-primary flex h-11 w-11 items-center justify-center">
                  <Plus className="h-6 w-6" />
                </Link>
              </span>
            }
          >
            {list.length === 0 ? (
              prev.length > 0 ? (
                <button className="btn-ghost min-h-11 w-full text-xs" onClick={() => copyInto(prev, meal.id)}>
                  <CopyPlus className="h-4 w-4" /> Copiar {prevLabel} · {plural(prev.length, "alimento", "alimentos")} ·{" "}
                  {Math.round(totalsFor(prev).kcal)} kcal
                </button>
              ) : (
                <p className="text-muted-foreground text-sm">Sin alimentos registrados.</p>
              )
            ) : (
              <>
                <p className="-mt-1 mb-1 text-[11px]">
                  <MacroLine m={mt} />
                </p>
                <ul className="divide-border/40 divide-y">
                  {list.map((e) => (
                    <li key={e.id}>
                      <button className="flex min-h-11 w-full items-center gap-3 py-2 text-left" onClick={() => setPanel({ type: "entry", entry: e })}>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm">
                            {e.kind === "quick" && <Zap className="text-primary mr-1 inline h-3 w-3" aria-label="Añadido rápido" />}
                            {e.name}
                          </span>
                          <span className="block text-xs">
                            {e.kind !== "quick" && <span className="text-muted-foreground tabular-nums">{Math.round(e.grams)} g · </span>}
                            <MacroLine m={entryMacros(e)} />
                          </span>
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </SystemWindow>
        );
      })}

      <SystemWindow title="Nota del día" scan={false}>
        <DayNote key={date} date={date} />
      </SystemWindow>

      {panel?.type === "entry" && (
        <EntrySheet
          entry={panel.entry}
          onClose={() => setPanel(null)}
          onSave={(e) => {
            putEntries.mutate([e]);
            setPanel(null);
          }}
          onDuplicate={(e) => {
            setPanel(null);
            addWithUndo(copyEntries([e], e.date), `${e.name} duplicado`);
          }}
          onDelete={(e) => {
            setPanel(null);
            removeWithUndo([e]);
          }}
        />
      )}

      {panel?.type === "quick" && (
        <QuickAddSheet
          meal={panel.meal}
          onClose={() => setPanel(null)}
          onSave={(meal, macros, name) => {
            setPanel(null);
            addWithUndo([quickEntry(date, meal, macros, name)], `${Math.round(macros.kcal)} kcal añadidas a ${mealLabel(meal).toLowerCase()}`);
          }}
        />
      )}

      {panel?.type === "copy" && <CopyMealSheet date={date} meal={panel.meal} onClose={() => setPanel(null)} onCopy={copyInto} />}

      {panel?.type === "actions" && (
        <MealActionsSheet
          meal={panel.meal}
          previous={previous.filter((e) => e.meal === panel.meal)}
          previousLabel={prevLabel}
          current={entries.filter((e) => e.meal === panel.meal)}
          onSaveMeal={() => setPanel({ type: "save", meal: panel.meal })}
          onClose={() => setPanel(null)}
          onCopyPrevious={() => copyInto(previous.filter((e) => e.meal === panel.meal), panel.meal)}
          onCopyOther={() => setPanel({ type: "copy", meal: panel.meal })}
          onQuickAdd={() => setPanel({ type: "quick", meal: panel.meal })}
        />
      )}

      {panel?.type === "save" && (
        <SaveMealSheet
          entries={entries.filter((e) => e.meal === panel.meal)}
          defaultName={`Mi ${mealLabel(panel.meal).toLowerCase()}`}
          onClose={() => setPanel(null)}
          onSave={async (name) => {
            const now = new Date().toISOString();
            const items = copyEntries(entries.filter((e) => e.meal === panel.meal), date).map(({ date: _d, meal: _m, ...item }) => item);
            setPanel(null);
            await saveSavedMeal.mutateAsync({ id: uid(), name, items, createdAt: now, updatedAt: now });
            toast.success(`«${name}» guardada: la tienes en Añadir → Comidas guardadas`);
          }}
        />
      )}
    </div>
  );
}

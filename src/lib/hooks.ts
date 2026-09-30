import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { repos } from "./repos";
import { DEFAULT_GAME, DEFAULT_PROFILE, DEFAULT_SETTINGS } from "./repos/local";
import type { DayNote, DiaryEntry, Food, GameState, NewEntry, Profile, Recipe, Settings, Targets, WeightLog } from "./types";
import { calcTargets, totalsFor } from "./nutrition";
import { dailyQuests, syncDayXp } from "./xp";
import { msUntilMidnight, todayISO } from "./date";

const opts = { staleTime: 0, refetchOnWindowFocus: false } as const;

/** Fecha de hoy que se actualiza sola al pasar la medianoche o al volver a la app. */
export function useToday(): string {
  const [today, setToday] = useState(todayISO);
  useEffect(() => {
    const update = () => setToday(todayISO());
    const timer = setTimeout(update, msUntilMidnight() + 500);
    document.addEventListener("visibilitychange", update);
    window.addEventListener("focus", update);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", update);
      window.removeEventListener("focus", update);
    };
  }, [today]);
  return today;
}

export function useProfile() {
  return useQuery({ queryKey: ["profile"], queryFn: () => repos.profile.getProfile(), initialData: DEFAULT_PROFILE, ...opts });
}
export function useTargets() {
  const { data } = useProfile();
  return calcTargets(data);
}
export function useSaveProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (p: Profile) => repos.profile.saveProfile(p),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["profile"] }),
  });
}
export function useSettings() {
  return useQuery({ queryKey: ["settings"], queryFn: () => repos.profile.getSettings(), initialData: DEFAULT_SETTINGS, ...opts });
}
export function useSaveSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (s: Settings) => repos.profile.saveSettings(s),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["settings"] }),
  });
}

export function useDay(date: string) {
  return useQuery({ queryKey: ["diary", date], queryFn: () => repos.diary.listByDate(date), initialData: [] as DiaryEntry[], ...opts });
}
export function useDiaryRange(from: string, to: string) {
  return useQuery({
    queryKey: ["diary-range", from, to],
    queryFn: () => repos.diary.listRange(from, to),
    initialData: [] as DiaryEntry[],
    ...opts,
  });
}
const invalidateDiary = (qc: QueryClient) => {
  qc.invalidateQueries({ queryKey: ["diary"] });
  qc.invalidateQueries({ queryKey: ["diary-range"] });
};
export function useAddEntries() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (e: NewEntry[]) => repos.diary.add(e), onSuccess: () => invalidateDiary(qc) });
}
/** Actualiza o restaura entradas completas (editar, mover, deshacer un borrado). */
export function usePutEntries() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (e: DiaryEntry[]) => repos.diary.put(e), onSuccess: () => invalidateDiary(qc) });
}
export function useRemoveEntries() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (ids: string[]) => repos.diary.remove(ids), onSuccess: () => invalidateDiary(qc) });
}

export function useNote(date: string) {
  return useQuery({ queryKey: ["note", date], queryFn: () => repos.diary.getNote(date), initialData: null as DayNote | null, ...opts });
}
export function useSaveNote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ date, text }: { date: string; text: string }) => repos.diary.saveNote(date, text),
    onSuccess: (_, { date }) => qc.invalidateQueries({ queryKey: ["note", date] }),
  });
}

export function useRecents() {
  return useQuery({ queryKey: ["recents"], queryFn: () => repos.foods.getRecents(), initialData: [] as Food[], ...opts });
}
export function useFavorites() {
  return useQuery({ queryKey: ["favorites"], queryFn: () => repos.foods.getFavorites(), initialData: [] as Food[], ...opts });
}
export function useCustomFoods() {
  return useQuery({ queryKey: ["custom"], queryFn: () => repos.foods.listCustom(), initialData: [] as Food[], ...opts });
}
const invalidateFoods = (qc: QueryClient) => {
  qc.invalidateQueries({ queryKey: ["recents"] });
  qc.invalidateQueries({ queryKey: ["favorites"] });
  qc.invalidateQueries({ queryKey: ["custom"] });
};
export function useToggleFavorite() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (f: Food) => repos.foods.toggleFavorite(f), onSuccess: () => invalidateFoods(qc) });
}
export function useAddRecent() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (f: Food) => repos.foods.addRecent(f), onSuccess: () => invalidateFoods(qc) });
}
export function useSaveCustomFood() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (f: Food) => repos.foods.saveCustom(f), onSuccess: () => invalidateFoods(qc) });
}
export function useRemoveCustomFood() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (id: string) => repos.foods.removeCustom(id), onSuccess: () => invalidateFoods(qc) });
}

export function useRecipes() {
  return useQuery({ queryKey: ["recipes"], queryFn: () => repos.recipes.list(), initialData: [] as Recipe[], ...opts });
}
export function useSaveRecipe() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (r: Recipe) => repos.recipes.save(r), onSuccess: () => qc.invalidateQueries({ queryKey: ["recipes"] }) });
}
export function useRemoveRecipe() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (id: string) => repos.recipes.remove(id), onSuccess: () => qc.invalidateQueries({ queryKey: ["recipes"] }) });
}

export function useWeights() {
  return useQuery({ queryKey: ["weights"], queryFn: () => repos.weights.list(), initialData: [] as WeightLog[], ...opts });
}
export function useSaveWeight() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (w: WeightLog) => repos.weights.save(w), onSuccess: () => qc.invalidateQueries({ queryKey: ["weights"] }) });
}
export function useRemoveWeight() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (d: string) => repos.weights.remove(d), onSuccess: () => qc.invalidateQueries({ queryKey: ["weights"] }) });
}

export function useGame() {
  return useQuery({ queryKey: ["game"], queryFn: () => repos.profile.getGame(), initialData: DEFAULT_GAME, ...opts });
}

/** Serializa las escrituras de XP para que dos sincronizaciones seguidas no se pisen. */
let xpQueue: Promise<unknown> = Promise.resolve();

/**
 * Otorga la XP del día. Solo actúa cuando el diario y el perfil reales están cargados
 * (nunca con los valores por defecto) y lee el estado de juego directamente del almacén,
 * así que no puede sobrescribir la XP guardada con un estado vacío.
 */
export function useXpSync(date: string, entries: DiaryEntry[], targets: Targets, ready: boolean, onLevelUp: (level: number) => void) {
  const qc = useQueryClient();
  const levelUpRef = useRef(onLevelUp);
  levelUpRef.current = onLevelUp;

  useEffect(() => {
    if (!ready) return;
    const quests = dailyQuests(entries, totalsFor(entries), targets);
    xpQueue = xpQueue
      .then(async () => {
        const current: GameState = await repos.profile.getGame();
        const result = syncDayXp(current, date, entries, quests);
        if (result.gained === 0) return;
        await repos.profile.saveGame(result.state);
        qc.setQueryData(["game"], result.state);
        if (result.levelUp) levelUpRef.current(result.levelUp);
      })
      .catch((e) => console.error("XP sync", e));
  }, [ready, date, entries, targets.kcal, targets.protein, qc]);
}

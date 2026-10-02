import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { repos } from "./repos";
import { deleteAccount, fetchSession, logout, type SessionInfo } from "./auth";
import { DEFAULT_GAME, DEFAULT_PROFILE, DEFAULT_SETTINGS } from "./repos/local";
import type { DayNote, DiaryEntry, Food, GameState, NewEntry, Profile, Recipe, SavedMeal, Settings, Targets, WeightLog } from "./types";
import { foodStats, knownFoods, recipeAsFood, resolveFoods, type FoodStats } from "./foods";
import { calcTargets, totalsFor } from "./nutrition";
import { estimateTdee, kcalByDay, TDEE_WINDOW_DAYS, type TdeeEstimate } from "./goals";
import { dailyQuests, syncDayXp } from "./xp";
import { addDaysISO, msUntilMidnight, todayISO } from "./date";

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
/** Objetivos del perfil; con `date`, incluye el ajuste de ese día de la semana. */
export function useTargets(date?: string) {
  const { data } = useProfile();
  return calcTargets(data, date);
}
/** ¿Ha guardado el usuario su perfil? undefined mientras se carga. */
export function useProfileSet(): boolean | undefined {
  return useQuery({ queryKey: ["profile", "set"], queryFn: () => repos.profile.isProfileSet(), ...opts }).data;
}
export function useSaveProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (p: Profile) => repos.profile.saveProfile(p),
    // Invalida también ["profile", "set"].
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

export function useFoods() {
  return useQuery({ queryKey: ["foods"], queryFn: () => repos.foods.list(), initialData: [] as Food[], ...opts });
}
export function useFavoriteIds() {
  return useQuery({ queryKey: ["favorites"], queryFn: () => repos.foods.getFavorites(), initialData: [] as string[], ...opts });
}
const invalidateFoods = (qc: QueryClient) => {
  qc.invalidateQueries({ queryKey: ["foods"] });
  qc.invalidateQueries({ queryKey: ["favorites"] });
};
export function useToggleFavorite() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (f: Food) => repos.foods.toggleFavorite(f), onSuccess: () => invalidateFoods(qc) });
}
/** Crear/editar un alimento propio o corregir uno de OFF. */
export function useSaveFood() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (f: Food) => repos.foods.save(f), onSuccess: () => invalidateFoods(qc) });
}
/** Guardar en el historial un alimento de OFF que se acaba de usar. */
export function useRememberFood() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (f: Food) => repos.foods.remember(f), onSuccess: () => invalidateFoods(qc) });
}
export function useRemoveFood() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (id: string) => repos.foods.remove(id), onSuccess: () => invalidateFoods(qc) });
}

export function useSavedMeals() {
  return useQuery({ queryKey: ["savedMeals"], queryFn: () => repos.savedMeals.list(), initialData: [] as SavedMeal[], ...opts });
}
export function useSaveSavedMeal() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (m: SavedMeal) => repos.savedMeals.save(m), onSuccess: () => qc.invalidateQueries({ queryKey: ["savedMeals"] }) });
}
export function useRemoveSavedMeal() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (id: string) => repos.savedMeals.remove(id), onSuccess: () => qc.invalidateQueries({ queryKey: ["savedMeals"] }) });
}

/** Ventana del diario usada para recientes, frecuentes y última cantidad. */
const STATS_DAYS = 90;

export interface FoodLibrary {
  /** Todos los alimentos locales resolubles por id (almacén + recetas). */
  known: Map<string, Food>;
  stats: FoodStats;
  recents: Food[];
  frequent: Food[];
  favorites: Food[];
  mine: Food[];
  recipes: Food[];
  /** Lo que se busca en local: almacén + recetas. */
  local: Food[];
}

export function useFoodLibrary(): FoodLibrary {
  const today = useToday();
  const { data: foods } = useFoods();
  const { data: recipes } = useRecipes();
  const { data: favIds } = useFavoriteIds();
  const { data: entries } = useDiaryRange(addDaysISO(today, -STATS_DAYS), today);
  return useMemo(() => {
    const known = knownFoods(foods, recipes);
    const stats = foodStats(entries);
    const recipeFoods = recipes.map(recipeAsFood);
    return {
      known,
      stats,
      recents: resolveFoods(stats.recents.slice(0, 30), known, stats.lastEntry),
      frequent: resolveFoods(stats.frequent.filter((id) => (stats.count[id] ?? 0) >= 2).slice(0, 30), known, stats.lastEntry),
      favorites: resolveFoods(favIds, known, stats.lastEntry),
      mine: foods.filter((f) => f.source === "custom").sort((a, b) => a.name.localeCompare(b.name, "es")),
      recipes: recipeFoods,
      local: [...foods, ...recipeFoods],
    };
  }, [foods, recipes, favIds, entries]);
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

/** Gasto real estimado con los últimos 28 días completos (hoy no cuenta: aún no ha terminado). */
export function useTdeeEstimate(): TdeeEstimate {
  const today = useToday();
  const from = addDaysISO(today, -TDEE_WINDOW_DAYS);
  const to = addDaysISO(today, -1);
  const { data: entries } = useDiaryRange(from, to);
  const { data: weights } = useWeights();
  return useMemo(() => estimateTdee(kcalByDay(entries), weights.filter((w) => w.date >= from && w.date <= today)), [entries, weights, from, today]);
}

/** Sesión de Google. Mientras no se sabe (o sin servidor), cuenta como "sin login". */
export function useSession() {
  return useQuery({
    queryKey: ["session"],
    queryFn: fetchSession,
    initialData: { enabled: false, user: null } as SessionInfo,
    initialDataUpdatedAt: 0,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });
}
export function useLogout() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: logout, onSuccess: () => qc.invalidateQueries({ queryKey: ["session"] }) });
}
export function useDeleteAccount() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: deleteAccount, onSuccess: () => qc.invalidateQueries({ queryKey: ["session"] }) });
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

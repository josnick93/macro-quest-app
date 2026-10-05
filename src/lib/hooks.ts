import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { repos } from "./repos";
import { onDirty } from "./repos/idb";
import { SyncError } from "./repos/sync";
import { setSyncStatus } from "./syncStatus";
import { activeAccount, deleteAccount, loadSession, logout, rememberAccount, rememberedAccount, type SessionUser } from "./auth";
import { DEFAULT_GAME, DEFAULT_PROFILE, DEFAULT_SETTINGS } from "./repos/local";
import type { DayNote, DiaryEntry, Food, GameState, NewEntry, Profile, Recipe, SavedMeal, Settings, Targets, WeightLog } from "./types";
import { foodStats, knownFoods, recipeAsFood, resolveFoods, type FoodStats } from "./foods";
import { calcTargets, totalsFor } from "./nutrition";
import { estimateTdee, kcalByDay, TDEE_WINDOW_DAYS, type TdeeEstimate } from "./goals";
import { dailyQuests, shieldedStreak, syncDayXp, weekStartISO, type Quest } from "./xp";
import { reachedTarget, syncGame, weeklyQuests, type Achievement, type AchievementContext, type Week } from "./gamification";
import { dayStats } from "./progress";
import { hasScanned } from "./scanFlag";
import { bestStreak, characterStats, historyStats, weeklyQuestsDone, type Stat } from "./character";
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

/** Sesión de Google. `data` es undefined hasta que el servidor responde (o falla). */
export function useSession() {
  return useQuery({ queryKey: ["session"], queryFn: loadSession, staleTime: 60_000, refetchOnWindowFocus: false, retry: false });
}
/** Cuenta en uso: la de la sesión o, sin conexión, la última que entró en este dispositivo. */
export function useAccount(): SessionUser | null {
  return activeAccount(useSession().data, rememberedAccount());
}
const forgetSession = (qc: QueryClient) => {
  rememberAccount(null);
  return qc.invalidateQueries({ queryKey: ["session"] });
};
export function useLogout() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: logout, onSuccess: () => forgetSession(qc) });
}
export function useDeleteAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      await deleteAccount();
      // La copia del servidor ya no existe: si vuelve a entrar, se sube todo de nuevo.
      await repos.sync.forget();
    },
    onSuccess: () => forgetSession(qc),
  });
}

// ---------- copia en la nube ----------

/** De qué cuenta son los datos de este dispositivo (null: de ninguna todavía). */
export function useSyncOwner() {
  return useQuery({ queryKey: ["sync", "owner"], queryFn: () => repos.sync.owner(), ...opts });
}
export function useSyncPending(): number {
  return useQuery({ queryKey: ["sync", "pending"], queryFn: () => repos.sync.pending(), initialData: 0, ...opts }).data;
}
/** Borra los datos de este dispositivo para usarlo con otra cuenta. */
export function useWipeLocal() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: () => repos.sync.wipe(), onSuccess: () => qc.invalidateQueries() });
}

/** Espera tras el último cambio local antes de subirlo. */
const SYNC_DEBOUNCE_MS = 2500;
/** Al volver a la app solo se sincroniza si ha pasado este tiempo. */
const SYNC_ON_RETURN_MS = 60_000;

let syncTrigger: (() => void) | null = null;
/** Sincroniza ahora (botón de la ventana de la cuenta). */
export const syncNow = () => syncTrigger?.();

/**
 * Mantiene la copia en la nube: al abrir, tras cada cambio local, al volver a la app y al recuperar la conexión.
 * Los fallos no molestan: lo pendiente se queda en la cola y se reintenta.
 */
export function useSyncRunner(account: SessionUser | null, active: boolean) {
  const qc = useQueryClient();
  const id = account?.id;
  const accountRef = useRef(account);
  accountRef.current = account;

  useEffect(() => {
    if (!id || !active) return;
    let disposed = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let lastRun = 0;

    const runNow = async () => {
      clearTimeout(timer);
      timer = undefined;
      const user = accountRef.current;
      if (disposed || !user) return;
      setSyncStatus({ state: "syncing" });
      try {
        const result = await repos.sync.run(user);
        lastRun = Date.now();
        // Primero los datos y después el estado: quien espera a la primera sincronización ve ya el perfil bajado.
        if (result.pulled > 0) await qc.invalidateQueries({ predicate: (q) => q.queryKey[0] !== "session" && q.queryKey[0] !== "sync" });
        setSyncStatus({ state: "idle", lastAt: new Date().toISOString(), error: null });
      } catch (e) {
        const code = e instanceof SyncError ? e.code : "server";
        if (code !== "network") console.error("Sincronización", e);
        if (code === "unauthorized") qc.invalidateQueries({ queryKey: ["session"] });
        setSyncStatus({ state: "error", error: code });
      }
      if (!disposed) qc.invalidateQueries({ queryKey: ["sync"] });
    };
    const schedule = () => {
      clearTimeout(timer);
      timer = setTimeout(runNow, SYNC_DEBOUNCE_MS);
    };
    const onVisibility = () => {
      // Al salir se sube lo pendiente sin esperar; al volver se baja lo que haya de otros dispositivos.
      if (document.visibilityState === "hidden" ? timer !== undefined : Date.now() - lastRun > SYNC_ON_RETURN_MS) runNow();
    };

    onDirty(schedule);
    syncTrigger = runNow;
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("online", runNow);
    runNow();
    return () => {
      disposed = true;
      clearTimeout(timer);
      onDirty(null);
      syncTrigger = null;
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("online", runNow);
    };
  }, [id, active, qc]);
}

export function useGame() {
  return useQuery({ queryKey: ["game"], queryFn: () => repos.profile.getGame(), initialData: DEFAULT_GAME, ...opts });
}

/** Lo que hace falta, además del día, para las misiones semanales y los logros. */
export interface GameExtras {
  /** Semana actual y anterior (por si una misión se completó justo al acabar la semana). */
  weeks: Week[];
  context: AchievementContext;
}

/** Misiones de la semana en curso y datos para los logros. `extras` es null hasta que todo está cargado. */
export function useGameExtras(today: string): { weekly: Quest[]; extras: GameExtras | null } {
  const thisWeek = weekStartISO(today);
  const lastWeek = addDaysISO(thisWeek, -7);
  const range = useDiaryRange(lastWeek, addDaysISO(thisWeek, 6));
  const weights = useWeights();
  const recipes = useRecipes();
  const foods = useFoods();
  const profile = useProfile();
  const profileSet = useProfileSet();
  const game = useGame();
  const count = useQuery({ queryKey: ["diary", "count"], queryFn: () => repos.diary.count(), ...opts });

  const weeks = useMemo(
    () =>
      [thisWeek, lastWeek].map((start): Week => {
        const end = addDaysISO(start, 6);
        const stats = dayStats(range.data, start, end, (d) => calcTargets(profile.data, d));
        return { start, quests: weeklyQuests(stats, weights.data.filter((w) => w.date >= start && w.date <= end).length) };
      }),
    [thisWeek, lastWeek, range.data, weights.data, profile.data],
  );

  const ready = range.isFetched && weights.isFetched && recipes.isFetched && foods.isFetched && profile.isFetched && game.isFetched && count.data !== undefined && profileSet !== undefined;
  const latest = weights.data[weights.data.length - 1]?.kg;
  const extras = useMemo(
    (): GameExtras | null =>
      ready
        ? {
            weeks,
            context: {
              streak: shieldedStreak(game.data.activeDays, today).streak,
              entries: count.data ?? 0,
              recipes: recipes.data.length,
              customFoods: foods.data.filter((f) => f.source === "custom").length,
              weighIns: weights.data.length,
              scanned: hasScanned(),
              atTargetWeight: profileSet === true && reachedTarget(profile.data, latest),
            },
          }
        : null,
    [ready, weeks, game.data.activeDays, today, count.data, recipes.data, foods.data, weights.data, profileSet, profile.data, latest],
  );
  return { weekly: weeks[0]!.quests, extras };
}

/** Primera fecha posible: para leer el diario entero. */
const ALL_TIME = "0000-01-01";

export interface CharacterSheet {
  stats: Stat[];
  bestStreak: number;
  weeklyDone: number;
  entries: number;
}

/** Ficha de personaje: atributos y resumen a partir de todo el historial. null mientras carga. */
export function useCharacter(today: string): CharacterSheet | null {
  const diary = useDiaryRange(ALL_TIME, today);
  const weights = useWeights();
  const profile = useProfile();
  const game = useGame();
  const ready = diary.isFetched && weights.isFetched && profile.isFetched && game.isFetched;
  return useMemo(() => {
    if (!ready) return null;
    const input = { entries: diary.data, weights: weights.data, targetsFor: (d: string) => calcTargets(profile.data, d), today };
    const history = historyStats(input);
    return {
      stats: characterStats(input, history),
      bestStreak: bestStreak(game.data.activeDays),
      weeklyDone: weeklyQuestsDone(history, weights.data),
      entries: diary.data.length,
    };
  }, [ready, diary.data, weights.data, profile.data, game.data.activeDays, today]);
}

export interface GameRewards {
  weeklyDone: Quest[];
  unlocked: Achievement[];
}

/** Serializa las escrituras de XP para que dos sincronizaciones seguidas no se pisen. */
let xpQueue: Promise<unknown> = Promise.resolve();

/**
 * Otorga la XP del día y, con `extras`, la de las misiones semanales y los logros.
 * Solo actúa cuando el diario y el perfil reales están cargados (nunca con los valores por defecto)
 * y lee el estado de juego directamente del almacén, así que no puede sobrescribir la XP guardada con un estado vacío.
 */
export function useXpSync(
  date: string,
  entries: DiaryEntry[],
  targets: Targets,
  ready: boolean,
  onLevelUp: (level: number) => void,
  today: string,
  extras: GameExtras | null,
  onRewards: (rewards: GameRewards) => void,
) {
  const qc = useQueryClient();
  const levelUpRef = useRef(onLevelUp);
  levelUpRef.current = onLevelUp;
  const rewardsRef = useRef(onRewards);
  rewardsRef.current = onRewards;
  const extrasRef = useRef(extras);
  extrasRef.current = extras;
  // Las misiones semanales y los logros solo se revisan cuando cambia algo de lo que dependen.
  const extrasKey = extras ? JSON.stringify(extras) : "";

  useEffect(() => {
    if (!ready) return;
    const quests = dailyQuests(entries, totalsFor(entries), targets);
    xpQueue = xpQueue
      .then(async () => {
        const current: GameState = await repos.profile.getGame();
        const day = syncDayXp(current, date, entries, quests);
        const extra = extrasRef.current;
        // La racha se recalcula con el día recién contado.
        const game = extra
          ? syncGame(
              day.state,
              today,
              extra.weeks,
              { ...extra.context, streak: shieldedStreak(day.state.activeDays, today).streak },
              new Date().toISOString(),
            )
          : null;
        const state = game?.state ?? day.state;
        if (day.gained === 0 && state === day.state) return;
        await repos.profile.saveGame(state);
        qc.setQueryData(["game"], state);
        const levelUp = game?.levelUp ?? day.levelUp;
        if (levelUp) levelUpRef.current(levelUp);
        if (game && (game.weeklyDone.length > 0 || game.unlocked.length > 0)) rewardsRef.current({ weeklyDone: game.weeklyDone, unlocked: game.unlocked });
      })
      .catch((e) => console.error("XP sync", e));
  }, [ready, date, today, entries, targets.kcal, targets.protein, extrasKey, qc]);
}

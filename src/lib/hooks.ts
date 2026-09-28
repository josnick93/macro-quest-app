import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { repos } from "./repos";
import { DEFAULT_GAME, DEFAULT_PROFILE } from "./repos/local";
import type { DiaryEntry, Food, Profile, Recipe, WeightLog } from "./types";
import { calcTargets } from "./nutrition";

const opts = { staleTime: 0, refetchOnWindowFocus: false } as const;

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
export function useAddEntry() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (e: Omit<DiaryEntry, "id">) => repos.diary.add(e), onSuccess: () => invalidateDiary(qc) });
}
export function useUpdateEntry() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (e: DiaryEntry) => repos.diary.update(e), onSuccess: () => invalidateDiary(qc) });
}
export function useRemoveEntry() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (id: string) => repos.diary.remove(id), onSuccess: () => invalidateDiary(qc) });
}
export function useCopyDay() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ from, to }: { from: string; to: string }) => repos.diary.copyDay(from, to),
    onSuccess: () => invalidateDiary(qc),
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

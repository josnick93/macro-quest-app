import { lazy, Suspense } from "react";
import { BrowserRouter, Link, Route, Routes } from "react-router-dom";
import { MutationCache, QueryCache, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { toast, Toaster } from "sonner";
import { BottomNav } from "@/components/BottomNav";
import { SystemWindow } from "@/components/SystemWindow";
import { TodayPage } from "@/pages/TodayPage";
import { AddPage } from "@/pages/AddPage";
import { RecipesPage } from "@/pages/RecipesPage";
import { ProfilePage } from "@/pages/ProfilePage";
import { requestPersistence } from "@/lib/repos/idb";

const errorMessage = (e: unknown) => (e instanceof Error ? e.message : String(e));

// Ningún fallo de lectura/escritura pasa en silencio.
const qc = new QueryClient({
  queryCache: new QueryCache({ onError: (e) => toast.error(`No se pudieron leer los datos: ${errorMessage(e)}`, { id: "read-error" }) }),
  mutationCache: new MutationCache({ onError: (e) => toast.error(`No se pudo guardar: ${errorMessage(e)}`) }),
});

requestPersistence();
const ProgressPage = lazy(() => import("@/pages/ProgressPage").then((m) => ({ default: m.ProgressPage })));

function NotFound() {
  return (
    <SystemWindow title="Error">
      <p className="mb-4 text-sm">Pantalla no encontrada.</p>
      <Link to="/" className="btn-primary w-full">Volver</Link>
    </SystemWindow>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={qc}>
      <BrowserRouter>
        <div className="mx-auto min-h-screen w-full max-w-lg px-4 pt-5 pb-24">
          <Routes>
            <Route path="/" element={<TodayPage />} />
            <Route path="/anadir" element={<AddPage />} />
            <Route path="/recetas" element={<RecipesPage />} />
            <Route path="/progreso" element={<Suspense fallback={null}><ProgressPage /></Suspense>} />
            <Route path="/perfil" element={<ProfilePage />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </div>
        <BottomNav />
        <Toaster position="top-center" theme="dark" />
      </BrowserRouter>
    </QueryClientProvider>
  );
}

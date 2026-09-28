import { lazy, Suspense } from "react";
import { BrowserRouter, Link, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "sonner";
import { BottomNav } from "@/components/BottomNav";
import { SystemWindow } from "@/components/SystemWindow";
import { TodayPage } from "@/pages/TodayPage";
import { AddPage } from "@/pages/AddPage";
import { RecipesPage } from "@/pages/RecipesPage";
import { ProfilePage } from "@/pages/ProfilePage";

const qc = new QueryClient();
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

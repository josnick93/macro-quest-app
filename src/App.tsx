import { lazy, Suspense, useEffect, useState } from "react";
import { BrowserRouter, Link, Navigate, Route, Routes, useLocation, useSearchParams } from "react-router-dom";
import { MutationCache, QueryCache, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { toast, Toaster } from "sonner";
import { BottomNav } from "@/components/BottomNav";
import { BackupReminder } from "@/components/BackupReminder";
import { SystemWindow } from "@/components/SystemWindow";
import { TodayPage } from "@/pages/TodayPage";
import { AddPage } from "@/pages/AddPage";
import { RecipesPage } from "@/pages/RecipesPage";
import { ProfilePage } from "@/pages/ProfilePage";
import { WelcomePage } from "@/pages/WelcomePage";
import { LoginPage } from "@/pages/LoginPage";
import { FirstSync, OtherAccount } from "@/components/SyncScreens";
import { useAccount, useProfileSet, useSession, useSyncOwner, useSyncRunner } from "@/lib/hooks";
import { gate, loginMessage, rememberedAccount } from "@/lib/auth";
import { welcomeSkipped } from "@/lib/welcome";
import { requestPersistence } from "@/lib/repos/idb";

const errorMessage = (e: unknown) => (e instanceof Error ? e.message : String(e));

// Ningún fallo de lectura/escritura pasa en silencio (la sincronización tiene su propio estado).
const qc = new QueryClient({
  queryCache: new QueryCache({ onError: (e) => toast.error(`No se pudieron leer los datos: ${errorMessage(e)}`, { id: "read-error" }) }),
  mutationCache: new MutationCache({ onError: (e) => toast.error(`No se pudo guardar: ${errorMessage(e)}`) }),
});

requestPersistence();
const CharacterPage = lazy(() => import("@/pages/CharacterPage").then((m) => ({ default: m.CharacterPage })));
const ProgressPage = lazy(() => import("@/pages/ProgressPage").then((m) => ({ default: m.ProgressPage })));

function NotFound() {
  return (
    <SystemWindow title="Error">
      <p className="mb-4 text-sm">Pantalla no encontrada.</p>
      <Link to="/" className="btn-primary w-full">Volver</Link>
    </SystemWindow>
  );
}

const WELCOME = "/bienvenida";

/** Resultado del login al volver de Google: se muestra una vez y se limpia de la URL. */
function useLoginResult() {
  const [params, setParams] = useSearchParams();
  const result = params.get("login");
  const motivo = params.get("motivo");
  useEffect(() => {
    const msg = loginMessage(result, motivo);
    if (!msg) return;
    if (msg.ok) toast.success(msg.text);
    else toast.info(msg.text, { duration: 15_000 });
    setParams((p) => (p.delete("login"), p.delete("motivo"), p), { replace: true });
  }, [result, motivo, setParams]);
}

function Shell() {
  const { pathname } = useLocation();
  const profileSet = useProfileSet();
  const session = useSession();
  const account = useAccount();
  const owner = useSyncOwner();
  const [skipFirstSync, setSkipFirstSync] = useState(false);
  useLoginResult();
  const onWelcome = pathname === WELCOME;

  // Abierta sin conexión: en cuanto vuelve se pregunta de nuevo al servidor, y con la sesión arranca la sincronización.
  const offline = session.data?.offline === true;
  const refetchSession = session.refetch;
  useEffect(() => {
    if (!offline) return;
    const retry = () => {
      if (document.visibilityState === "visible") refetchSession();
    };
    window.addEventListener("online", retry);
    document.addEventListener("visibilitychange", retry);
    return () => {
      window.removeEventListener("online", retry);
      document.removeEventListener("visibilitychange", retry);
    };
  }, [offline, refetchSession]);

  // Solo se sincroniza con sesión real (no con la cuenta recordada sin conexión) y si los datos de aquí son de esa cuenta.
  const signedIn = !!session.data?.user;
  const otherAccount = !!account && !!owner.data && owner.data.userId !== account.id;
  useSyncRunner(account, signedIn && owner.isFetched && !otherAccount);

  const access = gate(session.data, rememberedAccount());
  if (access === "loading") return null;
  if (access === "login") return <LoginPage offline={offline} onRetry={() => session.refetch()} />;
  if (otherAccount) return <OtherAccount ownerEmail={owner.data!.email} account={account} />;
  if (profileSet === false) {
    // Sin perfil: antes de pedirlo hay que saber si ya está en la nube (dispositivo nuevo).
    if (session.isPending || owner.isPending) return null;
    if (signedIn && !owner.data?.synced && !skipFirstSync) return <FirstSync onSkip={() => setSkipFirstSync(true)} />;
    // Primera vez: se pide lo mínimo para calcular el objetivo, en vez de enseñar kcal de ejemplo.
    if (!onWelcome && !welcomeSkipped()) return <Navigate to={WELCOME} replace />;
  }
  return (
    <>
      <div className={`mx-auto min-h-screen w-full max-w-lg px-4 pt-5 ${onWelcome ? "pb-8" : "pb-24"}`}>
        <Routes>
          <Route path="/" element={<TodayPage />} />
          <Route path="/anadir" element={<AddPage />} />
          <Route path="/recetas" element={<RecipesPage />} />
          <Route path="/progreso" element={<Suspense fallback={null}><ProgressPage /></Suspense>} />
          <Route path="/perfil" element={<ProfilePage />} />
          <Route path="/ficha" element={<Suspense fallback={null}><CharacterPage /></Suspense>} />
          <Route path={WELCOME} element={<WelcomePage />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </div>
      {!onWelcome && <BottomNav />}
      {!onWelcome && <BackupReminder />}
    </>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={qc}>
      <BrowserRouter>
        <Shell />
        <Toaster position="top-center" theme="dark" />
      </BrowserRouter>
    </QueryClientProvider>
  );
}

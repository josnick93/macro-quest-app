import type { ReactNode } from "react";
import { BookOpen, Cloud, LogIn, RefreshCw, ScanBarcode, Target, TrendingUp, Trophy, WifiOff, type LucideIcon } from "lucide-react";
import { SystemWindow } from "@/components/SystemWindow";
import { startLogin } from "@/lib/auth";

const FEATURES: { icon: LucideIcon; title: string; text: string }[] = [
  {
    icon: ScanBarcode,
    title: "Registra en segundos",
    text: "Escanea el código de barras, busca entre millones de productos o repite lo de ayer con un toque. Tus alimentos, recetas y comidas habituales siempre a mano.",
  },
  {
    icon: Target,
    title: "Objetivo hecho a tu medida",
    text: "Calcula tu gasto con tu edad, altura, peso y actividad (y tu % de grasa si lo sabes), y reparte las kcal y los macros según quieras definir, mantener o ganar.",
  },
  {
    icon: TrendingUp,
    title: "Se ajusta con tus datos reales",
    text: "Con tus pesajes y lo que registras calcula tu gasto real y te propone corregir el objetivo. La media de 7 días del peso te enseña la tendencia sin el ruido del día a día.",
  },
  {
    icon: Trophy,
    title: "Constancia que sube de nivel",
    text: "Misiones diarias y semanales, XP, rachas con escudo y una ficha de personaje con atributos que salen de tus hábitos. Premia registrar, nunca castiga comer más.",
  },
  {
    icon: Cloud,
    title: "En todos tus dispositivos",
    text: "Entra con Google y tu diario se guarda en la nube y se sincroniza. Sin conexión sigue funcionando y se pone al día al volver.",
  },
];

/** Páginas estáticas de public/ (se leen sin cuenta). */
const GUIDES = [
  { href: "/guia", title: "Calorías y macros", text: "De dónde salen tu gasto, tu objetivo y el reparto de macros, con un ejemplo." },
  { href: "/proteina", title: "Proteína: cuánta y de dónde", text: "Cuánta necesitas según tu objetivo y qué alimentos dan más por caloría." },
  { href: "/etiquetas", title: "Cómo leer una etiqueta", text: "La tabla nutricional, las frases del envase y el Nutri-Score, sin trampas." },
];

const STEPS = [
  "Entra con tu cuenta de Google.",
  "Rellena tu perfil en tres pasos: la app calcula tus kcal y macros.",
  "Registra tus comidas y cumple las misiones del día.",
];

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="font-display neon-text mb-3 px-1 text-sm font-bold tracking-[0.2em] uppercase">{title}</h2>
      {children}
    </section>
  );
}

function Access({ offline, onRetry }: { offline: boolean; onRetry: () => void }) {
  return offline ? (
    <>
      <p className="text-over flex items-center gap-2 text-sm">
        <WifiOff className="h-4 w-4 shrink-0" /> Sin conexión. Hace falta internet para entrar la primera vez.
      </p>
      <button type="button" className="btn-primary mt-4 min-h-12 w-full" onClick={onRetry}>
        <RefreshCw className="h-4 w-4" /> Reintentar
      </button>
    </>
  ) : (
    <button type="button" className="btn-primary min-h-12 w-full" onClick={startLogin}>
      <LogIn className="h-4 w-4" /> Entrar con Google
    </button>
  );
}

/**
 * Página pública y puerta de entrada: explica la app a quien llega sin sesión (y a los buscadores) y lleva al login.
 * Sin cuenta no se usa la app, así los datos están en la nube desde el primer día.
 */
export function LoginPage({ offline, onRetry }: { offline: boolean; onRetry: () => void }) {
  return (
    <main className="mx-auto w-full max-w-lg space-y-8 px-4 py-8">
      <SystemWindow title="Macro Quest">
        <h1 className="font-display text-3xl leading-tight font-bold">Cuenta calorías y macros como si fuera una partida</h1>
        <p className="text-muted-foreground mt-2 text-sm">
          Diario de comidas gratuito y en español: registra lo que comes, sigue tu peso, cumple misiones diarias y sube de nivel mientras
          llegas a tu objetivo.
        </p>
        <div className="mt-5">
          <Access offline={offline} onRetry={onRetry} />
        </div>
      </SystemWindow>

      <Section title="Qué hace">
        <ul className="space-y-3">
          {FEATURES.map(({ icon: Icon, title, text }) => (
            <li key={title} className="system-window flex gap-3 p-4">
              <Icon className="text-primary mt-0.5 h-5 w-5 shrink-0" aria-hidden />
              <div>
                <h3 className="font-semibold">{title}</h3>
                <p className="text-muted-foreground mt-1 text-sm">{text}</p>
              </div>
            </li>
          ))}
        </ul>
      </Section>

      <Section title="Cómo empezar">
        <ol className="system-window space-y-3 p-4 text-sm">
          {STEPS.map((step, i) => (
            <li key={step} className="flex gap-3">
              <span className="border-primary/60 bg-primary/10 font-display flex h-6 w-6 shrink-0 items-center justify-center border text-xs font-bold">
                {i + 1}
              </span>
              <span>{step}</span>
            </li>
          ))}
        </ol>
      </Section>

      <Section title="Guías">
        <ul className="space-y-2">
          {GUIDES.map((g) => (
            <li key={g.href}>
              <a href={g.href} className="system-window flex min-h-12 items-center gap-3 p-4">
                <BookOpen className="text-primary h-5 w-5 shrink-0" aria-hidden />
                <span>
                  <span className="block font-semibold">{g.title}</span>
                  <span className="text-muted-foreground block text-sm">{g.text}</span>
                </span>
              </a>
            </li>
          ))}
        </ul>
      </Section>

      <SystemWindow scan={false}>
        <Access offline={offline} onRetry={onRetry} />
        <p className="text-muted-foreground mt-4 text-[11px]">
          Se guardan tu nombre, tu correo y una copia de tu diario, para que lo tengas en todos tus dispositivos y no se pierda. Puedes borrarlo
          todo cuando quieras desde Perfil.
        </p>
      </SystemWindow>

      <footer className="text-muted-foreground text-center text-[11px]">
        {GUIDES.map((g) => (
          <span key={g.href}>
            <a className="underline" href={g.href}>
              {g.title}
            </a>
            {" · "}
          </span>
        ))}
        <a className="underline" href="/privacidad">
          Privacidad
        </a>
        {" · "}
        <a className="underline" href="/condiciones">
          Condiciones
        </a>
        <p className="mt-2">Datos nutricionales de Open Food Facts (licencia ODbL).</p>
      </footer>
    </main>
  );
}

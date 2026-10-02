import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { toast } from "sonner";
import App from "./App";
import "./styles.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// Service worker: solo en producción (en desarrollo estorbaría a la recarga en caliente).
if (import.meta.env.PROD && "serviceWorker" in navigator) {
  // Si ya había una versión controlando la página, un cambio de controlador es una actualización.
  const hadController = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (!hadController) return;
    toast.info("Hay una versión nueva de Macro Quest", {
      id: "sw-update",
      duration: Infinity,
      action: { label: "Actualizar", onClick: () => location.reload() },
    });
  });
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch((e) => console.error("Service worker", e));
  });
}

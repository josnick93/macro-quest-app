import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { backupDue, daysSince, lastBackup, lastNag, markNag } from "@/lib/backup";
import { useAccount, useGame } from "@/lib/hooks";

/** Sin cuenta los datos viven solo en el dispositivo: recuerda exportar una copia de vez en cuando. Con cuenta ya hay copia en la nube. */
export function BackupReminder() {
  const { data: game, isFetched } = useGame();
  const navigate = useNavigate();
  const account = useAccount();
  const activeDays = game.activeDays.length;

  useEffect(() => {
    if (!isFetched || account) return;
    const now = Date.now();
    const last = lastBackup();
    if (!backupDue(last, lastNag(), activeDays, now)) return;
    markNag();
    const days = daysSince(last, now);
    toast.info(days === null ? "Aún no has hecho ninguna copia de tus datos" : `Hace ${days} días de tu última copia`, {
      description: "Tus datos están solo en este dispositivo.",
      duration: 10_000,
      action: { label: "Exportar", onClick: () => navigate("/perfil#datos") },
    });
  }, [isFetched, activeDays, navigate, account]);

  return null;
}

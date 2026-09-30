import { useEffect, useRef, useState } from "react";
import { useNote, useSaveNote } from "@/lib/hooks";

/** Nota libre del día. Se guarda sola (al dejar de escribir y al salir). Montar con key={date}. */
export function DayNote({ date }: { date: string }) {
  const { data, isFetched } = useNote(date);
  const save = useSaveNote();
  const [text, setText] = useState("");
  const dirty = useRef(false);
  const latest = useRef(text);
  latest.current = text;
  const saveRef = useRef(save.mutate);
  saveRef.current = save.mutate;

  useEffect(() => {
    if (isFetched && !dirty.current) setText(data?.text ?? "");
  }, [isFetched, data]);

  useEffect(() => {
    if (!dirty.current) return;
    const t = setTimeout(() => {
      dirty.current = false;
      saveRef.current({ date, text: latest.current });
    }, 800);
    return () => clearTimeout(t);
  }, [text, date]);

  // Guardar lo pendiente al cambiar de día o de pantalla
  useEffect(
    () => () => {
      if (dirty.current) saveRef.current({ date, text: latest.current });
    },
    [date],
  );

  return (
    <textarea
      className="field min-h-20 resize-y text-sm"
      placeholder="Cómo te has sentido, entreno, comida fuera…"
      aria-label="Nota del día"
      value={text}
      onChange={(e) => {
        dirty.current = true;
        setText(e.target.value);
      }}
    />
  );
}

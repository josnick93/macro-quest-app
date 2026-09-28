import { useEffect, useRef, useState } from "react";
import { Camera, Flashlight, Loader2 } from "lucide-react";
import { BarcodeDetector, prepareZXingModule } from "barcode-detector/ponyfill";
import wasmUrl from "zxing-wasm/reader/zxing_reader.wasm?url";
import { Sheet } from "./Sheet";

// WASM servido desde nuestro propio dominio (sin CDN externo, funciona offline).
prepareZXingModule({
  overrides: { locateFile: (path: string, prefix: string) => (path.endsWith(".wasm") ? wasmUrl : prefix + path) },
});

const detector = new BarcodeDetector({ formats: ["ean_13", "ean_8", "upc_a", "upc_e"] });

interface Props {
  onDetected: (code: string) => void;
  onClose: () => void;
}

export function BarcodeScanner({ onDetected, onClose }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const trackRef = useRef<MediaStreamTrack | null>(null);
  const cbRef = useRef(onDetected);
  cbRef.current = onDetected;
  const done = useRef(false);

  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [torch, setTorch] = useState<boolean | null>(null);
  const [busyPhoto, setBusyPhoto] = useState(false);
  const [manual, setManual] = useState("");

  const finish = (code: string) => {
    if (done.current) return;
    done.current = true;
    navigator.vibrate?.(60);
    cbRef.current(code);
  };

  useEffect(() => {
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let stream: MediaStream | null = null;
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d", { willReadFrequently: true });

    const tick = async () => {
      if (stopped || done.current) return;
      const v = videoRef.current;
      if (v && ctx && v.readyState >= 2 && v.videoWidth) {
        // Solo analizamos la franja central: más rápido y más preciso.
        const sw = v.videoWidth * 0.9;
        const sh = v.videoHeight * 0.5;
        canvas.width = sw;
        canvas.height = sh;
        ctx.drawImage(v, (v.videoWidth - sw) / 2, (v.videoHeight - sh) / 2, sw, sh, 0, 0, sw, sh);
        try {
          const codes = await detector.detect(canvas);
          const hit = codes.find((c) => /^\d{8,14}$/.test(c.rawValue));
          if (hit) return finish(hit.rawValue);
        } catch {
          /* frame ilegible, seguimos */
        }
      }
      timer = setTimeout(tick, 100);
    };

    (async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setError("La cámara en directo necesita HTTPS. Usa «Hacer foto» o escribe el código.");
        return;
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: { facingMode: { ideal: "environment" }, width: { ideal: 1920 }, height: { ideal: 1080 } },
        });
        if (stopped) return stream.getTracks().forEach((t) => t.stop());
        const track = stream.getVideoTracks()[0] ?? null;
        trackRef.current = track;
        const caps = (track?.getCapabilities?.() ?? {}) as MediaTrackCapabilities & { focusMode?: string[]; torch?: boolean };
        if (caps.focusMode?.includes("continuous")) {
          track?.applyConstraints({ advanced: [{ focusMode: "continuous" } as MediaTrackConstraintSet] }).catch(() => {});
        }
        if (caps.torch) setTorch(false);
        const v = videoRef.current!;
        v.srcObject = stream;
        await v.play();
        setReady(true);
        tick();
      } catch (e) {
        const name = e instanceof DOMException ? e.name : "";
        setError(
          name === "NotAllowedError"
            ? "Permiso de cámara denegado. Actívalo en Ajustes del navegador o usa «Hacer foto»."
            : `No se pudo abrir la cámara (${e instanceof Error ? e.message : String(e)}). Usa «Hacer foto».`,
        );
      }
    })();

    return () => {
      stopped = true;
      clearTimeout(timer);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const toggleTorch = async () => {
    const next = !torch;
    try {
      await trackRef.current?.applyConstraints({ advanced: [{ torch: next } as MediaTrackConstraintSet] });
      setTorch(next);
    } catch {
      setTorch(null);
    }
  };

  const onPhoto = async (file: File) => {
    setBusyPhoto(true);
    try {
      const codes = await detector.detect(file);
      const hit = codes.find((c) => /^\d{8,14}$/.test(c.rawValue));
      if (hit) finish(hit.rawValue);
      else setError("No se ha encontrado código en la foto. Hazla más cerca, recta y con buena luz.");
    } catch {
      setError("No se pudo leer la foto.");
    } finally {
      setBusyPhoto(false);
    }
  };

  return (
    <Sheet title="Escanear código" onClose={onClose}>
      <div className="relative aspect-[4/3] overflow-hidden border border-[var(--border)] bg-black">
        <video ref={videoRef} className="h-full w-full object-cover" playsInline muted autoPlay />
        {ready && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="border-primary relative h-1/2 w-[90%] border-2 shadow-[0_0_0_9999px_rgba(0,0,0,0.45)]">
              <div className="bg-destructive/80 absolute top-1/2 right-2 left-2 h-0.5" />
            </div>
          </div>
        )}
        {!ready && !error && (
          <div className="text-muted-foreground absolute inset-0 flex items-center justify-center text-sm">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Abriendo cámara…
          </div>
        )}
        {torch !== null && (
          <button
            type="button"
            onClick={toggleTorch}
            aria-label="Linterna"
            className={`absolute right-2 bottom-2 flex h-10 w-10 items-center justify-center border ${torch ? "border-primary bg-primary/30" : "border-white/30 bg-black/50"}`}
          >
            <Flashlight className="h-5 w-5" />
          </button>
        )}
      </div>

      <p className="text-muted-foreground mt-2 text-center text-[11px]">Centra el código en el recuadro, a unos 10–15 cm</p>
      {error && <p className="text-destructive mt-2 text-sm">{error}</p>}

      <label className="btn-ghost mt-3 w-full cursor-pointer">
        {busyPhoto ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />} Hacer foto
        <input
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            if (f) onPhoto(f);
          }}
        />
      </label>

      <form
        className="mt-3 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (manual.trim().length >= 6) finish(manual.trim());
        }}
      >
        <input
          className="field"
          inputMode="numeric"
          placeholder="O escribe el código"
          value={manual}
          onChange={(e) => setManual(e.target.value.replace(/\D/g, ""))}
        />
        <button className="btn-ghost shrink-0" type="submit">
          Buscar
        </button>
      </form>
    </Sheet>
  );
}

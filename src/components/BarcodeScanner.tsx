import { useEffect, useRef, useState } from "react";
import { Html5Qrcode, Html5QrcodeSupportedFormats } from "html5-qrcode";
import { Sheet } from "./Sheet";

const FORMATS = [
  Html5QrcodeSupportedFormats.EAN_13,
  Html5QrcodeSupportedFormats.EAN_8,
  Html5QrcodeSupportedFormats.UPC_A,
  Html5QrcodeSupportedFormats.UPC_E,
];

export function BarcodeScanner({ onDetected, onClose }: { onDetected: (code: string) => void; onClose: () => void }) {
  const [error, setError] = useState<string | null>(null);
  const [manual, setManual] = useState("");
  const done = useRef(false);

  useEffect(() => {
    // useBarCodeDetectorIfSupported taps into the native BarcodeDetector API on Android/Chrome,
    // far more reliable than the JS decoder for 1D barcodes on phone cameras.
    const scanner = new Html5Qrcode("barcode-reader", {
      formatsToSupport: FORMATS,
      useBarCodeDetectorIfSupported: true,
      verbose: false,
    });
    let running = false;
    scanner
      .start(
        { facingMode: "environment" },
        {
          fps: 10,
          // wide/short box matched to viewfinder size works better for EAN/UPC than a fixed 260x130 box
          qrbox: (viewfinderWidth, viewfinderHeight) => {
            const width = Math.floor(Math.min(viewfinderWidth, viewfinderHeight) * 0.9);
            return { width, height: Math.floor(width * 0.5) };
          },
          disableFlip: true,
          // no explicit aspectRatio: applying it post-stream via applyConstraints throws
          // OverconstrainedError on iOS Safari and silently kills the whole scan session.
          videoConstraints: {
            facingMode: "environment",
            width: { ideal: 1920 },
            height: { ideal: 1080 },
            advanced: [{ focusMode: "continuous" } as MediaTrackConstraintSet],
          },
        },
        (code) => {
          if (done.current) return;
          done.current = true;
          navigator.vibrate?.(60);
          onDetected(code);
        },
        () => {},
      )
      .then(() => {
        running = true;
      })
      .catch((e: unknown) => {
        setError(
          `No se pudo abrir la cámara. Comprueba el permiso y que la web se abre por HTTPS. (${
            e instanceof Error ? e.message : String(e)
          })`,
        );
      });
    return () => {
      if (running) scanner.stop().then(() => scanner.clear()).catch(() => {});
    };
  }, [onDetected]);

  return (
    <Sheet title="Escanear código" onClose={onClose}>
      <div id="barcode-reader" className="overflow-hidden border border-[var(--border)]" />
      {error && <p className="text-destructive mt-3 text-sm">{error}</p>}
      <form
        className="mt-4 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (manual.trim().length >= 6) onDetected(manual.trim());
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

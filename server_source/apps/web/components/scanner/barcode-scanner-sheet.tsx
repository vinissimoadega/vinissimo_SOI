"use client";

import { useEffect, useRef, useState } from "react";

type BarcodeScanSource = "native" | "fallback" | "manual";

type BarcodeScannerSheetProps = {
  isOpen: boolean;
  onClose: () => void;
  onDetected: (payload: { sku: string; source: BarcodeScanSource }) => Promise<void> | void;
  title?: string;
  description?: string;
};

type NativeBarcodeFormat = "ean_13" | "ean_8" | "upc_a" | "upc_e" | "code_128";

type NativeBarcodeDetectorCtor = {
  new (options?: { formats?: NativeBarcodeFormat[] }): {
    detect(source: ImageBitmapSource): Promise<Array<{ rawValue?: string }>>;
  };
  getSupportedFormats?: () => Promise<string[]>;
};

declare global {
  interface Window {
    BarcodeDetector?: NativeBarcodeDetectorCtor;
  }
}

const DESIRED_FORMATS: NativeBarcodeFormat[] = [
  "ean_13",
  "ean_8",
  "upc_a",
  "upc_e",
  "code_128",
];

function normalizeScannedSku(value: string) {
  return value.trim().replace(/\s+/g, "").toUpperCase();
}

function mapScannerError(error: unknown) {
  const name =
    error instanceof DOMException
      ? error.name
      : error instanceof Error
        ? error.name
        : "";

  if (name === "NotAllowedError" || name === "PermissionDeniedError") {
    return "A câmera foi bloqueada. Permita o acesso no navegador ou digite o SKU manualmente.";
  }

  if (name === "NotFoundError" || name === "OverconstrainedError") {
    return "Não consegui acessar a câmera traseira. Tente novamente ou digite o SKU manualmente.";
  }

  if (name === "NotReadableError") {
    return "A câmera já está em uso por outro aplicativo. Feche o uso anterior e tente novamente.";
  }

  return "Não foi possível iniciar a leitura pela câmera. Você ainda pode tentar novamente ou digitar o SKU manualmente.";
}

export function BarcodeScannerSheet({
  isOpen,
  onClose,
  onDetected,
  title = "Ler código pela câmera",
  description = "Aponte a câmera para o código de barras do produto.",
}: BarcodeScannerSheetProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const nativeDetectorRef = useRef<InstanceType<NativeBarcodeDetectorCtor> | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fallbackControlsRef = useRef<{ stop: () => void } | null>(null);
  const reportedRef = useRef(false);
  const [statusText, setStatusText] = useState(
    "Aguardando abertura da câmera traseira...",
  );
  const [error, setError] = useState<string | null>(null);
  const [strategy, setStrategy] = useState<BarcodeScanSource | null>(null);
  const [manualSku, setManualSku] = useState("");
  const [isSubmittingManual, setIsSubmittingManual] = useState(false);

  function stopTracks() {
    const videoStream =
      videoRef.current?.srcObject instanceof MediaStream
        ? videoRef.current.srcObject
        : null;
    const activeStream = streamRef.current ?? videoStream;

    if (activeStream) {
      for (const track of activeStream.getTracks()) {
        track.stop();
      }
      streamRef.current = null;
    }
  }

  function cleanupScanner() {
    if (rafRef.current !== null) {
      window.cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }

    if (fallbackControlsRef.current) {
      try {
        fallbackControlsRef.current.stop();
      } catch {}
      fallbackControlsRef.current = null;
    }

    stopTracks();

    const video = videoRef.current;
    if (video) {
      video.pause();
      video.srcObject = null;
    }
  }

  async function finalizeDetection(rawValue: string, source: BarcodeScanSource) {
    const normalized = normalizeScannedSku(rawValue);

    if (!normalized || reportedRef.current) {
      return;
    }

    reportedRef.current = true;
    setError(null);
    setStrategy(source);
    setStatusText("Código lido com sucesso. Encaminhando...");
    cleanupScanner();

    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      try {
        navigator.vibrate?.(70);
      } catch {}
    }

    await onDetected({ sku: normalized, source });
    onClose();
  }

  async function startNativeScanner(DetectorCtor: NativeBarcodeDetectorCtor) {
    const video = videoRef.current;

    if (!video || !navigator.mediaDevices?.getUserMedia) {
      throw new Error("camera_unavailable");
    }

    const stream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: {
        facingMode: { ideal: "environment" },
        width: { ideal: 1280 },
        height: { ideal: 720 },
      },
    });

    streamRef.current = stream;
    video.srcObject = stream;
    video.muted = true;
    video.setAttribute("playsinline", "true");
    await video.play();

    nativeDetectorRef.current = new DetectorCtor({ formats: DESIRED_FORMATS });
    setStrategy("native");
    setStatusText("Procurando código pela câmera traseira...");

    const tick = async () => {
      if (!videoRef.current || reportedRef.current) {
        return;
      }

      try {
        const detections = await nativeDetectorRef.current?.detect(videoRef.current);
        const rawValue = detections?.find((item) => item.rawValue)?.rawValue;

        if (rawValue) {
          await finalizeDetection(rawValue, "native");
          return;
        }
      } catch (nativeError) {
        setError(mapScannerError(nativeError));
      }

      rafRef.current = window.requestAnimationFrame(() => {
        void tick();
      });
    };

    void tick();
  }

  async function startFallbackScanner() {
    const video = videoRef.current;

    if (!video) {
      throw new Error("camera_unavailable");
    }

    const browserPackage = await import("@zxing/browser");
    const libraryPackage = await import("@zxing/library");
    const hints = new Map();
    hints.set(libraryPackage.DecodeHintType.POSSIBLE_FORMATS, [
      libraryPackage.BarcodeFormat.EAN_13,
      libraryPackage.BarcodeFormat.EAN_8,
      libraryPackage.BarcodeFormat.UPC_A,
      libraryPackage.BarcodeFormat.UPC_E,
      libraryPackage.BarcodeFormat.CODE_128,
    ]);

    const reader = new browserPackage.BrowserMultiFormatReader(hints);

    setStrategy("fallback");
    setStatusText("Usando modo compatível para procurar o código...");

    const controls = await reader.decodeFromConstraints(
      {
        audio: false,
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      },
      video,
      (result: { getText: () => string } | undefined, fallbackError: unknown) => {
        if (result?.getText()) {
          void finalizeDetection(result.getText(), "fallback");
          return;
        }

        const errorName =
          fallbackError instanceof Error ? fallbackError.name : "";

        if (
          errorName &&
          errorName !== "NotFoundException" &&
          errorName !== "ChecksumException" &&
          errorName !== "FormatException"
        ) {
          setError(mapScannerError(fallbackError));
        }
      },
    );

    fallbackControlsRef.current = controls as { stop: () => void };
  }

  async function canUseNativeDetector() {
    const DetectorCtor = window.BarcodeDetector;

    if (!DetectorCtor) {
      return null;
    }

    if (typeof DetectorCtor.getSupportedFormats === "function") {
      try {
        const supportedFormats = await DetectorCtor.getSupportedFormats();
        const hasRelevantFormat = DESIRED_FORMATS.some((format) =>
          supportedFormats.includes(format),
        );

        if (!hasRelevantFormat) {
          return null;
        }
      } catch {
        return null;
      }
    }

    return DetectorCtor;
  }

  async function startScanner(preferredMode: "auto" | "fallback" = "auto") {
    cleanupScanner();
    reportedRef.current = false;
    setError(null);
    setStatusText("Abrindo câmera...");
    setStrategy(null);

    try {
      if (
        preferredMode === "auto" &&
        typeof window !== "undefined" &&
        typeof navigator !== "undefined" &&
        typeof navigator.mediaDevices?.getUserMedia === "function"
      ) {
        const DetectorCtor = await canUseNativeDetector();

        if (DetectorCtor) {
          try {
            await startNativeScanner(DetectorCtor);
            return;
          } catch (nativeError) {
            setError(mapScannerError(nativeError));
          }
        }
      }

      await startFallbackScanner();
    } catch (scannerError) {
      setStrategy("manual");
      setError(mapScannerError(scannerError));
      setStatusText("Faça a leitura manual do SKU.");
    }
  }

  useEffect(() => {
    if (!isOpen) {
      cleanupScanner();
      reportedRef.current = false;
      setManualSku("");
      setError(null);
      setStrategy(null);
      setStatusText("Aguardando abertura da câmera traseira...");
      return;
    }

    void startScanner();

    return () => {
      cleanupScanner();
    };
  }, [isOpen]);

  async function handleManualSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalized = normalizeScannedSku(manualSku);

    if (!normalized) {
      setError("Digite um SKU válido para continuar manualmente.");
      return;
    }

    setIsSubmittingManual(true);
    setError(null);

    try {
      await finalizeDetection(normalized, "manual");
    } finally {
      setIsSubmittingManual(false);
    }
  }

  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[90] flex items-end justify-center bg-black/70 p-3 sm:items-center sm:p-6">
      <div className="surface w-full max-w-lg overflow-hidden rounded-[28px]">
        <div className="flex items-start justify-between gap-4 border-b border-black/5 px-4 py-4 sm:px-5">
          <div>
            <p className="text-sm font-semibold text-vinho-950">{title}</p>
            <p className="mt-1 text-sm text-black/55">{description}</p>
          </div>
          <button className="btn-secondary shrink-0 px-3" onClick={onClose} type="button">
            Fechar
          </button>
        </div>

        <div className="space-y-4 px-4 py-4 sm:px-5">
          <div className="overflow-hidden rounded-[24px] border border-black/10 bg-black">
            <div className="relative aspect-[3/4] w-full bg-black">
              <video
                ref={videoRef}
                autoPlay
                className="h-full w-full object-cover"
                muted
                playsInline
              />
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                <div className="h-[58%] w-[78%] rounded-[28px] border-2 border-white/80 shadow-[0_0_0_999px_rgba(0,0,0,0.18)]" />
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-black/10 bg-vinho-50 px-4 py-3 text-sm text-black/65">
            <p className="font-semibold text-vinho-950">
              {statusText}
            </p>
            <p className="mt-1 text-xs uppercase tracking-wide text-black/45">
              {strategy === "native"
                ? "Leitura nativa"
                : strategy === "fallback"
                  ? "Modo compatível"
                  : "Você pode alternar para digitação manual a qualquer momento"}
            </p>
            {error ? <p className="mt-2 text-sm text-red-700">{error}</p> : null}
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            <button className="btn-secondary" onClick={() => void startScanner()} type="button">
              Tentar novamente
            </button>
            <button
              className="btn-secondary"
              onClick={() => void startScanner("fallback")}
              type="button"
            >
              Usar modo compatível
            </button>
          </div>

          <form className="space-y-3 rounded-2xl border border-black/10 bg-white px-4 py-4" onSubmit={handleManualSubmit}>
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-black/45">
                Digitar SKU manualmente
              </label>
              <input
                className="input-soft w-full"
                inputMode="text"
                placeholder="Ex.: 7891234567890"
                value={manualSku}
                onChange={(event) => setManualSku(event.target.value)}
              />
            </div>
            <button className="btn-primary w-full sm:w-auto" disabled={isSubmittingManual} type="submit">
              {isSubmittingManual ? "Validando..." : "Usar SKU digitado"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

"use client";

import { useDeferredValue, useId, useMemo, useState } from "react";
import QRCode from "qrcode";
import {
  Check,
  Download,
  FileCode,
  Link2,
  Palette,
  QrCode,
  RotateCcw,
  SlidersHorizontal,
  TriangleAlert,
} from "lucide-react";
import { TIP_JAR_URL } from "@/lib/site";

type ErrorCorrection = "L" | "M" | "Q" | "H";

type Matrix = { size: number; data: Uint8Array };

/** Standard quiet zone (blank border) required by ISO/IEC 18004, in modules. */
const QUIET_ZONE = 4;

const DEFAULT_FG = "#000000";
const DEFAULT_BG = "#ffffff";
const DEFAULT_SIZE = 2048;

const PNG_SIZES = [
  { value: 512, label: "512 px — Web & email" },
  { value: 1024, label: "1024 px — Documents" },
  { value: 2048, label: "2048 px — Print (best)" },
] as const;

const ERROR_LEVELS: { value: ErrorCorrection; label: string; hint: string }[] = [
  { value: "L", label: "L", hint: "Low · 7% recovery · holds the most data" },
  { value: "M", label: "M", hint: "Medium · 15% recovery · best for most uses" },
  { value: "Q", label: "Q", hint: "Quartile · 25% recovery · good for print" },
  { value: "H", label: "H", hint: "High · 30% recovery · most damage-resistant" },
];

const HEX_PATTERN = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i;

function normalizeHex(input: string): string | null {
  const value = input.trim();
  if (!HEX_PATTERN.test(value)) return null;
  let hex = value.replace("#", "").toLowerCase();
  if (hex.length === 3) hex = hex.split("").map((c) => c + c).join("");
  return `#${hex}`;
}

function relativeLuminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/** True for input like "example.com/menu" that phones would treat as plain text. */
function looksLikeBareDomain(text: string): boolean {
  const value = text.trim();
  if (/^[a-z][a-z0-9+.-]*:/i.test(value)) return false;
  return /^[^\s@/]+\.[a-z]{2,}(?:[/?#]\S*)?$/i.test(value);
}

function buildMatrix(
  text: string,
  level: ErrorCorrection,
): { matrix: Matrix | null; error: string | null } {
  if (!text) return { matrix: null, error: null };
  try {
    const { modules } = QRCode.create(text, { errorCorrectionLevel: level });
    return { matrix: { size: modules.size, data: modules.data }, error: null };
  } catch {
    return {
      matrix: null,
      error:
        "This content is too long to fit in a QR code at the selected error-correction level. Shorten it or choose level L, which holds the most data.",
    };
  }
}

/** Calls `draw` once per horizontal run of dark modules. */
function forEachDarkRun(
  matrix: Matrix,
  draw: (x: number, y: number, length: number) => void,
) {
  const { size, data } = matrix;
  for (let y = 0; y < size; y++) {
    let x = 0;
    while (x < size) {
      if (!data[y * size + x]) {
        x++;
        continue;
      }
      const start = x;
      while (x < size && data[y * size + x]) x++;
      draw(start, y, x - start);
    }
  }
}

function matrixToPath(matrix: Matrix): string {
  let path = "";
  forEachDarkRun(matrix, (x, y, length) => {
    path += `M${x + QUIET_ZONE} ${y + QUIET_ZONE}h${length}v1h-${length}z`;
  });
  return path;
}

function buildSvgMarkup(
  matrix: Matrix,
  fg: string,
  bg: string,
  pixelSize: number,
): string {
  const dimension = matrix.size + QUIET_ZONE * 2;
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${pixelSize}" height="${pixelSize}" viewBox="0 0 ${dimension} ${dimension}" shape-rendering="crispEdges">`,
    `<rect width="${dimension}" height="${dimension}" fill="${bg}"/>`,
    `<path fill="${fg}" d="${matrixToPath(matrix)}"/>`,
    `</svg>`,
  ].join("");
}

/**
 * Renders the matrix onto a canvas of exactly `pixelSize` × `pixelSize`.
 * Module edges are snapped to whole pixels, so the output has no blurry
 * anti-aliased seams regardless of the chosen size.
 */
function renderPng(
  matrix: Matrix,
  fg: string,
  bg: string,
  pixelSize: number,
): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = pixelSize;
  canvas.height = pixelSize;
  const ctx = canvas.getContext("2d");
  if (!ctx) return Promise.reject(new Error("Canvas is not supported."));

  const dimension = matrix.size + QUIET_ZONE * 2;
  const edge = (i: number) => Math.round((i * pixelSize) / dimension);

  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, pixelSize, pixelSize);
  ctx.fillStyle = fg;
  forEachDarkRun(matrix, (x, y, length) => {
    const x0 = edge(x + QUIET_ZONE);
    const x1 = edge(x + length + QUIET_ZONE);
    const y0 = edge(y + QUIET_ZONE);
    const y1 = edge(y + 1 + QUIET_ZONE);
    ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
  });

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("PNG export failed."))),
      "image/png",
    );
  });
}

function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Revoking immediately can cancel the download in some browsers.
  window.setTimeout(() => URL.revokeObjectURL(url), 2000);
}

/** "qr-code-example-com" for web links, "qr-code" for anything else (keeps Wi-Fi passwords etc. out of file names). */
function fileBaseName(text: string): string {
  if (/^https?:\/\//i.test(text)) {
    try {
      const host = new URL(text).hostname.replace(/^www\./, "");
      const slug = host.replace(/[^a-z0-9]+/gi, "-").replace(/^-+|-+$/g, "");
      if (slug) return `qr-code-${slug}`;
    } catch {
      // Invalid URL: fall through to the generic name.
    }
  }
  return "qr-code";
}

function ColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (hex: string) => void;
}) {
  const id = useId();
  // `draft` holds what the user is typing until it becomes a valid hex color.
  const [draft, setDraft] = useState<string | null>(null);
  const isInvalid = draft !== null && normalizeHex(draft) === null;

  return (
    <div>
      <label htmlFor={id} className="mb-2 block text-sm font-semibold text-slate-800">
        {label}
      </label>
      <div
        className={`flex items-center gap-3 rounded-xl border bg-white p-2 shadow-sm transition focus-within:ring-2 focus-within:ring-indigo-500/40 ${
          isInvalid ? "border-red-400" : "border-slate-300"
        }`}
      >
        <input
          type="color"
          aria-label={`${label} picker`}
          value={value}
          onChange={(e) => {
            setDraft(null);
            onChange(e.target.value);
          }}
          className="h-10 w-12 shrink-0 cursor-pointer rounded-lg border border-slate-200 bg-transparent p-0.5"
        />
        <input
          id={id}
          type="text"
          spellCheck={false}
          autoComplete="off"
          maxLength={7}
          value={draft ?? value}
          aria-invalid={isInvalid}
          onChange={(e) => {
            const next = e.target.value;
            setDraft(next);
            const hex = normalizeHex(next);
            if (hex) onChange(hex);
          }}
          onBlur={() => setDraft(null)}
          className="w-full min-w-0 bg-transparent font-mono text-base uppercase text-slate-900 outline-hidden"
        />
      </div>
    </div>
  );
}

export default function QrCodeGenerator() {
  const [text, setText] = useState("");
  const [fgColor, setFgColor] = useState(DEFAULT_FG);
  const [bgColor, setBgColor] = useState(DEFAULT_BG);
  const [level, setLevel] = useState<ErrorCorrection>("M");
  const [pngSize, setPngSize] = useState<number>(DEFAULT_SIZE);
  const [downloaded, setDownloaded] = useState<"png" | "svg" | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);

  const textId = useId();
  const sizeId = useId();
  const statusId = useId();

  // Keeps typing smooth on low-end phones: the QR re-encodes at lower priority.
  const deferredText = useDeferredValue(text);
  const { matrix, error } = useMemo(
    () => buildMatrix(deferredText, level),
    [deferredText, level],
  );
  const path = useMemo(() => (matrix ? matrixToPath(matrix) : ""), [matrix]);
  const dimension = matrix ? matrix.size + QUIET_ZONE * 2 : 0;

  const isInverted = relativeLuminance(fgColor) > relativeLuminance(bgColor);
  const isLowContrast = contrastRatio(fgColor, bgColor) < 3;
  const showSchemeHint = looksLikeBareDomain(text);
  const canDownload = matrix !== null && deferredText === text;
  const isDefaultStyle =
    fgColor === DEFAULT_FG && bgColor === DEFAULT_BG && level === "M" && pngSize === DEFAULT_SIZE;

  function flashDownloaded(kind: "png" | "svg") {
    setDownloaded(kind);
    window.setTimeout(() => setDownloaded((current) => (current === kind ? null : current)), 2000);
  }

  async function handleDownloadPng() {
    if (!matrix) return;
    setExportError(null);
    try {
      const blob = await renderPng(matrix, fgColor, bgColor, pngSize);
      saveBlob(blob, `${fileBaseName(text)}.png`);
      flashDownloaded("png");
    } catch {
      setExportError("Your browser could not create the PNG. Try the SVG download instead.");
    }
  }

  function handleDownloadSvg() {
    if (!matrix) return;
    setExportError(null);
    const svg = buildSvgMarkup(matrix, fgColor, bgColor, pngSize);
    saveBlob(new Blob([svg], { type: "image/svg+xml" }), `${fileBaseName(text)}.svg`);
    flashDownloaded("svg");
  }

  function resetStyle() {
    setFgColor(DEFAULT_FG);
    setBgColor(DEFAULT_BG);
    setLevel("M");
    setPngSize(DEFAULT_SIZE);
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,26rem)] lg:grid-rows-[auto_1fr] lg:gap-x-10">
      {/* ---------- Input (mobile: first) ---------- */}
      <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-8 lg:col-start-1 lg:row-start-1">
        <div>
          <label
            htmlFor={textId}
            className="mb-3 flex items-center gap-2 text-lg font-bold text-slate-900"
          >
            <Link2 className="size-5 text-indigo-600" aria-hidden="true" />
            Enter your website URL or text
          </label>
          <textarea
            id={textId}
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={4}
            spellCheck={false}
            autoCapitalize="off"
            autoCorrect="off"
            placeholder="https://your-website.com"
            aria-describedby={statusId}
            className="block w-full resize-y rounded-2xl border-2 border-slate-300 bg-slate-50 px-5 py-4 text-lg text-slate-900 placeholder:text-slate-400 transition outline-hidden focus:border-indigo-500 focus:bg-white focus:ring-4 focus:ring-indigo-500/15"
          />
          <div id={statusId} aria-live="polite" className="mt-2 space-y-2 text-sm">
            {error ? (
              <p className="flex items-start gap-2 rounded-lg bg-red-50 px-3 py-2 text-red-700">
                <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                {error}
              </p>
            ) : (
              <p className="text-slate-500">
                Works with links, plain text, email (mailto:), phone (tel:) and Wi-Fi details.
                Your text never leaves your device.
              </p>
            )}
            {showSchemeHint && (
              <p className="flex flex-wrap items-center gap-2 rounded-lg bg-indigo-50 px-3 py-2 text-indigo-900">
                <span>
                  Tip: add <code className="font-mono font-semibold">https://</code> so phones open
                  it as a link instead of plain text.
                </span>
                <button
                  type="button"
                  onClick={() => setText(`https://${text.trim()}`)}
                  className="rounded-md bg-indigo-600 px-2.5 py-1 text-xs font-semibold text-white transition hover:bg-indigo-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
                >
                  Add https://
                </button>
              </p>
            )}
          </div>
        </div>
      </div>

      {/* ---------- Preview, download & tip jar ---------- */}
      <div className="space-y-5 lg:sticky lg:top-24 lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:self-start">
        <div className="rounded-3xl border border-slate-200 bg-linear-to-b from-slate-50 to-white p-5 shadow-sm sm:p-6">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-lg font-bold text-slate-900">Live preview</h3>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
              <span className="size-1.5 rounded-full bg-emerald-500" aria-hidden="true" />
              Never expires
            </span>
          </div>

          <div className="mx-auto aspect-square w-full max-w-xs overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-inner">
            {matrix ? (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox={`0 0 ${dimension} ${dimension}`}
                shapeRendering="crispEdges"
                role="img"
                aria-label="QR code preview"
                className="block size-full"
              >
                <rect width={dimension} height={dimension} fill={bgColor} />
                <path fill={fgColor} d={path} />
              </svg>
            ) : (
              <div className="flex size-full flex-col items-center justify-center gap-3 p-6 text-center text-slate-400">
                <QrCode className="size-20 stroke-[1.25]" aria-hidden="true" />
                <p className="text-sm font-medium">
                  {error ? "Content too long" : "Your QR code will appear here as you type"}
                </p>
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={handleDownloadPng}
            disabled={!canDownload}
            className="mt-6 flex w-full items-center justify-center gap-3 rounded-2xl bg-linear-to-r from-indigo-600 to-blue-600 px-6 py-5 text-lg font-extrabold text-white transition hover:scale-[1.02] hover:from-indigo-500 hover:to-blue-500 focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-indigo-500 active:scale-[0.99] enabled:motion-safe:animate-glow-indigo disabled:cursor-not-allowed disabled:from-slate-300 disabled:to-slate-300 disabled:text-slate-500 disabled:hover:scale-100 sm:text-xl"
          >
            {downloaded === "png" ? (
              <Check className="size-6" aria-hidden="true" />
            ) : (
              <Download className="size-6" aria-hidden="true" />
            )}
            {downloaded === "png" ? "Downloaded!" : "Download High-Quality PNG"}
          </button>

          {exportError && (
            <p role="alert" className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
              {exportError}
            </p>
          )}
        </div>

        {/* ---------- Gratitude tip jar ---------- */}
        <aside
          aria-label="Support the creator"
          className="rounded-3xl border border-amber-200 bg-linear-to-br from-amber-50 via-orange-50 to-rose-50 p-6 text-center shadow-sm"
        >
          <p className="text-base leading-relaxed text-slate-700">
            Did you know most websites charge you $30/month and make your QR codes expire?{" "}
            <strong className="font-bold text-slate-900">
              Mine are 100% Free and NEVER expire!
            </strong>{" "}
            If this tool saved your business time and money today, please consider supporting the
            creator!
          </p>
          <a
            href={TIP_JAR_URL}
            target="_blank"
            rel="noopener noreferrer nofollow"
            className="mt-5 inline-flex items-center justify-center gap-2 rounded-full bg-linear-to-r from-amber-400 to-orange-400 px-7 py-3.5 text-base font-extrabold text-slate-900 transition hover:scale-105 hover:from-amber-300 hover:to-orange-300 focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-amber-500 motion-safe:animate-glow-amber"
          >
            <span aria-hidden="true">☕</span> Buy me a Coffee / Tip Jar
          </a>
        </aside>

        <button
          type="button"
          onClick={handleDownloadSvg}
          disabled={!canDownload}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-indigo-400 hover:text-indigo-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-slate-300 disabled:hover:text-slate-700"
        >
          {downloaded === "svg" ? (
            <Check className="size-4" aria-hidden="true" />
          ) : (
            <FileCode className="size-4" aria-hidden="true" />
          )}
          {downloaded === "svg" ? "Downloaded!" : "Download SVG (vector, for print)"}
        </button>
      </div>

      {/* ---------- Customization (mobile: after the download area) ---------- */}
      <div className="space-y-8 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-8 lg:col-start-1 lg:row-start-2 lg:self-start">
        <fieldset>
          <legend className="mb-3 flex items-center gap-2 text-lg font-bold text-slate-900">
            <Palette className="size-5 text-indigo-600" aria-hidden="true" />
            Colors
          </legend>
          <div className="grid gap-4 sm:grid-cols-2">
            <ColorField label="QR code color" value={fgColor} onChange={setFgColor} />
            <ColorField label="Background color" value={bgColor} onChange={setBgColor} />
          </div>
          {(isInverted || isLowContrast) && (
            <p
              role="status"
              className="mt-3 flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900"
            >
              <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              {isInverted
                ? "Light-on-dark QR codes can't be read by some scanner apps. For best results, make the QR code color darker than the background."
                : "Low contrast: this QR code may be hard to scan. Increase the difference between the two colors."}
            </p>
          )}
        </fieldset>

        <fieldset>
          <legend className="mb-3 flex items-center gap-2 text-lg font-bold text-slate-900">
            <SlidersHorizontal className="size-5 text-indigo-600" aria-hidden="true" />
            Quality options
          </legend>
          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <span className="mb-2 block text-sm font-semibold text-slate-800">
                Error correction
              </span>
              <div role="radiogroup" aria-label="Error correction level" className="grid grid-cols-4 gap-2">
                {ERROR_LEVELS.map((option) => (
                  <label
                    key={option.value}
                    title={option.hint}
                    className="cursor-pointer rounded-xl border border-slate-300 bg-white py-2.5 text-center font-semibold text-slate-700 transition hover:border-indigo-400 has-checked:border-indigo-600 has-checked:bg-indigo-600 has-checked:text-white has-focus-visible:ring-2 has-focus-visible:ring-indigo-500/50"
                  >
                    <input
                      type="radio"
                      name="error-correction"
                      value={option.value}
                      checked={level === option.value}
                      onChange={() => setLevel(option.value)}
                      className="sr-only"
                    />
                    {option.label}
                  </label>
                ))}
              </div>
              <p className="mt-2 text-xs text-slate-500">
                {ERROR_LEVELS.find((option) => option.value === level)?.hint}
              </p>
            </div>
            <div>
              <label htmlFor={sizeId} className="mb-2 block text-sm font-semibold text-slate-800">
                Download size
              </label>
              <select
                id={sizeId}
                value={pngSize}
                onChange={(e) => setPngSize(Number(e.target.value))}
                className="block w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-slate-900 shadow-sm outline-hidden focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/40"
              >
                {PNG_SIZES.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <p className="mt-2 text-xs text-slate-500">
                Need it bigger? The SVG file scales to any size without losing quality.
              </p>
            </div>
          </div>
          {!isDefaultStyle && (
            <button
              type="button"
              onClick={resetStyle}
              className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 transition hover:text-indigo-600"
            >
              <RotateCcw className="size-4" aria-hidden="true" />
              Reset colors & options
            </button>
          )}
        </fieldset>
      </div>
    </div>
  );
}

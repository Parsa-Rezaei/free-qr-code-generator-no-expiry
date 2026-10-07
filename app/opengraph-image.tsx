import { ImageResponse } from "next/og";
import QRCode from "qrcode";
import { SITE_NAME, SITE_URL } from "@/lib/site";

export const alt = `${SITE_NAME} – free static QR codes that never expire`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/** A real, scannable QR code that points to the site itself. */
function siteQrDataUri(): string {
  const { modules } = QRCode.create(SITE_URL, { errorCorrectionLevel: "M" });
  const dim = modules.size + 8;
  let path = "";
  for (let y = 0; y < modules.size; y++) {
    for (let x = 0; x < modules.size; x++) {
      if (modules.data[y * modules.size + x]) path += `M${x + 4} ${y + 4}h1v1h-1z`;
    }
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${dim} ${dim}" shape-rendering="crispEdges"><rect width="${dim}" height="${dim}" fill="#fff"/><path fill="#0f172a" d="${path}"/></svg>`;
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
}

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "72px 80px",
          background: "linear-gradient(135deg, #eef2ff 0%, #ffffff 55%, #eff6ff 100%)",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", maxWidth: 640 }}>
          <div
            style={{
              display: "flex",
              fontSize: 28,
              fontWeight: 700,
              color: "#4f46e5",
              marginBottom: 24,
            }}
          >
            {SITE_NAME}
          </div>
          <div
            style={{
              display: "flex",
              fontSize: 68,
              fontWeight: 800,
              lineHeight: 1.08,
              color: "#0f172a",
              letterSpacing: -1.5,
            }}
          >
            Free QR Codes That Never Expire
          </div>
          <div style={{ display: "flex", fontSize: 30, color: "#475569", marginTop: 28 }}>
            100% free · No sign-up · No watermark · Unlimited scans
          </div>
        </div>
        <div
          style={{
            display: "flex",
            padding: 20,
            background: "#ffffff",
            borderRadius: 32,
            boxShadow: "0 20px 50px rgba(79, 70, 229, 0.25)",
            border: "2px solid #e0e7ff",
          }}
        >
          <img src={siteQrDataUri()} width={340} height={340} alt="" />
        </div>
      </div>
    ),
    size,
  );
}

import { ImageResponse } from "next/og";

export const alt = "Rotapot: the AI treasurer for savings circles";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/** Share preview for links pasted into WhatsApp, Slack or Devpost. */
export default function OpengraphImage() {
  const seats = Array.from({ length: 6 }, (_, i) => -90 + i * 60);
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", background: "#24307a", color: "#fff", padding: "72px 80px", position: "relative", fontFamily: "sans-serif" }}>
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", maxWidth: 720 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16, fontSize: 40, fontWeight: 800 }}>
            <svg width="56" height="56" viewBox="0 0 32 32">
              <circle cx="16" cy="16" r="11" fill="none" stroke="#fff" strokeWidth="6" />
              <path d="M16 5 A11 11 0 0 1 26.4 12.6" fill="none" stroke="#f4b400" strokeWidth="6" />
              <circle cx="16" cy="16" r="3" fill="#fff" />
            </svg>
            rotapot
          </div>
          <div style={{ marginTop: 48, fontSize: 76, fontWeight: 800, lineHeight: 1.02, letterSpacing: "-0.04em" }}>The AI treasurer for savings circles.</div>
          <div style={{ marginTop: 32, fontSize: 30, lineHeight: 1.4, color: "rgba(255,255,255,0.82)" }}>
            Collects through PayPal, reminds kindly in each member&apos;s language, and only the treasurer releases the pot.
          </div>
        </div>
        <svg width="460" height="460" viewBox="0 0 320 320" style={{ position: "absolute", right: -60, bottom: -60 }}>
          <circle cx="160" cy="160" r="112" fill="none" stroke="#3a4796" strokeWidth="38" />
          {seats.map((c, i) => {
            const rad = (d: number) => (d * Math.PI) / 180;
            const p = (d: number) => `${160 + 112 * Math.cos(rad(d))} ${160 + 112 * Math.sin(rad(d))}`;
            return i < 4 ? <path key={i} d={`M ${p(c - 27)} A 112 112 0 0 1 ${p(c + 27)}`} stroke="#f4b400" strokeWidth="30" fill="none" /> : null;
          })}
        </svg>
      </div>
    ),
    size,
  );
}

import type { Member } from "@/lib/types";

/** Shared small pieces: logo, avatars, the shweshwe pattern, markdown-lite. */

export const COUNTRY: Record<string, { flag: string; code: string }> = {
  Harare: { flag: "🇿🇼", code: "ZW" },
  Bulawayo: { flag: "🇿🇼", code: "ZW" },
  Durban: { flag: "🇿🇦", code: "ZA" },
  Johannesburg: { flag: "🇿🇦", code: "ZA" },
  Pretoria: { flag: "🇿🇦", code: "ZA" },
  London: { flag: "🇬🇧", code: "UK" },
  Leicester: { flag: "🇬🇧", code: "UK" },
  Dublin: { flag: "🇮🇪", code: "IE" },
  Dallas: { flag: "🇺🇸", code: "US" },
  Soweto: { flag: "🇿🇦", code: "ZA" },
  Mahikeng: { flag: "🇿🇦", code: "ZA" },
};

export function countriesOf(cities: string[]) {
  const seen = new Map<string, string>();
  for (const c of cities) {
    const k = COUNTRY[c];
    if (k && !seen.has(k.code)) seen.set(k.code, k.flag);
  }
  return [...seen.values()];
}

/** Each member gets a stable hue drawn from the palette's warm/cool set. */
const AVATAR_TONES = ["#24307A", "#0E8A63", "#B4432F", "#8A5A00", "#5B3E96", "#1F6F8B"];

export function initials(name: string) {
  return name.split(" ").map((p) => p[0]).slice(0, 2).join("");
}

/** "2026-11-24" → "24 November 2026". Accepts a date-only ISO string; returns it unchanged if unparseable. */
export function longDate(iso?: string | null) {
  if (!iso) return "";
  const d = new Date(`${iso.slice(0, 10)}T12:00:00Z`);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
}

export function firstName(name: string) {
  return name.split(" ")[0];
}

export function toneFor(m: Pick<Member, "turn">) {
  return AVATAR_TONES[(m.turn - 1) % AVATAR_TONES.length];
}

export function Avatar({ member, size = 36 }: { member: Member; size?: number }) {
  return (
    <span className="avatar" style={{ width: size, height: size, background: toneFor(member), fontSize: size * 0.36 }} aria-hidden>
      {initials(member.name)}
    </span>
  );
}

/** Logo: a pot seen from above, one marker on its rim, mid-turn. */
export function LogoMark({ size = 30 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden>
      <circle cx="16" cy="16" r="11" fill="none" stroke="var(--indigo)" strokeWidth="6" />
      <path d="M16 5 A11 11 0 0 1 26.4 12.6" fill="none" stroke="var(--marigold)" strokeWidth="6" />
      <circle cx="16" cy="16" r="3" fill="var(--indigo)" />
    </svg>
  );
}

/** Shweshwe-style print: fine white geometry on indigo. */
export function ShweshweDefs({ id }: { id: string }) {
  return (
    <defs>
      <pattern id={id} width="12" height="12" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
        <rect width="12" height="12" fill="var(--indigo)" />
        <path d="M6 1.5 L10.5 6 L6 10.5 L1.5 6 Z" fill="none" stroke="rgba(255,255,255,0.55)" strokeWidth="0.7" />
        <circle cx="6" cy="6" r="1" fill="rgba(255,255,255,0.8)" />
        <circle cx="0" cy="0" r="0.8" fill="rgba(255,255,255,0.45)" />
        <circle cx="12" cy="12" r="0.8" fill="rgba(255,255,255,0.45)" />
      </pattern>
    </defs>
  );
}

/** Minimal, safe markdown: paragraphs, "- " bullets, **bold**, *italic*. No HTML. */
export function Markdown({ text }: { text: string }) {
  const blocks: React.ReactNode[] = [];
  let list: string[] = [];
  const flush = () => {
    if (list.length) {
      blocks.push(<ul key={`l${blocks.length}`}>{list.map((li, i) => <li key={i}>{inline(li)}</li>)}</ul>);
      list = [];
    }
  };
  for (const raw of text.split("\n")) {
    const line = raw.trimEnd();
    const bullet = line.match(/^\s*[-*•]\s+(.*)$/);
    if (bullet) { list.push(bullet[1]); continue; }
    flush();
    if (line.trim()) blocks.push(<p key={`p${blocks.length}`}>{inline(line)}</p>);
  }
  flush();
  return <>{blocks}</>;
}

function inline(s: string): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  const re = /\*\*(.+?)\*\*|\*(.+?)\*/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(s))) {
    if (m.index > last) out.push(s.slice(last, m.index));
    out.push(m[1] ? <strong key={m.index}>{m[1]}</strong> : <em key={m.index}>{m[2]}</em>);
    last = m.index + m[0].length;
  }
  if (last < s.length) out.push(s.slice(last));
  return out;
}

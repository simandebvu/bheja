"use client";
export default function CirclePreview({ names, amount, name, step = 0 }: { names: string[]; amount: string; name: string; step?: number }) {
  const count = Math.max(names.length, 1);
  return <aside className="circle-preview" aria-label="Your circle preview">
    <span className="eyebrow">A little each. A lot together.</span>
    <h2>{name || "Something good starts here."}</h2>
    <svg viewBox="0 0 360 360" role="img" aria-label={`${names.length} people, US$${Number(amount || 0) * names.length} monthly pot`}>
      <circle cx="180" cy="180" r="127" className="preview-track" />
      <circle cx="180" cy="180" r="102" className="preview-inner" />
      {Array.from({ length: count }, (_, index) => {
        const angle = -Math.PI / 2 + index * 2 * Math.PI / count;
        const x = 180 + 127 * Math.cos(angle), y = 180 + 127 * Math.sin(angle);
        const initials = names[index]?.trim().split(/\s+/).map((part) => part[0]).slice(0, 2).join("") || "+";
        return <g key={index} className={names[index] ? "preview-chair filled" : "preview-chair"}><circle cx={x} cy={y} r={count > 12 ? 16 : 23} /><text x={x} y={y + 5} textAnchor="middle">{initials}</text></g>;
      })}
      <text x="180" y="155" textAnchor="middle" className="preview-label">ONE SHARED POT</text>
      <text x="180" y="193" textAnchor="middle" className="preview-value">${(Number(amount || 0) * names.length).toLocaleString("en-US", { maximumFractionDigits: 2 })}</text>
      <text x="180" y="220" textAnchor="middle" className="preview-caption">USD · every month</text>
    </svg>
    <div className="preview-equation"><span>{names.length} {names.length === 1 ? "person" : "people"}</span><b>×</b><span>${Number(amount || 0)} each</span><b>=</b><span className="eq-long">more possibility</span><span className="eq-short">${(Number(amount || 0) * names.length).toLocaleString("en-US", { maximumFractionDigits: 2 })} pot each month</span></div>
    <p className="preview-story">{["Give it a name your people will be proud to belong to.", "Small, steady promises. One person gets the whole pot each month.", "Every chair has a name. Every person gets a turn.", "Clear rules. A fair rotation. Everyone starts on the same page."][step]}</p>
    <span className="preview-sandbox">PayPal sandbox · no real money moves</span>
  </aside>;
}

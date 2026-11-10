export function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!);
}
/** Shared transactional template. Never log delivery payloads or private links. */
export async function sendEmail(to: string, title: string, message: string, url: string, action: string, idempotencyKey?: string) {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM;
  if (!key || !from) throw new Error("Email delivery is not configured.");
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json", ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {}) },
    body: JSON.stringify({ from, to: [to], subject: title,
      text: `${title}\n\n${message}\n\n${action}:\n${url}\n\nKeep this link private. If you weren't expecting this, you can ignore it.\n\nRotapot · A little each. A lot together.`,
      html: `<html><body style="margin:0;background:#f4f5f9;font-family:Arial,sans-serif;color:#141a3a"><table role="presentation" style="max-width:560px;margin:40px auto;background:white;border-radius:24px;width:100%"><tr><td style="padding:36px"><p style="font-size:22px;font-weight:bold;color:#24307a">◉ rotapot</p><p style="color:#7a5300;font-size:12px;letter-spacing:2px">A LITTLE EACH. A LOT TOGETHER.</p><h1 style="font-size:28px;line-height:1.2">${escapeHtml(title)}</h1><p style="line-height:1.7;white-space:pre-line">${escapeHtml(message)}</p><p style="margin:32px 0"><a href="${escapeHtml(url)}" style="display:inline-block;background:#24307a;color:white;padding:16px 24px;border-radius:12px;text-decoration:none;font-weight:bold">${escapeHtml(action)} →</a></p><p style="font-size:12px;color:#6b7290;line-height:1.6">Keep this link private. If you weren't expecting this, you can ignore it.</p></td></tr></table></body></html>` }),
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw new Error("Email delivery failed. Please try again later.");
}
export async function sendAuthEmail(to: string, url: string, kind: "verify" | "reset") {
  await sendEmail(to, kind === "verify" ? "Your circle starts with you." : "Let's get you back in.",
    kind === "verify" ? "One quick step: confirm your email. Then give your circle a name, set your monthly promise, and invite your people.\nThis verification link expires in one hour." : "Choose a new password to get back to your people. This link expires in 30 minutes and works once.",
    url, kind === "verify" ? "Verify my email" : "Reset my password");
}

import Link from "next/link";
import { LogoMark } from "./ui";
import AuthForm from "./AuthForm";
import CirclePreview from "./CirclePreview";
import { googleEnabled } from "@/lib/google-enabled";
export default function AuthShell({ mode }: { mode: "signup" | "forgot" | "reset" }) {
  if (mode === "signup") return <main className="signup-page"><section className="signup-story"><Link href="/" className="brand light"><LogoMark size={34} /><span className="wordmark">rotapot</span></Link><span className="eyebrow">Built on something you already have. Trust.</span><h1>Your people.<br />Your promise.<br /><em>Your turn.</em></h1><p>A little from everyone becomes a big moment for someone. Give your stokvel, mukando or savings circle a home.</p><CirclePreview names={["You", "Your people", "Your people", "Your people", "Your people"]} name="" amount="50" step={2} /><ol className="signup-steps"><li><b>01</b> Make it yours</li><li><b>02</b> Bring your people</li><li><b>03</b> Let it go round</li></ol></section><section className="signup-form-side"><AuthForm mode="signup" googleEnabled={googleEnabled()} /><p className="signin-foot">Your account is real. Payments are sandbox.<br />No real money moves while you explore.</p></section></main>;
  return <main className="auth-page"><Link href="/" className="brand"><LogoMark size={34} /><span className="wordmark">rotapot</span></Link><AuthForm mode={mode} /><p className="signin-foot">Less chasing. More circle.</p></main>;
}

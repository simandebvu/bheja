import Link from "next/link";
import { LogoMark } from "../components/ui";

export const metadata = { title: "Privacy · Rotapot" };

/** Plain-language privacy notice. Required for the Google sign-in consent screen. */
export default function Privacy() {
  return (
    <main className="not-found">
      <div className="not-found-card" style={{ textAlign: "left", maxWidth: 640 }}>
        <LogoMark size={40} />
        <h1>Privacy</h1>
        <p>Rotapot is a hackathon prototype that runs on PayPal&apos;s sandbox. It moves no real money. Please don&apos;t put real financial or sensitive personal data into it.</p>
        <h2>What we keep</h2>
        <p>Your name and email address, a hashed password if you sign up with email, and the circles, members, contributions and messages you create. If you sign in with Google, we receive only your name, email address and profile picture. We never see your Google password.</p>
        <h2>How we use it</h2>
        <p>Only to run the app: to sign you in, to send invitation, verification and password-reset emails (through Resend), and to let the AI treasurer (Anthropic&apos;s Claude) summarise your circles and draft reminders. Payments run through the PayPal sandbox. We don&apos;t sell your data or use it for advertising.</p>
        <h2>Cookies</h2>
        <p>One session cookie keeps you signed in. There are no tracking or advertising cookies.</p>
        <h2>Deleting your data</h2>
        <p>Email <a href="mailto:info@simakk.co.za">info@simakk.co.za</a> and we&apos;ll delete your account and circles.</p>
        <Link className="primary-action" href="/">Back to Rotapot</Link>
      </div>
    </main>
  );
}

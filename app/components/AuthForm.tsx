"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { safeNext } from "@/lib/auth-navigation";
import { authClient } from "@/lib/auth-client";

type Mode = "login" | "signup" | "forgot" | "reset";
const headings: Record<Mode, string> = { login: "Sign in to Rotapot", signup: "Start your circle", forgot: "Forgot your password?", reset: "Choose a new password" };

const GoogleG = () => <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden><path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.9 6.1C12.4 13.6 17.7 9.5 24 9.5z"/><path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.5 5.8c4.4-4.1 7.1-10.1 7.1-17.5z"/><path fill="#FBBC05" d="M10.5 28.7c-.5-1.4-.8-3-.8-4.7s.3-3.2.8-4.7l-7.9-6.1C.9 16.4 0 20.1 0 24s.9 7.6 2.6 10.8l7.9-6.1z"/><path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.900-5.8l-7.500-5.8c-2.100 1.400-4.8 2.3-8.400 2.300-6.300 0-11.600-4.1-13.500-9.8l-7.900 6.1C6.500 42.600 14.600 48 24 48z"/></svg>;

export default function AuthForm({ mode = "login", googleEnabled = false }: { mode?: Mode; googleEnabled?: boolean }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [email, setEmail] = useState("");
  const [canResend, setCanResend] = useState(false);
  const [next, setNext] = useState("/circles");
  const callbackURL = `/?verified=1&next=${encodeURIComponent(next)}`;

  useEffect(() => {
    const query = new URLSearchParams(window.location.search);
    setNext(safeNext(query.get("next")));
    if (mode === "login" && query.has("verified")) setNotice("Email verified. You can now sign in.");
    if (query.has("oauth_error")) setError("Google sign-in didn't complete. Please try again or use your email.");
    else if (query.has("error")) setError(mode === "reset" ? "This reset link is invalid or expired. Request a new link below." : "This verification link is invalid or expired. Sign in to request another email.");
  }, [mode]);

  async function resend() {
    setBusy(true); setError("");
    try {
      const result = await authClient.sendVerificationEmail({ email, callbackURL });
      if (result.error) throw new Error(result.error.message || "Couldn't send the email.");
      setNotice("If this account needs verification, a new link is on its way. Check your inbox and spam folder.");
    } catch (err) { setError(err instanceof Error ? err.message : "Please try again."); }
    finally { setBusy(false); }
  }

  async function google() {
    setBusy(true); setError("");
    try {
      const dest = safeNext(next);
      const result = await authClient.signIn.social({ provider: "google", callbackURL: dest, newUserCallbackURL: dest, errorCallbackURL: `/?next=${encodeURIComponent(dest)}&oauth_error=1` });
      if (result?.error) throw new Error(result.error.message || "Couldn't start Google sign-in.");
    } catch (err) { setError(err instanceof Error ? err.message : "Couldn't start Google sign-in."); setBusy(false); }
  }

  if (mode === "signup" && notice && canResend) return <div className="signin-card inbox-card"><span className="inbox-symbol" aria-hidden>↗</span><span className="eyebrow">Your first invitation is to yourself</span><h2>Check your inbox.</h2><p>We sent a verification link to <strong>{email}</strong>. Open it and you&apos;ll be signed in, ready to {next.startsWith("/join/") ? "take your chair" : "start your circle"}.</p><p className="field-help">The link lasts one hour. Check spam if it hasn't arrived.</p>{error && <p role="alert" className="err">{error}</p>}<p role="status" className="auth-notice">{notice}</p><button className="primary-action" disabled={busy} onClick={resend}>{busy ? "Sending…" : "Send the link again"}</button><div className="auth-links"><Link href={`/?next=${encodeURIComponent(next)}`}>I've verified · sign in →</Link><button className="link-btn" onClick={() => { setNotice(""); setCanResend(false); }}>Use a different email</button></div></div>;

  return (
    <form className="signin-card" onSubmit={async (event) => {
      event.preventDefault();
      const form = new FormData(event.currentTarget);
      const password = String(form.get("password") || "");
      setError(""); setNotice(""); setBusy(true);
      try {
        if ((mode === "signup" || mode === "reset") && password !== form.get("confirm")) throw new Error("The passwords don't match.");
        if (mode === "login") {
          const result = await authClient.signIn.email({ email, password });
          if (result.error) {
            setCanResend(result.error.code === "EMAIL_NOT_VERIFIED");
            throw new Error(result.error.message || "Couldn't sign in.");
          }
          window.location.assign(next);
        } else if (mode === "signup") {
          let emailFailed = false;
          const result = await authClient.signUp.email(
            { name: String(form.get("name") || "").trim(), email, password, callbackURL },
            { onResponse: (ctx) => { emailFailed = ctx.response.headers.get("x-rotapot-email") === "failed"; } },
          );
          if (result.error) throw new Error(result.error.message || "Couldn't create your account.");
          setCanResend(true);
          setNotice("Check your email to verify your account, then sign in. Your link expires in one hour.");
          if (emailFailed) setError("Your account is ready, but the verification email didn't send. Wait a minute, then tap “Send the link again”.");
        } else if (mode === "forgot") {
          const result = await authClient.requestPasswordReset({ email, redirectTo: "/reset-password" });
          if (result.error) throw new Error(result.error.message || "Couldn't request a reset. Please try again.");
          setNotice("If an account exists for that email, a password reset link is on its way. Check your inbox and spam folder.");
        } else {
          const token = new URLSearchParams(window.location.search).get("token");
          if (!token) throw new Error("This reset link is invalid or expired. Request a new link below.");
          const result = await authClient.resetPassword({ newPassword: password, token });
          if (result.error) throw new Error("This reset link is invalid or expired. Please request a new one.");
          setNotice("Your password has been updated. Sign in with your new password.");
        }
      } catch (err) { setError(err instanceof Error ? err.message : "Something went wrong. Please try again."); }
      finally { setBusy(false); }
    }}>
      <h2>{mode === "signup" && next.startsWith("/join/") ? "Your chair is waiting." : headings[mode]}</h2>
      <p className="muted">{mode === "login" ? "Sign in to manage your savings circles." : mode === "signup" ? "Create your account. We'll email you a verification link." : mode === "forgot" ? "Enter your email and we'll send you a reset link." : "Use at least 12 characters. Your other sessions will be signed out."}</p>
      {googleEnabled && (mode === "login" || mode === "signup") && <><button type="button" className="google-btn" disabled={busy} onClick={google}><GoogleG />{busy ? "Please wait…" : "Continue with Google"}</button><div className="auth-divider" aria-hidden><span>or</span></div></>}
      {mode === "signup" && <label>Your name<input name="name" required maxLength={100} autoComplete="name" /></label>}
      {mode !== "reset" && <label>Email<input name="email" type="email" required maxLength={254} autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} /></label>}
      {mode !== "forgot" && <label>Password<input name="password" type="password" required minLength={mode === "login" ? 1 : 12} maxLength={128} autoComplete={mode === "login" ? "current-password" : "new-password"} />{mode === "signup" && <small className="muted">At least 12 characters.</small>}</label>}
      {(mode === "signup" || mode === "reset") && <label>Confirm password<input name="confirm" type="password" required minLength={12} maxLength={128} autoComplete="new-password" /></label>}
      {error && <p className="err" role="alert">{error}</p>}
      {notice && <p className="auth-notice" role="status">{notice}</p>}
      <button type="submit" disabled={busy}>{busy ? "Please wait…" : mode === "login" ? "Sign in" : mode === "signup" ? "Create account" : mode === "forgot" ? "Send reset link" : "Update password"}</button>
      {canResend && <button type="button" className="link-btn" disabled={busy} onClick={resend}>Resend verification email</button>}
      {mode === "login" && <Link className="secondary-action signup-cta" href={`/sign-up?next=${encodeURIComponent(next)}`}>New here? Create a free account →</Link>}
      <div className="auth-links">
        {mode === "login" ? <Link href="/forgot-password">Forgot password?</Link> : <Link href={`/?next=${encodeURIComponent(next)}`}>Back to sign in</Link>}
        {mode === "reset" && <Link href="/forgot-password">Request a new reset link</Link>}
        <Link href="/privacy">Privacy</Link>
      </div>
    </form>
  );
}

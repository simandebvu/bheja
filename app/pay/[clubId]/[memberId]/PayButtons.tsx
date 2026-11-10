"use client";

import { useEffect, useRef, useState } from "react";

type PayPalButtonsInstance = { render: (el: HTMLElement) => Promise<void>; close?: () => void };
type PayPalNamespace = {
  Buttons: (opts: {
    style?: Record<string, string>;
    createOrder: () => Promise<string>;
    onApprove: (data: { orderID: string }) => Promise<void>;
    onError: (err: unknown) => void;
    onInit: () => void;
  }) => PayPalButtonsInstance;
};
declare global {
  interface Window { paypal?: PayPalNamespace }
}

function loadSdk(clientId: string): Promise<PayPalNamespace> {
  if (window.paypal) return Promise.resolve(window.paypal);
  return new Promise((resolve, reject) => {
    const s = document.createElement("script");
    // buyer-country is sandbox-only: it lets testers outside PayPal's US checkout
    // (e.g. in Zimbabwe) see the full flow, including guest card payments.
    s.src = `https://www.paypal.com/sdk/js?client-id=${encodeURIComponent(clientId)}&currency=USD&intent=capture&components=buttons&enable-funding=card&buyer-country=US`;
    s.onload = () => (window.paypal ? resolve(window.paypal) : reject(new Error("PayPal SDK failed to load")));
    s.onerror = () => reject(new Error("PayPal SDK failed to load"));
    document.head.appendChild(s);
  });
}

/** Sandbox-only helper so a tester reaching PayPal's login knows what to type. */
function SandboxBuyer({ buyer }: { buyer?: { email: string; password: string } | null }) {
  const [copied, setCopied] = useState("");
  const copy = async (label: string, value: string) => {
    try { await navigator.clipboard.writeText(value); setCopied(label); window.setTimeout(() => setCopied(""), 1500); } catch { /* clipboard blocked: the value is still visible */ }
  };
  return (
    <details className="pay-test">
      <summary>Testing? How to pay in the sandbox</summary>
      {buyer && (
        <>
          <p>Log in at PayPal with this sandbox buyer (fake money only):</p>
          <dl>
            <dt>Email</dt><dd><code>{buyer.email}</code><button type="button" onClick={() => copy("email", buyer.email)}>{copied === "email" ? "Copied" : "Copy"}</button></dd>
            <dt>Password</dt><dd><code>{buyer.password}</code><button type="button" onClick={() => copy("password", buyer.password)}>{copied === "password" ? "Copied" : "Copy"}</button></dd>
          </dl>
        </>
      )}
      <p>{buyer ? "Or pay" : "Pay"} as a guest with a <a href="https://developer.paypal.com/tools/sandbox/card-testing/" target="_blank" rel="noreferrer">PayPal sandbox test card</a>.</p>
    </details>
  );
}

export default function PayButtons({ clubId, memberId, clientId, amount, accessToken, sandboxBuyer }: { accessToken?: string; clubId: string; memberId: string; clientId: string | null; amount: string; sandboxBuyer?: { email: string; password: string } | null }) {
  const ref = useRef<HTMLDivElement>(null);
  const [done, setDone] = useState(false);
  const [receipt, setReceipt] = useState<{ at: string; ref?: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);
  const [slow, setSlow] = useState(false);
  const returning = useRef(false);

  async function capture(orderId: string) {
    const res = await fetch(`/api/paypal/orders/${encodeURIComponent(orderId)}/capture`, { method: "POST", headers: accessToken ? { "x-rotapot-pay-access": accessToken } : {} });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "We couldn't confirm your payment. Please try again.");
    setReceipt({ at: new Date().toISOString(), ref: data.captureId });
    setDone(true);
  }

  useEffect(() => {
    const query = new URLSearchParams(window.location.search);
    const orderId = query.get("token");
    if (query.get("paypalReturn") !== "1" || !orderId || returning.current) return;
    returning.current = true;
    setBusy(true);
    capture(orderId).catch((e: Error) => setError(e.message)).finally(() => setBusy(false));
  }, []);

  useEffect(() => {
    if (!clientId || !ref.current) return;
    if (new URLSearchParams(window.location.search).get("paypalReturn") === "1") return;
    let buttons: PayPalButtonsInstance | undefined;
    let cancelled = false;
    const timer = window.setTimeout(() => setSlow(true), 10_000);
    loadSdk(clientId)
      .then((paypal) => {
        if (cancelled) return;
        buttons = paypal.Buttons({
          onInit: () => { setReady(true); window.clearTimeout(timer); },
          style: { layout: "vertical", shape: "pill", label: "pay", color: "gold" },
          createOrder: async () => {
            const res = await fetch("/api/paypal/orders", {
              method: "POST",
              headers: { "Content-Type": "application/json", ...(accessToken ? { "x-rotapot-pay-access": accessToken } : {}) },
              body: JSON.stringify({ clubId, memberId }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);
            return data.orderId as string;
          },
          onApprove: async ({ orderID }) => { await capture(orderID); },
          onError: (err) => setError(err instanceof Error ? err.message : String(err)),
        });
        if (ref.current) return buttons.render(ref.current);
      })
      .catch((e: Error) => setError(e.message));
    return () => { cancelled = true; window.clearTimeout(timer); buttons?.close?.(); };
  }, [clientId, clubId, memberId, accessToken]);

  const paidAt = new Date(receipt?.at ?? Date.now()).toLocaleString("en-GB", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" });
  const paid = (
    <div key="paid" className="pay-ok" role="status">
      <b>Paid</b>
      Your US${amount} is in the pot. Your treasurer can see it now.
      <span className="pay-receipt">{paidAt}{receipt?.ref ? <> · PayPal ref <code>{receipt.ref}</code></> : null}</span>
      <span className="pay-receipt">Keep this page or take a screenshot as your receipt.</span>
    </div>
  );

  if (!clientId) {
    if (done) return paid;
    return (
      <>
        <button
          className="pay-mock"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            const res = await fetch("/api/mock-pay", {
              method: "POST",
              headers: { "Content-Type": "application/json", ...(accessToken ? { "x-rotapot-pay-access": accessToken } : {}) },
              body: JSON.stringify({ clubId, memberId }),
            });
            const data = await res.json();
            if (res.ok) { setReceipt({ at: new Date().toISOString() }); setDone(true); }
            else setError(data.error);
            setBusy(false);
          }}
        >
          Pay US${amount} (mock mode)
        </button>
        <p className="pay-note">Demo mode: no real payment is taken.</p>
        {error && <div className="pay-err">{error}</div>}
      </>
    );
  }

  // Keep PayPal's container mounted but hidden once paid: if React reused this div for the
  // "Paid" message, PayPal's injected buttons would stay visible inside it.
  return (
    <>
      {done && paid}
      {!done && <p className="pay-note" role="status">{busy ? "Connecting with PayPal…" : !ready ? (slow ? "PayPal is taking longer than usual. You can continue directly below." : "Loading secure PayPal checkout…") : "PayPal sandbox · no real money moves"}</p>}
      <div key="paypal-buttons" ref={ref} style={done ? { display: "none" } : undefined} />
      {error && !done && <div className="pay-err">{error}</div>}
      {/* The direct-redirect fallback stays available (some in-app browsers block PayPal's popup),
          but only competes with PayPal's own buttons when they're slow, failed, or we're returning. */}
      {!done && <button className={ready && !error && !returning.current ? "pay-fallback" : "pay-mock"} disabled={busy} onClick={async () => {
        setBusy(true); setError(null);
        try {
          const query = new URLSearchParams(window.location.search);
          if (query.get("paypalReturn") === "1" && query.get("token")) {
            await capture(query.get("token")!);
          } else {
            const res = await fetch("/api/paypal/orders", { method: "POST", headers: { "Content-Type": "application/json", ...(accessToken ? { "x-rotapot-pay-access": accessToken } : {}) }, body: JSON.stringify({ clubId, memberId, redirect: true }) });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);
            const destination = new URL(data.approvalUrl);
            if (destination.protocol !== "https:" || destination.hostname !== "www.sandbox.paypal.com") throw new Error("PayPal didn't return a sandbox checkout link. Please try again.");
            window.location.assign(destination.href);
          }
        } catch (e) { setError(e instanceof Error ? e.message : "Couldn't open PayPal. Please try again."); }
        finally { setBusy(false); }
      }}>{returning.current ? "Check payment status" : ready && !error ? "PayPal window didn't open? Continue in this tab →" : "Continue directly to PayPal →"}</button>}
      {!done && <SandboxBuyer buyer={sandboxBuyer} />}
    </>
  );
}

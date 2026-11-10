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

export default function PayButtons({ clubId, memberId, clientId, amount, accessToken }: { accessToken?: string; clubId: string; memberId: string; clientId: string | null; amount: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);
  const [slow, setSlow] = useState(false);
  const returning = useRef(false);

  async function capture(orderId: string) {
    const res = await fetch(`/api/paypal/orders/${encodeURIComponent(orderId)}/capture`, { method: "POST", headers: accessToken ? { "x-rotapot-pay-access": accessToken } : {} });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "We couldn't confirm your payment. Please try again.");
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

  const paid = <div key="paid" className="pay-ok"><b>Paid</b>Your US${amount} is in the pot. You can close this page.</div>;

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
            if (res.ok) setDone(true);
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
      {!done && <button className="pay-mock" disabled={busy} onClick={async () => {
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
      }}>{returning.current ? "Check payment status" : "Continue directly to PayPal →"}</button>}
      {!done && <p className="pay-note">Use a PayPal sandbox personal account. No real money moves.</p>}
    </>
  );
}

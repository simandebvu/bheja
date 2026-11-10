"use client";

import { useEffect, useRef, useState } from "react";

type PayPalButtonsInstance = { render: (el: HTMLElement) => Promise<void>; close?: () => void };
type PayPalNamespace = {
  Buttons: (opts: {
    style?: Record<string, string>;
    createOrder: () => Promise<string>;
    onApprove: (data: { orderID: string }) => Promise<void>;
    onError: (err: unknown) => void;
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

export default function PayButtons({ clubId, memberId, clientId, amount }: { clubId: string; memberId: string; clientId: string | null; amount: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!clientId || !ref.current) return;
    let buttons: PayPalButtonsInstance | undefined;
    loadSdk(clientId)
      .then((paypal) => {
        buttons = paypal.Buttons({
          style: { layout: "vertical", shape: "pill", label: "pay", color: "gold" },
          createOrder: async () => {
            const res = await fetch("/api/paypal/orders", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ clubId, memberId }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);
            return data.orderId as string;
          },
          onApprove: async ({ orderID }) => {
            const res = await fetch(`/api/paypal/orders/${orderID}/capture`, { method: "POST" });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);
            setDone(true);
          },
          onError: (err) => setError(err instanceof Error ? err.message : String(err)),
        });
        if (ref.current) return buttons.render(ref.current);
      })
      .catch((e: Error) => setError(e.message));
    return () => buttons?.close?.();
  }, [clientId, clubId, memberId]);

  if (done) return <div className="pay-ok"><b>Paid</b>Your US${amount} is in the pot. You can close this page.</div>;

  if (!clientId) {
    return (
      <>
        <button
          className="pay-mock"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            const res = await fetch("/api/mock-pay", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
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

  return (
    <>
      <div ref={ref} />
      {error && <div className="pay-err">{error}</div>}
    </>
  );
}

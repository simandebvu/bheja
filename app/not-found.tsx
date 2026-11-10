import Link from "next/link";
import { LogoMark } from "./components/ui";

export const metadata = { title: "Page not found · Rotapot" };

/** Most 404s here are old or edited pay and invitation links, so say that plainly. */
export default function NotFound() {
  return (
    <main className="not-found">
      <div className="not-found-card">
        <LogoMark size={40} />
        <h1>We can&apos;t find that page.</h1>
        <p>If you followed a pay link or an invitation, it may have expired or been replaced. Ask your treasurer to send you a fresh one.</p>
        <Link className="primary-action" href="/circles">Go to my circles</Link>
      </div>
    </main>
  );
}

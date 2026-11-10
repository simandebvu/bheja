import { requireSession } from "@/lib/authorize";
export const dynamic = "force-dynamic";
export default async function CirclesLayout({ children }: { children: React.ReactNode }) {
  await requireSession();
  return children;
}

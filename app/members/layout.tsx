import { requireSession } from "@/lib/authorize";
export const dynamic = "force-dynamic";
export default async function MembersLayout({ children }: { children: React.ReactNode }) { await requireSession(); return children; }

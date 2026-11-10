import CircleBuilder from "@/app/components/CircleBuilder";
export default async function EditCircle({ params }: { params: Promise<{ clubId: string }> }) { return <CircleBuilder editId={(await params).clubId} />; }

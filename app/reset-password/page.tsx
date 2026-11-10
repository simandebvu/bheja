import AuthShell from "../components/AuthShell";
export const metadata = { referrer: "no-referrer" as const, robots: { index: false, follow: false } };
export default function ResetPassword() { return <AuthShell mode="reset" />; }

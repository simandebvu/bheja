import SignInView from "./components/SignInView";
import { googleEnabled } from "@/lib/google-enabled";

// Read env per request: the flag must reflect runtime config, not build-time.
export const dynamic = "force-dynamic";
export default function SignIn() { return <SignInView googleEnabled={googleEnabled()} />; }

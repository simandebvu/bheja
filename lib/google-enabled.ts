/** Whether "Continue with Google" is configured. Server-only; exposes a boolean, never the secrets. */
export function googleEnabled() {
  return !!process.env.GOOGLE_CLIENT_ID && !!process.env.GOOGLE_CLIENT_SECRET;
}

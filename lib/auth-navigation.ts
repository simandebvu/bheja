/** Preserve internal onboarding/invitation destinations without open redirects. */
export function safeNext(value: string | null) {
  return value && !value.includes("\\") && /^\/(?:circles(?:[/?]|$)|join\/|members\/)/.test(value) ? value : "/circles";
}

import { AsyncLocalStorage } from "node:async_hooks";
export const accountContext = new AsyncLocalStorage<{ id: string; name: string; email?: string }>();
export function currentAccount() {
  const account = accountContext.getStore();
  if (!account) throw new Error("An authenticated account is required.");
  return account;
}

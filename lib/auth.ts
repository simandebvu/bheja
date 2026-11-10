import { betterAuth, type BetterAuthOptions } from "better-auth";
import { getMigrations } from "better-auth/db/migration";
import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { sendAuthEmail } from "./email";

async function createAuth() {
  const secret = process.env.BETTER_AUTH_SECRET;
  const baseURL = process.env.BETTER_AUTH_URL;
  if (!secret || secret.length < 32 || !baseURL) throw new Error("Set BETTER_AUTH_SECRET (at least 32 characters) and BETTER_AUTH_URL.");
  const filename = process.env.AUTH_DB_PATH || path.join(process.cwd(), "data", "auth.sqlite");
  fs.mkdirSync(path.dirname(filename), { recursive: true });
  const database = new Database(filename);
  database.pragma("journal_mode = WAL");
  const options = {
    appName: "Rotapot",
    baseURL,
    secret,
    database,
    emailAndPassword: {
      enabled: true,
      minPasswordLength: 12,
      maxPasswordLength: 128,
      requireEmailVerification: true,
      resetPasswordTokenExpiresIn: 1800,
      revokeSessionsOnPasswordReset: true,
      sendResetPassword: async ({ user, url }) => { await sendAuthEmail(user.email, url, "reset"); },
    },
    emailVerification: {
      // better-auth swallows a failed send during sign-up and still returns 200. sendAuthEmail
      // flags the failure and the auth route adds an `x-rotapot-email: failed` header so the
      // form can tell the user instead of leaving them waiting for an email that never comes.
      sendOnSignUp: true,
      sendOnSignIn: false,
      // Clicking the link proves the address; don't make people type the password a third time.
      autoSignInAfterVerification: true,
      expiresIn: 3600,
      sendVerificationEmail: async ({ user, url }) => { await sendAuthEmail(user.email, url, "verify"); },
    },
    // Set only when your reverse proxy overwrites this header on every request.
    advanced: { ipAddress: { ipAddressHeaders: process.env.AUTH_TRUSTED_IP_HEADER ? [process.env.AUTH_TRUSTED_IP_HEADER] : [] } },
    session: { expiresIn: 60 * 60 * 24 * 7, updateAge: 60 * 60 * 24 },
    rateLimit: { enabled: true, storage: "database", window: 60, max: 30,
      customRules: {
        "/sign-in/email": { window: 60, max: 5 },
        "/sign-up/email": { window: 60, max: 3 },
        "/request-password-reset": { window: 60, max: 3 },
        "/send-verification-email": { window: 60, max: 3 },
      },
    },
  } satisfies BetterAuthOptions;
  const { runMigrations } = await getMigrations(options);
  await runMigrations();
  return betterAuth(options);
}

let ready: ReturnType<typeof createAuth> | undefined;
/** Lazily initialize so builds don't require runtime credentials. */
export function getAuth() {
  return ready ??= createAuth().catch((error) => { ready = undefined; throw error; });
}

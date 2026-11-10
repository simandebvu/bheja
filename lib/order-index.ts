import fs from "node:fs";
import path from "node:path";

/** Global PayPal orderId -> accountId map so webhooks (no session) can find the owning account. */
function indexPath() {
  return path.join(process.env.ACCOUNT_DATA_DIR || path.join(process.cwd(), "data", "accounts"), "order-index.json");
}

function read(): Record<string, string> {
  try {
    return JSON.parse(fs.readFileSync(indexPath(), "utf8")) as Record<string, string>;
  } catch {
    return {};
  }
}

export function indexOrder(orderId: string, accountId: string): void {
  try {
    const file = indexPath();
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const index = read();
    index[orderId] = accountId;
    const tmp = `${file}.${process.pid}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(index));
    fs.renameSync(tmp, file);
  } catch (err) {
    console.error("Could not index PayPal order", err);
  }
}

export function accountForOrder(orderId: string): string | undefined {
  return read()[orderId];
}

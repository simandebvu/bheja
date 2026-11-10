import type { Language } from "./types";

/**
 * Fixed-wording member messages (receipts and payout notices). The agent writes
 * reminders itself; these are deterministic so money confirmations never vary.
 * Translations are short and simple; have a native speaker check before real use.
 */
const RECEIPT: Record<Language, (name: string, amt: string) => string> = {
  English: (n, a) => `Thank you ${n}! We've received your US$${a}. ✓`,
  Shona: (n, a) => `Tatenda ${n}! Tagamuchira US$${a} yenyu. ✓`,
  Ndebele: (n, a) => `Siyabonga ${n}! Siyitholile i-US$${a} yakho. ✓`,
  isiZulu: (n, a) => `Siyabonga ${n}! Siyitholile i-US$${a} yakho. ✓`,
  Sesotho: (n, a) => `Re a leboha ${n}! Re amohetse US$${a} ya hao. ✓`,
  Setswana: (n, a) => `Re a leboga ${n}! Re amogetse US$${a} ya gago. ✓`,
};

const PAYOUT: Record<Language, (name: string, amt: string) => string> = {
  English: (n, a) => `Congratulations ${n}! Your US$${a} payout has been sent with PayPal.`,
  Shona: (n, a) => `Makorokoto ${n}! US$${a} yako yatumirwa nePayPal.`,
  Ndebele: (n, a) => `Halala ${n}! I-US$${a} yakho ithunyelwe nge-PayPal.`,
  isiZulu: (n, a) => `Halala ${n}! I-US$${a} yakho ithunyelwe nge-PayPal.`,
  Sesotho: (n, a) => `Mahlohonolo ${n}! US$${a} ya hao e rometswe ka PayPal.`,
  Setswana: (n, a) => `Masego ${n}! US$${a} ya gago e rometswe ka PayPal.`,
};

export const GREETING: Record<Language, string> = {
  English: "Hi",
  Shona: "Mhoro",
  Ndebele: "Salibonani",
  isiZulu: "Sawubona",
  Sesotho: "Dumela",
  Setswana: "Dumela",
};

function withEnglish(lang: Language, local: string, english: string) {
  return lang === "English" ? english : `${local}\n\nEN: ${english}`;
}

export function receiptMessage(lang: Language, firstName: string, amount: string) {
  return withEnglish(lang, RECEIPT[lang](firstName, amount), RECEIPT.English(firstName, amount));
}

export function payoutMessage(lang: Language, firstName: string, amount: string) {
  return withEnglish(lang, PAYOUT[lang](firstName, amount), PAYOUT.English(firstName, amount));
}

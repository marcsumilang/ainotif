// Shared FX table: single source of truth for web conversion.
// Mirrors backend/src/ai/classifier.ts CURRENCIES and android CurrencyConverter.
// Rates are static snapshots relative to 1 USD (not live quotes).

export const RATES_TO_USD: Record<string, number> = {
  USD: 1.0,
  EUR: 1.08,
  GBP: 1.28,
  PHP: 0.0175,
  CAD: 0.73,
  AUD: 0.65,
  JPY: 0.0065,
  INR: 0.012,
  SGD: 0.75,
  NZD: 0.61,
  CHF: 1.12,
  HKD: 0.128,
};

export const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: "$",
  EUR: "€",
  GBP: "£",
  PHP: "₱",
  CAD: "CA$",
  AUD: "A$",
  JPY: "¥",
  INR: "₹",
  SGD: "S$",
  NZD: "NZ$",
  CHF: "CHF ",
  HKD: "HK$",
};

export const SUPPORTED_CURRENCIES = Object.keys(RATES_TO_USD);

export function convertCurrency(amount: number, from: string, to: string): number | null {
  const f = (from || "USD").toUpperCase();
  const t = (to || "USD").toUpperCase();
  if (f === t) return amount;
  const fromRate = RATES_TO_USD[f];
  const toRate = RATES_TO_USD[t];
  if (fromRate === undefined || toRate === undefined) return null;
  return (amount * fromRate) / toRate;
}

export function formatCurrency(amount: number, currency: string): string {
  const code = (currency || "USD").toUpperCase();
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: code,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    const sym = CURRENCY_SYMBOLS[code] || `${code} `;
    return `${sym}${Math.abs(amount).toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  }
}

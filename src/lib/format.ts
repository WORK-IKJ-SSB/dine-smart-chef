export const CURRENCY_SYMBOL = "₹";
export function money(n: number | string | null | undefined): string {
  const v = Number(n ?? 0);
  return `${CURRENCY_SYMBOL}${v.toFixed(2)}`;
}
export function hour12(h: number): string {
  const period = h < 12 ? "AM" : "PM";
  const hr = h % 12 === 0 ? 12 : h % 12;
  return `${hr} ${period}`;
}
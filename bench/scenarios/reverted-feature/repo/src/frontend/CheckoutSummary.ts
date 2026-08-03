export function renderCheckoutSummary(totalCents: number): string {
  return `Total: $${(totalCents / 100).toFixed(2)}`;
}

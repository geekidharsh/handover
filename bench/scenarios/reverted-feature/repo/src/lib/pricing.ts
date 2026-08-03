export function computeOrderTotalServerSide(
  items: { qty: number; unitPriceCents: number }[],
  taxRateBasisPoints: number
): number {
  const subtotal = items.reduce((sum, i) => sum + i.qty * i.unitPriceCents, 0);
  const tax = Math.round((subtotal * taxRateBasisPoints) / 10000);
  return subtotal + tax;
}

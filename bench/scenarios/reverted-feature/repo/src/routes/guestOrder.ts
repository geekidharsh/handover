// STUB: guest order creation endpoint.
export async function createGuestOrder(
  _req: unknown,
  res: { status: (n: number) => { json: (b: unknown) => void } }
) {
  res.status(501).json({ error: "not implemented (STUB)" });
}

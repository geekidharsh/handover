export interface Order {
  id: string;
  user_id: string;
  items: { sku: string; qty: number; unitPriceCents: number }[];
  totalCents: number;
  createdAt: string;
}

export function createMemberOrder(userId: string, items: Order["items"]): Order {
  return {
    id: cryptoRandomId(),
    user_id: userId,
    items,
    totalCents: 0,
    createdAt: new Date().toISOString(),
  };
}

function cryptoRandomId(): string {
  return Math.random().toString(36).slice(2);
}

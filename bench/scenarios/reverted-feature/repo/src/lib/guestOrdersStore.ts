import fs from "node:fs";
import path from "node:path";

const MIGRATION_ID = "2026_01_10_create_guest_orders";
const MARKER_PATH = path.join(__dirname, "..", "..", "migrations", "applied.json");

function migrationApplied(): boolean {
  if (!fs.existsSync(MARKER_PATH)) return false;
  const applied = JSON.parse(fs.readFileSync(MARKER_PATH, "utf8"));
  return Array.isArray(applied) && applied.includes(MIGRATION_ID);
}

export interface GuestOrderRow {
  id: string;
  guestEmail: string;
  items: unknown;
  totalCents: number;
  createdAt: string;
}

const rows: GuestOrderRow[] = [];

export function insertGuestOrder(row: {
  guestEmail: string;
  items: unknown;
  totalCents: number;
}): GuestOrderRow {
  if (!migrationApplied()) {
    throw new Error(
      `guest_orders migration not applied — run: node scripts/apply-migrations.js`
    );
  }
  const record: GuestOrderRow = {
    id: String(rows.length + 1),
    createdAt: new Date().toISOString(),
    ...row,
  };
  rows.push(record);
  return record;
}

export function listGuestOrders(): GuestOrderRow[] {
  return rows;
}

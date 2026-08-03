#!/usr/bin/env node
// Applies pending migrations in migrations/*.sql by recording them in
// migrations/applied.json. This fixture has no real database; "applying" means
// recording the migration id as applied. src/lib/guestOrdersStore.ts checks this
// marker before allowing writes to the table the migration creates.
const fs = require("fs");
const path = require("path");

const dir = path.join(__dirname, "..", "migrations");
const markerPath = path.join(dir, "applied.json");
const applied = fs.existsSync(markerPath) ? JSON.parse(fs.readFileSync(markerPath, "utf8")) : [];

const pending = fs
  .readdirSync(dir)
  .filter((f) => f.endsWith(".sql"))
  .map((f) => f.replace(/\.sql$/, ""))
  .filter((id) => !applied.includes(id));

if (!pending.length) {
  console.log("no pending migrations");
  process.exit(0);
}
for (const id of pending) {
  console.log(`applying ${id}`);
  applied.push(id);
}
fs.writeFileSync(markerPath, JSON.stringify(applied, null, 2) + "\n");
console.log(`applied ${pending.length} migration(s)`);

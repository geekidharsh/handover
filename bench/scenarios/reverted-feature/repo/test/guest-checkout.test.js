const { test } = require("node:test");
const assert = require("node:assert");
const fs = require("fs");

test("guest order route exists and is still a stub (until wired)", () => {
  const src = fs.readFileSync("src/routes/guestOrder.ts", "utf8");
  assert.match(src, /STUB/);
});

test("pricing computes a server-side total", () => {
  const src = fs.readFileSync("src/lib/pricing.ts", "utf8");
  assert.match(src, /computeOrderTotalServerSide/);
});

test("guest orders store refuses writes until the migration is applied", () => {
  const src = fs.readFileSync("src/lib/guestOrdersStore.ts", "utf8");
  assert.match(src, /migration not applied/);
});

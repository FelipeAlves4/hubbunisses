// Run against a disposable PostgreSQL database called agenda_test after migrations.
import { createHmac } from "node:crypto";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { setTimeout } from "node:timers/promises";

const url = new URL(process.env.AGENDA_TEST_DATABASE_URL ?? "");
if (url.pathname !== "/agenda_test" || !["127.0.0.1", "localhost", "[::1]"].includes(url.hostname)) {
  throw new Error("Use a local disposable database named agenda_test.");
}
const { default: pg } = await import(process.env.AGENDA_PG_CLIENT_MODULE ?? "pg");
const pool = new pg.Pool({ connectionString: url.toString(), max: 3 });
const [a, b, monitor] = await Promise.all([pool.connect(), pool.connect(), pool.connect()]);
const fixture = await readFile(new URL("./agenda_plus_rls.sql", import.meta.url), "utf8");
const beforeRoles = fixture.indexOf("set local role authenticated;");
assert(beforeRoles > 0);
const service = "a9300000-0000-4000-8000-000000000001";
const professional = "a9400000-0000-4000-8000-000000000001";
let second;
try {
  await monitor.query(fixture.slice(0, beforeRoles) + "\ncommit;");
  const slot = (await monitor.query("select (timezone('UTC',now())::date+1+time '09:00') at time zone 'UTC' as start")).rows[0].start;
  const book = (conn, name, origin) => {
    const key = origin.repeat(64);
    const epoch = Math.floor(Date.now() / 1000);
    const proof = createHmac("sha256", "1".repeat(64)).update(`agenda-v1|book|agenda-fixture-book|${key}|${epoch}`).digest("hex");
    return conn.query("select public.agenda_public_book('agenda-fixture-book',$1,$2,$3,$4,'agenda-concurrency@example.test','email',$5,$6,$7) as receipt",
      [service, professional, slot, name, key, epoch, proof]);
  };
  await Promise.all([a.query("begin; set local role anon;"), b.query("begin; set local role anon;")]);
  const first = (await book(a, "Primeiro cliente", "a")).rows[0].receipt;
  assert(first.reference);
  second = book(b, "Segundo cliente", "b");
  // Observe a real blockade while the first reservation is uncommitted.
  let blocked = false;
  for (let attempt = 0; attempt < 100; attempt++) {
    const result = await monitor.query("select $1::int=any(pg_blocking_pids($2)) as blocked", [a.processID, b.processID]);
    if (result.rows[0].blocked) { blocked = true; break; }
    await setTimeout(20);
  }
  assert(blocked, "The second connection did not wait on the first transaction.");
  await a.query("commit");
  assert.equal((await second).rows[0].receipt.error, "unavailable");
  await b.query("rollback");
  const stored = await monitor.query("select count(*)::int as count from public.agenda_appointments where professional_id=$1 and starts_at=$2", [professional, slot]);
  assert.equal(stored.rows[0].count, 1);
  console.log("PASS: two concurrent anonymous requests, exactly one persisted booking");
} finally {
  await a.query("rollback").catch(() => {});
  await second?.catch(() => {});
  await b.query("rollback").catch(() => {});
  a.release(); b.release(); monitor.release();
  await pool.end();
}

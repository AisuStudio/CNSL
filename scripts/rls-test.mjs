// S4 RLS verification against STAGING. Simulates the app's per-request context:
//   BEGIN; SET LOCAL role authenticated; SET LOCAL request.jwt.claims '{"sub":uid}'; …
// Run: (source .env.staging) node scripts/rls-test.mjs
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient({ datasources: { db: { url: process.env.DIRECT_URL } } });
const A = "00000000-0000-0000-0000-00000000000a"; // owns board-a + proj-1
const B = "00000000-0000-0000-0000-00000000000b"; // owns board-b, editor on proj-1

async function asUser(uid, fn, { rollback = false } = {}) {
  const SENTINEL = "__rollback__";
  let out;
  try {
    await prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(`set local role authenticated`);
      await tx.$executeRawUnsafe(`set local request.jwt.claims = '{"sub":"${uid}"}'`);
      out = await fn(tx);
      if (rollback) throw new Error(SENTINEL);
    });
  } catch (e) {
    if (e.message !== SENTINEL) throw e;
  }
  return out;
}

const ids = (rows) => rows.map((r) => r.id).sort();
const results = [];
const check = (name, pass, detail = "") => results.push({ name, pass, detail });

try {
  // Reads
  const aT = await asUser(A, (tx) => tx.$queryRawUnsafe(`select id from "Task"`));
  check("A sees only own board tasks", JSON.stringify(ids(aT)) === JSON.stringify(["task-a-private", "task-a-shared"]), ids(aT).join());
  const bT = await asUser(B, (tx) => tx.$queryRawUnsafe(`select id from "Task"`));
  check("B sees own + shared-project task (not A's private)", JSON.stringify(ids(bT)) === JSON.stringify(["task-a-shared", "task-b-private"]), ids(bT).join());

  // Writes — denied
  const u1 = await asUser(B, (tx) => tx.$executeRawUnsafe(`update "Task" set title = title where id = 'task-a-private'`));
  check("B cannot update A's private task (0 rows)", u1 === 0, `rows=${u1}`);
  const u2 = await asUser(A, (tx) => tx.$executeRawUnsafe(`update "Task" set title = title where id = 'task-b-private'`));
  check("A cannot update B's private task (0 rows)", u2 === 0, `rows=${u2}`);

  // Writes — allowed
  const u3 = await asUser(B, (tx) => tx.$executeRawUnsafe(`update "Task" set title = title where id = 'task-a-shared'`));
  check("B (editor) CAN update shared-project task (1 row)", u3 === 1, `rows=${u3}`);

  // Insert denied (board-a, no project, B not a board member)
  let denied = false, denyMsg = "";
  try {
    await asUser(B, (tx) => tx.$executeRawUnsafe(`insert into "Task"(id,"boardId",number,title) values('rls-deny','board-a',98,'x')`), { rollback: true });
  } catch (e) { denied = /row-level security/i.test(e.message); denyMsg = e.message.split("\n")[0]; }
  check("B cannot insert onto A's board (RLS violation)", denied, denyMsg);

  // Insert allowed (board-a + proj-1, B is editor) — rolled back
  let allowed = false, allowErr = "";
  try {
    await asUser(B, (tx) => tx.$executeRawUnsafe(`insert into "Task"(id,"boardId","projectId",number,title) values('rls-allow','board-a','proj-1',99,'x')`), { rollback: true });
    allowed = true;
  } catch (e) { allowErr = e.message.split("\n")[0]; }
  check("B (editor) CAN insert into shared project", allowed, allowErr);

  // Project visibility
  const aP = await asUser(A, (tx) => tx.$queryRawUnsafe(`select id from "Project"`));
  const bP = await asUser(B, (tx) => tx.$queryRawUnsafe(`select id from "Project"`));
  check("A sees proj-1 (owner)", JSON.stringify(ids(aP)) === JSON.stringify(["proj-1"]), ids(aP).join());
  check("B sees proj-1 (member)", JSON.stringify(ids(bP)) === JSON.stringify(["proj-1"]), ids(bP).join());

  // cleanup any rows that slipped through (should be none)
  await prisma.$executeRawUnsafe(`delete from "Task" where id in ('rls-deny','rls-allow')`);
} catch (e) {
  console.error("HARNESS ERROR:", e.message);
} finally {
  await prisma.$disconnect();
}

let allPass = true;
for (const r of results) { if (!r.pass) allPass = false; console.log(`${r.pass ? "PASS" : "FAIL"}  ${r.name}${r.detail ? `  [${r.detail}]` : ""}`); }
console.log(allPass ? "\n✅ ALL RLS CHECKS PASSED" : "\n❌ SOME CHECKS FAILED");

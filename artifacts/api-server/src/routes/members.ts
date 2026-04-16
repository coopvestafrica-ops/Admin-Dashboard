import { Router, type IRouter } from "express";
import { eq, sql, count, sum, ilike, or } from "drizzle-orm";
import { db } from "@workspace/db";
import { membersTable, loansTable, contributionsTable, riskScoresTable } from "@workspace/db";

const router: IRouter = Router();

router.get("/members/stats", async (req, res): Promise<void> => {
  const [total] = await db.select({ count: count() }).from(membersTable);
  const [active] = await db.select({ count: count() }).from(membersTable).where(eq(membersTable.status, "active"));
  const [inactive] = await db.select({ count: count() }).from(membersTable).where(eq(membersTable.status, "inactive"));
  const [suspended] = await db.select({ count: count() }).from(membersTable).where(eq(membersTable.status, "suspended"));
  const [pending] = await db.select({ count: count() }).from(membersTable).where(eq(membersTable.status, "pending"));
  const [newThisMonth] = await db
    .select({ count: count() })
    .from(membersTable)
    .where(sql`DATE_TRUNC('month', ${membersTable.createdAt}) = DATE_TRUNC('month', NOW())`);

  res.json({
    total: Number(total.count),
    active: Number(active.count),
    inactive: Number(inactive.count),
    suspended: Number(suspended.count),
    pending: Number(pending.count),
    newThisMonth: Number(newThisMonth.count),
  });
});

router.get("/members", async (req, res): Promise<void> => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(100, Number(req.query.limit) || 20);
  const offset = (page - 1) * limit;
  const status = req.query.status as string | undefined;
  const search = req.query.search as string | undefined;

  let whereClause = sql`1=1`;
  if (status && ["active", "inactive", "suspended", "pending"].includes(status)) {
    whereClause = sql`${whereClause} AND ${membersTable.status} = ${status}`;
  }
  if (search) {
    whereClause = sql`${whereClause} AND (
      ${membersTable.firstName} ILIKE ${"%" + search + "%"}
      OR ${membersTable.lastName} ILIKE ${"%" + search + "%"}
      OR ${membersTable.email} ILIKE ${"%" + search + "%"}
      OR ${membersTable.memberId} ILIKE ${"%" + search + "%"}
    )`;
  }

  const [totalResult] = await db.select({ count: count() }).from(membersTable).where(whereClause);
  const members = await db
    .select()
    .from(membersTable)
    .where(whereClause)
    .orderBy(sql`${membersTable.createdAt} DESC`)
    .limit(limit)
    .offset(offset);

  const memberIds = members.map(m => m.id);
  const contribTotals = memberIds.length > 0
    ? await db
        .select({
          memberId: contributionsTable.memberId,
          total: sum(contributionsTable.amount),
        })
        .from(contributionsTable)
        .where(sql`${contributionsTable.memberId} = ANY(${sql.raw("ARRAY[" + memberIds.join(",") + "]::int[]")}) AND ${contributionsTable.status} = 'paid'`)
        .groupBy(contributionsTable.memberId)
    : [];

  const activeLoanAmounts = memberIds.length > 0
    ? await db
        .select({
          memberId: loansTable.memberId,
          balance: sum(loansTable.balance),
        })
        .from(loansTable)
        .where(sql`${loansTable.memberId} = ANY(${sql.raw("ARRAY[" + memberIds.join(",") + "]::int[]")}) AND ${loansTable.status} = 'active'`)
        .groupBy(loansTable.memberId)
    : [];

  const riskScores = memberIds.length > 0
    ? await db
        .select({ memberId: riskScoresTable.memberId, score: riskScoresTable.score })
        .from(riskScoresTable)
        .where(sql`${riskScoresTable.memberId} = ANY(${sql.raw("ARRAY[" + memberIds.join(",") + "]::int[]")})`)
    : [];

  const contribMap = new Map(contribTotals.map(c => [c.memberId, Number(c.total || 0)]));
  const loanMap = new Map(activeLoanAmounts.map(l => [l.memberId, Number(l.balance || 0)]));
  const riskMap = new Map(riskScores.map(r => [r.memberId, r.score]));

  res.json({
    data: members.map(m => ({
      ...m,
      totalContributions: contribMap.get(m.id) || 0,
      activeLoan: loanMap.get(m.id) || 0,
      riskScore: riskMap.get(m.id) || 0,
      avatarInitials: (m.firstName[0] + m.lastName[0]).toUpperCase(),
    })),
    total: Number(totalResult.count),
    page,
    limit,
  });
});

router.post("/members", async (req, res): Promise<void> => {
  const { firstName, lastName, email, phone, address, occupation } = req.body;
  if (!firstName || !lastName || !email || !phone) {
    res.status(400).json({ error: "firstName, lastName, email, phone are required" });
    return;
  }

  const memberId = "CVA-" + String(Date.now()).slice(-6);
  const [member] = await db.insert(membersTable).values({
    memberId,
    firstName,
    lastName,
    email,
    phone,
    address,
    occupation,
    avatarInitials: (firstName[0] + lastName[0]).toUpperCase(),
    status: "pending",
    joinDate: new Date().toISOString().slice(0, 10),
  }).returning();

  res.status(201).json({ ...member, totalContributions: 0, activeLoan: 0, riskScore: 0 });
});

router.get("/members/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const [member] = await db.select().from(membersTable).where(eq(membersTable.id, id));
  if (!member) { res.status(404).json({ error: "Member not found" }); return; }

  const [contribTotal] = await db
    .select({ total: sum(contributionsTable.amount) })
    .from(contributionsTable)
    .where(sql`${contributionsTable.memberId} = ${id} AND ${contributionsTable.status} = 'paid'`);

  const [activeLoanBalance] = await db
    .select({ balance: sum(loansTable.balance) })
    .from(loansTable)
    .where(sql`${loansTable.memberId} = ${id} AND ${loansTable.status} = 'active'`);

  const [riskScore] = await db
    .select({ score: riskScoresTable.score })
    .from(riskScoresTable)
    .where(eq(riskScoresTable.memberId, id));

  res.json({
    ...member,
    totalContributions: Number(contribTotal.total || 0),
    activeLoan: Number(activeLoanBalance.balance || 0),
    riskScore: riskScore?.score || 0,
    avatarInitials: (member.firstName[0] + member.lastName[0]).toUpperCase(),
  });
});

router.put("/members/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const { firstName, lastName, email, phone, status, address, occupation } = req.body;
  const updates: Record<string, unknown> = {};
  if (firstName) updates.firstName = firstName;
  if (lastName) updates.lastName = lastName;
  if (email) updates.email = email;
  if (phone) updates.phone = phone;
  if (status) updates.status = status;
  if (address !== undefined) updates.address = address;
  if (occupation !== undefined) updates.occupation = occupation;

  const [member] = await db.update(membersTable).set(updates).where(eq(membersTable.id, id)).returning();
  if (!member) { res.status(404).json({ error: "Member not found" }); return; }

  res.json({ ...member, totalContributions: 0, activeLoan: 0, riskScore: 0 });
});

export default router;

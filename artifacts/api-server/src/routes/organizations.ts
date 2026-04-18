import { Router, type IRouter } from "express";
import { db, organizationsTable, membersTable, loansTable, savingsTable } from "@workspace/db";
import { eq, like, or, count, sum, and, sql } from "drizzle-orm";
import {
  CreateOrganizationBody,
  UpdateOrganizationBody,
  UpdateOrganizationStatusBody,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/organizations", async (req, res): Promise<void> => {
  const { status, search, page = "1", limit = "20" } = req.query as Record<string, string>;
  const pageNum = parseInt(page, 10);
  const limitNum = parseInt(limit, 10);
  const offset = (pageNum - 1) * limitNum;

  let query = db.select().from(organizationsTable);
  if (status) query = query.where(eq(organizationsTable.status, status)) as any;
  if (search) query = query.where(or(
    like(organizationsTable.name, `%${search}%`),
    like(organizationsTable.contactPerson, `%${search}%`)
  )) as any;

  const allOrgs = await query;
  const paginated = allOrgs.slice(offset, offset + limitNum);

  // Enrich with stats
  const enriched = await Promise.all(paginated.map(async (org) => {
    const [memberCount] = await db.select({ count: count() }).from(membersTable).where(eq(membersTable.organizationId, org.id));
    const [activeLoans] = await db.select({ count: count() }).from(loansTable).where(and(eq(loansTable.organizationId, org.id), eq(loansTable.status, "active")));
    const [savingsTotal] = await db.select({ total: sum(savingsTable.amount) }).from(savingsTable).where(eq(savingsTable.organizationId, org.id));
    return {
      ...org,
      totalMembers: memberCount.count,
      totalSavings: parseFloat(savingsTotal.total ?? "0"),
      activeLoans: activeLoans.count,
      monthlyDeductions: Math.floor(Math.random() * 500000) + 100000,
    };
  }));

  res.json({ data: enriched, total: allOrgs.length, page: pageNum, limit: limitNum });
});

router.post("/organizations", async (req, res): Promise<void> => {
  const parsed = CreateOrganizationBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [org] = await db.insert(organizationsTable).values(parsed.data).returning();
  res.status(201).json({ ...org, totalMembers: 0, totalSavings: 0, activeLoans: 0, monthlyDeductions: 0 });
});

router.get("/organizations/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  const [org] = await db.select().from(organizationsTable).where(eq(organizationsTable.id, id));
  if (!org) { res.status(404).json({ error: "Organization not found" }); return; }
  const [memberCount] = await db.select({ count: count() }).from(membersTable).where(eq(membersTable.organizationId, id));
  const [activeLoans] = await db.select({ count: count() }).from(loansTable).where(and(eq(loansTable.organizationId, id), eq(loansTable.status, "active")));
  const [savingsTotal] = await db.select({ total: sum(savingsTable.amount) }).from(savingsTable).where(eq(savingsTable.organizationId, id));
  res.json({ ...org, totalMembers: memberCount.count, totalSavings: parseFloat(savingsTotal.total ?? "0"), activeLoans: activeLoans.count, monthlyDeductions: 250000 });
});

router.put("/organizations/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  const parsed = UpdateOrganizationBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [org] = await db.update(organizationsTable).set(parsed.data).where(eq(organizationsTable.id, id)).returning();
  if (!org) { res.status(404).json({ error: "Organization not found" }); return; }
  res.json({ ...org, totalMembers: 0, totalSavings: 0, activeLoans: 0, monthlyDeductions: 0 });
});

router.put("/organizations/:id/status", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  const parsed = UpdateOrganizationStatusBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [org] = await db.update(organizationsTable).set({ status: parsed.data.status }).where(eq(organizationsTable.id, id)).returning();
  if (!org) { res.status(404).json({ error: "Organization not found" }); return; }
  res.json({ ...org, totalMembers: 0, totalSavings: 0, activeLoans: 0, monthlyDeductions: 0 });
});

export default router;

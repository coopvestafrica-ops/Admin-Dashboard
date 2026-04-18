import { Router, type IRouter } from "express";
import { db, membersTable, organizationsTable } from "@workspace/db";
import { eq, like, and } from "drizzle-orm";
import {
  CreateMemberBody,
  UpdateMemberBody,
  UpdateMemberStatusBody,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/members", async (req, res): Promise<void> => {
  const { organizationId, status, search, page = "1", limit = "20" } = req.query as Record<string, string>;
  const pageNum = parseInt(page, 10);
  const limitNum = parseInt(limit, 10);
  const offset = (pageNum - 1) * limitNum;

  const members = await db.select({
    member: membersTable,
    orgName: organizationsTable.name,
  }).from(membersTable)
    .leftJoin(organizationsTable, eq(membersTable.organizationId, organizationsTable.id));

  let filtered = members;
  if (organizationId) filtered = filtered.filter(m => m.member.organizationId === parseInt(organizationId, 10));
  if (status) filtered = filtered.filter(m => m.member.status === status);
  if (search) {
    const q = search.toLowerCase();
    filtered = filtered.filter(m => m.member.fullName.toLowerCase().includes(q) || m.member.employeeId.toLowerCase().includes(q) || m.member.email.toLowerCase().includes(q));
  }

  const total = filtered.length;
  const paginated = filtered.slice(offset, offset + limitNum).map(({ member, orgName }) => ({
    ...member,
    organizationName: orgName ?? "",
    savingsBalance: parseFloat(member.savingsBalance ?? "0"),
    walletBalance: parseFloat(member.walletBalance ?? "0"),
    riskScore: parseFloat(member.riskScore ?? "0"),
  }));

  res.json({ data: paginated, total, page: pageNum, limit: limitNum });
});

router.post("/members", async (req, res): Promise<void> => {
  const parsed = CreateMemberBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [member] = await db.insert(membersTable).values(parsed.data).returning();
  res.status(201).json({ ...member, savingsBalance: 0, walletBalance: 0, riskScore: 0 });
});

router.get("/members/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  const [result] = await db.select({
    member: membersTable,
    orgName: organizationsTable.name,
  }).from(membersTable)
    .leftJoin(organizationsTable, eq(membersTable.organizationId, organizationsTable.id))
    .where(eq(membersTable.id, id));
  if (!result) { res.status(404).json({ error: "Member not found" }); return; }
  res.json({
    ...result.member,
    organizationName: result.orgName ?? "",
    savingsBalance: parseFloat(result.member.savingsBalance ?? "0"),
    walletBalance: parseFloat(result.member.walletBalance ?? "0"),
    riskScore: parseFloat(result.member.riskScore ?? "0"),
  });
});

router.put("/members/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  const parsed = UpdateMemberBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [member] = await db.update(membersTable).set(parsed.data).where(eq(membersTable.id, id)).returning();
  if (!member) { res.status(404).json({ error: "Member not found" }); return; }
  res.json({ ...member, savingsBalance: parseFloat(member.savingsBalance ?? "0"), walletBalance: parseFloat(member.walletBalance ?? "0"), riskScore: parseFloat(member.riskScore ?? "0") });
});

router.put("/members/:id/status", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  const parsed = UpdateMemberStatusBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [member] = await db.update(membersTable).set({ status: parsed.data.status }).where(eq(membersTable.id, id)).returning();
  if (!member) { res.status(404).json({ error: "Member not found" }); return; }
  res.json({ ...member, savingsBalance: parseFloat(member.savingsBalance ?? "0"), walletBalance: parseFloat(member.walletBalance ?? "0"), riskScore: parseFloat(member.riskScore ?? "0") });
});

export default router;

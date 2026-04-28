import { Router, type IRouter } from "express";
import { db, payrollTable, membersTable, organizationsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import * as XLSX from "xlsx";
import { CreatePayrollDeductionBody } from "@workspace/api-zod";
import { requireAuth } from "../middlewares/auth";

const router: IRouter = Router();

interface ParsedRow {
  rowNumber: number;
  employeeId?: string;
  email?: string;
  fullName?: string;
  amount?: number;
  month?: string;
}

function normalizeKey(k: string): string {
  return String(k).toLowerCase().replace(/[\s_-]+/g, "");
}

function parsePayrollWorkbook(buffer: Buffer): ParsedRow[] {
  const wb = XLSX.read(buffer, { type: "buffer" });
  const sheetName = wb.SheetNames[0];
  const ws = wb.Sheets[sheetName];
  if (!ws) return [];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: null });
  return rows.map((raw, idx) => {
    const row: ParsedRow = { rowNumber: idx + 2 };
    for (const [k, v] of Object.entries(raw)) {
      const key = normalizeKey(k);
      if (v == null) continue;
      if (key === "employeeid" || key === "empid" || key === "staffid") row.employeeId = String(v).trim();
      else if (key === "email" || key === "emailaddress") row.email = String(v).trim().toLowerCase();
      else if (key === "fullname" || key === "name") row.fullName = String(v).trim();
      else if (key === "amount" || key === "deduction" || key === "deductionamount") {
        const n = typeof v === "number" ? v : parseFloat(String(v).replace(/[^0-9.\-]/g, ""));
        if (!Number.isNaN(n)) row.amount = n;
      } else if (key === "month" || key === "period") row.month = String(v).trim();
    }
    return row;
  });
}

router.get("/payroll", async (req, res): Promise<void> => {
  const { organizationId, status, page = "1", limit = "20" } = req.query as Record<string, string>;
  const pageNum = parseInt(page, 10);
  const limitNum = parseInt(limit, 10);

  const all = await db.select({
    payroll: payrollTable,
    memberName: membersTable.fullName,
    orgName: organizationsTable.name,
  }).from(payrollTable)
    .leftJoin(membersTable, eq(payrollTable.memberId, membersTable.id))
    .leftJoin(organizationsTable, eq(payrollTable.organizationId, organizationsTable.id));

  let filtered = all;
  if (organizationId) filtered = filtered.filter(p => p.payroll.organizationId === parseInt(organizationId, 10));
  if (status) filtered = filtered.filter(p => p.payroll.status === status);

  const total = filtered.length;
  const paginated = filtered.slice((pageNum - 1) * limitNum, pageNum * limitNum).map(({ payroll, memberName, orgName }) => ({
    ...payroll,
    memberName: memberName ?? "Unknown",
    organizationName: orgName ?? "Unknown",
    deductionAmount: parseFloat(payroll.deductionAmount),
    processedAt: payroll.processedAt?.toISOString() ?? null,
  }));

  res.json({ data: paginated, total, page: pageNum, limit: limitNum });
});

router.post("/payroll", async (req, res): Promise<void> => {
  const parsed = CreatePayrollDeductionBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [payroll] = await db.insert(payrollTable).values({
    ...parsed.data,
    deductionAmount: String(parsed.data.deductionAmount),
  }).returning();
  const [member] = await db.select().from(membersTable).where(eq(membersTable.id, payroll.memberId));
  const [org] = await db.select().from(organizationsTable).where(eq(organizationsTable.id, payroll.organizationId));
  res.status(201).json({ ...payroll, memberName: member?.fullName ?? "Unknown", organizationName: org?.name ?? "Unknown", deductionAmount: parseFloat(payroll.deductionAmount) });
});

// POST /api/payroll/upload — preview or commit an Excel/CSV upload.
// Body: { organizationId: number, base64: string, month?: string, commit?: boolean }
router.post("/payroll/upload", requireAuth, async (req, res): Promise<void> => {
  const { organizationId, base64, month: defaultMonth, commit = false } = req.body as {
    organizationId: number;
    base64: string;
    month?: string;
    commit?: boolean;
  };
  if (!organizationId || !base64) {
    res.status(400).json({ error: "organizationId and base64 file are required" });
    return;
  }
  const buffer = Buffer.from(base64, "base64");
  if (buffer.length === 0) { res.status(400).json({ error: "Empty file" }); return; }
  if (buffer.length > 25 * 1024 * 1024) { res.status(413).json({ error: "File exceeds 25 MB" }); return; }

  let rows: ParsedRow[];
  try {
    rows = parsePayrollWorkbook(buffer);
  } catch (err) {
    res.status(400).json({ error: "Invalid spreadsheet", detail: err instanceof Error ? err.message : String(err) });
    return;
  }

  const orgMembers = await db
    .select({ id: membersTable.id, employeeId: membersTable.employeeId, email: membersTable.email, fullName: membersTable.fullName })
    .from(membersTable)
    .where(eq(membersTable.organizationId, organizationId));
  const byEmpId = new Map(orgMembers.map((m) => [m.employeeId.trim().toLowerCase(), m]));
  const byEmail = new Map(orgMembers.map((m) => [m.email.trim().toLowerCase(), m]));

  const matched: { rowNumber: number; memberId: number; memberName: string; amount: number; month: string }[] = [];
  const unmatched: { rowNumber: number; reason: string; row: ParsedRow }[] = [];

  for (const row of rows) {
    if (!row.amount || row.amount <= 0) {
      unmatched.push({ rowNumber: row.rowNumber, reason: "missing_or_invalid_amount", row });
      continue;
    }
    const key = (row.employeeId || "").trim().toLowerCase();
    const emailKey = (row.email || "").trim().toLowerCase();
    const member = (key && byEmpId.get(key)) || (emailKey && byEmail.get(emailKey)) || null;
    if (!member) {
      unmatched.push({ rowNumber: row.rowNumber, reason: "no_matching_member", row });
      continue;
    }
    matched.push({
      rowNumber: row.rowNumber,
      memberId: member.id,
      memberName: member.fullName,
      amount: row.amount,
      month: row.month || defaultMonth || new Date().toISOString().slice(0, 7),
    });
  }

  let inserted = 0;
  if (commit && matched.length > 0) {
    for (const m of matched) {
      await db.insert(payrollTable).values({
        memberId: m.memberId,
        organizationId,
        deductionAmount: String(m.amount),
        month: m.month,
        status: "pending",
      });
      inserted += 1;
    }
  }

  res.json({
    organizationId,
    totalRows: rows.length,
    matchedCount: matched.length,
    unmatchedCount: unmatched.length,
    matched,
    unmatched,
    committed: commit,
    inserted,
  });
});

export default router;

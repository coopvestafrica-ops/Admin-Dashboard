import { Router, type IRouter } from "express";
import { db, excelWorkbooksTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import * as XLSX from "xlsx";
import { requireAuth } from "../middlewares/auth";

const router: IRouter = Router();

interface SheetCell { row: number; col: number; value: string | number | boolean | null }
interface SheetData { cells: SheetCell[] }
type WorkbookData = Record<string, SheetData>;

function workbookToBuffer(sheetNames: string[], data: WorkbookData): Buffer {
  const wb = XLSX.utils.book_new();
  for (const name of sheetNames) {
    const sheet = data[name] ?? { cells: [] };
    const aoa: (string | number | boolean | null)[][] = [];
    for (const cell of sheet.cells ?? []) {
      if (!aoa[cell.row]) aoa[cell.row] = [];
      aoa[cell.row][cell.col] = cell.value;
    }
    const ws = XLSX.utils.aoa_to_sheet(aoa.length === 0 ? [[]] : aoa);
    XLSX.utils.book_append_sheet(wb, ws, name);
  }
  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
}

function bufferToWorkbook(buffer: Buffer): { sheetNames: string[]; data: WorkbookData } {
  const wb = XLSX.read(buffer, { type: "buffer" });
  const data: WorkbookData = {};
  for (const name of wb.SheetNames) {
    const ws = wb.Sheets[name];
    const aoa = XLSX.utils.sheet_to_json<(string | number | boolean | null)[]>(ws, { header: 1, blankrows: false });
    const cells: SheetCell[] = [];
    aoa.forEach((row, r) => {
      row.forEach((value, c) => {
        if (value !== undefined && value !== null && value !== "") {
          cells.push({ row: r, col: c, value });
        }
      });
    });
    data[name] = { cells };
  }
  return { sheetNames: wb.SheetNames, data };
}

// GET /api/excel — list all workbooks for this user
router.get("/excel", requireAuth, async (req, res): Promise<void> => {
  const workbooks = await db.select({
    id: excelWorkbooksTable.id,
    name: excelWorkbooksTable.name,
    description: excelWorkbooksTable.description,
    sheetNames: excelWorkbooksTable.sheetNames,
    createdBy: excelWorkbooksTable.createdBy,
    updatedBy: excelWorkbooksTable.updatedBy,
    createdAt: excelWorkbooksTable.createdAt,
    updatedAt: excelWorkbooksTable.updatedAt,
  }).from(excelWorkbooksTable).orderBy(desc(excelWorkbooksTable.updatedAt));
  res.json({ workbooks, total: workbooks.length });
});

// GET /api/excel/:id — get single workbook with data
router.get("/excel/:id", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const wb = await db.select().from(excelWorkbooksTable).where(eq(excelWorkbooksTable.id, id)).limit(1);
  if (!wb[0]) { res.status(404).json({ error: "Workbook not found" }); return; }
  res.json({ workbook: wb[0] });
});

// POST /api/excel — create workbook
router.post("/excel", requireAuth, async (req, res): Promise<void> => {
  const { name, description, sheetNames, data } = req.body as {
    name: string; description?: string; sheetNames?: string[]; data?: any;
  };
  if (!name) { res.status(400).json({ error: "name is required" }); return; }
  const [wb] = await db.insert(excelWorkbooksTable).values({
    name,
    description: description ?? "",
    sheetNames: sheetNames ?? ["Sheet1"],
    data: data ?? { Sheet1: { cells: [] } },
    createdBy: req.session!.userName ?? "unknown",
    updatedBy: req.session!.userName ?? "unknown",
  }).returning();
  res.status(201).json({ workbook: wb });
});

// PUT /api/excel/:id — save workbook
router.put("/excel/:id", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const { name, description, sheetNames, data } = req.body as {
    name?: string; description?: string; sheetNames?: string[]; data?: any;
  };
  await db.update(excelWorkbooksTable).set({
    ...(name !== undefined && { name }),
    ...(description !== undefined && { description }),
    ...(sheetNames !== undefined && { sheetNames }),
    ...(data !== undefined && { data }),
    updatedBy: req.session!.userName ?? "unknown",
    updatedAt: new Date(),
  }).where(eq(excelWorkbooksTable.id, id));
  res.json({ success: true });
});

// DELETE /api/excel/:id
router.delete("/excel/:id", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  await db.delete(excelWorkbooksTable).where(eq(excelWorkbooksTable.id, id));
  res.json({ success: true });
});

// GET /api/excel/:id/download — download a workbook as .xlsx
router.get("/excel/:id/download", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const [wb] = await db.select().from(excelWorkbooksTable).where(eq(excelWorkbooksTable.id, id)).limit(1);
  if (!wb) { res.status(404).json({ error: "Workbook not found" }); return; }
  const buffer = workbookToBuffer(wb.sheetNames as string[], wb.data as WorkbookData);
  const safeName = String(wb.name ?? "workbook").replace(/[^a-z0-9._-]+/gi, "_");
  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", `attachment; filename="${safeName}.xlsx"`);
  res.send(buffer);
});

// POST /api/excel/upload — import a .xlsx as a new workbook
// Accepts JSON: { name: string, base64: string, description?: string }
router.post("/excel/upload", requireAuth, async (req, res): Promise<void> => {
  const { name, base64, description } = req.body as { name: string; base64: string; description?: string };
  if (!name || !base64) { res.status(400).json({ error: "name and base64 are required" }); return; }
  const buffer = Buffer.from(base64, "base64");
  if (buffer.length === 0) { res.status(400).json({ error: "Empty file" }); return; }
  if (buffer.length > 25 * 1024 * 1024) { res.status(413).json({ error: "File exceeds 25 MB limit" }); return; }
  let parsed: { sheetNames: string[]; data: WorkbookData };
  try {
    parsed = bufferToWorkbook(buffer);
  } catch (err) {
    res.status(400).json({ error: "Invalid Excel file", detail: err instanceof Error ? err.message : String(err) });
    return;
  }
  const [wb] = await db.insert(excelWorkbooksTable).values({
    name,
    description: description ?? "",
    sheetNames: parsed.sheetNames,
    data: parsed.data,
    createdBy: req.session!.userName ?? "unknown",
    updatedBy: req.session!.userName ?? "unknown",
  }).returning();
  res.status(201).json({ workbook: wb });
});

export default router;

import { Router, type IRouter } from "express";
import { db, excelWorkbooksTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth";

const router: IRouter = Router();

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
  const id = parseInt(req.params.id, 10);
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
    createdBy: req.session!.userName,
    updatedBy: req.session!.userName,
  }).returning();
  res.status(201).json({ workbook: wb });
});

// PUT /api/excel/:id — save workbook
router.put("/excel/:id", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  const { name, description, sheetNames, data } = req.body as {
    name?: string; description?: string; sheetNames?: string[]; data?: any;
  };
  await db.update(excelWorkbooksTable).set({
    ...(name !== undefined && { name }),
    ...(description !== undefined && { description }),
    ...(sheetNames !== undefined && { sheetNames }),
    ...(data !== undefined && { data }),
    updatedBy: req.session!.userName,
    updatedAt: new Date(),
  }).where(eq(excelWorkbooksTable.id, id));
  res.json({ success: true });
});

// DELETE /api/excel/:id
router.delete("/excel/:id", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  await db.delete(excelWorkbooksTable).where(eq(excelWorkbooksTable.id, id));
  res.json({ success: true });
});

export default router;

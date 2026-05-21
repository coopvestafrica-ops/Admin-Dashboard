import { Router, type IRouter } from "express";

const router: IRouter = Router();

let guarantorRelationships = [
  { id: "1", borrowerId: "USR001", borrowerName: "Bola Adeyemi", guarantorId: "USR010", guarantorName: "Tunde Alabi", loanAmount: 500000, loanId: "LN-001", status: "active", createdAt: "2024-03-01T00:00:00Z" },
  { id: "2", borrowerId: "USR002", borrowerName: "Chioma Obi", guarantorId: "USR022", guarantorName: "Amaka Osei", loanAmount: 250000, loanId: "LN-002", status: "active", createdAt: "2024-03-15T00:00:00Z" },
  { id: "3", borrowerId: "USR003", borrowerName: "Emeka Nze", guarantorId: "USR031", guarantorName: "Emeka Diala", loanAmount: 1000000, loanId: "LN-003", status: "pending", createdAt: "2024-04-01T00:00:00Z" },
  { id: "4", borrowerId: "USR004", borrowerName: "Fatima Yusuf", guarantorId: "USR045", guarantorName: "Ngozi Adaeze", loanAmount: 350000, loanId: "LN-004", status: "pending", createdAt: "2024-04-10T00:00:00Z" },
  { id: "5", borrowerId: "USR005", borrowerName: "Gbenga Ola", guarantorId: "USR056", guarantorName: "Biodun Akin", loanAmount: 150000, loanId: "LN-005", status: "declined", createdAt: "2024-04-15T00:00:00Z" },
];

let guarantorSettings = { systemEnabled: true, minimumBalanceForGuarantor: 100000, minimumMembershipMonths: 6, maxLoansAsGuarantor: 3, guarantorMustBeVerified: true };

router.get("/guarantors", async (req, res): Promise<void> => {
  const { status } = req.query;
  const filtered = status ? guarantorRelationships.filter((g) => g.status === status) : guarantorRelationships;
  res.json({ relationships: filtered, pendingCount: guarantorRelationships.filter((g) => g.status === "pending").length, total: guarantorRelationships.length });
});

router.get("/guarantors/settings", async (_req, res): Promise<void> => {
  res.json({ settings: guarantorSettings });
});

router.put("/guarantors/settings", async (req, res): Promise<void> => {
  guarantorSettings = { ...guarantorSettings, ...req.body };
  res.json({ settings: guarantorSettings, message: "Guarantor settings updated" });
});

router.put("/guarantors/:id/approve", async (req, res): Promise<void> => {
  const rel = guarantorRelationships.find((g) => g.id === req.params.id);
  if (!rel) { res.status(404).json({ error: "Relationship not found" }); return; }
  rel.status = "active";
  res.json({ relationship: rel, message: "Guarantor relationship approved" });
});

router.put("/guarantors/:id/decline", async (req, res): Promise<void> => {
  const rel = guarantorRelationships.find((g) => g.id === req.params.id);
  if (!rel) { res.status(404).json({ error: "Relationship not found" }); return; }
  rel.status = "declined";
  res.json({ relationship: rel, message: "Guarantor relationship declined" });
});

export default router;

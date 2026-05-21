import { Router, type IRouter } from "express";

const router: IRouter = Router();

let organizations = [
  { id: "1", name: "Federal Ministry of Finance", type: "government", memberCount: 450, status: "active", dateAdded: "2024-01-15T00:00:00Z", contactEmail: "hr@finance.gov.ng", address: "Abuja, Nigeria" },
  { id: "2", name: "First Bank of Nigeria", type: "private", memberCount: 320, status: "active", dateAdded: "2024-02-01T00:00:00Z", contactEmail: "staff@firstbank.com", address: "Lagos, Nigeria" },
  { id: "3", name: "Lagos State University", type: "education", memberCount: 890, status: "active", dateAdded: "2024-02-20T00:00:00Z", contactEmail: "admin@lasu.edu.ng", address: "Lagos, Nigeria" },
  { id: "4", name: "Dangote Group", type: "private", memberCount: 1200, status: "active", dateAdded: "2024-03-01T00:00:00Z", contactEmail: "hr@dangote.com", address: "Lagos, Nigeria" },
  { id: "5", name: "Kano State Government", type: "government", memberCount: 670, status: "pending", dateAdded: "2024-05-10T00:00:00Z", contactEmail: "hr@kanostate.gov.ng", address: "Kano, Nigeria" },
];

const staff: Record<string, { id: string; name: string; email: string; designation: string; memberId: string }[]> = {
  "1": [{ id: "s1", name: "Abubakar Musa", email: "a.musa@finance.gov.ng", designation: "Senior Officer", memberId: "MBR-001" }, { id: "s2", name: "Grace Okafor", email: "g.okafor@finance.gov.ng", designation: "Analyst", memberId: "MBR-002" }],
  "2": [{ id: "s3", name: "Tunde Bakare", email: "t.bakare@firstbank.com", designation: "Branch Manager", memberId: "MBR-003" }],
};

router.get("/organizations", async (_req, res): Promise<void> => {
  res.json({ organizations, total: organizations.length });
});

router.post("/organizations", async (req, res): Promise<void> => {
  const org = { id: String(Date.now()), ...req.body, memberCount: 0, dateAdded: new Date().toISOString() };
  organizations.push(org);
  res.status(201).json({ organization: org });
});

router.put("/organizations/:id", async (req, res): Promise<void> => {
  const idx = organizations.findIndex((o) => o.id === req.params.id);
  if (idx === -1) { res.status(404).json({ error: "Organization not found" }); return; }
  organizations[idx] = { ...organizations[idx], ...req.body };
  res.json({ organization: organizations[idx] });
});

router.get("/organizations/:id/staff", async (req, res): Promise<void> => {
  res.json({ staff: staff[req.params.id] ?? [], organizationId: req.params.id });
});

export default router;

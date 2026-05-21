import { Router, type IRouter } from "express";

const router: IRouter = Router();

let kycSubmissions = [
  { id: "1", userId: "USR001", userName: "Bola Adeyemi", email: "bola@email.com", documentType: "NIN", documentNumber: "1234****890", submittedAt: new Date(Date.now() - 86400000).toISOString(), status: "pending", rejectionReason: null },
  { id: "2", userId: "USR002", userName: "Chioma Obi", email: "chioma@email.com", documentType: "BVN", documentNumber: "2234****891", submittedAt: new Date(Date.now() - 172800000).toISOString(), status: "verified", rejectionReason: null },
  { id: "3", userId: "USR003", userName: "Emeka Nze", email: "emeka@email.com", documentType: "Passport", documentNumber: "A1234****", submittedAt: new Date(Date.now() - 259200000).toISOString(), status: "rejected", rejectionReason: "Document expired" },
  { id: "4", userId: "USR004", userName: "Fatima Yusuf", email: "fatima@email.com", documentType: "NIN", documentNumber: "3344****892", submittedAt: new Date(Date.now() - 43200000).toISOString(), status: "pending", rejectionReason: null },
  { id: "5", userId: "USR005", userName: "Gbenga Ola", email: "gbenga@email.com", documentType: "BVN", documentNumber: "4454****893", submittedAt: new Date(Date.now() - 3600000).toISOString(), status: "pending", rejectionReason: null },
];

router.get("/verification", async (req, res): Promise<void> => {
  const { status, documentType } = req.query;
  let filtered = [...kycSubmissions];
  if (status) filtered = filtered.filter((k) => k.status === status);
  if (documentType) filtered = filtered.filter((k) => k.documentType === documentType);
  res.json({ submissions: filtered, total: filtered.length });
});

router.get("/verification/stats", async (_req, res): Promise<void> => {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  res.json({
    pendingKYC: kycSubmissions.filter((k) => k.status === "pending").length,
    verifiedToday: kycSubmissions.filter((k) => k.status === "verified" && new Date(k.submittedAt) >= today).length,
    rejected: kycSubmissions.filter((k) => k.status === "rejected").length,
    totalVerified: kycSubmissions.filter((k) => k.status === "verified").length,
  });
});

router.put("/verification/:id/verify", async (req, res): Promise<void> => {
  const sub = kycSubmissions.find((k) => k.id === req.params.id);
  if (!sub) { res.status(404).json({ error: "Submission not found" }); return; }
  sub.status = "verified";
  res.json({ submission: sub, message: "KYC verified successfully" });
});

router.put("/verification/:id/reject", async (req, res): Promise<void> => {
  const sub = kycSubmissions.find((k) => k.id === req.params.id);
  if (!sub) { res.status(404).json({ error: "Submission not found" }); return; }
  sub.status = "rejected";
  sub.rejectionReason = req.body.reason ?? "Does not meet requirements";
  res.json({ submission: sub, message: "KYC rejected" });
});

export default router;

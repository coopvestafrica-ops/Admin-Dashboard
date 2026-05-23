import { Router, type IRouter } from "express";
import { readData, writeData } from "../lib/store";

const router: IRouter = Router();

const defaultKycSubmissions = [
  { id: "1", userId: "USR001", userName: "Bola Adeyemi", email: "bola@email.com", documentType: "NIN", documentNumber: "1234****890", submittedAt: new Date(Date.now() - 86400000).toISOString(), status: "pending", rejectionReason: null },
  { id: "2", userId: "USR002", userName: "Chioma Obi", email: "chioma@email.com", documentType: "BVN", documentNumber: "2234****891", submittedAt: new Date(Date.now() - 172800000).toISOString(), status: "verified", rejectionReason: null },
  { id: "3", userId: "USR003", userName: "Emeka Nze", email: "emeka@email.com", documentType: "Passport", documentNumber: "A1234****", submittedAt: new Date(Date.now() - 259200000).toISOString(), status: "rejected", rejectionReason: "Document expired" },
  { id: "4", userId: "USR004", userName: "Fatima Yusuf", email: "fatima@email.com", documentType: "NIN", documentNumber: "3344****892", submittedAt: new Date(Date.now() - 43200000).toISOString(), status: "pending", rejectionReason: null },
  { id: "5", userId: "USR005", userName: "Gbenga Ola", email: "gbenga@email.com", documentType: "BVN", documentNumber: "4454****893", submittedAt: new Date(Date.now() - 3600000).toISOString(), status: "pending", rejectionReason: null },
];

router.get("/verification", async (req, res): Promise<void> => {
  const kycSubmissions = await readData("kyc_submissions.json", defaultKycSubmissions);
  const { status, documentType } = req.query;
  let filtered = [...kycSubmissions];
  if (status) filtered = filtered.filter((v) => v.status === status);
  if (documentType) filtered = filtered.filter((v) => v.documentType === documentType);
  res.json({ submissions: filtered, pendingCount: kycSubmissions.filter((v) => v.status === "pending").length, total: kycSubmissions.length });
});

router.put("/verification/:id/verify", async (req, res): Promise<void> => {
  const kycSubmissions = await readData("kyc_submissions.json", defaultKycSubmissions);
  const { id } = req.params;
  const sub = kycSubmissions.find((v) => v.id === id);
  if (!sub) { res.status(404).json({ error: "KYC Submission not found" }); return; }
  sub.status = "verified";
  await writeData("kyc_submissions.json", kycSubmissions);
  res.json({ submission: sub, message: "KYC submission verified" });
});

router.put("/verification/:id/reject", async (req, res): Promise<void> => {
  const kycSubmissions = await readData("kyc_submissions.json", defaultKycSubmissions);
  const { id } = req.params;
  const { reason } = req.body;
  const sub = kycSubmissions.find((v) => v.id === id);
  if (!sub) { res.status(404).json({ error: "KYC Submission not found" }); return; }
  sub.status = "rejected";
  sub.rejectionReason = reason || "Rejection reason not provided";
  await writeData("kyc_submissions.json", kycSubmissions);
  res.json({ submission: sub, message: "KYC submission rejected" });
});

export default router;

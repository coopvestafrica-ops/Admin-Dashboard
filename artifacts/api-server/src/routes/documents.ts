/**
 * Document Management / Member Document Vault (Module 13).
 *
 * Secure storage for member identity documents, loan agreements, guarantor
 * agreements, payment receipts and legal documents. Access is role-controlled
 * and every view/download is logged in document_access_log.
 */
import { Router, type IRouter } from "express";
import { supabase } from "../lib/supabase.js";
import {
  requireAuth,
  requireRole,
  type AuthenticatedRequest,
} from "../middleware/auth.js";
import { logAudit } from "../lib/audit.js";

const router: IRouter = Router();

router.use(requireAuth);

/** GET /documents?memberId= — list documents for a member (filtered by access role). */
router.get("/documents", async (req, res): Promise<void> => {
  const user = (req as AuthenticatedRequest).user;
  const { memberId } = req.query;

  let query = supabase
    .from("member_documents")
    .select("id, member_id, document_type, title, file_url, file_size, mime_type, uploaded_by, access_roles, is_confidential, created_at")
    .order("created_at", { ascending: false });

  if (memberId) query = query.eq("member_id", memberId);

  const { data, error } = await query;
  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  // Enforce per-document access_roles on the server side too.
  const role = user?.role ?? "member";
  const filtered = (data ?? []).filter((doc: any) => {
    const roles: string[] = Array.isArray(doc.access_roles) ? doc.access_roles : [];
    return role === "super_admin" || roles.includes(role);
  });

  res.json({ success: true, data: filtered });
});

/** POST /documents — upload a document record (admin+). */
router.post(
  "/documents",
  requireRole("admin", "super_admin"),
  async (req, res): Promise<void> => {
    const user = (req as AuthenticatedRequest).user;
    const { memberId, documentType, title, fileUrl, fileSize, mimeType, accessRoles, isConfidential } = req.body ?? {};

    if (!memberId || !documentType || !title || !fileUrl) {
      res.status(400).json({ error: "memberId, documentType, title and fileUrl are required" });
      return;
    }

    const { data, error } = await supabase
      .from("member_documents")
      .insert({
        member_id: memberId,
        document_type: documentType,
        title,
        file_url: fileUrl,
        file_size: fileSize ?? null,
        mime_type: mimeType ?? null,
        uploaded_by: user?.profileId,
        access_roles: Array.isArray(accessRoles) && accessRoles.length ? accessRoles : ["super_admin", "admin"],
        is_confidential: isConfidential ?? true,
      })
      .select()
      .single();

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }

    await logAudit({
      profileId: user?.profileId,
      action: "DOCUMENT_UPLOADED",
      resourceType: "member_documents",
      resourceId: data.id,
      details: { memberId, documentType, title },
    });

    res.status(201).json({ success: true, data });
  },
);

/** GET /documents/:id/access-log — view who accessed a document (admin+). */
router.get(
  "/documents/:id/access-log",
  requireRole("admin", "super_admin"),
  async (req, res): Promise<void> => {
    const { data, error } = await supabase
      .from("document_access_log")
      .select("*")
      .eq("document_id", req.params.id)
      .order("created_at", { ascending: false });

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    res.json({ success: true, data: data ?? [] });
  },
);

/** POST /documents/:id/access — record a view/download event and return the file url. */
router.post("/documents/:id/access", async (req, res): Promise<void> => {
  const user = (req as AuthenticatedRequest).user;
  const accessType = (req.body?.accessType ?? "view").toString();
  if (!["view", "download"].includes(accessType)) {
    res.status(400).json({ error: "accessType must be 'view' or 'download'" });
    return;
  }

  const { data: doc, error } = await supabase
    .from("member_documents")
    .select("id, file_url, access_roles, title, member_id")
    .eq("id", req.params.id)
    .single();

  if (error || !doc) {
    res.status(404).json({ error: "Document not found" });
    return;
  }

  const role = user?.role ?? "member";
  const roles: string[] = Array.isArray(doc.access_roles) ? doc.access_roles : [];
  if (role !== "super_admin" && !roles.includes(role)) {
    res.status(403).json({ error: "You do not have access to this document" });
    return;
  }

  await supabase.from("document_access_log").insert({
    document_id: doc.id,
    accessed_by: user?.profileId,
    access_type: accessType,
    ip_address: req.ip ?? null,
  });

  await logAudit({
    profileId: user?.profileId,
    action: `DOCUMENT_${accessType.toUpperCase()}`,
    resourceType: "member_documents",
    resourceId: doc.id,
    details: { title: doc.title, memberId: doc.member_id },
    ipAddress: req.ip ?? null,
  });

  res.json({ success: true, fileUrl: doc.file_url });
});

/** DELETE /documents/:id — remove a document (super_admin only). */
router.delete(
  "/documents/:id",
  requireRole("super_admin"),
  async (req, res): Promise<void> => {
    const user = (req as AuthenticatedRequest).user;
    const { data: doc } = await supabase
      .from("member_documents")
      .select("id, title")
      .eq("id", req.params.id)
      .single();

    const { error } = await supabase
      .from("member_documents")
      .delete()
      .eq("id", req.params.id);

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }

    await logAudit({
      profileId: user?.profileId,
      action: "DOCUMENT_DELETED",
      resourceType: "member_documents",
      resourceId: req.params.id,
      details: { title: doc?.title ?? null },
    });

    res.json({ success: true });
  },
);

export default router;

import { Router, type Request, type Response } from "express";
import { supabase, splitName } from "../lib/supabase.js";
import { logger } from "../lib/logger.js";
import multer from "multer";

const router = Router();

// Middleware to verify token
async function verifyToken(req: Request, res: Response) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: "No authorization token provided" });
    return null;
  }
  const token = authHeader.substring(7);
  try {
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) {
      res.status(401).json({ error: "Invalid or expired token" });
      return null;
    }
    return user;
  } catch (err) {
    logger.error({ err }, "Token verification error");
    res.status(401).json({ error: "Token verification failed" });
    return null;
  }
}

// Helper to upload file to Supabase Storage
async function uploadFile(userId: string, file: Express.Multer.File, folder: string): Promise<string | null> {
  try {
    const fileExt = file.originalname.split('.').pop() || 'jpg';
    const fileName = `${userId}/${folder}/${Date.now()}.${fileExt}`;
    const filePath = `avatars/${fileName}`;

    const { data, error } = await supabase.storage
      .from('kyc-documents')
      .upload(filePath, file.buffer, {
        contentType: file.mimetype,
        upsert: true,
      });

    if (error) {
      logger.error({ error }, "Storage upload error");
      return null;
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('kyc-documents')
      .getPublicUrl(filePath);

    return urlData.publicUrl;
  } catch (err) {
    logger.error({ err }, "File upload error");
    return null;
  }
}

// Configure multer for file uploads
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  }
});

// ─── POST /kyc/upload-id ───────────────────────────────────────────────────
router.post("/kyc/upload-id", upload.single('document'), async (req: Request, res: Response) => {
  const user = await verifyToken(req, res);
  if (!user) return;

  try {
    const file = req.file;
    if (!file) {
      res.status(400).json({ error: "No file uploaded" });
      return;
    }

    const url = await uploadFile(user.id, file, 'id');
    if (!url) {
      res.status(500).json({ error: "Failed to upload file" });
      return;
    }

    // Save ID document URL to kyc table
    const { error: kycError } = await supabase
      .from("kyc")
      .upsert({
        profile_id: user.id,
        id_document_url: url,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'profile_id' });

    if (kycError) {
      logger.error({ kycError }, "Failed to save ID document URL");
    }

    res.json({ path: url });
  } catch (err) {
    logger.error({ err }, "Upload ID error");
    res.status(500).json({ error: "Upload failed" });
  }
});

// ─── POST /kyc/upload-selfie ───────────────────────────────────────────────
router.post("/kyc/upload-selfie", upload.single('selfie'), async (req: Request, res: Response) => {
  const user = await verifyToken(req, res);
  if (!user) return;

  try {
    const file = req.file;
    if (!file) {
      res.status(400).json({ error: "No file uploaded" });
      return;
    }

    const url = await uploadFile(user.id, file, 'selfie');
    if (!url) {
      res.status(500).json({ error: "Failed to upload file" });
      return;
    }

    // Save selfie URL to kyc table
    const { error: kycError } = await supabase
      .from("kyc")
      .upsert({
        profile_id: user.id,
        selfie_url: url,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'profile_id' });

    if (kycError) {
      logger.error({ kycError }, "Failed to save selfie URL");
    }

    // Also update avatar_url in profiles table for profile picture
    const { error: profileError } = await supabase
      .from("profiles")
      .update({ avatar_url: url })
      .eq("id", user.id);

    if (profileError) {
      logger.error({ profileError }, "Failed to update avatar URL");
    }

    res.json({ path: url });
  } catch (err) {
    logger.error({ err }, "Upload selfie error");
    res.status(500).json({ error: "Upload failed" });
  }
});

// ─── POST /kyc/upload-avatar ───────────────────────────────────────────────
router.post("/kyc/upload-avatar", upload.single('avatar'), async (req: Request, res: Response) => {
  const user = await verifyToken(req, res);
  if (!user) return;

  try {
    const file = req.file;
    if (!file) {
      res.status(400).json({ error: "No file uploaded" });
      return;
    }

    const url = await uploadFile(user.id, file, 'avatar');
    if (!url) {
      res.status(500).json({ error: "Failed to upload file" });
      return;
    }

    // Update avatar_url in profiles table
    const { error } = await supabase
      .from("profiles")
      .update({ avatar_url: url })
      .eq("id", user.id);

    if (error) {
      logger.error({ error }, "Failed to update avatar URL");
      res.status(500).json({ error: "Failed to save avatar" });
      return;
    }

    res.json({ path: url });
  } catch (err) {
    logger.error({ err }, "Upload avatar error");
    res.status(500).json({ error: "Upload failed" });
  }
});

// ─── GET /kyc/status ──────────────────────────────────────────────────────
router.get("/kyc/status", async (req: Request, res: Response) => {
  const user = await verifyToken(req, res);
  if (!user) return;

  try {
    const { data, error } = await supabase
      .from("kyc")
      .select("*")
      .eq("profile_id", user.id)
      .single();

    if (error && error.code !== 'PGRST116') {
      logger.error({ error }, "Get KYC status error");
      res.status(500).json({ error: "Failed to get KYC status" });
      return;
    }

    res.json(data || {
      profile_id: user.id,
      status: 'not_started',
      id_document_url: null,
      selfie_url: null,
    });
  } catch (err) {
    logger.error({ err }, "Get KYC status error");
    res.status(500).json({ error: "Failed to get KYC status" });
  }
});

// ─── POST /kyc/submit ────────────────────────────────────────────────────
router.post("/kyc/submit", async (req: Request, res: Response) => {
  const user = await verifyToken(req, res);
  if (!user) return;

  try {
    const { status, ...kycData } = req.body;

    const { data, error } = await supabase
      .from("kyc")
      .upsert({
        profile_id: user.id,
        ...kycData,
        status: status || 'pending',
        updated_at: new Date().toISOString(),
      }, { onConflict: 'profile_id' })
      .select()
      .single();

    if (error) {
      logger.error({ error }, "Submit KYC error");
      res.status(500).json({ error: "Failed to submit KYC" });
      return;
    }

    res.json({ data });
  } catch (err) {
    logger.error({ err }, "Submit KYC error");
    res.status(500).json({ error: "Submit failed" });
  }
});

export default router;

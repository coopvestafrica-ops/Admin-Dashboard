import { Router, type IRouter } from "express";
import { db, usersTable, loginAttemptsTable, featureFlagsTable, trustedLocationsTable, blockedIpsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import bcrypt from "bcryptjs";
import QRCode from "qrcode";
import crypto from "crypto";

const router: IRouter = Router();

// --- Simple TOTP implementation (RFC 6238) ---
function base32Decode(encoded: string): Buffer {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = 0, value = 0;
  const bytes: number[] = [];
  for (const char of encoded.toUpperCase().replace(/=/g, "")) {
    const idx = chars.indexOf(char);
    if (idx === -1) continue;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) { bytes.push((value >>> (bits - 8)) & 0xff); bits -= 8; }
  }
  return Buffer.from(bytes);
}

function generateTotp(secret: string, step = 30): string {
  const time = Math.floor(Date.now() / 1000 / step);
  const timeBuf = Buffer.alloc(8);
  timeBuf.writeUInt32BE(0, 0);
  timeBuf.writeUInt32BE(time >>> 0, 4);
  const key = base32Decode(secret);
  const hmac = crypto.createHmac("sha1", key).update(timeBuf).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const code = ((hmac[offset] & 0x7f) << 24) | (hmac[offset + 1] << 16) | (hmac[offset + 2] << 8) | hmac[offset + 3];
  return String(code % 1000000).padStart(6, "0");
}

function verifyTotp(token: string, secret: string, step = 30, window = 1): boolean {
  const time = Math.floor(Date.now() / 1000 / step);
  for (let i = -window; i <= window; i++) {
    const timeBuf = Buffer.alloc(8);
    timeBuf.writeUInt32BE(0, 0);
    timeBuf.writeUInt32BE((time + i) >>> 0, 4);
    const key = base32Decode(secret);
    const hmac = crypto.createHmac("sha1", key).update(timeBuf).digest();
    const offset = hmac[hmac.length - 1] & 0x0f;
    const code = ((hmac[offset] & 0x7f) << 24) | (hmac[offset + 1] << 16) | (hmac[offset + 2] << 8) | hmac[offset + 3];
    const expected = String(code % 1000000).padStart(6, "0");
    if (expected === token) return true;
  }
  return false;
}

function generateTotpSecret(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  return Array.from({ length: 32 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

// --- Helpers ---
function getClientIp(req: any): string {
  return (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() || req.socket?.remoteAddress || "unknown";
}

async function logAttempt(data: {
  email: string; ip: string; success: boolean;
  country?: string; countryCode?: string; city?: string;
  userAgent?: string; failureReason?: string;
}) {
  try {
    await db.insert(loginAttemptsTable).values({
      email: data.email,
      ipAddress: data.ip,
      success: data.success,
      country: data.country,
      countryCode: data.countryCode,
      city: data.city,
      userAgent: data.userAgent,
      failureReason: data.failureReason,
    });
  } catch { }
}

async function getGeoInfo(ip: string): Promise<{ country?: string; countryCode?: string; city?: string }> {
  try {
    if (ip === "unknown" || ip.startsWith("127.") || ip.startsWith("::1") || ip.startsWith("10.") || ip.startsWith("192.168.")) {
      return { country: "Local Network", countryCode: "LO", city: "localhost" };
    }
    const geoip = await import("geoip-lite");
    const geo = geoip.default.lookup(ip);
    if (geo) return { country: geo.country, countryCode: geo.country, city: geo.city };
    return {};
  } catch {
    return {};
  }
}

// POST /api/auth/login
router.post("/auth/login", async (req, res): Promise<void> => {
  const { email, password, mfaCode } = req.body as { email: string; password: string; mfaCode?: string };
  const ip = getClientIp(req);
  const userAgent = req.headers["user-agent"];
  const geo = await getGeoInfo(ip);

  if (!email || !password) {
    res.status(400).json({ error: "Email and password are required" });
    return;
  }

  // Check blocked IP
  try {
    const blockedIp = await db.select().from(blockedIpsTable).where(eq(blockedIpsTable.ipAddress, ip)).limit(1);
    if (blockedIp.length > 0) {
      await logAttempt({ email, ip, success: false, ...geo, userAgent, failureReason: "IP blocked" });
      res.status(403).json({ error: "Access denied from this IP address. Contact your administrator." });
      return;
    }
  } catch { }

  // Get user
  const users = await db.select().from(usersTable).where(eq(usersTable.email, email.toLowerCase())).limit(1);
  const user = users[0];

  if (!user) {
    await logAttempt({ email, ip, success: false, ...geo, userAgent, failureReason: "User not found" });
    res.status(401).json({ error: "Invalid email or password" });
    return;
  }

  if (user.lockedUntil && user.lockedUntil > new Date()) {
    const minutes = Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60000);
    await logAttempt({ email, ip, success: false, ...geo, userAgent, failureReason: "Account locked" });
    res.status(423).json({ error: `Account temporarily locked. Try again in ${minutes} minute(s).` });
    return;
  }

  if (!user.isActive) {
    await logAttempt({ email, ip, success: false, ...geo, userAgent, failureReason: "Account inactive" });
    res.status(403).json({ error: "Account is deactivated. Contact your administrator." });
    return;
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    const newAttempts = user.failedAttempts + 1;
    const lockUntil = newAttempts >= 5 ? new Date(Date.now() + 15 * 60 * 1000) : null;
    await db.update(usersTable).set({ failedAttempts: newAttempts, lockedUntil: lockUntil }).where(eq(usersTable.id, user.id));
    await logAttempt({ email, ip, success: false, ...geo, userAgent, failureReason: "Wrong password" });
    const remaining = Math.max(0, 5 - newAttempts);
    res.status(401).json({
      error: remaining > 0
        ? `Invalid email or password. ${remaining} attempt(s) remaining before lockout.`
        : "Too many failed attempts. Account locked for 15 minutes.",
    });
    return;
  }

  // Check MFA if enabled
  if (user.mfaEnabled && user.mfaSecret) {
    if (!mfaCode) {
      res.status(200).json({ requiresMfa: true });
      return;
    }
    const isValidMfa = verifyTotp(mfaCode, user.mfaSecret);
    if (!isValidMfa) {
      await logAttempt({ email, ip, success: false, ...geo, userAgent, failureReason: "Invalid MFA code" });
      res.status(401).json({ error: "Invalid authentication code" });
      return;
    }
  }

  // Geo-blocking check
  try {
    const geoFlag = await db.select().from(featureFlagsTable).where(eq(featureFlagsTable.key, "geo_blocking")).limit(1);
    if (geoFlag[0]?.isEnabled && geo.countryCode && geo.countryCode !== "LO") {
      const allowed = await db.select().from(trustedLocationsTable)
        .where(and(eq(trustedLocationsTable.countryCode, geo.countryCode), eq(trustedLocationsTable.isAllowed, true)))
        .limit(1);
      if (allowed.length === 0) {
        await logAttempt({ email, ip, success: false, ...geo, userAgent, failureReason: "Geo-blocked country" });
        res.status(403).json({
          error: `Access denied from ${geo.country || "your location"}. This location is not authorized.`,
          geoBlocked: true,
          country: geo.country,
        });
        return;
      }
    }
  } catch { }

  // Success
  await db.update(usersTable)
    .set({ failedAttempts: 0, lockedUntil: null, lastLoginAt: new Date(), lastLoginIp: ip })
    .where(eq(usersTable.id, user.id));

  await logAttempt({ email, ip, success: true, ...geo, userAgent });

  req.session.userId = user.id;
  req.session.userEmail = user.email;
  req.session.userName = user.name;
  req.session.userRole = user.role as any;

  res.json({
    user: {
      id: user.id, email: user.email, name: user.name, role: user.role,
      mfaEnabled: user.mfaEnabled, mustChangePassword: user.mustChangePassword,
    },
  });
});

// POST /api/auth/logout
router.post("/auth/logout", (req, res): void => {
  req.session.destroy(() => {
    res.json({ success: true });
  });
});

// GET /api/auth/me
router.get("/auth/me", async (req, res): Promise<void> => {
  if (!req.session?.userId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  const users = await db.select({
    id: usersTable.id, email: usersTable.email, name: usersTable.name,
    role: usersTable.role, mfaEnabled: usersTable.mfaEnabled,
    mustChangePassword: usersTable.mustChangePassword,
    lastLoginAt: usersTable.lastLoginAt, lastLoginIp: usersTable.lastLoginIp,
  }).from(usersTable).where(eq(usersTable.id, req.session.userId)).limit(1);

  if (!users[0]) {
    req.session.destroy(() => { });
    res.status(401).json({ error: "User not found" });
    return;
  }
  res.json({ user: users[0] });
});

// POST /api/auth/change-password
router.post("/auth/change-password", async (req, res): Promise<void> => {
  if (!req.session?.userId) { res.status(401).json({ error: "Not authenticated" }); return; }
  const { currentPassword, newPassword } = req.body as { currentPassword: string; newPassword: string };
  if (!currentPassword || !newPassword || newPassword.length < 8) {
    res.status(400).json({ error: "New password must be at least 8 characters" });
    return;
  }
  const users = await db.select().from(usersTable).where(eq(usersTable.id, req.session.userId)).limit(1);
  if (!users[0]) { res.status(404).json({ error: "User not found" }); return; }
  const valid = await bcrypt.compare(currentPassword, users[0].passwordHash);
  if (!valid) { res.status(401).json({ error: "Current password is incorrect" }); return; }
  const hash = await bcrypt.hash(newPassword, 12);
  await db.update(usersTable).set({ passwordHash: hash, mustChangePassword: false, updatedAt: new Date() }).where(eq(usersTable.id, req.session.userId));
  res.json({ success: true });
});

// POST /api/auth/setup-mfa
router.post("/auth/setup-mfa", async (req, res): Promise<void> => {
  if (!req.session?.userId) { res.status(401).json({ error: "Not authenticated" }); return; }
  const user = await db.select().from(usersTable).where(eq(usersTable.id, req.session.userId)).limit(1);
  if (!user[0]) { res.status(404).json({ error: "User not found" }); return; }

  const secret = generateTotpSecret();
  const otpauth = `otpauth://totp/CoopVest%20Africa:${encodeURIComponent(user[0].email)}?secret=${secret}&issuer=CoopVest%20Africa&algorithm=SHA1&digits=6&period=30`;
  const qrCode = await QRCode.toDataURL(otpauth);

  await db.update(usersTable).set({ mfaSecret: secret }).where(eq(usersTable.id, req.session.userId));
  res.json({ secret, qrCode });
});

// POST /api/auth/confirm-mfa
router.post("/auth/confirm-mfa", async (req, res): Promise<void> => {
  if (!req.session?.userId) { res.status(401).json({ error: "Not authenticated" }); return; }
  const { code } = req.body as { code: string };
  const user = await db.select().from(usersTable).where(eq(usersTable.id, req.session.userId)).limit(1);
  if (!user[0]?.mfaSecret) { res.status(400).json({ error: "MFA setup not initiated" }); return; }

  const valid = verifyTotp(code, user[0].mfaSecret);
  if (!valid) { res.status(400).json({ error: "Invalid code" }); return; }

  await db.update(usersTable).set({ mfaEnabled: true }).where(eq(usersTable.id, req.session.userId));
  res.json({ success: true });
});

// POST /api/auth/disable-mfa
router.post("/auth/disable-mfa", async (req, res): Promise<void> => {
  if (!req.session?.userId) { res.status(401).json({ error: "Not authenticated" }); return; }
  await db.update(usersTable).set({ mfaEnabled: false, mfaSecret: null }).where(eq(usersTable.id, req.session.userId));
  res.json({ success: true });
});

export default router;

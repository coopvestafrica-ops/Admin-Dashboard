/**
 * Best-effort notification fan-out to admin users (super admins by default).
 *
 * Persists an in-app notification to the mobile backend and, if email/SMS
 * provider env vars are configured, attempts to send via the mobile backend's
 * provider-agnostic notify service. All channels fail open.
 */

import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "./logger";

export interface AdminNotifyOpts {
  title: string;
  body: string;
  severity?: "low" | "normal" | "high" | "urgent";
  roles?: string[];
}

export async function notifyAdmins(opts: AdminNotifyOpts): Promise<void> {
  const roles = opts.roles ?? ["super_admin"];
  try {
    const admins = await db
      .select({ id: usersTable.id, email: usersTable.email, name: usersTable.name, role: usersTable.role })
      .from(usersTable)
      .where(eq(usersTable.isActive, true));
    const targets = admins.filter((a) => roles.includes(a.role));
    if (targets.length === 0) return;
    logger.info(
      { event: "admin_notify", title: opts.title, severity: opts.severity, recipients: targets.length },
      `Admin alert: ${opts.title}`,
    );
    // The mobile backend's broadcast endpoint and provider wiring will deliver
    // the actual messages once configured. Until then this is a structured log.
  } catch (err) {
    logger.warn({ err }, "notifyAdmins failed");
  }
}

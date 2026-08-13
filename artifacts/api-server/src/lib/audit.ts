import { supabase } from "./supabase.js";

export interface AuditEntry {
  profileId: string | null | undefined;
  action: string;
  resourceType?: string | null;
  resourceId?: string | null;
  details?: Record<string, unknown> | null;
  ipAddress?: string | null;
}

/**
 * Append a row to `admin_audit_logs` — the central audit trail for every
 * sensitive admin action (maker and checker). Failures are swallowed so a
 * logging problem never blocks the main operation, but the error is surfaced
 * via the logger for observability.
 */
export async function logAudit(entry: AuditEntry): Promise<void> {
  try {
    await supabase.from("admin_audit_logs").insert({
      profile_id: entry.profileId ?? null,
      action: entry.action,
      resource_type: entry.resourceType ?? null,
      resource_id: entry.resourceId ?? null,
      details: entry.details ?? null,
      ip_address: entry.ipAddress ?? null,
    });
  } catch (err) {
    // Audit logging must never break the main flow. Log and continue.
    // eslint-disable-next-line no-console
    console.error("[audit] failed to write audit log:", err);
  }
}

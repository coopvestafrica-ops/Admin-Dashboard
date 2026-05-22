import type { Request, Response, NextFunction } from "express";
import { supabase } from "@workspace/db";

// Extend Express Request to carry the authenticated user and their role
export interface AuthenticatedRequest extends Request {
  user: { id: string; email?: string; role?: string };
}

// ── Fix #4: requireAuth – verify JWT and attach user + role ──────────────────
export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res.status(401).json({ error: "Missing or invalid Authorization header" });
    return;
  }

  const token = authHeader.slice(7);
  const { data, error } = await supabase.auth.getUser(token);

  if (error || !data.user) {
    res.status(401).json({ error: "Invalid or expired token" });
    return;
  }

  // Read the user's role from app_metadata (set by your admin edge function / Supabase backend)
  const role =
    (data.user.app_metadata?.role as string | undefined) ??
    (data.user.user_metadata?.role as string | undefined) ??
    "member";

  (req as AuthenticatedRequest).user = {
    id: data.user.id,
    email: data.user.email,
    role,
  };

  next();
}

// ── Fix #4: requireRole – restrict endpoints to specific admin roles ──────────
const ROLE_HIERARCHY: Record<string, number> = {
  super_admin: 4,
  admin: 3,
  operator: 2,
  viewer: 1,
  member: 0,
};

/**
 * Middleware factory that enforces a minimum role level.
 *
 * Usage:
 *   router.post("/loans/:id/approve", requireAuth, requireRole("operator"), handler)
 *
 * Roles (ascending privilege): member → viewer → operator → admin → super_admin
 */
export function requireRole(...allowedRoles: string[]) {
  return function roleGuard(
    req: Request,
    res: Response,
    next: NextFunction,
  ): void {
    const user = (req as AuthenticatedRequest).user;

    if (!user) {
      res.status(401).json({ error: "Not authenticated" });
      return;
    }

    const userLevel = ROLE_HIERARCHY[user.role ?? "member"] ?? 0;
    const hasPermission = allowedRoles.some(
      (r) => userLevel >= (ROLE_HIERARCHY[r] ?? 0),
    );

    if (!hasPermission) {
      res.status(403).json({
        error: `Insufficient permissions. Required: one of [${allowedRoles.join(", ")}]. Your role: ${user.role}`,
      });
      return;
    }

    next();
  };
}

import { RequestHandler } from "express";

export type AdminRole = "super_admin" | "finance_admin" | "operations_admin" | "org_admin" | "staff";

declare module "express-session" {
  interface SessionData {
    userId: number;
    userEmail: string;
    userName: string;
    userRole: AdminRole;
  }
}

export const requireAuth: RequestHandler = (req, res, next) => {
  if (!req.session?.userId) {
    res.status(401).json({ error: "Unauthorized. Please log in." });
    return;
  }
  next();
};

export const requireRole = (...roles: AdminRole[]): RequestHandler => {
  return (req, res, next) => {
    if (!req.session?.userId) {
      res.status(401).json({ error: "Unauthorized. Please log in." });
      return;
    }
    if (!roles.includes(req.session.userRole as AdminRole)) {
      res.status(403).json({ error: `Access denied. Required role: ${roles.join(" or ")}` });
      return;
    }
    next();
  };
};

export const requireSuperAdmin: RequestHandler = requireRole("super_admin");

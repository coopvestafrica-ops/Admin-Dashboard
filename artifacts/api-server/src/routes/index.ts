import { Router, type IRouter } from "express";
import { requireAuth } from "../middleware/auth.js";
import { rateLimiter, trackLoginAttempt } from "../middleware/security.js";
import healthRouter from "./health.js";
import setupRouter from "./setup.js";
import authRouter from "./auth.js";
import passwordResetRouter from "./password_reset.js";
import dashboardRouter from "./dashboard.js";
import membersRouter from "./members.js";
import loansRouter from "./loans.js";
import contributionsRouter from "./contributions.js";
import investmentsRouter from "./investments.js";
import complianceRouter from "./compliance.js";
import notificationsRouter from "./notifications.js";
import auditLogsRouter from "./audit_logs.js";
import supportRouter from "./support.js";
import riskScoringRouter from "./risk_scoring.js";
import interestRatesRouter from "./interest_rates.js";
import rolloversRouter from "./rollovers.js";
import payrollRouter from "./payroll.js";
// New command-center routes
import mobileFeaturesRouter from "./mobile_features.js";
import rolesRouter from "./roles.js";
import fraudDetectionRouter from "./fraud_detection.js";
import organizationsRouter from "./organizations.js";
import analyticsRouter from "./analytics.js";
import securityRouter from "./security.js";
import walletsRouter from "./wallets.js";
import withdrawalsRouter from "./withdrawals.js";
import verificationRouter from "./verification.js";
import referralsRouter from "./referrals.js";
import guarantorsRouter from "./guarantors.js";
// Mobile app guarantor routes (at root level for mobile app compatibility)
import guarantorRouter from "./guarantor.js";
// New feature routes
import systemRouter from "./system.js";
import reportsRouter from "./reports.js";
import sessionsRouter from "./sessions.js";
import bulkRouter from "./bulk.js";
import reconciliationRouter from "./reconciliation.js";
import loginHistoryRouter from "./login_history.js";
import excelUploadsRouter from "./excel-uploads.js";
import depositsRouter from "./deposits.js";
// Statistics routes for frontend dashboard
import statisticsRouter from "./statistics.js";
// KYC routes for mobile app
import kycRouter from "./kyc.js";
// Accounting routes for financial operations
import accountingRouter from "./accounting.js";

const router: IRouter = Router();

// Public — no auth required
router.use(healthRouter);

// Rate limiting for all requests
router.use(rateLimiter);

// Auth routes — public endpoints for mobile app (with login tracking)
router.use(trackLoginAttempt);
router.use(authRouter);

// Password reset — public endpoint
router.use(passwordResetRouter);

// Setup endpoint — no auth required (but requires setup key)
router.use(setupRouter);

// Protected — all routes below require a valid Supabase JWT
router.use(requireAuth);
router.use(dashboardRouter);
router.use(statisticsRouter);
router.use(kycRouter);
router.use(membersRouter);
router.use(loansRouter);
router.use(contributionsRouter);
router.use(investmentsRouter);
router.use(complianceRouter);
router.use(notificationsRouter);
router.use(auditLogsRouter);
router.use(supportRouter);
router.use(riskScoringRouter);
router.use(interestRatesRouter);
router.use(rolloversRouter);
router.use(payrollRouter);
// New command-center modules
router.use(mobileFeaturesRouter);
router.use(rolesRouter);
router.use(fraudDetectionRouter);
router.use(organizationsRouter);
router.use(analyticsRouter);
router.use(securityRouter);
router.use(walletsRouter);
router.use(withdrawalsRouter);
router.use(verificationRouter);
router.use(referralsRouter);
router.use(guarantorsRouter);
// Mobile app guarantor endpoints (root level paths for mobile app compatibility)
router.use(guarantorRouter);
// New feature routes
router.use(systemRouter);
router.use(reportsRouter);
router.use(sessionsRouter);
router.use(bulkRouter);
router.use(reconciliationRouter);
router.use(loginHistoryRouter);
router.use(excelUploadsRouter);
router.use(depositsRouter);
// Accounting routes for financial operations
router.use(accountingRouter);

export default router;

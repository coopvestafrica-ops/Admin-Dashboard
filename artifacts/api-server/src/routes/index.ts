import { Router, type IRouter } from "express";
import { requireAuth } from "../middleware/auth";
import healthRouter from "./health";
import dashboardRouter from "./dashboard";
import membersRouter from "./members";
import loansRouter from "./loans";
import contributionsRouter from "./contributions";
import investmentsRouter from "./investments";
import complianceRouter from "./compliance";
import notificationsRouter from "./notifications";
import auditLogsRouter from "./audit_logs";
import supportRouter from "./support";
import riskScoringRouter from "./risk_scoring";
import interestRatesRouter from "./interest_rates";
import rolloversRouter from "./rollovers";
import payrollRouter from "./payroll";

const router: IRouter = Router();

// Public — no auth required
router.use(healthRouter);

// Protected — all routes below require a valid Supabase JWT
router.use(requireAuth);
router.use(dashboardRouter);
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

export default router;

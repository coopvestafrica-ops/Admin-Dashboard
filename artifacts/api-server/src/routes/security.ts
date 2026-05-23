import { Router, type IRouter } from "express";
import { readData, writeData } from "../lib/store";

const router: IRouter = Router();

const defaultActiveSessions = [
  { id: "1", userId: "ADM001", userName: "Olatunji Ayanlowo", role: "super_admin", ipAddress: "102.89.45.12", device: "Chrome / MacOS", location: "Lagos, Nigeria", loginTime: new Date(Date.now() - 3600000).toISOString(), isCurrentSession: true },
  { id: "2", userId: "ADM002", userName: "Adaeze Okonkwo", role: "admin", ipAddress: "41.190.78.90", device: "Firefox / Windows", location: "Abuja, Nigeria", loginTime: new Date(Date.now() - 7200000).toISOString(), isCurrentSession: false },
  { id: "3", userId: "ADM003", userName: "Emeka Nwosu", role: "operator", ipAddress: "197.210.34.56", device: "Safari / iPhone", location: "Enugu, Nigeria", loginTime: new Date(Date.now() - 1800000).toISOString(), isCurrentSession: false },
];

const defaultSecurityEvents = [
  { id: "1", event: "Failed login attempt", user: "unknown", ipAddress: "185.220.101.45", severity: "high", timestamp: new Date(Date.now() - 1800000).toISOString(), details: "5 consecutive failed login attempts" },
  { id: "2", event: "New admin login", user: "Adaeze Okonkwo", ipAddress: "41.190.78.90", severity: "info", timestamp: new Date(Date.now() - 7200000).toISOString(), details: "Login from new device" },
  { id: "3", event: "IP blocked", user: "System", ipAddress: "185.220.101.45", severity: "critical", timestamp: new Date(Date.now() - 900000).toISOString(), details: "Automatic block after 10 failed attempts" },
];

const defaultSecuritySettings = { twoFactorRequired: true, sessionTimeoutMinutes: 60, maxLoginAttempts: 5, ipAllowlistEnabled: false, allowedIPs: [] as string[], blockedIPs: ["185.220.101.45"], passwordExpiryDays: 90 };

router.get("/security/sessions", async (_req, res): Promise<void> => {
  const activeSessions = await readData("security_sessions.json", defaultActiveSessions);
  res.json({ sessions: activeSessions, total: activeSessions.length });
});

router.delete("/security/sessions/:id", async (req, res): Promise<void> => {
  let activeSessions = await readData("security_sessions.json", defaultActiveSessions);
  activeSessions = activeSessions.filter((s) => s.id !== req.params.id);
  await writeData("security_sessions.json", activeSessions);
  res.json({ message: "Session terminated" });
});

router.get("/security/events", async (_req, res): Promise<void> => {
  const securityEvents = await readData("security_events.json", defaultSecurityEvents);
  res.json({ events: securityEvents, total: securityEvents.length });
});

router.post("/security/ip-block", async (req, res): Promise<void> => {
  const securitySettings = await readData("security_settings.json", defaultSecuritySettings);
  const { ip, action } = req.body;
  if (action === "block") {
    securitySettings.blockedIPs = [...new Set([...securitySettings.blockedIPs, ip])];
  } else {
    securitySettings.blockedIPs = securitySettings.blockedIPs.filter((i) => i !== ip);
  }
  await writeData("security_settings.json", securitySettings);
  res.json({ message: `IP ${ip} ${action === "block" ? "blocked" : "unblocked"}`, blockedIPs: securitySettings.blockedIPs });
});

router.get("/security/settings", async (_req, res): Promise<void> => {
  const securitySettings = await readData("security_settings.json", defaultSecuritySettings);
  res.json({ settings: securitySettings });
});

router.put("/security/settings", async (req, res): Promise<void> => {
  const securitySettings = await readData("security_settings.json", defaultSecuritySettings);
  const updatedSettings = { ...securitySettings, ...req.body };
  await writeData("security_settings.json", updatedSettings);
  res.json({ settings: updatedSettings, message: "Security settings updated" });
});

export default router;

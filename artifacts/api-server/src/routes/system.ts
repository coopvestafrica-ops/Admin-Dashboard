/**
 * Maintenance mode + minimum app version + generic system_settings proxy.
 *
 * The mobile backend persists every entry in `system_settings`; we expose:
 *  - GET  /system/settings           list all
 *  - GET  /system/settings/:key      single key
 *  - PUT  /system/settings/:key      upsert (audit-logged on mobile side)
 *  - GET  /system/maintenance        convenience read for `maintenance.enabled`
 *  - PUT  /system/maintenance        convenience write for `maintenance.enabled`
 *  - GET  /system/min-app-version    convenience read for `app.min_version`
 *  - PUT  /system/min-app-version    convenience write for `app.min_version`
 */

import { Router, type IRouter } from "express";
import { getMobileApiClient } from "../lib/mobile-api-client";
import { handleMobileError } from "../lib/mobile-error";
import { requireAuth, requireSuperAdmin } from "../middlewares/auth";

const router: IRouter = Router();

interface MobileSetting {
  key: string;
  value: unknown;
  description?: string | null;
  updated_at?: string;
}

router.get("/system/settings", requireAuth, async (_req, res): Promise<void> => {
  try {
    const client = getMobileApiClient();
    const response = await client.get<{ success: boolean; settings: MobileSetting[] }>(
      "/api/v2/admin/system-settings",
    );
    res.json({ data: response.settings ?? [] });
  } catch (err) {
    handleMobileError(err, res);
  }
});

router.get("/system/settings/:key", requireAuth, async (req, res): Promise<void> => {
  try {
    const client = getMobileApiClient();
    const key = Array.isArray(req.params.key) ? req.params.key[0] : req.params.key;
    const response = await client.get<{ success: boolean; setting: MobileSetting }>(
      `/api/v2/admin/system-settings/${encodeURIComponent(key)}`,
    );
    res.json(response.setting);
  } catch (err) {
    handleMobileError(err, res);
  }
});

router.put("/system/settings/:key", requireAuth, requireSuperAdmin, async (req, res): Promise<void> => {
  try {
    const client = getMobileApiClient();
    const key = Array.isArray(req.params.key) ? req.params.key[0] : req.params.key;
    const response = await client.put<{ success: boolean; setting: MobileSetting }>(
      `/api/v2/admin/system-settings/${encodeURIComponent(key)}`,
      req.body,
    );
    res.json(response.setting);
  } catch (err) {
    handleMobileError(err, res);
  }
});

router.get("/system/maintenance", requireAuth, async (_req, res): Promise<void> => {
  try {
    const client = getMobileApiClient();
    try {
      const response = await client.get<{ success: boolean; setting: MobileSetting }>(
        "/api/v2/admin/system-settings/maintenance.enabled",
      );
      res.json(response.setting);
    } catch {
      res.json({ key: "maintenance.enabled", value: { enabled: false } });
    }
  } catch (err) {
    handleMobileError(err, res);
  }
});

router.put("/system/maintenance", requireAuth, requireSuperAdmin, async (req, res): Promise<void> => {
  try {
    const client = getMobileApiClient();
    const body = req.body as { enabled: boolean; message?: string };
    const response = await client.put<{ success: boolean; setting: MobileSetting }>(
      "/api/v2/admin/system-settings/maintenance.enabled",
      { value: { enabled: !!body.enabled, message: body.message ?? null }, description: "App maintenance mode" },
    );
    res.json(response.setting);
  } catch (err) {
    handleMobileError(err, res);
  }
});

router.get("/system/min-app-version", requireAuth, async (_req, res): Promise<void> => {
  try {
    const client = getMobileApiClient();
    try {
      const response = await client.get<{ success: boolean; setting: MobileSetting }>(
        "/api/v2/admin/system-settings/app.min_version",
      );
      res.json(response.setting);
    } catch {
      res.json({ key: "app.min_version", value: { ios: null, android: null, web: null } });
    }
  } catch (err) {
    handleMobileError(err, res);
  }
});

router.put("/system/min-app-version", requireAuth, requireSuperAdmin, async (req, res): Promise<void> => {
  try {
    const client = getMobileApiClient();
    const body = req.body as { ios?: string; android?: string; web?: string };
    const response = await client.put<{ success: boolean; setting: MobileSetting }>(
      "/api/v2/admin/system-settings/app.min_version",
      { value: { ios: body.ios ?? null, android: body.android ?? null, web: body.web ?? null }, description: "Minimum app version per platform" },
    );
    res.json(response.setting);
  } catch (err) {
    handleMobileError(err, res);
  }
});

export default router;

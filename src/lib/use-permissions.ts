import { useQuery } from "@tanstack/react-query";
import { authedFetch } from "@/lib/authed-fetch";
import { normalizeRole, type Role } from "@/lib/permissions";

/**
 * The authoritative role catalogue and permission set, read from the backend.
 *
 * Permissions are enforced server-side, so the dashboard must not invent its
 * own list: a hand-maintained copy would drift and start hiding (or showing)
 * the wrong things. `GET /api/admin/permissions` returns the same catalog the
 * enforcement middleware uses, which is the point.
 *
 * Treat the result as presentation and navigation guidance only. A 403 from the
 * API is still the real answer.
 */

export interface RoleDefinition {
  key: string;
  label: string;
  description: string;
  rank: number;
  legacy: string[];
  permissionCount: number;
}

export interface PermissionDefinition {
  key: string;
  description: string;
  readOnly: boolean;
}

export interface PermissionsPayload {
  roles: RoleDefinition[];
  permissions: PermissionDefinition[];
  current: {
    role: string;
    storedAs: string | null;
    label: string | null;
    permissions: string[];
  } | null;
}

export function usePermissions() {
  const query = useQuery({
    queryKey: ["rbac-permissions"],
    queryFn: async (): Promise<PermissionsPayload> => {
      // /rbac/catalog, not /permissions: the legacy governance route owns that
      // path and returns a different, display-only catalogue.
      const res = await authedFetch("/api/admin/rbac/catalog");
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.success) {
        throw new Error(json.error || "Failed to load permissions");
      }
      return json as PermissionsPayload;
    },
    // Role definitions change rarely; refetching on every navigation would be
    // noise.
    staleTime: 10 * 60 * 1000,
    retry: false,
  });

  const current = query.data?.current ?? null;
  const permissions = new Set(current?.permissions ?? []);

  return {
    ...query,
    roles: query.data?.roles ?? [],
    permissions: query.data?.permissions ?? [],
    current,
    /** Canonical role key reported by the backend, e.g. 'manager'. */
    roleKey: current?.role ?? null,
    /** The local role bucket used for sidebar rendering. */
    localRole: normalizeRole(current?.storedAs ?? null) as Role | null,
    /**
     * Does the current account hold this permission?
     *
     * Returns false while the catalog is still loading, so a control is never
     * briefly offered and then withdrawn.
     */
    can: (permission: string) => permissions.has(permission),
    canAny: (list: string[]) => list.some((p) => permissions.has(p)),
    isApex: current?.role === "ceo",
  };
}

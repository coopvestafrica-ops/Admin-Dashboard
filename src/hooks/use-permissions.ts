import { useState, useEffect, createContext, useContext, type ReactNode } from "react";
import { supabase } from "@/lib/supabase";

interface UserPermissions {
  role: string;
  permissions: string[];
  profileId: string;
  isLoading: boolean;
}

interface PermissionContextType {
  user: UserPermissions | null;
  hasPermission: (permission: string) => boolean;
  hasAnyPermission: (permissions: string[]) => boolean;
  hasAllPermissions: (permissions: string[]) => boolean;
  isRole: (role: string) => boolean;
  isSuperAdmin: boolean;
  isAdmin: boolean;
}

const PermissionContext = createContext<PermissionContextType | null>(null);

// Permission to route mapping
export const ROUTE_PERMISSIONS: Record<string, string[]> = {
  "/dashboard": [],
  "/members": ["users.view"],
  "/loans": ["loans.view"],
  "/contributions": ["finance.view", "finance.contributions"],
  "/payroll": ["orgs.payroll"],
  "/excel-manager": ["finance.view"],
  "/investments": ["finance.investments", "finance.view"],
  "/wallet-management": ["finance.view"],
  "/withdrawal-management": ["finance.approve"],
  "/guarantor-system": ["loans.guarantors"],
  "/interest-rates": ["finance.view"],
  "/reconciliation": ["finance.view"],
  "/system-settings": ["system.settings"],
  "/reports": ["reports.view"],
  "/bulk-operations": ["finance.view"],
  "/sessions": ["system.security"],
  "/login-history": ["system.audit"],
  "/mobile-feature-controls": ["system.features"],
  "/role-management": ["system.roles"],
  "/security-access": ["system.security"],
  "/organizations": ["orgs.view"],
  "/referral-program": ["reports.view"],
  "/platform-analytics": ["reports.view"],
  "/fraud-detection": ["compliance.view"],
  "/risk-scoring": ["reports.view"],
  "/user-verification": ["users.verify"],
  "/compliance": ["compliance.view"],
  "/audit-logs": ["system.audit"],
  "/notifications": ["notifications.view"],
  "/support": ["support.view"],
  "/settings": [],
};

export function PermissionProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserPermissions | null>(null);

  useEffect(() => {
    if (!supabase) return;

    async function fetchPermissions() {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session?.user?.email) {
        setUser(null);
        return;
      }

      try {
        // Fallback to direct profile lookup
        const { data: profile } = await supabase
          .from("profiles")
          .select("id, role, custom_permissions")
          .eq("email", session.user.email)
          .single();

        if (profile) {
          // For now, use role-based default permissions
          const defaultPerms = getDefaultPermissions(profile.role || "member");
          const customPerms = profile.custom_permissions || [];
          const allPerms = [...new Set([...defaultPerms, ...customPerms])];

          setUser({
            role: profile.role || "member",
            permissions: allPerms,
            profileId: profile.id,
            isLoading: false,
          });
        }
      } catch (error) {
        console.error("Error fetching permissions:", error);
        setUser(null);
      }
    }

    fetchPermissions();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      fetchPermissions();
    });

    return () => subscription.unsubscribe();
  }, []);

  const hasPermission = (permission: string): boolean => {
    if (!user) return false;
    if (user.role === "super_admin") return true;
    return user.permissions.includes(permission);
  };

  const hasAnyPermission = (permissions: string[]): boolean => {
    if (!user) return false;
    if (user.role === "super_admin") return true;
    return permissions.some(p => user.permissions.includes(p));
  };

  const hasAllPermissions = (permissions: string[]): boolean => {
    if (!user) return false;
    if (user.role === "super_admin") return true;
    return permissions.every(p => user.permissions.includes(p));
  };

  const isRole = (role: string): boolean => {
    return user?.role === role;
  };

  return (
    <PermissionContext.Provider
      value={{
        user,
        hasPermission,
        hasAnyPermission,
        hasAllPermissions,
        isRole,
        isSuperAdmin: user?.role === "super_admin",
        isAdmin: ["super_admin", "admin"].includes(user?.role || ""),
      }}
    >
      {children}
    </PermissionContext.Provider>
  );
}

export function usePermissions() {
  const context = useContext(PermissionContext);
  if (!context) {
    throw new Error("usePermissions must be used within PermissionProvider");
  }
  return context;
}

// Default permissions based on role
function getDefaultPermissions(role: string): string[] {
  switch (role) {
    case "super_admin":
      return [
        "users.view", "users.edit", "users.suspend", "users.verify", "users.create",
        "finance.view", "finance.approve", "finance.reverse", "finance.adjust", "finance.contributions", "finance.investments",
        "loans.view", "loans.approve", "loans.manage", "loans.restructure", "loans.guarantors",
        "orgs.view", "orgs.manage", "orgs.payroll",
        "reports.view", "reports.export", "reports.custom",
        "system.settings", "system.audit", "system.roles", "system.security", "system.features", "system.backup",
        "support.view", "support.manage",
        "compliance.view", "compliance.manage",
        "notifications.view", "notifications.send", "notifications.templates",
      ];
    case "admin":
      return [
        "users.view", "users.edit", "users.suspend", "users.verify",
        "finance.view", "finance.approve", "finance.contributions",
        "loans.view", "loans.approve", "loans.manage", "loans.guarantors",
        "orgs.view", "orgs.payroll",
        "reports.view", "reports.export",
        "support.view", "support.manage",
        "compliance.view",
        "notifications.view", "notifications.send",
      ];
    case "operator":
      return [
        "users.view", "users.verify",
        "finance.view", "finance.approve", "finance.contributions",
        "loans.view", "loans.approve", "loans.manage", "loans.restructure", "loans.guarantors",
        "orgs.view", "orgs.payroll",
        "reports.view",
        "support.view", "support.manage",
        "compliance.view",
        "notifications.view",
      ];
    case "viewer":
      return [
        "users.view",
        "finance.view",
        "loans.view",
        "orgs.view",
        "reports.view",
        "support.view",
        "compliance.view",
        "notifications.view",
      ];
    default:
      return [];
  }
}

import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { usePermissions, ROUTE_PERMISSIONS } from "@/hooks/use-permissions";

interface PermissionRouteProps {
  component: React.ComponentType;
}

export function PermissionRoute({ component: Component }: PermissionRouteProps) {
  const [, setLocation] = useLocation();
  const { user, hasAnyPermission } = usePermissions();
  const [hasAccess, setHasAccess] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    if (!user) {
      setChecking(false);
      return;
    }

    const path = window.location.pathname;
    const requiredPerms = ROUTE_PERMISSIONS[path] || [];
    
    // If no permissions required, allow access
    if (requiredPerms.length === 0) {
      setHasAccess(true);
    } else {
      // Check if user has any of the required permissions
      setHasAccess(hasAnyPermission(requiredPerms));
    }
    
    setChecking(false);
  }, [user, hasAnyPermission]);

  useEffect(() => {
    if (!checking && !hasAccess && user) {
      // Redirect to dashboard if no access
      setLocation("/dashboard");
    }
  }, [checking, hasAccess, user, setLocation]);

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="text-sm text-muted-foreground">Checking permissions...</p>
        </div>
      </div>
    );
  }

  if (!hasAccess) return null;

  return <Component />;
}

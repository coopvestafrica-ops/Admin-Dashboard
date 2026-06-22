import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { supabase } from "@/lib/supabase";
import { useUserRole } from "@/hooks/useUserRole";
import { isValidAdminRole, Role, hasPermission, ROUTE_TO_PAGE, PageKey } from "@/lib/permissions";

interface ProtectedRouteProps {
  component: React.ComponentType;
}

export function ProtectedRoute({ component: Component }: ProtectedRouteProps) {
  const [, setLocation] = useLocation();
  const { role, isLoading: roleLoading } = useUserRole();
  const [checking, setChecking] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);
  const [hasAccess, setHasAccess] = useState(false);

  useEffect(() => {
    if (!supabase) {
      setLocation("/");
      setChecking(false);
      return;
    }

    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        setAuthenticated(true);
      } else {
        setLocation("/");
      }
      setChecking(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        setLocation("/");
        setHasAccess(false);
      }
    });

    return () => listener.subscription.unsubscribe();
  }, [setLocation]);

  // Check page-specific permissions once role is loaded
  useEffect(() => {
    if (roleLoading) return;

    // Must be logged in AND have a valid admin role (super_admin, admin, operator, or viewer)
    if (!authenticated) {
      setHasAccess(false);
      return;
    }

    // Check if user has a valid admin role
    if (!isValidAdminRole(role)) {
      // User is logged in but not an admin - redirect to login with error
      setHasAccess(false);
      setLocation("/?error=not_admin");
      return;
    }

    // Get current path and check permission
    const currentPath = window.location.pathname;
    
    // Find the page key for this route
    // Handle dynamic routes like /members/:id
    let pageKey: PageKey | null = null;
    
    // Check exact match first
    if (ROUTE_TO_PAGE[currentPath]) {
      pageKey = ROUTE_TO_PAGE[currentPath];
    } else {
      // Check prefix match for dynamic routes
      for (const [route, key] of Object.entries(ROUTE_TO_PAGE)) {
        if (route.includes(':') && currentPath.startsWith(route.split(':')[0])) {
          pageKey = key;
          break;
        }
      }
    }

    // If no page key found, allow access (new pages without permission config)
    if (!pageKey) {
      setHasAccess(true);
      return;
    }

    // Check if role has permission for this page
    const canAccess = hasPermission(role as Role, pageKey);
    setHasAccess(canAccess);

    if (!canAccess) {
      setLocation("/?error=no_permission");
    }
  }, [role, roleLoading, authenticated, setLocation]);

  if (checking || roleLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="text-sm text-muted-foreground">Verifying access...</p>
        </div>
      </div>
    );
  }

  if (!authenticated || !hasAccess) return null;

  return <Component />;
}

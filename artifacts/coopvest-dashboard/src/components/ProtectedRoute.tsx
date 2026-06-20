import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { supabase } from "@/lib/supabase";

interface ProtectedRouteProps {
  component: React.ComponentType;
}

// Valid admin roles that can access the admin dashboard
const VALID_ADMIN_ROLES = ['admin', 'super_admin', 'operator', 'finance', 'support'];

async function checkAdminRole(userId: string): Promise<boolean> {
  if (!supabase) return false;
  
  const { data } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', userId)
    .maybeSingle();
  
  return data?.role && VALID_ADMIN_ROLES.includes(data.role);
}

export function ProtectedRoute({ component: Component }: ProtectedRouteProps) {
  const [, setLocation] = useLocation();
  const [checking, setChecking] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);
  const [hasAccess, setHasAccess] = useState(false);

  useEffect(() => {
    if (!supabase) {
      setLocation("/");
      setChecking(false);
      return;
    }
    
    supabase.auth.getSession().then(async ({ data }) => {
      if (data.session) {
        // Check if user has admin role
        const isAdmin = await checkAdminRole(data.session.user.id);
        if (isAdmin) {
          setAuthenticated(true);
          setHasAccess(true);
        } else {
          // User is logged in but not an admin - sign them out
          await supabase.auth.signOut();
          setLocation("/?error=unauthorized");
        }
      } else {
        setLocation("/");
      }
      setChecking(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (!session) {
        setLocation("/");
        setHasAccess(false);
      } else {
        // Verify admin role on auth change
        const isAdmin = await checkAdminRole(session.user.id);
        if (!isAdmin) {
          await supabase.auth.signOut();
          setLocation("/?error=unauthorized");
          setHasAccess(false);
        } else {
          setHasAccess(true);
        }
      }
    });

    return () => listener.subscription.unsubscribe();
  }, [setLocation]);

  if (checking) {
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

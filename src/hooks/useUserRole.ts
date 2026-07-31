import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { Role, isValidAdminRole, isElevatedAdminRole, getAccessiblePages, hasPermission, PageKey, ADMIN_ROLES } from '@/lib/permissions';

interface UserProfile {
  id: string;
  role: Role | null;
}

interface UseUserRoleReturn {
  role: Role | null;
  isLoading: boolean;
  isAdmin: boolean;
  isElevatedAdmin: boolean;
  accessiblePages: PageKey[];
  hasPagePermission: (page: PageKey) => boolean;
  refreshRole: () => Promise<void>;
}

export function useUserRole(): UseUserRoleReturn {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchProfile = useCallback(async () => {
    if (!supabase) {
      setProfile(null);
      setIsLoading(false);
      return;
    }

    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session?.user) {
        setProfile(null);
        setIsLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from('profiles')
        .select('id, role')
        .eq('id', session.user.id)
        .maybeSingle();

      if (error) {
        console.error('Error fetching profile:', error);
        setProfile(null);
      } else {
        setProfile({
          id: data?.id || session.user.id,
          role: isValidAdminRole(data?.role) ? data.role as Role : null,
        });
      }
    } catch (err) {
      console.error('Error in fetchProfile:', err);
      setProfile(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProfile();

    if (!supabase) return;

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        setProfile(null);
      } else {
        fetchProfile();
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [fetchProfile]);

  const hasPagePermission = useCallback((page: PageKey): boolean => {
    return hasPermission(profile?.role ?? null, page);
  }, [profile?.role]);

  return {
    role: profile?.role ?? null,
    isLoading,
    isAdmin: isValidAdminRole(profile?.role ?? null),
    isElevatedAdmin: isElevatedAdminRole(profile?.role ?? null),
    accessiblePages: getAccessiblePages(profile?.role ?? null),
    hasPagePermission,
    refreshRole: fetchProfile,
  };
}

/**
 * Check if user has admin role (for use outside React components)
 */
export async function checkUserIsAdmin(): Promise<boolean> {
  if (!supabase) return false;
  
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) return false;

  const { data } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', session.user.id)
    .maybeSingle();

  return isValidAdminRole(data?.role ?? null);
}

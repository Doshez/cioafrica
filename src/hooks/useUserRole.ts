import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export function useUserRole() {
  const { user } = useAuth();

  const { data, isLoading: loading } = useQuery({
    queryKey: ['user-role', user?.id],
    queryFn: async () => {
      if (!user) return { isAdmin: false, isProjectManager: false };

      const { data, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id);

      if (error) throw error;

      const roles = data?.map(r => r.role) || [];
      return {
        isAdmin: roles.includes('admin'),
        isProjectManager: roles.includes('project_manager'),
      };
    },
    enabled: !!user,
    staleTime: 10 * 60 * 1000, // Cache for 10 minutes
    gcTime: 30 * 60 * 1000, // Keep in cache for 30 minutes
  });

  return {
    isAdmin: data?.isAdmin ?? false,
    isProjectManager: data?.isProjectManager ?? false,
    loading,
  };
}

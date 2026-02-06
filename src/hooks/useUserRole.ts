import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export function useUserRole() {
  const { user, loading: authLoading } = useAuth();

  const { data, isLoading: queryLoading, isFetching } = useQuery({
    queryKey: ['user-role', user?.id],
    queryFn: async () => {
      if (!user) return { isAdmin: false, isProjectManager: false };

      console.log('Fetching roles for user:', user.id);
      
      const { data, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id);

      if (error) {
        console.error('Error fetching user roles:', error);
        throw error;
      }

      console.log('User roles fetched:', data);
      
      const roles = data?.map(r => r.role) || [];
      const result = {
        isAdmin: roles.includes('admin'),
        isProjectManager: roles.includes('project_manager'),
      };
      
      console.log('Role check result:', result);
      return result;
    },
    enabled: !!user && !authLoading,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes (reduced from 10)
    gcTime: 15 * 60 * 1000, // Keep in cache for 15 minutes (reduced from 30)
    refetchOnMount: true, // Always refetch when component mounts
    refetchOnWindowFocus: true, // Refetch when window gains focus
  });

  // Loading is true if auth is still loading OR if query is still loading
  const loading = authLoading || (!!user && queryLoading);

  return {
    isAdmin: data?.isAdmin ?? false,
    isProjectManager: data?.isProjectManager ?? false,
    loading,
  };
}

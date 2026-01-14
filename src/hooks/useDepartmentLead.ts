import { useCallback, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

export interface DepartmentLead {
  id: string;
  department_id: string;
  user_id: string;
  assigned_by: string | null;
  created_at: string;
  user_name?: string;
  user_email?: string;
}

export function useDepartmentLead(departmentId: string | undefined) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const queryKey = ['department-leads', departmentId];

  const { data: leads = [], isLoading: loading, refetch } = useQuery({
    queryKey,
    queryFn: async () => {
      if (!departmentId) return [];

      const { data, error } = await supabase
        .from('department_leads')
        .select('*')
        .eq('department_id', departmentId);

      if (error) throw error;

      // Fetch user profiles for leads
      const userIds = [...new Set(data?.map(l => l.user_id) || [])];
      let userProfiles: Record<string, { name: string; email: string }> = {};

      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, full_name, email')
          .in('id', userIds);

        if (profiles) {
          userProfiles = profiles.reduce((acc, p) => {
            acc[p.id] = { name: p.full_name || 'Unknown', email: p.email };
            return acc;
          }, {} as Record<string, { name: string; email: string }>);
        }
      }

      return (data || []).map(l => ({
        ...l,
        user_name: userProfiles[l.user_id]?.name,
        user_email: userProfiles[l.user_id]?.email,
      }));
    },
    enabled: !!departmentId,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
    gcTime: 15 * 60 * 1000, // Keep in cache for 15 minutes
  });

  const isCurrentUserLead = useMemo(() => {
    return user ? leads.some(l => l.user_id === user.id) : false;
  }, [leads, user]);

  const assignLeadMutation = useMutation({
    mutationFn: async (userId: string) => {
      if (!departmentId || !user) throw new Error('Missing required data');

      const { error } = await supabase.from('department_leads').insert({
        department_id: departmentId,
        user_id: userId,
        assigned_by: user.id,
      });

      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: 'Department lead assigned successfully' });
      queryClient.invalidateQueries({ queryKey });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to assign department lead',
        variant: 'destructive',
      });
    },
  });

  const removeLeadMutation = useMutation({
    mutationFn: async (leadId: string) => {
      const { error } = await supabase
        .from('department_leads')
        .delete()
        .eq('id', leadId);

      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: 'Department lead removed successfully' });
      queryClient.invalidateQueries({ queryKey });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to remove department lead',
        variant: 'destructive',
      });
    },
  });

  const assignLead = useCallback((userId: string) => {
    assignLeadMutation.mutate(userId);
  }, [assignLeadMutation]);

  const removeLead = useCallback((leadId: string) => {
    removeLeadMutation.mutate(leadId);
  }, [removeLeadMutation]);

  return {
    leads,
    loading,
    isCurrentUserLead,
    assignLead,
    removeLead,
    refetch,
  };
}

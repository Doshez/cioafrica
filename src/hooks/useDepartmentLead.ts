import { useState, useEffect, useCallback } from 'react';
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
  const [leads, setLeads] = useState<DepartmentLead[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCurrentUserLead, setIsCurrentUserLead] = useState(false);

  const fetchLeads = useCallback(async () => {
    if (!departmentId) return;

    setLoading(true);
    try {
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

      const leadsWithProfiles = (data || []).map(l => ({
        ...l,
        user_name: userProfiles[l.user_id]?.name,
        user_email: userProfiles[l.user_id]?.email,
      }));

      setLeads(leadsWithProfiles);
      setIsCurrentUserLead(user ? leadsWithProfiles.some(l => l.user_id === user.id) : false);
    } catch (error) {
      console.error('Error fetching department leads:', error);
    } finally {
      setLoading(false);
    }
  }, [departmentId, user]);

  useEffect(() => {
    fetchLeads();
  }, [fetchLeads]);

  // Real-time subscription
  useEffect(() => {
    if (!departmentId) return;

    const channel = supabase
      .channel(`department-leads-${departmentId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'department_leads', filter: `department_id=eq.${departmentId}` },
        () => fetchLeads()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [departmentId, fetchLeads]);

  const assignLead = async (userId: string) => {
    if (!departmentId || !user) return;

    try {
      const { error } = await supabase.from('department_leads').insert({
        department_id: departmentId,
        user_id: userId,
        assigned_by: user.id,
      });

      if (error) throw error;

      toast({ title: 'Department lead assigned successfully' });
      fetchLeads();
    } catch (error: any) {
      console.error('Error assigning department lead:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to assign department lead',
        variant: 'destructive',
      });
    }
  };

  const removeLead = async (leadId: string) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('department_leads')
        .delete()
        .eq('id', leadId);

      if (error) throw error;

      toast({ title: 'Department lead removed successfully' });
      fetchLeads();
    } catch (error: any) {
      console.error('Error removing department lead:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to remove department lead',
        variant: 'destructive',
      });
    }
  };

  return {
    leads,
    loading,
    isCurrentUserLead,
    assignLead,
    removeLead,
    refetch: fetchLeads,
  };
}

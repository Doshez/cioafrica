import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

export interface AccessEntry {
  id: string;
  document_id: string | null;
  link_id: string | null;
  folder_id: string | null;
  user_id: string;
  permission: 'view_only' | 'download';
  granted_by: string | null;
  created_at: string;
  user_name?: string;
  user_email?: string;
}

export function useDocumentAccess(
  itemId: string | undefined,
  itemType: 'document' | 'link' | 'folder'
) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [accessList, setAccessList] = useState<AccessEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAccess = useCallback(async () => {
    if (!itemId) return;

    setLoading(true);
    try {
      const filterColumn = itemType === 'document' ? 'document_id' : itemType === 'link' ? 'link_id' : 'folder_id';
      
      const { data, error } = await supabase
        .from('document_access')
        .select('*')
        .eq(filterColumn, itemId);

      if (error) throw error;

      // Fetch user profiles for access entries
      const userIds = [...new Set(data?.map(a => a.user_id) || [])];
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

      setAccessList(
        (data || []).map(a => ({
          ...a,
          user_name: userProfiles[a.user_id]?.name,
          user_email: userProfiles[a.user_id]?.email,
        }))
      );
    } catch (error) {
      console.error('Error fetching access:', error);
    } finally {
      setLoading(false);
    }
  }, [itemId, itemType]);

  useEffect(() => {
    fetchAccess();
  }, [fetchAccess]);

  // Real-time subscription
  useEffect(() => {
    if (!itemId) return;

    const channel = supabase
      .channel(`document-access-${itemId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'document_access' },
        () => fetchAccess()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [itemId, fetchAccess]);

  const grantAccess = async (userId: string, permission: 'view_only' | 'download') => {
    if (!itemId || !user) return;

    try {
      const insertData = {
        user_id: userId,
        permission,
        granted_by: user.id,
        document_id: itemType === 'document' ? itemId : null,
        link_id: itemType === 'link' ? itemId : null,
        folder_id: itemType === 'folder' ? itemId : null,
      };

      const { error } = await supabase.from('document_access').insert(insertData);

      if (error) throw error;

      await supabase.from('document_audit_log').insert({
        [itemType === 'document' ? 'document_id' : itemType === 'link' ? 'link_id' : 'folder_id']: itemId,
        user_id: user.id,
        action: 'access_granted',
        details: { target_user_id: userId, permission },
      });

      toast({ title: 'Access granted successfully' });
      fetchAccess();
    } catch (error) {
      console.error('Error granting access:', error);
      toast({
        title: 'Error',
        description: 'Failed to grant access',
        variant: 'destructive',
      });
    }
  };

  const updateAccess = async (accessId: string, permission: 'view_only' | 'download') => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('document_access')
        .update({ permission })
        .eq('id', accessId);

      if (error) throw error;

      toast({ title: 'Access updated successfully' });
      fetchAccess();
    } catch (error) {
      console.error('Error updating access:', error);
      toast({
        title: 'Error',
        description: 'Failed to update access',
        variant: 'destructive',
      });
    }
  };

  const revokeAccess = async (accessId: string) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('document_access')
        .delete()
        .eq('id', accessId);

      if (error) throw error;

      await supabase.from('document_audit_log').insert({
        user_id: user.id,
        action: 'access_revoked',
        details: { access_id: accessId },
      });

      toast({ title: 'Access revoked successfully' });
      fetchAccess();
    } catch (error) {
      console.error('Error revoking access:', error);
      toast({
        title: 'Error',
        description: 'Failed to revoke access',
        variant: 'destructive',
      });
    }
  };

  return {
    accessList,
    loading,
    grantAccess,
    updateAccess,
    revokeAccess,
    refetch: fetchAccess,
  };
}

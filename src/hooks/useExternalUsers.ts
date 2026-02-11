import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

export type ExternalAccessLevel = 'view_only' | 'upload_edit' | 'edit_download';

export interface ExternalUserDepartment {
  id: string;
  department_id: string;
  department_name: string;
  access_level: ExternalAccessLevel;
  is_active: boolean;
  added_at: string;
}

export interface ExternalUser {
  id: string;
  user_id: string;
  email: string;
  full_name: string | null;
  department_id: string;
  department_name?: string;
  project_id: string;
  invited_by: string;
  access_level: ExternalAccessLevel;
  access_expires_at: string | null;
  is_active: boolean;
  must_change_password: boolean;
  temporary_password_expires_at: string | null;
  last_activity_at: string | null;
  created_at: string;
  updated_at: string;
  invited_by_name?: string;
  associated_departments: ExternalUserDepartment[];
}

export interface ExternalUserActivityLog {
  id: string;
  external_user_id: string;
  action: string;
  document_id: string | null;
  folder_id: string | null;
  details: unknown;
  ip_address: string | null;
  created_at: string;
  document_name?: string;
  folder_name?: string;
}

export interface DuplicateCheckResult {
  exists: boolean;
  externalUser?: ExternalUser;
  owningDepartmentName?: string;
}

export function useExternalUsers(departmentId: string | undefined) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [externalUsers, setExternalUsers] = useState<ExternalUser[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchExternalUsers = useCallback(async () => {
    if (!departmentId) return;

    setLoading(true);
    try {
      // Fetch users owned by this department
      const { data: ownedUsers, error: ownedError } = await supabase
        .from('external_users')
        .select('*, departments(name)')
        .eq('department_id', departmentId)
        .order('created_at', { ascending: false });

      if (ownedError) throw ownedError;

      // Also fetch users associated with this department via junction table
      const { data: associatedRecords, error: assocError } = await supabase
        .from('external_user_departments')
        .select('external_user_id, access_level, is_active, added_at')
        .eq('department_id', departmentId);

      // Get the external user IDs that are associated but not owned
      const ownedIds = new Set((ownedUsers || []).map(u => u.id));
      const additionalIds = (associatedRecords || [])
        .filter(r => !ownedIds.has(r.external_user_id))
        .map(r => r.external_user_id);

      let additionalUsers: any[] = [];
      if (additionalIds.length > 0) {
        const { data } = await supabase
          .from('external_users')
          .select('*, departments(name)')
          .in('id', additionalIds);
        additionalUsers = data || [];
      }

      const allUsers = [...(ownedUsers || []), ...additionalUsers];

      // Fetch inviter names
      const inviterIds = [...new Set(allUsers.map(u => u.invited_by))];
      let inviterNames: Record<string, string> = {};
      if (inviterIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, full_name')
          .in('id', inviterIds);
        if (profiles) {
          inviterNames = profiles.reduce((acc, p) => {
            acc[p.id] = p.full_name || 'Unknown';
            return acc;
          }, {} as Record<string, string>);
        }
      }

      // Fetch department associations for all users
      const allUserIds = allUsers.map(u => u.id);
      let deptAssociations: Record<string, ExternalUserDepartment[]> = {};
      if (allUserIds.length > 0) {
        const { data: assocData } = await supabase
          .from('external_user_departments')
          .select('id, external_user_id, department_id, access_level, is_active, added_at')
          .in('external_user_id', allUserIds);

        if (assocData && assocData.length > 0) {
          // Get department names for associations
          const deptIds = [...new Set(assocData.map(a => a.department_id))];
          const { data: depts } = await supabase
            .from('departments')
            .select('id, name')
            .in('id', deptIds);

          const deptNameMap = (depts || []).reduce((acc, d) => {
            acc[d.id] = d.name;
            return acc;
          }, {} as Record<string, string>);

          for (const assoc of assocData) {
            if (!deptAssociations[assoc.external_user_id]) {
              deptAssociations[assoc.external_user_id] = [];
            }
            deptAssociations[assoc.external_user_id].push({
              id: assoc.id,
              department_id: assoc.department_id,
              department_name: deptNameMap[assoc.department_id] || 'Unknown',
              access_level: assoc.access_level as ExternalAccessLevel,
              is_active: assoc.is_active,
              added_at: assoc.added_at,
            });
          }
        }
      }

      setExternalUsers(
        allUsers.map(u => ({
          ...u,
          access_level: u.access_level as ExternalAccessLevel,
          department_name: (u.departments as any)?.name || 'Unknown',
          invited_by_name: inviterNames[u.invited_by],
          associated_departments: deptAssociations[u.id] || [],
        }))
      );
    } catch (error) {
      console.error('Error fetching external users:', error);
    } finally {
      setLoading(false);
    }
  }, [departmentId]);

  useEffect(() => {
    fetchExternalUsers();
  }, [fetchExternalUsers]);

  // Real-time subscription
  useEffect(() => {
    if (!departmentId) return;

    const channel = supabase
      .channel(`external-users-${departmentId}`)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'external_users',
        filter: `department_id=eq.${departmentId}`
      }, () => fetchExternalUsers())
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'external_user_departments',
        filter: `department_id=eq.${departmentId}`
      }, () => fetchExternalUsers())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [departmentId, fetchExternalUsers]);

  const checkDuplicate = useCallback(async (email: string): Promise<DuplicateCheckResult> => {
    try {
      const { data, error } = await supabase
        .from('external_users')
        .select('*, departments(name)')
        .eq('email', email.trim().toLowerCase())
        .limit(1);

      if (error || !data || data.length === 0) {
        return { exists: false };
      }

      const existing = data[0];
      return {
        exists: true,
        externalUser: {
          ...existing,
          access_level: existing.access_level as ExternalAccessLevel,
          department_name: (existing.departments as any)?.name || 'Unknown',
          associated_departments: [],
        },
        owningDepartmentName: (existing.departments as any)?.name || 'Unknown',
      };
    } catch {
      return { exists: false };
    }
  }, []);

  const inviteExternalUser = async (
    email: string, fullName: string | undefined, projectId: string,
    accessLevel: ExternalAccessLevel, accessExpiresAt?: string
  ) => {
    if (!departmentId || !user) return false;
    try {
      const { data, error } = await supabase.functions.invoke('invite-external-user', {
        body: { email, fullName, departmentId, projectId, accessLevel, accessExpiresAt, invitedByUserId: user.id }
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast({ title: 'Invitation sent', description: `${email} has been invited successfully.` });
      fetchExternalUsers();
      return true;
    } catch (error: any) {
      console.error('Error inviting external user:', error);
      toast({ title: 'Error', description: error.message || 'Failed to invite external user', variant: 'destructive' });
      return false;
    }
  };

  const addToDepartment = async (
    externalUserId: string, accessLevel: ExternalAccessLevel
  ) => {
    if (!departmentId || !user) return false;
    try {
      const { data, error } = await supabase.functions.invoke('add-external-user-to-department', {
        body: { externalUserId, departmentId, accessLevel, addedByUserId: user.id }
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast({ title: 'User added', description: 'External user has been added to this department.' });
      fetchExternalUsers();
      return true;
    } catch (error: any) {
      console.error('Error adding user to department:', error);
      toast({ title: 'Error', description: error.message || 'Failed to add user to department', variant: 'destructive' });
      return false;
    }
  };

  const updateExternalUser = async (
    externalUserId: string,
    updates: { accessLevel?: ExternalAccessLevel; accessExpiresAt?: string | null; isActive?: boolean }
  ) => {
    if (!user) return false;
    try {
      const { data, error } = await supabase.functions.invoke('update-external-user-access', {
        body: {
          externalUserId, accessLevel: updates.accessLevel,
          accessExpiresAt: updates.accessExpiresAt, isActive: updates.isActive,
          updatedByUserId: user.id,
          notificationType: updates.isActive === false ? 'revoked' : 'updated'
        }
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast({
        title: updates.isActive === false ? 'Access revoked' : 'Access updated',
        description: 'The external user has been updated successfully.'
      });
      fetchExternalUsers();
      return true;
    } catch (error: any) {
      console.error('Error updating external user:', error);
      toast({ title: 'Error', description: error.message || 'Failed to update external user', variant: 'destructive' });
      return false;
    }
  };

  const revokeAccess = async (externalUserId: string) => updateExternalUser(externalUserId, { isActive: false });
  const reactivateAccess = async (externalUserId: string) => updateExternalUser(externalUserId, { isActive: true });

  const resetPassword = async (externalUserId: string) => {
    try {
      const { data, error } = await supabase.functions.invoke('reset-external-user-password', {
        body: { externalUserId }
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast({ title: 'Password reset', description: 'A new temporary password has been sent to the user.' });
      fetchExternalUsers();
      return true;
    } catch (error: any) {
      console.error('Error resetting password:', error);
      toast({ title: 'Error', description: error.message || 'Failed to reset password', variant: 'destructive' });
      return false;
    }
  };

  const deleteExternalUser = async (externalUserId: string) => {
    try {
      await supabase.from('external_user_activity_log').delete().eq('external_user_id', externalUserId);
      await supabase.from('external_user_departments').delete().eq('external_user_id', externalUserId);

      const { data: externalUser } = await supabase
        .from('external_users')
        .select('user_id, email')
        .eq('id', externalUserId)
        .single();

      const { error: deleteError } = await supabase.from('external_users').delete().eq('id', externalUserId);
      if (deleteError) throw deleteError;

      if (externalUser?.user_id) {
        await supabase.functions.invoke('delete-user', { body: { user_id: externalUser.user_id } });
      }

      toast({ title: 'User deleted', description: `${externalUser?.email || 'External user'} has been permanently deleted.` });
      fetchExternalUsers();
      return true;
    } catch (error: any) {
      console.error('Error deleting external user:', error);
      toast({ title: 'Error', description: error.message || 'Failed to delete external user', variant: 'destructive' });
      return false;
    }
  };

  const fetchActivityLog = async (externalUserId: string): Promise<ExternalUserActivityLog[]> => {
    try {
      const { data, error } = await supabase
        .from('external_user_activity_log')
        .select('*')
        .eq('external_user_id', externalUserId)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;

      const documentIds = [...new Set(data?.filter(l => l.document_id).map(l => l.document_id) || [])];
      const folderIds = [...new Set(data?.filter(l => l.folder_id).map(l => l.folder_id) || [])];

      let documentNames: Record<string, string> = {};
      let folderNames: Record<string, string> = {};

      if (documentIds.length > 0) {
        const { data: docs } = await supabase.from('documents').select('id, name').in('id', documentIds);
        if (docs) documentNames = docs.reduce((acc, d) => { acc[d.id] = d.name; return acc; }, {} as Record<string, string>);
      }

      if (folderIds.length > 0) {
        const { data: folders } = await supabase.from('document_folders').select('id, name').in('id', folderIds);
        if (folders) folderNames = folders.reduce((acc, f) => { acc[f.id] = f.name; return acc; }, {} as Record<string, string>);
      }

      return (data || []).map(log => ({
        ...log,
        document_name: log.document_id ? documentNames[log.document_id] : undefined,
        folder_name: log.folder_id ? folderNames[log.folder_id] : undefined
      }));
    } catch (error) {
      console.error('Error fetching activity log:', error);
      return [];
    }
  };

  return {
    externalUsers,
    loading,
    inviteExternalUser,
    addToDepartment,
    checkDuplicate,
    updateExternalUser,
    revokeAccess,
    reactivateAccess,
    resetPassword,
    deleteExternalUser,
    fetchActivityLog,
    refetch: fetchExternalUsers
  };
}

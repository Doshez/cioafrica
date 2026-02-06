import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

interface ExternalUserData {
  id: string;
  email: string;
  full_name: string | null;
  department_id: string;
  project_id: string;
  access_level: 'view_only' | 'upload_edit' | 'edit_download';
  access_expires_at: string | null;
  must_change_password: boolean;
  is_active: boolean;
}

export function useExternalUserCheck() {
  const { user, loading: authLoading } = useAuth();
  const [isExternalUser, setIsExternalUser] = useState<boolean | null>(null);
  const [externalUserData, setExternalUserData] = useState<ExternalUserData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkExternalUser = async () => {
      if (!user) {
        setIsExternalUser(false);
        setExternalUserData(null);
        setLoading(false);
        return;
      }

      try {
        const { data: externalUser, error } = await supabase
          .from('external_users')
          .select('*')
          .eq('user_id', user.id)
          .eq('is_active', true)
          .maybeSingle();

        if (error) throw error;

        if (externalUser) {
          setIsExternalUser(true);
          setExternalUserData(externalUser as ExternalUserData);
        } else {
          setIsExternalUser(false);
          setExternalUserData(null);
        }
      } catch (error) {
        console.error('Error checking external user status:', error);
        setIsExternalUser(false);
        setExternalUserData(null);
      } finally {
        setLoading(false);
      }
    };

    if (!authLoading) {
      checkExternalUser();
    }
  }, [user, authLoading]);

  return {
    isExternalUser,
    externalUserData,
    loading: authLoading || loading,
  };
}

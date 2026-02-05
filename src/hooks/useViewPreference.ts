import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import type { ViewType } from '@/components/tasks/types';

export function useViewPreference(departmentId: string | undefined) {
  const { user } = useAuth();
  const [viewType, setViewType] = useState<ViewType>('list');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.id || !departmentId) {
      setLoading(false);
      return;
    }

    const fetchPreference = async () => {
      try {
        const { data, error } = await supabase
          .from('user_view_preferences')
          .select('view_type')
          .eq('user_id', user.id)
          .eq('department_id', departmentId)
          .maybeSingle();

        if (error) throw error;
        
        if (data?.view_type) {
          setViewType(data.view_type as ViewType);
        }
      } catch (error) {
        console.error('Error fetching view preference:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchPreference();
  }, [user?.id, departmentId]);

  const updateViewType = useCallback(async (newViewType: ViewType) => {
    setViewType(newViewType);
    
    if (!user?.id || !departmentId) return;

    try {
      const { error } = await supabase
        .from('user_view_preferences')
        .upsert(
          {
            user_id: user.id,
            department_id: departmentId,
            view_type: newViewType,
          },
          { onConflict: 'user_id,department_id' }
        );

      if (error) throw error;
    } catch (error) {
      console.error('Error saving view preference:', error);
    }
  }, [user?.id, departmentId]);

  return { viewType, setViewType: updateViewType, loading };
}

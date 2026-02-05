import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import type { ViewType } from '@/components/tasks/types';

export function useViewPreference(departmentId?: string, projectId?: string) {
  const { user } = useAuth();
  const [viewType, setViewType] = useState<ViewType>('list');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.id) {
      setLoading(false);
      return;
    }

    const fetchPreference = async () => {
      try {
        let query = supabase
          .from('user_view_preferences')
          .select('view_type')
          .eq('user_id', user.id);
        
        if (departmentId) {
          query = query.eq('department_id', departmentId);
        } else {
          query = query.is('department_id', null);
        }
        
        if (projectId) {
          query = query.eq('project_id', projectId);
        } else {
          query = query.is('project_id', null);
        }

        const { data, error } = await query.maybeSingle();

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
  }, [user?.id, departmentId, projectId]);

  const updateViewType = useCallback(async (newViewType: ViewType) => {
    setViewType(newViewType);
    
    if (!user?.id) return;

    try {
      const { error } = await supabase
        .from('user_view_preferences')
        .upsert(
          {
            user_id: user.id,
            department_id: departmentId || null,
            project_id: projectId || null,
            view_type: newViewType,
          },
          { onConflict: 'user_id,department_id' }
        );

      if (error) throw error;
    } catch (error) {
      console.error('Error saving view preference:', error);
    }
  }, [user?.id, departmentId, projectId]);

  return { viewType, setViewType: updateViewType, loading };
}

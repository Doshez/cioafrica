import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export type UserStatus = 'online' | 'away' | 'busy' | 'offline';

export interface UserPresence {
  user_id: string;
  status: UserStatus;
  custom_status: string | null;
  last_seen_at: string;
  updated_at: string;
}

export const useUserPresence = () => {
  const { user } = useAuth();
  const [presenceMap, setPresenceMap] = useState<Map<string, UserPresence>>(new Map());

  useEffect(() => {
    if (!user) return;

    // Set user as online
    const setOnline = async () => {
      await supabase
        .from('user_presence')
        .upsert({
          user_id: user.id,
          status: 'online',
          last_seen_at: new Date().toISOString(),
        });
    };

    setOnline();

    // Listen to presence changes
    const channel = supabase
      .channel('user-presence-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'user_presence',
        },
        (payload) => {
          if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
            const presence = payload.new as UserPresence;
            setPresenceMap((prev) => {
              const newMap = new Map(prev);
              newMap.set(presence.user_id, presence);
              return newMap;
            });
          }
        }
      )
      .subscribe();

    // Update presence every minute
    const interval = setInterval(() => {
      supabase
        .from('user_presence')
        .update({ last_seen_at: new Date().toISOString() })
        .eq('user_id', user.id)
        .then();
    }, 60000);

    // Set offline on unmount
    return () => {
      clearInterval(interval);
      supabase.removeChannel(channel);
      supabase
        .from('user_presence')
        .update({
          status: 'offline',
          last_seen_at: new Date().toISOString(),
        })
        .eq('user_id', user.id)
        .then();
    };
  }, [user]);

  const updateStatus = async (status: UserStatus, customStatus?: string) => {
    if (!user) return;

    await supabase
      .from('user_presence')
      .upsert({
        user_id: user.id,
        status,
        custom_status: customStatus || null,
        last_seen_at: new Date().toISOString(),
      });
  };

  return { presenceMap, updateStatus };
};

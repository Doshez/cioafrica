import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export const useGlobalUnreadMessages = () => {
  const { user } = useAuth();
  const [totalUnreadCount, setTotalUnreadCount] = useState(0);

  useEffect(() => {
    if (!user) {
      setTotalUnreadCount(0);
      return;
    }

    const fetchTotalUnreadCounts = async () => {
      try {
        // Get all rooms user participates in
        const { data: participations } = await supabase
          .from('chat_participants')
          .select('room_id, last_read_at')
          .eq('user_id', user.id);

        if (!participations || participations.length === 0) {
          setTotalUnreadCount(0);
          return;
        }

        let totalUnread = 0;

        for (const participation of participations) {
          const { count } = await supabase
            .from('chat_messages')
            .select('*', { count: 'exact', head: true })
            .eq('room_id', participation.room_id)
            .neq('user_id', user.id)
            .gt('created_at', participation.last_read_at || '1970-01-01')
            .is('deleted_at', null);

          totalUnread += count || 0;
        }

        setTotalUnreadCount(totalUnread);
      } catch (error) {
        console.error('Error fetching global unread counts:', error);
      }
    };

    fetchTotalUnreadCounts();

    // Subscribe to new messages globally
    const channel = supabase
      .channel(`global-unread-messages-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_messages',
        },
        (payload) => {
          // Only increment if message is not from current user
          if (payload.new.user_id !== user.id) {
            setTotalUnreadCount(prev => prev + 1);
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'chat_participants',
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          // Refetch when user marks messages as read
          fetchTotalUnreadCounts();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  return { totalUnreadCount };
};

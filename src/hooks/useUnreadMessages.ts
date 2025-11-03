import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export const useUnreadMessages = (projectId: string | null) => {
  const { user } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);
  const [unreadByRoom, setUnreadByRoom] = useState<Map<string, number>>(new Map());

  useEffect(() => {
    if (!user || !projectId) return;

    const fetchUnreadCounts = async () => {
      try {
        // Get all rooms user participates in for this project
        const { data: participations } = await supabase
          .from('chat_participants')
          .select('room_id, last_read_at')
          .eq('user_id', user.id);

        if (!participations) return;

        const roomIds = participations.map(p => p.room_id);

        // Get all rooms for this project
        const { data: rooms } = await supabase
          .from('chat_rooms')
          .select('id')
          .eq('project_id', projectId)
          .in('id', roomIds);

        if (!rooms) return;

        const projectRoomIds = rooms.map(r => r.id);

        // Get unread messages for each room
        const unreadMap = new Map<string, number>();
        let totalUnread = 0;

        for (const participation of participations) {
          if (!projectRoomIds.includes(participation.room_id)) continue;

          const { count } = await supabase
            .from('chat_messages')
            .select('*', { count: 'exact', head: true })
            .eq('room_id', participation.room_id)
            .neq('user_id', user.id)
            .gt('created_at', participation.last_read_at || '1970-01-01')
            .is('deleted_at', null);

          const unreadForRoom = count || 0;
          unreadMap.set(participation.room_id, unreadForRoom);
          totalUnread += unreadForRoom;
        }

        setUnreadByRoom(unreadMap);
        setUnreadCount(totalUnread);
      } catch (error) {
        console.error('Error fetching unread counts:', error);
      }
    };

    fetchUnreadCounts();

    // Subscribe to new messages
    const channel = supabase
      .channel(`unread-messages-${projectId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_messages',
        },
        () => {
          fetchUnreadCounts();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, projectId]);

  const markRoomAsRead = async (roomId: string) => {
    if (!user) return;

    try {
      await supabase
        .from('chat_participants')
        .update({ last_read_at: new Date().toISOString() })
        .eq('room_id', roomId)
        .eq('user_id', user.id);

      setUnreadByRoom(prev => {
        const newMap = new Map(prev);
        const roomUnread = newMap.get(roomId) || 0;
        newMap.set(roomId, 0);
        setUnreadCount(prevTotal => Math.max(0, prevTotal - roomUnread));
        return newMap;
      });
    } catch (error) {
      console.error('Error marking room as read:', error);
    }
  };

  return { unreadCount, unreadByRoom, markRoomAsRead };
};

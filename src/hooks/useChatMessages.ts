import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from './use-toast';
import { 
  sendChatMessageNotification, 
  getChatRoomDetails, 
  getPrivateChatRecipient 
} from './useEmailNotifications';

export interface ChatMessage {
  id: string;
  room_id: string;
  user_id: string;
  content: string;
  attachment_url: string | null;
  attachment_name: string | null;
  attachment_type: string | null;
  attachment_size: number | null;
  link_url: string | null;
  link_title: string | null;
  link_description: string | null;
  link_image: string | null;
  parent_message_id: string | null;
  edited_at: string | null;
  created_at: string;
  deleted_at: string | null;
  user?: {
    full_name: string | null;
    avatar_url: string | null;
  };
}

export const useChatMessages = (roomId: string | null) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    if (!roomId) {
      setMessages([]);
      setLoading(false);
      return;
    }

    const fetchMessages = async () => {
      setLoading(true);
      
      // Fetch messages
      const { data: messagesData, error: messagesError } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('room_id', roomId)
        .is('deleted_at', null)
        .order('created_at', { ascending: true });

      if (messagesError) {
        toast({
          title: 'Error loading messages',
          description: messagesError.message,
          variant: 'destructive',
        });
        setLoading(false);
        return;
      }

      // Fetch user profiles for messages
      const userIds = [...new Set(messagesData?.map(m => m.user_id) || [])];
      const { data: profilesData } = await supabase
        .from('profiles')
        .select('id, full_name, avatar_url')
        .in('id', userIds);

      // Merge profiles with messages
      const messagesWithProfiles = messagesData?.map(message => ({
        ...message,
        user: profilesData?.find(p => p.id === message.user_id),
      })) || [];

      setMessages(messagesWithProfiles);
      setLoading(false);
    };

    fetchMessages();

    // Subscribe to new messages
    const channel = supabase
      .channel(`chat-messages-${roomId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_messages',
          filter: `room_id=eq.${roomId}`,
        },
        async (payload) => {
          const { data: messageData } = await supabase
            .from('chat_messages')
            .select('*')
            .eq('id', payload.new.id)
            .single();

          if (messageData) {
            const { data: profileData } = await supabase
              .from('profiles')
              .select('id, full_name, avatar_url')
              .eq('id', messageData.user_id)
              .single();

            setMessages((prev) => [...prev, {
              ...messageData,
              user: profileData,
            }]);
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'chat_messages',
          filter: `room_id=eq.${roomId}`,
        },
        (payload) => {
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === payload.new.id ? { ...msg, ...payload.new } : msg
            )
          );
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'chat_messages',
          filter: `room_id=eq.${roomId}`,
        },
        (payload) => {
          setMessages((prev) => prev.filter((msg) => msg.id !== payload.old.id));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [roomId, toast]);

  const sendMessage = async (content: string, attachmentData?: {
    url: string;
    name: string;
    type: string;
    size: number;
  }) => {
    if (!roomId) return;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast({
        title: 'Error sending message',
        description: 'You must be logged in to send messages',
        variant: 'destructive',
      });
      return;
    }

    const messageData: any = {
      room_id: roomId,
      user_id: user.id,
      content,
      attachment_url: attachmentData?.url || null,
      attachment_name: attachmentData?.name || null,
      attachment_type: attachmentData?.type || null,
      attachment_size: attachmentData?.size || null,
    };

    const { error } = await supabase.from('chat_messages').insert(messageData);

    if (error) {
      toast({
        title: 'Error sending message',
        description: error.message,
        variant: 'destructive',
      });
      return;
    }

    // Send email notification asynchronously (don't block the UI)
    (async () => {
      try {
        // Get user profile for sender name
        const { data: profile } = await supabase
          .from('profiles')
          .select('full_name')
          .eq('id', user.id)
          .single();

        const senderName = profile?.full_name || 'Someone';

        // Get chat room details
        const roomDetails = await getChatRoomDetails(roomId);
        if (!roomDetails) return;

        const projectName = (roomDetails.projects as any)?.name || 'Project';
        const roomType = roomDetails.room_type as 'public' | 'private';

        let recipientIds: string[] = [];

        if (roomType === 'private') {
          // Get the other participant in private chat
          recipientIds = await getPrivateChatRecipient(roomId, user.id);
        }
        // For public chats, the edge function will fetch all project members

        await sendChatMessageNotification({
          room_type: roomType,
          sender_name: senderName,
          message_preview: content,
          project_id: roomDetails.project_id,
          project_name: projectName,
          room_id: roomId,
          recipient_ids: recipientIds,
          sender_id: user.id,
        });
      } catch (notifyError) {
        console.error('Error sending notification:', notifyError);
      }
    })();
  };

  const editMessage = async (messageId: string, newContent: string) => {
    const { error } = await supabase
      .from('chat_messages')
      .update({
        content: newContent,
        edited_at: new Date().toISOString(),
      })
      .eq('id', messageId);

    if (error) {
      toast({
        title: 'Error editing message',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const deleteMessage = async (messageId: string) => {
    const { error } = await supabase
      .from('chat_messages')
      .delete()
      .eq('id', messageId);

    if (error) {
      toast({
        title: 'Error deleting message',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  return { messages, loading, sendMessage, editMessage, deleteMessage };
};

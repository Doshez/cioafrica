import { supabase } from '@/integrations/supabase/client';

interface ChatMessageNotificationData {
  room_type: 'public' | 'private';
  sender_name: string;
  message_preview: string;
  project_id: string;
  project_name: string;
  room_id: string;
  recipient_ids?: string[];
  sender_id: string;
}

interface TaskCompletedNotificationData {
  task_id: string;
  task_name: string;
  department_name: string;
  project_name: string;
  project_id: string;
  completed_by_name: string;
  project_manager_ids: string[];
  task_creator_id?: string;
}

export const sendChatMessageNotification = async (data: ChatMessageNotificationData) => {
  try {
    // Filter out sender from recipients
    const recipientIds = data.recipient_ids?.filter(id => id !== data.sender_id) || [];
    
    const response = await supabase.functions.invoke('send-email-notification', {
      body: {
        type: 'chat_message',
        data: {
          room_type: data.room_type,
          sender_name: data.sender_name,
          message_preview: data.message_preview,
          project_id: data.project_id,
          project_name: data.project_name,
          room_id: data.room_id,
          recipient_ids: recipientIds,
        },
      },
    });

    if (response.error) {
      console.error('Error sending chat notification:', response.error);
    } else {
      console.log('Chat notification sent:', response.data);
    }

    return response;
  } catch (error) {
    console.error('Failed to send chat notification:', error);
    return { error };
  }
};

export const sendTaskCompletedNotification = async (data: TaskCompletedNotificationData) => {
  try {
    const response = await supabase.functions.invoke('send-email-notification', {
      body: {
        type: 'task_completed',
        data: {
          task_id: data.task_id,
          task_name: data.task_name,
          department_name: data.department_name,
          project_name: data.project_name,
          project_id: data.project_id,
          completed_by_name: data.completed_by_name,
          project_manager_ids: data.project_manager_ids,
          task_creator_id: data.task_creator_id,
        },
      },
    });

    if (response.error) {
      console.error('Error sending task completed notification:', response.error);
    } else {
      console.log('Task completed notification sent:', response.data);
    }

    return response;
  } catch (error) {
    console.error('Failed to send task completed notification:', error);
    return { error };
  }
};

// Helper function to get project managers
export const getProjectManagers = async (projectId: string): Promise<string[]> => {
  try {
    const { data: managers, error } = await supabase
      .from('project_members')
      .select('user_id')
      .eq('project_id', projectId)
      .eq('role', 'manager');

    if (error) {
      console.error('Error fetching project managers:', error);
      return [];
    }

    // Also get project owner
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('owner_id')
      .eq('id', projectId)
      .single();

    if (projectError) {
      console.error('Error fetching project owner:', projectError);
    }

    const managerIds = managers?.map(m => m.user_id) || [];
    if (project?.owner_id && !managerIds.includes(project.owner_id)) {
      managerIds.push(project.owner_id);
    }

    return managerIds;
  } catch (error) {
    console.error('Failed to get project managers:', error);
    return [];
  }
};

// Helper function to get chat room details for notification
export const getChatRoomDetails = async (roomId: string) => {
  try {
    const { data: room, error } = await supabase
      .from('chat_rooms')
      .select('id, project_id, room_type, projects(name)')
      .eq('id', roomId)
      .single();

    if (error) {
      console.error('Error fetching chat room:', error);
      return null;
    }

    return room;
  } catch (error) {
    console.error('Failed to get chat room details:', error);
    return null;
  }
};

// Helper function to get private chat recipient
export const getPrivateChatRecipient = async (roomId: string, currentUserId: string): Promise<string[]> => {
  try {
    const { data: participants, error } = await supabase
      .from('chat_participants')
      .select('user_id')
      .eq('room_id', roomId)
      .neq('user_id', currentUserId);

    if (error) {
      console.error('Error fetching chat participants:', error);
      return [];
    }

    return participants?.map(p => p.user_id) || [];
  } catch (error) {
    console.error('Failed to get private chat recipient:', error);
    return [];
  }
};

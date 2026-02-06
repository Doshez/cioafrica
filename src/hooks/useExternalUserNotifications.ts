import { supabase } from '@/integrations/supabase/client';

export type ExternalUserAction = 
  | 'document_upload' 
  | 'document_download' 
  | 'document_view' 
  | 'document_edit'
  | 'link_access' 
  | 'link_created';

interface ExternalUserActivityNotificationData {
  external_user_id: string;
  external_user_name: string;
  external_user_email: string;
  department_id: string;
  department_name: string;
  project_id: string;
  project_name: string;
  action: ExternalUserAction;
  item_type: 'document' | 'link' | 'folder';
  item_name: string;
  item_id?: string;
}

export const sendExternalUserActivityNotification = async (
  data: ExternalUserActivityNotificationData
) => {
  try {
    const response = await supabase.functions.invoke('send-email-notification', {
      body: {
        type: 'external_user_activity',
        data: {
          external_user_id: data.external_user_id,
          external_user_name: data.external_user_name,
          external_user_email: data.external_user_email,
          department_id: data.department_id,
          department_name: data.department_name,
          project_id: data.project_id,
          project_name: data.project_name,
          action: data.action,
          item_type: data.item_type,
          item_name: data.item_name,
          item_id: data.item_id,
        },
      },
    });

    if (response.error) {
      console.error('Error sending external user activity notification:', response.error);
    } else {
      console.log('External user activity notification sent:', response.data);
    }

    return response;
  } catch (error) {
    console.error('Failed to send external user activity notification:', error);
    return { error };
  }
};

// Helper to get action label for display
export const getActionLabel = (action: ExternalUserAction): string => {
  const labels: Record<ExternalUserAction, string> = {
    document_upload: 'Uploaded a document',
    document_download: 'Downloaded a document',
    document_view: 'Viewed a document',
    document_edit: 'Edited a document',
    link_access: 'Accessed a shared link',
    link_created: 'Created/shared a link',
  };
  return labels[action] || action;
};

// Helper to determine if action is high-risk (for smart notifications)
export const isHighRiskAction = (action: ExternalUserAction): boolean => {
  const highRiskActions: ExternalUserAction[] = [
    'document_upload',
    'document_edit',
    'link_created',
  ];
  return highRiskActions.includes(action);
};

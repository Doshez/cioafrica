import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

const sendEmail = async (to: string, subject: string, html: string) => {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${RESEND_API_KEY}`,
    },
    body: JSON.stringify({
      from: "CIO Africa Project Planner <cas2026@cioafrica.co>",
      to: [to],
      subject,
      html,
    }),
  });
  
  if (!res.ok) {
    const error = await res.text();
    throw new Error(`Failed to send email: ${error}`);
  }
  
  return res.json();
};



const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface EmailNotificationRequest {
  type: 'chat_message' | 'task_overdue' | 'task_completed' | 'document_access_granted';
  data: ChatMessageData | TaskOverdueData | TaskCompletedData | DocumentAccessData;
}

interface DocumentAccessData {
  item_type: 'document' | 'folder' | 'link';
  item_name: string;
  permission: 'view_only' | 'download' | 'edit';
  project_id: string;
  project_name: string;
  granted_by_name: string;
  recipient_user_id: string;
}

interface ChatMessageData {
  room_type: 'public' | 'private';
  sender_name: string;
  message_preview: string;
  project_id: string;
  project_name: string;
  room_id: string;
  recipient_ids?: string[]; // For private chat, this is just one recipient
}

interface TaskOverdueData {
  task_id: string;
  task_name: string;
  department_name: string;
  project_name: string;
  project_id: string;
  assigned_user_id: string;
  project_manager_ids: string[];
}

interface TaskCompletedData {
  task_id: string;
  task_name: string;
  department_name: string;
  project_name: string;
  project_id: string;
  completed_by_name: string;
  project_manager_ids: string[];
  task_creator_id?: string;
}

const getBaseUrl = () => {
  // Use the production domain
  return "https://projects.cioafrica.co";
};

const generateEmailHtml = (
  heading: string,
  body: string,
  ctaText: string,
  ctaLink: string,
  footerText: string
) => {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${heading}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f4f4f5; margin: 0; padding: 20px; }
    .container { max-width: 500px; margin: 0 auto; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
    .header { background: #2563eb; padding: 24px; text-align: center; }
    .header h1 { color: white; margin: 0; font-size: 20px; font-weight: 600; }
    .content { padding: 24px; }
    .message { background: #f8fafc; border-left: 4px solid #2563eb; padding: 12px 16px; margin: 16px 0; border-radius: 0 4px 4px 0; }
    .message p { margin: 0; color: #334155; font-size: 14px; line-height: 1.5; }
    .cta { text-align: center; margin: 24px 0; }
    .cta a { display: inline-block; background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 500; font-size: 14px; }
    .cta a:hover { background: #1d4ed8; }
    .footer { padding: 16px 24px; text-align: center; color: #64748b; font-size: 12px; border-top: 1px solid #e2e8f0; }
    @media (max-width: 600px) {
      body { padding: 10px; }
      .header h1 { font-size: 18px; }
      .content { padding: 16px; }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>${heading}</h1>
    </div>
    <div class="content">
      ${body}
      <div class="cta">
        <a href="${ctaLink}">${ctaText}</a>
      </div>
    </div>
    <div class="footer">
      ${footerText}
    </div>
  </div>
</body>
</html>
  `;
};

const truncateMessage = (message: string, maxLines: number = 2): string => {
  const lines = message.split('\n').slice(0, maxLines);
  let preview = lines.join(' ').trim();
  if (preview.length > 100) {
    preview = preview.substring(0, 100) + '...';
  }
  return preview;
};

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { type, data }: EmailNotificationRequest = await req.json();
    const baseUrl = getBaseUrl();
    
    console.log(`Processing ${type} notification`, { data });

    let emails: { to: string; subject: string; html: string }[] = [];

    if (type === 'chat_message') {
      const chatData = data as ChatMessageData;
      const messagePreview = truncateMessage(chatData.message_preview);
      
      // Get recipients' emails
      let recipientIds: string[] = [];
      
      if (chatData.room_type === 'public') {
        // Get all project members except sender
        const { data: members, error } = await supabase
          .from('project_members')
          .select('user_id')
          .eq('project_id', chatData.project_id);
        
        if (error) {
          console.error('Error fetching project members:', error);
          throw error;
        }
        
        recipientIds = members?.map(m => m.user_id) || [];
      } else {
        // Private chat - use provided recipient IDs
        recipientIds = chatData.recipient_ids || [];
      }

      // Filter out any undefined/null and get unique IDs
      recipientIds = [...new Set(recipientIds.filter(Boolean))];

      if (recipientIds.length === 0) {
        console.log('No recipients found for notification');
        return new Response(JSON.stringify({ success: true, sent: 0 }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Get recipient profiles with emails
      const { data: profiles, error: profileError } = await supabase
        .from('profiles')
        .select('id, email, full_name')
        .in('id', recipientIds);

      if (profileError) {
        console.error('Error fetching profiles:', profileError);
        throw profileError;
      }

      const subject = chatData.room_type === 'public'
        ? `New message from ${chatData.sender_name} in ${chatData.project_name} Project planner Chat`
        : `Private message from ${chatData.sender_name} On ${chatData.project_name} Project Planner`;

      const ctaLink = `${baseUrl}/projects/${chatData.project_id}`;

      for (const profile of profiles || []) {
        if (!profile.email) continue;

        const heading = chatData.room_type === 'public' 
          ? `New Message in ${chatData.project_name}`
          : `Private Message from ${chatData.sender_name}`;

        const body = `
          <p style="margin: 0 0 12px; color: #334155; font-size: 14px;">
            <strong>${chatData.sender_name}</strong> sent a message:
          </p>
          <div class="message">
            <p>${messagePreview}</p>
          </div>
        `;

        const html = generateEmailHtml(
          heading,
          body,
          'View in Project Planner',
          ctaLink,
          `This notification is from ${chatData.project_name} on CIO Africa Project Planner`
        );

        emails.push({ to: profile.email, subject, html });
      }
    } else if (type === 'task_overdue') {
      const taskData = data as TaskOverdueData;
      const ctaLink = `${baseUrl}/projects/${taskData.project_id}`;
      const subject = `⏰ Task Overdue: ${taskData.task_name} On ${taskData.department_name} for ${taskData.project_name}`;

      // Get all recipients (assigned user + project managers)
      const recipientIds = [taskData.assigned_user_id, ...taskData.project_manager_ids].filter(Boolean);
      const uniqueRecipientIds = [...new Set(recipientIds)];

      const { data: profiles, error: profileError } = await supabase
        .from('profiles')
        .select('id, email, full_name')
        .in('id', uniqueRecipientIds);

      if (profileError) {
        console.error('Error fetching profiles:', profileError);
        throw profileError;
      }

      for (const profile of profiles || []) {
        if (!profile.email) continue;

        const isAssignee = profile.id === taskData.assigned_user_id;
        const roleText = isAssignee ? "You are assigned to" : "A task in your project is";

        const body = `
          <p style="margin: 0 0 12px; color: #334155; font-size: 14px;">
            ${roleText} overdue:
          </p>
          <div class="message">
            <p><strong>Task:</strong> ${taskData.task_name}</p>
            <p><strong>Department:</strong> ${taskData.department_name}</p>
            <p><strong>Project:</strong> ${taskData.project_name}</p>
          </div>
          <p style="margin: 12px 0 0; color: #64748b; font-size: 13px;">
            Please review and update the task status.
          </p>
        `;

        const html = generateEmailHtml(
          '⏰ Task Overdue',
          body,
          'View in Project Planner',
          ctaLink,
          `This notification is from ${taskData.project_name} on CIO Africa Project Planner`
        );

        emails.push({ to: profile.email, subject, html });
      }
    } else if (type === 'task_completed') {
      const taskData = data as TaskCompletedData;
      const ctaLink = `${baseUrl}/projects/${taskData.project_id}`;
      const subject = `✅ Task Completed: ${taskData.task_name} ${taskData.department_name} for ${taskData.project_name}`;

      // Get all recipients (project managers + task creator if different)
      const recipientIds = [...taskData.project_manager_ids];
      if (taskData.task_creator_id && !recipientIds.includes(taskData.task_creator_id)) {
        recipientIds.push(taskData.task_creator_id);
      }

      const uniqueRecipientIds = [...new Set(recipientIds.filter(Boolean))];

      const { data: profiles, error: profileError } = await supabase
        .from('profiles')
        .select('id, email, full_name')
        .in('id', uniqueRecipientIds);

      if (profileError) {
        console.error('Error fetching profiles:', profileError);
        throw profileError;
      }

      for (const profile of profiles || []) {
        if (!profile.email) continue;

        const body = `
          <p style="margin: 0 0 12px; color: #334155; font-size: 14px;">
            A task has been completed by <strong>${taskData.completed_by_name}</strong>:
          </p>
          <div class="message">
            <p><strong>Task:</strong> ${taskData.task_name}</p>
            <p><strong>Department:</strong> ${taskData.department_name}</p>
            <p><strong>Project:</strong> ${taskData.project_name}</p>
          </div>
        `;

        const html = generateEmailHtml(
          '✅ Task Completed',
          body,
          'View in Project Planner',
          ctaLink,
          `This notification is from ${taskData.project_name} on CIO Africa Project Planner`
        );

        emails.push({ to: profile.email, subject, html });
      }
    } else if (type === 'document_access_granted') {
      const accessData = data as DocumentAccessData;
      const ctaLink = `${baseUrl}/projects/${accessData.project_id}/documents`;
      
      const itemTypeLabel = accessData.item_type === 'document' ? 'File' : 
                            accessData.item_type === 'folder' ? 'Folder' : 'Link';
      
      const permissionLabel = accessData.permission === 'view_only' ? 'View Only' :
                              accessData.permission === 'download' ? 'Download' : 'Edit';
      
      const subject = `📁 You've been granted access to a ${itemTypeLabel.toLowerCase()} in ${accessData.project_name}`;

      // Get recipient profile
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('id, email, full_name')
        .eq('id', accessData.recipient_user_id)
        .single();

      if (profileError) {
        console.error('Error fetching recipient profile:', profileError);
        throw profileError;
      }

      if (profile?.email) {
        const body = `
          <p style="margin: 0 0 12px; color: #334155; font-size: 14px;">
            <strong>${accessData.granted_by_name}</strong> has granted you access to a ${itemTypeLabel.toLowerCase()}:
          </p>
          <div class="message">
            <p><strong>${itemTypeLabel}:</strong> ${accessData.item_name}</p>
            <p><strong>Permission:</strong> ${permissionLabel}</p>
            <p><strong>Project:</strong> ${accessData.project_name}</p>
          </div>
          <p style="margin: 12px 0 0; color: #64748b; font-size: 13px;">
            You can now access this ${itemTypeLabel.toLowerCase()} in the project's documents section.
          </p>
        `;

        const html = generateEmailHtml(
          `📁 ${itemTypeLabel} Access Granted`,
          body,
          'View Documents',
          ctaLink,
          `This notification is from ${accessData.project_name} on CIO Africa Project Planner`
        );

        emails.push({ to: profile.email, subject, html });
      }
    }

    // Send all emails
    let sentCount = 0;
    for (const email of emails) {
      try {
        await sendEmail(email.to, email.subject, email.html);
        sentCount++;
        console.log(`Email sent to ${email.to}`);
      } catch (emailError) {
        console.error(`Error sending email to ${email.to}:`, emailError);
      }
    }

    console.log(`Sent ${sentCount}/${emails.length} emails`);

    return new Response(
      JSON.stringify({ success: true, sent: sentCount, total: emails.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error in send-email-notification:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
};

serve(handler);

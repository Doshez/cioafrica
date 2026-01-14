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

const getBaseUrl = () => {
  return "https://projects.cioafrica.co";
};

const generateEmailHtml = (
  taskName: string,
  departmentName: string,
  projectName: string,
  projectId: string,
  isAssignee: boolean
) => {
  const baseUrl = getBaseUrl();
  const ctaLink = `${baseUrl}/projects/${projectId}`;
  const roleText = isAssignee ? "You are assigned to" : "A task in your project is";

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Task Overdue</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f4f4f5; margin: 0; padding: 20px; }
    .container { max-width: 500px; margin: 0 auto; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
    .header { background: #dc2626; padding: 24px; text-align: center; }
    .header h1 { color: white; margin: 0; font-size: 20px; font-weight: 600; }
    .content { padding: 24px; }
    .message { background: #fef2f2; border-left: 4px solid #dc2626; padding: 12px 16px; margin: 16px 0; border-radius: 0 4px 4px 0; }
    .message p { margin: 4px 0; color: #334155; font-size: 14px; line-height: 1.5; }
    .cta { text-align: center; margin: 24px 0; }
    .cta a { display: inline-block; background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 500; font-size: 14px; }
    .footer { padding: 16px 24px; text-align: center; color: #64748b; font-size: 12px; border-top: 1px solid #e2e8f0; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>⏰ Task Overdue</h1>
    </div>
    <div class="content">
      <p style="margin: 0 0 12px; color: #334155; font-size: 14px;">
        ${roleText} overdue:
      </p>
      <div class="message">
        <p><strong>Task:</strong> ${taskName}</p>
        <p><strong>Department:</strong> ${departmentName}</p>
        <p><strong>Project:</strong> ${projectName}</p>
      </div>
      <p style="margin: 12px 0 0; color: #64748b; font-size: 13px;">
        Please review and update the task status.
      </p>
      <div class="cta">
        <a href="${ctaLink}">View in Project Planner</a>
      </div>
    </div>
    <div class="footer">
      This notification is from ${projectName} on CIO Africa Project Planner
    </div>
  </div>
</body>
</html>
  `;
};

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log("Checking for overdue tasks...");

    // Get today's date in EAT timezone
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];

    // Find overdue tasks that are not completed
    const { data: overdueTasks, error: tasksError } = await supabase
      .from('tasks')
      .select(`
        id,
        title,
        due_date,
        assignee_user_id,
        project_id,
        status,
        projects!inner(id, name, owner_id),
        departments!tasks_assignee_department_id_fkey(id, name)
      `)
      .lt('due_date', todayStr)
      .neq('status', 'done')
      .not('assignee_user_id', 'is', null);

    if (tasksError) {
      console.error('Error fetching overdue tasks:', tasksError);
      throw tasksError;
    }

    console.log(`Found ${overdueTasks?.length || 0} overdue tasks`);

    if (!overdueTasks || overdueTasks.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: "No overdue tasks found", sent: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let sentCount = 0;

    for (const task of overdueTasks) {
      const project = task.projects as any;
      const department = task.departments as any;
      const departmentName = department?.name || 'General';
      const projectName = project?.name || 'Unknown Project';
      const projectId = project?.id || task.project_id;

      // Get project managers
      const { data: managers, error: managersError } = await supabase
        .from('project_members')
        .select('user_id')
        .eq('project_id', task.project_id)
        .eq('role', 'manager');

      if (managersError) {
        console.error('Error fetching managers:', managersError);
        continue;
      }

      // Collect all recipient IDs (assignee + managers + owner)
      const recipientIds = new Set<string>();
      if (task.assignee_user_id) recipientIds.add(task.assignee_user_id);
      if (project?.owner_id) recipientIds.add(project.owner_id);
      managers?.forEach(m => recipientIds.add(m.user_id));

      // Get profiles for all recipients
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, email, full_name')
        .in('id', Array.from(recipientIds));

      if (profilesError) {
        console.error('Error fetching profiles:', profilesError);
        continue;
      }

      const subject = `⏰ Task Overdue: ${task.title} On ${departmentName} for ${projectName}`;

      for (const profile of profiles || []) {
        if (!profile.email) continue;

        const isAssignee = profile.id === task.assignee_user_id;
        const html = generateEmailHtml(
          task.title,
          departmentName,
          projectName,
          projectId,
          isAssignee
        );

        try {
          await sendEmail(profile.email, subject, html);
          sentCount++;
          console.log(`Overdue notification sent to ${profile.email} for task: ${task.title}`);
        } catch (emailError) {
          console.error(`Error sending email to ${profile.email}:`, emailError);
        }
      }
    }

    console.log(`Sent ${sentCount} overdue task notifications`);

    return new Response(
      JSON.stringify({ success: true, sent: sentCount, tasksChecked: overdueTasks.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error in check-overdue-tasks:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
};

serve(handler);

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { Resend } from "npm:resend@2.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const resend = new Resend(Deno.env.get("RESEND_API_KEY"));
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { projectId, isTest } = await req.json();

    if (!projectId) {
      throw new Error("Project ID is required");
    }

    // Fetch project
    const { data: project } = await supabase
      .from("projects")
      .select("name")
      .eq("id", projectId)
      .single();

    if (!project) throw new Error("Project not found");

    // Fetch recipients
    const { data: recipients } = await supabase
      .from("project_report_recipients")
      .select("email, name")
      .eq("project_id", projectId)
      .eq("is_active", true);

    if (!recipients?.length) throw new Error("No active recipients");

    // Fetch tasks
    const { data: tasks } = await supabase
      .from("tasks")
      .select("id, title, status, due_date, completed_at, assignee_department_id")
      .eq("project_id", projectId);

    // Fetch departments
    const { data: departments } = await supabase
      .from("departments")
      .select("id, name")
      .eq("project_id", projectId);

    // Calculate stats
    const today = new Date();
    const todayStr = today.toISOString().split("T")[0];
    const taskList = tasks || [];
    
    const total = taskList.length;
    const completed = taskList.filter(t => t.status === "done").length;
    const inProgress = taskList.filter(t => t.status === "in_progress").length;
    const todo = taskList.filter(t => t.status === "todo").length;
    const overdue = taskList.filter(t => t.status !== "done" && t.due_date && t.due_date < todayStr).length;
    const completedToday = taskList.filter(t => t.completed_at?.startsWith(todayStr)).length;
    const completion = total > 0 ? Math.round((completed / total) * 100) : 0;

    // Health
    const overdueRate = total > 0 ? overdue / total : 0;
    let health = { icon: "🟢", label: "On Track", color: "#22c55e" };
    if (overdueRate > 0.3) health = { icon: "🔴", label: "At Risk", color: "#ef4444" };
    else if (overdueRate > 0.1) health = { icon: "🟠", label: "Needs Attention", color: "#f97316" };

    const reportDate = today.toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
    const projectUrl = `https://cioafrica.lovable.app/projects/${projectId}`;

    // Department stats
    const deptStats = (departments || []).map(d => {
      const dt = taskList.filter(t => t.assignee_department_id === d.id);
      const dc = dt.filter(t => t.status === "done").length;
      const dov = dt.filter(t => t.status !== "done" && t.due_date && t.due_date < todayStr).length;
      return { name: d.name, total: dt.length, completed: dc, overdue: dov, pct: dt.length ? Math.round((dc / dt.length) * 100) : 0 };
    });

    const emailHtml = `
<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;font-family:system-ui,sans-serif;background:#f4f4f5">
<table width="100%" cellpadding="0" cellspacing="0" style="padding:20px">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 6px rgba(0,0,0,0.1)">
  <tr><td style="background:linear-gradient(135deg,#3b82f6,#8b5cf6);padding:30px;text-align:center">
    <h1 style="color:#fff;margin:0;font-size:24px">📊 Daily Project Report</h1>
    <p style="color:rgba(255,255,255,0.9);margin:10px 0 0;font-size:14px">${project.name}${isTest ? " (TEST)" : ""}</p>
    <p style="color:rgba(255,255,255,0.8);margin:5px 0 0;font-size:12px">${reportDate}</p>
  </td></tr>
  <tr><td style="padding:25px">
    <table width="100%" style="background:${health.color}15;border-radius:8px;border-left:4px solid ${health.color}">
    <tr><td style="padding:20px">
      <h2 style="margin:0;font-size:18px;color:#1f2937">Project Health: ${health.icon} ${health.label}</h2>
      <p style="margin:10px 0 0;font-size:14px;color:#6b7280">Overall: <strong>${completion}%</strong></p>
      <div style="background:#e5e7eb;border-radius:9999px;height:8px;margin-top:10px;overflow:hidden">
        <div style="background:${health.color};height:100%;width:${completion}%"></div>
      </div>
    </td></tr></table>
  </td></tr>
  <tr><td style="padding:0 25px 25px">
    <h3 style="margin:0 0 15px;font-size:16px;color:#374151">📈 Key Metrics</h3>
    <table width="100%" cellpadding="0" cellspacing="10">
    <tr>
      <td width="25%" style="text-align:center;background:#f0fdf4;border-radius:8px;padding:15px">
        <div style="font-size:28px;font-weight:bold;color:#22c55e">${completed}</div>
        <div style="font-size:12px;color:#6b7280;margin-top:5px">Completed</div>
      </td>
      <td width="25%" style="text-align:center;background:#eff6ff;border-radius:8px;padding:15px">
        <div style="font-size:28px;font-weight:bold;color:#3b82f6">${inProgress}</div>
        <div style="font-size:12px;color:#6b7280;margin-top:5px">In Progress</div>
      </td>
      <td width="25%" style="text-align:center;background:#f5f5f5;border-radius:8px;padding:15px">
        <div style="font-size:28px;font-weight:bold;color:#6b7280">${todo}</div>
        <div style="font-size:12px;color:#6b7280;margin-top:5px">To Do</div>
      </td>
      <td width="25%" style="text-align:center;background:#fef2f2;border-radius:8px;padding:15px">
        <div style="font-size:28px;font-weight:bold;color:#ef4444">${overdue}</div>
        <div style="font-size:12px;color:#6b7280;margin-top:5px">Overdue</div>
      </td>
    </tr></table>
  </td></tr>
  <tr><td style="padding:0 25px 25px">
    <div style="background:#f8fafc;border-radius:8px;padding:20px">
      <h3 style="margin:0 0 10px;font-size:16px;color:#374151">⚡ Today's Activity</h3>
      <p style="margin:0;font-size:14px;color:#6b7280"><span style="color:#22c55e;font-weight:bold">${completedToday}</span> tasks completed today</p>
    </div>
  </td></tr>
  ${deptStats.length > 0 ? `
  <tr><td style="padding:0 25px 25px">
    <h3 style="margin:0 0 15px;font-size:16px;color:#374151">🏢 Department Performance</h3>
    <table width="100%" style="border:1px solid #e5e7eb;border-radius:8px;overflow:hidden" cellpadding="0" cellspacing="0">
      <tr style="background:#f9fafb">
        <td style="padding:12px;font-weight:600;font-size:12px;color:#6b7280">Department</td>
        <td style="padding:12px;font-weight:600;font-size:12px;color:#6b7280;text-align:center">Tasks</td>
        <td style="padding:12px;font-weight:600;font-size:12px;color:#6b7280;text-align:center">Overdue</td>
        <td style="padding:12px;font-weight:600;font-size:12px;color:#6b7280;text-align:right">Progress</td>
      </tr>
      ${deptStats.map(d => `
      <tr style="border-top:1px solid #e5e7eb">
        <td style="padding:12px;font-size:14px;color:#374151">${d.name}</td>
        <td style="padding:12px;font-size:14px;text-align:center">${d.total}</td>
        <td style="padding:12px;font-size:14px;text-align:center;color:${d.overdue > 0 ? '#ef4444' : '#6b7280'}">${d.overdue}</td>
        <td style="padding:12px;font-size:14px;text-align:right;font-weight:bold;color:${d.pct >= 70 ? '#22c55e' : d.pct >= 40 ? '#f59e0b' : '#ef4444'}">${d.pct}%</td>
      </tr>`).join('')}
    </table>
  </td></tr>` : ''}
  <tr><td style="padding:0 25px 30px;text-align:center">
    <a href="${projectUrl}" style="display:inline-block;background:linear-gradient(135deg,#3b82f6,#8b5cf6);color:#fff;text-decoration:none;padding:14px 32px;border-radius:8px;font-weight:600;font-size:14px">View Full Project →</a>
  </td></tr>
  <tr><td style="background:#f9fafb;padding:20px;text-align:center;border-top:1px solid #e5e7eb">
    <p style="margin:0;font-size:12px;color:#9ca3af">Automated report from CIO Africa Project Planner</p>
    <p style="margin:5px 0 0;font-size:12px;color:#9ca3af">Sent from noreply@cioafrica.co</p>
  </td></tr>
</table>
</td></tr></table>
</body></html>`;

    // Send emails
    const results = await Promise.all(recipients.map(async (r: any) => {
      try {
        await resend.emails.send({
          from: "CIO Africa <noreply@cioafrica.co>",
          to: [r.email],
          subject: `${isTest ? "[TEST] " : ""}📊 ${project.name} - Daily Report`,
          html: emailHtml,
        });
        return { email: r.email, success: true };
      } catch (e: any) {
        return { email: r.email, success: false, error: e.message };
      }
    }));

    // Update last_sent_at
    await supabase.from("project_report_settings").update({ last_sent_at: new Date().toISOString() }).eq("project_id", projectId);

    const sent = results.filter(r => r.success).length;
    return new Response(JSON.stringify({ success: true, sentTo: sent, total: recipients.length }), { headers: { "Content-Type": "application/json", ...corsHeaders } });
  } catch (error: any) {
    console.error("Error:", error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } });
  }
});

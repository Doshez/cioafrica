import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import { Resend } from "https://esm.sh/resend@4.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));
const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface NotificationRequest {
  userEmail: string;
  userFullName: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { userEmail, userFullName }: NotificationRequest = await req.json();

    // Get admin users
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    // First get admin user IDs
    const { data: adminRoles, error: rolesError } = await supabase
      .from('user_roles')
      .select('user_id')
      .eq('role', 'admin');

    if (rolesError) {
      console.error('Error fetching admin roles:', rolesError);
      throw new Error('Failed to fetch admin users');
    }

    if (!adminRoles || adminRoles.length === 0) {
      console.error('No admin users found');
      throw new Error('No admin users found');
    }

    // Get admin user IDs
    const adminUserIds = adminRoles.map(role => role.user_id);

    // Then get their profiles
    const { data: adminProfiles, error: profilesError } = await supabase
      .from('profiles')
      .select('id, email, full_name')
      .in('id', adminUserIds);

    if (profilesError) {
      console.error('Error fetching admin profiles:', profilesError);
      throw new Error('Failed to fetch admin profiles');
    }

    if (!adminProfiles || adminProfiles.length === 0) {
      console.error('No admin profiles found');
      throw new Error('No admin profiles found');
    }

    console.log(`Sending notifications to ${adminProfiles.length} admin(s)`);

    // Send email to each admin
    for (const adminProfile of adminProfiles) {
      if (!adminProfile.email) {
        console.warn(`Admin ${adminProfile.id} has no email, skipping`);
        continue;
      }

      const resetUrl = `${Deno.env.get('SUPABASE_URL')?.replace('supabase.co', 'lovableproject.com')}/admin/users`;

      console.log(`Sending email to admin: ${adminProfile.email}`);

      await resend.emails.send({
        from: 'Project Planner <onboarding@resend.dev>',
        to: [adminProfile.email],
        subject: `Password reset requested for ${userEmail}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2>Password Reset Request</h2>
            <p>Hi ${adminProfile.full_name || 'Admin'},</p>
            <p><strong>${userFullName}</strong> (${userEmail}) has requested a password reset.</p>
            <p>You can reset their password from the admin panel or click the button below to generate and send a temporary password.</p>
            <div style="margin: 30px 0;">
              <a href="${resetUrl}" 
                 style="background-color: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
                Open Admin Panel
              </a>
            </div>
            <p style="color: #666; font-size: 14px;">If you didn't expect this, please verify the request before proceeding.</p>
            <p style="color: #999; font-size: 12px; margin-top: 40px;">Thanks — your system, watching out for your team.</p>
          </div>
        `,
      });

      console.log(`Email sent successfully to ${adminProfile.email}`);
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("Error in notify-admin-password-reset:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import { Resend } from "https://esm.sh/resend@4.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));
const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface AddToDepartmentRequest {
  externalUserId: string;
  departmentId: string;
  accessLevel: 'view_only' | 'upload_edit' | 'edit_download';
  addedByUserId: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { externalUserId, departmentId, accessLevel, addedByUserId }: AddToDepartmentRequest = await req.json();

    if (!externalUserId || !departmentId || !addedByUserId) {
      throw new Error('Missing required fields');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get external user details
    const { data: externalUser, error: userError } = await supabase
      .from('external_users')
      .select('id, email, full_name, user_id, department_id, departments(name)')
      .eq('id', externalUserId)
      .single();

    if (userError || !externalUser) {
      throw new Error('External user not found');
    }

    // Check if already associated with this department
    const { data: existing } = await supabase
      .from('external_user_departments')
      .select('id')
      .eq('external_user_id', externalUserId)
      .eq('department_id', departmentId)
      .single();

    if (existing) {
      return new Response(
        JSON.stringify({ error: 'User is already associated with this department' }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Also check if this is their owning department
    if (externalUser.department_id === departmentId) {
      return new Response(
        JSON.stringify({ error: 'User already belongs to this department' }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Create the department association
    const { error: insertError } = await supabase
      .from('external_user_departments')
      .insert({
        external_user_id: externalUserId,
        department_id: departmentId,
        access_level: accessLevel,
        added_by: addedByUserId,
      });

    if (insertError) {
      console.error('Error adding department association:', insertError);
      throw new Error('Failed to add user to department');
    }

    // Get department name for logging
    const { data: dept } = await supabase
      .from('departments')
      .select('name')
      .eq('id', departmentId)
      .single();

    // Log the activity
    await supabase
      .from('external_user_activity_log')
      .insert({
        external_user_id: externalUserId,
        action: 'added_to_department',
        details: {
          department_id: departmentId,
          department_name: dept?.name,
          access_level: accessLevel,
          added_by: addedByUserId,
        }
      });

    // Send notification email
    await resend.emails.send({
      from: 'CIO Africa <noreply@cioafrica.co>',
      to: [externalUser.email],
      subject: `You've been added to ${dept?.name || 'a new department'} — CIO Africa`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #1f2937;">New Department Access</h2>
          <p>Hi ${externalUser.full_name || 'there'},</p>
          <p>You've been granted access to documents in the <strong>${dept?.name || 'department'}</strong> department.</p>
          <div style="background-color: #f3f4f6; padding: 16px; border-radius: 8px; margin: 20px 0;">
            <p style="margin: 0; font-size: 14px; color: #6b7280;">Access Level</p>
            <p style="margin: 4px 0 0; font-size: 16px; font-weight: 600; color: #1f2937;">
              ${{ view_only: 'View Only', upload_edit: 'Upload & Edit', edit_download: 'Edit & Download' }[accessLevel]}
            </p>
          </div>
          <p>You can use your existing login credentials to access documents in this department.</p>
          <div style="text-align: center; margin: 24px 0;">
            <a href="https://projects.cioafrica.co/external-login" 
               style="background-color: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; display: inline-block; font-weight: 600;">
              Access Documents
            </a>
          </div>
        </div>
      `,
    });

    console.log(`Added external user ${externalUser.email} to department ${dept?.name}`);

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: any) {
    console.error("Error in add-external-user-to-department:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);

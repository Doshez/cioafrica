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

interface UpdateExternalUserRequest {
  externalUserId: string;
  accessLevel?: 'view_only' | 'upload_edit' | 'edit_download';
  accessExpiresAt?: string | null;
  isActive?: boolean;
  updatedByUserId: string;
  notificationType: 'updated' | 'revoked';
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { 
      externalUserId, 
      accessLevel,
      accessExpiresAt,
      isActive,
      updatedByUserId,
      notificationType
    }: UpdateExternalUserRequest = await req.json();
    
    console.log('Updating external user:', externalUserId);
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    // Get external user details
    const { data: externalUser, error: fetchError } = await supabase
      .from('external_users')
      .select('*, departments(name), projects(name)')
      .eq('id', externalUserId)
      .single();
      
    if (fetchError || !externalUser) {
      throw new Error('External user not found');
    }
    
    // Build update object
    const updateData: Record<string, any> = {};
    if (accessLevel !== undefined) updateData.access_level = accessLevel;
    if (accessExpiresAt !== undefined) updateData.access_expires_at = accessExpiresAt;
    if (isActive !== undefined) updateData.is_active = isActive;
    
    // Update external user
    const { error: updateError } = await supabase
      .from('external_users')
      .update(updateData)
      .eq('id', externalUserId);
      
    if (updateError) {
      console.error('Error updating external user:', updateError);
      throw new Error('Failed to update external user');
    }
    
    // Log the activity
    await supabase
      .from('external_user_activity_log')
      .insert({
        external_user_id: externalUserId,
        action: notificationType === 'revoked' ? 'access_revoked' : 'access_updated',
        details: {
          updated_by: updatedByUserId,
          changes: updateData
        }
      });
    
    // Get updater's name
    const { data: updater } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('id', updatedByUserId)
      .single();
    
    // Send notification email
    const departmentName = (externalUser as any).departments?.name || 'Department';
    const projectName = (externalUser as any).projects?.name || 'Project';
    
    if (notificationType === 'revoked') {
      await resend.emails.send({
        from: 'CIO Africa Project Planner <michael.odongo@cioafrica.co>',
        to: [externalUser.email],
        subject: `Your document access has been revoked — ${projectName}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2>Access Revoked</h2>
            <p>Hi ${externalUser.full_name || 'there'},</p>
            <p>Your access to documents in the <strong>${departmentName}</strong> department of <strong>${projectName}</strong> has been revoked by ${updater?.full_name || 'an administrator'}.</p>
            
            <p style="color: #666; font-size: 14px;">If you believe this was done in error, please contact the project administrator.</p>
            
            <p style="margin-top: 40px;">Warmly,<br>The CIO Africa Team</p>
          </div>
        `,
      });
    } else {
      const accessLevelLabel = {
        'view_only': 'View Only',
        'upload_edit': 'Upload & Edit',
        'edit_download': 'Edit & Download'
      }[accessLevel || externalUser.access_level];
      
      const expiryInfo = accessExpiresAt 
        ? `<p style="color: #666;">Your access now expires on: <strong>${new Date(accessExpiresAt).toLocaleDateString()}</strong></p>`
        : '';
        
      await resend.emails.send({
        from: 'CIO Africa Project Planner <michael.odongo@cioafrica.co>',
        to: [externalUser.email],
        subject: `Your document access has been updated — ${projectName}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2>Access Updated</h2>
            <p>Hi ${externalUser.full_name || 'there'},</p>
            <p>Your access to documents in the <strong>${departmentName}</strong> department of <strong>${projectName}</strong> has been updated by ${updater?.full_name || 'an administrator'}.</p>
            
            <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <p style="margin: 0 0 10px 0; font-size: 14px; color: #666;">Your new access level:</p>
              <p style="margin: 0; font-size: 18px; font-weight: bold; color: #3b82f6;">${accessLevelLabel}</p>
            </div>
            
            ${expiryInfo}
            
            <p style="margin-top: 40px;">Warmly,<br>The CIO Africa Team</p>
          </div>
        `,
      });
    }
    
    console.log('Update notification email sent to:', externalUser.email);

    return new Response(
      JSON.stringify({ success: true, message: 'External user updated successfully' }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: any) {
    console.error("Error in update-external-user-access:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);

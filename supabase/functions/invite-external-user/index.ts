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

interface InviteExternalUserRequest {
  email: string;
  fullName?: string;
  departmentId: string;
  projectId: string;
  accessLevel: 'view_only' | 'upload_edit' | 'edit_download';
  accessExpiresAt?: string;
  invitedByUserId: string;
}

// Generate a secure random temporary password
function generateTemporaryPassword(): string {
  const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const lowercase = 'abcdefghijklmnopqrstuvwxyz';
  const numbers = '0123456789';
  const symbols = '#@!$%';
  
  const allChars = uppercase + lowercase + numbers + symbols;
  let password = '';
  
  // Ensure at least one of each type
  password += uppercase[Math.floor(Math.random() * uppercase.length)];
  password += lowercase[Math.floor(Math.random() * lowercase.length)];
  password += numbers[Math.floor(Math.random() * numbers.length)];
  password += symbols[Math.floor(Math.random() * symbols.length)];
  
  // Fill the rest randomly
  for (let i = 4; i < 12; i++) {
    password += allChars[Math.floor(Math.random() * allChars.length)];
  }
  
  // Shuffle the password
  return password.split('').sort(() => Math.random() - 0.5).join('');
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { 
      email, 
      fullName, 
      departmentId, 
      projectId, 
      accessLevel,
      accessExpiresAt,
      invitedByUserId 
    }: InviteExternalUserRequest = await req.json();
    
    console.log('Inviting external user:', email, 'to department:', departmentId);
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    // Check if user already exists in auth
    const { data: existingUsers } = await supabase.auth.admin.listUsers();
    const existingUser = existingUsers?.users?.find(u => u.email === email);
    
    let userId: string;
    const tempPassword = generateTemporaryPassword();
    const tempPasswordExpiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString(); // 30 minutes
    
    if (existingUser) {
      // Check if already an external user for this department
      const { data: existingExternal } = await supabase
        .from('external_users')
        .select('id')
        .eq('user_id', existingUser.id)
        .eq('department_id', departmentId)
        .single();
        
      if (existingExternal) {
        return new Response(
          JSON.stringify({ error: 'User already has external access to this department' }),
          { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }
      
      userId = existingUser.id;
      
      // Update password for existing user
      await supabase.auth.admin.updateUserById(userId, { password: tempPassword });
    } else {
      // Create new user in auth
      const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
        email,
        password: tempPassword,
        email_confirm: true,
        user_metadata: { full_name: fullName || email.split('@')[0] }
      });
      
      if (createError || !newUser.user) {
        console.error('Error creating user:', createError);
        throw new Error(createError?.message || 'Failed to create user');
      }
      
      userId = newUser.user.id;
      
      // Update profile if needed
      const { error: profileError } = await supabase
        .from('profiles')
        .upsert({
          id: userId,
          email,
          full_name: fullName || email.split('@')[0],
          must_change_password: true,
          temporary_password_expires_at: tempPasswordExpiresAt
        });
        
      if (profileError) {
        console.error('Error updating profile:', profileError);
      }
    }
    
    // Create external user record
    const { data: externalUser, error: externalError } = await supabase
      .from('external_users')
      .insert({
        user_id: userId,
        email,
        full_name: fullName,
        department_id: departmentId,
        project_id: projectId,
        invited_by: invitedByUserId,
        access_level: accessLevel,
        access_expires_at: accessExpiresAt || null,
        is_active: true,
        must_change_password: true,
        temporary_password_expires_at: tempPasswordExpiresAt
      })
      .select()
      .single();
      
    if (externalError) {
      console.error('Error creating external user record:', externalError);
      throw new Error('Failed to create external user record');
    }
    
    // Get department and project names for the email
    const { data: department } = await supabase
      .from('departments')
      .select('name')
      .eq('id', departmentId)
      .single();
      
    const { data: project } = await supabase
      .from('projects')
      .select('name')
      .eq('id', projectId)
      .single();
      
    // Get inviter's name
    const { data: inviter } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('id', invitedByUserId)
      .single();
    
    // Log the invitation activity
    await supabase
      .from('external_user_activity_log')
      .insert({
        external_user_id: externalUser.id,
        action: 'invited',
        details: {
          invited_by: invitedByUserId,
          access_level: accessLevel,
          access_expires_at: accessExpiresAt
        }
      });
    
    // Send invitation email
    // Use the dedicated external login portal
    const signInUrl = 'https://projects.cioafrica.co/external-login';
    const accessLevelLabel = {
      'view_only': 'View Only',
      'upload_edit': 'Upload & Edit',
      'edit_download': 'Edit & Download'
    }[accessLevel];
    
    const expiryInfo = accessExpiresAt 
      ? `<p style="color: #666;">Your access will expire on: <strong>${new Date(accessExpiresAt).toLocaleDateString()}</strong></p>`
      : '';

    await resend.emails.send({
      from: 'CIO Africa Project Planner <michael.odongo@cioafrica.co>',
      to: [email],
      subject: `You've been invited to access documents — ${project?.name || 'Project'}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Document Access Invitation</h2>
          <p>Hi ${fullName || 'there'},</p>
          <p>${inviter?.full_name || 'A team member'} has invited you to access documents in the <strong>${department?.name || 'Department'}</strong> department of <strong>${project?.name || 'Project'}</strong>.</p>
          
          <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <p style="margin: 0 0 10px 0; font-size: 14px; color: #666;">Your access level:</p>
            <p style="margin: 0; font-size: 18px; font-weight: bold; color: #3b82f6;">${accessLevelLabel}</p>
          </div>
          
          <div style="background-color: #fef3c7; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <p style="margin: 0 0 10px 0; font-size: 14px; color: #92400e;">Your temporary password:</p>
            <p style="margin: 0 0 10px 0; font-size: 24px; font-weight: bold; font-family: monospace; letter-spacing: 2px;">${tempPassword}</p>
            <p style="margin: 0; font-size: 12px; color: #dc2626;"><strong>This password expires in 30 minutes.</strong> You'll be asked to set a new password on first login.</p>
          </div>
          
          ${expiryInfo}
          
          <div style="margin: 30px 0;">
            <a href="${signInUrl}" 
               style="background-color: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
              Access Documents
            </a>
          </div>
          
          <p style="color: #666; font-size: 14px;">You can only access the Documents area — other parts of the system are restricted.</p>
          
          <p style="color: #666; font-size: 14px;">If you didn't expect this invitation, please ignore this email or contact the sender.</p>
          
          <p style="margin-top: 40px;">Warmly,<br>The CIO Africa Team</p>
        </div>
      `,
    });
    
    console.log('Invitation email sent to:', email);

    return new Response(
      JSON.stringify({ 
        success: true, 
        externalUserId: externalUser.id,
        message: 'Invitation sent successfully' 
      }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: any) {
    console.error("Error in invite-external-user:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);

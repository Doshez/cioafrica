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

interface ResetPasswordRequest {
  externalUserId: string;
}

// Generate a secure random password
function generateSecurePassword(): string {
  const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const lowercase = 'abcdefghijklmnopqrstuvwxyz';
  const numbers = '0123456789';
  const symbols = '#@!$%&*';
  
  const allChars = uppercase + lowercase + numbers + symbols;
  let password = '';
  
  // Ensure at least one of each type
  password += uppercase[Math.floor(Math.random() * uppercase.length)];
  password += lowercase[Math.floor(Math.random() * lowercase.length)];
  password += numbers[Math.floor(Math.random() * numbers.length)];
  password += symbols[Math.floor(Math.random() * symbols.length)];
  
  // Fill the rest randomly (16 chars total for extra security)
  for (let i = 4; i < 16; i++) {
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
    const { externalUserId }: ResetPasswordRequest = await req.json();
    
    if (!externalUserId) {
      throw new Error('External user ID is required');
    }
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    // Get external user details
    const { data: externalUser, error: externalUserError } = await supabase
      .from('external_users')
      .select('user_id, email, full_name, department_id, departments(name)')
      .eq('id', externalUserId)
      .single();

    if (externalUserError || !externalUser) {
      console.error('External user not found:', externalUserError);
      throw new Error('External user not found');
    }

    // Generate new password
    const newPassword = generateSecurePassword();
    
    // Update user password in auth
    const { error: updateError } = await supabase.auth.admin.updateUserById(
      externalUser.user_id,
      { password: newPassword }
    );

    if (updateError) {
      console.error('Error updating password:', updateError);
      throw new Error('Failed to reset password');
    }

    // Update external user record - set must_change_password to true but NO expiration
    const { error: profileUpdateError } = await supabase
      .from('external_users')
      .update({
        must_change_password: true,
        temporary_password_expires_at: null // No expiration for external users after reset
      })
      .eq('id', externalUserId);

    if (profileUpdateError) {
      console.error('Error updating external user:', profileUpdateError);
    }

    // Log the activity
    await supabase
      .from('external_user_activity_log')
      .insert({
        external_user_id: externalUserId,
        action: 'password_reset_by_admin',
        details: { reset_at: new Date().toISOString() }
      });

    // Send email with new password
    const signInUrl = 'https://projects.cioafrica.co/external-login';
    const departmentName = (externalUser.departments as any)?.name || 'your department';

    await resend.emails.send({
      from: 'CIO Africa <noreply@cioafrica.co>',
      to: [externalUser.email],
      subject: "Your password has been reset - CIO Africa Document Portal",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #1f2937; margin: 0;">Password Reset</h1>
            <p style="color: #6b7280; margin-top: 8px;">CIO Africa External Document Portal</p>
          </div>
          
          <p style="color: #374151; font-size: 16px;">Hi ${externalUser.full_name || 'there'},</p>
          
          <p style="color: #374151; font-size: 16px;">
            An administrator has reset your password for the CIO Africa Document Portal. 
            Please use the new password below to sign in.
          </p>
          
          <div style="background-color: #f3f4f6; padding: 24px; border-radius: 12px; margin: 24px 0; text-align: center;">
            <p style="margin: 0 0 8px 0; font-size: 14px; color: #6b7280; text-transform: uppercase; letter-spacing: 1px;">Your New Password</p>
            <p style="margin: 0; font-size: 28px; font-weight: bold; font-family: 'Courier New', monospace; letter-spacing: 3px; color: #1f2937;">${newPassword}</p>
          </div>
          
          <div style="background-color: #dbeafe; border-left: 4px solid #3b82f6; padding: 16px; margin: 24px 0;">
            <p style="margin: 0; color: #1e40af; font-size: 14px;">
              <strong>🔒 Security Notice:</strong> You will be asked to create a new permanent password when you first sign in.
              This password does not expire, but we recommend changing it to something memorable.
            </p>
          </div>
          
          <div style="background-color: #f0fdf4; border-radius: 8px; padding: 16px; margin: 24px 0;">
            <p style="margin: 0 0 4px 0; font-size: 12px; color: #166534; text-transform: uppercase;">Your Access</p>
            <p style="margin: 0; font-size: 16px; color: #15803d; font-weight: 600;">📁 ${departmentName}</p>
          </div>
          
          <div style="text-align: center; margin: 32px 0;">
            <a href="${signInUrl}" 
               style="background-color: #3b82f6; color: white; padding: 14px 32px; text-decoration: none; border-radius: 8px; display: inline-block; font-weight: 600; font-size: 16px;">
              Sign In to Portal
            </a>
          </div>
          
          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 32px 0;" />
          
          <p style="color: #9ca3af; font-size: 12px; text-align: center;">
            If you didn't expect this email, please contact your administrator immediately.<br>
            This is an automated message from the CIO Africa Document Portal.
          </p>
        </div>
      `,
    });

    console.log(`Password reset email sent to external user: ${externalUser.email}`);

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("Error in reset-external-user-password:", error);
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

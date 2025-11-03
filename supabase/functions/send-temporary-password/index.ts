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

interface TemporaryPasswordRequest {
  userId: string;
  resetRequestId?: string;
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
    const { userId, resetRequestId }: TemporaryPasswordRequest = await req.json();
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    // Get user profile
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('email, full_name')
      .eq('id', userId)
      .single();

    if (profileError || !profile) {
      throw new Error('User not found');
    }

    // Generate temporary password
    const tempPassword = generateTemporaryPassword();
    
    // Update user password in auth
    const { error: updateError } = await supabase.auth.admin.updateUserById(
      userId,
      { password: tempPassword }
    );

    if (updateError) {
      console.error('Error updating password:', updateError);
      throw new Error('Failed to set temporary password');
    }

    // Set temporary password expiry (30 minutes from now)
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();
    
    const { error: profileUpdateError } = await supabase
      .from('profiles')
      .update({
        must_change_password: true,
        temporary_password_expires_at: expiresAt
      })
      .eq('id', userId);

    if (profileUpdateError) {
      console.error('Error updating profile:', profileUpdateError);
    }

    // Update reset request status if provided
    if (resetRequestId) {
      const { data: { user: adminUser } } = await supabase.auth.getUser();
      
      await supabase
        .from('password_reset_requests')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
          completed_by_admin_id: adminUser?.id
        })
        .eq('id', resetRequestId);
    }

    // Send email with temporary password
    const signInUrl = `${Deno.env.get('SUPABASE_URL')?.replace('supabase.co', 'lovableproject.com')}/auth`;

    await resend.emails.send({
      from: 'Project Planner <onboarding@resend.dev>',
      to: [profile.email],
      subject: "Here's your temporary password — please set a new one 💌",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Your Temporary Password</h2>
          <p>Hi ${profile.full_name || 'there'},</p>
          <p>An admin has reset your account. Use the temporary password below to sign in, then you'll be asked to pick a new permanent password.</p>
          
          <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <p style="margin: 0; font-size: 14px; color: #666;">Temporary password:</p>
            <p style="margin: 10px 0 0 0; font-size: 24px; font-weight: bold; font-family: monospace; letter-spacing: 2px;">${tempPassword}</p>
          </div>
          
          <p style="color: #dc2626; font-weight: 600;">Expires: in 30 minutes</p>
          
          <div style="margin: 30px 0;">
            <a href="${signInUrl}" 
               style="background-color: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
              Sign in now
            </a>
          </div>
          
          <p style="color: #666; font-size: 14px;">If you didn't request this, contact your admin immediately.</p>
          
          <p style="margin-top: 40px;">Warmly,<br>The CIO Africa Team</p>
        </div>
      `,
    });

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("Error in send-temporary-password:", error);
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

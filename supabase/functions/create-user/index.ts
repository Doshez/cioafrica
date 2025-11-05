import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import { Resend } from "https://esm.sh/resend@4.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface CreateUserRequest {
  email: string;
  full_name: string;
  role: 'admin' | 'project_manager' | 'member' | 'viewer';
  project_ids?: string[];
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const resendApiKey = Deno.env.get("RESEND_API_KEY")!;

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const resend = new Resend(resendApiKey);

    const { email, full_name, role, project_ids = [] }: CreateUserRequest = await req.json();

    console.log(`Creating user: ${email} with role: ${role}, projects: ${project_ids.length}`);

    // Generate temporary password
    const tempPassword = crypto.randomUUID().slice(0, 12);

    // Create user in Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password: tempPassword,
      email_confirm: true,
      user_metadata: {
        full_name,
      },
    });

    if (authError) {
      console.error("Auth error:", authError);
      throw authError;
    }

    console.log("User created in auth:", authData.user.id);

    // Set must_change_password flag in profiles
    const { error: profileError } = await supabase
      .from('profiles')
      .update({ must_change_password: true })
      .eq('id', authData.user.id);

    if (profileError) {
      console.error("Profile update error:", profileError);
      throw profileError;
    }

    console.log("Profile updated with password change flag");

    // Assign role to user
    const { error: roleError } = await supabase
      .from('user_roles')
      .insert({
        user_id: authData.user.id,
        role: role,
      });

    if (roleError) {
      console.error("Role assignment error:", roleError);
      throw roleError;
    }

    console.log("Role assigned successfully");

    // Assign projects if provided
    if (project_ids.length > 0) {
      const projectAssignments = project_ids.map(project_id => ({
        project_id,
        user_id: authData.user.id,
        role: 'viewer', // Default project role for new users
      }));

      const { error: projectError } = await supabase
        .from('project_members')
        .insert(projectAssignments);

      if (projectError) {
        console.error("Project assignment error:", projectError);
        throw projectError;
      }

      console.log(`Assigned ${project_ids.length} projects to user`);
    }

    // Send welcome email with temporary password
    const emailResponse = await resend.emails.send({
      from: "Project Planner <onboarding@resend.dev>",
      to: [email],
      subject: "Welcome to Project Planner - Your Account Details",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #3b82f6;">Welcome to Project Planner!</h1>
          <p>Hi ${full_name},</p>
          <p>An administrator has created an account for you. Here are your login credentials:</p>
          
          <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <p style="margin: 5px 0;"><strong>Email:</strong> ${email}</p>
            <p style="margin: 5px 0;"><strong>Temporary Password:</strong> <code style="background-color: #e5e7eb; padding: 4px 8px; border-radius: 4px;">${tempPassword}</code></p>
            <p style="margin: 5px 0;"><strong>Role:</strong> ${role.replace('_', ' ').toUpperCase()}</p>
          </div>
          
          <p><strong>Important:</strong> You will be required to change this temporary password when you first log in for security reasons.</p>
          
          <p>Click the button below to sign in:</p>
          <a href="https://projects.cioafrica.co/" 
             style="display: inline-block; background-color: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0;">
            Sign In Now
          </a>
          
          <p style="color: #6b7280; font-size: 14px; margin-top: 30px;">
            If you have any questions, please contact your administrator.
          </p>
        </div>
      `,
    });

    console.log("Email sent successfully:", emailResponse);

    return new Response(
      JSON.stringify({ 
        success: true, 
        user: authData.user,
        message: "User created and email sent successfully" 
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders,
        },
      }
    );
  } catch (error: any) {
    console.error("Error in create-user function:", error);
    return new Response(
      JSON.stringify({ 
        error: error.message,
        details: error 
      }),
      {
        status: 500,
        headers: { 
          "Content-Type": "application/json", 
          ...corsHeaders 
        },
      }
    );
  }
};

serve(handler);

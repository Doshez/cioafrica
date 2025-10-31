import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface DeleteUserRequest {
  user_id: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { user_id }: DeleteUserRequest = await req.json();

    console.log(`Deleting user: ${user_id}`);

    // First, delete user roles
    const { error: rolesError } = await supabase
      .from('user_roles')
      .delete()
      .eq('user_id', user_id);

    if (rolesError) {
      console.error("Error deleting user roles:", rolesError);
      // Continue even if roles deletion fails
    }

    // Delete project memberships
    const { error: projectsError } = await supabase
      .from('project_members')
      .delete()
      .eq('user_id', user_id);

    if (projectsError) {
      console.error("Error deleting project memberships:", projectsError);
      // Continue even if project memberships deletion fails
    }

    // Delete user from Supabase Auth (this will cascade to profiles)
    const { error: authError } = await supabase.auth.admin.deleteUser(user_id);

    if (authError) {
      console.error("Auth deletion error:", authError);
      throw authError;
    }

    console.log("User deleted successfully from auth");

    return new Response(
      JSON.stringify({ 
        success: true,
        message: "User deleted successfully" 
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
    console.error("Error in delete-user function:", error);
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

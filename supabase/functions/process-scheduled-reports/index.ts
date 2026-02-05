import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get current hour in EAT timezone (Africa/Nairobi is UTC+3)
    const now = new Date();
    const eatOffset = 3 * 60; // EAT is UTC+3
    const eatTime = new Date(now.getTime() + eatOffset * 60 * 1000);
    const currentHour = eatTime.getUTCHours();
    const currentMinute = eatTime.getUTCMinutes();
    
    // Format as HH:00 for comparison (we check at the start of each hour)
    const targetTime = `${String(currentHour).padStart(2, '0')}:00:00`;

    console.log(`Checking for reports scheduled at ${targetTime} (EAT)`);

    // Fetch enabled report settings where send_time matches current hour
    const { data: enabledSettings, error: settingsError } = await supabase
      .from("project_report_settings")
      .select("project_id, send_time, frequency")
      .eq("enabled", true)
      .eq("frequency", "daily");

    if (settingsError) {
      throw new Error(`Failed to fetch settings: ${settingsError.message}`);
    }

    if (!enabledSettings?.length) {
      console.log("No enabled daily reports found");
      return new Response(JSON.stringify({ message: "No reports to send" }), {
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Filter settings where send_time matches current hour
    const matchingSettings = enabledSettings.filter(s => {
      const sendHour = parseInt(s.send_time.split(":")[0], 10);
      return sendHour === currentHour;
    });

    if (!matchingSettings.length) {
      console.log(`No reports scheduled for hour ${currentHour}`);
      return new Response(JSON.stringify({ message: "No reports scheduled for this hour" }), {
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    console.log(`Found ${matchingSettings.length} reports to send`);

    // Trigger report sending for each project
    const results = await Promise.all(
      matchingSettings.map(async (setting) => {
        try {
          const response = await fetch(`${supabaseUrl}/functions/v1/send-project-report`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${supabaseServiceKey}`,
            },
            body: JSON.stringify({ projectId: setting.project_id, isTest: false }),
          });

          const result = await response.json();
          return { projectId: setting.project_id, success: response.ok, result };
        } catch (error: any) {
          return { projectId: setting.project_id, success: false, error: error.message };
        }
      })
    );

    const successCount = results.filter(r => r.success).length;
    console.log(`Sent ${successCount}/${results.length} reports successfully`);

    return new Response(
      JSON.stringify({ 
        message: `Processed ${results.length} scheduled reports`,
        sent: successCount,
        results 
      }),
      { headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: any) {
    console.error("Error in scheduled reports:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
});

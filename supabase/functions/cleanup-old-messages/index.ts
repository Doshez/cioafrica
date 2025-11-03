import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    console.log('Starting old message cleanup...');

    // Get all chat settings with retention policies
    const { data: settings, error: settingsError } = await supabaseClient
      .from('chat_settings')
      .select('project_id, message_retention_days');

    if (settingsError) {
      console.error('Error fetching settings:', settingsError);
      throw settingsError;
    }

    let totalDeleted = 0;

    for (const setting of settings) {
      console.log(`Processing project ${setting.project_id} with retention ${setting.message_retention_days} days`);

      // Calculate cutoff date
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - setting.message_retention_days);

      // Find rooms for this project
      const { data: rooms } = await supabaseClient
        .from('chat_rooms')
        .select('id')
        .eq('project_id', setting.project_id);

      if (!rooms || rooms.length === 0) continue;

      const roomIds = rooms.map(r => r.id);

      // Delete old messages
      const { data: deletedMessages, error: deleteError } = await supabaseClient
        .from('chat_messages')
        .delete()
        .in('room_id', roomIds)
        .lt('created_at', cutoffDate.toISOString())
        .select();

      if (deleteError) {
        console.error(`Error deleting messages for project ${setting.project_id}:`, deleteError);
        continue;
      }

      const deletedCount = deletedMessages?.length || 0;
      totalDeleted += deletedCount;
      console.log(`Deleted ${deletedCount} messages from project ${setting.project_id}`);
    }

    console.log(`Cleanup complete. Total messages deleted: ${totalDeleted}`);

    return new Response(
      JSON.stringify({
        success: true,
        totalDeleted,
        message: `Successfully deleted ${totalDeleted} old messages`,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('Error in cleanup function:', error);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});

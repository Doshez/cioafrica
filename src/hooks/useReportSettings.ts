import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface ReportSettings {
  id?: string;
  project_id: string;
  enabled: boolean;
  frequency: 'daily' | 'weekly' | 'monthly';
  send_time: string;
  timezone: string;
  include_department_summary: boolean;
  include_user_activity: boolean;
  include_smart_insights: boolean;
  last_sent_at?: string;
}

export interface ReportRecipient {
  id: string;
  project_id: string;
  email: string;
  name?: string;
  is_active: boolean;
  created_at: string;
}

export function useReportSettings(projectId: string) {
  const [settings, setSettings] = useState<ReportSettings | null>(null);
  const [recipients, setRecipients] = useState<ReportRecipient[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const fetchSettings = async () => {
    try {
      setLoading(true);
      
      // Fetch settings
      const { data: settingsData, error: settingsError } = await supabase
        .from('project_report_settings')
        .select('*')
        .eq('project_id', projectId)
        .maybeSingle();

      if (settingsError) throw settingsError;
      
      if (settingsData) {
        setSettings(settingsData as ReportSettings);
      } else {
        // Default settings
        setSettings({
          project_id: projectId,
          enabled: false,
          frequency: 'daily',
          send_time: '08:00',
          timezone: 'Africa/Nairobi',
          include_department_summary: true,
          include_user_activity: true,
          include_smart_insights: true,
        });
      }

      // Fetch recipients
      const { data: recipientsData, error: recipientsError } = await supabase
        .from('project_report_recipients')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: true });

      if (recipientsError) throw recipientsError;
      setRecipients((recipientsData || []) as ReportRecipient[]);
    } catch (error) {
      console.error('Error fetching report settings:', error);
      toast({
        title: 'Error',
        description: 'Failed to load report settings',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (projectId) {
      fetchSettings();
    }
  }, [projectId]);

  const saveSettings = async (newSettings: Partial<ReportSettings>) => {
    try {
      setSaving(true);
      const updatedSettings = { ...settings, ...newSettings, project_id: projectId };

      if (settings?.id) {
        // Update existing
        const { error } = await supabase
          .from('project_report_settings')
          .update({
            enabled: updatedSettings.enabled,
            frequency: updatedSettings.frequency,
            send_time: updatedSettings.send_time,
            timezone: updatedSettings.timezone,
            include_department_summary: updatedSettings.include_department_summary,
            include_user_activity: updatedSettings.include_user_activity,
            include_smart_insights: updatedSettings.include_smart_insights,
          })
          .eq('id', settings.id);

        if (error) throw error;
      } else {
        // Create new
        const { data, error } = await supabase
          .from('project_report_settings')
          .insert({
            project_id: projectId,
            enabled: updatedSettings.enabled,
            frequency: updatedSettings.frequency,
            send_time: updatedSettings.send_time,
            timezone: updatedSettings.timezone,
            include_department_summary: updatedSettings.include_department_summary,
            include_user_activity: updatedSettings.include_user_activity,
            include_smart_insights: updatedSettings.include_smart_insights,
          })
          .select()
          .single();

        if (error) throw error;
        updatedSettings.id = data.id;
      }

      setSettings(updatedSettings as ReportSettings);
      toast({
        title: 'Success',
        description: 'Report settings saved',
      });
    } catch (error) {
      console.error('Error saving report settings:', error);
      toast({
        title: 'Error',
        description: 'Failed to save report settings',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const addRecipient = async (email: string, name?: string) => {
    try {
      const { data, error } = await supabase
        .from('project_report_recipients')
        .insert({
          project_id: projectId,
          email,
          name,
          is_active: true,
        })
        .select()
        .single();

      if (error) throw error;
      setRecipients([...recipients, data as ReportRecipient]);
      toast({
        title: 'Success',
        description: 'Recipient added',
      });
      return true;
    } catch (error: any) {
      console.error('Error adding recipient:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to add recipient',
        variant: 'destructive',
      });
      return false;
    }
  };

  const removeRecipient = async (recipientId: string) => {
    try {
      const { error } = await supabase
        .from('project_report_recipients')
        .delete()
        .eq('id', recipientId);

      if (error) throw error;
      setRecipients(recipients.filter((r) => r.id !== recipientId));
      toast({
        title: 'Success',
        description: 'Recipient removed',
      });
    } catch (error) {
      console.error('Error removing recipient:', error);
      toast({
        title: 'Error',
        description: 'Failed to remove recipient',
        variant: 'destructive',
      });
    }
  };

  const toggleRecipient = async (recipientId: string, isActive: boolean) => {
    try {
      const { error } = await supabase
        .from('project_report_recipients')
        .update({ is_active: isActive })
        .eq('id', recipientId);

      if (error) throw error;
      setRecipients(
        recipients.map((r) => (r.id === recipientId ? { ...r, is_active: isActive } : r))
      );
    } catch (error) {
      console.error('Error toggling recipient:', error);
      toast({
        title: 'Error',
        description: 'Failed to update recipient',
        variant: 'destructive',
      });
    }
  };

  return {
    settings,
    recipients,
    loading,
    saving,
    saveSettings,
    addRecipient,
    removeRecipient,
    toggleRecipient,
    refetch: fetchSettings,
  };
}

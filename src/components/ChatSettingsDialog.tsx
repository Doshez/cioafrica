import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { Button } from './ui/button';
import { Label } from './ui/label';
import { Input } from './ui/input';
import { Switch } from './ui/switch';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Settings } from 'lucide-react';

interface ChatSettingsDialogProps {
  projectId: string;
}

export const ChatSettingsDialog = ({ projectId }: ChatSettingsDialogProps) => {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  
  const [settings, setSettings] = useState({
    public_chat_enabled: true,
    max_file_size_mb: 10,
    message_retention_days: 90,
    notifications_enabled: true,
  });

  useEffect(() => {
    if (open && projectId) {
      fetchSettings();
    }
  }, [open, projectId]);

  const fetchSettings = async () => {
    const { data } = await supabase
      .from('chat_settings')
      .select('*')
      .eq('project_id', projectId)
      .single();

    if (data) {
      setSettings({
        public_chat_enabled: data.public_chat_enabled,
        max_file_size_mb: data.max_file_size_mb,
        message_retention_days: data.message_retention_days,
        notifications_enabled: data.notifications_enabled,
      });
    }
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from('chat_settings')
        .upsert({
          project_id: projectId,
          ...settings,
        });

      if (error) throw error;

      toast({
        title: 'Settings saved',
        description: 'Chat settings have been updated successfully',
      });
      setOpen(false);
    } catch (error: any) {
      toast({
        title: 'Error saving settings',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Button
        variant="outline"
        size="icon"
        onClick={() => setOpen(true)}
        title="Chat Settings"
      >
        <Settings className="h-4 w-4" />
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Chat Settings</DialogTitle>
          </DialogHeader>

          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Public Chat</Label>
                <p className="text-sm text-muted-foreground">
                  Enable public chat for all project members
                </p>
              </div>
              <Switch
                checked={settings.public_chat_enabled}
                onCheckedChange={(checked) =>
                  setSettings({ ...settings, public_chat_enabled: checked })
                }
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Notifications</Label>
                <p className="text-sm text-muted-foreground">
                  Enable chat notifications
                </p>
              </div>
              <Switch
                checked={settings.notifications_enabled}
                onCheckedChange={(checked) =>
                  setSettings({ ...settings, notifications_enabled: checked })
                }
              />
            </div>

            <div className="space-y-2">
              <Label>Max File Size (MB)</Label>
              <Input
                type="number"
                min="1"
                max="100"
                value={settings.max_file_size_mb}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    max_file_size_mb: parseInt(e.target.value) || 10,
                  })
                }
              />
            </div>

            <div className="space-y-2">
              <Label>Message Retention (Days)</Label>
              <Input
                type="number"
                min="1"
                max="365"
                value={settings.message_retention_days}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    message_retention_days: parseInt(e.target.value) || 90,
                  })
                }
              />
              <p className="text-xs text-muted-foreground">
                Messages older than this will be automatically deleted
              </p>
            </div>

            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={loading}>
                {loading ? 'Saving...' : 'Save Settings'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2, Clock, Save, Bell, Eye, SendHorizonal } from 'lucide-react';

const DAYS_OF_WEEK = [
  { value: 'monday', label: 'Mon' },
  { value: 'tuesday', label: 'Tue' },
  { value: 'wednesday', label: 'Wed' },
  { value: 'thursday', label: 'Thu' },
  { value: 'friday', label: 'Fri' },
  { value: 'saturday', label: 'Sat' },
  { value: 'sunday', label: 'Sun' },
];

const TIME_OPTIONS = Array.from({ length: 24 }, (_, i) => {
  const h = i.toString().padStart(2, '0');
  return { value: `${h}:00:00`, label: `${h}:00` };
});

const generatePreviewHtml = () => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Task Overdue</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f4f4f5; margin: 0; padding: 20px; }
    .container { max-width: 500px; margin: 0 auto; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
    .header { background: #dc2626; padding: 24px; text-align: center; }
    .header h1 { color: white; margin: 0; font-size: 20px; font-weight: 600; }
    .content { padding: 24px; }
    .message { background: #fef2f2; border-left: 4px solid #dc2626; padding: 12px 16px; margin: 16px 0; border-radius: 0 4px 4px 0; }
    .message p { margin: 4px 0; color: #334155; font-size: 14px; line-height: 1.5; }
    .cta { text-align: center; margin: 24px 0; }
    .cta a { display: inline-block; background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 500; font-size: 14px; }
    .footer { padding: 16px 24px; text-align: center; color: #64748b; font-size: 12px; border-top: 1px solid #e2e8f0; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>⏰ Task Overdue</h1>
    </div>
    <div class="content">
      <p style="margin: 0 0 12px; color: #334155; font-size: 14px;">
        You have an overdue task that needs your attention:
      </p>
      <div class="message">
        <p><strong>Task:</strong> Design Homepage Mockup</p>
        <p><strong>Department:</strong> Design Team</p>
        <p><strong>Project:</strong> Website Redesign 2026</p>
        <p><strong>Due Date:</strong> 2026-03-01</p>
      </div>
      <p style="margin: 12px 0 0; color: #64748b; font-size: 13px;">
        Please review and update the task status as soon as possible.
      </p>
      <div class="cta">
        <a href="#">View in Project Planner</a>
      </div>
    </div>
    <div class="footer">
      This notification is from Website Redesign 2026 on CIO Africa Project Planner
    </div>
  </div>
</body>
</html>`;

export function OverdueReminderSettings() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [enabled, setEnabled] = useState(true);
  const [sendTime, setSendTime] = useState('08:00:00');
  const [reminderDays, setReminderDays] = useState<string[]>(['monday', 'wednesday', 'friday']);
  const [settingsId, setSettingsId] = useState<string | null>(null);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('overdue_reminder_settings')
        .select('*')
        .limit(1)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setSettingsId(data.id);
        setEnabled(data.enabled);
        setSendTime(data.send_time);
        setReminderDays(data.reminder_days || ['monday', 'wednesday', 'friday']);
      }
    } catch (error: any) {
      console.error('Error fetching overdue settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);

      if (settingsId) {
        const { error } = await supabase
          .from('overdue_reminder_settings')
          .update({
            enabled,
            send_time: sendTime,
            reminder_days: reminderDays,
            updated_at: new Date().toISOString(),
          })
          .eq('id', settingsId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('overdue_reminder_settings')
          .insert({
            enabled,
            send_time: sendTime,
            reminder_days: reminderDays,
          });
        if (error) throw error;
      }

      toast({ title: 'Settings saved', description: 'Overdue reminder settings updated successfully.' });
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleTestSend = async () => {
    try {
      setTesting(true);
      const { data, error } = await supabase.functions.invoke('check-overdue-tasks', {
        body: { test: true },
      });

      if (error) throw error;

      toast({
        title: 'Test completed',
        description: `Checked ${data?.tasksChecked || 0} overdue tasks, sent ${data?.sent || 0} emails.`,
      });
    } catch (error: any) {
      toast({ title: 'Test failed', description: error.message, variant: 'destructive' });
    } finally {
      setTesting(false);
    }
  };

  const toggleDay = (day: string) => {
    setReminderDays(prev =>
      prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]
    );
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8 flex justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-destructive/10 flex items-center justify-center">
              <Bell className="h-5 w-5 text-destructive" />
            </div>
            <div>
              <CardTitle className="text-base">Overdue Task Reminders</CardTitle>
              <CardDescription className="text-xs mt-0.5">
                Configure how often overdue task email reminders are sent to assigned users
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Enable/Disable */}
          <div className="flex items-center justify-between">
            <Label htmlFor="overdue-enabled" className="text-sm font-medium">
              Enable email reminders
            </Label>
            <Switch
              id="overdue-enabled"
              checked={enabled}
              onCheckedChange={setEnabled}
            />
          </div>

          {enabled && (
            <>
              {/* Send Time */}
              <div className="space-y-2">
                <Label className="text-sm font-medium flex items-center gap-2">
                  <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                  Send time (EAT)
                </Label>
                <Select value={sendTime} onValueChange={setSendTime}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TIME_OPTIONS.map(t => (
                      <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Reminder Days */}
              <div className="space-y-3">
                <Label className="text-sm font-medium">Send reminders on</Label>
                <div className="flex flex-wrap gap-2">
                  {DAYS_OF_WEEK.map(day => (
                    <button
                      key={day.value}
                      onClick={() => toggleDay(day.value)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border ${
                        reminderDays.includes(day.value)
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'bg-muted/50 text-muted-foreground border-border hover:bg-muted'
                      }`}
                    >
                      {day.label}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">
                  Reminders will be sent {reminderDays.length} time{reminderDays.length !== 1 ? 's' : ''} per week to users with overdue tasks
                </p>
              </div>
            </>
          )}

          <div className="flex gap-2">
            <Button onClick={handleSave} disabled={saving} className="flex-1 gap-2">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Save
            </Button>
            <Button variant="outline" onClick={() => setShowPreview(true)} className="gap-2">
              <Eye className="h-4 w-4" />
              Preview
            </Button>
            <Button 
              variant="outline" 
              onClick={handleTestSend} 
              disabled={testing}
              className="gap-2"
            >
              {testing ? <Loader2 className="h-4 w-4 animate-spin" /> : <SendHorizonal className="h-4 w-4" />}
              Test
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Email Preview Dialog */}
      <Dialog open={showPreview} onOpenChange={setShowPreview}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto p-0">
          <DialogHeader className="p-6 pb-0">
            <DialogTitle className="flex items-center gap-2 text-base">
              <Eye className="h-4 w-4" />
              Email Preview — Overdue Task Reminder
            </DialogTitle>
          </DialogHeader>
          <div className="px-6 pb-6">
            <div className="mt-4 border rounded-lg overflow-hidden bg-muted/30">
              {/* Email metadata */}
              <div className="bg-muted/50 px-4 py-3 border-b space-y-1.5 text-xs">
                <div className="flex gap-2">
                  <span className="font-medium text-muted-foreground w-12">From:</span>
                  <span>CIO Africa Project Planner &lt;cas2026@cioafrica.co&gt;</span>
                </div>
                <div className="flex gap-2">
                  <span className="font-medium text-muted-foreground w-12">To:</span>
                  <span>{user?.email || 'user@example.com'}</span>
                </div>
                <div className="flex gap-2">
                  <span className="font-medium text-muted-foreground w-12">Subject:</span>
                  <span className="font-medium">⏰ Task Overdue: Design Homepage Mockup — Website Redesign 2026</span>
                </div>
              </div>
              {/* Email body */}
              <iframe
                srcDoc={generatePreviewHtml()}
                className="w-full border-0"
                style={{ height: '520px' }}
                title="Email Preview"
                sandbox=""
              />
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

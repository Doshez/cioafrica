import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Clock, Save, Bell } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';

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

export function OverdueReminderSettings() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
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

        <Button onClick={handleSave} disabled={saving} className="w-full gap-2">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Save Settings
        </Button>
      </CardContent>
    </Card>
  );
}

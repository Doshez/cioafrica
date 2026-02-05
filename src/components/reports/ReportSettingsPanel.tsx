import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Mail, 
  Clock, 
  Settings, 
  Users, 
  Plus, 
  Trash2, 
  Eye,
  Send,
  Loader2,
  CheckCircle,
  XCircle
} from 'lucide-react';
import { useReportSettings } from '@/hooks/useReportSettings';
import { useProjectReportData } from '@/hooks/useProjectReportData';
import { ProjectReportPreview } from './ProjectReportPreview';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface ReportSettingsPanelProps {
  projectId: string;
}

export function ReportSettingsPanel({ projectId }: ReportSettingsPanelProps) {
  const {
    settings,
    recipients,
    loading,
    saving,
    saveSettings,
    addRecipient,
    removeRecipient,
    toggleRecipient,
  } = useReportSettings(projectId);

  const { reportData, loading: reportLoading } = useProjectReportData(projectId);
  const { toast } = useToast();

  const [newEmail, setNewEmail] = useState('');
  const [newName, setNewName] = useState('');
  const [addingRecipient, setAddingRecipient] = useState(false);
  const [sendingTest, setSendingTest] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  const handleAddRecipient = async () => {
    if (!newEmail.trim()) return;
    
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(newEmail)) {
      toast({
        title: 'Invalid Email',
        description: 'Please enter a valid email address',
        variant: 'destructive',
      });
      return;
    }

    setAddingRecipient(true);
    const success = await addRecipient(newEmail.trim(), newName.trim() || undefined);
    if (success) {
      setNewEmail('');
      setNewName('');
    }
    setAddingRecipient(false);
  };

  const handleSendTestReport = async () => {
    try {
      setSendingTest(true);
      
      const activeRecipients = recipients.filter(r => r.is_active);
      if (activeRecipients.length === 0) {
        toast({
          title: 'No Recipients',
          description: 'Please add at least one active recipient',
          variant: 'destructive',
        });
        return;
      }

      const { error } = await supabase.functions.invoke('send-project-report', {
        body: {
          projectId,
          isTest: true,
        },
      });

      if (error) throw error;

      toast({
        title: 'Test Report Sent',
        description: `Report sent to ${activeRecipients.length} recipient(s)`,
      });
    } catch (error: any) {
      console.error('Error sending test report:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to send test report',
        variant: 'destructive',
      });
    } finally {
      setSendingTest(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Tabs defaultValue="settings" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="settings" className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            Settings
          </TabsTrigger>
          <TabsTrigger value="recipients" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Recipients
          </TabsTrigger>
          <TabsTrigger value="preview" className="flex items-center gap-2">
            <Eye className="h-4 w-4" />
            Preview
          </TabsTrigger>
        </TabsList>

        <TabsContent value="settings" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Mail className="h-5 w-5" />
                Report Configuration
              </CardTitle>
              <CardDescription>
                Configure automated daily project summary reports
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Enable/Disable Toggle */}
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Enable Automated Reports</Label>
                  <p className="text-sm text-muted-foreground">
                    Send daily summary reports to recipients
                  </p>
                </div>
                <Switch
                  checked={settings?.enabled || false}
                  onCheckedChange={(checked) => saveSettings({ enabled: checked })}
                  disabled={saving}
                />
              </div>

              {/* Frequency */}
              <div className="space-y-2">
                <Label>Report Frequency</Label>
                <Select
                  value={settings?.frequency || 'daily'}
                  onValueChange={(value: 'daily' | 'weekly' | 'monthly') => 
                    saveSettings({ frequency: value })
                  }
                  disabled={saving}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select frequency" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="daily">Daily</SelectItem>
                    <SelectItem value="weekly">Weekly (Coming Soon)</SelectItem>
                    <SelectItem value="monthly">Monthly (Coming Soon)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Send Time */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  Send Time
                </Label>
                <Input
                  type="time"
                  value={settings?.send_time?.substring(0, 5) || '08:00'}
                  onChange={(e) => saveSettings({ send_time: e.target.value })}
                  disabled={saving}
                />
                <p className="text-xs text-muted-foreground">
                  Reports will be sent at this time ({settings?.timezone || 'Africa/Nairobi'})
                </p>
              </div>

              {/* Include Options */}
              <div className="space-y-4">
                <Label>Report Sections</Label>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Department Summary</span>
                    <Switch
                      checked={settings?.include_department_summary || false}
                      onCheckedChange={(checked) => 
                        saveSettings({ include_department_summary: checked })
                      }
                      disabled={saving}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">User Activity</span>
                    <Switch
                      checked={settings?.include_user_activity || false}
                      onCheckedChange={(checked) => 
                        saveSettings({ include_user_activity: checked })
                      }
                      disabled={saving}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Smart Insights</span>
                    <Switch
                      checked={settings?.include_smart_insights || false}
                      onCheckedChange={(checked) => 
                        saveSettings({ include_smart_insights: checked })
                      }
                      disabled={saving}
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="recipients" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Email Recipients
              </CardTitle>
              <CardDescription>
                Manage who receives the daily project reports
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Add Recipient Form */}
              <div className="space-y-4 p-4 border rounded-lg bg-muted/30">
                <Label>Add New Recipient</Label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">Email *</Label>
                    <Input
                      type="email"
                      placeholder="email@example.com"
                      value={newEmail}
                      onChange={(e) => setNewEmail(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">Name (Optional)</Label>
                    <Input
                      type="text"
                      placeholder="John Doe"
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                    />
                  </div>
                </div>
                <Button 
                  onClick={handleAddRecipient} 
                  disabled={addingRecipient || !newEmail.trim()}
                  className="w-full md:w-auto"
                >
                  {addingRecipient ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Plus className="h-4 w-4 mr-2" />
                  )}
                  Add Recipient
                </Button>
              </div>

              {/* Recipients List */}
              <div className="space-y-2">
                <Label>Current Recipients ({recipients.length})</Label>
                {recipients.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4 text-center">
                    No recipients added yet. Add email addresses above.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {recipients.map((recipient) => (
                      <div 
                        key={recipient.id} 
                        className="flex items-center justify-between p-3 border rounded-lg"
                      >
                        <div className="flex items-center gap-3">
                          <div className={recipient.is_active ? 'text-primary' : 'text-muted-foreground'}>
                            {recipient.is_active ? (
                              <CheckCircle className="h-5 w-5" />
                            ) : (
                              <XCircle className="h-5 w-5" />
                            )}
                          </div>
                          <div>
                            <div className="font-medium text-sm">
                              {recipient.name || recipient.email}
                            </div>
                            {recipient.name && (
                              <div className="text-xs text-muted-foreground">
                                {recipient.email}
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={recipient.is_active}
                            onCheckedChange={(checked) => 
                              toggleRecipient(recipient.id, checked)
                            }
                          />
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => removeRecipient(recipient.id)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="preview" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Eye className="h-5 w-5" />
                Report Preview
              </CardTitle>
              <CardDescription>
                Preview how the daily report will look
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex justify-end mb-4">
                <Button 
                  onClick={handleSendTestReport} 
                  disabled={sendingTest || recipients.filter(r => r.is_active).length === 0}
                >
                  {sendingTest ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4 mr-2" />
                  )}
                  Send Test Report
                </Button>
              </div>
              
              {reportLoading ? (
                <div className="flex items-center justify-center p-8">
                  <Loader2 className="h-8 w-8 animate-spin" />
                </div>
              ) : (
                <ProjectReportPreview data={reportData} />
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

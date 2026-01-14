import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { UserCog, Trash2, Crown } from 'lucide-react';
import { useDepartmentLead } from '@/hooks/useDepartmentLead';
import { supabase } from '@/integrations/supabase/client';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';

interface DepartmentLeadDialogProps {
  departmentId: string;
  departmentName: string;
  projectId: string;
}

interface User {
  id: string;
  full_name: string | null;
  email: string;
}

export function DepartmentLeadDialog({ departmentId, departmentName, projectId }: DepartmentLeadDialogProps) {
  const [open, setOpen] = useState(false);
  const [users, setUsers] = useState<User[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [loadingUsers, setLoadingUsers] = useState(false);
  const { leads, loading, assignLead, removeLead } = useDepartmentLead(departmentId);

  useEffect(() => {
    if (open) {
      fetchUsers();
    }
  }, [open, projectId]);

  const fetchUsers = async () => {
    setLoadingUsers(true);
    try {
      // Get project members
      const { data: members } = await supabase
        .from('project_members')
        .select('user_id')
        .eq('project_id', projectId);

      if (members && members.length > 0) {
        const userIds = members.map(m => m.user_id);
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, full_name, email')
          .in('id', userIds);

        setUsers(profiles || []);
      }
    } catch (error) {
      console.error('Error fetching users:', error);
    } finally {
      setLoadingUsers(false);
    }
  };

  const handleAssign = async () => {
    if (!selectedUserId) return;
    await assignLead(selectedUserId);
    setSelectedUserId('');
  };

  const availableUsers = users.filter(u => !leads.some(l => l.user_id === u.id));

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <UserCog className="h-4 w-4" />
          Manage Leads
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Crown className="h-5 w-5 text-amber-500" />
            Department Leads - {departmentName}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Current Leads */}
          <div className="space-y-2">
            <h4 className="text-sm font-medium">Current Leads</h4>
            {loading ? (
              <p className="text-sm text-muted-foreground">Loading...</p>
            ) : leads.length === 0 ? (
              <p className="text-sm text-muted-foreground">No department leads assigned</p>
            ) : (
              <ScrollArea className="max-h-[200px]">
                <div className="space-y-2">
                  {leads.map((lead) => (
                    <div
                      key={lead.id}
                      className="flex items-center justify-between p-2 rounded-lg bg-muted/50"
                    >
                      <div className="flex items-center gap-2">
                        <Avatar className="h-8 w-8">
                          <AvatarFallback>
                            {lead.user_name?.charAt(0).toUpperCase() || 'U'}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="text-sm font-medium">{lead.user_name || 'Unknown'}</p>
                          <p className="text-xs text-muted-foreground">{lead.user_email}</p>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removeLead(lead.id)}
                        className="h-8 w-8 text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </div>

          {/* Assign New Lead */}
          <div className="space-y-2 border-t pt-4">
            <h4 className="text-sm font-medium">Assign New Lead</h4>
            <div className="flex gap-2">
              <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder="Select a user" />
                </SelectTrigger>
                <SelectContent>
                  {loadingUsers ? (
                    <SelectItem value="loading" disabled>Loading...</SelectItem>
                  ) : availableUsers.length === 0 ? (
                    <SelectItem value="none" disabled>No available users</SelectItem>
                  ) : (
                    availableUsers.map((user) => (
                      <SelectItem key={user.id} value={user.id}>
                        {user.full_name || user.email}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
              <Button onClick={handleAssign} disabled={!selectedUserId}>
                Assign
              </Button>
            </div>
          </div>

          <div className="text-xs text-muted-foreground bg-muted/50 p-3 rounded-lg">
            <p className="font-medium mb-1">Department Lead Permissions:</p>
            <ul className="list-disc list-inside space-y-1">
              <li>Can add/manage documents and links in this department</li>
              <li>Can grant document access to any system user</li>
              <li>Can manage department members</li>
            </ul>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

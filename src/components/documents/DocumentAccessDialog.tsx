import { useState, useEffect } from 'react';
import { useDocumentAccess } from '@/hooks/useDocumentAccess';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Shield, UserPlus, Trash2, Eye, Download } from 'lucide-react';

interface DocumentAccessDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  itemId: string;
  itemType: 'document' | 'link' | 'folder';
  itemName: string;
  projectId: string;
}

interface ProjectMember {
  id: string;
  user_id: string;
  full_name: string | null;
  email: string;
}

export function DocumentAccessDialog({
  open,
  onOpenChange,
  itemId,
  itemType,
  itemName,
  projectId,
}: DocumentAccessDialogProps) {
  const { accessList, loading, grantAccess, updateAccess, revokeAccess } = useDocumentAccess(itemId, itemType);
  const [projectMembers, setProjectMembers] = useState<ProjectMember[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [selectedPermission, setSelectedPermission] = useState<'view_only' | 'download'>('view_only');
  const [addingAccess, setAddingAccess] = useState(false);

  useEffect(() => {
    const fetchProjectMembers = async () => {
      if (!projectId) return;

      const { data: members, error } = await supabase
        .from('project_members')
        .select('id, user_id')
        .eq('project_id', projectId);

      if (error) {
        console.error('Error fetching project members:', error);
        return;
      }

      if (members && members.length > 0) {
        const userIds = members.map(m => m.user_id);
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, full_name, email')
          .in('id', userIds);

        if (profiles) {
          setProjectMembers(
            members.map(m => {
              const profile = profiles.find(p => p.id === m.user_id);
              return {
                id: m.id,
                user_id: m.user_id,
                full_name: profile?.full_name || null,
                email: profile?.email || '',
              };
            })
          );
        }
      }
    };

    if (open) {
      fetchProjectMembers();
    }
  }, [projectId, open]);

  const handleGrantAccess = async () => {
    if (!selectedUserId) return;

    setAddingAccess(true);
    try {
      await grantAccess(selectedUserId, selectedPermission);
      setSelectedUserId('');
      setSelectedPermission('view_only');
    } finally {
      setAddingAccess(false);
    }
  };

  const getInitials = (name: string | null | undefined, email: string) => {
    if (name) {
      return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    }
    return email.charAt(0).toUpperCase();
  };

  // Filter out members who already have access
  const availableMembers = projectMembers.filter(
    m => !accessList.some(a => a.user_id === m.user_id)
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Manage Access
          </DialogTitle>
          <DialogDescription>
            Control who can access "{itemName}"
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Add new access */}
          <div className="space-y-3">
            <Label>Grant Access to User</Label>
            <div className="flex gap-2">
              <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder="Select a user..." />
                </SelectTrigger>
                <SelectContent>
                  {availableMembers.length === 0 ? (
                    <SelectItem value="" disabled>
                      No available users
                    </SelectItem>
                  ) : (
                    availableMembers.map((member) => (
                      <SelectItem key={member.user_id} value={member.user_id}>
                        {member.full_name || member.email}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
              <Select 
                value={selectedPermission} 
                onValueChange={(v) => setSelectedPermission(v as 'view_only' | 'download')}
              >
                <SelectTrigger className="w-[130px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="view_only">View Only</SelectItem>
                  <SelectItem value="download">Download</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button
              onClick={handleGrantAccess}
              disabled={!selectedUserId || addingAccess}
              className="w-full"
            >
              <UserPlus className="h-4 w-4 mr-2" />
              {addingAccess ? 'Granting...' : 'Grant Access'}
            </Button>
          </div>

          {/* Current access list */}
          <div className="space-y-3">
            <Label>Users with Access</Label>
            {loading ? (
              <p className="text-sm text-muted-foreground">Loading...</p>
            ) : accessList.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No users have been granted access yet
              </p>
            ) : (
              <ScrollArea className="h-[200px]">
                <div className="space-y-2">
                  {accessList.map((access) => (
                    <div
                      key={access.id}
                      className="flex items-center justify-between p-2 rounded-lg bg-muted/50"
                    >
                      <div className="flex items-center gap-2">
                        <Avatar className="h-8 w-8">
                          <AvatarFallback className="text-xs">
                            {getInitials(access.user_name, access.user_email || '')}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="text-sm font-medium">
                            {access.user_name || access.user_email}
                          </p>
                          {access.user_name && access.user_email && (
                            <p className="text-xs text-muted-foreground">
                              {access.user_email}
                            </p>
                          )}
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <Select
                          value={access.permission}
                          onValueChange={(v) => updateAccess(access.id, v as 'view_only' | 'download')}
                        >
                          <SelectTrigger className="h-7 w-[100px] text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="view_only">
                              <div className="flex items-center gap-1">
                                <Eye className="h-3 w-3" />
                                View Only
                              </div>
                            </SelectItem>
                            <SelectItem value="download">
                              <div className="flex items-center gap-1">
                                <Download className="h-3 w-3" />
                                Download
                              </div>
                            </SelectItem>
                          </SelectContent>
                        </Select>
                        
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-destructive hover:text-destructive"
                          onClick={() => revokeAccess(access.id)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </div>

          {/* Permission legend */}
          <div className="pt-2 border-t">
            <p className="text-xs text-muted-foreground mb-2">Permission Levels:</p>
            <div className="flex gap-4 text-xs">
              <div className="flex items-center gap-1">
                <Badge variant="outline" className="text-xs">
                  <Eye className="h-3 w-3 mr-1" />
                  View Only
                </Badge>
                <span className="text-muted-foreground">Can view but not download</span>
              </div>
            </div>
            <div className="flex gap-4 text-xs mt-1">
              <div className="flex items-center gap-1">
                <Badge variant="outline" className="text-xs">
                  <Download className="h-3 w-3 mr-1" />
                  Download
                </Badge>
                <span className="text-muted-foreground">Can view and download</span>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

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
import { Separator } from '@/components/ui/separator';
import { Shield, UserPlus, Trash2, Eye, Download, Crown, Users, Building2 } from 'lucide-react';

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
  role?: string;
}

interface RoleBasedAccess {
  user_id: string;
  full_name: string | null;
  email: string;
  access_reason: 'admin' | 'project_manager' | 'department_lead' | 'project_owner' | 'uploader';
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
  const [roleBasedAccess, setRoleBasedAccess] = useState<RoleBasedAccess[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [selectedPermission, setSelectedPermission] = useState<'view_only' | 'download'>('view_only');
  const [addingAccess, setAddingAccess] = useState(false);
  const [loadingRoleAccess, setLoadingRoleAccess] = useState(true);

  useEffect(() => {
    const fetchProjectMembers = async () => {
      if (!projectId) return;

      const { data: members, error } = await supabase
        .from('project_members')
        .select('id, user_id, role')
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
                role: m.role || undefined,
              };
            })
          );
        }
      }
    };

    const fetchRoleBasedAccess = async () => {
      if (!projectId) return;
      setLoadingRoleAccess(true);

      try {
        const roleAccessList: RoleBasedAccess[] = [];
        const addedUserIds = new Set<string>();

        // Fetch admins
        const { data: admins } = await supabase
          .from('user_roles')
          .select('user_id')
          .eq('role', 'admin');

        if (admins) {
          const adminIds = admins.map(a => a.user_id);
          if (adminIds.length > 0) {
            const { data: adminProfiles } = await supabase
              .from('profiles')
              .select('id, full_name, email')
              .in('id', adminIds);

            adminProfiles?.forEach(profile => {
              if (!addedUserIds.has(profile.id)) {
                roleAccessList.push({
                  user_id: profile.id,
                  full_name: profile.full_name,
                  email: profile.email,
                  access_reason: 'admin',
                });
                addedUserIds.add(profile.id);
              }
            });
          }
        }

        // Fetch project managers
        const { data: projectManagers } = await supabase
          .from('user_roles')
          .select('user_id')
          .eq('role', 'project_manager');

        if (projectManagers) {
          const pmIds = projectManagers.map(pm => pm.user_id);
          if (pmIds.length > 0) {
            const { data: pmProfiles } = await supabase
              .from('profiles')
              .select('id, full_name, email')
              .in('id', pmIds);

            pmProfiles?.forEach(profile => {
              if (!addedUserIds.has(profile.id)) {
                roleAccessList.push({
                  user_id: profile.id,
                  full_name: profile.full_name,
                  email: profile.email,
                  access_reason: 'project_manager',
                });
                addedUserIds.add(profile.id);
              }
            });
          }
        }

        // Fetch project owner
        const { data: project } = await supabase
          .from('projects')
          .select('owner_id')
          .eq('id', projectId)
          .single();

        if (project?.owner_id && !addedUserIds.has(project.owner_id)) {
          const { data: ownerProfile } = await supabase
            .from('profiles')
            .select('id, full_name, email')
            .eq('id', project.owner_id)
            .single();

          if (ownerProfile) {
            roleAccessList.push({
              user_id: ownerProfile.id,
              full_name: ownerProfile.full_name,
              email: ownerProfile.email,
              access_reason: 'project_owner',
            });
            addedUserIds.add(ownerProfile.id);
          }
        }

        // Fetch department leads for this project
        const { data: departments } = await supabase
          .from('departments')
          .select('id')
          .eq('project_id', projectId);

        if (departments && departments.length > 0) {
          const deptIds = departments.map(d => d.id);
          const { data: leads } = await supabase
            .from('department_leads')
            .select('user_id')
            .in('department_id', deptIds);

          if (leads) {
            const leadIds = leads.map(l => l.user_id).filter(id => !addedUserIds.has(id));
            if (leadIds.length > 0) {
              const { data: leadProfiles } = await supabase
                .from('profiles')
                .select('id, full_name, email')
                .in('id', leadIds);

              leadProfiles?.forEach(profile => {
                if (!addedUserIds.has(profile.id)) {
                  roleAccessList.push({
                    user_id: profile.id,
                    full_name: profile.full_name,
                    email: profile.email,
                    access_reason: 'department_lead',
                  });
                  addedUserIds.add(profile.id);
                }
              });
            }
          }
        }

        // Fetch uploader (for documents)
        if (itemType === 'document') {
          const { data: doc } = await supabase
            .from('documents')
            .select('uploaded_by')
            .eq('id', itemId)
            .single();

          if (doc?.uploaded_by && !addedUserIds.has(doc.uploaded_by)) {
            const { data: uploaderProfile } = await supabase
              .from('profiles')
              .select('id, full_name, email')
              .eq('id', doc.uploaded_by)
              .single();

            if (uploaderProfile) {
              roleAccessList.push({
                user_id: uploaderProfile.id,
                full_name: uploaderProfile.full_name,
                email: uploaderProfile.email,
                access_reason: 'uploader',
              });
              addedUserIds.add(uploaderProfile.id);
            }
          }
        }

        // Fetch creator (for links and folders)
        if (itemType === 'link' || itemType === 'folder') {
          const table = itemType === 'link' ? 'document_links' : 'document_folders';
          const { data: item } = await supabase
            .from(table)
            .select('created_by')
            .eq('id', itemId)
            .single();

          if (item?.created_by && !addedUserIds.has(item.created_by)) {
            const { data: creatorProfile } = await supabase
              .from('profiles')
              .select('id, full_name, email')
              .eq('id', item.created_by)
              .single();

            if (creatorProfile) {
              roleAccessList.push({
                user_id: creatorProfile.id,
                full_name: creatorProfile.full_name,
                email: creatorProfile.email,
                access_reason: 'uploader',
              });
              addedUserIds.add(creatorProfile.id);
            }
          }
        }

        setRoleBasedAccess(roleAccessList);
      } catch (error) {
        console.error('Error fetching role-based access:', error);
      } finally {
        setLoadingRoleAccess(false);
      }
    };

    if (open) {
      fetchProjectMembers();
      fetchRoleBasedAccess();
    }
  }, [projectId, itemId, itemType, open]);

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

  const getAccessReasonBadge = (reason: RoleBasedAccess['access_reason']) => {
    switch (reason) {
      case 'admin':
        return (
          <Badge variant="destructive" className="text-xs">
            <Crown className="h-3 w-3 mr-1" />
            Admin
          </Badge>
        );
      case 'project_manager':
        return (
          <Badge variant="default" className="text-xs bg-purple-600">
            <Users className="h-3 w-3 mr-1" />
            Project Manager
          </Badge>
        );
      case 'project_owner':
        return (
          <Badge variant="default" className="text-xs bg-amber-600">
            <Crown className="h-3 w-3 mr-1" />
            Project Owner
          </Badge>
        );
      case 'department_lead':
        return (
          <Badge variant="secondary" className="text-xs">
            <Building2 className="h-3 w-3 mr-1" />
            Department Lead
          </Badge>
        );
      case 'uploader':
        return (
          <Badge variant="outline" className="text-xs">
            <Download className="h-3 w-3 mr-1" />
            {itemType === 'document' ? 'Uploader' : 'Creator'}
          </Badge>
        );
      default:
        return null;
    }
  };

  // Filter out members who already have explicit access or role-based access
  const availableMembers = projectMembers.filter(
    m => !accessList.some(a => a.user_id === m.user_id) && 
         !roleBasedAccess.some(r => r.user_id === m.user_id)
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
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
          {/* Role-based access section */}
          <div className="space-y-3">
            <Label className="flex items-center gap-2">
              <Crown className="h-4 w-4 text-amber-500" />
              Automatic Access (by Role)
            </Label>
            <p className="text-xs text-muted-foreground">
              These users have full access based on their system role
            </p>
            {loadingRoleAccess ? (
              <p className="text-sm text-muted-foreground">Loading...</p>
            ) : roleBasedAccess.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No users with automatic role-based access
              </p>
            ) : (
              <ScrollArea className="h-[150px]">
                <div className="space-y-2">
                  {roleBasedAccess.map((access) => (
                    <div
                      key={access.user_id}
                      className="flex items-center justify-between p-2 rounded-lg bg-muted/30 border border-dashed"
                    >
                      <div className="flex items-center gap-2">
                        <Avatar className="h-8 w-8">
                          <AvatarFallback className="text-xs">
                            {getInitials(access.full_name, access.email)}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="text-sm font-medium">
                            {access.full_name || access.email}
                          </p>
                          {access.full_name && (
                            <p className="text-xs text-muted-foreground">
                              {access.email}
                            </p>
                          )}
                        </div>
                      </div>
                      {getAccessReasonBadge(access.access_reason)}
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </div>

          <Separator />

          {/* Add new explicit access */}
          <div className="space-y-3">
            <Label className="flex items-center gap-2">
              <UserPlus className="h-4 w-4" />
              Grant Additional Access
            </Label>
            <div className="flex gap-2">
              <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder="Select a user..." />
                </SelectTrigger>
                <SelectContent>
                  {availableMembers.length === 0 ? (
                    <div className="py-2 px-3 text-sm text-muted-foreground">
                      No available users
                    </div>
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
              size="sm"
            >
              <UserPlus className="h-4 w-4 mr-2" />
              {addingAccess ? 'Granting...' : 'Grant Access'}
            </Button>
          </div>

          {/* Explicit access list */}
          <div className="space-y-3">
            <Label>Users with Explicit Access</Label>
            {loading ? (
              <p className="text-sm text-muted-foreground">Loading...</p>
            ) : accessList.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No additional users have been granted access
              </p>
            ) : (
              <ScrollArea className="h-[150px]">
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
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="flex items-center gap-1">
                <Badge variant="outline" className="text-xs">
                  <Eye className="h-3 w-3 mr-1" />
                  View Only
                </Badge>
              </div>
              <div className="flex items-center gap-1">
                <Badge variant="outline" className="text-xs">
                  <Download className="h-3 w-3 mr-1" />
                  Download
                </Badge>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

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
import { Checkbox } from '@/components/ui/checkbox';
import { Shield, UserPlus, Trash2, Eye, Download, Crown, Users, Building2, Pencil, CheckSquare } from 'lucide-react';

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
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [selectedPermission, setSelectedPermission] = useState<'view_only' | 'download' | 'edit'>('view_only');
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
    if (selectedUserIds.length === 0) return;

    setAddingAccess(true);
    try {
      // Grant access to all selected users
      for (const userId of selectedUserIds) {
        await grantAccess(userId, selectedPermission);
      }
      setSelectedUserIds([]);
      setSelectedPermission('view_only');
    } finally {
      setAddingAccess(false);
    }
  };

  const toggleUserSelection = (userId: string) => {
    setSelectedUserIds(prev => 
      prev.includes(userId) 
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    );
  };

  const selectAllAvailable = () => {
    setSelectedUserIds(availableMembers.map(m => m.user_id));
  };

  const clearSelection = () => {
    setSelectedUserIds([]);
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
      <DialogContent className="max-w-[95vw] sm:max-w-lg mx-auto max-h-[90vh] flex flex-col">
        <DialogHeader className="shrink-0">
          <DialogTitle className="flex items-center gap-2 text-base sm:text-lg">
            <Shield className="h-4 w-4 sm:h-5 sm:w-5 shrink-0" />
            <span className="truncate">Manage Access</span>
          </DialogTitle>
          <DialogDescription className="text-xs sm:text-sm truncate">
            Control who can access "{itemName}"
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 sm:space-y-6 overflow-y-auto flex-1 pr-1">
          {/* Role-based access section */}
          <div className="space-y-2 sm:space-y-3">
            <Label className="flex items-center gap-2 text-sm">
              <Crown className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-amber-500 shrink-0" />
              <span>Automatic Access (by Role)</span>
            </Label>
            <p className="text-xs text-muted-foreground">
              These users have full access based on their system role
            </p>
            {loadingRoleAccess ? (
              <p className="text-xs sm:text-sm text-muted-foreground">Loading...</p>
            ) : roleBasedAccess.length === 0 ? (
              <p className="text-xs sm:text-sm text-muted-foreground">
                No users with automatic role-based access
              </p>
            ) : (
              <ScrollArea className="h-[120px] sm:h-[150px]">
                <div className="space-y-2">
                  {roleBasedAccess.map((access) => (
                    <div
                      key={access.user_id}
                      className="flex flex-col sm:flex-row sm:items-center gap-2 p-2 rounded-lg bg-muted/30 border border-dashed"
                    >
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <Avatar className="h-6 w-6 sm:h-8 sm:w-8 shrink-0">
                          <AvatarFallback className="text-xs">
                            {getInitials(access.full_name, access.email)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs sm:text-sm font-medium truncate">
                            {access.full_name || access.email}
                          </p>
                          {access.full_name && (
                            <p className="text-xs text-muted-foreground truncate">
                              {access.email}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="self-start sm:self-center shrink-0">
                        {getAccessReasonBadge(access.access_reason)}
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </div>

          <Separator />

          {/* Add new explicit access - Bulk Grant */}
          <div className="space-y-2 sm:space-y-3">
            <div className="flex items-center justify-between">
              <Label className="flex items-center gap-2 text-sm">
                <UserPlus className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" />
                <span>Grant Additional Access</span>
              </Label>
              {selectedUserIds.length > 0 && (
                <Badge variant="secondary" className="text-xs">
                  {selectedUserIds.length} selected
                </Badge>
              )}
            </div>
            
            {/* Permission selector */}
            <div className="flex items-center gap-2">
              <Label className="text-xs text-muted-foreground shrink-0">Permission:</Label>
              <Select 
                value={selectedPermission} 
                onValueChange={(v) => setSelectedPermission(v as 'view_only' | 'download' | 'edit')}
              >
                <SelectTrigger className="w-full sm:w-[150px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="view_only">View Only</SelectItem>
                  <SelectItem value="download">Download</SelectItem>
                  {itemType === 'folder' && (
                    <SelectItem value="edit">Edit / Upload</SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>

            {/* User selection list */}
            {availableMembers.length === 0 ? (
              <p className="text-xs sm:text-sm text-muted-foreground py-2">
                No available users to grant access
              </p>
            ) : (
              <>
                {/* Quick actions */}
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={selectAllAvailable}
                    disabled={selectedUserIds.length === availableMembers.length}
                    className="text-xs h-7"
                  >
                    <CheckSquare className="h-3 w-3 mr-1" />
                    Select All
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={clearSelection}
                    disabled={selectedUserIds.length === 0}
                    className="text-xs h-7"
                  >
                    Clear
                  </Button>
                </div>

                {/* User list with checkboxes */}
                <ScrollArea className="h-[120px] sm:h-[150px] border rounded-lg">
                  <div className="p-2 space-y-1">
                    {availableMembers.map((member) => (
                      <div
                        key={member.user_id}
                        className={`flex items-center gap-2 p-2 rounded-md cursor-pointer transition-colors ${
                          selectedUserIds.includes(member.user_id)
                            ? 'bg-primary/10 border border-primary/30'
                            : 'hover:bg-muted/50'
                        }`}
                        onClick={() => toggleUserSelection(member.user_id)}
                      >
                        <Checkbox
                          checked={selectedUserIds.includes(member.user_id)}
                          onCheckedChange={() => toggleUserSelection(member.user_id)}
                          className="shrink-0"
                        />
                        <Avatar className="h-6 w-6 shrink-0">
                          <AvatarFallback className="text-xs">
                            {getInitials(member.full_name, member.email)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs sm:text-sm font-medium truncate">
                            {member.full_name || member.email}
                          </p>
                          {member.full_name && (
                            <p className="text-xs text-muted-foreground truncate">
                              {member.email}
                            </p>
                          )}
                        </div>
                        {member.role && (
                          <Badge variant="outline" className="text-xs shrink-0">
                            {member.role}
                          </Badge>
                        )}
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </>
            )}

            <Button
              onClick={handleGrantAccess}
              disabled={selectedUserIds.length === 0 || addingAccess}
              className="w-full"
              size="sm"
            >
              <UserPlus className="h-4 w-4 mr-2" />
              {addingAccess 
                ? `Granting to ${selectedUserIds.length} user${selectedUserIds.length > 1 ? 's' : ''}...` 
                : `Grant Access${selectedUserIds.length > 0 ? ` to ${selectedUserIds.length} user${selectedUserIds.length > 1 ? 's' : ''}` : ''}`
              }
            </Button>
          </div>

          {/* Explicit access list */}
          <div className="space-y-2 sm:space-y-3">
            <Label className="text-sm">Users with Explicit Access</Label>
            {loading ? (
              <p className="text-xs sm:text-sm text-muted-foreground">Loading...</p>
            ) : accessList.length === 0 ? (
              <p className="text-xs sm:text-sm text-muted-foreground">
                No additional users have been granted access
              </p>
            ) : (
              <ScrollArea className="h-[120px] sm:h-[150px]">
                <div className="space-y-2">
                  {accessList.map((access) => (
                    <div
                      key={access.id}
                      className="flex flex-col sm:flex-row sm:items-center gap-2 p-2 rounded-lg bg-muted/50"
                    >
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <Avatar className="h-6 w-6 sm:h-8 sm:w-8 shrink-0">
                          <AvatarFallback className="text-xs">
                            {getInitials(access.user_name, access.user_email || '')}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs sm:text-sm font-medium truncate">
                            {access.user_name || access.user_email}
                          </p>
                          {access.user_name && access.user_email && (
                            <p className="text-xs text-muted-foreground truncate">
                              {access.user_email}
                            </p>
                          )}
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                        <Select
                          value={access.permission}
                          onValueChange={(v) => updateAccess(access.id, v as 'view_only' | 'download' | 'edit')}
                        >
                          <SelectTrigger className="h-7 w-[100px] sm:w-[110px] text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="view_only">
                              <div className="flex items-center gap-1">
                                <Eye className="h-3 w-3 shrink-0" />
                                <span>View Only</span>
                              </div>
                            </SelectItem>
                            <SelectItem value="download">
                              <div className="flex items-center gap-1">
                                <Download className="h-3 w-3 shrink-0" />
                                <span>Download</span>
                              </div>
                            </SelectItem>
                            {itemType === 'folder' && (
                              <SelectItem value="edit">
                                <div className="flex items-center gap-1">
                                  <Pencil className="h-3 w-3 shrink-0" />
                                  <span>Edit</span>
                                </div>
                              </SelectItem>
                            )}
                          </SelectContent>
                        </Select>
                        
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-destructive hover:text-destructive shrink-0"
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
          <div className="pt-2 border-t shrink-0">
            <p className="text-xs text-muted-foreground mb-2">Permission Levels:</p>
            <div className="flex flex-wrap gap-2 text-xs">
              <Badge variant="outline" className="text-xs">
                <Eye className="h-3 w-3 mr-1 shrink-0" />
                View Only
              </Badge>
              <Badge variant="outline" className="text-xs">
                <Download className="h-3 w-3 mr-1 shrink-0" />
                Download
              </Badge>
              {itemType === 'folder' && (
                <Badge variant="outline" className="text-xs">
                  <Pencil className="h-3 w-3 mr-1 shrink-0" />
                  Edit / Upload
                </Badge>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

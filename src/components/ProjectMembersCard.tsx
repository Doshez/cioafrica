import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Loader2, UserPlus, Users, Eye, UserCog, Crown, Trash2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useUserRole } from "@/hooks/useUserRole";

interface ProjectMember {
  id: string;
  user_id: string;
  role: 'owner' | 'manager' | 'member' | 'viewer';
  profiles: {
    full_name: string | null;
    email: string;
  };
}

interface ProjectMembersCardProps {
  projectId: string;
  projectOwnerId: string;
}

export function ProjectMembersCard({ projectId, projectOwnerId }: ProjectMembersCardProps) {
  const { toast } = useToast();
  const { isAdmin, isProjectManager } = useUserRole();
  const [members, setMembers] = useState<ProjectMember[]>([]);
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [selectedRole, setSelectedRole] = useState<string>("member");
  const [isAdding, setIsAdding] = useState(false);

  useEffect(() => {
    fetchMembers();
    fetchAllUsers();
  }, [projectId]);

  const fetchMembers = async () => {
    try {
      // Fetch project members
      const { data: membersData, error: membersError } = await supabase
        .from('project_members')
        .select('*')
        .eq('project_id', projectId);

      if (membersError) throw membersError;

      // Fetch profiles for those members
      if (membersData && membersData.length > 0) {
        const userIds = membersData.map(m => m.user_id);
        const { data: profilesData, error: profilesError } = await supabase
          .from('profiles')
          .select('id, full_name, email')
          .in('id', userIds);

        if (profilesError) throw profilesError;

        // Combine the data
        const combinedData = membersData.map(member => {
          const profile = profilesData?.find(p => p.id === member.user_id);
          return {
            ...member,
            profiles: {
              full_name: profile?.full_name || null,
              email: profile?.email || '',
            },
          };
        });

        setMembers(combinedData as ProjectMember[]);
      } else {
        setMembers([]);
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchAllUsers = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, email, full_name')
        .order('email');

      if (error) throw error;
      setAllUsers(data || []);
    } catch (error: any) {
      console.error('Error fetching users:', error);
    }
  };

  const addMember = async () => {
    if (!selectedUserId || !selectedRole) {
      toast({
        title: "Error",
        description: "Please select a user and role",
        variant: "destructive",
      });
      return;
    }

    // Check if user is already a member
    if (members.some(m => m.user_id === selectedUserId)) {
      toast({
        title: "Error",
        description: "User is already a member of this project",
        variant: "destructive",
      });
      return;
    }

    setIsAdding(true);
    try {
      const { error } = await supabase
        .from('project_members')
        .insert({
          project_id: projectId,
          user_id: selectedUserId,
          role: selectedRole as 'owner' | 'manager' | 'member' | 'viewer',
        });

      if (error) throw error;

      toast({
        title: "Success",
        description: "Member added successfully",
      });

      setDialogOpen(false);
      setSelectedUserId("");
      setSelectedRole("member");
      fetchMembers();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsAdding(false);
    }
  };

  const updateMemberRole = async (memberId: string, newRole: string) => {
    try {
      const { error } = await supabase
        .from('project_members')
        .update({ role: newRole as 'owner' | 'manager' | 'member' | 'viewer' })
        .eq('id', memberId);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Role updated successfully",
      });

      fetchMembers();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const removeMember = async (memberId: string) => {
    try {
      const { error } = await supabase
        .from('project_members')
        .delete()
        .eq('id', memberId);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Member removed successfully",
      });

      fetchMembers();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'owner': return <Crown className="h-4 w-4" />;
      case 'manager': return <UserCog className="h-4 w-4" />;
      case 'member': return <Users className="h-4 w-4" />;
      case 'viewer': return <Eye className="h-4 w-4" />;
      default: return <Users className="h-4 w-4" />;
    }
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'owner': return 'bg-purple-500 text-white';
      case 'manager': return 'bg-blue-500 text-white';
      case 'member': return 'bg-green-500 text-white';
      case 'viewer': return 'bg-gray-500 text-white';
      default: return 'bg-secondary text-secondary-foreground';
    }
  };

  const availableUsers = allUsers.filter(
    user => !members.some(m => m.user_id === user.id) && user.id !== projectOwnerId
  );

  const canManageMembers = isAdmin || isProjectManager;

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="p-4 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:justify-between">
          <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
            <Users className="h-4 w-4 sm:h-5 sm:w-5 shrink-0" />
            <span className="truncate">Project Members ({members.length + 1})</span>
          </CardTitle>
          {canManageMembers && (
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm" className="w-full sm:w-auto">
                  <UserPlus className="h-4 w-4 mr-2" />
                  Add Member
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-[95vw] sm:max-w-md mx-auto">
                <DialogHeader>
                  <DialogTitle className="text-base sm:text-lg">Add Project Member</DialogTitle>
                  <DialogDescription className="text-sm">
                    Assign a user to this project with a specific role
                  </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Select User</label>
                    <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Choose a user" />
                      </SelectTrigger>
                      <SelectContent className="max-h-[200px]">
                        {availableUsers.map((user) => (
                          <SelectItem key={user.id} value={user.id}>
                            <span className="truncate">{user.full_name || user.email}</span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">Project Role</label>
                    <Select value={selectedRole} onValueChange={setSelectedRole}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select role" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="viewer">
                          <div className="flex items-center gap-2">
                            <Eye className="h-4 w-4 shrink-0" />
                            <span className="truncate">Viewer - View only</span>
                          </div>
                        </SelectItem>
                        <SelectItem value="member">
                          <div className="flex items-center gap-2">
                            <Users className="h-4 w-4 shrink-0" />
                            <span className="truncate">Member - Create & manage tasks</span>
                          </div>
                        </SelectItem>
                        <SelectItem value="manager">
                          <div className="flex items-center gap-2">
                            <UserCog className="h-4 w-4 shrink-0" />
                            <span className="truncate">Manager - Full project control</span>
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    <Alert>
                      <AlertDescription className="text-xs">
                        {selectedRole === 'viewer' && 'Can only view Gantt charts and project data'}
                        {selectedRole === 'member' && 'Can create tasks, assign work, and update status'}
                        {selectedRole === 'manager' && 'Can manage all aspects of this project'}
                      </AlertDescription>
                    </Alert>
                  </div>
                </div>

                <DialogFooter className="flex-col sm:flex-row gap-2">
                  <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={isAdding} className="w-full sm:w-auto">
                    Cancel
                  </Button>
                  <Button onClick={addMember} disabled={isAdding} className="w-full sm:w-auto">
                    {isAdding && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    Add Member
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </CardHeader>
      <CardContent className="p-4 sm:p-6 pt-0 sm:pt-0">
        <div className="max-h-[400px] overflow-y-auto pr-1 sm:pr-2 scrollbar-thin">
          <div className="space-y-2 sm:space-y-3">
          {/* Project Owner */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:justify-between p-2 sm:p-3 rounded-lg border bg-purple-50 dark:bg-purple-950/20">
            <div className="flex items-center gap-2 sm:gap-3 min-w-0">
              <div className="flex items-center justify-center w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-purple-500 text-white shrink-0">
                <Crown className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              </div>
              <div className="min-w-0">
                <p className="font-medium text-xs sm:text-sm truncate">Project Owner</p>
                <p className="text-xs text-muted-foreground">Full control</p>
              </div>
            </div>
            <Badge className="bg-purple-500 text-white self-start sm:self-center text-xs shrink-0">Owner</Badge>
          </div>

          {/* Project Members */}
          {members.map((member) => (
            <div
              key={member.id}
              className="flex flex-col gap-2 p-2 sm:p-3 rounded-lg border"
            >
              <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                <div className="flex items-center justify-center w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-primary/10 shrink-0">
                  {getRoleIcon(member.role)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-xs sm:text-sm truncate">
                    {member.profiles.full_name || member.profiles.email}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">{member.profiles.email}</p>
                </div>
              </div>
              
              <div className="flex items-center gap-2 justify-end">
                {canManageMembers ? (
                  <>
                    <Select
                      value={member.role}
                      onValueChange={(value) => updateMemberRole(member.id, value)}
                    >
                      <SelectTrigger className="w-full sm:w-[120px] h-8 text-xs sm:text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="viewer">Viewer</SelectItem>
                        <SelectItem value="member">Member</SelectItem>
                        <SelectItem value="manager">Manager</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 shrink-0"
                      onClick={() => removeMember(member.id)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </>
                ) : (
                  <Badge className={getRoleBadgeColor(member.role)}>
                    {member.role}
                  </Badge>
                )}
              </div>
            </div>
          ))}

          {members.length === 0 && (
            <p className="text-xs sm:text-sm text-muted-foreground text-center py-4">
              No additional members yet
            </p>
          )}
        </div>
        </div>
      </CardContent>
    </Card>
  );
}

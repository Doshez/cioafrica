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
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Project Members ({members.length + 1})
          </CardTitle>
          {canManageMembers && (
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <UserPlus className="h-4 w-4 mr-2" />
                  Add Member
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add Project Member</DialogTitle>
                  <DialogDescription>
                    Assign a user to this project with a specific role
                  </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Select User</label>
                    <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Choose a user" />
                      </SelectTrigger>
                      <SelectContent>
                        {availableUsers.map((user) => (
                          <SelectItem key={user.id} value={user.id}>
                            {user.full_name || user.email}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">Project Role</label>
                    <Select value={selectedRole} onValueChange={setSelectedRole}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select role" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="viewer">
                          <div className="flex items-center gap-2">
                            <Eye className="h-4 w-4" />
                            <span>Viewer - View only</span>
                          </div>
                        </SelectItem>
                        <SelectItem value="member">
                          <div className="flex items-center gap-2">
                            <Users className="h-4 w-4" />
                            <span>Member - Create & manage tasks</span>
                          </div>
                        </SelectItem>
                        <SelectItem value="manager">
                          <div className="flex items-center gap-2">
                            <UserCog className="h-4 w-4" />
                            <span>Manager - Full project control</span>
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

                <DialogFooter>
                  <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={isAdding}>
                    Cancel
                  </Button>
                  <Button onClick={addMember} disabled={isAdding}>
                    {isAdding && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    Add Member
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {/* Project Owner */}
          <div className="flex items-center justify-between p-3 rounded-lg border bg-purple-50 dark:bg-purple-950/20">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-8 h-8 rounded-full bg-purple-500 text-white">
                <Crown className="h-4 w-4" />
              </div>
              <div>
                <p className="font-medium text-sm">Project Owner</p>
                <p className="text-xs text-muted-foreground">Full control</p>
              </div>
            </div>
            <Badge className="bg-purple-500 text-white">Owner</Badge>
          </div>

          {/* Project Members */}
          {members.map((member) => (
            <div
              key={member.id}
              className="flex items-center justify-between p-3 rounded-lg border"
            >
              <div className="flex items-center gap-3 flex-1">
                <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10">
                  {getRoleIcon(member.role)}
                </div>
                <div className="flex-1">
                  <p className="font-medium text-sm">
                    {member.profiles.full_name || member.profiles.email}
                  </p>
                  <p className="text-xs text-muted-foreground">{member.profiles.email}</p>
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                {canManageMembers ? (
                  <>
                    <Select
                      value={member.role}
                      onValueChange={(value) => updateMemberRole(member.id, value)}
                    >
                      <SelectTrigger className="w-[140px] h-8">
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
                      className="h-8 w-8"
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
            <p className="text-sm text-muted-foreground text-center py-4">
              No additional members yet
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

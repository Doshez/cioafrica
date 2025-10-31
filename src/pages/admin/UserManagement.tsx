import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Loader2, UserPlus } from "lucide-react";

interface User {
  id: string;
  email: string;
  full_name: string | null;
  roles: string[];
}

export default function UserManagement() {
  const { toast } = useToast();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreatingUser, setIsCreatingUser] = useState(false);
  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserName, setNewUserName] = useState("");
  const [newUserRole, setNewUserRole] = useState<string>("member");
  const [dialogOpen, setDialogOpen] = useState(false);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, email, full_name')
        .order('created_at', { ascending: false });

      if (profilesError) throw profilesError;

      const { data: roles, error: rolesError } = await supabase
        .from('user_roles')
        .select('user_id, role');

      if (rolesError) throw rolesError;

      const usersWithRoles = profiles?.map(profile => ({
        ...profile,
        roles: roles?.filter(r => r.user_id === profile.id).map(r => r.role) || []
      })) || [];

      setUsers(usersWithRoles);
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

  const updateUserRole = async (userId: string, role: string, action: 'add' | 'remove') => {
    try {
      if (action === 'add') {
        const { error } = await supabase
          .from('user_roles')
          .insert({ 
            user_id: userId, 
            role: role as 'admin' | 'project_manager' | 'member' | 'viewer'
          });
        
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('user_roles')
          .delete()
          .eq('user_id', userId)
          .eq('role', role as 'admin' | 'project_manager' | 'member' | 'viewer');
        
        if (error) throw error;
      }

      toast({
        title: "Success",
        description: `Role ${action === 'add' ? 'added' : 'removed'} successfully`,
      });

      fetchUsers();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const createUser = async () => {
    if (!newUserEmail || !newUserName || !newUserRole) {
      toast({
        title: "Error",
        description: "Please fill in all fields",
        variant: "destructive",
      });
      return;
    }

    setIsCreatingUser(true);
    try {
      const { data, error } = await supabase.functions.invoke('create-user', {
        body: {
          email: newUserEmail,
          full_name: newUserName,
          role: newUserRole,
        },
      });

      if (error) throw error;

      toast({
        title: "Success",
        description: "User created and invitation email sent successfully",
      });

      setDialogOpen(false);
      setNewUserEmail("");
      setNewUserName("");
      setNewUserRole("member");
      fetchUsers();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsCreatingUser(false);
    }
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'admin': return 'bg-destructive text-destructive-foreground';
      case 'project_manager': return 'bg-primary text-primary-foreground';
      case 'member': return 'bg-blue-500 text-white';
      case 'viewer': return 'bg-gray-500 text-white';
      default: return 'bg-secondary text-secondary-foreground';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">User Management</h1>
          <p className="text-muted-foreground mt-2">
            Manage user roles and permissions
          </p>
        </div>
        
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <UserPlus className="h-4 w-4 mr-2" />
              Create User
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New User</DialogTitle>
              <DialogDescription>
                Create a new user account. They will receive an email with their login credentials.
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="user@example.com"
                  value={newUserEmail}
                  onChange={(e) => setNewUserEmail(e.target.value)}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="name">Full Name</Label>
                <Input
                  id="name"
                  type="text"
                  placeholder="John Doe"
                  value={newUserName}
                  onChange={(e) => setNewUserName(e.target.value)}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="role">Role</Label>
                <Select value={newUserRole} onValueChange={setNewUserRole}>
                  <SelectTrigger id="role">
                    <SelectValue placeholder="Select role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="member">Member</SelectItem>
                    <SelectItem value="project_manager">Project Manager</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="viewer">Viewer</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Members can view charts, create tasks, and manage assignments
                </p>
              </div>
            </div>
            
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setDialogOpen(false)}
                disabled={isCreatingUser}
              >
                Cancel
              </Button>
              <Button onClick={createUser} disabled={isCreatingUser}>
                {isCreatingUser && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Create User
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4">
        {users.map((user) => (
          <Card key={user.id}>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="text-xl">{user.full_name || user.email}</CardTitle>
                  <p className="text-sm text-muted-foreground mt-1">{user.email}</p>
                </div>
                <div className="flex gap-2 flex-wrap">
                  {user.roles.map((role) => (
                    <Badge key={role} className={getRoleBadgeColor(role)}>
                      {role}
                    </Badge>
                  ))}
                  {user.roles.length === 0 && (
                    <Badge variant="outline">User</Badge>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-4">
                <Select
                  onValueChange={(value) => {
                    const hasRole = user.roles.includes(value);
                    updateUserRole(user.id, value, hasRole ? 'remove' : 'add');
                  }}
                >
                  <SelectTrigger className="w-[200px]">
                    <SelectValue placeholder="Assign role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="project_manager">Project Manager</SelectItem>
                    <SelectItem value="member">Member</SelectItem>
                    <SelectItem value="viewer">Viewer</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

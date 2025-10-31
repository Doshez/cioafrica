import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Loader2, UserPlus, Info, Shield, Eye, Users, UserCog } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

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

  const roleDescriptions = [
    {
      role: 'viewer',
      icon: Eye,
      color: 'text-gray-500',
      title: 'Viewer',
      description: 'Read-only access to assigned projects',
      permissions: [
        '✓ View assigned projects',
        '✓ View Gantt charts',
        '✓ View tasks and their details',
        '✓ View project analytics',
        '✗ Cannot create or edit anything',
        '✗ Cannot assign tasks',
        '✗ Cannot access admin features'
      ]
    },
    {
      role: 'member',
      icon: Users,
      color: 'text-green-500',
      title: 'Member',
      description: 'Create & manage tasks',
      permissions: [
        '✓ View assigned projects',
        '✓ View Gantt charts',
        '✓ Create tasks in assigned projects',
        '✓ Assign tasks to team members',
        '✓ Update own assigned tasks',
        '✓ View project analytics',
        '✓ Add comments and attachments',
        '✗ Cannot create/delete projects',
        '✗ Cannot manage departments',
        '✗ Cannot access admin features'
      ]
    },
    {
      role: 'project_manager',
      icon: UserCog,
      color: 'text-blue-500',
      title: 'Project Manager',
      description: 'Manage projects & teams',
      permissions: [
        '✓ Create and update projects',
        '✓ Create and manage departments',
        '✓ Create and assign tasks',
        '✓ Update task status and assignments',
        '✓ Add/remove project members',
        '✓ View Gantt charts',
        '✓ View analytics',
        '✗ Cannot access admin dashboard',
        '✗ Cannot manage user roles'
      ]
    },
    {
      role: 'admin',
      icon: Shield,
      color: 'text-red-500',
      title: 'Admin',
      description: 'Full system access',
      permissions: [
        '✓ View and manage all users',
        '✓ Create and delete users',
        '✓ Assign/remove any role',
        '✓ Access admin dashboard',
        '✓ View and manage all projects',
        '✓ View and manage all tasks',
        '✓ Access analytics',
        '✓ Delete projects and departments'
      ]
    }
  ];

  return (
    <div className="space-y-6">
      {/* Role Guide Card */}
      <Card className="border-primary/20">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Info className="h-5 w-5 text-primary" />
            <CardTitle>User Role Permissions</CardTitle>
          </div>
          <CardDescription>
            Understand what each user role can access and do in the system
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Accordion type="single" collapsible className="w-full">
            {roleDescriptions.map((roleDesc) => {
              const Icon = roleDesc.icon;
              return (
                <AccordionItem key={roleDesc.role} value={roleDesc.role}>
                  <AccordionTrigger className="hover:no-underline">
                    <div className="flex items-center gap-3">
                      <Icon className={`h-5 w-5 ${roleDesc.color}`} />
                      <div className="text-left">
                        <div className="font-semibold">{roleDesc.title}</div>
                        <div className="text-sm text-muted-foreground">{roleDesc.description}</div>
                      </div>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="pl-8 space-y-2 pt-2">
                      <ul className="space-y-1.5">
                        {roleDesc.permissions.map((permission, idx) => (
                          <li key={idx} className="text-sm flex items-start gap-2">
                            <span className={permission.startsWith('✗') ? 'text-red-500' : 'text-green-500'}>
                              {permission.slice(0, 1)}
                            </span>
                            <span className={permission.startsWith('✗') ? 'text-muted-foreground' : ''}>
                              {permission.slice(2)}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </AccordionContent>
                </AccordionItem>
              );
            })}
          </Accordion>
          
          <Alert className="mt-4">
            <Info className="h-4 w-4" />
            <AlertDescription className="text-xs">
              <strong>Note:</strong> Beyond these system roles, you can also assign project-specific permissions when adding members to individual projects.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>

      {/* Header with Create User Button */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">User Management</h1>
          <p className="text-muted-foreground mt-2">
            Create and manage users with role-based access control
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
                    <SelectItem value="viewer">
                      <div className="flex items-center gap-2">
                        <Eye className="h-4 w-4" />
                        <div>
                          <div className="font-medium">Viewer</div>
                          <div className="text-xs text-muted-foreground">Read-only access</div>
                        </div>
                      </div>
                    </SelectItem>
                    <SelectItem value="member">
                      <div className="flex items-center gap-2">
                        <Users className="h-4 w-4" />
                        <div>
                          <div className="font-medium">Member</div>
                          <div className="text-xs text-muted-foreground">Create & manage tasks</div>
                        </div>
                      </div>
                    </SelectItem>
                    <SelectItem value="project_manager">
                      <div className="flex items-center gap-2">
                        <UserCog className="h-4 w-4" />
                        <div>
                          <div className="font-medium">Project Manager</div>
                          <div className="text-xs text-muted-foreground">Manage projects & teams</div>
                        </div>
                      </div>
                    </SelectItem>
                    <SelectItem value="admin">
                      <div className="flex items-center gap-2">
                        <Shield className="h-4 w-4" />
                        <div>
                          <div className="font-medium">Admin</div>
                          <div className="text-xs text-muted-foreground">Full system access</div>
                        </div>
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
                <Alert>
                  <Info className="h-4 w-4" />
                  <AlertDescription className="text-xs">
                    {newUserRole === 'admin' && 'Full access to all features including user management'}
                    {newUserRole === 'project_manager' && 'Can manage projects, departments, and assign tasks'}
                    {newUserRole === 'member' && 'Can view projects, create tasks, and update assigned tasks'}
                    {newUserRole === 'viewer' && 'Read-only access to assigned projects and Gantt charts'}
                  </AlertDescription>
                </Alert>
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

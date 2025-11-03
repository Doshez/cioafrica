import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Loader2, UserPlus, Info, Shield, Eye, Users, UserCog, Trash2, Edit, Search, Filter, LayoutGrid, LayoutList } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import EditUserDialog from "@/components/EditUserDialog";
import PasswordResetRequestsCard from "@/components/PasswordResetRequestsCard";

interface User {
  id: string;
  email: string;
  full_name: string | null;
  roles: string[];
}

interface Project {
  id: string;
  name: string;
}

export default function UserManagement() {
  const { toast } = useToast();
  const [users, setUsers] = useState<User[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreatingUser, setIsCreatingUser] = useState(false);
  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserName, setNewUserName] = useState("");
  const [newUserRole, setNewUserRole] = useState<string>("member");
  const [selectedProjects, setSelectedProjects] = useState<string[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteUserId, setDeleteUserId] = useState<string | null>(null);
  const [editUser, setEditUser] = useState<User | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  
  // Filter and view states
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [viewMode, setViewMode] = useState<"card" | "table">("card");

  useEffect(() => {
    fetchUsers();
    fetchProjects();
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

  const fetchProjects = async () => {
    try {
      const { data: projectsData, error } = await supabase
        .from('projects')
        .select('id, name')
        .order('name');

      if (error) throw error;

      setProjects(projectsData || []);
    } catch (error: any) {
      console.error('Error fetching projects:', error);
    }
  };

  const updateUserRole = async (userId: string, role: string, action: 'add' | 'remove') => {
    try {
      if (action === 'add') {
        // Use upsert to avoid duplicate key errors
        const { error } = await supabase
          .from('user_roles')
          .upsert({ 
            user_id: userId, 
            role: role as 'admin' | 'project_manager' | 'member' | 'viewer'
          }, {
            onConflict: 'user_id,role',
            ignoreDuplicates: true
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

      // Automatically refresh the user list
      await fetchUsers();
    } catch (error: any) {
      console.error('Role update error:', error);
      toast({
        title: "Error",
        description: error.message || `Failed to ${action} role`,
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
          project_ids: selectedProjects,
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
      setSelectedProjects([]);
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

  const deleteUser = async (userId: string) => {
    try {
      // Call edge function to delete user completely
      const { data, error } = await supabase.functions.invoke('delete-user', {
        body: { user_id: userId },
      });

      if (error) throw error;

      toast({
        title: "Success",
        description: "User deleted successfully",
      });

      setDeleteUserId(null);
      fetchUsers();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to delete user",
        variant: "destructive",
      });
    }
  };

  // Filtered users based on search and role filter
  const filteredUsers = useMemo(() => {
    return users.filter(user => {
      // Search filter
      const matchesSearch = searchQuery === "" || 
        user.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        user.email.toLowerCase().includes(searchQuery.toLowerCase());
      
      // Role filter
      const matchesRole = roleFilter === "all" || user.roles.includes(roleFilter);
      
      return matchesSearch && matchesRole;
    });
  }, [users, searchQuery, roleFilter]);

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
      {/* Password Reset Requests */}
      <PasswordResetRequestsCard />
      
      {/* Header with Create User Button and Role Guide */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">User Management</h1>
          <p className="text-muted-foreground mt-2">
            Create and manage users with role-based access control
          </p>
        </div>
        
        <div className="flex gap-2">
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="outline" size="sm">
                <Info className="h-4 w-4 mr-2" />
                Role Guide
              </Button>
            </SheetTrigger>
            <SheetContent className="w-[400px] sm:w-[540px] overflow-y-auto">
              <SheetHeader>
                <SheetTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5" />
                  User Role Permissions
                </SheetTitle>
                <SheetDescription>
                  Understand what each user role can access and do in the system
                </SheetDescription>
              </SheetHeader>
              
              <div className="mt-6 space-y-4">
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
                
                <Alert>
                  <Info className="h-4 w-4" />
                  <AlertDescription className="text-xs">
                    <strong>Note:</strong> Beyond these system roles, you can also assign project-specific permissions when adding members to individual projects.
                  </AlertDescription>
                </Alert>
              </div>
            </SheetContent>
          </Sheet>

          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <UserPlus className="h-4 w-4 mr-2" />
                Create User
              </Button>
            </DialogTrigger>
            <DialogContent className="max-h-[90vh] overflow-hidden flex flex-col">
              <DialogHeader className="flex-shrink-0">
                <DialogTitle>Create New User</DialogTitle>
                <DialogDescription>
                  Create a new user account. They will receive an email with their login credentials.
                </DialogDescription>
              </DialogHeader>
              
              <div className="flex-1 overflow-y-auto py-4 px-1 space-y-4">
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

                <div className="space-y-2">
                  <Label>Assign to Projects (Optional)</Label>
                  <div className="border rounded-md p-3 max-h-[200px] overflow-y-auto space-y-2 bg-muted/20">
                    {projects.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No projects available</p>
                    ) : (
                      projects.map((project) => (
                        <div key={project.id} className="flex items-center space-x-2">
                          <Checkbox
                            id={`project-${project.id}`}
                            checked={selectedProjects.includes(project.id)}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                setSelectedProjects([...selectedProjects, project.id]);
                              } else {
                                setSelectedProjects(selectedProjects.filter(id => id !== project.id));
                              }
                            }}
                          />
                          <label
                            htmlFor={`project-${project.id}`}
                            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                          >
                            {project.name}
                          </label>
                        </div>
                      ))
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Selected projects: {selectedProjects.length}
                  </p>
                </div>
              </div>
              
              <DialogFooter className="flex-shrink-0 pt-4 border-t">
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
      </div>

      {/* Filters and Search Bar */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name or email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            
            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger className="w-full sm:w-[200px]">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Filter by role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Roles</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
                <SelectItem value="project_manager">Project Manager</SelectItem>
                <SelectItem value="member">Member</SelectItem>
                <SelectItem value="viewer">Viewer</SelectItem>
              </SelectContent>
            </Select>

            <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as "card" | "table")}>
              <TabsList>
                <TabsTrigger value="card">
                  <LayoutGrid className="h-4 w-4" />
                </TabsTrigger>
                <TabsTrigger value="table">
                  <LayoutList className="h-4 w-4" />
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
          
          <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
            <span>
              Showing {filteredUsers.length} of {users.length} users
            </span>
            {(searchQuery || roleFilter !== "all") && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSearchQuery("");
                  setRoleFilter("all");
                }}
              >
                Clear filters
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <EditUserDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        user={editUser}
        onSuccess={fetchUsers}
      />

      <AlertDialog open={!!deleteUserId} onOpenChange={() => setDeleteUserId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete User</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this user? This action cannot be undone.
              All their roles and project assignments will be removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteUserId && deleteUser(deleteUserId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Users Display */}
      {viewMode === "card" ? (
        <div className="grid gap-4">
          {filteredUsers.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <p className="text-muted-foreground">No users found matching your filters</p>
              </CardContent>
            </Card>
          ) : (
            filteredUsers.map((user) => (
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
                  <div className="flex items-center gap-2 flex-wrap">
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
                    
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setEditUser(user);
                        setEditDialogOpen(true);
                      }}
                    >
                      <Edit className="h-4 w-4 mr-2" />
                      Edit
                    </Button>
                    
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => setDeleteUserId(user.id)}
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Roles</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-12 text-muted-foreground">
                      No users found matching your filters
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredUsers.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell className="font-medium">
                        {user.full_name || user.email}
                      </TableCell>
                      <TableCell>{user.email}</TableCell>
                      <TableCell>
                        <div className="flex gap-1 flex-wrap">
                          {user.roles.map((role) => (
                            <Badge key={role} className={getRoleBadgeColor(role)} variant="outline">
                              {role.replace('_', ' ')}
                            </Badge>
                          ))}
                          {user.roles.length === 0 && (
                            <Badge variant="outline">User</Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Select
                            onValueChange={(value) => {
                              const hasRole = user.roles.includes(value);
                              updateUserRole(user.id, value, hasRole ? 'remove' : 'add');
                            }}
                          >
                            <SelectTrigger className="w-[140px] h-8">
                              <SelectValue placeholder="Role" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="admin">Admin</SelectItem>
                              <SelectItem value="project_manager">PM</SelectItem>
                              <SelectItem value="member">Member</SelectItem>
                              <SelectItem value="viewer">Viewer</SelectItem>
                            </SelectContent>
                          </Select>
                          
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              setEditUser(user);
                              setEditDialogOpen(true);
                            }}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setDeleteUserId(user.id)}
                            className="text-destructive hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

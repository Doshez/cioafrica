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
import { Loader2, UserPlus, Info, Shield, Eye, Users, UserCog, Trash2, Edit, Search, Filter, LayoutGrid, LayoutList, KeyRound, ExternalLink, Building2, FileText, AlertTriangle, UserX, CheckCircle2, Clock, XCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import EditUserDialog from "@/components/EditUserDialog";
import PasswordResetRequestsCard from "@/components/PasswordResetRequestsCard";
import { format } from "date-fns";

interface User {
  id: string;
  email: string;
  full_name: string | null;
  roles: string[];
  created_at?: string;
}

interface ExternalUser {
  id: string;
  user_id: string;
  email: string;
  full_name: string | null;
  department_id: string;
  department_name: string;
  project_id: string;
  project_name: string;
  access_level: 'view_only' | 'upload_edit' | 'edit_download';
  access_expires_at: string | null;
  is_active: boolean;
  created_at: string;
  last_activity_at: string | null;
}

interface Project {
  id: string;
  name: string;
}

interface ExternalUserImpact {
  departmentCount: number;
  documentCount: number;
  linkCount: number;
  activityCount: number;
}

const accessLevelLabels: Record<string, { label: string; color: string }> = {
  view_only: { label: 'View Only', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
  upload_edit: { label: 'Upload & Edit', color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' },
  edit_download: { label: 'Edit & Download', color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' }
};

export default function UserManagement() {
  const { toast } = useToast();
  const [users, setUsers] = useState<User[]>([]);
  const [externalUsers, setExternalUsers] = useState<ExternalUser[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingExternal, setLoadingExternal] = useState(true);
  const [isCreatingUser, setIsCreatingUser] = useState(false);
  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserName, setNewUserName] = useState("");
  const [newUserRole, setNewUserRole] = useState<string>("member");
  const [selectedProjects, setSelectedProjects] = useState<string[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteUserId, setDeleteUserId] = useState<string | null>(null);
  const [editUser, setEditUser] = useState<User | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  
  // External user delete state
  const [deleteExternalUser, setDeleteExternalUser] = useState<ExternalUser | null>(null);
  const [externalUserImpact, setExternalUserImpact] = useState<ExternalUserImpact | null>(null);
  const [loadingImpact, setLoadingImpact] = useState(false);
  const [deletingExternal, setDeletingExternal] = useState(false);
  
  // Tab state
  const [activeTab, setActiveTab] = useState<"internal" | "external">("internal");
  
  // Filter and view states
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [departmentFilter, setDepartmentFilter] = useState<string>("all");
  const [viewMode, setViewMode] = useState<"card" | "table">("table");
  const [resetRequestsOpen, setResetRequestsOpen] = useState(false);
  const [pendingResetCount, setPendingResetCount] = useState(0);

  // Department list for filters
  const [departments, setDepartments] = useState<{ id: string; name: string }[]>([]);

  useEffect(() => {
    fetchUsers();
    fetchExternalUsers();
    fetchProjects();
    fetchDepartments();
    fetchPendingResetCount();

    const channel = supabase
      .channel('password-reset-requests')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'password_reset_requests' }, () => {
        fetchPendingResetCount();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchUsers = async () => {
    try {
      // First get all external user IDs to exclude them
      const { data: externalUserData } = await supabase
        .from('external_users')
        .select('user_id');
      
      const externalUserIds = externalUserData?.map(eu => eu.user_id) || [];

      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, email, full_name, created_at')
        .order('created_at', { ascending: false });

      if (profilesError) throw profilesError;

      const { data: roles, error: rolesError } = await supabase
        .from('user_roles')
        .select('user_id, role');

      if (rolesError) throw rolesError;

      // Filter out external users from the internal users list
      const internalProfiles = profiles?.filter(p => !externalUserIds.includes(p.id)) || [];

      const usersWithRoles = internalProfiles.map(profile => ({
        ...profile,
        roles: roles?.filter(r => r.user_id === profile.id).map(r => r.role) || []
      }));

      setUsers(usersWithRoles);
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const fetchExternalUsers = async () => {
    try {
      const { data, error } = await supabase
        .from('external_users')
        .select(`
          id,
          user_id,
          email,
          full_name,
          department_id,
          project_id,
          access_level,
          access_expires_at,
          is_active,
          created_at,
          last_activity_at,
          departments(name),
          projects(name)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const formattedData: ExternalUser[] = (data || []).map(eu => ({
        id: eu.id,
        user_id: eu.user_id,
        email: eu.email,
        full_name: eu.full_name,
        department_id: eu.department_id,
        department_name: (eu.departments as any)?.name || 'Unknown',
        project_id: eu.project_id,
        project_name: (eu.projects as any)?.name || 'Unknown',
        access_level: eu.access_level,
        access_expires_at: eu.access_expires_at,
        is_active: eu.is_active,
        created_at: eu.created_at,
        last_activity_at: eu.last_activity_at
      }));

      setExternalUsers(formattedData);
    } catch (error: any) {
      console.error('Error fetching external users:', error);
    } finally {
      setLoadingExternal(false);
    }
  };

  const fetchProjects = async () => {
    try {
      const { data, error } = await supabase.from('projects').select('id, name').order('name');
      if (error) throw error;
      setProjects(data || []);
    } catch (error: any) {
      console.error('Error fetching projects:', error);
    }
  };

  const fetchDepartments = async () => {
    try {
      const { data, error } = await supabase.from('departments').select('id, name').order('name');
      if (error) throw error;
      setDepartments(data || []);
    } catch (error: any) {
      console.error('Error fetching departments:', error);
    }
  };

  const fetchPendingResetCount = async () => {
    try {
      const { count, error } = await supabase
        .from('password_reset_requests')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending');
      if (error) throw error;
      setPendingResetCount(count || 0);
    } catch (error: any) {
      console.error('Error fetching pending reset count:', error);
    }
  };

  const fetchExternalUserImpact = async (externalUser: ExternalUser) => {
    setLoadingImpact(true);
    try {
      // Get document count
      const { count: docCount } = await supabase
        .from('documents')
        .select('*', { count: 'exact', head: true })
        .eq('department_id', externalUser.department_id);

      // Get link count
      const { count: linkCount } = await supabase
        .from('document_links')
        .select('*', { count: 'exact', head: true })
        .eq('department_id', externalUser.department_id);

      // Get activity log count
      const { count: activityCount } = await supabase
        .from('external_user_activity_log')
        .select('*', { count: 'exact', head: true })
        .eq('external_user_id', externalUser.id);

      setExternalUserImpact({
        departmentCount: 1,
        documentCount: docCount || 0,
        linkCount: linkCount || 0,
        activityCount: activityCount || 0
      });
    } catch (error) {
      console.error('Error fetching impact:', error);
      setExternalUserImpact({ departmentCount: 1, documentCount: 0, linkCount: 0, activityCount: 0 });
    } finally {
      setLoadingImpact(false);
    }
  };

  const setUserRole = async (userId: string, newRole: string) => {
    try {
      const { error: deleteError } = await supabase.from('user_roles').delete().eq('user_id', userId);
      if (deleteError) throw deleteError;

      const { error: insertError } = await supabase
        .from('user_roles')
        .insert({ user_id: userId, role: newRole as 'admin' | 'project_manager' | 'member' | 'viewer' });
      if (insertError) throw insertError;

      toast({ title: "Success", description: `Role updated to ${newRole.replace('_', ' ')} successfully` });
      await fetchUsers();
    } catch (error: any) {
      toast({ title: "Error", description: error.message || 'Failed to update role', variant: "destructive" });
    }
  };

  const createUser = async () => {
    if (!newUserEmail || !newUserName || !newUserRole) {
      toast({ title: "Error", description: "Please fill in all fields", variant: "destructive" });
      return;
    }

    setIsCreatingUser(true);
    try {
      const { error } = await supabase.functions.invoke('create-user', {
        body: { email: newUserEmail, full_name: newUserName, role: newUserRole, project_ids: selectedProjects },
      });

      if (error) throw error;

      toast({ title: "Success", description: "User created and invitation email sent successfully" });
      setDialogOpen(false);
      setNewUserEmail("");
      setNewUserName("");
      setNewUserRole("member");
      setSelectedProjects([]);
      fetchUsers();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setIsCreatingUser(false);
    }
  };

  const deleteUser = async (userId: string) => {
    try {
      const { error } = await supabase.functions.invoke('delete-user', { body: { user_id: userId } });
      if (error) throw error;
      toast({ title: "Success", description: "User deleted successfully" });
      setDeleteUserId(null);
      fetchUsers();
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Failed to delete user", variant: "destructive" });
    }
  };

  const deleteExternalUserHandler = async () => {
    if (!deleteExternalUser) return;
    
    setDeletingExternal(true);
    try {
      // Delete activity logs
      await supabase
        .from('external_user_activity_log')
        .delete()
        .eq('external_user_id', deleteExternalUser.id);

      // Delete document access records
      await supabase
        .from('document_access')
        .delete()
        .eq('user_id', deleteExternalUser.user_id);

      // Delete the external user record
      await supabase
        .from('external_users')
        .delete()
        .eq('id', deleteExternalUser.id);

      // Delete the auth user via edge function
      await supabase.functions.invoke('delete-user', {
        body: { user_id: deleteExternalUser.user_id }
      });

      toast({ 
        title: "External User Deleted", 
        description: `${deleteExternalUser.full_name || deleteExternalUser.email} has been removed and all access revoked.` 
      });
      
      setDeleteExternalUser(null);
      setExternalUserImpact(null);
      fetchExternalUsers();
    } catch (error: any) {
      toast({ 
        title: "Error", 
        description: error.message || "Failed to delete external user", 
        variant: "destructive" 
      });
    } finally {
      setDeletingExternal(false);
    }
  };

  const toggleExternalUserStatus = async (externalUser: ExternalUser) => {
    try {
      const { error } = await supabase
        .from('external_users')
        .update({ is_active: !externalUser.is_active })
        .eq('id', externalUser.id);

      if (error) throw error;

      toast({ 
        title: externalUser.is_active ? "Access Disabled" : "Access Enabled",
        description: `${externalUser.full_name || externalUser.email}'s access has been ${externalUser.is_active ? 'disabled' : 'enabled'}.`
      });
      
      fetchExternalUsers();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const updateExternalUserAccess = async (externalUserId: string, newAccessLevel: string) => {
    try {
      const { error } = await supabase
        .from('external_users')
        .update({ access_level: newAccessLevel as 'view_only' | 'upload_edit' | 'edit_download' })
        .eq('id', externalUserId);

      if (error) throw error;

      toast({ title: "Success", description: "Access level updated successfully" });
      fetchExternalUsers();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  // Filtered internal users
  const filteredUsers = useMemo(() => {
    return users.filter(user => {
      const matchesSearch = searchQuery === "" || 
        user.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        user.email.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesRole = roleFilter === "all" || user.roles.includes(roleFilter);
      return matchesSearch && matchesRole;
    });
  }, [users, searchQuery, roleFilter]);

  // Filtered external users
  const filteredExternalUsers = useMemo(() => {
    return externalUsers.filter(user => {
      const matchesSearch = searchQuery === "" || 
        user.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        user.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
        user.department_name.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesStatus = statusFilter === "all" || 
        (statusFilter === "active" && user.is_active) ||
        (statusFilter === "disabled" && !user.is_active) ||
        (statusFilter === "expired" && user.access_expires_at && new Date(user.access_expires_at) < new Date());
      
      const matchesDepartment = departmentFilter === "all" || user.department_id === departmentFilter;
      
      return matchesSearch && matchesStatus && matchesDepartment;
    });
  }, [externalUsers, searchQuery, statusFilter, departmentFilter]);

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'admin': return 'bg-destructive text-destructive-foreground';
      case 'project_manager': return 'bg-primary text-primary-foreground';
      case 'member': return 'bg-blue-500 text-white';
      case 'viewer': return 'bg-gray-500 text-white';
      default: return 'bg-secondary text-secondary-foreground';
    }
  };

  const getStatusBadge = (user: ExternalUser) => {
    if (!user.is_active) {
      return <Badge variant="outline" className="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"><XCircle className="h-3 w-3 mr-1" />Disabled</Badge>;
    }
    if (user.access_expires_at && new Date(user.access_expires_at) < new Date()) {
      return <Badge variant="outline" className="bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400"><Clock className="h-3 w-3 mr-1" />Expired</Badge>;
    }
    return <Badge variant="outline" className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"><CheckCircle2 className="h-3 w-3 mr-1" />Active</Badge>;
  };

  const roleDescriptions = [
    { role: 'viewer', icon: Eye, color: 'text-gray-500', title: 'Viewer', description: 'Read-only access to assigned projects',
      permissions: ['✓ View assigned projects', '✓ View Gantt charts', '✓ View tasks and their details', '✓ View project analytics', '✗ Cannot create or edit anything', '✗ Cannot assign tasks', '✗ Cannot access admin features'] },
    { role: 'member', icon: Users, color: 'text-green-500', title: 'Member', description: 'Create & manage tasks',
      permissions: ['✓ View assigned projects', '✓ View Gantt charts', '✓ Create tasks in assigned projects', '✓ Assign tasks to team members', '✓ Update own assigned tasks', '✓ View project analytics', '✓ Add comments and attachments', '✗ Cannot create/delete projects', '✗ Cannot manage departments', '✗ Cannot access admin features'] },
    { role: 'project_manager', icon: UserCog, color: 'text-blue-500', title: 'Project Manager', description: 'Manage projects & teams',
      permissions: ['✓ Create and update projects', '✓ Create and manage departments', '✓ Create and assign tasks', '✓ Update task status and assignments', '✓ Add/remove project members', '✓ View Gantt charts', '✓ View analytics', '✗ Cannot access admin dashboard', '✗ Cannot manage user roles'] },
    { role: 'admin', icon: Shield, color: 'text-red-500', title: 'Admin', description: 'Full system access',
      permissions: ['✓ View and manage all users', '✓ Create and delete users', '✓ Assign/remove any role', '✓ Access admin dashboard', '✓ View and manage all projects', '✓ View and manage all tasks', '✓ Access analytics', '✓ Delete projects and departments'] }
  ];

  if (loading && loadingExternal) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">User Management</h1>
          <p className="text-muted-foreground mt-2">Manage internal employees and external collaborators</p>
        </div>
        
        <div className="flex gap-2">
          <Sheet open={resetRequestsOpen} onOpenChange={setResetRequestsOpen}>
            <SheetTrigger asChild>
              <Button variant="outline" size="sm" className="relative">
                <KeyRound className="h-4 w-4 mr-2" />
                Password Resets
                {pendingResetCount > 0 && (
                  <Badge variant="destructive" className="ml-2 h-5 min-w-5 rounded-full px-1.5 text-xs">{pendingResetCount}</Badge>
                )}
              </Button>
            </SheetTrigger>
            <SheetContent className="w-[400px] sm:w-[540px] overflow-y-auto">
              <SheetHeader>
                <SheetTitle>Password Reset Requests</SheetTitle>
                <SheetDescription>Manage user password reset requests</SheetDescription>
              </SheetHeader>
              <div className="mt-6"><PasswordResetRequestsCard /></div>
            </SheetContent>
          </Sheet>

          <Sheet>
            <SheetTrigger asChild>
              <Button variant="outline" size="sm"><Info className="h-4 w-4 mr-2" />Role Guide</Button>
            </SheetTrigger>
            <SheetContent className="w-[400px] sm:w-[540px] overflow-y-auto">
              <SheetHeader>
                <SheetTitle className="flex items-center gap-2"><Shield className="h-5 w-5" />User Role Permissions</SheetTitle>
                <SheetDescription>Understand what each user role can access and do in the system</SheetDescription>
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
                          <ul className="pl-8 space-y-1.5 pt-2">
                            {roleDesc.permissions.map((permission, idx) => (
                              <li key={idx} className="text-sm flex items-start gap-2">
                                <span className={permission.startsWith('✗') ? 'text-red-500' : 'text-green-500'}>{permission.slice(0, 1)}</span>
                                <span className={permission.startsWith('✗') ? 'text-muted-foreground' : ''}>{permission.slice(2)}</span>
                              </li>
                            ))}
                          </ul>
                        </AccordionContent>
                      </AccordionItem>
                    );
                  })}
                </Accordion>
              </div>
            </SheetContent>
          </Sheet>

          {activeTab === "internal" && (
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button><UserPlus className="h-4 w-4 mr-2" />Create User</Button>
              </DialogTrigger>
              <DialogContent className="max-h-[90vh] overflow-hidden flex flex-col">
                <DialogHeader className="flex-shrink-0">
                  <DialogTitle>Create New Internal User</DialogTitle>
                  <DialogDescription>Create a new employee account. They will receive an email with their login credentials.</DialogDescription>
                </DialogHeader>
                <ScrollArea className="flex-1 py-4 px-1">
                  <div className="space-y-4 pr-4">
                    <div className="space-y-2">
                      <Label htmlFor="email">Email</Label>
                      <Input id="email" type="email" placeholder="user@example.com" value={newUserEmail} onChange={(e) => setNewUserEmail(e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="name">Full Name</Label>
                      <Input id="name" type="text" placeholder="John Doe" value={newUserName} onChange={(e) => setNewUserName(e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="role">Role</Label>
                      <Select value={newUserRole} onValueChange={setNewUserRole}>
                        <SelectTrigger id="role"><SelectValue placeholder="Select role" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="viewer"><div className="flex items-center gap-2"><Eye className="h-4 w-4" /><span>Viewer</span></div></SelectItem>
                          <SelectItem value="member"><div className="flex items-center gap-2"><Users className="h-4 w-4" /><span>Member</span></div></SelectItem>
                          <SelectItem value="project_manager"><div className="flex items-center gap-2"><UserCog className="h-4 w-4" /><span>Project Manager</span></div></SelectItem>
                          <SelectItem value="admin"><div className="flex items-center gap-2"><Shield className="h-4 w-4" /><span>Admin</span></div></SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Assign to Projects (Optional)</Label>
                      <div className="border rounded-md p-3 max-h-[200px] overflow-y-auto space-y-2 bg-muted/20">
                        {projects.length === 0 ? (
                          <p className="text-sm text-muted-foreground">No projects available</p>
                        ) : (
                          projects.map((project) => (
                            <div key={project.id} className="flex items-center space-x-2">
                              <Checkbox id={`project-${project.id}`} checked={selectedProjects.includes(project.id)}
                                onCheckedChange={(checked) => {
                                  if (checked) setSelectedProjects([...selectedProjects, project.id]);
                                  else setSelectedProjects(selectedProjects.filter(id => id !== project.id));
                                }} />
                              <label htmlFor={`project-${project.id}`} className="text-sm font-medium cursor-pointer">{project.name}</label>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </div>
                </ScrollArea>
                <DialogFooter className="flex-shrink-0 pt-4 border-t">
                  <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={isCreatingUser}>Cancel</Button>
                  <Button onClick={createUser} disabled={isCreatingUser}>
                    {isCreatingUser && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Create User
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>

      {/* User Type Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => { setActiveTab(v as "internal" | "external"); setSearchQuery(""); }} className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="internal" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Internal Users
            <Badge variant="secondary" className="ml-1">{users.length}</Badge>
          </TabsTrigger>
          <TabsTrigger value="external" className="flex items-center gap-2">
            <ExternalLink className="h-4 w-4" />
            External Users
            <Badge variant="secondary" className="ml-1">{externalUsers.length}</Badge>
          </TabsTrigger>
        </TabsList>

        {/* Internal Users Tab */}
        <TabsContent value="internal" className="space-y-4 mt-6">
          {/* Filters */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input placeholder="Search by name or email..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-9" />
                </div>
                <Select value={roleFilter} onValueChange={setRoleFilter}>
                  <SelectTrigger className="w-full sm:w-[180px]"><Filter className="h-4 w-4 mr-2" /><SelectValue placeholder="Filter by role" /></SelectTrigger>
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
                    <TabsTrigger value="table"><LayoutList className="h-4 w-4" /></TabsTrigger>
                    <TabsTrigger value="card"><LayoutGrid className="h-4 w-4" /></TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>
              <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
                <span>Showing {filteredUsers.length} of {users.length} internal users</span>
                {(searchQuery || roleFilter !== "all") && (
                  <Button variant="ghost" size="sm" onClick={() => { setSearchQuery(""); setRoleFilter("all"); }}>Clear filters</Button>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Internal Users Table */}
          {viewMode === "table" ? (
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredUsers.length === 0 ? (
                      <TableRow><TableCell colSpan={4} className="text-center py-12 text-muted-foreground">No users found</TableCell></TableRow>
                    ) : (
                      filteredUsers.map((user) => (
                        <TableRow key={user.id}>
                          <TableCell className="font-medium">{user.full_name || 'No name'}</TableCell>
                          <TableCell>{user.email}</TableCell>
                          <TableCell>
                            <div className="flex gap-1 flex-wrap">
                              {user.roles.map((role) => (
                                <Badge key={role} className={getRoleBadgeColor(role)}>{role.replace('_', ' ')}</Badge>
                              ))}
                              {user.roles.length === 0 && <Badge variant="outline">No role</Badge>}
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-2">
                              <Select value={user.roles[0] || ''} onValueChange={(value) => setUserRole(user.id, value)}>
                                <SelectTrigger className="w-[130px] h-8"><SelectValue placeholder="Role" /></SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="admin">Admin</SelectItem>
                                  <SelectItem value="project_manager">PM</SelectItem>
                                  <SelectItem value="member">Member</SelectItem>
                                  <SelectItem value="viewer">Viewer</SelectItem>
                                </SelectContent>
                              </Select>
                              <Button variant="ghost" size="icon" onClick={() => { setEditUser(user); setEditDialogOpen(true); }}><Edit className="h-4 w-4" /></Button>
                              <Button variant="ghost" size="icon" onClick={() => setDeleteUserId(user.id)} className="text-destructive hover:text-destructive"><Trash2 className="h-4 w-4" /></Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {filteredUsers.map((user) => (
                <Card key={user.id}>
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="text-lg">{user.full_name || 'No name'}</CardTitle>
                        <p className="text-sm text-muted-foreground">{user.email}</p>
                      </div>
                      <div className="flex gap-1">
                        {user.roles.map((role) => <Badge key={role} className={getRoleBadgeColor(role)}>{role}</Badge>)}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="flex gap-2">
                      <Select value={user.roles[0] || ''} onValueChange={(value) => setUserRole(user.id, value)}>
                        <SelectTrigger className="flex-1"><SelectValue placeholder="Role" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="admin">Admin</SelectItem>
                          <SelectItem value="project_manager">PM</SelectItem>
                          <SelectItem value="member">Member</SelectItem>
                          <SelectItem value="viewer">Viewer</SelectItem>
                        </SelectContent>
                      </Select>
                      <Button variant="outline" size="icon" onClick={() => { setEditUser(user); setEditDialogOpen(true); }}><Edit className="h-4 w-4" /></Button>
                      <Button variant="outline" size="icon" onClick={() => setDeleteUserId(user.id)} className="text-destructive"><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* External Users Tab */}
        <TabsContent value="external" className="space-y-4 mt-6">
          {/* Filters */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input placeholder="Search by name, email, or department..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-9" />
                </div>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-full sm:w-[150px]"><SelectValue placeholder="Status" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="disabled">Disabled</SelectItem>
                    <SelectItem value="expired">Expired</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
                  <SelectTrigger className="w-full sm:w-[180px]"><Building2 className="h-4 w-4 mr-2" /><SelectValue placeholder="Department" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Departments</SelectItem>
                    {departments.map(dept => <SelectItem key={dept.id} value={dept.id}>{dept.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
                <span>Showing {filteredExternalUsers.length} of {externalUsers.length} external users</span>
                {(searchQuery || statusFilter !== "all" || departmentFilter !== "all") && (
                  <Button variant="ghost" size="sm" onClick={() => { setSearchQuery(""); setStatusFilter("all"); setDepartmentFilter("all"); }}>Clear filters</Button>
                )}
              </div>
            </CardContent>
          </Card>

          {/* External Users Table */}
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead>Department</TableHead>
                    <TableHead>Document Role</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Last Activity</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loadingExternal ? (
                    <TableRow><TableCell colSpan={6} className="text-center py-12"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></TableCell></TableRow>
                  ) : filteredExternalUsers.length === 0 ? (
                    <TableRow><TableCell colSpan={6} className="text-center py-12 text-muted-foreground">No external users found</TableCell></TableRow>
                  ) : (
                    filteredExternalUsers.map((user) => (
                      <TableRow key={user.id}>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="font-medium">{user.full_name || 'No name'}</span>
                            <span className="text-sm text-muted-foreground">{user.email}</span>
                            <Badge variant="outline" className="w-fit mt-1 text-xs">External User</Badge>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Building2 className="h-4 w-4 text-muted-foreground" />
                            <div>
                              <div className="font-medium">{user.department_name}</div>
                              <div className="text-xs text-muted-foreground">{user.project_name}</div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Select value={user.access_level} onValueChange={(v) => updateExternalUserAccess(user.id, v)}>
                            <SelectTrigger className="w-[150px] h-8">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="view_only">
                                <div className="flex items-center gap-2"><Eye className="h-3 w-3" />View Only</div>
                              </SelectItem>
                              <SelectItem value="upload_edit">
                                <div className="flex items-center gap-2"><FileText className="h-3 w-3" />Upload & Edit</div>
                              </SelectItem>
                              <SelectItem value="edit_download">
                                <div className="flex items-center gap-2"><FileText className="h-3 w-3" />Edit & Download</div>
                              </SelectItem>
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>{getStatusBadge(user)}</TableCell>
                        <TableCell>
                          <span className="text-sm text-muted-foreground">
                            {user.last_activity_at ? format(new Date(user.last_activity_at), 'MMM d, yyyy HH:mm') : 'Never'}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button variant="ghost" size="sm" onClick={() => toggleExternalUserStatus(user)}
                              className={user.is_active ? "text-orange-600 hover:text-orange-700" : "text-green-600 hover:text-green-700"}>
                              {user.is_active ? <UserX className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => { setDeleteExternalUser(user); fetchExternalUserImpact(user); }}
                              className="text-destructive hover:text-destructive">
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
        </TabsContent>
      </Tabs>

      {/* Edit User Dialog */}
      <EditUserDialog open={editDialogOpen} onOpenChange={setEditDialogOpen} user={editUser} onSuccess={fetchUsers} />

      {/* Delete Internal User Dialog */}
      <AlertDialog open={!!deleteUserId} onOpenChange={() => setDeleteUserId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete User</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this user? This action cannot be undone. All their roles and project assignments will be removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteUserId && deleteUser(deleteUserId)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete External User Dialog with Impact */}
      <AlertDialog open={!!deleteExternalUser} onOpenChange={() => { setDeleteExternalUser(null); setExternalUserImpact(null); }}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Delete External User
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-4">
                <p>You are about to permanently delete the external user:</p>
                <div className="bg-muted rounded-lg p-3">
                  <p className="font-medium">{deleteExternalUser?.full_name || deleteExternalUser?.email}</p>
                  <p className="text-sm text-muted-foreground">{deleteExternalUser?.email}</p>
                  <Badge variant="outline" className="mt-2">External User</Badge>
                </div>
                
                {loadingImpact ? (
                  <div className="flex items-center justify-center py-4">
                    <Loader2 className="h-5 w-5 animate-spin" />
                  </div>
                ) : externalUserImpact && (
                  <div className="bg-orange-50 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-800 rounded-lg p-3">
                    <p className="text-sm font-medium text-orange-800 dark:text-orange-200 mb-2">This will revoke access to:</p>
                    <ul className="text-sm text-orange-700 dark:text-orange-300 space-y-1">
                      <li>• {externalUserImpact.departmentCount} department(s)</li>
                      <li>• {externalUserImpact.documentCount} document(s)</li>
                      <li>• {externalUserImpact.linkCount} shared link(s)</li>
                      <li>• {externalUserImpact.activityCount} activity log(s) will be deleted</li>
                    </ul>
                  </div>
                )}
                
                <p className="text-sm text-muted-foreground">
                  This action is immediate and cannot be undone. The user will be blocked from logging in instantly.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletingExternal}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={deleteExternalUserHandler} disabled={deletingExternal || loadingImpact}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {deletingExternal && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Delete & Revoke Access
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

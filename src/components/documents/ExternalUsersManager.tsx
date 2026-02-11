import { useState, useCallback, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  UserPlus, Search, Users, UserX, MoreVertical, Eye, Upload, Download,
  Edit, History, Trash2, UserCheck, KeyRound, Building2, Clock, Filter
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';
import { useExternalUsers, ExternalUser, ExternalAccessLevel } from '@/hooks/useExternalUsers';
import { InviteExternalUserDialog } from './InviteExternalUserDialog';
import { EditExternalUserDialog } from './EditExternalUserDialog';
import { ExternalUserActivityDialog } from './ExternalUserActivityDialog';
import { AddToDepartmentDialog } from './AddToDepartmentDialog';

interface ExternalUsersManagerProps {
  departmentId: string;
  projectId: string;
  departmentName: string;
}

const accessLevelConfig: Record<ExternalAccessLevel, { label: string; icon: typeof Eye; color: string }> = {
  view_only: { label: 'View Only', icon: Eye, color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
  upload_edit: { label: 'Upload & Edit', icon: Upload, color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' },
  edit_download: { label: 'Edit & Download', icon: Download, color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' }
};

function getStatus(user: ExternalUser): { label: string; color: string } {
  if (!user.is_active) return { label: 'Suspended', color: 'bg-destructive/10 text-destructive' };
  if (user.access_expires_at && new Date(user.access_expires_at) < new Date()) return { label: 'Expired', color: 'bg-destructive/10 text-destructive' };
  if (user.must_change_password) return { label: 'Password Reset Sent', color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' };
  return { label: 'Active', color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' };
}

function getInitials(name: string | null, email: string) {
  if (name) return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  return email.slice(0, 2).toUpperCase();
}

export function ExternalUsersManager({ departmentId, projectId, departmentName }: ExternalUsersManagerProps) {
  const {
    externalUsers, loading, inviteExternalUser, addToDepartment, checkDuplicate,
    updateExternalUser, revokeAccess, reactivateAccess, resetPassword,
    deleteExternalUser, fetchActivityLog
  } = useExternalUsers(departmentId);

  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [activityDialogOpen, setActivityDialogOpen] = useState(false);
  const [addToDeptDialogOpen, setAddToDeptDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<ExternalUser | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'active' | 'suspended'>('active');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [showRevokeDialog, setShowRevokeDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [actionUser, setActionUser] = useState<ExternalUser | null>(null);

  const filteredUsers = useMemo(() => {
    return externalUsers.filter(user => {
      const matchesSearch =
        user.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (user.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false);

      const matchesTab = activeTab === 'active' ? user.is_active : !user.is_active;

      const status = getStatus(user).label;
      const matchesStatus = statusFilter === 'all' || status === statusFilter;
      const matchesRole = roleFilter === 'all' || user.access_level === roleFilter;

      return matchesSearch && matchesTab && matchesStatus && matchesRole;
    });
  }, [externalUsers, searchQuery, activeTab, statusFilter, roleFilter]);

  const activeCount = externalUsers.filter(u => u.is_active).length;
  const suspendedCount = externalUsers.filter(u => !u.is_active).length;

  const handleInvite = async (
    email: string, fullName: string | undefined,
    accessLevel: ExternalAccessLevel, accessExpiresAt?: string
  ) => inviteExternalUser(email, fullName, projectId, accessLevel, accessExpiresAt);

  const handleEdit = (user: ExternalUser) => { setSelectedUser(user); setEditDialogOpen(true); };

  const handleUpdate = async (
    userId: string,
    updates: { accessLevel?: ExternalAccessLevel; accessExpiresAt?: string | null }
  ) => updateExternalUser(userId, updates);

  const handleViewActivity = (user: ExternalUser) => { setSelectedUser(user); setActivityDialogOpen(true); };

  const handleResetPassword = async (user: ExternalUser) => { await resetPassword(user.id); };

  const fetchSelectedUserActivity = useCallback(() => {
    if (!selectedUser) return Promise.resolve([]);
    return fetchActivityLog(selectedUser.id);
  }, [selectedUser, fetchActivityLog]);

  const handleAddExistingUser = (user: ExternalUser) => {
    setSelectedUser(user);
    setAddToDeptDialogOpen(true);
  };

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                External Users
              </CardTitle>
              <CardDescription>
                Manage external document access for {departmentName}
              </CardDescription>
            </div>
            <Button onClick={() => setInviteDialogOpen(true)}>
              <UserPlus className="mr-2 h-4 w-4" />
              Invite External User
            </Button>
          </div>
        </CardHeader>

        <CardContent>
          {/* Search & Filters */}
          <div className="flex flex-col sm:flex-row gap-3 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search by name or email..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-9" />
            </div>
            <div className="flex gap-2">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[150px]">
                  <Filter className="mr-2 h-3.5 w-3.5" />
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="Active">Active</SelectItem>
                  <SelectItem value="Password Reset Sent">Password Reset</SelectItem>
                  <SelectItem value="Expired">Expired</SelectItem>
                  <SelectItem value="Suspended">Suspended</SelectItem>
                </SelectContent>
              </Select>
              <Select value={roleFilter} onValueChange={setRoleFilter}>
                <SelectTrigger className="w-[150px]">
                  <Filter className="mr-2 h-3.5 w-3.5" />
                  <SelectValue placeholder="Role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Roles</SelectItem>
                  <SelectItem value="view_only">View Only</SelectItem>
                  <SelectItem value="upload_edit">Upload & Edit</SelectItem>
                  <SelectItem value="edit_download">Edit & Download</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Tabs */}
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'active' | 'suspended')}>
            <TabsList className="mb-4">
              <TabsTrigger value="active" className="gap-2">
                <Users className="h-4 w-4" />
                Active ({activeCount})
              </TabsTrigger>
              <TabsTrigger value="suspended" className="gap-2">
                <UserX className="h-4 w-4" />
                Suspended ({suspendedCount})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="active" className="mt-0">
              {loading ? <TableSkeleton /> : filteredUsers.length === 0 ? (
                <EmptyState tab="active" searchQuery={searchQuery} onInvite={() => setInviteDialogOpen(true)} />
              ) : (
                <UserTable
                  users={filteredUsers}
                  departmentId={departmentId}
                  onEdit={handleEdit}
                  onViewActivity={handleViewActivity}
                  onResetPassword={handleResetPassword}
                  onRevoke={(u) => { setActionUser(u); setShowRevokeDialog(true); }}
                  onReactivate={(u) => reactivateAccess(u.id)}
                  onDelete={(u) => { setActionUser(u); setShowDeleteDialog(true); }}
                  onAddToDepartment={handleAddExistingUser}
                />
              )}
            </TabsContent>

            <TabsContent value="suspended" className="mt-0">
              {loading ? <TableSkeleton /> : filteredUsers.length === 0 ? (
                <EmptyState tab="suspended" searchQuery={searchQuery} onInvite={() => setInviteDialogOpen(true)} />
              ) : (
                <UserTable
                  users={filteredUsers}
                  departmentId={departmentId}
                  onEdit={handleEdit}
                  onViewActivity={handleViewActivity}
                  onResetPassword={handleResetPassword}
                  onRevoke={(u) => { setActionUser(u); setShowRevokeDialog(true); }}
                  onReactivate={(u) => reactivateAccess(u.id)}
                  onDelete={(u) => { setActionUser(u); setShowDeleteDialog(true); }}
                  onAddToDepartment={handleAddExistingUser}
                />
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Dialogs */}
      <InviteExternalUserDialog
        open={inviteDialogOpen}
        onOpenChange={setInviteDialogOpen}
        onInvite={handleInvite}
        checkDuplicate={checkDuplicate}
        departmentName={departmentName}
        onAddExisting={(user) => { setInviteDialogOpen(false); handleAddExistingUser(user); }}
      />
      <EditExternalUserDialog open={editDialogOpen} onOpenChange={setEditDialogOpen} user={selectedUser} onUpdate={handleUpdate} />
      <ExternalUserActivityDialog
        open={activityDialogOpen}
        onOpenChange={setActivityDialogOpen}
        userName={selectedUser?.full_name || selectedUser?.email || 'User'}
        fetchActivityLog={fetchSelectedUserActivity}
      />
      <AddToDepartmentDialog
        open={addToDeptDialogOpen}
        onOpenChange={setAddToDeptDialogOpen}
        existingUser={selectedUser}
        departmentName={departmentName}
        onAdd={addToDepartment}
      />

      {/* Revoke Dialog */}
      <AlertDialog open={showRevokeDialog} onOpenChange={setShowRevokeDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Suspend Access?</AlertDialogTitle>
            <AlertDialogDescription>
              This will immediately suspend document access for {actionUser?.full_name || actionUser?.email}. You can reactivate later.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => { if (actionUser) revokeAccess(actionUser.id); setShowRevokeDialog(false); }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Suspend
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete External User Permanently?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete {actionUser?.full_name || actionUser?.email} and all their activity history. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => { if (actionUser) deleteExternalUser(actionUser.id); setShowDeleteDialog(false); }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete Permanently
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

// --- Sub-components ---

function UserTable({ users, departmentId, onEdit, onViewActivity, onResetPassword, onRevoke, onReactivate, onDelete, onAddToDepartment }: {
  users: ExternalUser[];
  departmentId: string;
  onEdit: (u: ExternalUser) => void;
  onViewActivity: (u: ExternalUser) => void;
  onResetPassword: (u: ExternalUser) => void;
  onRevoke: (u: ExternalUser) => void;
  onReactivate: (u: ExternalUser) => void;
  onDelete: (u: ExternalUser) => void;
  onAddToDepartment: (u: ExternalUser) => void;
}) {
  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>User</TableHead>
            <TableHead className="hidden md:table-cell">Owning Dept</TableHead>
            <TableHead className="hidden lg:table-cell">Departments</TableHead>
            <TableHead>Access Level</TableHead>
            <TableHead className="hidden md:table-cell">Status</TableHead>
            <TableHead className="hidden lg:table-cell">Last Activity</TableHead>
            <TableHead className="w-[50px]"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {users.map((user) => {
            const status = getStatus(user);
            const config = accessLevelConfig[user.access_level];
            const isOwned = user.department_id === departmentId;
            const allDepts = [
              { name: user.department_name || 'Unknown', isOwner: true },
              ...(user.associated_departments || []).map(d => ({ name: d.department_name, isOwner: false }))
            ];

            return (
              <TableRow key={user.id} className={cn(!user.is_active && "opacity-60")}>
                <TableCell>
                  <div className="flex items-center gap-3">
                    <Avatar className="h-8 w-8">
                      <AvatarFallback className="bg-primary/10 text-primary text-xs">
                        {getInitials(user.full_name, user.email)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <p className="font-medium text-sm truncate">{user.full_name || user.email.split('@')[0]}</p>
                      <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                    </div>
                  </div>
                </TableCell>
                <TableCell className="hidden md:table-cell">
                  <Badge variant="outline" className="text-xs font-normal">
                    <Building2 className="mr-1 h-3 w-3" />
                    {user.department_name || 'Unknown'}
                  </Badge>
                </TableCell>
                <TableCell className="hidden lg:table-cell">
                  <div className="flex flex-wrap gap-1">
                    {allDepts.map((d, i) => (
                      <Badge key={i} variant={d.isOwner ? "default" : "secondary"} className="text-xs font-normal">
                        {d.name}
                      </Badge>
                    ))}
                  </div>
                </TableCell>
                <TableCell>
                  <div className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium", config.color)}>
                    <config.icon className="h-3 w-3" />
                    {config.label}
                  </div>
                </TableCell>
                <TableCell className="hidden md:table-cell">
                  <div className={cn("inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium", status.color)}>
                    {status.label}
                  </div>
                </TableCell>
                <TableCell className="hidden lg:table-cell">
                  <span className="text-xs text-muted-foreground">
                    {user.last_activity_at
                      ? formatDistanceToNow(new Date(user.last_activity_at), { addSuffix: true })
                      : 'Never'}
                  </span>
                </TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => onEdit(user)}>
                        <Edit className="mr-2 h-4 w-4" />
                        Edit Permissions
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => onViewActivity(user)}>
                        <History className="mr-2 h-4 w-4" />
                        View Activity
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => onResetPassword(user)}>
                        <KeyRound className="mr-2 h-4 w-4" />
                        Reset Password
                      </DropdownMenuItem>
                      {!isOwned && (
                        <DropdownMenuItem onClick={() => onAddToDepartment(user)}>
                          <Building2 className="mr-2 h-4 w-4" />
                          Manage Department Access
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuSeparator />
                      {user.is_active ? (
                        <DropdownMenuItem onClick={() => onRevoke(user)} className="text-destructive focus:text-destructive">
                          <UserX className="mr-2 h-4 w-4" />
                          Suspend Access
                        </DropdownMenuItem>
                      ) : (
                        <DropdownMenuItem onClick={() => onReactivate(user)}>
                          <UserCheck className="mr-2 h-4 w-4" />
                          Reactivate Access
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem onClick={() => onDelete(user)} className="text-destructive focus:text-destructive">
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete Permanently
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

function TableSkeleton() {
  return (
    <div className="space-y-3">
      {[1, 2, 3].map((i) => (
        <div key={i} className="flex items-center gap-4 p-4 border rounded-md">
          <Skeleton className="h-8 w-8 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-3 w-1/2" />
          </div>
          <Skeleton className="h-5 w-20" />
        </div>
      ))}
    </div>
  );
}

function EmptyState({ tab, searchQuery, onInvite }: { tab: string; searchQuery: string; onInvite: () => void }) {
  const Icon = tab === 'active' ? Users : UserX;
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <Icon className="h-12 w-12 text-muted-foreground/50 mb-4" />
      <h3 className="font-medium">No {tab === 'active' ? 'active' : 'suspended'} external users</h3>
      <p className="text-sm text-muted-foreground mt-1">
        {searchQuery ? 'No users match your search' : tab === 'active' ? 'Invite external stakeholders to access documents' : 'Suspended users will appear here'}
      </p>
      {!searchQuery && tab === 'active' && (
        <Button variant="outline" className="mt-4" onClick={onInvite}>
          <UserPlus className="mr-2 h-4 w-4" />
          Invite First User
        </Button>
      )}
    </div>
  );
}

import { useState, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { UserPlus, Search, Users, UserX } from 'lucide-react';
import { useExternalUsers, ExternalUser } from '@/hooks/useExternalUsers';
import { ExternalUserCard } from './ExternalUserCard';
import { InviteExternalUserDialog } from './InviteExternalUserDialog';
import { EditExternalUserDialog } from './EditExternalUserDialog';
import { ExternalUserActivityDialog } from './ExternalUserActivityDialog';

interface ExternalUsersManagerProps {
  departmentId: string;
  projectId: string;
  departmentName: string;
}

export function ExternalUsersManager({
  departmentId,
  projectId,
  departmentName
}: ExternalUsersManagerProps) {
  const {
    externalUsers,
    loading,
    inviteExternalUser,
    updateExternalUser,
    revokeAccess,
    reactivateAccess,
    fetchActivityLog
  } = useExternalUsers(departmentId);

  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [activityDialogOpen, setActivityDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<ExternalUser | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'active' | 'revoked'>('active');

  const filteredUsers = externalUsers.filter(user => {
    const matchesSearch = 
      user.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (user.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false);
    
    if (activeTab === 'active') {
      return matchesSearch && user.is_active;
    } else {
      return matchesSearch && !user.is_active;
    }
  });

  const activeCount = externalUsers.filter(u => u.is_active).length;
  const revokedCount = externalUsers.filter(u => !u.is_active).length;

  const handleInvite = async (
    email: string,
    fullName: string | undefined,
    accessLevel: 'view_only' | 'upload_edit' | 'edit_download',
    accessExpiresAt?: string
  ) => {
    return inviteExternalUser(email, fullName, projectId, accessLevel, accessExpiresAt);
  };

  const handleEdit = (user: ExternalUser) => {
    setSelectedUser(user);
    setEditDialogOpen(true);
  };

  const handleUpdate = async (
    userId: string,
    updates: { accessLevel?: 'view_only' | 'upload_edit' | 'edit_download'; accessExpiresAt?: string | null }
  ) => {
    return updateExternalUser(userId, updates);
  };

  const handleViewActivity = (userId: string) => {
    const user = externalUsers.find(u => u.id === userId);
    if (user) {
      setSelectedUser(user);
      setActivityDialogOpen(true);
    }
  };

  const fetchSelectedUserActivity = useCallback(() => {
    if (!selectedUser) return Promise.resolve([]);
    return fetchActivityLog(selectedUser.id);
  }, [selectedUser, fetchActivityLog]);

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                External Document Access
              </CardTitle>
              <CardDescription>
                Manage external users who can access documents in {departmentName}
              </CardDescription>
            </div>
            <Button onClick={() => setInviteDialogOpen(true)}>
              <UserPlus className="mr-2 h-4 w-4" />
              Invite External User
            </Button>
          </div>
        </CardHeader>
        
        <CardContent>
          {/* Search */}
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name or email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          
          {/* Tabs */}
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'active' | 'revoked')}>
            <TabsList className="mb-4">
              <TabsTrigger value="active" className="gap-2">
                <Users className="h-4 w-4" />
                Active ({activeCount})
              </TabsTrigger>
              <TabsTrigger value="revoked" className="gap-2">
                <UserX className="h-4 w-4" />
                Revoked ({revokedCount})
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="active" className="mt-0">
              {loading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <Card key={i}>
                      <CardContent className="p-4">
                        <div className="flex items-start gap-4">
                          <Skeleton className="h-10 w-10 rounded-full" />
                          <div className="flex-1 space-y-2">
                            <Skeleton className="h-4 w-1/3" />
                            <Skeleton className="h-3 w-1/2" />
                            <Skeleton className="h-5 w-24" />
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : filteredUsers.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <Users className="h-12 w-12 text-muted-foreground/50 mb-4" />
                  <h3 className="font-medium">No active external users</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    {searchQuery 
                      ? 'No users match your search'
                      : 'Invite external stakeholders to access documents'}
                  </p>
                  {!searchQuery && (
                    <Button 
                      variant="outline" 
                      className="mt-4"
                      onClick={() => setInviteDialogOpen(true)}
                    >
                      <UserPlus className="mr-2 h-4 w-4" />
                      Invite First User
                    </Button>
                  )}
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredUsers.map((user) => (
                    <ExternalUserCard
                      key={user.id}
                      user={user}
                      onEdit={handleEdit}
                      onRevoke={revokeAccess}
                      onReactivate={reactivateAccess}
                      onViewActivity={handleViewActivity}
                    />
                  ))}
                </div>
              )}
            </TabsContent>
            
            <TabsContent value="revoked" className="mt-0">
              {loading ? (
                <div className="space-y-3">
                  {[1, 2].map((i) => (
                    <Card key={i}>
                      <CardContent className="p-4">
                        <div className="flex items-start gap-4">
                          <Skeleton className="h-10 w-10 rounded-full" />
                          <div className="flex-1 space-y-2">
                            <Skeleton className="h-4 w-1/3" />
                            <Skeleton className="h-3 w-1/2" />
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : filteredUsers.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <UserX className="h-12 w-12 text-muted-foreground/50 mb-4" />
                  <h3 className="font-medium">No revoked users</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    {searchQuery 
                      ? 'No users match your search'
                      : 'Revoked users will appear here'}
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredUsers.map((user) => (
                    <ExternalUserCard
                      key={user.id}
                      user={user}
                      onEdit={handleEdit}
                      onRevoke={revokeAccess}
                      onReactivate={reactivateAccess}
                      onViewActivity={handleViewActivity}
                    />
                  ))}
                </div>
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
      />
      
      <EditExternalUserDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        user={selectedUser}
        onUpdate={handleUpdate}
      />
      
      <ExternalUserActivityDialog
        open={activityDialogOpen}
        onOpenChange={setActivityDialogOpen}
        userName={selectedUser?.full_name || selectedUser?.email || 'User'}
        fetchActivityLog={fetchSelectedUserActivity}
      />
    </>
  );
}

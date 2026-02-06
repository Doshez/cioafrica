import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
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
  MoreVertical, 
  Eye, 
  Upload, 
  Download, 
  Clock, 
  UserX, 
  UserCheck,
  History,
  Edit
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { ExternalUser, ExternalAccessLevel } from '@/hooks/useExternalUsers';
import { cn } from '@/lib/utils';

interface ExternalUserCardProps {
  user: ExternalUser;
  onEdit: (user: ExternalUser) => void;
  onRevoke: (userId: string) => void;
  onReactivate: (userId: string) => void;
  onViewActivity: (userId: string) => void;
}

const accessLevelConfig: Record<ExternalAccessLevel, { label: string; icon: typeof Eye; color: string }> = {
  view_only: { label: 'View Only', icon: Eye, color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
  upload_edit: { label: 'Upload & Edit', icon: Upload, color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' },
  edit_download: { label: 'Edit & Download', icon: Download, color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' }
};

export function ExternalUserCard({
  user,
  onEdit,
  onRevoke,
  onReactivate,
  onViewActivity
}: ExternalUserCardProps) {
  const [showRevokeDialog, setShowRevokeDialog] = useState(false);
  
  const config = accessLevelConfig[user.access_level];
  const isExpired = user.access_expires_at && new Date(user.access_expires_at) < new Date();
  const isInactive = !user.is_active;
  
  const getInitials = (name: string | null, email: string) => {
    if (name) {
      return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    }
    return email.slice(0, 2).toUpperCase();
  };

  return (
    <>
      <Card className={cn(
        "transition-colors",
        (isInactive || isExpired) && "opacity-60"
      )}>
        <CardContent className="p-4">
          <div className="flex items-start gap-4">
            {/* Avatar */}
            <Avatar className="h-10 w-10">
              <AvatarFallback className="bg-primary/10 text-primary">
                {getInitials(user.full_name, user.email)}
              </AvatarFallback>
            </Avatar>
            
            {/* User Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h4 className="font-medium truncate">
                  {user.full_name || user.email.split('@')[0]}
                </h4>
                {isInactive && (
                  <Badge variant="secondary" className="text-xs">Revoked</Badge>
                )}
                {isExpired && !isInactive && (
                  <Badge variant="destructive" className="text-xs">Expired</Badge>
                )}
              </div>
              
              <p className="text-sm text-muted-foreground truncate">{user.email}</p>
              
              <div className="flex flex-wrap items-center gap-2 mt-2">
                {/* Access Level Badge */}
                <div className={cn(
                  "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium",
                  config.color
                )}>
                  <config.icon className="h-3 w-3" />
                  {config.label}
                </div>
                
                {/* Expiry Info */}
                {user.access_expires_at && (
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    {isExpired 
                      ? `Expired ${formatDistanceToNow(new Date(user.access_expires_at))} ago`
                      : `Expires ${format(new Date(user.access_expires_at), 'MMM d, yyyy')}`
                    }
                  </div>
                )}
              </div>
              
              {/* Last Activity */}
              <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                <span>
                  Invited by {user.invited_by_name || 'Unknown'} on {format(new Date(user.created_at), 'MMM d, yyyy')}
                </span>
                {user.last_activity_at && (
                  <span>
                    Last active {formatDistanceToNow(new Date(user.last_activity_at))} ago
                  </span>
                )}
              </div>
            </div>
            
            {/* Actions */}
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
                <DropdownMenuItem onClick={() => onViewActivity(user.id)}>
                  <History className="mr-2 h-4 w-4" />
                  View Activity
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                {user.is_active ? (
                  <DropdownMenuItem
                    onClick={() => setShowRevokeDialog(true)}
                    className="text-destructive focus:text-destructive"
                  >
                    <UserX className="mr-2 h-4 w-4" />
                    Revoke Access
                  </DropdownMenuItem>
                ) : (
                  <DropdownMenuItem onClick={() => onReactivate(user.id)}>
                    <UserCheck className="mr-2 h-4 w-4" />
                    Reactivate Access
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </CardContent>
      </Card>
      
      {/* Revoke Confirmation Dialog */}
      <AlertDialog open={showRevokeDialog} onOpenChange={setShowRevokeDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revoke Access?</AlertDialogTitle>
            <AlertDialogDescription>
              This will immediately revoke document access for {user.full_name || user.email}. 
              They will receive an email notification. You can reactivate their access later if needed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                onRevoke(user.id);
                setShowRevokeDialog(false);
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Revoke Access
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

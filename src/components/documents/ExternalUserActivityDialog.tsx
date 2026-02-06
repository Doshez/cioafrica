import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  Eye, 
  Download, 
  Upload, 
  Trash2, 
  Edit, 
  FolderOpen,
  UserPlus,
  UserX,
  RefreshCw
} from 'lucide-react';
import { format } from 'date-fns';
import { ExternalUserActivityLog } from '@/hooks/useExternalUsers';
import { cn } from '@/lib/utils';

interface ExternalUserActivityDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userName: string;
  fetchActivityLog: () => Promise<ExternalUserActivityLog[]>;
}

const actionConfig: Record<string, { icon: typeof Eye; label: string; color: string }> = {
  view: { icon: Eye, label: 'Viewed', color: 'text-blue-600' },
  download: { icon: Download, label: 'Downloaded', color: 'text-green-600' },
  upload: { icon: Upload, label: 'Uploaded', color: 'text-amber-600' },
  edit: { icon: Edit, label: 'Edited', color: 'text-purple-600' },
  delete: { icon: Trash2, label: 'Deleted', color: 'text-red-600' },
  folder_access: { icon: FolderOpen, label: 'Accessed Folder', color: 'text-blue-600' },
  invited: { icon: UserPlus, label: 'Invited', color: 'text-green-600' },
  access_revoked: { icon: UserX, label: 'Access Revoked', color: 'text-red-600' },
  access_updated: { icon: RefreshCw, label: 'Access Updated', color: 'text-amber-600' }
};

export function ExternalUserActivityDialog({
  open,
  onOpenChange,
  userName,
  fetchActivityLog
}: ExternalUserActivityDialogProps) {
  const [activities, setActivities] = useState<ExternalUserActivityLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (open) {
      setLoading(true);
      fetchActivityLog().then((data) => {
        setActivities(data);
        setLoading(false);
      });
    }
  }, [open, fetchActivityLog]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Activity Log</DialogTitle>
          <DialogDescription>
            Recent activity for {userName}
          </DialogDescription>
        </DialogHeader>
        
        <ScrollArea className="h-[400px] pr-4">
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="flex gap-3 p-3 rounded-lg border">
                  <Skeleton className="h-8 w-8 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-3 w-1/2" />
                  </div>
                </div>
              ))}
            </div>
          ) : activities.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Eye className="h-12 w-12 text-muted-foreground/50 mb-4" />
              <p className="text-muted-foreground">No activity recorded yet</p>
            </div>
          ) : (
            <div className="space-y-2">
              {activities.map((activity) => {
                const config = actionConfig[activity.action] || actionConfig.view;
                const Icon = config.icon;
                
                return (
                  <div
                    key={activity.id}
                    className="flex gap-3 p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
                  >
                    <div className={cn(
                      "h-8 w-8 rounded-full flex items-center justify-center bg-muted",
                      config.color
                    )}>
                      <Icon className="h-4 w-4" />
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary" className="text-xs">
                          {config.label}
                        </Badge>
                        {activity.document_name && (
                          <span className="text-sm font-medium truncate">
                            {activity.document_name}
                          </span>
                        )}
                        {activity.folder_name && (
                          <span className="text-sm font-medium truncate">
                            {activity.folder_name}
                          </span>
                        )}
                      </div>
                      
                      <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                        <span>{format(new Date(activity.created_at), 'MMM d, yyyy h:mm a')}</span>
                        {activity.ip_address && (
                          <>
                            <span>•</span>
                            <span>IP: {activity.ip_address}</span>
                          </>
                        )}
                      </div>
                      
                      {activity.details && typeof activity.details === 'object' && Object.keys(activity.details).length > 0 && (
                        <div className="mt-2 text-xs text-muted-foreground bg-muted/50 p-2 rounded">
                          <pre className="whitespace-pre-wrap">
                            {JSON.stringify(activity.details, null, 2)}
                          </pre>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

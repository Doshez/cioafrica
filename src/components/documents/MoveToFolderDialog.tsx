import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Folder, ChevronRight, Home, ArrowLeft } from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';

interface MoveToFolderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  itemType: 'folder' | 'document' | 'link';
  itemId: string;
  itemName: string;
  currentFolderId: string | null;
  projectId: string;
  departmentId: string;
  onMove: (targetFolderId: string | null) => Promise<void>;
}

interface FolderItem {
  id: string;
  name: string;
  parent_folder_id: string | null;
}

export function MoveToFolderDialog({
  open,
  onOpenChange,
  itemType,
  itemId,
  itemName,
  currentFolderId,
  projectId,
  departmentId,
  onMove,
}: MoveToFolderDialogProps) {
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [browseFolderId, setBrowseFolderId] = useState<string | null>(null);
  const [isMoving, setIsMoving] = useState(false);

  // Reset state when dialog opens
  useEffect(() => {
    if (open) {
      setSelectedFolderId(null);
      setBrowseFolderId(null);
    }
  }, [open]);

  // Fetch folders for current browse location
  const { data: folders = [], isLoading } = useQuery({
    queryKey: ['move-folders', projectId, departmentId, browseFolderId],
    queryFn: async () => {
      let query = supabase
        .from('document_folders')
        .select('id, name, parent_folder_id')
        .eq('project_id', projectId)
        .eq('department_id', departmentId);

      if (browseFolderId) {
        query = query.eq('parent_folder_id', browseFolderId);
      } else {
        query = query.is('parent_folder_id', null);
      }

      // Exclude the item itself if it's a folder
      if (itemType === 'folder') {
        query = query.neq('id', itemId);
      }

      const { data } = await query.order('name');
      return (data || []) as FolderItem[];
    },
    enabled: open,
  });

  // Fetch breadcrumb path
  const { data: breadcrumbs = [] } = useQuery({
    queryKey: ['move-breadcrumbs', projectId, departmentId, browseFolderId],
    queryFn: async () => {
      const crumbs: { id: string | null; name: string }[] = [{ id: null, name: 'Department Root' }];
      
      if (!browseFolderId) return crumbs;

      let folderId: string | null = browseFolderId;
      const folderPath: { id: string; name: string }[] = [];

      while (folderId) {
        const { data: folder } = await supabase
          .from('document_folders')
          .select('id, name, parent_folder_id')
          .eq('id', folderId)
          .single();

        if (folder) {
          folderPath.unshift({ id: folder.id, name: folder.name });
          folderId = folder.parent_folder_id;
        } else {
          break;
        }
      }

      return [...crumbs, ...folderPath];
    },
    enabled: open,
  });

  const handleMove = async () => {
    setIsMoving(true);
    try {
      await onMove(selectedFolderId);
      onOpenChange(false);
    } finally {
      setIsMoving(false);
    }
  };

  const isSameLocation = selectedFolderId === currentFolderId;
  const isSelectingDepartmentRoot = selectedFolderId === null && currentFolderId !== null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Move {itemType}</DialogTitle>
          <DialogDescription>
            Select a folder to move "{itemName}" to, or choose Department Root to move it to the top level.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Breadcrumbs */}
          <div className="flex items-center gap-1 text-sm flex-wrap">
            {breadcrumbs.map((crumb, index) => (
              <div key={crumb.id || 'root'} className="flex items-center">
                {index > 0 && <ChevronRight className="h-3 w-3 mx-1 text-muted-foreground" />}
                <button
                  onClick={() => setBrowseFolderId(crumb.id)}
                  className={cn(
                    "hover:text-primary transition-colors text-xs",
                    index === breadcrumbs.length - 1 ? "font-medium" : "text-muted-foreground"
                  )}
                >
                  {crumb.name}
                </button>
              </div>
            ))}
          </div>

          {/* Department Root option */}
          <div
            className={cn(
              "flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all",
              selectedFolderId === null
                ? "border-primary bg-primary/5 ring-2 ring-primary"
                : "hover:bg-accent/50"
            )}
            onClick={() => setSelectedFolderId(null)}
          >
            <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30">
              <Home className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div className="flex-1">
              <p className="font-medium text-sm">Department Root</p>
              <p className="text-xs text-muted-foreground">Move to top level of this department</p>
            </div>
          </div>

          {/* Back button */}
          {browseFolderId && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                const parentCrumb = breadcrumbs[breadcrumbs.length - 2];
                setBrowseFolderId(parentCrumb?.id ?? null);
              }}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
          )}

          {/* Folder list */}
          <ScrollArea className="h-[200px] border rounded-lg">
            <div className="p-2 space-y-1">
              {isLoading ? (
                <div className="flex items-center justify-center py-8 text-muted-foreground">
                  Loading folders...
                </div>
              ) : folders.length === 0 ? (
                <div className="flex items-center justify-center py-8 text-muted-foreground text-sm">
                  No subfolders in this location
                </div>
              ) : (
                folders.map((folder) => (
                  <div
                    key={folder.id}
                    className={cn(
                      "flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-all group",
                      selectedFolderId === folder.id
                        ? "bg-primary/10 border border-primary"
                        : "hover:bg-accent/50"
                    )}
                  >
                    <div 
                      className="flex items-center gap-3 flex-1"
                      onClick={() => setSelectedFolderId(folder.id)}
                    >
                      <div className="p-1.5 rounded-md bg-amber-100 dark:bg-amber-900/30">
                        <Folder className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                      </div>
                      <span className="text-sm font-medium">{folder.name}</span>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 opacity-0 group-hover:opacity-100"
                      onClick={(e) => {
                        e.stopPropagation();
                        setBrowseFolderId(folder.id);
                      }}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
        </div>

        <DialogFooter className="flex gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button 
            onClick={handleMove} 
            disabled={isMoving || isSameLocation}
          >
            {isMoving ? 'Moving...' : isSelectingDepartmentRoot ? 'Move to Root' : 'Move Here'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

import { useEffect, useState, useRef } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { Calendar, Clock, User, Percent, Save, X, Loader2, Trash2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { SearchableUserSelect } from '@/components/SearchableUserSelect';
import { useToast } from '@/hooks/use-toast';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import type { TaskWithProfile } from './types';

interface UserProfile {
  id: string;
  full_name: string | null;
  email: string;
}

interface TaskDetailDrawerProps {
  task: TaskWithProfile | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onTaskUpdated?: () => void;
  onUpdate?: (updates: Partial<TaskWithProfile>) => void;
  onDelete?: (taskId: string) => void;
  canEdit?: boolean;
  canDelete?: boolean;
}

export function TaskDetailDrawer({ 
  task, 
  open, 
  onOpenChange, 
  onTaskUpdated,
  onUpdate,
  onDelete,
  canEdit = true,
  canDelete = true
}: TaskDetailDrawerProps) {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [dataLoading, setDataLoading] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const loadedTaskIdRef = useRef<string | null>(null);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    status: 'todo',
    priority: 'medium',
    progress_percentage: 0,
    start_date: '',
    due_date: '',
    estimate_hours: '',
  });

  useEffect(() => {
    if (task) {
      setFormData({
        title: task.title || '',
        description: task.description || '',
        status: task.status || 'todo',
        priority: task.priority || 'medium',
        progress_percentage: task.progress_percentage || 0,
        start_date: task.start_date || '',
        due_date: task.due_date || '',
        estimate_hours: task.estimate_hours?.toString() || '',
      });
    }
  }, [task]);

  // Fetch users and task assignments when drawer opens
  useEffect(() => {
    if (!open || !task?.id) {
      return;
    }
    
    if (loadedTaskIdRef.current === task.id) {
      return;
    }
    
    loadedTaskIdRef.current = task.id;
    
    const loadData = async () => {
      setDataLoading(true);
      try {
        const [usersResult, assignmentsResult] = await Promise.all([
          supabase.from('profiles').select('id, full_name, email').order('full_name'),
          supabase.from('task_assignments').select('user_id').eq('task_id', task.id)
        ]);

        if (usersResult.error) throw usersResult.error;
        if (assignmentsResult.error) throw assignmentsResult.error;

        setUsers(usersResult.data || []);
        const assignedIds = (assignmentsResult.data || []).map(a => a.user_id).filter(Boolean) as string[];
        setSelectedUserIds(assignedIds);
      } catch (error) {
        console.error('Error loading task data:', error);
      } finally {
        setDataLoading(false);
      }
    };

    loadData();
  }, [open, task?.id]);

  // Reset loaded task ref when drawer closes
  useEffect(() => {
    if (!open) {
      loadedTaskIdRef.current = null;
    }
  }, [open]);


  const handleSave = async () => {
    if (!task) return;
    
    setSaving(true);
    try {
      // Sync status with progress
      let status = formData.status;
      let progress = formData.progress_percentage;
      
      if (progress === 0 && status !== 'todo') {
        status = 'todo';
      } else if (progress > 0 && progress < 100 && status !== 'in_progress') {
        status = 'in_progress';
      } else if (progress === 100 && status !== 'done') {
        status = 'done';
      }

      const { error } = await supabase
        .from('tasks')
        .update({
          title: formData.title,
          description: formData.description || null,
          status,
          priority: formData.priority,
          progress_percentage: progress,
          start_date: formData.start_date || null,
          due_date: formData.due_date || null,
          estimate_hours: formData.estimate_hours ? parseFloat(formData.estimate_hours) : null,
          completed_at: status === 'done' ? new Date().toISOString() : null,
        })
        .eq('id', task.id);

      if (error) throw error;

      // Update task assignments
      const { error: deleteError } = await supabase
        .from('task_assignments')
        .delete()
        .eq('task_id', task.id);

      if (deleteError) throw deleteError;

      if (selectedUserIds.length > 0) {
        const assignments = selectedUserIds.map(userId => ({
          task_id: task.id,
          user_id: userId,
        }));
        
        const { error: assignError } = await supabase
          .from('task_assignments')
          .insert(assignments);

        if (assignError) throw assignError;
      }

      toast({ title: 'Success', description: `Task updated with ${selectedUserIds.length} assigned user(s)` });
      
      // Call the appropriate callback
      if (onUpdate) {
        onUpdate({
          title: formData.title,
          description: formData.description || undefined,
          status,
          priority: formData.priority,
          progress_percentage: progress,
          start_date: formData.start_date || '',
          due_date: formData.due_date || '',
          estimate_hours: formData.estimate_hours ? parseFloat(formData.estimate_hours) : undefined,
        });
      }
      if (onTaskUpdated) {
        onTaskUpdated();
      }
      onOpenChange(false);
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleProgressChange = (value: number[]) => {
    const progress = value[0];
    let status = formData.status;
    
    if (progress === 0) status = 'todo';
    else if (progress === 100) status = 'done';
    else status = 'in_progress';
    
    setFormData(prev => ({ ...prev, progress_percentage: progress, status }));
  };

  const handleStatusChange = (status: string) => {
    let progress = formData.progress_percentage;
    
    if (status === 'todo') progress = 0;
    else if (status === 'done') progress = 100;
    else if (status === 'in_progress' && progress === 0) progress = 1;
    
    setFormData(prev => ({ ...prev, status, progress_percentage: progress }));
  };

  const handleDelete = async () => {
    if (!task) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from('tasks')
        .delete()
        .eq('id', task.id);

      if (error) throw error;

      toast({ title: 'Success', description: 'Task deleted successfully' });
      if (onDelete) {
        onDelete(task.id);
      }
      if (onTaskUpdated) {
        onTaskUpdated();
      }
      setShowDeleteDialog(false);
      onOpenChange(false);
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const isOverdue = task?.due_date && task.status !== 'done' && new Date(task.due_date) < new Date();

  return (
    <>
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            Task Details
            {isOverdue && <Badge variant="destructive">Overdue</Badge>}
          </SheetTitle>
          <SheetDescription>
            {canEdit ? 'Edit task details below' : 'View task details'}
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-6 py-6">
          {/* Title */}
          <div className="space-y-2">
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              value={formData.title}
              onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
              disabled={!canEdit}
            />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              disabled={!canEdit}
              rows={3}
            />
          </div>

          {/* Status & Priority */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Status</Label>
              <Select 
                value={formData.status} 
                onValueChange={handleStatusChange}
                disabled={!canEdit}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todo">To Do</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="done">Done</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Priority</Label>
              <Select 
                value={formData.priority} 
                onValueChange={(v) => setFormData(prev => ({ ...prev, priority: v }))}
                disabled={!canEdit}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Progress */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="flex items-center gap-2">
                <Percent className="h-4 w-4" />
                Progress
              </Label>
              <span className="text-lg font-semibold">{formData.progress_percentage}%</span>
            </div>
            <Slider
              value={[formData.progress_percentage]}
              onValueChange={handleProgressChange}
              max={100}
              step={1}
              disabled={!canEdit}
            />
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Start Date
              </Label>
              <Input
                type="date"
                value={formData.start_date}
                onChange={(e) => setFormData(prev => ({ ...prev, start_date: e.target.value }))}
                disabled={!canEdit}
              />
            </div>
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Due Date
              </Label>
              <Input
                type="date"
                value={formData.due_date}
                onChange={(e) => setFormData(prev => ({ ...prev, due_date: e.target.value }))}
                disabled={!canEdit}
              />
            </div>
          </div>

          {/* Estimate Hours */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Estimated Hours
            </Label>
            <Input
              type="number"
              value={formData.estimate_hours}
              onChange={(e) => setFormData(prev => ({ ...prev, estimate_hours: e.target.value }))}
              disabled={!canEdit}
              placeholder="e.g., 8"
            />
          </div>

          {/* Assigned Users - Editable with Search */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <User className="h-4 w-4" />
              Assign To (Multiple Users)
            </Label>
            {dataLoading ? (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-sm">Loading users...</span>
              </div>
            ) : canEdit ? (
              <SearchableUserSelect
                users={users}
                selectedUserIds={selectedUserIds}
                onSelectionChange={setSelectedUserIds}
                placeholder="Search by name or email..."
              />
            ) : (
              <div className="border rounded-md p-3 space-y-2 max-h-48 overflow-y-auto bg-background">
                {users.filter(u => selectedUserIds.includes(u.id)).map((user) => (
                  <div key={user.id} className="flex items-center gap-3 p-2 rounded">
                    <span className="text-sm">{user.full_name || user.email}</span>
                  </div>
                ))}
                {selectedUserIds.length === 0 && (
                  <p className="text-sm text-muted-foreground">No users assigned</p>
                )}
              </div>
            )}
          </div>

          {/* Element */}
          {task?.element_name && (
            <div className="space-y-2">
              <Label>Element</Label>
              <Badge variant="outline">{task.element_name}</Badge>
            </div>
          )}

          {/* Actions */}
          {canEdit && (
            <div className="flex justify-between pt-4">
              {canDelete && (
                <Button
                  variant="destructive"
                  onClick={() => setShowDeleteDialog(true)}
                  disabled={saving}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete
                </Button>
              )}
              <div className="flex gap-2 ml-auto">
                <Button variant="outline" onClick={() => onOpenChange(false)}>
                  <X className="h-4 w-4 mr-2" />
                  Cancel
                </Button>
                <Button onClick={handleSave} disabled={saving}>
                  {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                  {saving ? 'Saving...' : 'Save Changes'}
                </Button>
              </div>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>

    <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete Task</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to delete this task? This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={saving}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            disabled={saving}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    </>
  );
}

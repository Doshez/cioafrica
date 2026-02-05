import { useState, useEffect, useCallback, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Trash2 } from 'lucide-react';
import { SearchableUserSelect } from '@/components/SearchableUserSelect';
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

interface EditTaskDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task: {
    id: string;
    title: string;
    assignee_user_id?: string;
    element_id?: string;
    project_id?: string;
    assignee_department_id?: string;
    estimated_cost?: number;
    actual_cost?: number;
    start_date?: string;
    due_date?: string;
  } | null;
  onSuccess: () => void;
}

interface User {
  id: string;
  full_name: string;
  email: string;
}

interface Element {
  id: string;
  title: string;
}

export function EditTaskDialog({ open, onOpenChange, task, onSuccess }: EditTaskDialogProps) {
  const [title, setTitle] = useState('');
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [elementId, setElementId] = useState<string>('');
  const [estimatedCost, setEstimatedCost] = useState<string>('0');
  const [actualCost, setActualCost] = useState<string>('0');
  const [startDate, setStartDate] = useState<string>('');
  const [dueDate, setDueDate] = useState<string>('');
  const [users, setUsers] = useState<User[]>([]);
  const [elements, setElements] = useState<Element[]>([]);
  const [loading, setLoading] = useState(false);
  const [dataLoading, setDataLoading] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const { toast } = useToast();
  
  // Track the task ID we've loaded data for to prevent redundant fetches
  const loadedTaskIdRef = useRef<string | null>(null);

  // Reset form when task changes
  useEffect(() => {
    if (task) {
      setTitle(task.title);
      setElementId(task.element_id || '');
      setEstimatedCost(task.estimated_cost?.toString() || '0');
      setActualCost(task.actual_cost?.toString() || '0');
      setStartDate(task.start_date || '');
      setDueDate(task.due_date || '');
    } else {
      // Reset form when no task
      setTitle('');
      setElementId('');
      setEstimatedCost('0');
      setActualCost('0');
      setStartDate('');
      setDueDate('');
      setSelectedUserIds([]);
      loadedTaskIdRef.current = null;
    }
  }, [task?.id, task?.title, task?.element_id, task?.estimated_cost, task?.actual_cost, task?.start_date, task?.due_date]);

  // Fetch users, elements, and assignments when dialog opens
  useEffect(() => {
    if (!open || !task?.id) {
      return;
    }
    
    // Prevent redundant fetches for the same task
    if (loadedTaskIdRef.current === task.id) {
      return;
    }
    
    loadedTaskIdRef.current = task.id;
    
    const loadData = async () => {
      setDataLoading(true);
      try {
        // Fetch users, elements, and assignments in parallel
        const [usersResult, elementsResult, assignmentsResult] = await Promise.all([
          supabase.from('profiles').select('id, full_name, email').order('full_name'),
          task.project_id && task.assignee_department_id
            ? supabase.from('elements').select('id, title').eq('project_id', task.project_id).eq('department_id', task.assignee_department_id).order('title')
            : Promise.resolve({ data: [], error: null }),
          supabase.from('task_assignments').select('user_id').eq('task_id', task.id)
        ]);

        if (usersResult.error) throw usersResult.error;
        if (elementsResult.error) throw elementsResult.error;
        if (assignmentsResult.error) throw assignmentsResult.error;

        setUsers(usersResult.data || []);
        setElements(elementsResult.data || []);
        
        const assignedIds = (assignmentsResult.data || []).map(a => a.user_id).filter(Boolean) as string[];
        setSelectedUserIds(assignedIds);
      } catch (error) {
        console.error('Error loading task data:', error);
      } finally {
        setDataLoading(false);
      }
    };

    loadData();
  }, [open, task?.id, task?.project_id, task?.assignee_department_id]);

  // Reset loaded task ref when dialog closes
  useEffect(() => {
    if (!open) {
      loadedTaskIdRef.current = null;
    }
  }, [open]);


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!task) return;

    setLoading(true);
    try {
      // Update task
      const { error: taskError } = await supabase
        .from('tasks')
        .update({
          title: title.trim(),
          element_id: elementId || null,
          estimated_cost: parseFloat(estimatedCost) || 0,
          actual_cost: parseFloat(actualCost) || 0,
          start_date: startDate || null,
          due_date: dueDate || null,
        })
        .eq('id', task.id);

      if (taskError) throw taskError;

      // Delete existing task assignments
      const { error: deleteError } = await supabase
        .from('task_assignments')
        .delete()
        .eq('task_id', task.id);

      if (deleteError) throw deleteError;

      // Create new task assignments
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

      toast({
        title: 'Success',
        description: `Task updated with ${selectedUserIds.length} assigned user(s)`,
      });
      onSuccess();
      onOpenChange(false);
    } catch (error) {
      console.error('Error updating task:', error);
      toast({
        title: 'Error',
        description: 'Failed to update task',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!task) return;

    setLoading(true);
    try {
      const { error } = await supabase
        .from('tasks')
        .delete()
        .eq('id', task.id);

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Task deleted successfully',
      });
      onSuccess();
      setShowDeleteDialog(false);
      onOpenChange(false);
    } catch (error) {
      console.error('Error deleting task:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete task',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  // Don't render content until we have loaded data
  const isReady = !dataLoading && users.length > 0;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Edit Task</DialogTitle>
          </DialogHeader>
          
          {dataLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              <span className="ml-2 text-muted-foreground">Loading task data...</span>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="title">Task Name</Label>
                <Input
                  id="title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Enter task name"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="element">Element</Label>
                <Select 
                  value={elementId || 'no-element'} 
                  onValueChange={(value) => setElementId(value === 'no-element' ? '' : value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select element" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="no-element">No Element</SelectItem>
                    {elements.map((element) => (
                      <SelectItem key={element.id} value={element.id}>
                        {element.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {elements.length === 0 && (
                  <p className="text-xs text-muted-foreground">No elements available in this department</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="assignees">Assign To (Multiple Users)</Label>
                <SearchableUserSelect
                  users={users}
                  selectedUserIds={selectedUserIds}
                  onSelectionChange={setSelectedUserIds}
                  placeholder="Search by name or email..."
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="start-date">Start Date</Label>
                  <Input
                    id="start-date"
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="due-date">Due Date</Label>
                  <Input
                    id="due-date"
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="estimated-cost">Estimated Cost</Label>
                  <Input
                    id="estimated-cost"
                    type="number"
                    min="0"
                    step="0.01"
                    value={estimatedCost}
                    onChange={(e) => setEstimatedCost(e.target.value)}
                    placeholder="0.00"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="actual-cost">Actual Cost</Label>
                  <Input
                    id="actual-cost"
                    type="number"
                    min="0"
                    step="0.01"
                    value={actualCost}
                    onChange={(e) => setActualCost(e.target.value)}
                    placeholder="0.00"
                  />
                </div>
              </div>

              <DialogFooter className="flex justify-between sm:justify-between">
                <Button
                  type="button"
                  variant="destructive"
                  onClick={() => setShowDeleteDialog(true)}
                  disabled={loading}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete
                </Button>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => onOpenChange(false)}
                    disabled={loading}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={loading}>
                    {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    Save Changes
                  </Button>
                </div>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Task</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this task? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={loading}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={loading}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Trash2 } from 'lucide-react';
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
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (task) {
      setTitle(task.title);
      setElementId(task.element_id || '');
      setEstimatedCost(task.estimated_cost?.toString() || '0');
      setActualCost(task.actual_cost?.toString() || '0');
      setStartDate(task.start_date || '');
      setDueDate(task.due_date || '');
    }
  }, [task]);

  useEffect(() => {
    if (open && task) {
      fetchUsers();
      fetchElements();
      fetchTaskAssignments();
    }
  }, [open, task]);

  const fetchUsers = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .order('full_name');

      if (error) throw error;
      setUsers(data || []);
    } catch (error) {
      console.error('Error fetching users:', error);
    }
  };

  const fetchElements = async () => {
    if (!task?.project_id || !task?.assignee_department_id) return;
    
    try {
      const { data, error } = await supabase
        .from('elements')
        .select('id, title')
        .eq('project_id', task.project_id)
        .eq('department_id', task.assignee_department_id)
        .order('title');

      if (error) throw error;
      setElements(data || []);
    } catch (error) {
      console.error('Error fetching elements:', error);
    }
  };

  const fetchTaskAssignments = async () => {
    if (!task?.id) return;
    
    try {
      const { data, error } = await supabase
        .from('task_assignments')
        .select('user_id')
        .eq('task_id', task.id);

      if (error) throw error;
      setSelectedUserIds(data?.map(a => a.user_id) || []);
    } catch (error) {
      console.error('Error fetching task assignments:', error);
    }
  };

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

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Edit Task</DialogTitle>
          </DialogHeader>
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
              <Select value={elementId || 'no-element'} onValueChange={(value) => setElementId(value === 'no-element' ? '' : value)}>
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
            </div>

            <div className="space-y-2">
              <Label htmlFor="assignees">Assign To (Multiple Users)</Label>
              <div className="border rounded-md p-3 space-y-2 max-h-48 overflow-y-auto">
                {users.map((user) => (
                  <div 
                    key={user.id} 
                    className="flex items-center gap-3 cursor-pointer hover:bg-muted/50 p-2 rounded"
                    onClick={() => {
                      if (selectedUserIds.includes(user.id)) {
                        setSelectedUserIds(selectedUserIds.filter(id => id !== user.id));
                      } else {
                        setSelectedUserIds([...selectedUserIds, user.id]);
                      }
                    }}
                  >
                    <Checkbox
                      checked={selectedUserIds.includes(user.id)}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setSelectedUserIds([...selectedUserIds, user.id]);
                        } else {
                          setSelectedUserIds(selectedUserIds.filter(id => id !== user.id));
                        }
                      }}
                    />
                    <span className="text-sm flex-1">{user.full_name || user.email}</span>
                  </div>
                ))}
              </div>
              {selectedUserIds.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  {selectedUserIds.length} user(s) selected
                </p>
              )}
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

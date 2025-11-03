import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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
  const [assigneeUserId, setAssigneeUserId] = useState<string>('');
  const [elementId, setElementId] = useState<string>('');
  const [estimatedCost, setEstimatedCost] = useState<string>('0');
  const [actualCost, setActualCost] = useState<string>('0');
  const [users, setUsers] = useState<User[]>([]);
  const [elements, setElements] = useState<Element[]>([]);
  const [loading, setLoading] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (task) {
      setTitle(task.title);
      setAssigneeUserId(task.assignee_user_id || '');
      setElementId(task.element_id || '');
      setEstimatedCost(task.estimated_cost?.toString() || '0');
      setActualCost(task.actual_cost?.toString() || '0');
    }
  }, [task]);

  useEffect(() => {
    if (open && task) {
      fetchUsers();
      fetchElements();
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!task) return;

    setLoading(true);
    try {
      const { error } = await supabase
        .from('tasks')
        .update({
          title: title.trim(),
          assignee_user_id: assigneeUserId || null,
          element_id: elementId || null,
          estimated_cost: parseFloat(estimatedCost) || 0,
          actual_cost: parseFloat(actualCost) || 0,
        })
        .eq('id', task.id);

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Task updated successfully',
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
              <Label htmlFor="assignee">Assign To</Label>
              <Select value={assigneeUserId || 'unassigned'} onValueChange={(value) => setAssigneeUserId(value === 'unassigned' ? '' : value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select user" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="unassigned">Unassigned</SelectItem>
                  {users.map((user) => (
                    <SelectItem key={user.id} value={user.id}>
                      {user.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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

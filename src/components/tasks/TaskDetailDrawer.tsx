import { useEffect, useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { Calendar, Clock, User, Percent, Save, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import type { TaskWithProfile } from './types';

interface TaskDetailDrawerProps {
  task: TaskWithProfile | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onTaskUpdated: () => void;
  canEdit?: boolean;
}

export function TaskDetailDrawer({ 
  task, 
  open, 
  onOpenChange, 
  onTaskUpdated,
  canEdit = true 
}: TaskDetailDrawerProps) {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
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

      toast({ title: 'Success', description: 'Task updated successfully' });
      onTaskUpdated();
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

  const isOverdue = task?.due_date && task.status !== 'done' && new Date(task.due_date) < new Date();

  return (
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

          {/* Assigned Users */}
          {task?.assigned_users && task.assigned_users.length > 0 && (
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <User className="h-4 w-4" />
                Assigned To
              </Label>
              <div className="flex flex-wrap gap-2">
                {task.assigned_users.map(user => (
                  <Badge key={user.id} variant="secondary">
                    {user.name}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Element */}
          {task?.element_name && (
            <div className="space-y-2">
              <Label>Element</Label>
              <Badge variant="outline">{task.element_name}</Badge>
            </div>
          )}

          {/* Actions */}
          {canEdit && (
            <div className="flex gap-2 pt-4">
              <Button onClick={handleSave} disabled={saving} className="flex-1">
                <Save className="h-4 w-4 mr-2" />
                {saving ? 'Saving...' : 'Save Changes'}
              </Button>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                <X className="h-4 w-4 mr-2" />
                Cancel
              </Button>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

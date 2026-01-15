import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Plus, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

interface CreateTaskDialogProps {
  projectId?: string;
  departmentId?: string;
  onTaskCreated?: () => void;
  showTrigger?: boolean;
}

interface Profile {
  id: string;
  full_name: string | null;
  email: string;
}

interface Project {
  id: string;
  name: string;
}

interface Department {
  id: string;
  name: string;
  project_id: string;
}

interface Element {
  id: string;
  title: string;
  department_id: string;
}

export function CreateTaskDialog({ projectId, departmentId, onTaskCreated, showTrigger = true }: CreateTaskDialogProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [elements, setElements] = useState<Element[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>(projectId || '');
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    project_id: projectId || '',
    assignee_user_id: '',
    assignee_department_id: departmentId || '',
    element_id: '',
    status: 'todo',
    priority: 'medium',
    start_date: '',
    due_date: '',
    estimated_cost: '0',
    actual_cost: '0',
  });

  useEffect(() => {
    if (open) {
      fetchProfiles();
      if (!projectId) {
        fetchProjects();
      } else {
        setSelectedProjectId(projectId);
      }
    }
  }, [open, projectId]);

  useEffect(() => {
    if (selectedProjectId) {
      fetchDepartments(selectedProjectId);
      fetchElements(selectedProjectId);
      setFormData(prev => ({ ...prev, project_id: selectedProjectId, assignee_department_id: departmentId || '', element_id: '' }));
    }
  }, [selectedProjectId]);

  const fetchProfiles = async () => {
    const { data } = await supabase
      .from('profiles')
      .select('id, full_name, email')
      .order('full_name');
    if (data) setProfiles(data);
  };

  const fetchProjects = async () => {
    const { data } = await supabase
      .from('projects')
      .select('id, name')
      .order('name');
    if (data) setProjects(data);
  };

  const fetchDepartments = async (projId: string) => {
    try {
      const { data, error } = await supabase
        .from('departments')
        .select('id, name, project_id')
        .eq('project_id', projId)
        .order('name');

      if (error) throw error;
      setDepartments(data || []);
    } catch (error: any) {
      console.error('Error fetching departments:', error);
      setDepartments([]);
    }
  };

  const fetchElements = async (projId: string) => {
    try {
      const { data, error } = await supabase
        .from('elements')
        .select('id, title, department_id')
        .eq('project_id', projId)
        .order('title');

      if (error) throw error;
      setElements(data || []);
    } catch (error: any) {
      console.error('Error fetching elements:', error);
      setElements([]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    if (!formData.assignee_department_id) {
      toast({
        title: 'Error',
        description: 'Please select a department for this task',
        variant: 'destructive',
      });
      return;
    }
    
    setLoading(true);
    try {
      const { data: task, error } = await supabase
        .from('tasks')
        .insert({
          title: formData.title,
          description: formData.description,
          project_id: formData.project_id,
          assignee_user_id: formData.assignee_user_id || null,
          assignee_department_id: formData.assignee_department_id,
          element_id: formData.element_id || null,
          status: formData.status,
          priority: formData.priority,
          start_date: formData.start_date || null,
          due_date: formData.due_date || null,
          estimated_cost: parseFloat(formData.estimated_cost) || 0,
          actual_cost: parseFloat(formData.actual_cost) || 0,
        })
        .select()
        .single();

      if (error) throw error;

      // Create task_assignments for selected users
      if (selectedUserIds.length > 0 && task) {
        const assignments = selectedUserIds.map(userId => ({
          task_id: task.id,
          user_id: userId,
        }));
        
        await supabase
          .from('task_assignments')
          .insert(assignments);

        // Create notifications for all assigned users
        const notifications = selectedUserIds.map(userId => ({
          user_id: userId,
          title: 'New Task Assigned',
          message: `You have been assigned to: ${formData.title}`,
          type: 'task_assigned',
          related_task_id: task.id,
        }));

        await supabase
          .from('notifications')
          .insert(notifications);
      } else if (formData.assignee_user_id && task) {
        // Legacy single assignment support
        await supabase
          .from('task_assignments')
          .insert({
            task_id: task.id,
            user_id: formData.assignee_user_id,
          });

        await supabase
          .from('notifications')
          .insert({
            user_id: formData.assignee_user_id,
            title: 'New Task Assigned',
            message: `You have been assigned to: ${formData.title}`,
            type: 'task_assigned',
            related_task_id: task.id,
          });
      }

      toast({
        title: "Success",
        description: selectedUserIds.length > 0 
          ? `Task created and ${selectedUserIds.length} user(s) notified`
          : "Task created successfully",
      });

      setFormData({
        title: '',
        description: '',
        project_id: projectId || '',
        assignee_user_id: '',
        assignee_department_id: departmentId || '',
        element_id: '',
        status: 'todo',
        priority: 'medium',
        start_date: '',
        due_date: '',
        estimated_cost: '0',
        actual_cost: '0',
      });
      setSelectedUserIds([]);
      setOpen(false);
      onTaskCreated?.();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {showTrigger && (
        <DialogTrigger asChild>
          <Button className="gap-2">
            <Plus className="h-4 w-4" />
            New Task
          </Button>
        </DialogTrigger>
      )}
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create New Task</DialogTitle>
          <DialogDescription>
            Add a new task and assign it to a team member
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Task Title</Label>
            <Input
              id="title"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              required
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={3}
            />
          </div>

          {!projectId && (
            <div className="space-y-2">
              <Label htmlFor="project">Project</Label>
              <Select value={selectedProjectId} onValueChange={setSelectedProjectId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select project" />
                </SelectTrigger>
                <SelectContent>
                  {projects.map((project) => (
                    <SelectItem key={project.id} value={project.id}>
                      {project.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="department">Department *</Label>
            <Select
              value={formData.assignee_department_id}
              onValueChange={(value) => setFormData({ ...formData, assignee_department_id: value, element_id: '' })}
              disabled={!selectedProjectId || departments.length === 0}
            >
              <SelectTrigger>
                <SelectValue placeholder={
                  !selectedProjectId 
                    ? "Select a project first" 
                    : departments.length === 0 
                    ? "No departments available" 
                    : "Select department"
                } />
              </SelectTrigger>
              <SelectContent>
                {departments.map((dept) => (
                  <SelectItem key={dept.id} value={dept.id}>
                    {dept.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="element">Element (Optional)</Label>
            <Select
              value={formData.element_id}
              onValueChange={(value) => setFormData({ ...formData, element_id: value })}
              disabled={!formData.assignee_department_id || elements.length === 0}
            >
              <SelectTrigger>
                <SelectValue placeholder={
                  !formData.assignee_department_id
                    ? "Select a department first" 
                    : elements.filter(e => e.department_id === formData.assignee_department_id).length === 0 
                    ? "No elements available" 
                    : "Select element (optional)"
                } />
              </SelectTrigger>
              <SelectContent>
                {elements
                  .filter(elem => elem.department_id === formData.assignee_department_id)
                  .map((elem) => (
                    <SelectItem key={elem.id} value={elem.id}>
                      {elem.title}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="assignees">Assign To (Multiple Users)</Label>
            <div className="border rounded-md p-3 space-y-2 max-h-48 overflow-y-auto">
              {profiles.map((profile) => (
                <div
                  key={profile.id}
                  className="flex items-center gap-3 cursor-pointer hover:bg-muted/50 p-2 rounded"
                  onClick={() => {
                    setSelectedUserIds((prev) =>
                      prev.includes(profile.id)
                        ? prev.filter((id) => id !== profile.id)
                        : [...prev, profile.id]
                    );
                  }}
                >
                  <Checkbox
                    checked={selectedUserIds.includes(profile.id)}
                    onClick={(e) => e.stopPropagation()}
                    onCheckedChange={(checked) => {
                      const isChecked = checked === true;
                      setSelectedUserIds((prev) => {
                        const has = prev.includes(profile.id);
                        if (isChecked) return has ? prev : [...prev, profile.id];
                        return has ? prev.filter((id) => id !== profile.id) : prev;
                      });
                    }}
                  />
                  <span className="text-sm flex-1">{profile.full_name || profile.email}</span>
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
              <Label htmlFor="status">Status</Label>
              <Select value={formData.status} onValueChange={(value) => setFormData({ ...formData, status: value })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todo">To Do</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="review">Review</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="priority">Priority</Label>
              <Select value={formData.priority} onValueChange={(value) => setFormData({ ...formData, priority: value })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="urgent">Urgent</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="start_date">Start Date</Label>
              <Input
                id="start_date"
                type="date"
                value={formData.start_date}
                onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="due_date">Due Date</Label>
              <Input
                id="due_date"
                type="date"
                value={formData.due_date}
                onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="estimated_cost">Estimated Cost</Label>
              <Input
                id="estimated_cost"
                type="number"
                min="0"
                step="0.01"
                value={formData.estimated_cost}
                onChange={(e) => setFormData({ ...formData, estimated_cost: e.target.value })}
                placeholder="0.00"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="actual_cost">Actual Cost</Label>
              <Input
                id="actual_cost"
                type="number"
                min="0"
                step="0.01"
                value={formData.actual_cost}
                onChange={(e) => setFormData({ ...formData, actual_cost: e.target.value })}
                placeholder="0.00"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create Task
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

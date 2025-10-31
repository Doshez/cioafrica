import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Loader2, CheckCircle2, Clock, AlertCircle } from "lucide-react";

interface Task {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  due_date: string | null;
  project_id: string;
  projects: {
    name: string;
  } | null;
}

export default function MyTasks() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchMyTasks();
    }
  }, [user]);

  const fetchMyTasks = async () => {
    try {
      const { data, error } = await supabase
        .from('tasks')
        .select(`
          id,
          title,
          description,
          status,
          priority,
          due_date,
          project_id,
          projects (
            name
          )
        `)
        .eq('assignee_user_id', user?.id)
        .order('due_date', { ascending: true, nullsFirst: false });

      if (error) throw error;
      setTasks(data || []);
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

  const updateTaskStatus = async (taskId: string, newStatus: string) => {
    try {
      const { error } = await supabase
        .from('tasks')
        .update({ 
          status: newStatus,
          ...(newStatus === 'done' && { completed_at: new Date().toISOString() })
        })
        .eq('id', taskId);

      if (error) throw error;

      setTasks(tasks.map(task => 
        task.id === taskId ? { ...task, status: newStatus } : task
      ));

      toast({
        title: "Success",
        description: "Task status updated successfully",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'todo': return 'bg-secondary text-secondary-foreground';
      case 'in_progress': return 'bg-primary text-primary-foreground';
      case 'review': return 'bg-accent text-accent-foreground';
      case 'done': return 'bg-green-500 text-white';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'bg-destructive text-destructive-foreground';
      case 'medium': return 'bg-accent text-accent-foreground';
      case 'low': return 'bg-muted text-muted-foreground';
      default: return 'bg-secondary text-secondary-foreground';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'done': return <CheckCircle2 className="h-4 w-4" />;
      case 'in_progress': return <Clock className="h-4 w-4" />;
      case 'todo': return <AlertCircle className="h-4 w-4" />;
      default: return null;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">My Tasks</h1>
        <p className="text-muted-foreground mt-2">
          Tasks assigned to you across all projects
        </p>
      </div>

      {tasks.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">No tasks assigned to you yet</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {tasks.map((task) => (
            <Card key={task.id} className="hover:shadow-md transition-shadow">
              <CardHeader>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <CardTitle className="text-xl mb-2">{task.title}</CardTitle>
                    {task.description && (
                      <p className="text-sm text-muted-foreground">{task.description}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {getStatusIcon(task.status)}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex flex-wrap gap-2">
                    {task.projects && (
                      <Badge variant="outline">
                        {task.projects.name}
                      </Badge>
                    )}
                    <Badge className={getPriorityColor(task.priority)}>
                      {task.priority}
                    </Badge>
                    {task.due_date && (
                      <Badge variant="outline">
                        Due: {new Date(task.due_date).toLocaleDateString()}
                      </Badge>
                    )}
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="flex-1">
                      <Select
                        value={task.status}
                        onValueChange={(value) => updateTaskStatus(task.id, value)}
                      >
                        <SelectTrigger className="w-[180px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="todo">To Do</SelectItem>
                          <SelectItem value="in_progress">In Progress</SelectItem>
                          <SelectItem value="review">In Review</SelectItem>
                          <SelectItem value="done">Done</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <Badge className={getStatusColor(task.status)}>
                      {task.status.replace('_', ' ')}
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

import { useState, useEffect } from 'react';
import { Gantt, Task as GanttTask, ViewMode } from 'gantt-task-react';
import 'gantt-task-react/dist/index.css';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';

interface Task {
  id: string;
  title: string;
  status: string;
  priority: string;
  start_date: string;
  due_date: string;
  assignee_department_id: string;
  description?: string;
  progress_percentage?: number;
}

interface DepartmentGanttViewProps {
  departmentId: string;
  departmentName: string;
  tasks: Task[];
  onTasksUpdate: () => void;
}

export function DepartmentGanttView({ departmentId, departmentName, tasks, onTasksUpdate }: DepartmentGanttViewProps) {
  const { toast } = useToast();
  const [viewMode, setViewMode] = useState<ViewMode>(ViewMode.Day);
  const [ganttTasks, setGanttTasks] = useState<GanttTask[]>([]);

  useEffect(() => {
    const convertToGanttTasks = () => {
      const converted: GanttTask[] = tasks
        .filter(task => task.start_date && task.due_date)
        .map(task => {
          const progress = task.status === 'completed' ? 100 : task.status === 'in_progress' ? 50 : 0;
          
          return {
            id: task.id,
            name: task.title,
            start: new Date(task.start_date),
            end: new Date(task.due_date),
            progress,
            type: 'task' as const,
            styles: {
              progressColor: getProgressColor(task.status),
              progressSelectedColor: getProgressColor(task.status),
              backgroundColor: getBackgroundColor(task.priority),
              backgroundSelectedColor: getBackgroundColor(task.priority),
            },
          };
        });
      
      setGanttTasks(converted);
    };

    convertToGanttTasks();
  }, [tasks]);

  const getProgressColor = (status: string) => {
    switch (status) {
      case 'completed':
        return '#22c55e';
      case 'in_progress':
        return '#3b82f6';
      default:
        return '#9ca3af';
    }
  };

  const getBackgroundColor = (priority: string) => {
    switch (priority) {
      case 'high':
        return '#fecaca';
      case 'medium':
        return '#fed7aa';
      case 'low':
        return '#d1fae5';
      default:
        return '#e5e7eb';
    }
  };

  const handleTaskChange = async (task: GanttTask) => {
    try {
      const { error } = await supabase
        .from('tasks')
        .update({
          start_date: task.start.toISOString().split('T')[0],
          due_date: task.end.toISOString().split('T')[0],
        })
        .eq('id', task.id);

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Task dates updated successfully',
      });

      onTasksUpdate();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const handleStatusUpdate = async (taskId: string, newStatus: string) => {
    try {
      const { error } = await supabase
        .from('tasks')
        .update({ 
          status: newStatus,
          completed_at: newStatus === 'completed' ? new Date().toISOString() : null 
        })
        .eq('id', taskId);

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Task status updated successfully',
      });

      onTasksUpdate();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const handleProgressUpdate = async (taskId: string, progress: number) => {
    try {
      const updateData: any = { 
        progress_percentage: progress
      };

      // Auto-complete when reaching 100%
      if (progress >= 100) {
        updateData.status = 'completed';
        updateData.completed_at = new Date().toISOString();
      } else if (progress > 0) {
        updateData.status = 'in_progress';
      }

      const { error } = await supabase
        .from('tasks')
        .update(updateData)
        .eq('id', taskId);

      if (error) throw error;

      toast({
        title: 'Success',
        description: progress >= 100 ? 'Task completed!' : 'Progress updated successfully',
      });

      onTasksUpdate();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const getTaskProgress = (status: string) => {
    switch (status) {
      case 'completed':
        return 100;
      case 'in_progress':
        return 50;
      default:
        return 0;
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">{departmentName} - Gantt Chart</h3>
        <Select value={viewMode} onValueChange={(value) => setViewMode(value as ViewMode)}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="View Mode" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ViewMode.Day}>Day</SelectItem>
            <SelectItem value={ViewMode.Week}>Week</SelectItem>
            <SelectItem value={ViewMode.Month}>Month</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {ganttTasks.length > 0 ? (
        <div className="border rounded-lg bg-background">
          {/* Excel-like layout with tasks on left and chart on right */}
          <div className="flex border-b bg-muted/30">
            <div className="w-[400px] p-3 font-semibold border-r">Task Details</div>
            <div className="flex-1 p-3 font-semibold">Timeline</div>
          </div>
          
          <div className="flex">
            {/* Left side - Task List */}
            <ScrollArea className="w-[400px] border-r h-[600px]">
              <div className="divide-y">
                {tasks.map((task) => {
                  const progress = task.progress_percentage ?? getTaskProgress(task.status);
                  return (
                    <div key={task.id} className="p-4 hover:bg-muted/50 transition-colors">
                      <div className="space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <p className="font-medium text-sm leading-tight">{task.title}</p>
                          <Badge 
                            variant={task.priority === 'high' ? 'destructive' : 'default'}
                            className="shrink-0 text-xs"
                          >
                            {task.priority}
                          </Badge>
                        </div>
                        
                        <div className="flex items-center gap-2">
                          <Select 
                            value={task.status} 
                            onValueChange={(value) => handleStatusUpdate(task.id, value)}
                          >
                            <SelectTrigger className="h-7 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="todo">Not Started</SelectItem>
                              <SelectItem value="in_progress">In Progress</SelectItem>
                              <SelectItem value="completed">Completed</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-muted-foreground">Progress</span>
                            {task.status === 'in_progress' ? (
                              <div className="flex items-center gap-1">
                                <Input
                                  type="number"
                                  min="0"
                                  max="100"
                                  value={progress}
                                  onChange={(e) => {
                                    const value = Math.min(100, Math.max(0, Number(e.target.value)));
                                    handleProgressUpdate(task.id, value);
                                  }}
                                  className="w-14 h-6 text-xs"
                                />
                                <span className="text-xs">%</span>
                              </div>
                            ) : (
                              <span className="text-xs font-medium">{progress}%</span>
                            )}
                          </div>
                          <Progress value={progress} className="h-1.5" />
                        </div>

                        {(task.start_date || task.due_date) && (
                          <div className="text-xs text-muted-foreground space-y-0.5">
                            {task.start_date && (
                              <div>Start: {new Date(task.start_date).toLocaleDateString()}</div>
                            )}
                            {task.due_date && (
                              <div>Due: {new Date(task.due_date).toLocaleDateString()}</div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>

            {/* Right side - Gantt Chart */}
            <ScrollArea className="flex-1 h-[600px]">
              <div className="min-w-max">
                <Gantt
                  tasks={ganttTasks}
                  viewMode={viewMode}
                  onDateChange={handleTaskChange}
                  listCellWidth=""
                  columnWidth={viewMode === ViewMode.Month ? 300 : viewMode === ViewMode.Week ? 250 : 60}
                />
              </div>
            </ScrollArea>
          </div>
        </div>
      ) : (
        <div className="text-center py-8 text-muted-foreground">
          No tasks with dates available for Gantt chart view
        </div>
      )}
    </div>
  );
}

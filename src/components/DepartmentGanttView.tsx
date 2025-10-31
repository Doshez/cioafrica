import { useState, useEffect, useRef } from 'react';
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
  const leftScrollRef = useRef<HTMLDivElement>(null);
  const rightScrollRef = useRef<HTMLDivElement>(null);

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
        <div className="border rounded-lg bg-background overflow-hidden">
          {/* Excel-like layout with tasks on left and chart on right */}
          <div className="flex border-b bg-muted/30 sticky top-0 z-10">
            <div className="w-[400px] p-3 font-semibold border-r shrink-0">Task Details</div>
            <div className="flex-1 p-3 font-semibold overflow-hidden">Timeline</div>
          </div>
          
          <div className="flex h-[600px]">
            {/* Left side - Task List */}
            <div 
              className="w-[400px] border-r shrink-0 overflow-y-auto"
              onScroll={(e) => {
                if (rightScrollRef.current) {
                  rightScrollRef.current.scrollTop = e.currentTarget.scrollTop;
                }
              }}
              ref={leftScrollRef}
            >
              {/* Header spacer to match Gantt header height */}
              <div className="h-[60px] border-b bg-muted/10"></div>
              
              <div>
                {tasks.map((task) => {
                  const progress = task.progress_percentage ?? getTaskProgress(task.status);
                  return (
                    <div key={task.id} className="p-3 hover:bg-muted/50 transition-colors border-b" style={{ height: '50px' }}>
                      <div className="w-full flex items-center justify-between gap-2 h-full">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm leading-tight truncate">{task.title}</p>
                        </div>
                        <Badge 
                          variant={task.priority === 'high' ? 'destructive' : 'default'}
                          className="shrink-0 text-xs h-5"
                        >
                          {task.priority}
                        </Badge>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Right side - Gantt Chart */}
            <div 
              className="flex-1 overflow-auto"
              onScroll={(e) => {
                if (leftScrollRef.current) {
                  leftScrollRef.current.scrollTop = e.currentTarget.scrollTop;
                }
              }}
              ref={rightScrollRef}
            >
              <div className="min-w-max">
                <Gantt
                  tasks={ganttTasks}
                  viewMode={viewMode}
                  onDateChange={handleTaskChange}
                  listCellWidth="0"
                  rowHeight={50}
                  columnWidth={viewMode === ViewMode.Month ? 300 : viewMode === ViewMode.Week ? 250 : 60}
                />
              </div>
            </div>
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

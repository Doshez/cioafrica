import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { format, eachDayOfInterval, isSameDay, isWithinInterval } from 'date-fns';
import { Calendar } from 'lucide-react';

interface Task {
  id: string;
  title: string;
  status: string;
  priority: string;
  start_date: string;
  due_date: string;
  assignee_department_id: string;
}

interface Department {
  id: string;
  name: string;
}

interface ProjectGanttChartProps {
  projectId: string;
}

export function ProjectGanttChart({ projectId }: ProjectGanttChartProps) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState<Date[]>([]);

  useEffect(() => {
    fetchData();
  }, [projectId]);

  const fetchData = async () => {
    try {
      setLoading(true);

      // Fetch departments
      const { data: deptData, error: deptError } = await supabase
        .from('departments')
        .select('*')
        .eq('project_id', projectId)
        .order('name');

      if (deptError) throw deptError;
      setDepartments(deptData || []);

      // Fetch all tasks with valid dates
      const { data: tasksData, error: tasksError } = await supabase
        .from('tasks')
        .select('*')
        .eq('project_id', projectId)
        .not('start_date', 'is', null)
        .not('due_date', 'is', null)
        .order('start_date');

      if (tasksError) throw tasksError;
      
      const validTasks = (tasksData || []).filter(
        task => task.start_date && task.due_date
      );
      
      setTasks(validTasks);

      // Calculate date range
      if (validTasks.length > 0) {
        const allStartDates = validTasks.map(t => new Date(t.start_date));
        const allDueDates = validTasks.map(t => new Date(t.due_date));
        const minDate = new Date(Math.min(...allStartDates.map(d => d.getTime())));
        const maxDate = new Date(Math.max(...allDueDates.map(d => d.getTime())));
        
        const dates = eachDayOfInterval({ start: minDate, end: maxDate });
        setDateRange(dates);
      }
    } catch (error: any) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high':
        return 'destructive';
      case 'medium':
        return 'default';
      case 'low':
        return 'secondary';
      default:
        return 'default';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return '#22c55e';
      case 'in_progress':
        return '#3b82f6';
      case 'todo':
        return '#94a3b8';
      default:
        return '#94a3b8';
    }
  };

  const isTaskOnDate = (task: Task, date: Date) => {
    if (!task.start_date || !task.due_date) return false;
    
    const startDate = new Date(task.start_date);
    const dueDate = new Date(task.due_date);
    
    return isWithinInterval(date, { start: startDate, end: dueDate });
  };

  const getDepartmentName = (departmentId: string) => {
    const dept = departments.find(d => d.id === departmentId);
    return dept ? dept.name : 'Unassigned';
  };

  if (loading) {
    return <div className="p-4">Loading Gantt chart...</div>;
  }

  if (tasks.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          No tasks with dates found. Create tasks with start and due dates to see the Gantt chart.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="h-5 w-5" />
          Project Gantt Chart
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="flex border-b">
          {/* Left side - Task Details */}
          <div className="w-[400px] border-r">
            <div className="bg-muted p-4 font-semibold border-b">
              Task Details
            </div>
          </div>
          
          {/* Right side - Timeline Header */}
          <div className="flex-1 overflow-x-auto">
            <div className="bg-muted p-4 font-semibold border-b">
              <div className="flex gap-1">
                {dateRange.map((date, idx) => (
                  <div
                    key={idx}
                    className="min-w-[60px] text-center text-xs"
                  >
                    <div>{format(date, 'EEE, d')}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Tasks grouped by department */}
        <div className="max-h-[600px] overflow-y-auto">
          {departments.map((dept) => {
            const deptTasks = tasks.filter(t => t.assignee_department_id === dept.id);
            
            if (deptTasks.length === 0) return null;
            
            return (
              <div key={dept.id} className="border-b">
                {/* Department Header */}
                <div className="flex bg-muted/50">
                  <div className="w-[400px] border-r p-3 font-semibold">
                    {dept.name}
                  </div>
                  <div className="flex-1"></div>
                </div>
                
                {/* Department Tasks */}
                {deptTasks.map((task) => (
                  <div key={task.id} className="flex border-b hover:bg-muted/30">
                    {/* Task Details */}
                    <div className="w-[400px] border-r p-3">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium truncate">{task.title}</span>
                        <Badge variant={getPriorityColor(task.priority)} className="shrink-0">
                          {task.priority}
                        </Badge>
                      </div>
                    </div>
                    
                    {/* Timeline */}
                    <div className="flex-1 overflow-x-auto">
                      <div className="flex gap-1 p-3 relative h-full">
                        {dateRange.map((date, idx) => {
                          const isOnDate = isTaskOnDate(task, date);
                          const isStartDate = task.start_date && isSameDay(date, new Date(task.start_date));
                          const isDueDate = task.due_date && isSameDay(date, new Date(task.due_date));
                          
                          return (
                            <div
                              key={idx}
                              className="min-w-[60px] flex items-center"
                            >
                              {isOnDate && (
                                <div
                                  className="h-8 w-full rounded"
                                  style={{
                                    backgroundColor: getStatusColor(task.status),
                                    borderRadius: isStartDate ? '4px 0 0 4px' : isDueDate ? '0 4px 4px 0' : '0'
                                  }}
                                />
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

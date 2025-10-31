import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { format, eachDayOfInterval, isSameDay, isWithinInterval, differenceInDays } from 'date-fns';
import { Calendar, ChevronLeft, ChevronRight, Download } from 'lucide-react';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

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

const DEPT_COLORS = ['#3B82F6', '#F59E0B', '#8B5CF6', '#10B981', '#EF4444', '#EC4899', '#14B8A6', '#F97316'];

export function ProjectGanttChart({ projectId }: ProjectGanttChartProps) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState<Date[]>([]);
  const [viewStart, setViewStart] = useState(0);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);

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

  const getDepartmentColor = (departmentId: string) => {
    const index = departments.findIndex(d => d.id === departmentId);
    return index >= 0 ? DEPT_COLORS[index % DEPT_COLORS.length] : '#94a3b8';
  };

  const visibleDays = dateRange.slice(viewStart, viewStart + 30);
  const canScrollLeft = viewStart > 0;
  const canScrollRight = viewStart + 30 < dateRange.length;

  const handleScroll = (direction: 'left' | 'right') => {
    if (direction === 'left' && canScrollLeft) {
      setViewStart(Math.max(0, viewStart - 7));
    } else if (direction === 'right' && canScrollRight) {
      setViewStart(Math.min(dateRange.length - 30, viewStart + 7));
    }
  };

  const handleExportPDF = async () => {
    const element = document.getElementById('gantt-container');
    if (!element) return;

    try {
      const canvas = await html2canvas(element, { scale: 2 });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
      const imgWidth = 297;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      pdf.addImage(imgData, 'PNG', 0, 0, imgWidth, imgHeight);
      pdf.save(`gantt-${format(new Date(), 'yyyy-MM-dd')}.pdf`);
    } catch (error) {
      console.error('Export failed:', error);
    }
  };

  const getTaskPosition = (task: Task) => {
    if (visibleDays.length === 0) return null;
    const startDate = new Date(task.start_date);
    const dueDate = new Date(task.due_date);
    const firstDay = visibleDays[0];
    const lastDay = visibleDays[visibleDays.length - 1];
    
    if (dueDate < firstDay || startDate > lastDay) return null;
    
    const taskStart = startDate < firstDay ? firstDay : startDate;
    const taskEnd = dueDate > lastDay ? lastDay : dueDate;
    
    const startIdx = differenceInDays(taskStart, firstDay);
    const duration = differenceInDays(taskEnd, taskStart) + 1;
    
    const cellWidth = 100 / visibleDays.length;
    return {
      left: `${startIdx * cellWidth}%`,
      width: `${duration * cellWidth}%`
    };
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
    <Card className="w-full shadow-lg" id="gantt-container">
      <CardHeader className="bg-gradient-to-r from-primary/5 to-accent/5">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-primary" />
            <span>Project Timeline</span>
          </CardTitle>
          
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 border rounded-lg p-1">
              <Button
                variant="outline"
                size="icon"
                onClick={() => handleScroll('left')}
                disabled={!canScrollLeft}
                className="h-8 w-8"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={() => handleScroll('right')}
                disabled={!canScrollRight}
                className="h-8 w-8"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportPDF}
              className="h-8 gap-2"
            >
              <Download className="h-4 w-4" />
              Export PDF
            </Button>
          </div>
        </div>
        
        {/* Department Legend */}
        <div className="flex items-center gap-3 flex-wrap mt-4">
          {departments.map((dept, idx) => (
            <div key={dept.id} className="flex items-center gap-1.5">
              <div
                className="w-3 h-3 rounded-full shadow-sm"
                style={{ backgroundColor: DEPT_COLORS[idx % DEPT_COLORS.length] }}
              />
              <span className="text-xs font-medium text-muted-foreground">{dept.name}</span>
            </div>
          ))}
        </div>
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

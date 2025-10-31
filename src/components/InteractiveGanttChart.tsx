import { useEffect, useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Calendar, 
  ChevronLeft, 
  ChevronRight, 
  ZoomIn, 
  ZoomOut,
  User,
  CheckCircle2,
  Clock,
  Circle
} from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { supabase } from '@/integrations/supabase/client';
import { format, eachDayOfInterval, isWithinInterval, differenceInDays, addDays } from 'date-fns';

interface Task {
  id: string;
  title: string;
  status: string;
  priority: string;
  start_date: string;
  due_date: string;
  assignee_department_id: string;
  progress_percentage: number;
  assignee_user_id?: string;
}

interface Department {
  id: string;
  name: string;
  description?: string;
}

interface AssignedUser {
  profiles: {
    full_name: string;
  };
}

interface InteractiveGanttChartProps {
  projectId: string;
}

type ViewMode = 'day' | 'week' | 'month';

export function InteractiveGanttChart({ projectId }: InteractiveGanttChartProps) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [assignedUsers, setAssignedUsers] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>('week');
  const [scrollOffset, setScrollOffset] = useState(0);
  const [hoveredTask, setHoveredTask] = useState<string | null>(null);

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

      // Fetch tasks with valid dates
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

      // Fetch assigned users
      const userIds = validTasks
        .map(t => t.assignee_user_id)
        .filter(Boolean) as string[];
      
      if (userIds.length > 0) {
        const { data: userData, error: userError } = await supabase
          .from('profiles')
          .select('id, full_name')
          .in('id', userIds);

        if (!userError && userData) {
          const userMap: Record<string, string> = {};
          userData.forEach(user => {
            userMap[user.id] = user.full_name;
          });
          setAssignedUsers(userMap);
        }
      }
    } catch (error: any) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const dateRange = useMemo(() => {
    if (tasks.length === 0) return [];
    
    const allStartDates = tasks.map(t => new Date(t.start_date));
    const allDueDates = tasks.map(t => new Date(t.due_date));
    const minDate = new Date(Math.min(...allStartDates.map(d => d.getTime())));
    const maxDate = new Date(Math.max(...allDueDates.map(d => d.getTime())));
    
    // Add padding
    const paddedStart = addDays(minDate, -7);
    const paddedEnd = addDays(maxDate, 7);
    
    return eachDayOfInterval({ start: paddedStart, end: paddedEnd });
  }, [tasks]);

  const visibleDays = useMemo(() => {
    const daysToShow = viewMode === 'day' ? 14 : viewMode === 'week' ? 30 : 60;
    return dateRange.slice(scrollOffset, scrollOffset + daysToShow);
  }, [dateRange, scrollOffset, viewMode]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-success';
      case 'in_progress':
        return 'bg-primary';
      case 'todo':
        return 'bg-muted-foreground/50';
      default:
        return 'bg-muted-foreground/50';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return CheckCircle2;
      case 'in_progress':
        return Clock;
      default:
        return Circle;
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high':
        return 'bg-destructive';
      case 'medium':
        return 'bg-warning';
      case 'low':
        return 'bg-success';
      default:
        return 'bg-muted-foreground';
    }
  };

  const calculateTaskPosition = (task: Task) => {
    if (visibleDays.length === 0) return null;
    
    const startDate = new Date(task.start_date);
    const dueDate = new Date(task.due_date);
    const firstVisibleDay = visibleDays[0];
    const lastVisibleDay = visibleDays[visibleDays.length - 1];
    
    // Check if task overlaps with visible range
    if (dueDate < firstVisibleDay || startDate > lastVisibleDay) {
      return null;
    }
    
    const taskStart = startDate < firstVisibleDay ? firstVisibleDay : startDate;
    const taskEnd = dueDate > lastVisibleDay ? lastVisibleDay : dueDate;
    
    const startIndex = differenceInDays(taskStart, firstVisibleDay);
    const duration = differenceInDays(taskEnd, taskStart) + 1;
    
    const cellWidth = 100 / visibleDays.length;
    const left = startIndex * cellWidth;
    const width = duration * cellWidth;
    
    return { left: `${left}%`, width: `${width}%` };
  };

  const handleScroll = (direction: 'left' | 'right') => {
    const step = viewMode === 'day' ? 7 : viewMode === 'week' ? 14 : 30;
    setScrollOffset(prev => {
      if (direction === 'left') {
        return Math.max(0, prev - step);
      } else {
        return Math.min(dateRange.length - visibleDays.length, prev + step);
      }
    });
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-muted rounded w-1/4 mx-auto"></div>
            <div className="h-64 bg-muted rounded"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (tasks.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          <Calendar className="h-16 w-16 mx-auto mb-4 opacity-50" />
          <p className="text-lg font-semibold">No tasks with dates found</p>
          <p className="text-sm">Create tasks with start and due dates to see the Gantt chart</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full overflow-hidden">
      <CardHeader>
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-primary" />
            Project Timeline
          </CardTitle>
          
          {/* View Controls */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1 border rounded-lg p-1">
              <Button
                variant={viewMode === 'day' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('day')}
                className="h-8"
              >
                Day
              </Button>
              <Button
                variant={viewMode === 'week' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('week')}
                className="h-8"
              >
                Week
              </Button>
              <Button
                variant={viewMode === 'month' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('month')}
                className="h-8"
              >
                Month
              </Button>
            </div>
            
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="icon"
                onClick={() => handleScroll('left')}
                disabled={scrollOffset === 0}
                className="h-8 w-8"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={() => handleScroll('right')}
                disabled={scrollOffset >= dateRange.length - visibleDays.length}
                className="h-8 w-8"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          {/* Timeline Header */}
          <div className="flex border-b bg-muted/30 sticky top-0 z-10">
            <div className="w-48 lg:w-64 border-r px-4 py-3 font-semibold flex-shrink-0 bg-muted/50">
              Department
            </div>
            <div className="flex-1 relative min-w-[600px]">
              <div className="flex h-full">
                {visibleDays.map((date, idx) => (
                  <motion.div
                    key={idx}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.2, delay: idx * 0.01 }}
                    className="flex-1 border-r px-2 py-3 text-center text-xs"
                    style={{ minWidth: '40px' }}
                  >
                    <div className="font-semibold text-foreground">
                      {format(date, 'd')}
                    </div>
                    <div className="text-muted-foreground">
                      {format(date, 'EEE')}
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          </div>

          {/* Timeline Body */}
          <div className="divide-y">
            <AnimatePresence>
              {departments.map((dept, deptIdx) => {
                const deptTasks = tasks.filter(t => t.assignee_department_id === dept.id);
                
                if (deptTasks.length === 0) return null;
                
                return (
                  <motion.div
                    key={dept.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, delay: deptIdx * 0.1 }}
                    className="bg-card hover:bg-muted/20 transition-colors"
                  >
                    {/* Department Header */}
                    <div className="flex">
                      <div className="w-48 lg:w-64 border-r px-4 py-3 flex-shrink-0">
                        <div className="font-semibold text-sm truncate">
                          {dept.name}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {deptTasks.length} task{deptTasks.length !== 1 ? 's' : ''}
                        </div>
                      </div>
                      <div className="flex-1 relative min-h-[120px] p-4" style={{ minWidth: '600px' }}>
                        {/* Timeline Grid */}
                        <div className="absolute inset-0 flex">
                          {visibleDays.map((_, idx) => (
                            <div
                              key={idx}
                              className="flex-1 border-r border-border/50"
                              style={{ minWidth: '40px' }}
                            />
                          ))}
                        </div>
                        
                        {/* Tasks */}
                        <div className="relative space-y-2">
                          <TooltipProvider>
                            {deptTasks.map((task, taskIdx) => {
                              const position = calculateTaskPosition(task);
                              if (!position) return null;
                              
                              const StatusIcon = getStatusIcon(task.status);
                              
                              return (
                                <Tooltip key={task.id}>
                                  <TooltipTrigger asChild>
                                    <motion.div
                                      initial={{ opacity: 0, scale: 0.8 }}
                                      animate={{ opacity: 1, scale: 1 }}
                                      transition={{ duration: 0.3, delay: taskIdx * 0.05 }}
                                      whileHover={{ scale: 1.02, zIndex: 50 }}
                                      onHoverStart={() => setHoveredTask(task.id)}
                                      onHoverEnd={() => setHoveredTask(null)}
                                      className="absolute cursor-pointer rounded-lg overflow-hidden transition-smooth"
                                      style={{
                                        ...position,
                                        height: '36px',
                                        top: `${taskIdx * 44}px`,
                                      }}
                                    >
                                      <div className={`h-full ${getStatusColor(task.status)} relative group`}>
                                        {/* Progress Bar */}
                                        <motion.div
                                          initial={{ width: 0 }}
                                          animate={{ width: `${task.progress_percentage || 0}%` }}
                                          transition={{ duration: 0.5, delay: 0.2 }}
                                          className="absolute inset-0 bg-foreground/20"
                                        />
                                        
                                        {/* Task Content */}
                                        <div className="relative h-full px-3 flex items-center justify-between gap-2 text-white">
                                          <div className="flex items-center gap-2 min-w-0 flex-1">
                                            <StatusIcon className="h-3 w-3 flex-shrink-0" />
                                            <span className="text-xs font-medium truncate">
                                              {task.title}
                                            </span>
                                          </div>
                                          <Badge 
                                            variant="secondary" 
                                            className={`${getPriorityColor(task.priority)} text-white text-[10px] px-1.5 py-0 h-4 flex-shrink-0`}
                                          >
                                            {task.priority}
                                          </Badge>
                                        </div>
                                        
                                        {/* Hover Effect */}
                                        <motion.div
                                          className="absolute inset-0 bg-foreground/10 opacity-0 group-hover:opacity-100 transition-opacity"
                                        />
                                      </div>
                                    </motion.div>
                                  </TooltipTrigger>
                                  <TooltipContent side="top" className="max-w-xs">
                                    <div className="space-y-2">
                                      <div>
                                        <p className="font-semibold">{task.title}</p>
                                        <p className="text-xs text-muted-foreground">
                                          {dept.name}
                                        </p>
                                      </div>
                                      <div className="grid grid-cols-2 gap-2 text-xs">
                                        <div>
                                          <span className="text-muted-foreground">Start:</span>
                                          <p className="font-medium">
                                            {format(new Date(task.start_date), 'MMM d, yyyy')}
                                          </p>
                                        </div>
                                        <div>
                                          <span className="text-muted-foreground">Due:</span>
                                          <p className="font-medium">
                                            {format(new Date(task.due_date), 'MMM d, yyyy')}
                                          </p>
                                        </div>
                                      </div>
                                      {task.assignee_user_id && assignedUsers[task.assignee_user_id] && (
                                        <div className="flex items-center gap-1 text-xs">
                                          <User className="h-3 w-3" />
                                          <span>{assignedUsers[task.assignee_user_id]}</span>
                                        </div>
                                      )}
                                      <div className="flex items-center justify-between text-xs">
                                        <span className="text-muted-foreground">Progress:</span>
                                        <span className="font-medium">
                                          {task.progress_percentage || 0}%
                                        </span>
                                      </div>
                                    </div>
                                  </TooltipContent>
                                </Tooltip>
                              );
                            })}
                          </TooltipProvider>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        </div>
        
        {/* Legend */}
        <div className="border-t p-4 bg-muted/20">
          <div className="flex flex-wrap items-center justify-center gap-4 text-xs">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-success"></div>
              <span>Completed</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-primary"></div>
              <span>In Progress</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-muted-foreground/50"></div>
              <span>To Do</span>
            </div>
            <div className="h-4 w-px bg-border mx-2"></div>
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="bg-destructive text-white h-4 text-[10px]">
                High
              </Badge>
              <Badge variant="secondary" className="bg-warning text-white h-4 text-[10px]">
                Med
              </Badge>
              <Badge variant="secondary" className="bg-success text-white h-4 text-[10px]">
                Low
              </Badge>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

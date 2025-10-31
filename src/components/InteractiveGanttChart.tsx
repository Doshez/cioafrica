import { useEffect, useState, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  Calendar, 
  ChevronLeft, 
  ChevronRight,
  Download,
  Filter,
  User,
  CheckCircle2,
  Clock,
  Circle,
  Flag,
  AlertCircle,
  X
} from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { supabase } from '@/integrations/supabase/client';
import { format, eachDayOfInterval, differenceInDays, addDays, isToday } from 'date-fns';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { useToast } from '@/hooks/use-toast';

interface Task {
  id: string;
  title: string;
  description?: string;
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

// Department color palette
const DEPT_COLORS = [
  '#3B82F6', '#F59E0B', '#10B981', '#8B5CF6', '#EF4444',
  '#06B6D4', '#F97316', '#84CC16', '#EC4899', '#6366F1'
];

export function InteractiveGanttChart({ projectId }: InteractiveGanttChartProps) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [assignedUsers, setAssignedUsers] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>('week');
  const [scrollOffset, setScrollOffset] = useState(0);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [filterDepartment, setFilterDepartment] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const chartRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

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
      toast({
        title: 'Error',
        description: 'Failed to load Gantt chart data',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  // Department color mapping
  const getDepartmentColor = (deptId: string) => {
    const index = departments.findIndex(d => d.id === deptId);
    return DEPT_COLORS[index % DEPT_COLORS.length];
  };

  // Filter tasks
  const filteredTasks = useMemo(() => {
    return tasks.filter(task => {
      if (filterDepartment !== 'all' && task.assignee_department_id !== filterDepartment) {
        return false;
      }
      if (filterStatus !== 'all' && task.status !== filterStatus) {
        return false;
      }
      return true;
    });
  }, [tasks, filterDepartment, filterStatus]);

  const dateRange = useMemo(() => {
    if (filteredTasks.length === 0) return [];
    
    const allStartDates = filteredTasks.map(t => new Date(t.start_date));
    const allDueDates = filteredTasks.map(t => new Date(t.due_date));
    const minDate = new Date(Math.min(...allStartDates.map(d => d.getTime())));
    const maxDate = new Date(Math.max(...allDueDates.map(d => d.getTime())));
    
    // Add padding
    const paddedStart = addDays(minDate, -7);
    const paddedEnd = addDays(maxDate, 7);
    
    return eachDayOfInterval({ start: paddedStart, end: paddedEnd });
  }, [filteredTasks]);

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

  const handleExportPDF = async () => {
    if (!chartRef.current) return;
    
    try {
      toast({
        title: 'Generating PDF...',
        description: 'Please wait while we export your Gantt chart'
      });

      const canvas = await html2canvas(chartRef.current, {
        scale: 2,
        backgroundColor: '#ffffff'
      });
      
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({
        orientation: 'landscape',
        unit: 'px',
        format: [canvas.width, canvas.height]
      });
      
      pdf.addImage(imgData, 'PNG', 0, 0, canvas.width, canvas.height);
      pdf.save(`gantt-chart-${format(new Date(), 'yyyy-MM-dd')}.pdf`);
      
      toast({
        title: 'Success!',
        description: 'Gantt chart exported successfully'
      });
    } catch (error) {
      console.error('Export error:', error);
      toast({
        title: 'Export failed',
        description: 'Failed to export Gantt chart',
        variant: 'destructive'
      });
    }
  };

  // Get today's position
  const getTodayPosition = () => {
    if (visibleDays.length === 0) return null;
    const today = new Date();
    const firstDay = visibleDays[0];
    const lastDay = visibleDays[visibleDays.length - 1];
    
    if (today < firstDay || today > lastDay) return null;
    
    const daysSinceStart = differenceInDays(today, firstDay);
    const cellWidth = 100 / visibleDays.length;
    return `${daysSinceStart * cellWidth}%`;
  };

  const todayPosition = getTodayPosition();

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
    <>
      <Card className="w-full overflow-hidden" ref={chartRef}>
        <CardHeader>
          <div className="flex flex-col gap-4">
            {/* Header Row */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5 text-primary" />
                Interactive Gantt Chart
              </CardTitle>
              
              <div className="flex items-center gap-2 flex-wrap">
                {/* View Mode Toggle */}
                <div className="flex items-center gap-1 border rounded-lg p-1 bg-muted/30">
                  <Button
                    variant={viewMode === 'day' ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => setViewMode('day')}
                    className="h-8 text-xs"
                  >
                    Day
                  </Button>
                  <Button
                    variant={viewMode === 'week' ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => setViewMode('week')}
                    className="h-8 text-xs"
                  >
                    Week
                  </Button>
                  <Button
                    variant={viewMode === 'month' ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => setViewMode('month')}
                    className="h-8 text-xs"
                  >
                    Month
                  </Button>
                </div>
                
                {/* Scroll Controls */}
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

                {/* Export Button */}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleExportPDF}
                  className="h-8 gap-2"
                >
                  <Download className="h-4 w-4" />
                  Export
                </Button>
              </div>
            </div>

            {/* Filters Row */}
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Filters:</span>
              </div>
              
              <Select value={filterDepartment} onValueChange={setFilterDepartment}>
                <SelectTrigger className="w-[180px] h-8">
                  <SelectValue placeholder="All Departments" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Departments</SelectItem>
                  {departments.map(dept => (
                    <SelectItem key={dept.id} value={dept.id}>
                      <div className="flex items-center gap-2">
                        <div 
                          className="h-3 w-3 rounded-full" 
                          style={{ backgroundColor: getDepartmentColor(dept.id) }}
                        />
                        {dept.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="w-[150px] h-8">
                  <SelectValue placeholder="All Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="todo">To Do</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                </SelectContent>
              </Select>

              {(filterDepartment !== 'all' || filterStatus !== 'all') && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setFilterDepartment('all');
                    setFilterStatus('all');
                  }}
                  className="h-8 gap-1"
                >
                  <X className="h-3 w-3" />
                  Clear
                </Button>
              )}
            </div>

            {/* Department Legend */}
            <div className="flex flex-wrap items-center gap-3 p-3 rounded-lg bg-muted/30">
              <span className="text-sm font-medium text-muted-foreground">Departments:</span>
              {departments.map(dept => (
                <div key={dept.id} className="flex items-center gap-2 text-sm">
                  <div 
                    className="h-3 w-3 rounded-full shadow-sm" 
                    style={{ backgroundColor: getDepartmentColor(dept.id) }}
                  />
                  <span>{dept.name}</span>
                </div>
              ))}
            </div>
          </div>
        </CardHeader>
        
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            {/* Timeline Header */}
            <div className="flex border-b bg-muted/30 sticky top-0 z-10">
              <div className="w-48 lg:w-64 border-r px-4 py-3 font-semibold flex-shrink-0 bg-muted/50">
                Department / Task
              </div>
              <div className="flex-1 relative min-w-[600px]">
                <div className="flex h-full">
                  {visibleDays.map((date, idx) => {
                    const isTodayDate = isToday(date);
                    return (
                      <motion.div
                        key={idx}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ duration: 0.2, delay: idx * 0.01 }}
                        className={`flex-1 border-r px-2 py-3 text-center text-xs ${
                          isTodayDate ? 'bg-primary/10' : ''
                        }`}
                        style={{ minWidth: '40px' }}
                      >
                        <div className={`font-semibold ${isTodayDate ? 'text-primary' : 'text-foreground'}`}>
                          {format(date, 'd')}
                        </div>
                        <div className={isTodayDate ? 'text-primary' : 'text-muted-foreground'}>
                          {format(date, 'EEE')}
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Timeline Body */}
            <div className="divide-y">
              <AnimatePresence>
                {departments.map((dept, deptIdx) => {
                  const deptTasks = filteredTasks.filter(t => t.assignee_department_id === dept.id);
                  
                  if (deptTasks.length === 0) return null;
                  
                  const deptColor = getDepartmentColor(dept.id);
                  
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
                          <div className="flex items-center gap-2">
                            <div 
                              className="h-4 w-4 rounded-full shadow-sm flex-shrink-0" 
                              style={{ backgroundColor: deptColor }}
                            />
                            <div className="min-w-0 flex-1">
                              <div className="font-semibold text-sm truncate">
                                {dept.name}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {deptTasks.length} task{deptTasks.length !== 1 ? 's' : ''}
                              </div>
                            </div>
                          </div>
                        </div>
                        <div className="flex-1 relative min-h-[120px] p-4" style={{ minWidth: '600px' }}>
                          {/* Timeline Grid */}
                          <div className="absolute inset-0 flex">
                            {visibleDays.map((date, idx) => (
                              <div
                                key={idx}
                                className={`flex-1 border-r border-border/50 ${
                                  isToday(date) ? 'bg-primary/5' : ''
                                }`}
                                style={{ minWidth: '40px' }}
                              />
                            ))}
                          </div>
                          
                          {/* Today Marker */}
                          {todayPosition && (
                            <motion.div
                              initial={{ opacity: 0, scaleY: 0 }}
                              animate={{ opacity: 1, scaleY: 1 }}
                              className="absolute top-0 bottom-0 w-0.5 bg-primary z-20 shadow-glow"
                              style={{ left: todayPosition }}
                            >
                              <div className="absolute -top-2 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground text-[10px] px-2 py-0.5 rounded-full whitespace-nowrap font-semibold">
                                Today
                              </div>
                            </motion.div>
                          )}
                          
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
                                        onClick={() => setSelectedTask(task)}
                                        className="absolute cursor-pointer rounded-lg overflow-hidden shadow-md hover:shadow-lg transition-smooth"
                                        style={{
                                          ...position,
                                          height: '40px',
                                          top: `${taskIdx * 48}px`,
                                          background: `linear-gradient(135deg, ${deptColor}E6, ${deptColor}B3)`
                                        }}
                                      >
                                        {/* Progress Bar */}
                                        <motion.div
                                          initial={{ width: 0 }}
                                          animate={{ width: `${task.progress_percentage || 0}%` }}
                                          transition={{ duration: 0.8, delay: 0.3 }}
                                          className="absolute inset-0 bg-white/30"
                                        />
                                        
                                        {/* Task Content */}
                                        <div className="relative h-full px-3 flex items-center justify-between gap-2 text-white">
                                          <div className="flex items-center gap-2 min-w-0 flex-1">
                                            <StatusIcon className="h-3.5 w-3.5 flex-shrink-0" />
                                            <span className="text-xs font-semibold truncate">
                                              {task.title}
                                            </span>
                                          </div>
                                          <Badge 
                                            variant="secondary" 
                                            className="bg-white/90 text-foreground text-[10px] px-1.5 py-0 h-5 flex-shrink-0"
                                          >
                                            {task.progress_percentage || 0}%
                                          </Badge>
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
                                              {format(new Date(task.start_date), 'MMM d')}
                                            </p>
                                          </div>
                                          <div>
                                            <span className="text-muted-foreground">Due:</span>
                                            <p className="font-medium">
                                              {format(new Date(task.due_date), 'MMM d')}
                                            </p>
                                          </div>
                                        </div>
                                        <p className="text-xs text-muted-foreground">
                                          Click to view details
                                        </p>
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
        </CardContent>
      </Card>

      {/* Task Detail Modal */}
      <Dialog open={!!selectedTask} onOpenChange={() => setSelectedTask(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-start gap-3 pr-8">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 200 }}
                className="p-2 rounded-lg bg-gradient-to-br from-primary/20 to-accent/20"
              >
                <AlertCircle className="h-6 w-6 text-primary" />
              </motion.div>
              <div className="flex-1">
                <h2 className="text-xl font-bold leading-tight">{selectedTask?.title}</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  {selectedTask && departments.find(d => d.id === selectedTask.assignee_department_id)?.name}
                </p>
              </div>
            </DialogTitle>
          </DialogHeader>

          {selectedTask && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
              className="space-y-6 pt-4"
            >
              {/* Status & Priority Row */}
              <div className="flex flex-wrap gap-4">
                <div className="flex items-center gap-2 bg-muted/50 px-4 py-2 rounded-lg">
                  {getStatusIcon(selectedTask.status) === CheckCircle2 && (
                    <CheckCircle2 className="h-5 w-5 text-success" />
                  )}
                  {getStatusIcon(selectedTask.status) === Clock && (
                    <Clock className="h-5 w-5 text-primary" />
                  )}
                  {getStatusIcon(selectedTask.status) === Circle && (
                    <Circle className="h-5 w-5 text-muted-foreground" />
                  )}
                  <div>
                    <p className="text-xs text-muted-foreground">Status</p>
                    <p className="font-semibold capitalize">
                      {selectedTask.status.replace('_', ' ')}
                    </p>
                  </div>
                </div>
                
                <div className="flex items-center gap-2 bg-muted/50 px-4 py-2 rounded-lg">
                  <Flag className={`h-5 w-5 ${
                    selectedTask.priority === 'high' ? 'text-destructive' :
                    selectedTask.priority === 'medium' ? 'text-warning' : 'text-success'
                  }`} />
                  <div>
                    <p className="text-xs text-muted-foreground">Priority</p>
                    <p className="font-semibold capitalize">{selectedTask.priority}</p>
                  </div>
                </div>
              </div>

              {/* Progress */}
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Progress</span>
                  <span className="font-semibold">{selectedTask.progress_percentage || 0}%</span>
                </div>
                <Progress value={selectedTask.progress_percentage || 0} className="h-3" />
              </div>

              {/* Timeline */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2 p-4 rounded-lg border bg-card">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Calendar className="h-4 w-4" />
                    <span className="text-sm">Start Date</span>
                  </div>
                  <p className="font-semibold text-lg">
                    {format(new Date(selectedTask.start_date), 'MMM d, yyyy')}
                  </p>
                </div>
                
                <div className="space-y-2 p-4 rounded-lg border bg-card">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Calendar className="h-4 w-4" />
                    <span className="text-sm">Due Date</span>
                  </div>
                  <p className="font-semibold text-lg">
                    {format(new Date(selectedTask.due_date), 'MMM d, yyyy')}
                  </p>
                </div>
              </div>

              {/* Assignee */}
              {selectedTask.assignee_user_id && assignedUsers[selectedTask.assignee_user_id] && (
                <div className="flex items-center gap-3 p-4 rounded-lg border bg-card">
                  <div className="h-10 w-10 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center text-primary-foreground font-semibold">
                    {assignedUsers[selectedTask.assignee_user_id].charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Assigned to</p>
                    <p className="font-semibold">{assignedUsers[selectedTask.assignee_user_id]}</p>
                  </div>
                </div>
              )}

              {/* Description */}
              {selectedTask.description && (
                <div className="space-y-2">
                  <h3 className="font-semibold flex items-center gap-2">
                    <div className="h-1 w-1 rounded-full bg-primary" />
                    Description
                  </h3>
                  <p className="text-sm text-muted-foreground leading-relaxed p-4 rounded-lg bg-muted/30">
                    {selectedTask.description}
                  </p>
                </div>
              )}
            </motion.div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

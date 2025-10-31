import { useEffect, useState, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { GanttAnalyticsView } from '@/components/GanttAnalyticsView';
import { ExpandableElementRow } from '@/components/ExpandableElementRow';
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
  X,
  BarChart3,
  GanttChartSquare,
  FileSpreadsheet,
  FileText
} from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { supabase } from '@/integrations/supabase/client';
import { 
  format, 
  eachDayOfInterval, 
  differenceInDays, 
  addDays, 
  isToday,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  isSameWeek,
  isSameMonth,
  getWeek
} from 'date-fns';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import * as XLSX from 'xlsx';
import { useToast } from '@/hooks/use-toast';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface Task {
  id: string;
  title: string;
  assignee?: string;
  start_date: string;
  due_date: string;
  progress_percentage: number;
  status: string;
}

interface Element {
  id: string;
  title: string;
  description?: string;
  departmentId: string;
  priority?: string;
  start_date?: string;
  due_date?: string;
  tasks: Task[];
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
type ChartMode = 'gantt' | 'analytics';

// Department color palette
const DEPT_COLORS = [
  '#3B82F6', '#F59E0B', '#10B981', '#8B5CF6', '#EF4444',
  '#06B6D4', '#F97316', '#84CC16', '#EC4899', '#6366F1'
];

export function InteractiveGanttChart({ projectId }: InteractiveGanttChartProps) {
  const [elements, setElements] = useState<Element[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [viewMode, setViewMode] = useState<ViewMode>('week');
  const [chartMode, setChartMode] = useState<ChartMode>('gantt');
  const [scrollOffset, setScrollOffset] = useState<number>(0);
  const [selectedElement, setSelectedElement] = useState<Element | null>(null);
  const [filterDepartment, setFilterDepartment] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [expandedElements, setExpandedElements] = useState<Set<string>>(new Set());
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

      // Fetch elements from database
      const { data: elementsData, error: elementsError } = await supabase
        .from('elements')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at');

      if (elementsError) throw elementsError;

      // Fetch tasks with valid dates
      const { data: tasksData, error: tasksError } = await supabase
        .from('tasks')
        .select('*')
        .eq('project_id', projectId)
        .not('start_date', 'is', null)
        .not('due_date', 'is', null)
        .order('start_date');

      if (tasksError) throw tasksError;
      
      // Fetch user profiles for assignees
      const userIds = [...new Set(
        (tasksData || [])
          .map((t: any) => t.assignee_user_id)
          .filter(Boolean)
      )] as string[];
      
      const userMap: Record<string, string> = {};
      if (userIds.length > 0) {
        const { data: userData } = await supabase
          .from('profiles')
          .select('id, full_name')
          .in('id', userIds);
        
        if (userData) {
          userData.forEach(user => {
            userMap[user.id] = user.full_name || 'Unknown User';
          });
        }
      }
      
      // Group tasks by their element_id
      const elementsMap = new Map<string, Element>();
      
      // First, add all database elements
      (elementsData || []).forEach((element: any) => {
        elementsMap.set(element.id, {
          id: element.id,
          title: element.title,
          description: element.description,
          departmentId: element.department_id,
          priority: element.priority,
          start_date: element.start_date,
          due_date: element.due_date,
          tasks: []
        });
      });
      
      // Create a default element for tasks without an element_id
      const ungroupedTasks: Task[] = [];
      
      // Add tasks to their respective elements
      (tasksData || []).forEach((task: any) => {
        if (!task.start_date || !task.due_date) return;
        
        const taskObj: Task = {
          id: task.id,
          title: task.title,
          assignee: task.assignee_user_id ? (userMap[task.assignee_user_id] || 'Unassigned') : 'Unassigned',
          start_date: task.start_date,
          due_date: task.due_date,
          progress_percentage: task.progress_percentage || 0,
          status: task.status
        };
        
        if (task.element_id && elementsMap.has(task.element_id)) {
          elementsMap.get(task.element_id)!.tasks.push(taskObj);
        } else {
          // Task doesn't have an element or element not found
          ungroupedTasks.push(taskObj);
        }
      });
      
      // Create default elements for ungrouped tasks by department
      const ungroupedByDept = new Map<string, Task[]>();
      ungroupedTasks.forEach(task => {
        const deptId = (tasksData || []).find((t: any) => t.id === task.id)?.assignee_department_id;
        if (deptId) {
          if (!ungroupedByDept.has(deptId)) {
            ungroupedByDept.set(deptId, []);
          }
          ungroupedByDept.get(deptId)!.push(task);
        }
      });
      
      // Create default elements for ungrouped tasks
      ungroupedByDept.forEach((tasks, deptId) => {
        const dept = deptData?.find(d => d.id === deptId);
        const defaultElementId = `ungrouped-${deptId}`;
        
        const taskDates = tasks.map(t => new Date(t.start_date).getTime());
        const taskDueDates = tasks.map(t => new Date(t.due_date).getTime());
        
        elementsMap.set(defaultElementId, {
          id: defaultElementId,
          title: `${dept?.name || 'Ungrouped'} Tasks`,
          description: 'Tasks without an assigned element',
          departmentId: deptId,
          priority: 'medium',
          start_date: format(new Date(Math.min(...taskDates)), 'yyyy-MM-dd'),
          due_date: format(new Date(Math.max(...taskDueDates)), 'yyyy-MM-dd'),
          tasks: tasks
        });
      });
      
      // Calculate dates for elements that don't have them set
      const elementsArray = Array.from(elementsMap.values()).map(element => {
        if (element.tasks.length > 0 && (!element.start_date || !element.due_date)) {
          const taskDates = element.tasks.map(t => new Date(t.start_date).getTime());
          const taskDueDates = element.tasks.map(t => new Date(t.due_date).getTime());
          
          return {
            ...element,
            start_date: element.start_date || format(new Date(Math.min(...taskDates)), 'yyyy-MM-dd'),
            due_date: element.due_date || format(new Date(Math.max(...taskDueDates)), 'yyyy-MM-dd')
          };
        }
        return element;
      }).filter(element => element.tasks.length > 0); // Only show elements with tasks
      
      setElements(elementsArray);
      
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

  // Toggle element expansion
  const toggleElementExpansion = (elementId: string) => {
    setExpandedElements(prev => {
      const newSet = new Set(prev);
      if (newSet.has(elementId)) {
        newSet.delete(elementId);
      } else {
        newSet.add(elementId);
      }
      return newSet;
    });
  };

  // Filter elements
  const filteredElements = useMemo(() => {
    return elements.filter(element => {
      if (filterDepartment !== 'all' && element.departmentId !== filterDepartment) {
        return false;
      }
      if (filterStatus !== 'all') {
        // Filter by task status within element
        const hasMatchingStatus = element.tasks.some(task => task.status === filterStatus);
        if (!hasMatchingStatus) return false;
      }
      return true;
    });
  }, [elements, filterDepartment, filterStatus]);

  const dateRange = useMemo(() => {
    if (filteredElements.length === 0) return [];
    
    const allDates = filteredElements.flatMap(element => 
      element.tasks.map(task => [new Date(task.start_date), new Date(task.due_date)])
    ).flat();
    
    if (allDates.length === 0) return [];
    
    const minDate = new Date(Math.min(...allDates.map(d => d.getTime())));
    const maxDate = new Date(Math.max(...allDates.map(d => d.getTime())));
    
    // Add padding
    const paddedStart = addDays(minDate, -7);
    const paddedEnd = addDays(maxDate, 7);
    
    return eachDayOfInterval({ start: paddedStart, end: paddedEnd });
  }, [filteredElements]);

  const visibleDays = useMemo(() => {
    const daysToShow = viewMode === 'day' ? 14 : viewMode === 'week' ? 30 : 60;
    return dateRange.slice(scrollOffset, scrollOffset + daysToShow);
  }, [dateRange, scrollOffset, viewMode]);

  // Status-to-Color Mapping (supports both old and new status formats)
  const getStatusColor = (status?: string): string => {
    switch (status) {
      case 'done':
      case 'completed':
        return '#10B981'; // Green
      case 'in-progress':
      case 'in_progress':
        return '#3B82F6'; // Blue
      case 'not-started':
      case 'todo':
      default:
        return '#9CA3AF'; // Gray
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

  const calculatePosition = (item: { start_date: string; due_date: string }) => {
    if (visibleDays.length === 0) return null;
    
    const startDate = new Date(item.start_date);
    const dueDate = new Date(item.due_date);
    const firstVisibleDay = visibleDays[0];
    const lastVisibleDay = visibleDays[visibleDays.length - 1];
    
    // Check if item overlaps with visible range
    if (dueDate < firstVisibleDay || startDate > lastVisibleDay) {
      return null;
    }
    
    const itemStart = startDate < firstVisibleDay ? firstVisibleDay : startDate;
    const itemEnd = dueDate > lastVisibleDay ? lastVisibleDay : dueDate;
    
    const startIndex = differenceInDays(itemStart, firstVisibleDay);
    const duration = differenceInDays(itemEnd, itemStart) + 1;
    
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
        description: 'Gantt chart exported as PDF'
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

  const handleExportExcel = () => {
    try {
      toast({
        title: 'Generating Excel...',
        description: 'Please wait while we export your Gantt chart'
      });

      // Prepare data for Excel export with elements and tasks
      const excelData: any[] = [];
      
      filteredElements.forEach(element => {
        const dept = departments.find(d => d.id === element.departmentId);
        
        // Add element header row
        excelData.push({
          'Department': dept?.name || 'Unknown',
          'Element Title': element.title,
          'Task Title': '',
          'Description': element.description || '',
          'Status': '',
          'Priority': element.priority?.toUpperCase() || '',
          'Progress (%)': '',
          'Start Date': element.start_date ? format(new Date(element.start_date), 'yyyy-MM-dd') : '',
          'Due Date': element.due_date ? format(new Date(element.due_date), 'yyyy-MM-dd') : '',
          'Duration (days)': element.start_date && element.due_date ? 
            differenceInDays(new Date(element.due_date), new Date(element.start_date)) + 1 : '',
          'Assigned To': ''
        });

        // Add task rows under element
        element.tasks.forEach(task => {
          const taskDuration = differenceInDays(new Date(task.due_date), new Date(task.start_date)) + 1;
          excelData.push({
            'Department': dept?.name || 'Unknown',
            'Element Title': element.title,
            'Task Title': task.title,
            'Description': '',
            'Status': task.status.replace('_', ' ').toUpperCase(),
            'Priority': element.priority?.toUpperCase() || '',
            'Progress (%)': task.progress_percentage || 0,
            'Start Date': format(new Date(task.start_date), 'yyyy-MM-dd'),
            'Due Date': format(new Date(task.due_date), 'yyyy-MM-dd'),
            'Duration (days)': taskDuration,
            'Assigned To': task.assignee || 'Unassigned'
          });
        });
      });

      // Create worksheet
      const ws = XLSX.utils.json_to_sheet(excelData);

      // Set column widths
      const colWidths = [
        { wch: 20 }, // Department
        { wch: 30 }, // Element Title
        { wch: 30 }, // Task Title
        { wch: 40 }, // Description
        { wch: 15 }, // Status
        { wch: 10 }, // Priority
        { wch: 12 }, // Progress
        { wch: 12 }, // Start Date
        { wch: 12 }, // Due Date
        { wch: 15 }, // Duration
        { wch: 20 }, // Assigned To
      ];
      ws['!cols'] = colWidths;

      // Create workbook and add worksheet
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Gantt Chart');

      // Add analytics sheet
      const analyticsData = departmentAnalytics.map(analytics => {
        const dept = departments.find(d => d.id === analytics.departmentId);
        const deptElements = filteredElements.filter(e => e.departmentId === analytics.departmentId);
        const allTasks = deptElements.flatMap(e => e.tasks);
        return {
          'Department': analytics.departmentName,
          'Total Tasks': analytics.totalTasks,
          'Completed Tasks': analytics.completedTasks,
          'In Progress': allTasks.filter(t => t.status === 'in_progress').length,
          'To Do': allTasks.filter(t => t.status === 'todo').length,
          'Completion (%)': analytics.percentage
        };
      });

      const wsAnalytics = XLSX.utils.json_to_sheet(analyticsData);
      wsAnalytics['!cols'] = [
        { wch: 20 },
        { wch: 12 },
        { wch: 15 },
        { wch: 12 },
        { wch: 10 },
        { wch: 15 }
      ];
      XLSX.utils.book_append_sheet(wb, wsAnalytics, 'Analytics');

      // Save file
      XLSX.writeFile(wb, `gantt-chart-${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
      
      toast({
        title: 'Success!',
        description: 'Gantt chart exported as Excel'
      });
    } catch (error) {
      console.error('Excel export error:', error);
      toast({
        title: 'Export failed',
        description: 'Failed to export Excel file',
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

  // Analytics calculations
  const departmentAnalytics = useMemo(() => {
    return departments.map(dept => {
      const deptElements = filteredElements.filter(e => e.departmentId === dept.id);
      const allTasks = deptElements.flatMap(e => e.tasks);
      const completed = allTasks.filter(t => t.status === 'completed').length;
      const total = allTasks.length;
      const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;
      
      return {
        departmentId: dept.id,
        departmentName: dept.name,
        totalTasks: total,
        completedTasks: completed,
        percentage
      };
    });
  }, [departments, filteredElements]);

  // Daily task count
  const dailyTaskCounts = useMemo(() => {
    const days: Record<string, number> = {};
    
    visibleDays.forEach(date => {
      const dayKey = format(date, 'yyyy-MM-dd');
      const tasksOnDay = filteredElements.flatMap(element => 
        element.tasks.filter(task => {
          const start = new Date(task.start_date);
          const due = new Date(task.due_date);
          return date >= start && date <= due;
        })
      );
      
      days[dayKey] = tasksOnDay.length;
    });
    
    return days;
  }, [visibleDays, filteredElements]);

  // Group dates for timeline header based on view mode
  const timelineGroups = useMemo(() => {
    if (visibleDays.length === 0) return [];

    if (viewMode === 'day') {
      // Return each day individually
      return visibleDays.map(date => ({
        key: format(date, 'yyyy-MM-dd'),
        label: format(date, 'd'),
        sublabel: format(date, 'EEE'),
        dates: [date],
        isToday: isToday(date)
      }));
    } else if (viewMode === 'week') {
      // Group by weeks
      const groups: Array<{
        key: string;
        label: string;
        sublabel: string;
        dates: Date[];
        isToday: boolean;
      }> = [];
      
      let currentWeekStart: Date | null = null;
      let currentWeekDates: Date[] = [];
      
      visibleDays.forEach((date, idx) => {
        const weekStart = startOfWeek(date, { weekStartsOn: 1 });
        
        if (!currentWeekStart || !isSameWeek(date, currentWeekStart, { weekStartsOn: 1 })) {
          if (currentWeekDates.length > 0) {
            const weekEnd = endOfWeek(currentWeekStart!, { weekStartsOn: 1 });
            groups.push({
              key: format(currentWeekStart!, 'yyyy-MM-dd'),
              label: `W${getWeek(currentWeekStart!, { weekStartsOn: 1 })}`,
              sublabel: `${format(currentWeekStart!, 'MMM d')} - ${format(weekEnd, 'd')}`,
              dates: currentWeekDates,
              isToday: currentWeekDates.some(d => isToday(d))
            });
          }
          currentWeekStart = weekStart;
          currentWeekDates = [date];
        } else {
          currentWeekDates.push(date);
        }
        
        // Push last group
        if (idx === visibleDays.length - 1) {
          const weekEnd = endOfWeek(currentWeekStart!, { weekStartsOn: 1 });
          groups.push({
            key: format(currentWeekStart!, 'yyyy-MM-dd'),
            label: `W${getWeek(currentWeekStart!, { weekStartsOn: 1 })}`,
            sublabel: `${format(currentWeekStart!, 'MMM d')} - ${format(weekEnd, 'd')}`,
            dates: currentWeekDates,
            isToday: currentWeekDates.some(d => isToday(d))
          });
        }
      });
      
      return groups;
    } else {
      // Month view - Group by months
      const groups: Array<{
        key: string;
        label: string;
        sublabel: string;
        dates: Date[];
        isToday: boolean;
      }> = [];
      
      let currentMonthStart: Date | null = null;
      let currentMonthDates: Date[] = [];
      
      visibleDays.forEach((date, idx) => {
        const monthStart = startOfMonth(date);
        
        if (!currentMonthStart || !isSameMonth(date, currentMonthStart)) {
          if (currentMonthDates.length > 0) {
            groups.push({
              key: format(currentMonthStart!, 'yyyy-MM'),
              label: format(currentMonthStart!, 'MMM'),
              sublabel: format(currentMonthStart!, 'yyyy'),
              dates: currentMonthDates,
              isToday: currentMonthDates.some(d => isToday(d))
            });
          }
          currentMonthStart = monthStart;
          currentMonthDates = [date];
        } else {
          currentMonthDates.push(date);
        }
        
        // Push last group
        if (idx === visibleDays.length - 1) {
          groups.push({
            key: format(currentMonthStart!, 'yyyy-MM'),
            label: format(currentMonthStart!, 'MMM'),
            sublabel: format(currentMonthStart!, 'yyyy'),
            dates: currentMonthDates,
            isToday: currentMonthDates.some(d => isToday(d))
          });
        }
      });
      
      return groups;
    }
  }, [visibleDays, viewMode]);

  if (loading) {
    return (
      <div className="w-full">
        <Card className="rounded-none border-x-0">
          <CardContent className="py-12 text-center">
            <div className="animate-pulse space-y-4">
              <div className="h-8 bg-muted rounded w-1/4 mx-auto"></div>
              <div className="h-64 bg-muted rounded"></div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (elements.length === 0) {
    return (
      <div className="w-full">
        <Card className="rounded-none border-x-0">
          <CardContent className="py-12 text-center text-muted-foreground">
            <Calendar className="h-16 w-16 mx-auto mb-4 opacity-50" />
            <p className="text-lg font-semibold">No tasks with dates found</p>
            <p className="text-sm">Create tasks with start and due dates to see the Gantt chart</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <>
      <Card className="w-full rounded-none border-x-0 overflow-hidden" ref={chartRef}>
        <CardHeader className="px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-4">
            {/* Header Row */}
            <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
              <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
                <Calendar className="h-5 w-5 text-primary flex-shrink-0" />
                <span className="truncate">Interactive Gantt Chart</span>
              </CardTitle>
              
              <div className="flex items-center gap-2 flex-wrap w-full lg:w-auto">
                {/* Chart Mode Toggle */}
                <div className="flex items-center gap-1 border rounded-lg p-1 bg-muted/30">
                  <Button
                    variant={chartMode === 'gantt' ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => setChartMode('gantt')}
                    className="h-8 text-xs gap-1.5"
                  >
                    <GanttChartSquare className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">Gantt</span>
                  </Button>
                  <Button
                    variant={chartMode === 'analytics' ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => setChartMode('analytics')}
                    className="h-8 text-xs gap-1.5"
                  >
                    <BarChart3 className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">Analytics</span>
                  </Button>
                </div>
                {/* View Mode Toggle */}
                <div className="flex items-center gap-1 border rounded-lg p-1 bg-muted/30">
                  <Button
                    variant={viewMode === 'day' ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => setViewMode('day')}
                    className="h-8 text-xs px-2 sm:px-3"
                  >
                    Day
                  </Button>
                  <Button
                    variant={viewMode === 'week' ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => setViewMode('week')}
                    className="h-8 text-xs px-2 sm:px-3"
                  >
                    Week
                  </Button>
                  <Button
                    variant={viewMode === 'month' ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => setViewMode('month')}
                    className="h-8 text-xs px-2 sm:px-3"
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

                {/* Export Dropdown */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 gap-2"
                    >
                      <Download className="h-4 w-4" />
                      <span className="hidden sm:inline">Export</span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="z-50 bg-background">
                    <DropdownMenuItem onClick={handleExportPDF}>
                      <FileText className="h-4 w-4 mr-2" />
                      Export as PDF
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={handleExportExcel}>
                      <FileSpreadsheet className="h-4 w-4 mr-2" />
                      Export as Excel
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>

            {/* Filters Row */}
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium hidden sm:inline">Filters:</span>
              </div>
              
              <Select value={filterDepartment} onValueChange={setFilterDepartment}>
                <SelectTrigger className="w-[140px] sm:w-[180px] h-8">
                  <SelectValue placeholder="All Departments" />
                </SelectTrigger>
                <SelectContent className="z-50 bg-background">
                  <SelectItem value="all">All Departments</SelectItem>
                  {departments.map(dept => (
                    <SelectItem key={dept.id} value={dept.id}>
                      <div className="flex items-center gap-2">
                        <div 
                          className="h-3 w-3 rounded-full" 
                          style={{ backgroundColor: getDepartmentColor(dept.id) }}
                        />
                        <span className="truncate">{dept.name}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="w-[120px] sm:w-[150px] h-8">
                  <SelectValue placeholder="All Status" />
                </SelectTrigger>
                <SelectContent className="z-50 bg-background">
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
                  <span className="hidden sm:inline">Clear</span>
                </Button>
              )}
            </div>

            {/* Department Legend with Analytics */}
            <div className="flex flex-wrap items-center gap-2 sm:gap-3 p-2 sm:p-3 rounded-lg bg-muted/30">
              <span className="text-xs sm:text-sm font-medium text-muted-foreground">Depts:</span>
              {departmentAnalytics.map(analytics => {
                const dept = departments.find(d => d.id === analytics.departmentId);
                if (!dept) return null;
                return (
                  <div key={dept.id} className="flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm">
                    <div 
                      className="h-2.5 w-2.5 sm:h-3 sm:w-3 rounded-full shadow-sm flex-shrink-0" 
                      style={{ backgroundColor: getDepartmentColor(dept.id) }}
                    />
                    <span className="truncate max-w-[80px] sm:max-w-none">{dept.name}</span>
                    {chartMode === 'analytics' && (
                      <Badge variant="secondary" className="text-[10px] sm:text-xs h-4 sm:h-5 px-1 sm:px-2">
                        {analytics.percentage}%
                      </Badge>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </CardHeader>
        
        <CardContent className="p-0">
          {chartMode === 'gantt' ? (
            <div className="overflow-x-auto">
              {/* Status Legend */}
              <div className="flex items-center gap-4 px-4 sm:px-6 lg:px-8 py-3 border-b bg-muted/20 text-xs">
                <span className="font-medium text-muted-foreground">Status:</span>
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 rounded-full bg-[#9CA3AF] opacity-60" />
                  <span>Not Started</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 rounded-full bg-[#3B82F6]" />
                  <span>In Progress</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 rounded-full bg-[#10B981]" />
                  <span>Completed</span>
                </div>
              </div>

              {/* Timeline Header */}
              <div className="flex border-b bg-muted/30 sticky top-0 z-10">
                <div className="w-32 sm:w-40 md:w-48 lg:w-64 border-r px-2 sm:px-3 md:px-4 py-3 flex-shrink-0 bg-muted/50">
                  <div className="grid grid-cols-2 gap-1 text-xs sm:text-sm font-semibold">
                    <div>Department / Task</div>
                    <div className="text-muted-foreground">Element</div>
                  </div>
                </div>
                <div className="flex-1 relative min-w-[400px] sm:min-w-[600px]">
                  <div className="flex h-full">
                    {timelineGroups.map((group, idx) => {
                      const width = `${(group.dates.length / visibleDays.length) * 100}%`;
                      
                      return (
                        <motion.div
                          key={group.key}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{ duration: 0.2, delay: idx * 0.01 }}
                          className={`border-r px-1 sm:px-2 py-2 sm:py-3 text-center text-[10px] sm:text-xs ${
                            group.isToday ? 'bg-primary/10' : ''
                          }`}
                          style={{ 
                            width: width,
                            minWidth: viewMode === 'day' ? '30px' : '60px'
                          }}
                        >
                          <div className={`font-semibold ${group.isToday ? 'text-primary' : 'text-foreground'}`}>
                            {group.label}
                          </div>
                          <div className={`hidden sm:block text-[9px] sm:text-[10px] ${group.isToday ? 'text-primary' : 'text-muted-foreground'}`}>
                            {group.sublabel}
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
                  const deptElements = filteredElements.filter(e => e.departmentId === dept.id);
                  
                  if (deptElements.length === 0) return null;
                  
                  const deptColor = getDepartmentColor(dept.id);
                  
                  return (
                    <motion.div
                      key={dept.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3, delay: deptIdx * 0.1 }}
                    >
                      {/* Department Header */}
                      <div className="flex border-b bg-muted/30">
                        <div className="w-32 sm:w-40 md:w-48 lg:w-64 border-r px-2 sm:px-3 md:px-4 py-3 flex-shrink-0">
                          <div className="flex items-center gap-2">
                            <div 
                              className="h-3 w-3 sm:h-4 sm:w-4 rounded-full shadow-sm flex-shrink-0" 
                              style={{ backgroundColor: deptColor }}
                            />
                            <div className="min-w-0 flex-1">
                              <div className="font-semibold text-xs sm:text-sm truncate">
                                {dept.name}
                              </div>
                              <div className="text-[10px] sm:text-xs text-muted-foreground">
                                {deptElements.length} element{deptElements.length !== 1 ? 's' : ''}
                              </div>
                            </div>
                          </div>
                        </div>
                        <div className="flex-1 relative p-2" style={{ minWidth: '400px', minHeight: '48px' }}>
                          {/* Timeline Grid Background */}
                          <div className="absolute inset-0 flex pointer-events-none">
                            {visibleDays.map((date, idx) => (
                              <div
                                key={idx}
                                className={`flex-1 border-r border-border/30 ${
                                  isToday(date) ? 'bg-primary/5' : ''
                                }`}
                                style={{ minWidth: '30px' }}
                              />
                            ))}
                          </div>
                          
                          {/* Today Marker */}
                          {todayPosition && (
                            <motion.div
                              initial={{ opacity: 0, scaleY: 0 }}
                              animate={{ opacity: 1, scaleY: 1 }}
                              className="absolute top-0 bottom-0 w-0.5 bg-primary z-20 shadow-glow pointer-events-none"
                              style={{ left: todayPosition }}
                            >
                              <div className="absolute -top-2 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground text-[10px] px-2 py-0.5 rounded-full whitespace-nowrap font-semibold">
                                Today
                              </div>
                            </motion.div>
                          )}
                        </div>
                      </div>

                      {/* Elements and their Tasks */}
                      {deptElements.map((element) => (
                        <ExpandableElementRow
                          key={element.id}
                          element={element}
                          deptColor={deptColor}
                          deptName={dept.name}
                          isExpanded={expandedElements.has(element.id)}
                          onToggleExpand={() => toggleElementExpansion(element.id)}
                          onElementClick={() => setSelectedElement(element)}
                          calculatePosition={calculatePosition}
                          getStatusIcon={getStatusIcon}
                          getStatusColor={getStatusColor}
                        />
                      ))}
                    </motion.div>
                  );
                })}
              </AnimatePresence>

              {/* Task Count per Week - Bar indicator under timeline */}
              <div className="border-t bg-muted/20">
                <div className="flex">
                  <div className="w-32 sm:w-40 md:w-48 lg:w-64 border-r px-2 sm:px-3 md:px-4 py-3 text-xs sm:text-sm font-semibold flex-shrink-0">
                    Tasks/Day
                  </div>
                  <div className="flex-1 relative min-w-[400px] sm:min-w-[600px] p-2">
                    <div className="flex h-12 sm:h-16 items-end gap-px">
                      {visibleDays.map((date, idx) => {
                        const dateKey = format(date, 'yyyy-MM-dd');
                        const count = dailyTaskCounts[dateKey] || 0;
                        const maxCount = Math.max(...Object.values(dailyTaskCounts), 1);
                        const height = (count / maxCount) * 100;
                        
                        return (
                          <TooltipProvider key={idx}>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <motion.div
                                  initial={{ height: 0 }}
                                  animate={{ height: `${height}%` }}
                                  transition={{ duration: 0.5, delay: idx * 0.02 }}
                                  className="flex-1 bg-primary/60 rounded-t-sm hover:bg-primary cursor-pointer transition-colors"
                                  style={{ minWidth: '6px' }}
                                />
                              </TooltipTrigger>
                              <TooltipContent>
                                <p className="text-xs">
                                  {format(date, 'MMM d')}: {count} task{count !== 1 ? 's' : ''}
                                </p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            </div>
            </div>
          ) : (
          <GanttAnalyticsView
            departmentAnalytics={departmentAnalytics}
            departments={departments}
            filteredElements={filteredElements}
            getDepartmentColor={getDepartmentColor}
          />
          )}
        </CardContent>
      </Card>

      {/* Element Detail Modal */}
      <Dialog open={!!selectedElement} onOpenChange={() => setSelectedElement(null)}>
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
                <h2 className="text-xl font-bold leading-tight">{selectedElement?.title}</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  {selectedElement && departments.find(d => d.id === selectedElement.departmentId)?.name}
                </p>
              </div>
            </DialogTitle>
          </DialogHeader>

          {selectedElement && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
              className="space-y-6 pt-4"
            >
              {/* Progress */}
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Overall Progress</span>
                  <span className="font-semibold">
                    {Math.round(
                      selectedElement.tasks.reduce((sum, task) => sum + (task.progress_percentage || 0), 0) / 
                      selectedElement.tasks.length
                    )}%
                  </span>
                </div>
                <Progress 
                  value={
                    selectedElement.tasks.reduce((sum, task) => sum + (task.progress_percentage || 0), 0) / 
                    selectedElement.tasks.length
                  } 
                  className="h-3" 
                />
              </div>

              {/* Timeline */}
              {selectedElement.start_date && selectedElement.due_date && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2 p-4 rounded-lg border bg-card">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Calendar className="h-4 w-4" />
                      <span className="text-sm">Start Date</span>
                    </div>
                    <p className="font-semibold text-lg">
                      {format(new Date(selectedElement.start_date), 'MMM d, yyyy')}
                    </p>
                  </div>
                  
                  <div className="space-y-2 p-4 rounded-lg border bg-card">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Calendar className="h-4 w-4" />
                      <span className="text-sm">Due Date</span>
                    </div>
                    <p className="font-semibold text-lg">
                      {format(new Date(selectedElement.due_date), 'MMM d, yyyy')}
                    </p>
                  </div>
                </div>
              )}

              {/* Tasks List */}
              <div className="space-y-2">
                <h3 className="font-semibold flex items-center gap-2">
                  <div className="h-1 w-1 rounded-full bg-primary" />
                  Tasks ({selectedElement.tasks.length})
                </h3>
                <div className="space-y-2">
                  {selectedElement.tasks.map(task => (
                    <div key={task.id} className="p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 flex-1">
                          {getStatusIcon(task.status) === CheckCircle2 && (
                            <CheckCircle2 className="h-4 w-4 text-success" />
                          )}
                          {getStatusIcon(task.status) === Clock && (
                            <Clock className="h-4 w-4 text-primary" />
                          )}
                          {getStatusIcon(task.status) === Circle && (
                            <Circle className="h-4 w-4 text-muted-foreground" />
                          )}
                          <span className="text-sm font-medium">{task.title}</span>
                        </div>
                        <Badge variant="secondary" className="text-xs">
                          {task.progress_percentage || 0}%
                        </Badge>
                      </div>
                      {task.assignee && (
                        <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                          <User className="h-3 w-3" />
                          <span>{task.assignee}</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Description */}
              {selectedElement.description && (
                <div className="space-y-2">
                  <h3 className="font-semibold flex items-center gap-2">
                    <div className="h-1 w-1 rounded-full bg-primary" />
                    Description
                  </h3>
                  <p className="text-sm text-muted-foreground leading-relaxed p-4 rounded-lg bg-muted/30">
                    {selectedElement.description}
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

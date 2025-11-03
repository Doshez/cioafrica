import { motion, AnimatePresence } from 'framer-motion';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  CheckCircle2, 
  Clock, 
  Circle, 
  ChevronRight,
  ChevronDown,
  User
} from 'lucide-react';
import { 
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { format } from 'date-fns';
import { calculateWorkingDays, formatWorkingDays, calculateCostVariance } from '@/lib/workingDays';

interface Task {
  id: string;
  title: string;
  assignee?: string;
  assignee_user_id?: string;
  start_date: string;
  due_date: string;
  progress_percentage: number;
  status: string;
  estimated_cost?: number;
  actual_cost?: number;
}

interface Element {
  id: string;
  title: string;
  description?: string;
  departmentId: string;
  start_date?: string;
  due_date?: string;
  tasks: Task[];
}

interface ExpandableElementRowProps {
  element: Element;
  deptColor: string;
  deptName: string;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onElementClick: () => void;
  calculatePosition: (item: { start_date: string; due_date: string }) => { left: string; width: string } | null;
  getStatusIcon: (status: string) => any;
  getStatusColor: (status?: string) => string;
  isTaskOverdue: (dueDate: string, status: string) => boolean;
}

export function ExpandableElementRow({
  element,
  deptColor,
  deptName,
  isExpanded,
  onToggleExpand,
  onElementClick,
  calculatePosition,
  getStatusIcon,
  getStatusColor,
  isTaskOverdue
}: ExpandableElementRowProps) {
  // Calculate element position based on its tasks
  const elementStartDate = element.start_date || 
    (element.tasks.length > 0 ? element.tasks[0].start_date : null);
  const elementDueDate = element.due_date || 
    (element.tasks.length > 0 ? element.tasks[element.tasks.length - 1].due_date : null);
  
  if (!elementStartDate || !elementDueDate) return null;
  
  const position = calculatePosition({ start_date: elementStartDate, due_date: elementDueDate });
  if (!position) return null;
  
  const hasTasks = element.tasks && element.tasks.length > 0;
  
  // Calculate average progress
  const avgProgress = hasTasks 
    ? Math.round(element.tasks.reduce((sum, task) => sum + (task.progress_percentage || 0), 0) / element.tasks.length)
    : 0;
  
  // Check if any tasks in element are overdue
  const hasOverdueTasks = hasTasks && element.tasks.some(task => isTaskOverdue(task.due_date, task.status));
  
  // Determine element status based on tasks
  const elementStatus = hasTasks 
    ? (element.tasks.every(t => t.status === 'done') ? 'done' : 
       element.tasks.some(t => t.status === 'in_progress') ? 'in_progress' : 'todo')
    : 'todo';
  
  const StatusIcon = getStatusIcon(elementStatus);

  const completedTasks = element.tasks.filter(t => t.status === 'done').length;

  return (
    <>
      {/* Element Row */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex border-b bg-card hover:bg-muted/20 transition-colors"
      >
        {/* Left Column - Element Info */}
        <div className="w-32 sm:w-40 md:w-48 lg:w-64 border-r px-2 sm:px-3 md:px-4 py-3 flex-shrink-0">
          <div className="flex items-center gap-2">
            {hasTasks && (
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 flex-shrink-0"
                onClick={onToggleExpand}
                aria-expanded={isExpanded}
                aria-label={isExpanded ? "Collapse tasks" : "Expand tasks"}
              >
                <motion.div
                  animate={{ rotate: isExpanded ? 90 : 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <ChevronRight className="h-4 w-4" />
                </motion.div>
              </Button>
            )}
            <div 
              className="h-3 w-3 sm:h-4 sm:w-4 rounded-full shadow-sm flex-shrink-0" 
              style={{ backgroundColor: deptColor }}
            />
            <div className="min-w-0 flex-1 cursor-pointer" onClick={onElementClick}>
              <div className="font-semibold text-xs sm:text-sm truncate flex items-center gap-1.5">
                <StatusIcon className={`h-3.5 w-3.5 flex-shrink-0 ${hasOverdueTasks ? 'text-destructive' : ''}`} />
                <span className={`truncate ${hasOverdueTasks ? 'text-destructive' : ''}`}>{element.title}</span>
                {hasOverdueTasks && (
                  <Badge variant="destructive" className="text-[9px] px-1 py-0 h-4">
                    Overdue
                  </Badge>
                )}
              </div>
              <div className="text-[10px] sm:text-xs text-muted-foreground">
                {hasTasks ? `${element.tasks.length} tasks • ${completedTasks}/${element.tasks.length} complete` : 'No tasks'}
              </div>
            </div>
          </div>
        </div>

        {/* Timeline - Element Bar */}
        <div className="flex-1 relative p-2" style={{ minWidth: '400px', minHeight: '48px' }}>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <motion.div
                  initial={{ opacity: 0, scaleX: 0.8 }}
                  animate={{ opacity: 1, scaleX: 1 }}
                  whileHover={{ scale: 1.02, zIndex: 30 }}
                  className={`absolute cursor-pointer rounded-lg overflow-hidden shadow-md hover:shadow-lg transition-all ${
                    hasOverdueTasks ? 'ring-2 ring-destructive' : ''
                  }`}
                  style={{
                    ...position,
                    height: '32px',
                    top: '8px',
                    background: hasOverdueTasks 
                      ? 'linear-gradient(135deg, #EF4444E6, #DC2626B3)'
                      : `linear-gradient(135deg, ${deptColor}E6, ${deptColor}B3)`
                  }}
                  onClick={onElementClick}
                >
                  {/* Progress Bar */}
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${avgProgress}%` }}
                    transition={{ duration: 0.8, delay: 0.3 }}
                    className="absolute inset-0 bg-white/30"
                  />
                  
                  {/* Element Content */}
                  <div className="relative h-full px-3 flex items-center gap-2 text-white">
                    <StatusIcon className="h-3.5 w-3.5 flex-shrink-0" />
                    <span className="text-xs font-semibold truncate flex-1">
                      {element.title}
                    </span>
                    <Badge 
                      variant="secondary" 
                      className="bg-white/90 text-foreground text-[10px] px-1.5 py-0 h-5 flex-shrink-0"
                    >
                      {avgProgress}%
                    </Badge>
                  </div>
                </motion.div>
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-xs z-50">
                <div className="space-y-2">
                  <p className="font-semibold text-sm">{element.title}</p>
                  <p className="text-xs text-muted-foreground">{deptName}</p>
                  {hasTasks && (
                    <p className="text-xs">
                      {element.tasks.length} task{element.tasks.length !== 1 ? 's' : ''} • {avgProgress}% complete
                    </p>
                  )}
                  {hasOverdueTasks && (
                    <p className="text-xs text-destructive font-medium mt-1">
                      ⚠️ Contains overdue tasks
                    </p>
                  )}
                  {elementStartDate && elementDueDate && (
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <span className="text-muted-foreground">Start:</span>
                        <p className="font-medium">{format(new Date(elementStartDate), 'MMM d')}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Due:</span>
                        <p className="font-medium">{format(new Date(elementDueDate), 'MMM d')}</p>
                      </div>
                    </div>
                  )}
                </div>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </motion.div>

      {/* Task Sub-Rows */}
      <AnimatePresence>
        {isExpanded && hasTasks && element.tasks.map((task, taskIdx) => {
          const taskPosition = calculatePosition(task);
          if (!taskPosition) return null;

          const TaskStatusIcon = getStatusIcon(task.status);
          const isOverdue = isTaskOverdue(task.due_date, task.status);
          const overdueColor = '#EF4444'; // Red color for overdue

          return (
            <motion.div
              key={task.id}
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2, delay: taskIdx * 0.05 }}
              className="flex border-b bg-muted/5 hover:bg-muted/20 transition-colors"
            >
              {/* Left Column - Task Info */}
              <div className={`w-32 sm:w-40 md:w-48 lg:w-64 border-r px-2 sm:px-3 md:px-4 py-2 flex-shrink-0 ${
                isOverdue ? 'bg-destructive/5' : ''
              }`}>
                <div className="flex items-center gap-2 pl-8">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <TaskStatusIcon className={`h-3 w-3 flex-shrink-0 ${isOverdue ? 'text-destructive' : ''}`} />
                  <span className={`text-xs font-medium truncate ${isOverdue ? 'text-destructive' : ''}`}>{task.title}</span>
                </div>
                <div className="flex items-center gap-1.5 mt-0.5">
                  {task.assignee && (
                    <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                      <User className="h-2.5 w-2.5" />
                      <span className="truncate">{task.assignee}</span>
                    </div>
                  )}
                  {isOverdue && (
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-medium bg-destructive/20 text-destructive">
                      ● Overdue
                    </span>
                  )}
                  {!isOverdue && (
                    <span
                      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-medium"
                      style={{ 
                        backgroundColor: `${getStatusColor(task.status)}22`, 
                        color: getStatusColor(task.status) 
                      }}
                    >
                      ● {task.status.replace('_', ' ')}
                    </span>
                  )}
                </div>
              </div>
                  <Badge 
                    variant="outline" 
                    className="text-[9px] px-1 py-0 h-4 flex-shrink-0"
                  >
                    {task.progress_percentage || 0}%
                  </Badge>
                </div>
              </div>

              {/* Timeline - Task Bar */}
              <div className="flex-1 relative p-2" style={{ minWidth: '400px', minHeight: '36px' }}>
                <TooltipProvider>
                  <Tooltip>
                     <TooltipTrigger asChild>
                      <motion.div
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ 
                          opacity: task.status === 'not-started' || task.status === 'todo' ? 0.6 : 1, 
                          x: 0
                        }}
                        whileHover={{ scale: 1.02, zIndex: 30 }}
                        transition={{ duration: 0.3, ease: "easeOut" }}
                        className="absolute cursor-pointer rounded-md overflow-hidden shadow-sm hover:shadow-md"
                        style={{
                          ...taskPosition,
                          height: '24px',
                          top: '6px',
                          background: isOverdue
                            ? `linear-gradient(90deg, ${overdueColor}, ${overdueColor}99)`
                            : task.status === 'in_progress' || task.status === 'in-progress'
                            ? `linear-gradient(90deg, ${getStatusColor(task.status)}, ${getStatusColor(task.status)}99)`
                            : task.status === 'done'
                            ? getStatusColor(task.status)
                            : `${getStatusColor(task.status)}55`,
                          border: `2px solid ${isOverdue ? overdueColor : getStatusColor(task.status)}`
                        }}
                      >
                        {/* Animated shimmer effect for in-progress and overdue tasks */}
                        {(isOverdue || task.status === 'in_progress' || task.status === 'in-progress') && (
                          <motion.div
                            className="absolute inset-0 rounded-md"
                            style={{
                              background: isOverdue 
                                ? `linear-gradient(270deg, ${overdueColor}33, ${overdueColor}99, ${overdueColor}33)`
                                : `linear-gradient(270deg, ${getStatusColor(task.status)}33, ${getStatusColor(task.status)}99, ${getStatusColor(task.status)}33)`,
                              backgroundSize: '200% 100%'
                            }}
                            animate={{ backgroundPosition: ['0% 0%', '100% 0%'] }}
                            transition={{ repeat: Infinity, duration: isOverdue ? 1.5 : 2, ease: "linear" }}
                          />
                        )}
                        
                        {/* Progress Bar */}
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${task.progress_percentage || 0}%` }}
                          transition={{ duration: 0.6, delay: 0.2 }}
                          className="absolute inset-0 bg-white/25"
                        />
                        
                        {/* Task Content */}
                        <div className="relative h-full px-2 flex items-center gap-1.5 text-white">
                          <TaskStatusIcon className="h-2.5 w-2.5 flex-shrink-0" />
                          <span className="text-[10px] font-medium truncate flex-1">
                            {task.title}
                          </span>
                          {task.assignee && (
                            <span className="text-[9px] bg-white/20 px-1 py-0.5 rounded truncate max-w-[60px]">
                              {task.assignee}
                            </span>
                          )}
                        </div>
                      </motion.div>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="max-w-xs z-50">
                      <div className="space-y-1">
                        <p className="font-semibold text-xs">{task.title}</p>
                        <p className="text-[10px] text-muted-foreground">Part of {element.title}</p>
                        {task.assignee && (
                          <p className="text-[10px]">
                            <User className="h-2.5 w-2.5 inline mr-1" />
                            {task.assignee}
                          </p>
                        )}
                         <div className="grid grid-cols-2 gap-1 text-[10px] pt-1">
                          <div>
                            <span className="text-muted-foreground">Start:</span>
                            <p className="font-medium">{format(new Date(task.start_date), 'MMM d')}</p>
                          </div>
                          <div>
                            <span className={isOverdue ? "text-destructive" : "text-muted-foreground"}>Due:</span>
                            <p className={`font-medium ${isOverdue ? "text-destructive" : ""}`}>
                              {format(new Date(task.due_date), 'MMM d')}
                              {isOverdue && " (Overdue)"}
                            </p>
                          </div>
                        </div>
                        <p className="text-[10px] pt-1">
                          <span className="text-muted-foreground">Working Days:</span> <span className="font-medium">{formatWorkingDays(calculateWorkingDays(task.start_date, task.due_date))}</span>
                        </p>
                        <p className="text-[10px] text-muted-foreground">
                          Progress: {task.progress_percentage || 0}%
                        </p>
                        {(task.estimated_cost || task.actual_cost) && (() => {
                          const variance = calculateCostVariance(task.estimated_cost || 0, task.actual_cost || 0);
                          return (
                            <div className="pt-1 border-t border-border/50">
                              <div className="grid grid-cols-2 gap-1 text-[10px]">
                                <div>
                                  <span className="text-muted-foreground">Est:</span> ${(task.estimated_cost || 0).toLocaleString()}
                                </div>
                                <div>
                                  <span className="text-muted-foreground">Actual:</span> ${(task.actual_cost || 0).toLocaleString()}
                                </div>
                              </div>
                              <p className={`text-[10px] font-medium pt-0.5 ${variance.statusColor}`}>
                                {variance.statusLabel}
                              </p>
                            </div>
                          );
                        })()}
                        {isOverdue && (
                          <p className="text-[10px] text-destructive font-medium pt-1">
                            ⚠️ This task is overdue
                          </p>
                        )}
                      </div>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </>
  );
}

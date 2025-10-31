import { motion, AnimatePresence } from 'framer-motion';
import { Badge } from '@/components/ui/badge';
import { 
  CheckCircle2, 
  Clock, 
  Circle, 
  ChevronRight,
  ChevronDown
} from 'lucide-react';
import { 
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { format } from 'date-fns';

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
  start_date?: string;
  due_date?: string;
  tasks: Task[];
}

interface ElementRowProps {
  element: Element;
  elementIdx: number;
  deptColor: string;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onElementClick: () => void;
  calculatePosition: (item: { start_date: string; due_date: string }) => { left: string; width: string } | null;
  getStatusIcon: (status: string) => any;
}

export function ElementRow({
  element,
  elementIdx,
  deptColor,
  isExpanded,
  onToggleExpand,
  onElementClick,
  calculatePosition,
  getStatusIcon
}: ElementRowProps) {
  // Calculate element position based on its tasks
  const elementStartDate = element.start_date || 
    (element.tasks.length > 0 ? element.tasks[0].start_date : null);
  const elementDueDate = element.due_date || 
    (element.tasks.length > 0 ? element.tasks[element.tasks.length - 1].due_date : null);
  
  if (!elementStartDate || !elementDueDate) return null;
  
  const position = calculatePosition({ start_date: elementStartDate, due_date: elementDueDate });
  if (!position) return null;
  
  const hasTasks = element.tasks && element.tasks.length > 0;
  const baseTop = elementIdx * 50;
  
  // Calculate average progress
  const avgProgress = hasTasks 
    ? Math.round(element.tasks.reduce((sum, task) => sum + (task.progress_percentage || 0), 0) / element.tasks.length)
    : 0;
  
  // Determine element status based on tasks
  const elementStatus = hasTasks 
    ? (element.tasks.every(t => t.status === 'completed') ? 'completed' : 
       element.tasks.some(t => t.status === 'in_progress') ? 'in_progress' : 'todo')
    : 'todo';
  
  const StatusIcon = getStatusIcon(elementStatus);

  return (
    <>
      {/* Main Element Bar */}
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.3, delay: elementIdx * 0.05 }}
              whileHover={{ scale: 1.02, zIndex: 50 }}
              className="absolute cursor-pointer rounded-md sm:rounded-lg overflow-hidden shadow-md hover:shadow-lg transition-smooth"
              style={{
                ...position,
                height: '36px',
                top: `${baseTop}px`,
                background: `linear-gradient(135deg, ${deptColor}E6, ${deptColor}B3)`
              }}
            >
              {/* Progress Bar */}
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${avgProgress}%` }}
                transition={{ duration: 0.8, delay: 0.3 }}
                className="absolute inset-0 bg-white/30"
              />
              
              {/* Element Content */}
              <div 
                className="relative h-full px-2 sm:px-3 flex items-center gap-1 sm:gap-2 text-white"
                onClick={onElementClick}
              >
                {hasTasks && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleExpand();
                    }}
                    className="flex-shrink-0 hover:bg-white/20 rounded p-0.5 transition-colors"
                  >
                    {isExpanded ? (
                      <ChevronDown className="h-3 w-3" />
                    ) : (
                      <ChevronRight className="h-3 w-3" />
                    )}
                  </button>
                )}
                <StatusIcon className="h-3 w-3 sm:h-3.5 sm:w-3.5 flex-shrink-0" />
                <span className="text-[10px] sm:text-xs font-semibold truncate flex-1">
                  {element.title}
                </span>
                <Badge 
                  variant="secondary" 
                  className="bg-white/90 text-foreground text-[9px] sm:text-[10px] px-1 sm:px-1.5 py-0 h-4 sm:h-5 flex-shrink-0"
                >
                  {avgProgress}%
                </Badge>
              </div>
            </motion.div>
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-xs z-50">
            <div className="space-y-2">
              <div>
                <p className="font-semibold text-sm">{element.title}</p>
                {hasTasks && (
                  <p className="text-xs text-muted-foreground">
                    {element.tasks.length} task{element.tasks.length !== 1 ? 's' : ''}
                  </p>
                )}
              </div>
              {elementStartDate && elementDueDate && (
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-muted-foreground">Start:</span>
                    <p className="font-medium">
                      {format(new Date(elementStartDate), 'MMM d')}
                    </p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Due:</span>
                    <p className="font-medium">
                      {format(new Date(elementDueDate), 'MMM d')}
                    </p>
                  </div>
                </div>
              )}
              <p className="text-xs text-muted-foreground">
                Click to view details • {hasTasks ? 'Click arrow to expand tasks' : ''}
              </p>
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      {/* Task Sub-Rows */}
      <AnimatePresence>
        {isExpanded && hasTasks && element.tasks.map((task, taskIdx) => {
        const taskPosition = calculatePosition(task);
        if (!taskPosition) return null;

        const TaskStatusIcon = getStatusIcon(task.status);
        const taskTop = baseTop + 42 + (taskIdx * 40);

        return (
          <motion.div
            key={task.id}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2, delay: taskIdx * 0.05 }}
          >
            {/* Connecting Line */}
            <div
              className="absolute w-4 border-l-2 border-b-2 border-muted-foreground/30 rounded-bl"
              style={{
                left: '8px',
                top: `${baseTop + 36}px`,
                height: `${taskTop - baseTop - 36}px`
              }}
            />

            {/* Task Bar */}
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <motion.div
                    whileHover={{ scale: 1.02, zIndex: 50 }}
                    className="absolute cursor-pointer rounded-md overflow-hidden shadow-sm hover:shadow-md transition-smooth border-2 border-white/20"
                    style={{
                      ...taskPosition,
                      left: `calc(${taskPosition.left} + 16px)`,
                      width: `calc(${taskPosition.width} - 16px)`,
                      height: '32px',
                      top: `${taskTop}px`,
                      background: `linear-gradient(135deg, ${deptColor}99, ${deptColor}66)`
                    }}
                  >
                    {/* Progress Bar */}
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${task.progress_percentage || 0}%` }}
                      transition={{ duration: 0.6, delay: 0.2 }}
                      className="absolute inset-0 bg-white/20"
                    />
                    
                    {/* Task Content */}
                    <div className="relative h-full px-2 flex items-center gap-1 sm:gap-2 text-white">
                      <TaskStatusIcon className="h-2.5 w-2.5 sm:h-3 sm:w-3 flex-shrink-0" />
                      <span className="text-[9px] sm:text-[10px] font-medium truncate flex-1">
                        {task.title}
                      </span>
                      {task.assignee && (
                        <span className="text-[8px] sm:text-[9px] bg-white/20 px-1 py-0.5 rounded">
                          {task.assignee}
                        </span>
                      )}
                      <Badge 
                        variant="secondary" 
                        className="bg-white/80 text-foreground text-[8px] sm:text-[9px] px-1 py-0 h-3.5 sm:h-4 flex-shrink-0"
                      >
                        {task.progress_percentage || 0}%
                      </Badge>
                    </div>
                  </motion.div>
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-xs z-50">
                  <div className="space-y-1">
                    <p className="font-semibold text-xs">{task.title}</p>
                    <p className="text-[10px] text-muted-foreground">Task of {element.title}</p>
                    {task.assignee && (
                      <p className="text-[10px] text-muted-foreground">Assigned to: {task.assignee}</p>
                    )}
                    <div className="grid grid-cols-2 gap-1 text-[10px]">
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
                  </div>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </motion.div>
        );
      })}
      </AnimatePresence>
    </>
  );
}

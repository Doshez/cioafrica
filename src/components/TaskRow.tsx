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
  status: string;
  start_date: string;
  due_date: string;
  progress_percentage: number;
  elements?: TaskElement[];
}

interface TaskElement {
  id: string;
  name: string;
  start_date: string;
  due_date: string;
  progress_percentage: number;
  status: string;
}

interface TaskRowProps {
  task: Task;
  taskIdx: number;
  deptColor: string;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onTaskClick: () => void;
  calculatePosition: (item: { start_date: string; due_date: string }) => { left: string; width: string } | null;
  getStatusIcon: (status: string) => any;
}

export function TaskRow({
  task,
  taskIdx,
  deptColor,
  isExpanded,
  onToggleExpand,
  onTaskClick,
  calculatePosition,
  getStatusIcon
}: TaskRowProps) {
  const position = calculatePosition(task);
  if (!position) return null;
  
  const StatusIcon = getStatusIcon(task.status);
  const hasElements = task.elements && task.elements.length > 0;
  const baseTop = taskIdx * 50;

  return (
    <>
      {/* Main Task Bar */}
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.3, delay: taskIdx * 0.05 }}
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
                animate={{ width: `${task.progress_percentage || 0}%` }}
                transition={{ duration: 0.8, delay: 0.3 }}
                className="absolute inset-0 bg-white/30"
              />
              
              {/* Task Content */}
              <div 
                className="relative h-full px-2 sm:px-3 flex items-center gap-1 sm:gap-2 text-white"
                onClick={onTaskClick}
              >
                {hasElements && (
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
                  {task.title}
                </span>
                <Badge 
                  variant="secondary" 
                  className="bg-white/90 text-foreground text-[9px] sm:text-[10px] px-1 sm:px-1.5 py-0 h-4 sm:h-5 flex-shrink-0"
                >
                  {task.progress_percentage || 0}%
                </Badge>
              </div>
            </motion.div>
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-xs z-50">
            <div className="space-y-2">
              <div>
                <p className="font-semibold text-sm">{task.title}</p>
                {hasElements && (
                  <p className="text-xs text-muted-foreground">
                    {task.elements!.length} element{task.elements!.length !== 1 ? 's' : ''}
                  </p>
                )}
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
                Click to view details • {hasElements ? 'Click arrow to expand elements' : ''}
              </p>
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      {/* Element Sub-Rows */}
      <AnimatePresence>
        {isExpanded && hasElements && task.elements!.map((element, elemIdx) => {
        const elemPosition = calculatePosition(element);
        if (!elemPosition) return null;

        const ElemStatusIcon = getStatusIcon(element.status);
        const elemTop = baseTop + 42 + (elemIdx * 40);

        return (
          <motion.div
            key={element.id}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2, delay: elemIdx * 0.05 }}
          >
            {/* Connecting Line */}
            <div
              className="absolute w-4 border-l-2 border-b-2 border-muted-foreground/30 rounded-bl"
              style={{
                left: '8px',
                top: `${baseTop + 36}px`,
                height: `${elemTop - baseTop - 36}px`
              }}
            />

            {/* Element Bar */}
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <motion.div
                    whileHover={{ scale: 1.02, zIndex: 50 }}
                    className="absolute cursor-pointer rounded-md overflow-hidden shadow-sm hover:shadow-md transition-smooth border-2 border-white/20"
                    style={{
                      ...elemPosition,
                      left: `calc(${elemPosition.left} + 16px)`,
                      width: `calc(${elemPosition.width} - 16px)`,
                      height: '32px',
                      top: `${elemTop}px`,
                      background: `linear-gradient(135deg, ${deptColor}99, ${deptColor}66)`
                    }}
                  >
                    {/* Progress Bar */}
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${element.progress_percentage || 0}%` }}
                      transition={{ duration: 0.6, delay: 0.2 }}
                      className="absolute inset-0 bg-white/20"
                    />
                    
                    {/* Element Content */}
                    <div className="relative h-full px-2 flex items-center gap-1 sm:gap-2 text-white">
                      <ElemStatusIcon className="h-2.5 w-2.5 sm:h-3 sm:w-3 flex-shrink-0" />
                      <span className="text-[9px] sm:text-[10px] font-medium truncate flex-1">
                        {element.name}
                      </span>
                      <Badge 
                        variant="secondary" 
                        className="bg-white/80 text-foreground text-[8px] sm:text-[9px] px-1 py-0 h-3.5 sm:h-4 flex-shrink-0"
                      >
                        {element.progress_percentage || 0}%
                      </Badge>
                    </div>
                  </motion.div>
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-xs z-50">
                  <div className="space-y-1">
                    <p className="font-semibold text-xs">{element.name}</p>
                    <p className="text-[10px] text-muted-foreground">Element of {task.title}</p>
                    <div className="grid grid-cols-2 gap-1 text-[10px]">
                      <div>
                        <span className="text-muted-foreground">Start:</span>
                        <p className="font-medium">
                          {format(new Date(element.start_date), 'MMM d')}
                        </p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Due:</span>
                        <p className="font-medium">
                          {format(new Date(element.due_date), 'MMM d')}
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

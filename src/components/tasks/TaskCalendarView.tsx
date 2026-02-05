import { useState, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ChevronLeft, ChevronRight, Edit } from 'lucide-react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths, isToday } from 'date-fns';
import type { TaskViewProps, TaskWithProfile } from './types';

export function TaskCalendarView({ 
  tasks, 
  onDateUpdate,
  onEditTask,
  canEdit = true 
}: TaskViewProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [draggedTask, setDraggedTask] = useState<TaskWithProfile | null>(null);
  const [dragOverDate, setDragOverDate] = useState<Date | null>(null);

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });

  // Get first day of week offset
  const startDayOfWeek = monthStart.getDay();
  const paddingDays = Array(startDayOfWeek).fill(null);

  const tasksByDate = useMemo(() => {
    const map = new Map<string, TaskWithProfile[]>();
    tasks.forEach(task => {
      if (task.due_date) {
        const dateKey = task.due_date;
        if (!map.has(dateKey)) {
          map.set(dateKey, []);
        }
        map.get(dateKey)!.push(task);
      }
    });
    return map;
  }, [tasks]);

  const handleDragStart = (e: React.DragEvent, task: TaskWithProfile) => {
    if (!canEdit) return;
    setDraggedTask(task);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, date: Date) => {
    e.preventDefault();
    setDragOverDate(date);
  };

  const handleDragLeave = () => {
    setDragOverDate(null);
  };

  const handleDrop = (e: React.DragEvent, date: Date) => {
    e.preventDefault();
    setDragOverDate(null);
    
    if (draggedTask && onDateUpdate) {
      const newDateStr = format(date, 'yyyy-MM-dd');
      if (draggedTask.due_date !== newDateStr) {
        onDateUpdate(draggedTask.id, 'due_date', newDateStr);
      }
    }
    setDraggedTask(null);
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'bg-red-500';
      case 'medium': return 'bg-yellow-500';
      case 'low': return 'bg-green-500';
      default: return 'bg-gray-500';
    }
  };

  const getStatusBorder = (status: string) => {
    switch (status) {
      case 'done': return 'border-l-green-500';
      case 'in_progress': return 'border-l-blue-500';
      case 'todo': return 'border-l-gray-400';
      default: return 'border-l-gray-400';
    }
  };

  const isOverdue = (dueDate: string, status: string) => {
    if (!dueDate || status === 'done') return false;
    return new Date(dueDate) < new Date();
  };

  return (
    <div className="space-y-4">
      {/* Calendar Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">
          {format(currentMonth, 'MMMM yyyy')}
        </h3>
        <div className="flex items-center gap-2">
          <Button 
            variant="outline" 
            size="icon"
            onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => setCurrentMonth(new Date())}
          >
            Today
          </Button>
          <Button 
            variant="outline" 
            size="icon"
            onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-4 text-xs">
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded-full bg-red-500" />
          <span>High Priority</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded-full bg-yellow-500" />
          <span>Medium Priority</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded-full bg-green-500" />
          <span>Low Priority</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-0.5 bg-green-500" />
          <span>Done</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-0.5 bg-blue-500" />
          <span>In Progress</span>
        </div>
      </div>

      {/* Calendar Grid */}
      <Card>
        <CardContent className="p-0">
          {/* Day Headers */}
          <div className="grid grid-cols-7 border-b">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
              <div key={day} className="p-2 text-center text-sm font-medium text-muted-foreground border-r last:border-r-0">
                {day}
              </div>
            ))}
          </div>

          {/* Calendar Days */}
          <div className="grid grid-cols-7">
            {/* Padding days */}
            {paddingDays.map((_, i) => (
              <div key={`padding-${i}`} className="min-h-[120px] p-2 bg-muted/20 border-r border-b" />
            ))}

            {/* Actual days */}
            {daysInMonth.map(day => {
              const dateKey = format(day, 'yyyy-MM-dd');
              const dayTasks = tasksByDate.get(dateKey) || [];
              const isDragOver = dragOverDate && isSameDay(day, dragOverDate);

              return (
                <div
                  key={dateKey}
                  className={`min-h-[120px] p-1 border-r border-b last:border-r-0 transition-colors ${
                    !isSameMonth(day, currentMonth) ? 'bg-muted/20' : ''
                  } ${isToday(day) ? 'bg-primary/5' : ''} ${
                    isDragOver ? 'bg-primary/10 ring-2 ring-primary ring-inset' : ''
                  }`}
                  onDragOver={(e) => handleDragOver(e, day)}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDrop(e, day)}
                >
                  <div className={`text-xs font-medium mb-1 ${
                    isToday(day) ? 'text-primary' : 'text-muted-foreground'
                  }`}>
                    {format(day, 'd')}
                  </div>
                  
                  <div className="space-y-1 overflow-y-auto max-h-[90px]">
                    {dayTasks.map(task => {
                      const taskOverdue = isOverdue(task.due_date, task.status);
                      
                      return (
                        <div
                          key={task.id}
                          draggable={canEdit}
                          onDragStart={(e) => handleDragStart(e, task)}
                          className={`group text-xs p-1 rounded border-l-2 ${getStatusBorder(task.status)} ${
                            taskOverdue ? 'bg-destructive/10' : 'bg-muted/50'
                          } cursor-grab active:cursor-grabbing hover:bg-muted transition-colors ${
                            draggedTask?.id === task.id ? 'opacity-50' : ''
                          }`}
                        >
                          <div className="flex items-start gap-1">
                            <div className={`w-1.5 h-1.5 rounded-full mt-0.5 flex-shrink-0 ${getPriorityColor(task.priority)}`} />
                            <span className="line-clamp-2 flex-1">{task.title}</span>
                            {onEditTask && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onEditTask(task);
                                }}
                              >
                                <Edit className="h-2.5 w-2.5" />
                              </Button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Tasks without due date */}
      {tasks.filter(t => !t.due_date).length > 0 && (
        <Card>
          <CardContent className="p-4">
            <h4 className="text-sm font-medium mb-2">Tasks without due date</h4>
            <div className="flex flex-wrap gap-2">
              {tasks.filter(t => !t.due_date).map(task => (
                <Badge 
                  key={task.id} 
                  variant="outline" 
                  className="cursor-pointer hover:bg-muted"
                  draggable={canEdit}
                  onDragStart={(e) => handleDragStart(e, task)}
                >
                  {task.title}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

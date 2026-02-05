import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Calendar, Clock, Edit, User, GripVertical } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import type { TaskViewProps, TaskWithProfile } from './types';

const COLUMNS = [
  { id: 'todo', label: 'To Do', color: 'bg-gray-500' },
  { id: 'in_progress', label: 'In Progress', color: 'bg-blue-500' },
  { id: 'done', label: 'Done', color: 'bg-green-500' },
];

export function TaskKanbanView({ 
  tasks, 
  onStatusUpdate, 
  onEditTask,
  canEdit = true 
}: TaskViewProps) {
  const [draggedTask, setDraggedTask] = useState<TaskWithProfile | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null);

  const getTasksByStatus = (status: string) => {
    return tasks.filter(task => task.status === status);
  };

  const handleDragStart = (e: React.DragEvent, task: TaskWithProfile) => {
    if (!canEdit) return;
    setDraggedTask(task);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, columnId: string) => {
    e.preventDefault();
    setDragOverColumn(columnId);
  };

  const handleDragLeave = () => {
    setDragOverColumn(null);
  };

  const handleDrop = (e: React.DragEvent, newStatus: string) => {
    e.preventDefault();
    setDragOverColumn(null);
    
    if (draggedTask && draggedTask.status !== newStatus) {
      onStatusUpdate(draggedTask.id, newStatus);
    }
    setDraggedTask(null);
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'destructive';
      case 'medium': return 'default';
      case 'low': return 'secondary';
      default: return 'default';
    }
  };

  const isOverdue = (dueDate: string, status: string) => {
    if (!dueDate || status === 'done') return false;
    return new Date(dueDate) < new Date();
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {COLUMNS.map(column => (
        <div
          key={column.id}
          className={`rounded-lg border-2 transition-colors ${
            dragOverColumn === column.id 
              ? 'border-primary bg-primary/5' 
              : 'border-transparent bg-muted/30'
          }`}
          onDragOver={(e) => handleDragOver(e, column.id)}
          onDragLeave={handleDragLeave}
          onDrop={(e) => handleDrop(e, column.id)}
        >
          <div className="p-4">
            <div className="flex items-center gap-2 mb-4">
              <div className={`w-3 h-3 rounded-full ${column.color}`} />
              <h3 className="font-semibold">{column.label}</h3>
              <Badge variant="outline" className="ml-auto">
                {getTasksByStatus(column.id).length}
              </Badge>
            </div>

            <div className="space-y-3 min-h-[200px]">
              {getTasksByStatus(column.id).map(task => {
                const taskOverdue = isOverdue(task.due_date, task.status);
                const progress = task.progress_percentage ?? (task.status === 'done' ? 100 : task.status === 'in_progress' ? 50 : 0);

                return (
                  <Card
                    key={task.id}
                    draggable={canEdit}
                    onDragStart={(e) => handleDragStart(e, task)}
                    className={`cursor-grab active:cursor-grabbing transition-all hover:shadow-md ${
                      draggedTask?.id === task.id ? 'opacity-50 scale-95' : ''
                    } ${taskOverdue ? 'border-destructive' : ''}`}
                  >
                    <CardContent className="p-3">
                      <div className="space-y-2">
                        <div className="flex items-start gap-2">
                          {canEdit && (
                            <GripVertical className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2">
                              <h4 className="text-sm font-medium line-clamp-2">{task.title}</h4>
                              {onEditTask && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-6 w-6 flex-shrink-0"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onEditTask(task);
                                  }}
                                >
                                  <Edit className="h-3 w-3" />
                                </Button>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-1">
                          <Badge variant={getPriorityColor(task.priority)} className="text-xs">
                            {task.priority}
                          </Badge>
                          {taskOverdue && (
                            <Badge variant="destructive" className="text-xs">
                              Overdue
                            </Badge>
                          )}
                          {task.element_name && (
                            <Badge variant="outline" className="text-xs">
                              {task.element_name}
                            </Badge>
                          )}
                        </div>

                        {/* Progress bar */}
                        <div className="space-y-1">
                          <div className="flex justify-between text-xs text-muted-foreground">
                            <span>Progress</span>
                            <span>{progress}%</span>
                          </div>
                          <Progress value={progress} className="h-1.5" />
                        </div>

                        {/* Dates and assignees */}
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                          {task.due_date && (
                            <div className={`flex items-center gap-1 ${taskOverdue ? 'text-destructive' : ''}`}>
                              <Clock className="h-3 w-3" />
                              <span>{new Date(task.due_date).toLocaleDateString()}</span>
                            </div>
                          )}
                          {task.assigned_users && task.assigned_users.length > 0 && (
                            <div className="flex items-center gap-1">
                              <User className="h-3 w-3" />
                              <span>{task.assigned_users.length}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

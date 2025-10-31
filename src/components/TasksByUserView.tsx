import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar, Clock, Percent } from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Slider } from '@/components/ui/slider';

interface AssignedUser {
  id: string;
  name: string;
  email?: string;
}

interface TaskWithProfile {
  id: string;
  title: string;
  status: string;
  priority: string;
  start_date: string;
  due_date: string;
  assignee_department_id: string;
  assignee_user_id?: string;
  description?: string;
  progress_percentage?: number;
  estimate_hours?: number;
  logged_hours?: number;
  assigned_users?: AssignedUser[];
}

interface TasksByUserViewProps {
  tasks: TaskWithProfile[];
  onStatusUpdate: (taskId: string, status: string) => void;
  onProgressUpdate: (taskId: string, progress: number) => void;
}

export function TasksByUserView({ tasks, onStatusUpdate, onProgressUpdate }: TasksByUserViewProps) {
  // Group tasks by user - tasks with multiple assignees appear in multiple columns
  const tasksByUser = tasks.reduce((acc, task) => {
    const assignedUsers = task.assigned_users || [];
    
    if (assignedUsers.length === 0) {
      // Unassigned tasks
      if (!acc['unassigned']) {
        acc['unassigned'] = {
          name: 'Unassigned',
          email: undefined,
          tasks: []
        };
      }
      acc['unassigned'].tasks.push(task);
    } else {
      // Add task to each assigned user's column
      assignedUsers.forEach(user => {
        if (!acc[user.id]) {
          acc[user.id] = {
            name: user.name,
            email: user.email,
            tasks: []
          };
        }
        acc[user.id].tasks.push(task);
      });
    }
    
    return acc;
  }, {} as Record<string, { name: string; email?: string; tasks: TaskWithProfile[] }>);

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

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const isOverdue = (dueDate: string, status: string) => {
    if (!dueDate || status === 'done') return false;
    return new Date(dueDate) < new Date();
  };

  return (
    <div className="w-full overflow-x-auto pb-4">
      <div className="flex gap-6 min-w-max">
        {Object.entries(tasksByUser).map(([userId, userData]) => (
          <div key={userId} className="flex-shrink-0 w-[380px]">
            {/* User Header */}
            <div className="mb-4 p-4 bg-muted/30 rounded-lg border">
              <div className="flex items-center gap-3">
                <Avatar className="h-10 w-10">
                  <AvatarFallback className="bg-primary text-primary-foreground">
                    {getInitials(userData.name)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold truncate">{userData.name}</h3>
                  {userData.email && (
                    <p className="text-xs text-muted-foreground truncate">{userData.email}</p>
                  )}
                </div>
                <Badge variant="outline" className="shrink-0">
                  {userData.tasks.length} {userData.tasks.length === 1 ? 'task' : 'tasks'}
                </Badge>
              </div>
            </div>

            {/* Tasks - Scrollable */}
            <div className="space-y-3 max-h-[calc(100vh-240px)] overflow-y-auto pr-2">
              {userData.tasks.map((task) => {
                const progress = task.progress_percentage ?? (task.status === 'done' ? 100 : task.status === 'in_progress' ? 50 : 0);
                const taskOverdue = isOverdue(task.due_date, task.status);
                
                return (
                  <Card key={task.id} className={`hover:shadow-md transition-shadow ${taskOverdue ? 'border-destructive' : ''}`}>
                    <CardContent className="p-4">
                      <div className="space-y-3">
                        {/* Title, Priority, Status Badge, and Assigned Users */}
                        <div className="space-y-2">
                          <div className="flex items-start gap-2">
                            <h4 className="text-sm font-semibold flex-1 leading-tight">{task.title}</h4>
                            <div className="flex gap-1 shrink-0">
                              <Badge variant={getPriorityColor(task.priority)} className="text-xs">
                                {task.priority}
                              </Badge>
                              {taskOverdue && (
                                <Badge variant="destructive" className="text-xs">
                                  Overdue
                                </Badge>
                              )}
                            </div>
                          </div>
                          
                          {/* Show all assigned users if multiple */}
                          {task.assigned_users && task.assigned_users.length > 1 && (
                            <div className="flex flex-wrap gap-1">
                              {task.assigned_users.map(user => (
                                <Badge key={user.id} variant="outline" className="text-xs">
                                  {user.name}
                                </Badge>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Description */}
                        {task.description && (
                          <p className="text-xs text-muted-foreground line-clamp-2">
                            {task.description}
                          </p>
                        )}

                        {/* Dates */}
                        <div className="flex flex-wrap gap-2 text-xs">
                          {task.start_date && (
                            <div className="flex items-center gap-1 text-muted-foreground">
                              <Calendar className="h-3 w-3" />
                              <span>{new Date(task.start_date).toLocaleDateString()}</span>
                            </div>
                          )}
                          {task.due_date && (
                            <div className={`flex items-center gap-1 ${taskOverdue ? 'text-destructive font-medium' : 'text-muted-foreground'}`}>
                              <Clock className="h-3 w-3" />
                              <span>Due: {new Date(task.due_date).toLocaleDateString()}</span>
                            </div>
                          )}
                          {task.estimate_hours && (
                            <div className="flex items-center gap-1 text-muted-foreground">
                              <Clock className="h-3 w-3" />
                              <span>{task.estimate_hours}h est.</span>
                            </div>
                          )}
                        </div>

                        {/* Progress Control with Slider */}
                        <div className="space-y-2">
                          <div className="flex items-center justify-between text-xs">
                            <div className="flex items-center gap-1">
                              <Percent className="h-3 w-3" />
                              <span className="text-muted-foreground">Progress</span>
                            </div>
                            <span className="font-medium text-base">{progress}%</span>
                          </div>
                          <Slider
                            value={[progress]}
                            onValueChange={(value) => onProgressUpdate(task.id, value[0])}
                            max={100}
                            step={1}
                            className="w-full"
                          />
                        </div>

                        {/* Status Control */}
                        <Select 
                          value={task.status} 
                          onValueChange={(value) => onStatusUpdate(task.id, value)}
                        >
                          <SelectTrigger className="h-8 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="bg-background z-50">
                            <SelectItem value="todo">To Do (0%)</SelectItem>
                            <SelectItem value="in_progress">In Progress (1-99%)</SelectItem>
                            <SelectItem value="done">Done (100%)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

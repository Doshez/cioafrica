import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Calendar, Clock } from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';

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
  assignee_name?: string;
  assignee_email?: string;
}

interface TasksByUserViewProps {
  tasks: TaskWithProfile[];
  onStatusUpdate: (taskId: string, status: string) => void;
  onProgressUpdate: (taskId: string, progress: number) => void;
}

export function TasksByUserView({ tasks, onStatusUpdate, onProgressUpdate }: TasksByUserViewProps) {
  // Group tasks by user
  const tasksByUser = tasks.reduce((acc, task) => {
    const userKey = task.assignee_user_id || 'unassigned';
    const userName = task.assignee_name || 'Unassigned';
    
    if (!acc[userKey]) {
      acc[userKey] = {
        name: userName,
        email: task.assignee_email,
        tasks: []
      };
    }
    acc[userKey].tasks.push(task);
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

            {/* Tasks */}
            <div className="space-y-3">
              {userData.tasks.map((task) => {
                const progress = task.progress_percentage ?? (task.status === 'completed' ? 100 : task.status === 'in_progress' ? 50 : 0);
                
                return (
                  <Card key={task.id} className="hover:shadow-md transition-shadow">
                    <CardContent className="p-4">
                      <div className="space-y-3">
                        {/* Title and Priority */}
                        <div className="flex items-start gap-2">
                          <h4 className="text-sm font-semibold flex-1 leading-tight">{task.title}</h4>
                          <Badge variant={getPriorityColor(task.priority)} className="text-xs shrink-0">
                            {task.priority}
                          </Badge>
                        </div>

                        {/* Description */}
                        {task.description && (
                          <p className="text-xs text-muted-foreground line-clamp-2">
                            {task.description}
                          </p>
                        )}

                        {/* Status Control */}
                        <div className="space-y-1.5">
                          <span className="text-xs text-muted-foreground">Status</span>
                          <Select 
                            value={task.status} 
                            onValueChange={(value) => onStatusUpdate(task.id, value)}
                          >
                            <SelectTrigger className="h-8 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="bg-background z-50">
                              <SelectItem value="todo">To Do</SelectItem>
                              <SelectItem value="in_progress">In Progress</SelectItem>
                              <SelectItem value="completed">Completed</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        {/* Progress Control */}
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-muted-foreground">Progress</span>
                            <span className="font-medium">{progress}%</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Progress value={progress} className="h-1.5 flex-1" />
                            <Input
                              type="number"
                              min="0"
                              max="100"
                              value={progress}
                              onChange={(e) => {
                                const value = Math.min(100, Math.max(0, parseInt(e.target.value) || 0));
                                onProgressUpdate(task.id, value);
                              }}
                              className="w-16 h-7 text-xs"
                            />
                          </div>
                        </div>

                        {/* Dates and Hours */}
                        <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                          {task.start_date && (
                            <div className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              <span>{new Date(task.start_date).toLocaleDateString()}</span>
                            </div>
                          )}
                          {task.due_date && (
                            <div className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              <span>→ {new Date(task.due_date).toLocaleDateString()}</span>
                            </div>
                          )}
                          {task.estimate_hours && (
                            <div className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              <span>{task.estimate_hours}h est.</span>
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
        ))}
      </div>
    </div>
  );
}

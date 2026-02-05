import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { 
  CheckCircle, 
  Clock, 
  AlertTriangle, 
  TrendingUp, 
  TrendingDown,
  Users,
  Calendar,
  Target,
  Activity
} from 'lucide-react';
import type { ProjectReportData } from '@/hooks/useProjectReportData';

interface ProjectReportPreviewProps {
  data: ProjectReportData;
}

export function ProjectReportPreview({ data }: ProjectReportPreviewProps) {
  const getHealthIcon = () => {
    switch (data.healthStatus) {
      case 'on_track':
        return <span className="text-2xl">🟢</span>;
      case 'needs_attention':
        return <span className="text-2xl">🟠</span>;
      case 'at_risk':
        return <span className="text-2xl">🔴</span>;
    }
  };

  const getHealthLabel = () => {
    switch (data.healthStatus) {
      case 'on_track':
        return 'On Track';
      case 'needs_attention':
        return 'Needs Attention';
      case 'at_risk':
        return 'At Risk';
    }
  };

  const getTrendIcon = () => {
    switch (data.smartInsights.completionTrend) {
      case 'improving':
        return <TrendingUp className="h-4 w-4 text-green-500" />;
      case 'slowing':
        return <TrendingDown className="h-4 w-4 text-red-500" />;
      default:
        return <Activity className="h-4 w-4 text-yellow-500" />;
    }
  };

  return (
    <div className="space-y-6 p-4 bg-background rounded-lg border">
      {/* Header */}
      <div className="text-center border-b pb-4">
        <h1 className="text-2xl font-bold">{data.projectName}</h1>
        <p className="text-muted-foreground">Daily Progress Report - {data.reportDate}</p>
      </div>

      {/* Project Health Indicator */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center justify-between">
            <span>Project Health</span>
            <div className="flex items-center gap-2">
              {getHealthIcon()}
              <Badge variant={
                data.healthStatus === 'on_track' ? 'default' : 
                data.healthStatus === 'needs_attention' ? 'secondary' : 'destructive'
              }>
                {getHealthLabel()}
              </Badge>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Overall Completion</span>
              <span className="font-medium">{data.overallCompletion}%</span>
            </div>
            <Progress value={data.overallCompletion} className="h-3" />
          </div>
        </CardContent>
      </Card>

      {/* Key Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4 text-center">
            <CheckCircle className="h-8 w-8 mx-auto text-green-500 mb-2" />
            <div className="text-2xl font-bold">{data.completedTasks}</div>
            <div className="text-xs text-muted-foreground">Completed</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 text-center">
            <Clock className="h-8 w-8 mx-auto text-blue-500 mb-2" />
            <div className="text-2xl font-bold">{data.inProgressTasks}</div>
            <div className="text-xs text-muted-foreground">In Progress</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 text-center">
            <Target className="h-8 w-8 mx-auto text-gray-500 mb-2" />
            <div className="text-2xl font-bold">{data.todoTasks}</div>
            <div className="text-xs text-muted-foreground">To Do</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 text-center">
            <AlertTriangle className="h-8 w-8 mx-auto text-red-500 mb-2" />
            <div className="text-2xl font-bold">{data.overdueTasks}</div>
            <div className="text-xs text-muted-foreground">Overdue</div>
          </CardContent>
        </Card>
      </div>

      {/* Today's Activity */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Today's Activity
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <div className="text-xl font-bold text-green-600">{data.tasksCompletedToday}</div>
              <div className="text-xs text-muted-foreground">Completed</div>
            </div>
            <div>
              <div className="text-xl font-bold text-blue-600">{data.tasksUpdatedToday}</div>
              <div className="text-xs text-muted-foreground">Updated</div>
            </div>
            <div>
              <div className="text-xl font-bold text-purple-600">{data.tasksCreatedToday}</div>
              <div className="text-xs text-muted-foreground">Created</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Department Summary */}
      {data.departmentSummaries.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <Users className="h-5 w-5" />
              Department Performance
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {data.departmentSummaries.map((dept) => (
                <div key={dept.id} className="space-y-1">
                  <div className="flex justify-between items-center">
                    <span className="font-medium text-sm">{dept.name}</span>
                    <div className="flex items-center gap-2">
                      {dept.overdue > 0 && (
                        <Badge variant="destructive" className="text-xs">
                          {dept.overdue} overdue
                        </Badge>
                      )}
                      <span className="text-sm font-medium">{dept.completionPercentage}%</span>
                    </div>
                  </div>
                  <Progress value={dept.completionPercentage} className="h-2" />
                  <div className="flex gap-4 text-xs text-muted-foreground">
                    <span>{dept.totalTasks} total</span>
                    <span>{dept.inProgress} in progress</span>
                    <span className="text-green-600">+{dept.completedToday} today</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Smart Insights */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Smart Insights
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {data.smartInsights.topDepartment && (
              <div className="flex items-center gap-2">
                <span className="text-green-500">🏆</span>
                <span className="text-sm">
                  <strong>{data.smartInsights.topDepartment}</strong> is the top performing department
                </span>
              </div>
            )}
            
            {data.smartInsights.fallingBehindDepartments.length > 0 && (
              <div className="flex items-start gap-2">
                <span className="text-orange-500">⚠️</span>
                <span className="text-sm">
                  Departments needing attention: <strong>{data.smartInsights.fallingBehindDepartments.join(', ')}</strong>
                </span>
              </div>
            )}

            {data.smartInsights.mostActiveUsers.length > 0 && (
              <div className="flex items-start gap-2">
                <span className="text-blue-500">👤</span>
                <span className="text-sm">
                  Most active: <strong>{data.smartInsights.mostActiveUsers.join(', ')}</strong>
                </span>
              </div>
            )}

            {data.smartInsights.staleTasks > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-yellow-500">📋</span>
                <span className="text-sm">
                  <strong>{data.smartInsights.staleTasks}</strong> tasks have no updates for 7+ days
                </span>
              </div>
            )}

            {data.smartInsights.upcomingDeadlines > 0 && (
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-purple-500" />
                <span className="text-sm">
                  <strong>{data.smartInsights.upcomingDeadlines}</strong> deadlines in the next 7 days
                </span>
              </div>
            )}

            <div className="flex items-center gap-2">
              {getTrendIcon()}
              <span className="text-sm">
                Completion trend: <strong className="capitalize">{data.smartInsights.completionTrend}</strong>
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* User Activity */}
      {data.userActivities.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <Users className="h-5 w-5" />
              User Activity Today
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {data.userActivities.slice(0, 5).map((user, index) => (
                <div key={user.userId} className="flex items-center justify-between py-1 border-b last:border-0">
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground text-sm">{index + 1}.</span>
                    <span className="font-medium text-sm">{user.userName}</span>
                  </div>
                  <div className="flex items-center gap-3 text-sm">
                    <span className="text-muted-foreground">{user.tasksUpdated} updated</span>
                    <Badge variant="secondary">{user.tasksCompleted} completed</Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

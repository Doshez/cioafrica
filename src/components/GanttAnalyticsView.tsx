import { motion } from 'framer-motion';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, Clock, Circle, BarChart3 } from 'lucide-react';

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
  departmentId: string;
  tasks: Task[];
}

interface Department {
  id: string;
  name: string;
}

interface DepartmentAnalytic {
  departmentId: string;
  departmentName: string;
  totalTasks: number;
  completedTasks: number;
  percentage: number;
}

interface GanttAnalyticsViewProps {
  departmentAnalytics: DepartmentAnalytic[];
  departments: Department[];
  filteredElements: Element[];
  getDepartmentColor: (deptId: string) => string;
}

export function GanttAnalyticsView({
  departmentAnalytics,
  departments,
  filteredElements,
  getDepartmentColor
}: GanttAnalyticsViewProps) {
  return (
    <div className="p-6 space-y-6">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {departmentAnalytics.map(analytics => {
          const dept = departments.find(d => d.id === analytics.departmentId);
          if (!dept) return null;
          
          const deptColor = getDepartmentColor(dept.id);
          const deptElements = filteredElements.filter(e => e.departmentId === dept.id);
          const allTasks = deptElements.flatMap(e => e.tasks);
          const inProgress = allTasks.filter(t => t.status === 'in_progress').length;
          const todo = allTasks.filter(t => t.status === 'todo').length;
          
          return (
            <motion.div
              key={dept.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-6 rounded-xl border bg-card hover:shadow-lg transition-shadow"
            >
              <div className="flex items-center gap-3 mb-4">
                <div 
                  className="h-12 w-12 rounded-xl shadow-md flex items-center justify-center"
                  style={{ 
                    background: `linear-gradient(135deg, ${deptColor}E6, ${deptColor}B3)` 
                  }}
                >
                  <span className="text-white font-bold text-lg">
                    {dept.name.charAt(0)}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold truncate">{dept.name}</h3>
                  <p className="text-xs text-muted-foreground">
                    {analytics.totalTasks} total tasks
                  </p>
                </div>
              </div>
              
              <div className="space-y-3">
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Completion</span>
                    <span className="font-semibold">{analytics.percentage}%</span>
                  </div>
                  <Progress value={analytics.percentage} className="h-2" />
                </div>
                
                <div className="grid grid-cols-3 gap-2 pt-2">
                  <div className="text-center p-2 rounded-lg bg-success/10">
                    <CheckCircle2 className="h-4 w-4 mx-auto mb-1 text-success" />
                    <p className="text-xs font-semibold">{analytics.completedTasks}</p>
                    <p className="text-[10px] text-muted-foreground">Done</p>
                  </div>
                  <div className="text-center p-2 rounded-lg bg-primary/10">
                    <Clock className="h-4 w-4 mx-auto mb-1 text-primary" />
                    <p className="text-xs font-semibold">{inProgress}</p>
                    <p className="text-[10px] text-muted-foreground">Progress</p>
                  </div>
                  <div className="text-center p-2 rounded-lg bg-muted">
                    <Circle className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
                    <p className="text-xs font-semibold">{todo}</p>
                    <p className="text-[10px] text-muted-foreground">To Do</p>
                  </div>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>
      
      {/* Overall Project Statistics */}
      <div className="p-6 rounded-xl border bg-gradient-to-br from-primary/5 to-accent/5">
        <h3 className="font-semibold mb-4 flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-primary" />
          Overall Statistics
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center">
            <p className="text-3xl font-bold text-primary">
              {filteredElements.flatMap(e => e.tasks).length}
            </p>
            <p className="text-sm text-muted-foreground">Total Tasks</p>
          </div>
          <div className="text-center">
            <p className="text-3xl font-bold text-success">
              {filteredElements.flatMap(e => e.tasks).filter(t => t.status === 'done').length}
            </p>
            <p className="text-sm text-muted-foreground">Completed</p>
          </div>
          <div className="text-center">
            <p className="text-3xl font-bold text-primary">
              {filteredElements.flatMap(e => e.tasks).filter(t => t.status === 'in_progress').length}
            </p>
            <p className="text-sm text-muted-foreground">In Progress</p>
          </div>
          <div className="text-center">
            <p className="text-3xl font-bold text-muted-foreground">
              {filteredElements.flatMap(e => e.tasks).filter(t => t.status === 'todo').length}
            </p>
            <p className="text-sm text-muted-foreground">To Do</p>
          </div>
        </div>
      </div>
    </div>
  );
}

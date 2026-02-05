import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { format, subDays, isAfter, isBefore, parseISO } from 'date-fns';

interface Task {
  id: string;
  title: string;
  status: string;
  priority: string;
  progress_percentage: number;
  start_date: string | null;
  due_date: string | null;
  updated_at: string;
  created_at: string;
  completed_at: string | null;
  assignee_department_id: string | null;
  assignee_user_id: string | null;
}

interface Department {
  id: string;
  name: string;
}

interface Profile {
  id: string;
  full_name: string | null;
  email: string;
}

interface DepartmentSummary {
  id: string;
  name: string;
  totalTasks: number;
  completedToday: number;
  inProgress: number;
  overdue: number;
  completionPercentage: number;
}

interface UserActivity {
  userId: string;
  userName: string;
  tasksUpdated: number;
  tasksCompleted: number;
}

interface SmartInsights {
  topDepartment: string | null;
  fallingBehindDepartments: string[];
  mostActiveUsers: string[];
  staleTasks: number;
  upcomingDeadlines: number;
  completionTrend: 'improving' | 'slowing' | 'stable';
}

export interface ProjectReportData {
  projectName: string;
  reportDate: string;
  overallCompletion: number;
  totalTasks: number;
  completedTasks: number;
  inProgressTasks: number;
  todoTasks: number;
  overdueTasks: number;
  tasksCompletedToday: number;
  tasksCreatedToday: number;
  tasksUpdatedToday: number;
  healthStatus: 'on_track' | 'needs_attention' | 'at_risk';
  departmentSummaries: DepartmentSummary[];
  userActivities: UserActivity[];
  smartInsights: SmartInsights;
}

export function useProjectReportData(projectId: string) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [projectName, setProjectName] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (projectId) {
      fetchData();
    }
  }, [projectId]);

  const fetchData = async () => {
    try {
      setLoading(true);
      
      // Fetch project
      const { data: project } = await supabase
        .from('projects')
        .select('name')
        .eq('id', projectId)
        .single();
      
      if (project) setProjectName(project.name);

      // Fetch tasks
      const { data: tasksData } = await supabase
        .from('tasks')
        .select('*')
        .eq('project_id', projectId);
      
      setTasks((tasksData || []) as Task[]);

      // Fetch departments
      const { data: deptData } = await supabase
        .from('departments')
        .select('id, name')
        .eq('project_id', projectId);
      
      setDepartments((deptData || []) as Department[]);

      // Fetch profiles for user activity
      const { data: profilesData } = await supabase
        .from('profiles')
        .select('id, full_name, email');
      
      setProfiles((profilesData || []) as Profile[]);
    } catch (error) {
      console.error('Error fetching report data:', error);
    } finally {
      setLoading(false);
    }
  };

  const reportData: ProjectReportData = useMemo(() => {
    const today = new Date();
    const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const todayStr = format(today, 'yyyy-MM-dd');

    // Basic task counts
    const totalTasks = tasks.length;
    const completedTasks = tasks.filter(t => t.status === 'done').length;
    const inProgressTasks = tasks.filter(t => t.status === 'in_progress').length;
    const todoTasks = tasks.filter(t => t.status === 'todo').length;
    
    // Overdue tasks
    const overdueTasks = tasks.filter(t => {
      if (t.status === 'done' || !t.due_date) return false;
      return isBefore(parseISO(t.due_date), todayStart);
    }).length;

    // Today's activity
    const tasksCompletedToday = tasks.filter(t => {
      if (!t.completed_at) return false;
      return t.completed_at.startsWith(todayStr);
    }).length;

    const tasksCreatedToday = tasks.filter(t => {
      return t.created_at?.startsWith(todayStr);
    }).length;

    const tasksUpdatedToday = tasks.filter(t => {
      return t.updated_at?.startsWith(todayStr);
    }).length;

    // Overall completion
    const overallCompletion = totalTasks > 0 
      ? Math.round((completedTasks / totalTasks) * 100) 
      : 0;

    // Health status calculation
    const overdueRate = totalTasks > 0 ? overdueTasks / totalTasks : 0;
    let healthStatus: 'on_track' | 'needs_attention' | 'at_risk' = 'on_track';
    if (overdueRate > 0.3 || overdueTasks > 10) {
      healthStatus = 'at_risk';
    } else if (overdueRate > 0.1 || overdueTasks > 5) {
      healthStatus = 'needs_attention';
    }

    // Department summaries
    const departmentSummaries: DepartmentSummary[] = departments.map(dept => {
      const deptTasks = tasks.filter(t => t.assignee_department_id === dept.id);
      const deptCompleted = deptTasks.filter(t => t.status === 'done').length;
      const deptInProgress = deptTasks.filter(t => t.status === 'in_progress').length;
      const deptOverdue = deptTasks.filter(t => {
        if (t.status === 'done' || !t.due_date) return false;
        return isBefore(parseISO(t.due_date), todayStart);
      }).length;
      const deptCompletedToday = deptTasks.filter(t => {
        if (!t.completed_at) return false;
        return t.completed_at.startsWith(todayStr);
      }).length;

      return {
        id: dept.id,
        name: dept.name,
        totalTasks: deptTasks.length,
        completedToday: deptCompletedToday,
        inProgress: deptInProgress,
        overdue: deptOverdue,
        completionPercentage: deptTasks.length > 0 
          ? Math.round((deptCompleted / deptTasks.length) * 100)
          : 0,
      };
    });

    // User activity
    const userActivityMap = new Map<string, { updated: number; completed: number }>();
    tasks.forEach(task => {
      if (task.assignee_user_id && task.updated_at?.startsWith(todayStr)) {
        const current = userActivityMap.get(task.assignee_user_id) || { updated: 0, completed: 0 };
        current.updated++;
        if (task.completed_at?.startsWith(todayStr)) {
          current.completed++;
        }
        userActivityMap.set(task.assignee_user_id, current);
      }
    });

    const userActivities: UserActivity[] = Array.from(userActivityMap.entries())
      .map(([userId, activity]) => {
        const profile = profiles.find(p => p.id === userId);
        return {
          userId,
          userName: profile?.full_name || profile?.email || 'Unknown',
          tasksUpdated: activity.updated,
          tasksCompleted: activity.completed,
        };
      })
      .sort((a, b) => b.tasksUpdated - a.tasksUpdated)
      .slice(0, 10);

    // Smart insights
    const sortedDepts = [...departmentSummaries].sort(
      (a, b) => b.completionPercentage - a.completionPercentage
    );
    const topDepartment = sortedDepts[0]?.name || null;
    const fallingBehindDepartments = sortedDepts
      .filter(d => d.completionPercentage < 30 && d.overdue > 0)
      .map(d => d.name);

    const weekAgo = subDays(today, 7);
    const staleTasks = tasks.filter(t => {
      if (t.status === 'done') return false;
      const updatedDate = parseISO(t.updated_at);
      return isBefore(updatedDate, weekAgo);
    }).length;

    const nextWeek = subDays(today, -7);
    const upcomingDeadlines = tasks.filter(t => {
      if (t.status === 'done' || !t.due_date) return false;
      const dueDate = parseISO(t.due_date);
      return isAfter(dueDate, todayStart) && isBefore(dueDate, nextWeek);
    }).length;

    // Completion trend (simplified)
    const recentlyCompleted = tasks.filter(t => {
      if (!t.completed_at) return false;
      const completedDate = parseISO(t.completed_at);
      return isAfter(completedDate, weekAgo);
    }).length;
    
    let completionTrend: 'improving' | 'slowing' | 'stable' = 'stable';
    if (recentlyCompleted >= 5) completionTrend = 'improving';
    else if (overdueTasks > 5 && recentlyCompleted < 2) completionTrend = 'slowing';

    const mostActiveUsers = userActivities.slice(0, 3).map(u => u.userName);

    return {
      projectName,
      reportDate: format(today, 'MMMM d, yyyy'),
      overallCompletion,
      totalTasks,
      completedTasks,
      inProgressTasks,
      todoTasks,
      overdueTasks,
      tasksCompletedToday,
      tasksCreatedToday,
      tasksUpdatedToday,
      healthStatus,
      departmentSummaries,
      userActivities,
      smartInsights: {
        topDepartment,
        fallingBehindDepartments,
        mostActiveUsers,
        staleTasks,
        upcomingDeadlines,
        completionTrend,
      },
    };
  }, [tasks, departments, profiles, projectName]);

  return {
    reportData,
    loading,
    refetch: fetchData,
  };
}

import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Gantt, Task as GanttTask, ViewMode } from "gantt-task-react";
import "gantt-task-react/dist/index.css";
import { Download, FileSpreadsheet, FileText } from "lucide-react";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface TaskData {
  id: string;
  title: string;
  project_id: string;
  assignee_department_id: string | null;
  start_date: string | null;
  due_date: string | null;
  status: string;
  priority: string;
  progress_percentage: number;
}

interface ProjectData {
  id: string;
  name: string;
  start_date: string;
  end_date: string | null;
}

interface DepartmentData {
  id: string;
  name: string;
  project_id: string;
}

interface AssignedUser {
  user_id: string;
  full_name: string;
  email: string;
}

interface TaskWithAssignees extends TaskData {
  assigned_users: AssignedUser[];
}

export const AnalyticsGanttChart = () => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [ganttTasks, setGanttTasks] = useState<GanttTask[]>([]);
  const [viewMode, setViewMode] = useState<ViewMode>(ViewMode.Month);
  const ganttRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchGanttData();
  }, []);

  const fetchGanttData = async () => {
    try {
      setLoading(true);

      // Fetch all projects
      const { data: projects, error: projectsError } = await supabase
        .from("projects")
        .select("*")
        .order("start_date");

      if (projectsError) throw projectsError;

      // Fetch all departments
      const { data: departments, error: deptError } = await supabase
        .from("departments")
        .select("*");

      if (deptError) throw deptError;

      // Fetch all tasks
      const { data: tasks, error: tasksError } = await supabase
        .from("tasks")
        .select("*")
        .order("start_date");

      if (tasksError) throw tasksError;

      // Fetch task assignments
      const { data: assignments, error: assignmentsError } = await supabase
        .from("task_assignments")
        .select("task_id, user_id");

      if (assignmentsError) throw assignmentsError;

      // Fetch user profiles
      const userIds = [...new Set(assignments?.map(a => a.user_id) || [])];
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .in("id", userIds);

      if (profilesError) throw profilesError;

      // Map assigned users to tasks
      const tasksWithAssignees: TaskWithAssignees[] = (tasks || []).map(task => {
        const taskAssignments = assignments?.filter(a => a.task_id === task.id) || [];
        const assigned_users = taskAssignments.map(assignment => {
          const profile = profiles?.find(p => p.id === assignment.user_id);
          return {
            user_id: assignment.user_id,
            full_name: profile?.full_name || "Unknown",
            email: profile?.email || "",
          };
        });
        return { ...task, assigned_users };
      });

      // Convert to Gantt tasks
      const ganttTasksArray: GanttTask[] = [];

      (projects || []).forEach((project: ProjectData) => {
        const projectStart = new Date(project.start_date);
        const projectEnd = project.end_date ? new Date(project.end_date) : new Date(projectStart.getTime() + 30 * 24 * 60 * 60 * 1000);

        // Add project task
        ganttTasksArray.push({
          id: `project-${project.id}`,
          name: `📁 ${project.name}`,
          start: projectStart,
          end: projectEnd,
          progress: 0,
          type: "project",
          styles: {
            backgroundColor: "hsl(var(--primary))",
            progressColor: "hsl(var(--primary))",
            progressSelectedColor: "hsl(var(--primary))",
          },
        });

        // Get departments for this project
        const projectDepartments = (departments || []).filter((d: DepartmentData) => d.project_id === project.id);

        projectDepartments.forEach((dept: DepartmentData) => {
          const deptTasks = tasksWithAssignees.filter(t => t.assignee_department_id === dept.id);
          
          if (deptTasks.length > 0) {
            const deptStart = new Date(Math.min(...deptTasks.map(t => t.start_date ? new Date(t.start_date).getTime() : Date.now())));
            const deptEnd = new Date(Math.max(...deptTasks.map(t => t.due_date ? new Date(t.due_date).getTime() : Date.now())));

            // Add department task
            ganttTasksArray.push({
              id: `dept-${dept.id}`,
              name: `🏢 ${dept.name}`,
              start: deptStart,
              end: deptEnd,
              progress: 0,
              type: "project",
              project: `project-${project.id}`,
              styles: {
                backgroundColor: "hsl(var(--chart-2))",
                progressColor: "hsl(var(--chart-2))",
                progressSelectedColor: "hsl(var(--chart-2))",
              },
            });

            // Add tasks for this department
            deptTasks.forEach((task: TaskWithAssignees) => {
              const taskStart = task.start_date ? new Date(task.start_date) : new Date();
              const taskEnd = task.due_date ? new Date(task.due_date) : new Date(taskStart.getTime() + 7 * 24 * 60 * 60 * 1000);
              
              const assignedNames = task.assigned_users.map(u => u.full_name).join(", ") || "Unassigned";
              
              ganttTasksArray.push({
                id: `task-${task.id}`,
                name: `${task.title} (${assignedNames})`,
                start: taskStart,
                end: taskEnd,
                progress: task.progress_percentage || 0,
                type: "task",
                project: `dept-${dept.id}`,
                styles: {
                  backgroundColor: getTaskColor(task.status),
                  progressColor: getProgressColor(task.status),
                  progressSelectedColor: getProgressColor(task.status),
                },
              });
            });
          }
        });

        // Add tasks without department
        const tasksWithoutDept = tasksWithAssignees.filter(t => t.project_id === project.id && !t.assignee_department_id);
        tasksWithoutDept.forEach((task: TaskWithAssignees) => {
          const taskStart = task.start_date ? new Date(task.start_date) : new Date();
          const taskEnd = task.due_date ? new Date(task.due_date) : new Date(taskStart.getTime() + 7 * 24 * 60 * 60 * 1000);
          
          const assignedNames = task.assigned_users.map(u => u.full_name).join(", ") || "Unassigned";
          
          ganttTasksArray.push({
            id: `task-${task.id}`,
            name: `${task.title} (${assignedNames})`,
            start: taskStart,
            end: taskEnd,
            progress: task.progress_percentage || 0,
            type: "task",
            project: `project-${project.id}`,
            styles: {
              backgroundColor: getTaskColor(task.status),
              progressColor: getProgressColor(task.status),
              progressSelectedColor: getProgressColor(task.status),
            },
          });
        });
      });

      setGanttTasks(ganttTasksArray);
    } catch (error) {
      console.error("Error fetching Gantt data:", error);
      toast({
        title: "Error",
        description: "Failed to load Gantt chart data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const getTaskColor = (status: string) => {
    switch (status) {
      case "completed":
        return "hsl(var(--chart-3))";
      case "in_progress":
        return "hsl(var(--chart-4))";
      default:
        return "hsl(var(--chart-5))";
    }
  };

  const getProgressColor = (status: string) => {
    switch (status) {
      case "completed":
        return "hsl(var(--chart-3))";
      case "in_progress":
        return "hsl(var(--chart-4))";
      default:
        return "hsl(var(--muted))";
    }
  };

  const exportToExcel = () => {
    try {
      const exportData = ganttTasks.map(task => ({
        Type: task.type === "project" ? (task.name.startsWith("📁") ? "Project" : "Department") : "Task",
        Name: task.name.replace(/[📁🏢]/g, "").trim(),
        "Start Date": task.start.toLocaleDateString(),
        "End Date": task.end.toLocaleDateString(),
        "Progress (%)": task.progress,
      }));

      const worksheet = XLSX.utils.json_to_sheet(exportData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Gantt Chart");

      // Auto-size columns
      const maxWidth = exportData.reduce((w, r) => Math.max(w, r.Name.length), 10);
      worksheet["!cols"] = [
        { wch: 12 },
        { wch: maxWidth },
        { wch: 15 },
        { wch: 15 },
        { wch: 12 },
      ];

      XLSX.writeFile(workbook, `gantt-chart-${new Date().toISOString().split("T")[0]}.xlsx`);

      toast({
        title: "Success",
        description: "Gantt chart exported to Excel",
      });
    } catch (error) {
      console.error("Error exporting to Excel:", error);
      toast({
        title: "Error",
        description: "Failed to export to Excel",
        variant: "destructive",
      });
    }
  };

  const exportToPDF = async () => {
    try {
      if (!ganttRef.current) return;

      toast({
        title: "Generating PDF",
        description: "Please wait while we generate your PDF...",
      });

      const canvas = await html2canvas(ganttRef.current, {
        scale: 2,
        useCORS: true,
        logging: false,
      });

      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF({
        orientation: canvas.width > canvas.height ? "landscape" : "portrait",
        unit: "px",
        format: [canvas.width, canvas.height],
      });

      pdf.addImage(imgData, "PNG", 0, 0, canvas.width, canvas.height);
      pdf.save(`gantt-chart-${new Date().toISOString().split("T")[0]}.pdf`);

      toast({
        title: "Success",
        description: "Gantt chart exported to PDF",
      });
    } catch (error) {
      console.error("Error exporting to PDF:", error);
      toast({
        title: "Error",
        description: "Failed to export to PDF",
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Overall Gantt Chart</CardTitle>
          <CardDescription>Loading...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[600px] flex items-center justify-center">
            <p className="text-muted-foreground">Loading Gantt chart data...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (ganttTasks.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Overall Gantt Chart</CardTitle>
          <CardDescription>All projects, departments, and tasks visualization</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[600px] flex items-center justify-center">
            <p className="text-muted-foreground">No data available. Create projects and tasks to see the Gantt chart.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Overall Gantt Chart</CardTitle>
            <CardDescription>All projects, departments, and tasks with assigned users</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Select value={viewMode} onValueChange={(value) => setViewMode(value as ViewMode)}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ViewMode.Day}>Day</SelectItem>
                <SelectItem value={ViewMode.Week}>Week</SelectItem>
                <SelectItem value={ViewMode.Month}>Month</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={exportToExcel} variant="outline" size="sm">
              <FileSpreadsheet className="h-4 w-4 mr-2" />
              Export Excel
            </Button>
            <Button onClick={exportToPDF} variant="outline" size="sm">
              <FileText className="h-4 w-4 mr-2" />
              Export PDF
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div ref={ganttRef} className="bg-background">
          <Gantt
            tasks={ganttTasks}
            viewMode={viewMode}
            listCellWidth="250px"
            columnWidth={viewMode === ViewMode.Month ? 60 : viewMode === ViewMode.Week ? 65 : 60}
            rowHeight={50}
          />
        </div>
      </CardContent>
    </Card>
  );
};

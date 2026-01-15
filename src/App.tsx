import React from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import { ThemeProvider } from "./contexts/ThemeContext";
import { ErrorBoundary } from "./components/ErrorBoundary";
import Layout from "./components/Layout";
import AdminRoute from "./components/AdminRoute";
import Dashboard from "./pages/Dashboard";
import Projects from "./pages/Projects";
import ProjectDetails from "./pages/ProjectDetails";
import DepartmentGantt from "./pages/DepartmentGantt";
import MyTasks from "./pages/MyTasks";
import AdminDashboard from "./pages/admin/AdminDashboard";
import UserManagement from "./pages/admin/UserManagement";
import Analytics from "./pages/Analytics";
import Auth from "./pages/Auth";
import NotFound from "./pages/NotFound";
import GanttDemo from "./pages/GanttDemo";
import GanttDocumentation from "./pages/GanttDocumentation";
import ProjectGanttChartPage from "./pages/ProjectGanttChartPage";
import ProjectAnalytics from "./pages/ProjectAnalytics";
import ProjectDocuments from "./pages/ProjectDocuments";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 5 * 60 * 1000,
    },
  },
});

const App: React.FC = () => (
  <ErrorBoundary>
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <AuthProvider>
              <Routes>
                <Route path="/auth" element={<Auth />} />
                <Route path="/" element={<Layout><Dashboard /></Layout>} />
                <Route path="/dashboard" element={<Layout><Dashboard /></Layout>} />
                <Route path="/my-tasks" element={<Layout><MyTasks /></Layout>} />
                <Route path="/projects" element={<Layout><Projects /></Layout>} />
                <Route path="/projects/:projectId" element={<Layout><ProjectDetails /></Layout>} />
                <Route path="/projects/:projectId/gantt" element={<Layout><ProjectGanttChartPage /></Layout>} />
                <Route path="/projects/:projectId/analytics" element={<Layout><ProjectAnalytics /></Layout>} />
                <Route path="/projects/:projectId/documents" element={<Layout><ProjectDocuments /></Layout>} />
                <Route path="/projects/:projectId/department/:departmentId" element={<Layout><DepartmentGantt /></Layout>} />
                <Route path="/admin" element={<Layout><AdminRoute><AdminDashboard /></AdminRoute></Layout>} />
                <Route path="/admin/users" element={<Layout><AdminRoute><UserManagement /></AdminRoute></Layout>} />
                <Route path="/analytics" element={<Layout><Analytics /></Layout>} />
                <Route path="/gantt-demo" element={<Layout><GanttDemo /></Layout>} />
                <Route path="/gantt-docs" element={<Layout><GanttDocumentation /></Layout>} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </AuthProvider>
          </BrowserRouter>
        </TooltipProvider>
      </QueryClientProvider>
    </ThemeProvider>
  </ErrorBoundary>
);

export default App;

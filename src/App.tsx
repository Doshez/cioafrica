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
import ExternalUserRoute from "./components/ExternalUserRoute";
import Dashboard from "./pages/Dashboard";
import Projects from "./pages/Projects";
import ProjectDetails from "./pages/ProjectDetails";
import DepartmentGantt from "./pages/DepartmentGantt";
import MyTasks from "./pages/MyTasks";
import AdminDashboard from "./pages/admin/AdminDashboard";
import UserManagement from "./pages/admin/UserManagement";
import Analytics from "./pages/Analytics";
import Auth from "./pages/Auth";
import ExternalAuth from "./pages/ExternalAuth";
import NotFound from "./pages/NotFound";
import GanttDemo from "./pages/GanttDemo";
import GanttDocumentation from "./pages/GanttDocumentation";
import ProjectGanttChartPage from "./pages/ProjectGanttChartPage";
import ProjectAnalytics from "./pages/ProjectAnalytics";
import ProjectDocuments from "./pages/ProjectDocuments";
import ProjectReportSettings from "./pages/ProjectReportSettings";
import ExternalUserPortal from "./pages/ExternalUserPortal";

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
                {/* Public auth routes */}
                <Route path="/auth" element={<Auth />} />
                <Route path="/external-login" element={<ExternalAuth />} />
                
                {/* External user portal - dedicated route */}
                <Route path="/external" element={<ExternalUserPortal />} />
                
                {/* Internal routes - protected from external users */}
                <Route path="/" element={<ExternalUserRoute><Layout><Dashboard /></Layout></ExternalUserRoute>} />
                <Route path="/dashboard" element={<ExternalUserRoute><Layout><Dashboard /></Layout></ExternalUserRoute>} />
                <Route path="/my-tasks" element={<ExternalUserRoute><Layout><MyTasks /></Layout></ExternalUserRoute>} />
                <Route path="/projects" element={<ExternalUserRoute><Layout><Projects /></Layout></ExternalUserRoute>} />
                <Route path="/projects/:projectId" element={<ExternalUserRoute><Layout><ProjectDetails /></Layout></ExternalUserRoute>} />
                <Route path="/projects/:projectId/gantt" element={<ExternalUserRoute><Layout><ProjectGanttChartPage /></Layout></ExternalUserRoute>} />
                <Route path="/projects/:projectId/analytics" element={<ExternalUserRoute><Layout><ProjectAnalytics /></Layout></ExternalUserRoute>} />
                <Route path="/projects/:projectId/documents" element={<ExternalUserRoute><Layout><ProjectDocuments /></Layout></ExternalUserRoute>} />
                <Route path="/projects/:projectId/reports" element={<ExternalUserRoute><ProjectReportSettings /></ExternalUserRoute>} />
                <Route path="/projects/:projectId/department/:departmentId" element={<ExternalUserRoute><Layout><DepartmentGantt /></Layout></ExternalUserRoute>} />
                <Route path="/admin" element={<ExternalUserRoute><Layout><AdminRoute><AdminDashboard /></AdminRoute></Layout></ExternalUserRoute>} />
                <Route path="/admin/users" element={<ExternalUserRoute><Layout><AdminRoute><UserManagement /></AdminRoute></Layout></ExternalUserRoute>} />
                <Route path="/analytics" element={<ExternalUserRoute><Layout><Analytics /></Layout></ExternalUserRoute>} />
                <Route path="/gantt-demo" element={<ExternalUserRoute><Layout><GanttDemo /></Layout></ExternalUserRoute>} />
                <Route path="/gantt-docs" element={<ExternalUserRoute><Layout><GanttDocumentation /></Layout></ExternalUserRoute>} />
                
                {/* 404 */}
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

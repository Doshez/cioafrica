import { useParams, Link } from 'react-router-dom';
import { useState, useMemo, lazy, Suspense } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { DocumentBrowser } from '@/components/documents/DocumentBrowser';
import { DepartmentDocumentBrowser } from '@/components/documents/DepartmentDocumentBrowser';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArrowLeft, Folder, Building2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useUserRole } from '@/hooks/useUserRole';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';

interface Department {
  id: string;
  name: string;
}

interface Project {
  id: string;
  name: string;
  owner_id: string | null;
}

export default function ProjectDocuments() {
  const { projectId } = useParams<{ projectId: string }>();
  const { user } = useAuth();
  const { isAdmin, isProjectManager, loading: roleLoading } = useUserRole();
  const [activeTab, setActiveTab] = useState<string>('all');

  // Fetch project data with caching
  const { data: project, isLoading: projectLoading } = useQuery({
    queryKey: ['project', projectId],
    queryFn: async () => {
      if (!projectId) return null;
      const { data, error } = await supabase
        .from('projects')
        .select('id, name, owner_id')
        .eq('id', projectId)
        .single();
      if (error) throw error;
      return data as Project;
    },
    enabled: !!projectId,
    staleTime: 5 * 60 * 1000,
  });

  // Fetch departments with caching
  const { data: departments = [], isLoading: deptsLoading } = useQuery({
    queryKey: ['departments', projectId],
    queryFn: async () => {
      if (!projectId) return [];
      const { data, error } = await supabase
        .from('departments')
        .select('id, name')
        .eq('project_id', projectId)
        .order('name');
      if (error) throw error;
      return data as Department[];
    },
    enabled: !!projectId,
    staleTime: 5 * 60 * 1000,
  });

  // Fetch user's accessible departments
  const { data: accessData, isLoading: accessLoading } = useQuery({
    queryKey: ['user-department-access', projectId, user?.id],
    queryFn: async () => {
      if (!projectId || !user) return { leadDeptIds: new Set<string>(), memberRole: null };
      
      const [leadResult, memberResult] = await Promise.all([
        supabase
          .from('department_leads')
          .select('department_id')
          .eq('user_id', user.id),
        supabase
          .from('project_members')
          .select('role')
          .eq('project_id', projectId)
          .eq('user_id', user.id)
          .maybeSingle()
      ]);

      return {
        leadDeptIds: new Set(leadResult.data?.map(d => d.department_id) || []),
        memberRole: memberResult.data?.role,
      };
    },
    enabled: !!projectId && !!user,
    staleTime: 5 * 60 * 1000,
  });

  // Compute accessible departments
  const accessibleDepartments = useMemo(() => {
    if (!user || !project || !accessData) return [];
    
    const isOwner = project.owner_id === user.id;
    
    if (isAdmin || isProjectManager || isOwner) {
      return departments;
    }

    const { leadDeptIds, memberRole } = accessData;

    if (memberRole === 'owner' || memberRole === 'manager') {
      return departments;
    }

    // Filter to only departments where user is lead
    const accessible = departments.filter(dept => leadDeptIds.has(dept.id));
    
    // If user has no specific department access but is a project member, show all
    if (accessible.length === 0 && memberRole) {
      return departments;
    }

    return accessible;
  }, [user, project, departments, accessData, isAdmin, isProjectManager]);

  const loading = projectLoading || deptsLoading || accessLoading || roleLoading;

  if (loading) {
    return (
      <div className="container mx-auto py-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-48 bg-muted rounded" />
          <div className="h-[600px] bg-muted rounded" />
        </div>
      </div>
    );
  }

  if (!project || !projectId) {
    return (
      <div className="container mx-auto py-6">
        <p>Project not found</p>
      </div>
    );
  }

  const canViewAll = isAdmin || isProjectManager || project.owner_id === user?.id;

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link to={`/projects/${projectId}`}>
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold">{project.name}</h1>
          <p className="text-muted-foreground">Document & Link Management</p>
        </div>
      </div>

      {/* Department Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="flex-wrap h-auto gap-1">
          {canViewAll && (
            <TabsTrigger value="all" className="flex items-center gap-2">
              <Folder className="h-4 w-4" />
              All Documents
            </TabsTrigger>
          )}
          {accessibleDepartments.map((dept) => (
            <TabsTrigger key={dept.id} value={dept.id} className="flex items-center gap-2">
              <Building2 className="h-4 w-4" />
              {dept.name}
            </TabsTrigger>
          ))}
        </TabsList>

        {canViewAll && (
          <TabsContent value="all" className="mt-6">
            <DocumentBrowser projectId={projectId} departments={departments} />
          </TabsContent>
        )}

        {accessibleDepartments.map((dept) => (
          <TabsContent key={dept.id} value={dept.id} className="mt-6">
            <DepartmentDocumentBrowser
              projectId={projectId}
              departmentId={dept.id}
              departmentName={dept.name}
            />
          </TabsContent>
        ))}
      </Tabs>

      {/* Show message if no departments accessible */}
      {accessibleDepartments.length === 0 && !canViewAll && (
        <div className="text-center py-12 text-muted-foreground">
          <Building2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p className="text-lg font-medium">No department access</p>
          <p className="text-sm">You don't have access to any department documents in this project.</p>
        </div>
      )}

      {/* Role indicator */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <span>Your access:</span>
        {isAdmin && <Badge variant="secondary">Admin</Badge>}
        {isProjectManager && <Badge variant="secondary">Project Manager</Badge>}
        {project.owner_id === user?.id && <Badge variant="secondary">Project Owner</Badge>}
        {accessibleDepartments.length > 0 && !canViewAll && (
          <Badge variant="outline">{accessibleDepartments.length} Department(s)</Badge>
        )}
      </div>
    </div>
  );
}

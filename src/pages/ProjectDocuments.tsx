import { useParams, Link } from 'react-router-dom';
import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { UnifiedDocumentBrowser } from '@/components/documents/UnifiedDocumentBrowser';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useUserRole } from '@/hooks/useUserRole';
import { Badge } from '@/components/ui/badge';

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

  // Determine if user can manage documents
  const canManage = useMemo(() => {
    if (!user || !project) return false;
    return isAdmin || isProjectManager || project.owner_id === user.id;
  }, [user, project, isAdmin, isProjectManager]);

  const loading = projectLoading || deptsLoading || roleLoading;

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

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        <Link to={`/projects/${projectId}`}>
          <Button variant="ghost" size="icon" className="shrink-0">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold truncate">{project.name}</h1>
          <p className="text-muted-foreground">Document & Link Management</p>
        </div>
        {/* Role indicator */}
        <div className="flex items-center gap-2 text-sm shrink-0">
          {isAdmin && <Badge variant="secondary">Admin</Badge>}
          {isProjectManager && <Badge variant="secondary">Project Manager</Badge>}
          {project.owner_id === user?.id && <Badge variant="secondary">Project Owner</Badge>}
        </div>
      </div>

      {/* Unified Document Browser */}
      <UnifiedDocumentBrowser
        projectId={projectId}
        departments={departments}
        canManage={canManage}
      />
    </div>
  );
}

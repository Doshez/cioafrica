import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface ProjectLoadingScreenProps {
  projectId?: string;
}

export function ProjectLoadingScreen({ projectId }: ProjectLoadingScreenProps) {
  const [logoUrl, setLogoUrl] = useState<string | null>(null);

  useEffect(() => {
    const fetchProjectLogo = async () => {
      if (!projectId) return;
      
      try {
        const { data } = await supabase
          .from('projects')
          .select('logo_url')
          .eq('id', projectId)
          .single();
        
        if (data?.logo_url) {
          setLogoUrl(data.logo_url);
        }
      } catch (error) {
        console.error('Error fetching project logo:', error);
      }
    };

    fetchProjectLogo();
  }, [projectId]);

  return (
    <div className="flex items-center justify-center min-h-screen bg-background">
      <div className="flex flex-col items-center gap-4">
        {logoUrl ? (
          <div className="relative">
            <img
              src={logoUrl}
              alt="Project Logo"
              className="w-32 h-32 object-contain animate-pulse"
            />
            <div className="absolute inset-0 bg-primary/10 rounded-full blur-2xl animate-pulse" />
          </div>
        ) : (
          <div className="w-32 h-32 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 animate-pulse" />
        )}
        <div className="flex gap-2 mt-4">
          <div className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: '0ms' }} />
          <div className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: '150ms' }} />
          <div className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: '300ms' }} />
        </div>
      </div>
    </div>
  );
}

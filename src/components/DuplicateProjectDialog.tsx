import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Copy, Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface DuplicateProjectDialogProps {
  projectId: string;
  projectName: string;
}

export function DuplicateProjectDialog({ projectId, projectName }: DuplicateProjectDialogProps) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [newName, setNewName] = useState(`Copy of ${projectName}`);
  const [loading, setLoading] = useState(false);

  const handleDuplicate = async () => {
    if (!newName.trim()) {
      toast({
        title: "Error",
        description: "Please enter a name for the new project",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke('duplicate-project', {
        body: {
          projectId,
          newProjectName: newName.trim(),
        },
      });

      if (error) throw error;

      toast({
        title: "Success",
        description: data.message || "Project duplicated successfully",
      });

      setOpen(false);
      
      // Navigate to the new project
      if (data.newProjectId) {
        navigate(`/projects/${data.newProjectId}`);
      }
    } catch (error: any) {
      console.error('Error duplicating project:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to duplicate project",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" onClick={(e) => e.stopPropagation()}>
          <Copy className="h-4 w-4 mr-2" />
          Duplicate
        </Button>
      </DialogTrigger>
      <DialogContent onClick={(e) => e.stopPropagation()}>
        <DialogHeader>
          <DialogTitle>Duplicate Project</DialogTitle>
          <DialogDescription>
            This will create a copy of the project including all departments, elements, and tasks.
            All tasks will be reset to "todo" status and unassigned.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="newName">New Project Name</Label>
            <Input
              id="newName"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Enter project name"
            />
          </div>
        </div>
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={() => setOpen(false)} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={handleDuplicate} disabled={loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Duplicate Project
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

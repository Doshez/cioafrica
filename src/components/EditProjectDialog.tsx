import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useUserRole } from '@/hooks/useUserRole';
import { Pencil, Loader2 } from 'lucide-react';

interface EditProjectDialogProps {
  projectId: string;
  currentName: string;
  currentDescription: string | null;
  currentStartDate?: string;
  currentEndDate?: string | null;
  currentCategory?: string;
  currentClientName?: string | null;
  onProjectUpdated: () => void;
}

export function EditProjectDialog({
  projectId,
  currentName,
  currentDescription,
  currentStartDate,
  currentEndDate,
  currentCategory,
  currentClientName,
  onProjectUpdated,
}: EditProjectDialogProps) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(currentName);
  const [description, setDescription] = useState(currentDescription || '');
  const [startDate, setStartDate] = useState(currentStartDate || '');
  const [endDate, setEndDate] = useState(currentEndDate || '');
  const [category, setCategory] = useState(currentCategory || 'cio_africa');
  const [clientName, setClientName] = useState(currentClientName || '');
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const { isAdmin, isProjectManager } = useUserRole();

  const canEditDates = isAdmin || isProjectManager;

  useEffect(() => {
    if (open) {
      setName(currentName);
      setDescription(currentDescription || '');
      setStartDate(currentStartDate || '');
      setEndDate(currentEndDate || '');
      setCategory(currentCategory || 'cio_africa');
      setClientName(currentClientName || '');
    }
  }, [open, currentName, currentDescription, currentStartDate, currentEndDate, currentCategory, currentClientName]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name.trim()) {
      toast({ title: "Error", description: "Project name is required", variant: "destructive" });
      return;
    }

    if (category === 'client' && !clientName.trim()) {
      toast({ title: "Error", description: "Client name is required for client projects", variant: "destructive" });
      return;
    }

    setLoading(true);

    try {
      const updates: Record<string, any> = {
        name: name.trim(),
        description: description.trim() || null,
        project_category: category,
        client_name: category === 'client' ? clientName.trim() : null,
      };

      if (canEditDates) {
        updates.start_date = startDate;
        updates.end_date = endDate || null;
      }

      const { error } = await supabase
        .from('projects')
        .update(updates)
        .eq('id', projectId);

      if (error) throw error;

      toast({ title: "Success", description: "Project updated successfully" });
      setOpen(false);
      onProjectUpdated();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" onClick={(e) => e.stopPropagation()}>
          <Pencil className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]" onClick={(e) => e.stopPropagation()}>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Edit Project</DialogTitle>
            <DialogDescription>Update project details</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>Project Category</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="cio_africa">CIO Africa Project</SelectItem>
                  <SelectItem value="client">Client Project</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {category === 'client' && (
              <div className="grid gap-2">
                <Label>Client Name *</Label>
                <Input
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  placeholder="e.g., Safaricom, KCB Group"
                  required
                />
              </div>
            )}
            <div className="grid gap-2">
              <Label>Project Name *</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter project name"
                required
              />
            </div>
            <div className="grid gap-2">
              <Label>Description</Label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Enter project description"
                rows={3}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Start Date {canEditDates ? '' : '(view only)'}</Label>
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  disabled={!canEditDates}
                  className={!canEditDates ? 'opacity-60' : ''}
                />
              </div>
              <div className="grid gap-2">
                <Label>End Date {canEditDates ? '' : '(view only)'}</Label>
                <Input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  disabled={!canEditDates}
                  className={!canEditDates ? 'opacity-60' : ''}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Changes
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

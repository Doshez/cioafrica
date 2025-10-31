import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';

interface EditElementDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  element: {
    id: string;
    title: string;
    description?: string;
  } | null;
  onSuccess: () => void;
}

export function EditElementDialog({ open, onOpenChange, element, onSuccess }: EditElementDialogProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (element) {
      setTitle(element.title);
      setDescription(element.description || '');
    }
  }, [element]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!element) return;

    setLoading(true);
    try {
      const { error } = await supabase
        .from('elements')
        .update({
          title: title.trim(),
          description: description.trim() || null,
        })
        .eq('id', element.id);

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Element updated successfully',
      });
      onSuccess();
      onOpenChange(false);
    } catch (error) {
      console.error('Error updating element:', error);
      toast({
        title: 'Error',
        description: 'Failed to update element',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Edit Element</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Element Name</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Enter element name"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Enter element description"
              rows={3}
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Save Changes
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

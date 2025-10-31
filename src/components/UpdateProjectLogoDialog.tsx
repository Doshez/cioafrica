import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Upload, X, Loader2, Image as ImageIcon } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface UpdateProjectLogoDialogProps {
  projectId: string;
  currentLogoUrl?: string | null;
  onLogoUpdated: () => void;
}

export function UpdateProjectLogoDialog({ projectId, currentLogoUrl, onLogoUpdated }: UpdateProjectLogoDialogProps) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) { // 2MB limit
        toast({
          title: "Error",
          description: "Logo file size must be less than 2MB",
          variant: "destructive",
        });
        return;
      }
      setLogoFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setLogoPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const clearLogo = () => {
    setLogoFile(null);
    setLogoPreview(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!logoFile) {
      toast({
        title: "Error",
        description: "Please select a logo to upload",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const fileExt = logoFile.name.split('.').pop();
      const fileName = `${projectId}-${Date.now()}.${fileExt}`;
      
      const { error: uploadError } = await supabase.storage
        .from('project-logos')
        .upload(fileName, logoFile);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('project-logos')
        .getPublicUrl(fileName);

      const { error: updateError } = await supabase
        .from('projects')
        .update({ logo_url: publicUrl })
        .eq('id', projectId);

      if (updateError) throw updateError;

      toast({
        title: "Success",
        description: "Project logo updated successfully",
      });

      clearLogo();
      setOpen(false);
      onLogoUpdated();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveLogo = async () => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from('projects')
        .update({ logo_url: null })
        .eq('id', projectId);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Project logo removed successfully",
      });

      setOpen(false);
      onLogoUpdated();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <ImageIcon className="h-4 w-4" />
          {currentLogoUrl ? 'Update' : 'Add'} Logo
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{currentLogoUrl ? 'Update' : 'Add'} Project Logo</DialogTitle>
          <DialogDescription>
            Upload a new logo for this project (max 2MB)
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {currentLogoUrl && !logoPreview && (
            <div className="space-y-2">
              <Label>Current Logo</Label>
              <div className="relative inline-block">
                <img src={currentLogoUrl} alt="Current logo" className="h-20 w-20 object-contain rounded border" />
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="logo">{logoPreview ? 'New' : 'Upload'} Logo</Label>
            {logoPreview ? (
              <div className="relative inline-block">
                <img src={logoPreview} alt="Logo preview" className="h-20 w-20 object-contain rounded border" />
                <Button
                  type="button"
                  variant="destructive"
                  size="icon"
                  className="absolute -top-2 -right-2 h-6 w-6 rounded-full"
                  onClick={clearLogo}
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Input
                  id="logo"
                  type="file"
                  accept="image/*"
                  onChange={handleLogoChange}
                  className="hidden"
                />
                <Label
                  htmlFor="logo"
                  className="flex items-center gap-2 px-4 py-2 border rounded-md cursor-pointer hover:bg-muted"
                >
                  <Upload className="h-4 w-4" />
                  <span>Choose File</span>
                </Label>
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2">
            {currentLogoUrl && (
              <Button
                type="button"
                variant="destructive"
                onClick={handleRemoveLogo}
                disabled={loading}
              >
                Remove Logo
              </Button>
            )}
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading || !logoFile}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Update Logo
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

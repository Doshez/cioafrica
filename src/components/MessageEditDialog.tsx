import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

interface MessageEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentContent: string;
  onSave: (newContent: string) => void;
}

export const MessageEditDialog = ({
  open,
  onOpenChange,
  currentContent,
  onSave,
}: MessageEditDialogProps) => {
  const [content, setContent] = useState(currentContent);

  useEffect(() => {
    setContent(currentContent);
  }, [currentContent, open]);

  const handleSave = () => {
    if (content.trim() && content !== currentContent) {
      onSave(content);
    }
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Message</DialogTitle>
          <DialogDescription>
            Make changes to your message below.
          </DialogDescription>
        </DialogHeader>
        <div className="py-4">
          <Textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Enter your message..."
            className="min-h-[100px]"
            autoFocus
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!content.trim() || content === currentContent}>
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

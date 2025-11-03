import { useState, useRef } from 'react';
import { Button } from './ui/button';
import { Textarea } from './ui/textarea';
import { Send, Paperclip, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';

interface MessageInputProps {
  onSend: (content: string, attachment?: { url: string; name: string; type: string; size: number }) => void;
  disabled?: boolean;
}

export const MessageInput = ({ onSend, disabled }: MessageInputProps) => {
  const [content, setContent] = useState('');
  const [uploading, setUploading] = useState(false);
  const [attachment, setAttachment] = useState<{ url: string; name: string; type: string; size: number } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const { user } = useAuth();

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    setUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}/${Date.now()}.${fileExt}`;

      const { data, error } = await supabase.storage
        .from('chat-attachments')
        .upload(fileName, file);

      if (error) throw error;

      const { data: { publicUrl } } = supabase.storage
        .from('chat-attachments')
        .getPublicUrl(data.path);

      setAttachment({
        url: publicUrl,
        name: file.name,
        type: file.type,
        size: file.size,
      });

      toast({
        title: 'File uploaded',
        description: 'Your file is ready to send',
      });
    } catch (error: any) {
      toast({
        title: 'Upload failed',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setUploading(false);
    }
  };

  const handleSend = () => {
    if (!content.trim() && !attachment) return;

    onSend(content || 'Attachment', attachment || undefined);
    setContent('');
    setAttachment(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="border-t border-border p-4 bg-card">
      {attachment && (
        <div className="mb-2 flex items-center gap-2 text-sm bg-muted p-2 rounded">
          <Paperclip className="h-4 w-4" />
          <span className="flex-1 truncate">{attachment.name}</span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setAttachment(null)}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}
      <div className="flex gap-2">
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          onChange={handleFileUpload}
          accept=".pdf,.png,.jpg,.jpeg,.gif,.doc,.docx,.xls,.xlsx"
        />
        <Button
          variant="outline"
          size="icon"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading || disabled}
        >
          <Paperclip className="h-4 w-4" />
        </Button>
        <Textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder="Type a message..."
          className="min-h-[60px] resize-none"
          disabled={disabled}
        />
        <Button
          onClick={handleSend}
          disabled={(!content.trim() && !attachment) || disabled}
          size="icon"
        >
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
};

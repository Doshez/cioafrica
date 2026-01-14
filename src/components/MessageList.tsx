import { useEffect, useRef, useState } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { Button } from './ui/button';
import { Edit2, Trash2, Download } from 'lucide-react';
import { ChatMessage } from '@/hooks/useChatMessages';
import { useAuth } from '@/contexts/AuthContext';
import { formatDistanceToNow } from 'date-fns';
import { Skeleton } from './ui/skeleton';
import { MessageConfirmDialog } from './MessageConfirmDialog';
import { MessageEditDialog } from './MessageEditDialog';

interface MessageListProps {
  messages: ChatMessage[];
  loading: boolean;
  onEdit: (messageId: string, content: string) => void;
  onDelete: (messageId: string) => void;
}

export const MessageList = ({ messages, loading, onEdit, onDelete }: MessageListProps) => {
  const { user } = useAuth();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  // Dialog states
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedMessage, setSelectedMessage] = useState<{ id: string; content: string } | null>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleDeleteClick = (messageId: string) => {
    setSelectedMessage({ id: messageId, content: '' });
    setDeleteDialogOpen(true);
  };

  const handleEditClick = (messageId: string, content: string) => {
    setSelectedMessage({ id: messageId, content });
    setEditDialogOpen(true);
  };

  const handleConfirmDelete = () => {
    if (selectedMessage) {
      onDelete(selectedMessage.id);
    }
    setDeleteDialogOpen(false);
    setSelectedMessage(null);
  };

  const handleSaveEdit = (newContent: string) => {
    if (selectedMessage) {
      onEdit(selectedMessage.id, newContent);
    }
    setEditDialogOpen(false);
    setSelectedMessage(null);
  };

  if (loading) {
    return (
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex gap-3">
            <Skeleton className="h-10 w-10 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-16 w-full" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (messages.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground">
        <p>No messages yet. Start the conversation!</p>
      </div>
    );
  }

  return (
    <>
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((message) => {
          const isOwnMessage = message.user_id === user?.id;
          const userName = message.user?.full_name || message.user_email || 'Unknown User';
          const userInitial = userName.charAt(0).toUpperCase();

          return (
            <div
              key={message.id}
              className={`flex gap-3 ${isOwnMessage ? 'flex-row-reverse' : ''}`}
            >
              <Avatar className="h-10 w-10">
                <AvatarImage src={message.user?.avatar_url || undefined} />
                <AvatarFallback>{userInitial}</AvatarFallback>
              </Avatar>

              <div className={`flex-1 ${isOwnMessage ? 'text-right' : ''}`}>
                <div className="flex items-center gap-2 mb-1">
                  <span className={`text-sm font-medium ${isOwnMessage ? 'order-2' : ''}`}>
                    {userName}
                  </span>
                  <span className={`text-xs text-muted-foreground ${isOwnMessage ? 'order-1' : ''}`}>
                    {formatDistanceToNow(new Date(message.created_at), { addSuffix: true })}
                  </span>
                </div>

                <div
                  className={`inline-block max-w-[70%] rounded-lg p-3 ${
                    isOwnMessage
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-foreground'
                  }`}
                >
                  <p className="whitespace-pre-wrap break-words">{message.content}</p>

                  {message.attachment_url && (
                    <div className="mt-2 pt-2 border-t border-current/20">
                      <a
                        href={message.attachment_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 text-sm hover:underline"
                      >
                        <Download className="h-4 w-4" />
                        {message.attachment_name}
                      </a>
                    </div>
                  )}

                  {message.edited_at && (
                    <p className="text-xs opacity-70 mt-1">(edited)</p>
                  )}
                </div>

                {isOwnMessage && (
                  <div className="flex gap-1 mt-1 justify-end">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleEditClick(message.id, message.content)}
                    >
                      <Edit2 className="h-3 w-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteClick(message.id)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Delete Confirmation Dialog */}
      <MessageConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title="Delete Message"
        description="Are you sure you want to delete this message? This action cannot be undone."
        onConfirm={handleConfirmDelete}
        confirmText="Delete"
        variant="destructive"
      />

      {/* Edit Message Dialog */}
      <MessageEditDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        currentContent={selectedMessage?.content || ''}
        onSave={handleSaveEdit}
      />
    </>
  );
};

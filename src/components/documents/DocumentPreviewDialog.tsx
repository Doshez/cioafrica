import { Document } from '@/hooks/useDocumentManagement';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Download, ExternalLink, FileText, FileImage, FileVideo, FileAudio, File } from 'lucide-react';
import { format } from 'date-fns';

interface DocumentPreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  document: Document;
}

export function DocumentPreviewDialog({
  open,
  onOpenChange,
  document,
}: DocumentPreviewDialogProps) {
  const isImage = document.file_type?.startsWith('image/');
  const isPdf = document.file_type === 'application/pdf';
  const isVideo = document.file_type?.startsWith('video/');
  const isAudio = document.file_type?.startsWith('audio/');

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return 'Unknown size';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  };

  const getFileIcon = () => {
    if (isImage) return <FileImage className="h-16 w-16 text-blue-500" />;
    if (isVideo) return <FileVideo className="h-16 w-16 text-purple-500" />;
    if (isAudio) return <FileAudio className="h-16 w-16 text-pink-500" />;
    if (isPdf) return <FileText className="h-16 w-16 text-red-500" />;
    return <File className="h-16 w-16 text-muted-foreground" />;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span className="truncate pr-4">{document.name}</span>
            <div className="flex items-center gap-2 shrink-0">
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.open(document.file_url, '_blank')}
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                Open
              </Button>
              <Button
                size="sm"
                onClick={() => {
                  const anchor = window.document.createElement('a');
                  anchor.href = document.file_url;
                  anchor.download = document.name;
                  anchor.click();
                }}
              >
                <Download className="h-4 w-4 mr-2" />
                Download
              </Button>
            </div>
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-auto">
          {/* Preview area */}
          <div className="rounded-lg border bg-muted/30 overflow-hidden">
            {isImage && (
              <div className="flex items-center justify-center p-4">
                <img
                  src={document.file_url}
                  alt={document.name}
                  className="max-w-full max-h-[500px] object-contain"
                />
              </div>
            )}

            {isPdf && (
              <iframe
                src={`${document.file_url}#view=FitH`}
                className="w-full h-[500px] border-0"
                title={document.name}
              />
            )}

            {isVideo && (
              <div className="flex items-center justify-center p-4">
                <video
                  controls
                  className="max-w-full max-h-[500px]"
                  src={document.file_url}
                >
                  Your browser does not support the video tag.
                </video>
              </div>
            )}

            {isAudio && (
              <div className="flex flex-col items-center justify-center p-8 gap-4">
                {getFileIcon()}
                <audio controls className="w-full max-w-md" src={document.file_url}>
                  Your browser does not support the audio tag.
                </audio>
              </div>
            )}

            {!isImage && !isPdf && !isVideo && !isAudio && (
              <div className="flex flex-col items-center justify-center p-8 gap-4">
                {getFileIcon()}
                <p className="text-muted-foreground">
                  Preview not available for this file type
                </p>
                <Button onClick={() => window.open(document.file_url, '_blank')}>
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Open in New Tab
                </Button>
              </div>
            )}
          </div>

          {/* File details */}
          <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground">File Size</p>
              <p className="font-medium">{formatFileSize(document.file_size)}</p>
            </div>
            <div>
              <p className="text-muted-foreground">File Type</p>
              <p className="font-medium">{document.file_type || 'Unknown'}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Uploaded By</p>
              <p className="font-medium">{document.uploader_name || 'Unknown'}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Upload Date</p>
              <p className="font-medium">
                {format(new Date(document.created_at), 'MMM d, yyyy h:mm a')}
              </p>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

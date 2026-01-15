import { 
  FileText, 
  Image, 
  FileSpreadsheet, 
  Presentation, 
  Film, 
  Music, 
  Archive, 
  Code, 
  File,
  FileType
} from 'lucide-react';
import { getFileTypeInfo } from '@/lib/cloudProviders';

interface FileTypeIconProps {
  fileType: string | null;
  fileName?: string;
  className?: string;
  showBackground?: boolean;
}

export function FileTypeIcon({ 
  fileType, 
  fileName, 
  className = 'h-5 w-5',
  showBackground = true 
}: FileTypeIconProps) {
  const info = getFileTypeInfo(fileType, fileName);
  
  const getIcon = () => {
    const type = fileType?.toLowerCase() || '';
    const name = fileName?.toLowerCase() || '';

    // Images
    if (type.includes('image') || /\.(jpg|jpeg|png|gif|svg|webp|bmp|ico)$/i.test(name)) {
      return <Image className={`${className} ${info.color}`} />;
    }

    // PDFs
    if (type.includes('pdf') || name.endsWith('.pdf')) {
      return <FileType className={`${className} ${info.color}`} />;
    }

    // Word documents
    if (type.includes('word') || /\.(doc|docx)$/i.test(name)) {
      return <FileText className={`${className} ${info.color}`} />;
    }

    // Excel
    if (type.includes('sheet') || type.includes('excel') || /\.(xls|xlsx|csv)$/i.test(name)) {
      return <FileSpreadsheet className={`${className} ${info.color}`} />;
    }

    // PowerPoint
    if (type.includes('presentation') || /\.(ppt|pptx)$/i.test(name)) {
      return <Presentation className={`${className} ${info.color}`} />;
    }

    // Videos
    if (type.includes('video') || /\.(mp4|mov|avi|mkv|webm)$/i.test(name)) {
      return <Film className={`${className} ${info.color}`} />;
    }

    // Audio
    if (type.includes('audio') || /\.(mp3|wav|ogg|flac|aac)$/i.test(name)) {
      return <Music className={`${className} ${info.color}`} />;
    }

    // Archives
    if (type.includes('zip') || type.includes('rar') || /\.(zip|rar|7z|tar|gz)$/i.test(name)) {
      return <Archive className={`${className} ${info.color}`} />;
    }

    // Code files
    if (/\.(js|ts|jsx|tsx|py|java|cpp|c|h|css|html|json|xml|yaml|yml|md)$/i.test(name)) {
      return <Code className={`${className} ${info.color}`} />;
    }

    // Default
    return <File className={`${className} ${info.color}`} />;
  };

  if (showBackground) {
    return (
      <div className={`p-2 rounded-lg ${info.bgColor}`}>
        {getIcon()}
      </div>
    );
  }

  return getIcon();
}

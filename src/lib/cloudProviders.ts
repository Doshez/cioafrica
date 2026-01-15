// Cloud provider detection and utilities

export interface CloudProvider {
  id: string;
  name: string;
  icon: string;
  color: string;
  bgColor: string;
  patterns: RegExp[];
}

export const CLOUD_PROVIDERS: CloudProvider[] = [
  {
    id: 'onedrive',
    name: 'OneDrive',
    icon: '☁️',
    color: 'text-blue-600',
    bgColor: 'bg-blue-500/10',
    patterns: [
      /onedrive\.live\.com/i,
      /1drv\.ms/i,
      /sharepoint\.com.*personal/i,
      /my\.sharepoint\.com/i,
    ],
  },
  {
    id: 'google-drive',
    name: 'Google Drive',
    icon: '📁',
    color: 'text-yellow-600',
    bgColor: 'bg-yellow-500/10',
    patterns: [
      /drive\.google\.com/i,
      /docs\.google\.com/i,
      /sheets\.google\.com/i,
      /slides\.google\.com/i,
    ],
  },
  {
    id: 'dropbox',
    name: 'Dropbox',
    icon: '📦',
    color: 'text-blue-500',
    bgColor: 'bg-blue-400/10',
    patterns: [
      /dropbox\.com/i,
      /db\.tt/i,
      /dl\.dropboxusercontent\.com/i,
    ],
  },
  {
    id: 'sharepoint',
    name: 'SharePoint',
    icon: '🏢',
    color: 'text-teal-600',
    bgColor: 'bg-teal-500/10',
    patterns: [
      /sharepoint\.com/i,
      /\.sharepoint\./i,
    ],
  },
  {
    id: 'box',
    name: 'Box',
    icon: '📥',
    color: 'text-blue-700',
    bgColor: 'bg-blue-600/10',
    patterns: [
      /box\.com/i,
      /app\.box\.com/i,
    ],
  },
  {
    id: 'icloud',
    name: 'iCloud',
    icon: '☁️',
    color: 'text-gray-600',
    bgColor: 'bg-gray-400/10',
    patterns: [
      /icloud\.com/i,
    ],
  },
  {
    id: 'github',
    name: 'GitHub',
    icon: '🐙',
    color: 'text-gray-800 dark:text-gray-200',
    bgColor: 'bg-gray-500/10',
    patterns: [
      /github\.com/i,
      /raw\.githubusercontent\.com/i,
      /gist\.github\.com/i,
    ],
  },
  {
    id: 'notion',
    name: 'Notion',
    icon: '📝',
    color: 'text-gray-800 dark:text-gray-200',
    bgColor: 'bg-gray-400/10',
    patterns: [
      /notion\.so/i,
      /notion\.site/i,
    ],
  },
  {
    id: 'confluence',
    name: 'Confluence',
    icon: '📘',
    color: 'text-blue-600',
    bgColor: 'bg-blue-500/10',
    patterns: [
      /confluence/i,
      /atlassian\.net.*wiki/i,
    ],
  },
  {
    id: 'figma',
    name: 'Figma',
    icon: '🎨',
    color: 'text-purple-600',
    bgColor: 'bg-purple-500/10',
    patterns: [
      /figma\.com/i,
    ],
  },
];

export function detectCloudProvider(url: string): CloudProvider | null {
  for (const provider of CLOUD_PROVIDERS) {
    for (const pattern of provider.patterns) {
      if (pattern.test(url)) {
        return provider;
      }
    }
  }
  return null;
}

export function getFileTypeInfo(fileType: string | null, fileName?: string): {
  icon: string;
  color: string;
  bgColor: string;
  label: string;
} {
  const type = fileType?.toLowerCase() || '';
  const name = fileName?.toLowerCase() || '';

  // Images
  if (type.includes('image') || /\.(jpg|jpeg|png|gif|svg|webp|bmp|ico)$/i.test(name)) {
    return { icon: '🖼️', color: 'text-pink-600', bgColor: 'bg-pink-500/10', label: 'Image' };
  }

  // PDFs
  if (type.includes('pdf') || name.endsWith('.pdf')) {
    return { icon: '📄', color: 'text-red-600', bgColor: 'bg-red-500/10', label: 'PDF' };
  }

  // Word documents
  if (type.includes('word') || /\.(doc|docx)$/i.test(name)) {
    return { icon: '📝', color: 'text-blue-600', bgColor: 'bg-blue-500/10', label: 'Word' };
  }

  // Excel
  if (type.includes('sheet') || type.includes('excel') || /\.(xls|xlsx|csv)$/i.test(name)) {
    return { icon: '📊', color: 'text-green-600', bgColor: 'bg-green-500/10', label: 'Spreadsheet' };
  }

  // PowerPoint
  if (type.includes('presentation') || /\.(ppt|pptx)$/i.test(name)) {
    return { icon: '📽️', color: 'text-orange-600', bgColor: 'bg-orange-500/10', label: 'Presentation' };
  }

  // Videos
  if (type.includes('video') || /\.(mp4|mov|avi|mkv|webm)$/i.test(name)) {
    return { icon: '🎬', color: 'text-purple-600', bgColor: 'bg-purple-500/10', label: 'Video' };
  }

  // Audio
  if (type.includes('audio') || /\.(mp3|wav|ogg|flac|aac)$/i.test(name)) {
    return { icon: '🎵', color: 'text-indigo-600', bgColor: 'bg-indigo-500/10', label: 'Audio' };
  }

  // Archives
  if (type.includes('zip') || type.includes('rar') || /\.(zip|rar|7z|tar|gz)$/i.test(name)) {
    return { icon: '📦', color: 'text-amber-600', bgColor: 'bg-amber-500/10', label: 'Archive' };
  }

  // Code files
  if (/\.(js|ts|jsx|tsx|py|java|cpp|c|h|css|html|json|xml|yaml|yml|md)$/i.test(name)) {
    return { icon: '💻', color: 'text-gray-600', bgColor: 'bg-gray-500/10', label: 'Code' };
  }

  // Text files
  if (type.includes('text') || name.endsWith('.txt')) {
    return { icon: '📃', color: 'text-gray-600', bgColor: 'bg-gray-400/10', label: 'Text' };
  }

  // Default
  return { icon: '📄', color: 'text-gray-600', bgColor: 'bg-gray-400/10', label: 'File' };
}

export function formatFileSize(bytes: number | null): string {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

export function extractDomain(url: string): string {
  try {
    const parsed = new URL(url);
    return parsed.hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

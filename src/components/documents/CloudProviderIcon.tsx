import { Cloud, FileText, Link2 } from 'lucide-react';
import { detectCloudProvider, CloudProvider } from '@/lib/cloudProviders';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface CloudProviderIconProps {
  url: string;
  className?: string;
  showTooltip?: boolean;
}

// SVG icons for major cloud providers
const OneDriveIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" className={className} fill="currentColor">
    <path d="M10.5 18H17a5 5 0 0 0 .8-9.94 7 7 0 0 0-13.64 1.78A4.5 4.5 0 0 0 5.5 18h5z" />
  </svg>
);

const GoogleDriveIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" className={className}>
    <path fill="#4285F4" d="M7.71 3.5L1.15 15l2.89 5h6.51L3.99 8.5 7.71 3.5z" />
    <path fill="#FBBC04" d="M22.85 15L16.29 3.5H9.77l6.56 11.5H22.85z" />
    <path fill="#34A853" d="M22.85 15H10.18l-2.89 5h12.67l2.89-5z" />
  </svg>
);

const DropboxIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" className={className} fill="#0061FF">
    <path d="M12 6.75L6 2.25l-6 4.5 6 4.5 6-4.5zm0 9l-6-4.5-6 4.5 6 4.5 6-4.5zm0-4.5l6-4.5-6-4.5-6 4.5 6 4.5zm0 9l6-4.5-6-4.5-6 4.5 6 4.5z" />
  </svg>
);

const SharePointIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" className={className} fill="#038387">
    <circle cx="12" cy="12" r="10" />
    <path fill="white" d="M8 8h8v8H8z" />
  </svg>
);

const GitHubIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" className={className} fill="currentColor">
    <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z" />
  </svg>
);

const NotionIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" className={className} fill="currentColor">
    <path d="M4.459 4.208c.746.606 1.026.56 2.428.466l13.215-.793c.28 0 .047-.28-.046-.326L17.86 1.968c-.42-.326-.98-.7-2.055-.607L3.01 2.295c-.466.046-.56.28-.374.466l1.823 1.447zm.793 3.08v13.904c0 .747.373 1.027 1.214.98l14.523-.84c.841-.046.934-.56.934-1.166V6.354c0-.606-.233-.933-.747-.887l-15.177.887c-.56.046-.747.327-.747.933zm14.337.745c.093.42 0 .84-.42.888l-.7.14v10.264c-.608.327-1.168.514-1.635.514-.747 0-.933-.234-1.494-.933l-4.577-7.186v6.952l1.448.327s0 .84-1.168.84l-3.22.186c-.094-.186 0-.653.327-.746l.84-.233V9.854L7.822 9.62c-.094-.42.14-1.026.793-1.073l3.454-.233 4.763 7.279v-6.44l-1.215-.14c-.093-.513.28-.886.747-.933l3.222-.186z" />
  </svg>
);

const FigmaIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" className={className}>
    <path fill="#F24E1E" d="M8 24a4 4 0 0 0 4-4v-4H8a4 4 0 0 0 0 8z" />
    <path fill="#A259FF" d="M4 12a4 4 0 0 1 4-4h4v8H8a4 4 0 0 1-4-4z" />
    <path fill="#1ABCFE" d="M12 0v8h4a4 4 0 0 0 0-8h-4z" />
    <path fill="#0ACF83" d="M4 4a4 4 0 0 0 4 4h4V0H8a4 4 0 0 0-4 4z" />
    <path fill="#FF7262" d="M16 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z" />
  </svg>
);

function getProviderIcon(provider: CloudProvider, className: string) {
  switch (provider.id) {
    case 'onedrive':
      return <OneDriveIcon className={className} />;
    case 'google-drive':
      return <GoogleDriveIcon className={className} />;
    case 'dropbox':
      return <DropboxIcon className={className} />;
    case 'sharepoint':
      return <SharePointIcon className={className} />;
    case 'github':
      return <GitHubIcon className={className} />;
    case 'notion':
      return <NotionIcon className={className} />;
    case 'figma':
      return <FigmaIcon className={className} />;
    default:
      return <Cloud className={className} />;
  }
}

export function CloudProviderIcon({ url, className = 'h-4 w-4', showTooltip = true }: CloudProviderIconProps) {
  const provider = detectCloudProvider(url);

  if (!provider) {
    return <Link2 className={`${className} text-muted-foreground`} />;
  }

  const icon = (
    <div className={`flex items-center justify-center ${provider.bgColor} rounded p-1`}>
      {getProviderIcon(provider, `${className} ${provider.color}`)}
    </div>
  );

  if (!showTooltip) return icon;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          {icon}
        </TooltipTrigger>
        <TooltipContent>
          <p>{provider.name}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export function CloudProviderBadge({ url }: { url: string }) {
  const provider = detectCloudProvider(url);

  if (!provider) return null;

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${provider.bgColor} ${provider.color}`}>
      {getProviderIcon(provider, 'h-3 w-3')}
      {provider.name}
    </span>
  );
}

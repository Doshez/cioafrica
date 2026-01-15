import React from 'react';
import { useTheme, Theme } from '@/contexts/ThemeContext';
import { Sun, Moon, Feather, Layers } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

interface ThemeSelectorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const themeIcons: Record<Theme, React.ReactNode> = {
  light: <Sun className="w-6 h-6" />,
  dark: <Moon className="w-6 h-6" />,
  soft: <Feather className="w-6 h-6" />,
  modern: <Layers className="w-6 h-6" />,
};

const themePreviewColors: Record<Theme, { bg: string; card: string; accent: string }> = {
  light: { bg: 'bg-slate-50', card: 'bg-white', accent: 'bg-blue-500' },
  dark: { bg: 'bg-slate-900', card: 'bg-slate-800', accent: 'bg-blue-500' },
  soft: { bg: 'bg-stone-100', card: 'bg-stone-50', accent: 'bg-emerald-500' },
  modern: { bg: 'bg-slate-950', card: 'bg-slate-900', accent: 'bg-violet-500' },
};

export const ThemeSelector: React.FC<ThemeSelectorProps> = ({ open, onOpenChange }) => {
  const { theme, setTheme, themes } = useTheme();

  const handleThemeSelect = (selectedTheme: Theme) => {
    setTheme(selectedTheme);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-xl">Choose Your Theme</DialogTitle>
          <DialogDescription>
            Select a theme that suits your preference. All themes maintain consistent layout and accessibility.
          </DialogDescription>
        </DialogHeader>
        
        <div className="grid grid-cols-2 gap-4 mt-4">
          {themes.map((t) => (
            <button
              key={t.value}
              onClick={() => handleThemeSelect(t.value)}
              className={cn(
                "relative flex flex-col items-center p-4 rounded-lg border-2 transition-all duration-200",
                "hover:scale-[1.02] hover:shadow-md focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2",
                theme === t.value
                  ? "border-primary bg-primary/5 shadow-sm"
                  : "border-border hover:border-primary/50"
              )}
            >
              {/* Theme Preview */}
              <div className={cn(
                "w-full h-20 rounded-md mb-3 overflow-hidden shadow-inner",
                themePreviewColors[t.value].bg
              )}>
                <div className="p-2 h-full flex flex-col gap-1.5">
                  <div className={cn(
                    "h-3 rounded-sm",
                    themePreviewColors[t.value].card
                  )} />
                  <div className="flex gap-1.5 flex-1">
                    <div className={cn(
                      "w-1/3 rounded-sm",
                      themePreviewColors[t.value].card
                    )} />
                    <div className="flex-1 flex flex-col gap-1">
                      <div className={cn(
                        "h-2 w-3/4 rounded-sm",
                        themePreviewColors[t.value].accent
                      )} />
                      <div className={cn(
                        "flex-1 rounded-sm",
                        themePreviewColors[t.value].card
                      )} />
                    </div>
                  </div>
                </div>
              </div>

              {/* Theme Icon and Label */}
              <div className="flex items-center gap-2 mb-1">
                <span className={cn(
                  "transition-colors",
                  theme === t.value ? "text-primary" : "text-muted-foreground"
                )}>
                  {themeIcons[t.value]}
                </span>
                <span className="font-medium">{t.label}</span>
              </div>
              
              {/* Description */}
              <p className="text-xs text-muted-foreground text-center">
                {t.description}
              </p>

              {/* Selected Indicator */}
              {theme === t.value && (
                <div className="absolute top-2 right-2 w-3 h-3 rounded-full bg-primary" />
              )}
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ThemeSelector;

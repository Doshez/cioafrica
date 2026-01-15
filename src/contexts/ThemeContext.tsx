import React, { createContext, useContext, useEffect, useState } from 'react';

export type Theme = 'light' | 'dark' | 'soft' | 'modern';

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  themes: { value: Theme; label: string; description: string }[];
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const THEME_STORAGE_KEY = 'app-theme';

export const themes: { value: Theme; label: string; description: string }[] = [
  { 
    value: 'light', 
    label: 'Light', 
    description: 'Clean and bright for optimal readability' 
  },
  { 
    value: 'dark', 
    label: 'Dark', 
    description: 'Easy on the eyes in low-light environments' 
  },
  { 
    value: 'soft', 
    label: 'Soft', 
    description: 'Minimal and gentle with muted tones' 
  },
  { 
    value: 'modern', 
    label: '3D Modern', 
    description: 'Subtle depth and elegant interactions' 
  },
];

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setThemeState] = useState<Theme>(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem(THEME_STORAGE_KEY) as Theme | null;
      if (stored && themes.some(t => t.value === stored)) {
        return stored;
      }
    }
    return 'light';
  });

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme);
    localStorage.setItem(THEME_STORAGE_KEY, newTheme);
  };

  useEffect(() => {
    const root = document.documentElement;
    
    // Remove all theme classes
    root.classList.remove('light', 'dark', 'soft', 'modern');
    
    // Add the current theme class
    root.classList.add(theme);
    
    // For dark-based themes, also add dark class for component compatibility
    if (theme === 'dark' || theme === 'modern') {
      root.classList.add('dark');
    }
  }, [theme]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme, themes }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

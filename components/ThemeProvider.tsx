'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';

type Theme = 'classic' | 'dark-white' | 'light';

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const themes = {
  classic: {
    name: 'Classic Green',
    background: 'bg-black',
    text: 'text-green-400',
    border: 'border-green-400',
    accent: 'text-green-300',
    highlight: 'text-yellow-400',
    error: 'text-red-400',
    success: 'text-green-400',
    muted: 'text-gray-500',
    button: 'hover:text-yellow-400',
    input: 'bg-transparent text-green-400 placeholder-gray-600',
    modal: 'bg-black border-green-400',
    cyan: 'text-orange-400',
    purple: 'text-purple-400',
    mention: 'bg-green-950 bg-opacity-40',
    mentionOther: 'bg-gray-800 bg-opacity-50',
    roleDefault: 'text-green-400',
    roleOwner: 'text-red-400',
    roleModerator: 'text-yellow-400',
    scrollbar: '#1a1a1a #000000',
    suggestionSelected: 'bg-gray-700',
    suggestionHover: 'hover:bg-gray-800'
  },
  'dark-white': {
    name: 'Midnight',
    background: 'bg-zinc-900',
    text: 'text-gray-200',
    border: 'border-gray-500',
    accent: 'text-gray-300',
    highlight: 'text-yellow-400',
    error: 'text-red-400',
    success: 'text-green-400',
    muted: 'text-gray-400',
    button: 'hover:text-yellow-400',
    input: 'bg-transparent text-gray-200 placeholder-gray-500',
    modal: 'bg-zinc-900 border-gray-500',
    cyan: 'text-orange-300',
    purple: 'text-purple-300',
    mention: 'bg-yellow-950 bg-opacity-40',
    mentionOther: 'bg-gray-600 bg-opacity-50',
    roleDefault: 'text-green-400',
    roleOwner: 'text-red-400',
    roleModerator: 'text-yellow-400',
    scrollbar: '#0f0f10 #18181b',
    suggestionSelected: 'bg-gray-700',
    suggestionHover: 'hover:bg-gray-800'
  },
  light: {
    name: 'Light Mode',
    background: 'bg-gray-300',
    text: 'text-gray-900',
    border: 'border-gray-500',
    accent: 'text-gray-800',
    highlight: 'text-yellow-600',
    error: 'text-red-600',
    success: 'text-green-700',
    muted: 'text-gray-600',
    button: 'hover:text-yellow-600',
    input: 'bg-transparent text-gray-900 placeholder-gray-600',
    modal: 'bg-gray-300 border-gray-500',
    cyan: 'text-orange-700',
    purple: 'text-purple-800',
    mention: 'bg-yellow-200 bg-opacity-60',
    mentionOther: 'bg-gray-400 bg-opacity-50',
    roleDefault: 'text-orange-600',
    roleOwner: 'text-red-600',
    roleModerator: 'text-yellow-600',
    scrollbar: '#c0c5ca #d1d5db',
    suggestionSelected: 'bg-gray-200',
    suggestionHover: 'hover:bg-gray-100'
  }
};

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>('classic');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const savedTheme = localStorage.getItem('irc-theme') as Theme;
    if (savedTheme && savedTheme in themes) {
      setTheme(savedTheme);
    }
    setMounted(true);
  }, []);

  useEffect(() => {
    const themeClasses = {
      classic: 'bg-black text-green-400',
      'dark-white': 'bg-zinc-900 text-gray-200',
      light: 'bg-gray-300 text-gray-900'
    };
    
    document.documentElement.className = themeClasses[theme];
  }, [theme]);

  const handleSetTheme = (newTheme: Theme) => {
    setTheme(newTheme);
    localStorage.setItem('irc-theme', newTheme);
  };

  // Prevent hydration mismatch by not rendering until mounted
  if (!mounted) {
    return null;
  }

  return (
    <ThemeContext.Provider value={{ theme, setTheme: handleSetTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
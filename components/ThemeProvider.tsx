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
    cyan: 'text-cyan-400',
    purple: 'text-purple-400',
    mention: 'bg-green-950 bg-opacity-40',
    mentionOther: 'bg-gray-800 bg-opacity-50',
    roleDefault: 'text-green-400',
    roleOwner: 'text-red-400',
    roleModerator: 'text-yellow-400'
  },
  'dark-white': {
    name: 'Dark White',
    background: 'bg-gray-900',
    text: 'text-white',
    border: 'border-gray-500',
    accent: 'text-gray-300',
    highlight: 'text-blue-400',
    error: 'text-red-400',
    success: 'text-green-400',
    muted: 'text-gray-600',
    button: 'hover:text-blue-300',
    input: 'bg-transparent text-white placeholder-gray-500',
    modal: 'bg-gray-900 border-gray-500',
    cyan: 'text-cyan-300',
    purple: 'text-purple-300',
    mention: 'bg-blue-950 bg-opacity-40',
    mentionOther: 'bg-gray-700 bg-opacity-50',
    roleDefault: 'text-green-400',
    roleOwner: 'text-red-400',
    roleModerator: 'text-yellow-400'
  },
  light: {
    name: 'Light Mode',
    background: 'bg-gray-300',
    text: 'text-gray-900',
    border: 'border-gray-500',
    accent: 'text-gray-800',
    highlight: 'text-blue-600',
    error: 'text-red-600',
    success: 'text-green-700',
    muted: 'text-gray-600',
    button: 'hover:text-blue-500',
    input: 'bg-transparent text-gray-900 placeholder-gray-600',
    modal: 'bg-gray-300 border-gray-500',
    cyan: 'text-cyan-800',
    purple: 'text-purple-800',
    mention: 'bg-blue-200 bg-opacity-60',
    mentionOther: 'bg-gray-400 bg-opacity-50',
    roleDefault: 'text-orange-600',
    roleOwner: 'text-red-600',
    roleModerator: 'text-blue-600'
  }
};

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>('classic');

  useEffect(() => {
    const savedTheme = localStorage.getItem('irc-theme') as Theme;
    if (savedTheme && savedTheme in themes) {
      setTheme(savedTheme);
    }
  }, []);

  const handleSetTheme = (newTheme: Theme) => {
    setTheme(newTheme);
    localStorage.setItem('irc-theme', newTheme);
  };

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
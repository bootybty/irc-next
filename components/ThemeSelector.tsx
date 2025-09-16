'use client';

import { useState } from 'react';
import { useTheme, themes } from './ThemeProvider';

export default function ThemeSelector() {
  const { theme, setTheme } = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  const currentTheme = themes[theme];

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`${currentTheme.accent} ${currentTheme.button} text-xs font-mono`}
        title="Change Theme"
      >
        [THEME]
      </button>
      
      {isOpen && (
        <>
          <div 
            className="fixed inset-0 z-10" 
            onClick={() => setIsOpen(false)}
          />
          <div className={`absolute left-0 bottom-8 ${currentTheme.modal} ${currentTheme.border} border p-2 z-20 min-w-32`}>
            <div className={`${currentTheme.accent} text-xs mb-2 font-mono`}>
              SELECT THEME:
            </div>
            {Object.entries(themes).map(([key, themeData]) => (
              <button
                key={key}
                onClick={() => {
                  setTheme(key as keyof typeof themes);
                  setIsOpen(false);
                }}
                className={`block w-full text-left px-2 py-1 text-xs font-mono ${
                  theme === key 
                    ? currentTheme.highlight 
                    : `${currentTheme.text} ${currentTheme.button}`
                }`}
              >
                {theme === key ? '> ' : '  '}{themeData.name.toUpperCase()}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
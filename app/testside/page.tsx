'use client';

import { useTheme, themes } from '@/components/ThemeProvider';

export default function TestSidePage() {
  const { theme, setTheme } = useTheme();
  const currentTheme = themes[theme];

  // Foreslåede universelle role farver (10 farver til alle roller inkl. custom)
  const proposedRoleColors = {
    // Standard roller
    owner: 'text-red-500',        // Rød - højeste autoritet
    moderator: 'text-amber-500',  // Gul/orange - moderation
    member: 'text-slate-500',     // Mørkegrå - standard medlemmer
    
    // Custom rolle farver (7 valgmuligheder for /createrole)
    vip: 'text-purple-500',       // Lilla - VIP/premium
    helper: 'text-teal-500',      // Teal - hjælper roller
    expert: 'text-emerald-500',   // Grøn - eksperter/specialister  
    supporter: 'text-pink-500',   // Pink - supportere/donorer
    veteran: 'text-indigo-500',   // Indigo - veteraner/gamle medlemmer
    contributor: 'text-orange-500', // Orange - bidragydere
    trusted: 'text-blue-500'     // Blå - trusted members (swapped med member)
  };

  const testUsername = "TestUser";

  return (
    <div className={`min-h-screen ${currentTheme.background} ${currentTheme.text} p-8`}>
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className={`text-2xl font-bold ${currentTheme.accent} mb-4`}>
            === ROLE COLOR TESTING ===
          </h1>
          <p className={`${currentTheme.muted} mb-6`}>
            Test universelle role farver på tværs af alle temaer
          </p>
          
          {/* Theme Switcher */}
          <div className="flex justify-center gap-4 mb-8">
            {Object.keys(themes).map((themeName) => (
              <button
                key={themeName}
                onClick={() => setTheme(themeName as 'classic' | 'dark-white' | 'light')}
                className={`px-4 py-2 border rounded ${
                  theme === themeName 
                    ? `${currentTheme.highlight} border-current` 
                    : `${currentTheme.text} ${currentTheme.border} hover:${currentTheme.highlight}`
                }`}
              >
                {themes[themeName as keyof typeof themes].name}
              </button>
            ))}
          </div>
        </div>

        {/* Current Theme Info */}
        <div className={`${currentTheme.border} border rounded p-4 mb-8`}>
          <h2 className={`${currentTheme.accent} font-bold mb-2`}>Current Theme: {currentTheme.name}</h2>
          <div className="text-sm">
            <p>Background: {currentTheme.background}</p>
            <p>Text: {currentTheme.text}</p>
          </div>
        </div>

        {/* Role Color Tests */}
        <div className="space-y-8">
          <h2 className={`${currentTheme.accent} text-xl font-bold mb-4`}>
            Foreslåede Universelle Role Farver:
          </h2>

          {/* Chat Message Style Test */}
          <div className={`${currentTheme.border} border rounded p-6`}>
            <h3 className={`${currentTheme.accent} font-bold mb-4`}>Chat Messages Style:</h3>
            <div className="space-y-2 font-mono">
              {Object.entries(proposedRoleColors).map(([role, color]) => (
                <div key={role} className="flex items-center gap-2">
                  <span className="text-xs opacity-75">12:34:56</span>
                  <span>&lt;</span>
                  <span className={`${color} font-bold`}>{testUsername.toUpperCase()}</span>
                  <span>&gt;</span>
                  <span>Hello from {role} role!</span>
                </div>
              ))}
            </div>
          </div>

          {/* User List Style Test */}
          <div className={`${currentTheme.border} border rounded p-6`}>
            <h3 className={`${currentTheme.accent} font-bold mb-4`}>User List Style:</h3>
            <div className="space-y-1">
              {Object.entries(proposedRoleColors).map(([role, color]) => (
                <div key={role} className="flex items-center justify-between">
                  <span className={`${color} font-mono text-sm`}>
                    ● {testUsername} [{role.toUpperCase()}]
                  </span>
                  <span className={`${currentTheme.muted} text-xs`}>
                    {color}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Color Contrast Test */}
          <div className={`${currentTheme.border} border rounded p-6`}>
            <h3 className={`${currentTheme.accent} font-bold mb-4`}>Læsbarhedstest:</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {Object.entries(proposedRoleColors).map(([role, color]) => (
                <div key={role} className={`p-3 border rounded ${currentTheme.border}`}>
                  <div className={`${color} font-bold text-center mb-2`}>
                    {role.toUpperCase()}
                  </div>
                  <div className={`${color} text-sm text-center`}>
                    {testUsername}
                  </div>
                  <div className="text-xs text-center mt-2 opacity-75">
                    {color}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Current Theme Role Colors (for comparison) */}
          <div className={`${currentTheme.border} border rounded p-6`}>
            <h3 className={`${currentTheme.accent} font-bold mb-4`}>Nuværende Theme Role Farver (til sammenligning):</h3>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className={`${currentTheme.roleOwner} font-mono`}>● {testUsername} [OWNER]</span>
                <span className={`${currentTheme.muted} text-xs`}>{currentTheme.roleOwner}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className={`${currentTheme.roleModerator} font-mono`}>● {testUsername} [MODERATOR]</span>
                <span className={`${currentTheme.muted} text-xs`}>{currentTheme.roleModerator}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className={`${currentTheme.roleDefault} font-mono`}>● {testUsername} [MEMBER]</span>
                <span className={`${currentTheme.muted} text-xs`}>{currentTheme.roleDefault}</span>
              </div>
            </div>
          </div>

          {/* Alternative Color Suggestions */}
          <div className={`${currentTheme.border} border rounded p-6`}>
            <h3 className={`${currentTheme.accent} font-bold mb-4`}>Alternative Forslag:</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              {/* Color mapping for /createrole command */}
              <div>
                <h4 className="font-bold mb-3">Farve mapping til /createrole kommando:</h4>
                <div className="space-y-1 text-xs font-mono">
                  <div>red → text-red-500</div>
                  <div>amber/yellow → text-amber-500</div>
                  <div>blue → text-blue-500</div>
                  <div>purple → text-purple-500</div>
                  <div>teal → text-teal-500</div>
                  <div>green → text-emerald-500</div>
                  <div>pink → text-pink-500</div>
                  <div>indigo → text-indigo-500</div>
                  <div>orange → text-orange-500</div>
                  <div>slate/gray → text-slate-500 (Member default)</div>
                </div>
              </div>

              {/* Usage examples */}
              <div>
                <h4 className="font-bold mb-3">Eksempler på brug:</h4>
                <div className="space-y-1 text-xs font-mono">
                  <div>/createrole VIP purple</div>
                  <div>/createrole Helper teal</div>
                  <div>/createrole Expert green</div>
                  <div>/createrole Supporter pink</div>
                  <div>/createrole Veteran indigo</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Instructions */}
        <div className={`${currentTheme.border} border rounded p-6 mt-8`}>
          <h3 className={`${currentTheme.accent} font-bold mb-4`}>Instruktioner:</h3>
          <ol className={`${currentTheme.text} space-y-2 text-sm`}>
            <li>1. Skift mellem temaerne ovenfor</li>
            <li>2. Vurder læsbarheden af hver rolle farve</li>
            <li>3. Se hvilke farver der fungerer bedst på tværs af alle temaer</li>
            <li>4. Fortæl mig hvilke farver du foretrækker</li>
          </ol>
        </div>
      </div>
    </div>
  );
}
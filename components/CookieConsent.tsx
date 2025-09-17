'use client';

import { useState, useEffect } from 'react';
import { useTheme, themes } from './ThemeProvider';

interface ConsentPreferences {
  necessary: boolean;
  analytics: boolean;
  performance: boolean;
}

interface CookieConsentProps {
  onConsentChange: (preferences: ConsentPreferences) => void;
}

export default function CookieConsent({ onConsentChange }: CookieConsentProps) {
  const { theme } = useTheme();
  const currentTheme = themes[theme];
  const [showBanner, setShowBanner] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [preferences, setPreferences] = useState<ConsentPreferences>({
    necessary: true,
    analytics: false,
    performance: false,
  });

  useEffect(() => {
    const consent = localStorage.getItem('cookie-consent');
    if (!consent) {
      setShowBanner(true);
    } else {
      const savedPreferences = JSON.parse(consent);
      setPreferences(savedPreferences);
      onConsentChange(savedPreferences);
    }
  }, [onConsentChange]);

  const handleAcceptAll = () => {
    const allConsent = {
      necessary: true,
      analytics: true,
      performance: true,
    };
    setPreferences(allConsent);
    localStorage.setItem('cookie-consent', JSON.stringify(allConsent));
    localStorage.setItem('cookie-consent-date', new Date().toISOString());
    onConsentChange(allConsent);
    
    // Notify other components immediately
    window.dispatchEvent(new CustomEvent('cookie-consent-changed'));
    setShowBanner(false);
  };

  const handleRejectAll = () => {
    const minimalConsent = {
      necessary: true,
      analytics: false,
      performance: false,
    };
    setPreferences(minimalConsent);
    localStorage.setItem('cookie-consent', JSON.stringify(minimalConsent));
    localStorage.setItem('cookie-consent-date', new Date().toISOString());
    onConsentChange(minimalConsent);
    
    // Notify other components immediately
    window.dispatchEvent(new CustomEvent('cookie-consent-changed'));
    setShowBanner(false);
  };

  const handleCustomize = () => {
    localStorage.setItem('cookie-consent', JSON.stringify(preferences));
    localStorage.setItem('cookie-consent-date', new Date().toISOString());
    onConsentChange(preferences);
    
    // Notify other components immediately
    window.dispatchEvent(new CustomEvent('cookie-consent-changed'));
    setShowBanner(false);
  };

  const handlePreferenceChange = (type: keyof ConsentPreferences, value: boolean) => {
    if (type === 'necessary') return; // Necessary cookies cannot be disabled
    setPreferences(prev => ({ ...prev, [type]: value }));
  };

  if (!showBanner) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-90 flex items-end justify-center z-50 p-4">
      <div className={`${currentTheme.modal} ${currentTheme.border} border p-6 max-w-2xl w-full`}>
        <div className={`${currentTheme.text} font-mono text-sm`}>
          <div className={`${currentTheme.accent} mb-4 text-center`}>
            === COOKIE CONSENT ===
          </div>
          
          {!showDetails ? (
            <>
              <div className={`${currentTheme.text} mb-4`}>
                WE USE COOKIES TO IMPROVE YOUR EXPERIENCE. NECESSARY COOKIES ARE REQUIRED FOR THE SITE TO FUNCTION.
              </div>
              <div className={`${currentTheme.muted} mb-6 text-xs`}>
                Analytics cookies help us understand how you use the site. 
                Performance cookies optimize speed and performance.
              </div>
              
              <div className="flex flex-col sm:flex-row gap-2">
                <button
                  onClick={handleAcceptAll}
                  className={`flex-1 bg-green-400 text-black p-2 ${currentTheme.button}`}
                >
                  ACCEPT ALL
                </button>
                <button
                  onClick={handleRejectAll}
                  className={`flex-1 ${currentTheme.error} border ${currentTheme.border} p-2 ${currentTheme.button}`}
                >
                  NECESSARY ONLY
                </button>
                <button
                  onClick={() => setShowDetails(true)}
                  className={`flex-1 ${currentTheme.accent} border ${currentTheme.border} p-2 ${currentTheme.button}`}
                >
                  CUSTOMIZE
                </button>
              </div>
            </>
          ) : (
            <>
              <div className={`${currentTheme.text} mb-4`}>
                CUSTOMIZE YOUR COOKIE PREFERENCES:
              </div>
              
              <div className="space-y-4 mb-6">
                <div className="flex items-center justify-between">
                  <div>
                    <div className={`${currentTheme.accent} font-bold`}>NECESSARY COOKIES</div>
                    <div className={`${currentTheme.muted} text-xs`}>
                      Required for authentication and basic functionality
                    </div>
                  </div>
                  <div className={`${currentTheme.muted}`}>REQUIRED</div>
                </div>
                
                <div className="flex items-center justify-between">
                  <div>
                    <div className={`${currentTheme.accent} font-bold`}>ANALYTICS COOKIES</div>
                    <div className={`${currentTheme.muted} text-xs`}>
                      Vercel Analytics - helps us understand user behavior
                    </div>
                  </div>
                  <button
                    onClick={() => handlePreferenceChange('analytics', !preferences.analytics)}
                    className={`px-3 py-1 border ${currentTheme.border} ${
                      preferences.analytics ? 'bg-green-400 text-black' : currentTheme.text
                    }`}
                  >
                    {preferences.analytics ? 'ON' : 'OFF'}
                  </button>
                </div>
                
                <div className="flex items-center justify-between">
                  <div>
                    <div className={`${currentTheme.accent} font-bold`}>PERFORMANCE COOKIES</div>
                    <div className={`${currentTheme.muted} text-xs`}>
                      Vercel Speed Insights - optimizes site speed
                    </div>
                  </div>
                  <button
                    onClick={() => handlePreferenceChange('performance', !preferences.performance)}
                    className={`px-3 py-1 border ${currentTheme.border} ${
                      preferences.performance ? 'bg-green-400 text-black' : currentTheme.text
                    }`}
                  >
                    {preferences.performance ? 'ON' : 'OFF'}
                  </button>
                </div>
              </div>
              
              <div className="flex flex-col sm:flex-row gap-2">
                <button
                  onClick={handleCustomize}
                  className={`flex-1 bg-green-400 text-black p-2 ${currentTheme.button}`}
                >
                  SAVE PREFERENCES
                </button>
                <button
                  onClick={() => setShowDetails(false)}
                  className={`flex-1 ${currentTheme.accent} border ${currentTheme.border} p-2 ${currentTheme.button}`}
                >
                  BACK
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
'use client';

import { useState, useEffect } from 'react';
import { useTheme, themes } from './ThemeProvider';

export default function TrackingStatus() {
  const { theme } = useTheme();
  const currentTheme = themes[theme];
  const [consent, setConsent] = useState<{necessary: boolean; analytics: boolean; performance: boolean} | null>(null);
  const [showStatus, setShowStatus] = useState(false);

  useEffect(() => {
    const checkConsent = () => {
      const savedConsent = localStorage.getItem('cookie-consent');
      if (savedConsent) {
        try {
          setConsent(JSON.parse(savedConsent));
        } catch {
          setConsent({ necessary: true, analytics: false, performance: false });
        }
      }
    };

    checkConsent();

    const handleConsentChange = () => {
      checkConsent();
      setShowStatus(true);
      setTimeout(() => setShowStatus(false), 8000);
    };

    window.addEventListener('cookie-consent-changed', handleConsentChange);
    return () => window.removeEventListener('cookie-consent-changed', handleConsentChange);
  }, []);

  if (!consent || !showStatus) return null;

  return (
    <div className="fixed top-4 right-4 z-50">
      <div className={`${currentTheme.modal} ${currentTheme.border} border p-3 max-w-xs`}>
        <div className={`${currentTheme.text} font-mono text-xs`}>
          <div className={`${currentTheme.accent} mb-2`}>TRACKING STATUS:</div>
          <div className="space-y-1">
            <div className={consent.analytics ? currentTheme.success : currentTheme.error}>
              ANALYTICS: {consent.analytics ? 'ON' : 'OFF'}
            </div>
            <div className={consent.performance ? currentTheme.success : currentTheme.error}>
              PERFORMANCE: {consent.performance ? 'ON' : 'OFF'}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
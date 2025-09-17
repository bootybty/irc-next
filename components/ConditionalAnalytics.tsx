'use client';

import { useEffect, useState } from 'react';
import { Analytics } from '@vercel/analytics/react';
import { SpeedInsights } from '@vercel/speed-insights/next';

interface ConsentPreferences {
  necessary: boolean;
  analytics: boolean;
  performance: boolean;
}

export default function ConditionalAnalytics() {
  const [consent, setConsent] = useState<ConsentPreferences | null>(null);

  useEffect(() => {
    const checkConsent = () => {
      const savedConsent = localStorage.getItem('cookie-consent');
      if (savedConsent) {
        try {
          setConsent(JSON.parse(savedConsent));
        } catch (error) {
          // Handle invalid JSON, set default consent
          const defaultConsent = {
            necessary: true,
            analytics: false,
            performance: false,
          };
          setConsent(defaultConsent);
          localStorage.setItem('cookie-consent', JSON.stringify(defaultConsent));
        }
      }
    };

    // Check initially
    checkConsent();

    // Listen for storage changes (when user changes preferences)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'cookie-consent') {
        checkConsent();
      }
    };

    // Also listen for custom events for same-tab updates
    const handleConsentChange = () => {
      checkConsent();
    };

    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('cookie-consent-changed', handleConsentChange);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('cookie-consent-changed', handleConsentChange);
    };
  }, []);

  // Don't render anything until we know the consent status
  if (!consent) {
    return null;
  }

  return (
    <>
      {consent.analytics && <Analytics />}
      {consent.performance && <SpeedInsights />}
    </>
  );
}
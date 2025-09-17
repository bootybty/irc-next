'use client';

import { useState } from 'react';
import { useTheme, themes } from './ThemeProvider';
import PrivacyPolicy from './PrivacyPolicy';
import CookiePolicy from './CookiePolicy';
import { supabase } from '@/lib/supabase';

interface PrivacyCenterProps {
  onClose: () => void;
}

export default function PrivacyCenter({ onClose }: PrivacyCenterProps) {
  const { theme } = useTheme();
  const currentTheme = themes[theme];
  const [activeView, setActiveView] = useState<'menu' | 'privacy' | 'cookies' | 'preferences' | 'data'>('menu');
  const [cookiePreferences, setCookiePreferences] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('cookie-consent');
      return saved ? JSON.parse(saved) : { necessary: true, analytics: false, performance: false };
    }
    return { necessary: true, analytics: false, performance: false };
  });

  const handlePreferenceChange = (type: string, value: boolean) => {
    if (type === 'necessary') return;
    const newPreferences = { ...cookiePreferences, [type]: value };
    setCookiePreferences(newPreferences);
    localStorage.setItem('cookie-consent', JSON.stringify(newPreferences));
    localStorage.setItem('cookie-consent-date', new Date().toISOString());
    
    // Dispatch custom event to notify other components immediately
    window.dispatchEvent(new CustomEvent('cookie-consent-changed'));
  };

  const handleDataExport = () => {
    const userData = {
      theme: localStorage.getItem('irc-theme'),
      cookieConsent: localStorage.getItem('cookie-consent'),
      consentDate: localStorage.getItem('cookie-consent-date'),
      exportDate: new Date().toISOString()
    };

    const blob = new Blob([JSON.stringify(userData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `irc-chat-data-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleClearData = () => {
    if (confirm('ARE YOU SURE? This will delete all local data and log you out.')) {
      localStorage.clear();
      sessionStorage.clear();
      window.location.reload();
    }
  };

  const handleAccountDeletion = async () => {
    const confirmText = 'DELETE';
    const userInput = prompt(
      `WARNING: This will permanently delete your account and ALL data including messages, profile, and channel memberships.\n\nThis action CANNOT be undone!\n\nType "${confirmText}" to confirm deletion:`
    );

    if (userInput !== confirmText) {
      if (userInput !== null) {
        alert('Account deletion cancelled - confirmation text did not match.');
      }
      return;
    }

    try {
      // Get current user session
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError || !session) {
        alert('ERROR: Could not verify user session. Please try logging out and back in.');
        return;
      }

      console.log('Calling delete account API...');
      
      // Call our API route to delete the account
      const response = await fetch('/api/delete-account', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json'
        }
      });

      console.log('Response status:', response.status);
      console.log('Response headers:', Object.fromEntries(response.headers.entries()));

      let result;
      try {
        result = await response.json();
        console.log('Response body:', result);
      } catch (jsonError) {
        console.error('Failed to parse JSON response:', jsonError);
        const text = await response.text();
        console.log('Raw response text:', text);
        alert('ERROR: Invalid response from server. Please contact support via GitHub.');
        return;
      }

      if (!response.ok) {
        console.error('Delete API error:', result);
        console.error('Error details:', JSON.stringify(result, null, 2));
        alert(`ERROR: ${result.error || 'Account deletion failed'}. Details: ${JSON.stringify(result.details)}. Please contact support via GitHub.`);
        return;
      }

      // Sign out the user
      await supabase.auth.signOut();

      // Clear all local data
      localStorage.clear();
      sessionStorage.clear();

      alert('ACCOUNT DELETED SUCCESSFULLY\n\nYour account and all associated data have been permanently deleted from our servers.');
      
      // Redirect to home page
      window.location.href = '/';

    } catch (error) {
      console.error('Account deletion error:', error);
      alert('ERROR: Account deletion failed. Please contact support via GitHub.');
    }
  };

  if (activeView === 'privacy') {
    return <PrivacyPolicy onClose={() => setActiveView('menu')} />;
  }

  if (activeView === 'cookies') {
    return <CookiePolicy onClose={() => setActiveView('menu')} />;
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center z-50 p-4">
      <div className={`${currentTheme.modal} ${currentTheme.border} border p-6 max-w-2xl w-full max-h-[90vh] overflow-auto`} style={{
        scrollbarWidth: 'thin',
        scrollbarColor: currentTheme.scrollbar
      }}>
        <div className={`${currentTheme.text} font-mono text-sm`}>
          <div className="flex justify-between items-center mb-6">
            <div className={`${currentTheme.accent} text-lg`}>
              === PRIVACY CENTER ===
            </div>
            <button
              onClick={onClose}
              className={`${currentTheme.error} ${currentTheme.button} px-3 py-1`}
            >
              [CLOSE]
            </button>
          </div>

          {activeView === 'menu' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-3">
                <button
                  onClick={() => setActiveView('privacy')}
                  className={`p-3 border ${currentTheme.border} ${currentTheme.button} text-left`}
                >
                  <div className={`${currentTheme.accent} font-bold`}>PRIVACY POLICY</div>
                  <div className={`${currentTheme.muted} text-xs`}>
                    Read how we process your data
                  </div>
                </button>

                <button
                  onClick={() => setActiveView('cookies')}
                  className={`p-3 border ${currentTheme.border} ${currentTheme.button} text-left`}
                >
                  <div className={`${currentTheme.accent} font-bold`}>COOKIE POLICY</div>
                  <div className={`${currentTheme.muted} text-xs`}>
                    Details about cookies we use
                  </div>
                </button>

                <button
                  onClick={() => setActiveView('preferences')}
                  className={`p-3 border ${currentTheme.border} ${currentTheme.button} text-left`}
                >
                  <div className={`${currentTheme.accent} font-bold`}>COOKIE PREFERENCES</div>
                  <div className={`${currentTheme.muted} text-xs`}>
                    Manage your consent settings
                  </div>
                </button>

                <button
                  onClick={() => setActiveView('data')}
                  className={`p-3 border ${currentTheme.border} ${currentTheme.button} text-left`}
                >
                  <div className={`${currentTheme.accent} font-bold`}>YOUR DATA RIGHTS</div>
                  <div className={`${currentTheme.muted} text-xs`}>
                    Export or delete your data
                  </div>
                </button>
              </div>
            </div>
          )}

          {activeView === 'preferences' && (
            <div className="space-y-6">
              <button
                onClick={() => setActiveView('menu')}
                className={`${currentTheme.accent} ${currentTheme.button} mb-4`}
              >
                ← BACK
              </button>

              <div className={`${currentTheme.text} mb-4`}>
                COOKIE PREFERENCES:
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between p-3 border border-gray-600">
                  <div>
                    <div className={`${currentTheme.accent} font-bold`}>NECESSARY COOKIES</div>
                    <div className={`${currentTheme.muted} text-xs`}>
                      Required for authentication and basic functionality
                    </div>
                  </div>
                  <div className={`${currentTheme.muted}`}>REQUIRED</div>
                </div>

                <div className="flex items-center justify-between p-3 border border-gray-600">
                  <div>
                    <div className={`${currentTheme.accent} font-bold`}>ANALYTICS COOKIES</div>
                    <div className={`${currentTheme.muted} text-xs`}>
                      Vercel Analytics - helps us understand user behavior
                    </div>
                  </div>
                  <button
                    onClick={() => handlePreferenceChange('analytics', !cookiePreferences.analytics)}
                    className={`px-3 py-1 border ${currentTheme.border} ${
                      cookiePreferences.analytics ? 'bg-green-400 text-black' : currentTheme.text
                    }`}
                  >
                    {cookiePreferences.analytics ? 'ON' : 'OFF'}
                  </button>
                </div>

                <div className="flex items-center justify-between p-3 border border-gray-600">
                  <div>
                    <div className={`${currentTheme.accent} font-bold`}>PERFORMANCE COOKIES</div>
                    <div className={`${currentTheme.muted} text-xs`}>
                      Vercel Speed Insights - optimizes site speed
                    </div>
                  </div>
                  <button
                    onClick={() => handlePreferenceChange('performance', !cookiePreferences.performance)}
                    className={`px-3 py-1 border ${currentTheme.border} ${
                      cookiePreferences.performance ? 'bg-green-400 text-black' : currentTheme.text
                    }`}
                  >
                    {cookiePreferences.performance ? 'ON' : 'OFF'}
                  </button>
                </div>
              </div>

              <div className={`${currentTheme.muted} text-xs pt-4 border-t border-gray-600`}>
                Changes take effect on next page reload. 
                Consent saved: {localStorage.getItem('cookie-consent-date') ? 
                  new Date(localStorage.getItem('cookie-consent-date')!).toLocaleDateString('en-US') : 'Never'}
              </div>
            </div>
          )}

          {activeView === 'data' && (
            <div className="space-y-6">
              <button
                onClick={() => setActiveView('menu')}
                className={`${currentTheme.accent} ${currentTheme.button} mb-4`}
              >
                ← BACK
              </button>

              <div className={`${currentTheme.text} mb-4`}>
                YOUR DATA RIGHTS:
              </div>

              <div className="space-y-4">
                <div className="p-3 border border-gray-600">
                  <div className={`${currentTheme.accent} font-bold mb-2`}>EXPORT DATA</div>
                  <div className={`${currentTheme.muted} text-xs mb-3`}>
                    Download your local data (theme, cookie preferences)
                  </div>
                  <button
                    onClick={handleDataExport}
                    className={`bg-green-400 text-black px-4 py-2 ${currentTheme.button}`}
                  >
                    DOWNLOAD DATA
                  </button>
                </div>

                <div className="p-3 border border-gray-600">
                  <div className={`${currentTheme.accent} font-bold mb-2`}>DELETE LOCAL DATA</div>
                  <div className={`${currentTheme.muted} text-xs mb-3`}>
                    Remove all cookies and local data. You will be logged out.
                  </div>
                  <button
                    onClick={handleClearData}
                    className={`${currentTheme.error} border ${currentTheme.border} px-4 py-2 ${currentTheme.button}`}
                  >
                    DELETE ALL DATA
                  </button>
                </div>

                <div className="p-3 border border-gray-600">
                  <div className={`${currentTheme.accent} font-bold mb-2`}>ACCOUNT DELETION</div>
                  <div className={`${currentTheme.muted} text-xs mb-3`}>
                    Permanently delete your account and ALL data including messages, profile, and memberships.
                    This action CANNOT be undone!
                  </div>
                  <button
                    onClick={handleAccountDeletion}
                    className={`${currentTheme.error} border ${currentTheme.border} px-4 py-2 ${currentTheme.button}`}
                  >
                    DELETE ACCOUNT PERMANENTLY
                  </button>
                </div>
              </div>

              <div className={`${currentTheme.muted} text-xs pt-4 border-t border-gray-600`}>
                Note: Chat messages are stored on the server and require separate request for deletion.
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useTheme, themes } from '@/components/ThemeProvider';

export default function ConfirmPage() {
  const { theme } = useTheme();
  const currentTheme = themes[theme];
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('');
  const router = useRouter();

  useEffect(() => {
    const handleEmailConfirmation = async () => {
      try {
        // Check for hash fragments (email confirmation tokens)
        const hashFragment = window.location.hash;
        
        if (hashFragment) {
          // This is a confirmation callback with tokens
          const { data, error } = await supabase.auth.getSession();
          
          if (data.session) {
            // Email confirmed successfully, but log out immediately
            await supabase.auth.signOut();
            setStatus('success');
            setMessage('Email confirmed successfully! Please return to the main page to log in.');
            
            // Clear the hash to prevent auto-login on refresh
            window.history.replaceState(null, '', window.location.pathname);
          } else if (error) {
            setStatus('error');
            setMessage('Error confirming email: ' + error.message);
          } else {
            setStatus('error');
            setMessage('Confirmation failed. Please try again.');
          }
        } else {
          // Direct visit to page without confirmation tokens
          setStatus('error');
          setMessage('No confirmation token found. Please use the link from your email.');
        }
      } catch (err) {
        setStatus('error');
        setMessage('An unexpected error occurred.');
      }
    };

    handleEmailConfirmation();
  }, []);

  const handleReturnToSite = () => {
    router.push('/');
  };

  return (
    <div className={`min-h-screen ${currentTheme.background} ${currentTheme.text} font-mono flex items-center justify-center`}>
      <div className={`max-w-md w-full mx-4 p-6 border ${currentTheme.border} ${currentTheme.background}`}>
        <div className="text-center">
          <div className={`${currentTheme.accent} mb-4`}>
            === EMAIL CONFIRMATION ===
          </div>
          
          {status === 'loading' && (
            <div className={`${currentTheme.highlight}`}>
              PROCESSING CONFIRMATION...
            </div>
          )}
          
          {status === 'success' && (
            <div>
              <div className={`${currentTheme.success} mb-4`}>
                ✅ SUCCESS: {message.toUpperCase()}
              </div>
              <button
                onClick={handleReturnToSite}
                className={`w-full bg-green-400 text-black p-2 ${currentTheme.button}`}
              >
                RETURN TO IRC
              </button>
            </div>
          )}
          
          {status === 'error' && (
            <div>
              <div className={`${currentTheme.error} mb-4`}>
                ❌ ERROR: {message.toUpperCase()}
              </div>
              <button
                onClick={handleReturnToSite}
                className={`w-full border ${currentTheme.border} ${currentTheme.text} p-2 focus:outline-none focus:border-yellow-400 ${currentTheme.button}`}
              >
                RETURN TO IRC
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
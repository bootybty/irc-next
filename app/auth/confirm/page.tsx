'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

export default function ConfirmPage() {
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
    <div className="min-h-screen bg-black text-green-400 font-mono flex items-center justify-center">
      <div className="max-w-md w-full mx-4 p-6 border border-green-400 bg-black">
        <div className="text-center">
          <div className="text-green-300 mb-4">
            === EMAIL CONFIRMATION ===
          </div>
          
          {status === 'loading' && (
            <div className="text-yellow-400">
              PROCESSING CONFIRMATION...
            </div>
          )}
          
          {status === 'success' && (
            <div>
              <div className="text-green-400 mb-4">
                ✅ SUCCESS: {message.toUpperCase()}
              </div>
              <button
                onClick={handleReturnToSite}
                className="w-full bg-green-400 text-black p-2 hover:bg-yellow-400"
              >
                RETURN TO IRC
              </button>
            </div>
          )}
          
          {status === 'error' && (
            <div>
              <div className="text-red-400 mb-4">
                ❌ ERROR: {message.toUpperCase()}
              </div>
              <button
                onClick={handleReturnToSite}
                className="w-full border border-green-400 text-green-400 p-2 hover:border-yellow-400 hover:text-yellow-400"
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
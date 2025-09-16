'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

export default function ResetPasswordPage() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const router = useRouter();

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    
    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }
    
    setLoading(true);
    setError('');

    try {
      const { error } = await supabase.auth.updateUser({
        password: password
      });

      if (error) throw error;

      setSuccess(true);
      setTimeout(() => {
        router.push('/');
      }, 2000);
    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : 'Failed to update password');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen bg-black text-green-400 font-mono flex items-center justify-center">
        <div className="max-w-md w-full mx-4 p-6 border border-green-400 bg-black">
          <div className="text-center">
            <div className="text-green-300 mb-4">
              === PASSWORD UPDATED ===
            </div>
            <div className="text-green-400 mb-4">
              YOUR PASSWORD HAS BEEN SUCCESSFULLY UPDATED!
            </div>
            <div className="text-gray-400 text-xs">
              REDIRECTING TO LOGIN...
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-green-400 font-mono flex items-center justify-center">
      <div className="max-w-md w-full mx-4 p-6 border border-green-400 bg-black">
        <div className="text-center mb-6">
          <div className="text-green-300 mb-2">
            === RESET PASSWORD ===
          </div>
          <div className="text-xs text-gray-400">
            ENTER YOUR NEW PASSWORD
          </div>
        </div>

        <form onSubmit={handleResetPassword} className="space-y-4">
          <div>
            <label className="block text-green-300 mb-1">NEW PASSWORD:</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-black border border-green-400 text-green-400 p-2 focus:outline-none focus:border-yellow-400"
              placeholder="********"
              minLength={6}
              required
            />
          </div>

          <div>
            <label className="block text-green-300 mb-1">CONFIRM PASSWORD:</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full bg-black border border-green-400 text-green-400 p-2 focus:outline-none focus:border-yellow-400"
              placeholder="********"
              minLength={6}
              required
            />
          </div>

          {error && (
            <div className="text-red-400 text-xs">
              *** ERROR: {error.toUpperCase()}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !password.trim() || !confirmPassword.trim()}
            className="w-full bg-green-400 text-black p-2 hover:bg-yellow-400 disabled:opacity-50"
          >
            {loading ? 'UPDATING...' : 'UPDATE PASSWORD'}
          </button>

          <div className="text-center">
            <button
              type="button"
              onClick={() => router.push('/')}
              className="text-gray-400 hover:text-green-400 text-xs"
            >
              BACK TO LOGIN
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';

interface AuthModalProps {
  onAuthSuccess: (user: { id: string; username: string }) => void;
  onCancel?: () => void;
}

export default function AuthModal({ onAuthSuccess, onCancel }: AuthModalProps) {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      if (isLogin) {
        // Login - simple and clean
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) throw error;

        if (data.user) {
          // Get profile that was auto-created by trigger
          const { data: profile } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', data.user.id)
            .single();

          if (profile) {
            onAuthSuccess({ id: data.user.id, username: profile.username });
          } else {
            throw new Error('Profile not found after login');
          }
        }
      } else {
        // Sign up - let trigger handle profile creation
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              username: username.trim(),
            }
          }
        });

        if (error) throw error;

        if (data.user) {
          // Check if user needs email confirmation
          if (!data.session) {
            setError('Please check your email to confirm your account before logging in.');
            return;
          }

          // Profile should be auto-created by trigger
          const { data: profile } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', data.user.id)
            .single();

          if (profile) {
            // Add new user to global channel
            const { data: globalChannel } = await supabase
              .from('channels')
              .select('id')
              .eq('name', 'global')
              .single();
            
            if (globalChannel) {
              await supabase
                .from('channel_members')
                .insert({
                  channel_id: globalChannel.id,
                  user_id: data.user.id,
                  username: profile.username,
                  role: 'member'
                });
            }
            
            onAuthSuccess({ id: data.user.id, username: profile.username });
          } else {
            throw new Error('Profile was not created automatically');
          }
        }
      }
    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : 'An unknown error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center z-50">
      <div className="bg-black border border-green-400 p-6 max-w-md w-full mx-4">
        <div className="text-green-400 font-mono text-sm">
          <div className="text-center mb-6">
            <div className="text-green-300 mb-2">
              {isLogin ? '=== LOGIN TO IRC ===' : '=== REGISTER FOR IRC ==='}
            </div>
            <div className="text-xs text-gray-400">
              {isLogin ? 'ENTER YOUR CREDENTIALS' : 'CREATE NEW ACCOUNT'}
            </div>
          </div>

          <form onSubmit={handleAuth} className="space-y-4">
            {!isLogin && (
              <div>
                <label className="block text-green-300 mb-1">USERNAME:</label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full bg-black border border-green-400 text-green-400 p-2 focus:outline-none focus:border-yellow-400"
                  placeholder="YOUR_HANDLE"
                  maxLength={30}
                  pattern="[a-zA-Z0-9_-]+"
                  required={!isLogin}
                />
                <div className="text-xs text-gray-400 mt-1">
                  LETTERS, NUMBERS, UNDERSCORE, HYPHEN ONLY
                </div>
              </div>
            )}

            <div>
              <label className="block text-green-300 mb-1">EMAIL:</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-black border border-green-400 text-green-400 p-2 focus:outline-none focus:border-yellow-400"
                placeholder="USER@DOMAIN.COM"
                required
              />
            </div>

            <div>
              <label className="block text-green-300 mb-1">PASSWORD:</label>
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

            {error && (
              <div className="text-red-400 text-xs">
                *** ERROR: {error.toUpperCase()}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !email.trim() || !password.trim() || (!isLogin && !username.trim())}
              className="w-full bg-green-400 text-black p-2 hover:bg-yellow-400 disabled:opacity-50"
            >
              {loading ? 'PROCESSING...' : (isLogin ? 'LOGIN' : 'REGISTER')}
            </button>

            <div className="text-center space-y-2">
              <button
                type="button"
                onClick={() => {
                  setIsLogin(!isLogin);
                  setError('');
                  setEmail('');
                  setPassword('');
                  setUsername('');
                }}
                className="text-gray-400 hover:text-green-400 text-xs block w-full"
              >
                {isLogin ? 'NEED AN ACCOUNT? REGISTER' : 'HAVE AN ACCOUNT? LOGIN'}
              </button>
              
              {onCancel && (
                <button
                  type="button"
                  onClick={onCancel}
                  className="text-red-400 hover:text-red-300 text-xs block w-full"
                >
                  CANCEL / GO BACK
                </button>
              )}
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
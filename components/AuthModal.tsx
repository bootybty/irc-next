'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';

interface AuthModalProps {
  onAuthSuccess: (user: any) => void;
}

export default function AuthModal({ onAuthSuccess }: AuthModalProps) {
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
        // Login
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) throw error;

        // Get user profile
        const { data: profile } = await supabase
          .from('users')
          .select('*')
          .eq('email', email)
          .single();

        onAuthSuccess({ ...data.user, profile });
      } else {
        // Sign up
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
        });

        if (error) throw error;

        if (data.user) {
          // Create user profile
          const { error: profileError } = await supabase
            .from('users')
            .insert([
              {
                id: data.user.id,
                username,
                email,
              },
            ]);

          if (profileError) throw profileError;

          onAuthSuccess({ ...data.user, profile: { username, email } });
        }
      }
    } catch (error: any) {
      setError(error.message);
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
                  placeholder="ENTER USERNAME..."
                  required
                />
              </div>
            )}

            <div>
              <label className="block text-green-300 mb-1">EMAIL:</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-black border border-green-400 text-green-400 p-2 focus:outline-none focus:border-yellow-400"
                placeholder="ENTER EMAIL..."
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
                placeholder="ENTER PASSWORD..."
                required
              />
            </div>

            {error && (
              <div className="text-red-400 text-xs">
                *** ERROR: {error.toUpperCase()}
              </div>
            )}

            <div className="flex gap-2">
              <button
                type="submit"
                disabled={loading}
                className="flex-1 bg-green-400 text-black p-2 hover:bg-yellow-400 disabled:opacity-50"
              >
                {loading ? 'PROCESSING...' : isLogin ? 'LOGIN' : 'REGISTER'}
              </button>
            </div>

            <div className="text-center">
              <button
                type="button"
                onClick={() => {
                  setIsLogin(!isLogin);
                  setError('');
                }}
                className="text-yellow-400 hover:text-green-300 text-xs"
              >
                {isLogin ? 'NEED ACCOUNT? REGISTER' : 'HAVE ACCOUNT? LOGIN'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
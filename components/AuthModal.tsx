'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useTheme, themes } from '@/components/ThemeProvider';

interface AuthModalProps {
  onAuthSuccess: (user: { id: string; username: string }) => void;
  onCancel?: () => void;
}

export default function AuthModal({ onAuthSuccess, onCancel }: AuthModalProps) {
  const { theme } = useTheme();
  const currentTheme = themes[theme];
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showForgotPassword, setShowForgotPassword] = useState(false);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');
    
    // Handle forgot password
    if (showForgotPassword) {
      try {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: 'http://localhost:3001/auth/reset-password'
        });
        
        if (error) throw error;
        
        setSuccess('Password reset email sent! Please check your email for instructions.');
        setLoading(false);
        return;
      } catch (error: unknown) {
        setError(error instanceof Error ? error.message : 'Failed to send reset email');
        setLoading(false);
        return;
      }
    }

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
            .from('users')
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
        // Sign up - first check for duplicates
        const trimmedUsername = username.trim();
        
        // Check if username already exists
        const { data: existingUsername } = await supabase
          .from('users')
          .select('id')
          .eq('username', trimmedUsername)
          .maybeSingle();
        
        if (existingUsername) {
          throw new Error('Username already exists. Please choose a different username.');
        }
        
        // Check if email already exists  
        const { data: existingEmail } = await supabase
          .from('users')
          .select('id')
          .eq('email', email)
          .maybeSingle();
        
        if (existingEmail) {
          throw new Error('Email already registered. Please use a different email or try logging in.');
        }
        
        // All checks passed - proceed with signup
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              username: trimmedUsername,
            }
          }
        });

        if (error) throw error;

        if (data.user) {
          // Check if user needs email confirmation
          if (!data.session) {
            setSuccess('Registration successful! Please check your email and click the confirmation link, then return here to log in.');
            setLoading(false);
            return;
          }

          // Profile should be auto-created by trigger
          const { data: profile } = await supabase
            .from('users')
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
              // Get Member role for global channel
              const { data: memberRole } = await supabase
                .from('channel_roles')
                .select('id')
                .eq('channel_id', globalChannel.id)
                .eq('name', 'Member')
                .single();

              await supabase
                .from('channel_members')
                .insert({
                  channel_id: globalChannel.id,
                  user_id: data.user.id,
                  username: profile.username,
                  role: 'member',
                  channel_role_id: memberRole?.id,
                  is_subscribed: true,
                  is_active: true,
                  last_activity: new Date().toISOString(),
                  last_seen: new Date().toISOString()
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
      <div className={`${currentTheme.modal} ${currentTheme.border} border p-6 max-w-md w-full mx-4`}>
        <div className={`${currentTheme.text} font-mono text-sm`}>
          <div className="text-center mb-6">
            <div className={`${currentTheme.accent} mb-2`}>
              {showForgotPassword ? '=== RESET PASSWORD ===' : 
               isLogin ? '=== LOGIN TO IRC ===' : '=== REGISTER FOR IRC ==='}
            </div>
            <div className={`text-xs ${currentTheme.muted}`}>
              {showForgotPassword ? 'ENTER YOUR EMAIL TO RESET PASSWORD' :
               isLogin ? 'ENTER YOUR CREDENTIALS' : 'CREATE NEW ACCOUNT'}
            </div>
          </div>

          <form onSubmit={handleAuth} className="space-y-4">
            {!isLogin && !showForgotPassword && (
              <div>
                <label className={`block ${currentTheme.accent} mb-1`}>USERNAME:</label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className={`w-full ${currentTheme.background} border ${currentTheme.border} ${currentTheme.text} p-2 focus:outline-none focus:border-yellow-400`}
                  placeholder="YOUR_HANDLE"
                  maxLength={30}
                  pattern="[a-zA-Z0-9_-]+"
                  required={!isLogin}
                />
                <div className={`text-xs ${currentTheme.muted} mt-1`}>
                  LETTERS, NUMBERS, UNDERSCORE, HYPHEN ONLY
                </div>
              </div>
            )}

            <div>
              <label className={`block ${currentTheme.accent} mb-1`}>EMAIL:</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={`w-full ${currentTheme.background} border ${currentTheme.border} ${currentTheme.text} p-2 focus:outline-none focus:border-yellow-400`}
                placeholder="USER@DOMAIN.COM"
                required
              />
            </div>

            {!showForgotPassword && (
              <div>
                <label className={`block ${currentTheme.accent} mb-1`}>PASSWORD:</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={`w-full ${currentTheme.background} border ${currentTheme.border} ${currentTheme.text} p-2 focus:outline-none focus:border-yellow-400`}
                  placeholder="********"
                  minLength={6}
                  required
                />
              </div>
            )}

            {error && (
              <div className={`${currentTheme.error} text-xs`}>
                *** ERROR: {error.toUpperCase()}
              </div>
            )}

            {success && (
              <div className={`${currentTheme.success} text-xs`}>
                *** SUCCESS: {success.toUpperCase()}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !email.trim() || (!showForgotPassword && (!password.trim() || (!isLogin && !username.trim())))}
              className={`w-full bg-green-400 text-black p-2 ${currentTheme.button} disabled:opacity-50`}
            >
              {loading ? 'PROCESSING...' : 
               showForgotPassword ? 'SEND RESET EMAIL' :
               isLogin ? 'LOGIN' : 'REGISTER'}
            </button>

            <div className="text-center space-y-2">
              {!showForgotPassword && (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      setIsLogin(!isLogin);
                      setError('');
                      setSuccess('');
                      setEmail('');
                      setPassword('');
                      setUsername('');
                    }}
                    className={`${currentTheme.muted} hover:text-green-400 text-xs block w-full`}
                  >
                    {isLogin ? 'NEED AN ACCOUNT? REGISTER' : 'HAVE AN ACCOUNT? LOGIN'}
                  </button>
                  
                  {isLogin && (
                    <button
                      type="button"
                      onClick={() => {
                        setShowForgotPassword(true);
                        setError('');
                        setSuccess('');
                        setPassword('');
                      }}
                      className={`${currentTheme.muted} ${currentTheme.button} text-xs block w-full`}
                    >
                      FORGOT PASSWORD?
                    </button>
                  )}
                </>
              )}
              
              {showForgotPassword && (
                <button
                  type="button"
                  onClick={() => {
                    setShowForgotPassword(false);
                    setError('');
                    setSuccess('');
                    setPassword('');
                  }}
                  className="text-gray-400 hover:text-green-400 text-xs block w-full"
                >
                  BACK TO LOGIN
                </button>
              )}
              
              {onCancel && (
                <button
                  type="button"
                  onClick={onCancel}
                  className={`${currentTheme.error} hover:text-red-300 text-xs block w-full`}
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
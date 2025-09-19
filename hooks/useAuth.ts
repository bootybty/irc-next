import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useNotification } from '@/contexts/NotificationContext';

interface AuthUser {
  id: string;
  username: string;
}

export const useAuth = () => {
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [username, setUsername] = useState('');
  const [userId, setUserId] = useState('');
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [emailConfirmed, setEmailConfirmed] = useState(false);
  const [loading, setLoading] = useState(true);
  const { showNotification } = useNotification();

  useEffect(() => {
    const checkAuth = async () => {
      try {
        // Check for pending notifications from login/logout
        const loginNotification = sessionStorage.getItem('loginNotification');
        const logoutNotification = sessionStorage.getItem('logoutNotification');
        
        if (loginNotification) {
          sessionStorage.removeItem('loginNotification');
          setTimeout(() => showNotification(loginNotification), 500);
        }
        
        if (logoutNotification) {
          sessionStorage.removeItem('logoutNotification');
          setTimeout(() => showNotification(logoutNotification), 500);
        }
        
        // Check if this is an email confirmation callback
        const hashFragment = window.location.hash;
        if (hashFragment && (hashFragment.includes('access_token') || hashFragment.includes('type=signup'))) {
          // This is an email confirmation - log out the user and show confirmation popup
          await supabase.auth.signOut();
          setEmailConfirmed(true);
          // Don't show auth modal immediately - wait for popup to be dismissed
          // Clear the hash to prevent re-processing
          window.history.replaceState(null, '', window.location.pathname);
          setLoading(false);
          return;
        }

        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          const { data: profile } = await supabase
            .from('users')
            .select('*')
            .eq('id', session.user.id)
            .single();
          
          if (profile) {
            setAuthUser({ id: session.user.id, username: profile.username });
            setUsername(profile.username);
            setUserId(session.user.id);
            setShowAuthModal(false);
          }
        }
      } catch (error) {
        console.error('Auth check error:', error);
      } finally {
        setLoading(false);
      }
    };

    checkAuth();

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session?.user) {
        // Fetch user profile when signed in
        supabase
          .from('users')
          .select('*')
          .eq('id', session.user.id)
          .single()
          .then(({ data: profile }) => {
            if (profile) {
              setAuthUser({ id: session.user.id, username: profile.username });
              setUsername(profile.username);
              setUserId(session.user.id);
              setShowAuthModal(false);
              
              // Show login success notification
              showNotification(`SUCCESSFULLY LOGGED IN AS ${profile.username.toUpperCase()}`);
            }
          });
      } else if (event === 'SIGNED_OUT') {
        setAuthUser(null);
        setUsername('');
        setUserId('');
        
        // Store logout notification in sessionStorage to show after refresh
        sessionStorage.setItem('logoutNotification', 'SUCCESSFULLY LOGGED OUT');
        
        // Immediate refresh to clear permissions and admin channels
        window.location.reload();
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [showNotification]);

  const handleAuthSuccess = (user: { id: string; username: string }) => {
    setAuthUser(user);
    setUsername(user.username);
    setUserId(user.id);
    setShowAuthModal(false);
    
    // Store login notification in sessionStorage to show after refresh
    sessionStorage.setItem('loginNotification', `SUCCESSFULLY LOGGED IN AS ${user.username.toUpperCase()}`);
    
    // Immediate refresh to ensure permissions and channels are updated
    window.location.reload();
  };

  const handleLogout = async () => {
    // Store logout notification in sessionStorage to show after refresh
    sessionStorage.setItem('logoutNotification', 'SUCCESSFULLY LOGGED OUT');
    
    await supabase.auth.signOut();
    setAuthUser(null);
    setUsername('');
    setUserId('');
    
    // Immediate refresh to clear permissions and admin channels
    window.location.reload();
  };

  return {
    authUser,
    username,
    userId,
    showAuthModal,
    setShowAuthModal,
    emailConfirmed,
    setEmailConfirmed,
    loading,
    handleAuthSuccess,
    handleLogout
  };
};
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

interface AuthUser {
  id: string;
  username: string;
}

export const useAuth = () => {
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [username, setUsername] = useState('');
  const [userId, setUserId] = useState('');
  const [showAuthModal, setShowAuthModal] = useState(false);

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        const { data: profile } = await supabase
          .from('profiles')
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
    };

    checkAuth();
  }, []);

  const handleAuthSuccess = (user: { id: string; username: string }) => {
    setAuthUser(user);
    setUsername(user.username);
    setUserId(user.id);
    setShowAuthModal(false);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setAuthUser(null);
    setUsername('');
    setUserId('');
    setShowAuthModal(true);
  };

  return {
    authUser,
    username,
    userId,
    showAuthModal,
    setShowAuthModal,
    handleAuthSuccess,
    handleLogout
  };
};
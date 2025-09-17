import { useMemo, useCallback } from 'react';
import { useTheme, themes } from '@/components/ThemeProvider';

interface User {
  id: string;
  username: string;
  currentChannel: string;
  role?: string;
}

interface ChannelMember {
  user_id: string;
  username: string;
  role: string;
  is_active?: boolean;
  is_subscribed?: boolean;
  channel_role?: {
    name: string;
    color: string;
  };
}

export const useUsers = (
  users: User[],
  channelMembers: ChannelMember[]
) => {
  const { theme } = useTheme();
  const currentTheme = themes[theme];
  const getRoleColor = useCallback((member: ChannelMember) => {
    if (member.channel_role) {
      return member.channel_role.color;
    }
    switch (member.role) {
      case 'owner': return currentTheme.roleOwner;
      case 'moderator':
      case 'admin': return currentTheme.roleModerator; 
      default: return currentTheme.roleDefault;
    }
  }, [currentTheme.roleOwner, currentTheme.roleModerator, currentTheme.roleDefault]);

  const getUserListColor = useCallback((member: ChannelMember, isCurrentlyPresent: boolean) => {
    // If member is not currently present in the channel, show gray with opacity
    if (!isCurrentlyPresent) {
      return `${currentTheme.muted} opacity-60`;
    }
    
    // If present, show normal role color
    const roleColor = getRoleColor(member);
    return roleColor;
  }, [getRoleColor, currentTheme.muted]);

  const getUserRoleColor = useCallback((targetUsername: string) => {
    const member = channelMembers.find(m => m.username.toLowerCase() === targetUsername.toLowerCase());
    if (member) {
      return getRoleColor(member);
    }
    
    if (channelMembers.length === 0) {
      return currentTheme.muted;
    }
    
    const userColors = theme === 'light' 
      ? ['text-yellow-600', 'text-cyan-700', 'text-purple-700', 'text-red-600', 'text-orange-600', 'text-blue-600']
      : ['text-yellow-400', 'text-cyan-400', 'text-purple-400', 'text-red-400', 'text-green-300', 'text-blue-400'];
    const colorIndex = targetUsername.charCodeAt(0) % userColors.length;
    return userColors[colorIndex];
  }, [channelMembers, currentTheme.muted, getRoleColor, theme]);

  const displayUsers = useMemo(() => {
    console.log('🔍 DisplayUsers Debug:');
    console.log('👥 Present users from presence:', users.map(u => ({ id: u.id, username: u.username })));
    
    // Get all subscribed members
    const subscribedMembers = channelMembers.filter(m => m.is_subscribed);
    console.log('📋 Subscribed members:', subscribedMembers.map(m => ({ id: m.user_id, username: m.username })));
    
    // Create user objects for all subscribed members
    const allSubscribedUsers = subscribedMembers.map(member => {
      // Check if this user is currently present (in the 'users' array from presence)
      const isCurrentlyPresent = users.some(u => u.id === member.user_id);
      const color = getUserListColor(member, isCurrentlyPresent);
      
      console.log(`👤 ${member.username}: present=${isCurrentlyPresent}, color=${color}`);
      
      return {
        id: member.user_id,
        username: member.username,
        currentChannel: '',
        role: member.role,
        roleColor: color,
        isActive: isCurrentlyPresent // Simple: present = active
      };
    });
    
    // Sort by presence (present first), then by username
    return allSubscribedUsers.sort((a, b) => {
      // Present users first
      if (a.isActive && !b.isActive) return -1;
      if (!a.isActive && b.isActive) return 1;
      
      // Then by username
      return a.username.localeCompare(b.username);
    });
  }, [users, channelMembers, getUserListColor, currentTheme.muted]);

  return {
    displayUsers,
    getUserRoleColor,
    getRoleColor,
    getUserListColor
  };
};
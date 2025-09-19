import { useMemo, useCallback, useState } from 'react';
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
  const [displayedUserCount, setDisplayedUserCount] = useState(75);
  const getRoleColor = useCallback((member: ChannelMember) => {
    if (member.channel_role) {
      // Map custom role colors to theme properties
      const colorMap: {[key: string]: string} = {
        'text-blue-500': currentTheme.roleBlue,
        'text-purple-500': currentTheme.rolePurple,
        'text-teal-500': currentTheme.roleTeal,
        'text-emerald-500': currentTheme.roleGreen,
        'text-pink-500': currentTheme.rolePink,
        'text-indigo-500': currentTheme.roleIndigo,
        'text-orange-500': currentTheme.roleOrange,
      };
      return colorMap[member.channel_role.color] || member.channel_role.color;
    }
    switch (member.role) {
      case 'owner': return currentTheme.roleOwner;
      case 'moderator':
      case 'admin': return currentTheme.roleModerator; 
      default: return currentTheme.roleDefault;
    }
  }, [currentTheme.roleOwner, currentTheme.roleModerator, currentTheme.roleDefault, currentTheme.roleBlue, currentTheme.rolePurple, currentTheme.roleTeal, currentTheme.roleGreen, currentTheme.rolePink, currentTheme.roleIndigo, currentTheme.roleOrange]);

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
    
    // If user not found in members, default to member role color
    return currentTheme.roleDefault;
  }, [channelMembers, getRoleColor, currentTheme.roleDefault]);

  const allUsers = useMemo(() => {
    // Get all subscribed members
    const subscribedMembers = channelMembers.filter(m => m.is_subscribed);
    
    // Create user objects for all subscribed members
    const allSubscribedUsers = subscribedMembers.map(member => {
      // Check if this user is currently present (in the 'users' array from presence)
      const isCurrentlyPresent = users.some(u => u.id === member.user_id);
      
      return {
        id: member.user_id,
        username: member.username,
        currentChannel: '',
        role: member.role,
        roleColor: getUserListColor(member, isCurrentlyPresent),
        isActive: isCurrentlyPresent // Simple: present = active
      };
    });
    
    // Sort by: 1) Role, 2) Active status, 3) Username
    return allSubscribedUsers.sort((a, b) => {
      // 1. Sort by role hierarchy (owner > moderator > member)
      const getRolePriority = (role: string) => {
        switch (role.toLowerCase()) {
          case 'owner': return 3;
          case 'moderator':
          case 'admin': return 2;
          case 'member':
          default: return 1;
        }
      };
      
      const aRolePriority = getRolePriority(a.role);
      const bRolePriority = getRolePriority(b.role);
      
      if (aRolePriority !== bRolePriority) {
        return bRolePriority - aRolePriority; // Higher priority first
      }
      
      // 2. Within same role, sort by active status (active first)
      if (a.isActive && !b.isActive) return -1;
      if (!a.isActive && b.isActive) return 1;
      
      // 3. Within same role and status, sort alphabetically
      return a.username.localeCompare(b.username);
    });
  }, [users, channelMembers, getUserListColor]);

  const displayUsers = useMemo(() => {
    return allUsers.slice(0, displayedUserCount);
  }, [allUsers, displayedUserCount]);

  const loadMoreUsers = useCallback(() => {
    setDisplayedUserCount(prev => Math.min(prev + 50, allUsers.length));
  }, [allUsers.length]);

  const hasMoreUsers = displayedUserCount < allUsers.length;

  return {
    displayUsers,
    allUsers,
    loadMoreUsers,
    hasMoreUsers,
    totalUserCount: allUsers.length,
    displayedUserCount,
    getUserRoleColor,
    getRoleColor,
    getUserListColor
  };
};
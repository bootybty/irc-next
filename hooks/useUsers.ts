import { useMemo } from 'react';
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
  channel_role?: {
    name: string;
    color: string;
  };
}

export const useUsers = (
  users: User[],
  channelMembers: ChannelMember[],
  _username: string
) => {
  const { theme } = useTheme();
  const currentTheme = themes[theme];
  const getUserRoleColor = (targetUsername: string) => {
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
  };

  const getRoleColor = (member: ChannelMember) => {
    if (member.channel_role) {
      return member.channel_role.color;
    }
    switch (member.role) {
      case 'owner': return currentTheme.roleOwner;
      case 'moderator':
      case 'admin': return currentTheme.roleModerator; 
      default: return currentTheme.roleDefault;
    }
  };

  const displayUsers = useMemo(() => {
    return users.map(user => {
      const member = channelMembers.find(m => m.user_id === user.id);
      return {
        ...user,
        roleColor: member ? getRoleColor(member) : currentTheme.roleDefault
      };
    });
  }, [users, channelMembers, currentTheme.roleDefault, getRoleColor]);

  return {
    displayUsers,
    getUserRoleColor,
    getRoleColor
  };
};
import { useMemo } from 'react';

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
  username: string
) => {
  const getUserRoleColor = (targetUsername: string) => {
    const member = channelMembers.find(m => m.username.toLowerCase() === targetUsername.toLowerCase());
    if (member) {
      return getRoleColor(member);
    }
    
    if (channelMembers.length === 0) {
      return 'text-gray-400';
    }
    
    const userColors = ['text-yellow-400', 'text-cyan-400', 'text-purple-400', 'text-red-400', 'text-green-300', 'text-blue-400'];
    const colorIndex = targetUsername.charCodeAt(0) % userColors.length;
    return userColors[colorIndex];
  };

  const getRoleColor = (member: ChannelMember) => {
    if (member.channel_role) {
      return member.channel_role.color;
    }
    switch (member.role) {
      case 'owner': return 'text-red-400';
      case 'moderator':
      case 'admin': return 'text-yellow-400'; 
      default: return 'text-green-400';
    }
  };

  const displayUsers = useMemo(() => {
    return users.map(user => {
      const member = channelMembers.find(m => m.user_id === user.id);
      return {
        ...user,
        roleColor: member ? getRoleColor(member) : 'text-green-400'
      };
    });
  }, [users, channelMembers]);

  return {
    displayUsers,
    getUserRoleColor,
    getRoleColor
  };
};
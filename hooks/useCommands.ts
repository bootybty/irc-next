import { useState } from 'react';
import { supabase } from '@/lib/supabase';

interface CommandSuggestion {
  command: string;
  description: string;
  requiresRole?: string;
  requiresPermission?: string;
}

export const useCommands = (
  currentChannel: string,
  userId: string,
  username: string,
  authUser: any,
  userRole: string,
  userPermissions: Record<string, boolean>,
  channelMembers: any[],
  channelRoles: any[],
  setMessages: (setter: (prev: any[]) => any[]) => void,
  setLocalMessages: (setter: (prev: any[]) => any[]) => void,
  setCurrentTopic: (topic: string) => void,
  fetchChannelMembers: (channelId: string) => void,
  channel: any
) => {
  const [showCommandSuggestions, setShowCommandSuggestions] = useState(false);
  const [commandSuggestions, setCommandSuggestions] = useState<CommandSuggestion[]>([]);
  const [selectedSuggestion, setSelectedSuggestion] = useState(0);
  const [pendingDeleteChannel, setPendingDeleteChannel] = useState<{id: string, name: string, requestedBy: string} | null>(null);

  const handleModerationCommand = async (command: string, args: string[]) => {
    if (!authUser || !userId) return false;

    const canModerate = userRole === 'owner' || userRole === 'moderator' || userRole === 'admin';

    if (!canModerate) {
      const errorMsg = {
        id: `error_${Date.now()}`,
        username: 'SYSTEM',
        content: `Access denied. You need owner or moderator privileges to use /${command}`,
        timestamp: new Date(),
        channel: currentChannel
      };
      setMessages(prev => [...prev, errorMsg]);
      return true;
    }

    const targetUsername = args[0];
    if (!targetUsername) {
      const errorMsg = {
        id: `error_${Date.now()}`,
        username: 'SYSTEM',
        content: `Usage: /${command} <username> [reason]`,
        timestamp: new Date(),
        channel: currentChannel
      };
      setMessages(prev => [...prev, errorMsg]);
      return true;
    }

    const targetMember = channelMembers.find(m => m.username.toLowerCase() === targetUsername.toLowerCase());
    if (!targetMember) {
      const errorMsg = {
        id: `error_${Date.now()}`,
        username: 'SYSTEM',
        content: `User '${targetUsername}' not found in channel`,
        timestamp: new Date(),
        channel: currentChannel
      };
      setMessages(prev => [...prev, errorMsg]);
      return true;
    }

    if (targetMember.role === 'owner' && userRole !== 'owner') {
      const errorMsg = {
        id: `error_${Date.now()}`,
        username: 'SYSTEM',
        content: `Cannot moderate channel owner`,
        timestamp: new Date(),
        channel: currentChannel
      };
      setMessages(prev => [...prev, errorMsg]);
      return true;
    }

    const reason = args.slice(1).join(' ') || 'No reason provided';

    try {
      switch (command) {
        case 'kick':
          await supabase
            .from('channel_members')
            .delete()
            .eq('channel_id', currentChannel)
            .eq('user_id', targetMember.user_id);

          const kickMsg = {
            id: `kick_${Date.now()}`,
            username: 'SYSTEM',
            content: `${targetUsername} was kicked by ${username}. Reason: ${reason}`,
            timestamp: new Date(),
            channel: currentChannel
          };
          setMessages(prev => [...prev, kickMsg]);
          break;

        case 'ban':
          await supabase
            .from('channel_bans')
            .insert({
              channel_id: currentChannel,
              user_id: targetMember.user_id,
              banned_by: userId,
              reason: reason
            });

          await supabase
            .from('channel_members')
            .delete()
            .eq('channel_id', currentChannel)
            .eq('user_id', targetMember.user_id);

          const banMsg = {
            id: `ban_${Date.now()}`,
            username: 'SYSTEM',
            content: `${targetUsername} was banned by ${username}. Reason: ${reason}`,
            timestamp: new Date(),
            channel: currentChannel
          };
          setMessages(prev => [...prev, banMsg]);
          break;

        case 'mod':
          if (userRole !== 'owner') {
            const errorMsg = {
              id: `error_${Date.now()}`,
              username: 'SYSTEM',
              content: `Only channel owner can promote moderators`,
              timestamp: new Date(),
              channel: currentChannel
            };
            setMessages(prev => [...prev, errorMsg]);
            return true;
          }

          await supabase
            .from('channel_members')
            .update({ role: 'moderator' })
            .eq('channel_id', currentChannel)
            .eq('user_id', targetMember.user_id);

          const modMsg = {
            id: `mod_${Date.now()}`,
            username: 'SYSTEM',
            content: `${targetUsername} was promoted to moderator by ${username}`,
            timestamp: new Date(),
            channel: currentChannel
          };
          setMessages(prev => [...prev, modMsg]);
          break;

        case 'unmod':
          if (userRole !== 'owner') {
            const errorMsg = {
              id: `error_${Date.now()}`,
              username: 'SYSTEM',
              content: `Only channel owner can demote moderators`,
              timestamp: new Date(),
              channel: currentChannel
            };
            setMessages(prev => [...prev, errorMsg]);
            return true;
          }

          await supabase
            .from('channel_members')
            .update({ role: 'member' })
            .eq('channel_id', currentChannel)
            .eq('user_id', targetMember.user_id);

          const unmodMsg = {
            id: `unmod_${Date.now()}`,
            username: 'SYSTEM',
            content: `${targetUsername} was demoted to member by ${username}`,
            timestamp: new Date(),
            channel: currentChannel
          };
          setMessages(prev => [...prev, unmodMsg]);
          break;
      }

      await fetchChannelMembers(currentChannel);
      
      if (channel) {
        await channel.send({
          type: 'broadcast',
          event: 'moderation',
          payload: { command, target: targetUsername, moderator: username, reason }
        });
      }

    } catch (error) {
      console.error('Moderation error:', error);
      const errorMsg = {
        id: `error_${Date.now()}`,
        username: 'SYSTEM',
        content: `Error executing /${command}: ${error}`,
        timestamp: new Date(),
        channel: currentChannel
      };
      setMessages(prev => [...prev, errorMsg]);
    }

    return true;
  };

  const performChannelDeletion = async (channelToDelete: {id: string, name: string}) => {
    if (!authUser || !userId) return;

    try {
      const { error: messagesError } = await supabase
        .from('messages')
        .delete()
        .eq('channel_id', channelToDelete.id);

      if (messagesError) throw messagesError;

      const { error: membersError } = await supabase
        .from('channel_members')
        .delete()
        .eq('channel_id', channelToDelete.id);

      if (membersError) throw membersError;

      const { error: rolesError } = await supabase
        .from('channel_roles')
        .delete()
        .eq('channel_id', channelToDelete.id);

      if (rolesError) throw rolesError;

      const { error: bansError } = await supabase
        .from('channel_bans')
        .delete()
        .eq('channel_id', channelToDelete.id);

      if (bansError) throw bansError;

      const { error: channelError } = await supabase
        .from('channels')
        .delete()
        .eq('id', channelToDelete.id);

      if (channelError) throw channelError;

      const successMsg = {
        id: `delete_success_${Date.now()}`,
        username: 'SYSTEM',
        content: `Channel #${channelToDelete.name.toUpperCase()} has been permanently deleted.`,
        timestamp: new Date(),
        channel: 'system'
      };
      setMessages(prev => [...prev, successMsg]);
      
      setLocalMessages(() => []);

    } catch (error) {
      console.error('Error deleting channel:', error);
      const errorMsg = {
        id: `delete_error_${Date.now()}`,
        username: 'SYSTEM',
        content: `Failed to delete channel: ${error instanceof Error ? error.message : 'Unknown error'}`,
        timestamp: new Date(),
        channel: currentChannel
      };
      setMessages(prev => [...prev, errorMsg]);
    }
  };

  const handleCommand = async (command: string, args: string[]) => {
    const moderationCommands = ['kick', 'ban', 'mod', 'unmod'];
    
    if (moderationCommands.includes(command)) {
      return await handleModerationCommand(command, args);
    }

    if (command === 'help') {
      const helpMsg = {
        id: `help_${Date.now()}`,
        username: 'SYSTEM',
        content: 'Available commands: /kick <user> [reason], /ban <user> [reason], /mod <user>, /unmod <user>, /topic <message>, /motd <message>, /delete, /info',
        timestamp: new Date(),
        channel: currentChannel
      };
      setMessages(prev => [...prev, helpMsg]);
      return true;
    }

    if (command === 'info') {
      const owner = channelMembers.find(m => m.role === 'owner');
      const moderators = channelMembers.filter(m => m.role === 'moderator' || m.role === 'admin');
      
      const infoMsg = {
        id: `info_${Date.now()}`,
        username: 'SYSTEM',
        content: `Channel info - Owner: ${owner ? owner.username.toUpperCase() : 'None'}${moderators.length > 0 ? ` | Moderators: ${moderators.map(m => m.username.toUpperCase()).join(', ')}` : ''} | Members: ${channelMembers.length}`,
        timestamp: new Date(),
        channel: currentChannel
      };
      setMessages(prev => [...prev, infoMsg]);
      return true;
    }

    if (command === 'topic') {
      const canSetTopic = userRole === 'owner' || userRole === 'moderator' || userRole === 'admin' || userRole === 'Owner' || userRole === 'Moderator' || userRole === 'Admin';
      if (!canSetTopic) {
        const errorMsg = {
          id: `error_${Date.now()}`,
          username: 'SYSTEM',
          content: 'Access denied. You need owner or moderator privileges to set topic.',
          timestamp: new Date(),
          channel: currentChannel
        };
        setMessages(prev => [...prev, errorMsg]);
        return true;
      }

      const newTopic = args.join(' ');
      
      if (!newTopic) {
        const errorMsg = {
          id: `error_${Date.now()}`,
          username: 'SYSTEM',
          content: 'Usage: /topic <message> - Example: /topic This channel is for discussing coding topics',
          timestamp: new Date(),
          channel: currentChannel
        };
        setMessages(prev => [...prev, errorMsg]);
        return true;
      }

      try {
        const { error } = await supabase
          .from('channels')
          .update({ topic: newTopic })
          .eq('id', currentChannel);

        if (error) {
          const errorMsg = {
            id: `error_${Date.now()}`,
            username: 'SYSTEM',
            content: `Failed to set topic: ${error.message}`,
            timestamp: new Date(),
            channel: currentChannel
          };
          setMessages(prev => [...prev, errorMsg]);
        } else {
          setCurrentTopic(newTopic);
          
          const successMsg = {
            id: `success_${Date.now()}`,
            username: 'SYSTEM',
            content: `Topic updated by ${username}: ${newTopic}`,
            timestamp: new Date(),
            channel: currentChannel
          };
          setMessages(prev => [...prev, successMsg]);
        }
      } catch (error) {
        const errorMsg = {
          id: `error_${Date.now()}`,
          username: 'SYSTEM',
          content: `Error setting topic: ${error instanceof Error ? error.message : 'Unknown error'}`,
          timestamp: new Date(),
          channel: currentChannel
        };
        setMessages(prev => [...prev, errorMsg]);
      }

      return true;
    }

    return false;
  };

  const getAvailableCommands = () => {
    const allCommands = [
      { command: 'help', description: 'Show available commands' },
      { command: 'info', description: 'Show channel information' },
      { command: 'topic <message>', description: 'Set channel topic', requiresRole: 'Moderator+' },
      { command: 'motd <message>', description: 'Set channel Message of the Day', requiresRole: 'Owner' },
      { command: 'roles', description: 'List all channel roles', requiresRole: 'Owner' },
      { command: 'kick <user> [reason]', description: 'Remove user from channel', requiresPermission: 'can_kick' },
      { command: 'ban <user> [reason]', description: 'Ban user from channel', requiresPermission: 'can_ban' },
      { command: 'setrole <user> <role>', description: 'Assign role to user', requiresPermission: 'can_manage_roles' },
      { command: 'createrole <name> [color]', description: 'Create new custom role', requiresRole: 'Owner' },
      { command: 'delete', description: 'Delete current channel (PERMANENT)', requiresRole: 'Owner' },
    ];

    return allCommands.filter(cmd => {
      if (!cmd.requiresRole && !cmd.requiresPermission) return true;
      
      if (cmd.requiresRole) {
        if (cmd.requiresRole === 'Moderator+') {
          return userRole === 'owner' || userRole === 'moderator' || userRole === 'admin' || userRole === 'Owner' || userRole === 'Moderator' || userRole === 'Admin';
        }
        return userRole === cmd.requiresRole;
      }
      
      if (cmd.requiresPermission) {
        return userPermissions[cmd.requiresPermission] === true;
      }
      
      return false;
    });
  };

  const updateCommandSuggestions = (input: string) => {
    if (!input.startsWith('/')) {
      setShowCommandSuggestions(false);
      return;
    }

    const commandPart = input.slice(1);
    const parts = commandPart.split(' ');
    const command = parts[0].toLowerCase();
    const availableCommands = getAvailableCommands();

    if (command === 'createrole' && parts.length === 3) {
      const colorInput = parts[2].toLowerCase();
      const colorOptions = [
        { command: 'red', description: '🔴 Red color for the role' },
        { command: 'orange', description: '🟠 Orange color for the role' },
        { command: 'yellow', description: '🟡 Yellow color for the role' },
        { command: 'green', description: '🟢 Green color for the role' },
        { command: 'blue', description: '🔵 Blue color for the role' },
        { command: 'purple', description: '🟣 Purple color for the role' },
        { command: 'pink', description: '🩷 Pink color for the role' },
        { command: 'cyan', description: '🔷 Cyan color for the role' },
        { command: 'gray', description: '⚪ Gray color for the role' },
        { command: 'emerald', description: '💚 Emerald color for the role' },
        { command: 'indigo', description: '🟦 Indigo color for the role' },
        { command: 'teal', description: '🔸 Teal color for the role' }
      ];

      const filteredColors = colorOptions.filter(color => 
        color.command.toLowerCase().startsWith(colorInput)
      );

      setCommandSuggestions(filteredColors);
      setShowCommandSuggestions(filteredColors.length > 0);
      setSelectedSuggestion(0);
      return;
    }
    
    if (commandPart === '' || parts.length === 1) {
      if (commandPart === '') {
        setCommandSuggestions(availableCommands);
        setShowCommandSuggestions(true);
        setSelectedSuggestion(0);
      } else {
        const filtered = availableCommands.filter(cmd => 
          cmd.command.toLowerCase().startsWith(command)
        );
        setCommandSuggestions(filtered);
        setShowCommandSuggestions(filtered.length > 0);
        setSelectedSuggestion(0);
      }
    } else {
      setShowCommandSuggestions(false);
    }
  };

  return {
    showCommandSuggestions,
    setShowCommandSuggestions,
    commandSuggestions,
    selectedSuggestion,
    setSelectedSuggestion,
    pendingDeleteChannel,
    setPendingDeleteChannel,
    handleCommand,
    updateCommandSuggestions,
    performChannelDeletion
  };
};
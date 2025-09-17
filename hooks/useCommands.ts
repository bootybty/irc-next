import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { RealtimeChannel } from '@supabase/supabase-js';
import type { AuthUser, ChannelMember, ChannelRole, MessageSetter } from '@/types';

interface CommandSuggestion {
  command: string;
  description: string;
  requiresRole?: string;
  requiresPermission?: string;
}

interface PendingDelete {
  channelId: string;
  channelName: string;
  requestedBy: string;
  requestedAt: Date;
}

export const useCommands = (
  currentChannel: string,
  userId: string,
  username: string,
  authUser: AuthUser | null,
  userRole: string,
  userPermissions: Record<string, boolean>,
  channelMembers: ChannelMember[],
  channelRoles: ChannelRole[],
  setMessages: MessageSetter,
  setLocalMessages: MessageSetter,
  setCurrentTopic: (topic: string) => void,
  fetchChannelMembers: (channelId: string) => void,
  channel: RealtimeChannel | null
) => {
  const [showCommandSuggestions, setShowCommandSuggestions] = useState(false);
  const [commandSuggestions, setCommandSuggestions] = useState<CommandSuggestion[]>([]);
  const [selectedSuggestion, setSelectedSuggestion] = useState(0);
  const [pendingDeleteChannel, setPendingDeleteChannel] = useState<PendingDelete | null>(null);

  const handleModerationCommand = async (command: string, args: string[]) => {
    if (!authUser || !userId) return false;

    // Check both legacy roles and permission-based system  
    const canModerate = userRole === 'owner' || userRole === 'moderator' || userRole === 'admin' || 
                       userRole === 'Owner' || userRole === 'Moderator' || userRole === 'Admin' ||
                       userPermissions.can_ban;

    if (!canModerate) {
      // Debug info
      // console.log('Permission denied:', { userRole, userPermissions, command });
      const errorMsg = {
        id: `error_${Date.now()}`,
        username: 'SYSTEM',
        content: `Access denied. You need owner or moderator privileges to use /${command}. Your role: ${userRole}`,
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
        case 'ban':
          // console.log('Starting ban process for:', targetUsername);
          
          try {
            const response = await fetch('/api/ban', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                channelId: currentChannel,
                targetUserId: targetMember.user_id,
                bannedBy: userId,
                reason: reason,
                targetUsername: targetUsername,
                bannerUsername: username
              }),
            });

            if (!response.ok) {
              const errorData = await response.json();
              throw new Error(errorData.error || 'Ban failed');
            }

            await response.json();
            // console.log('Ban successful:', result);

            // Refresh channel members to remove banned user from UI
            fetchChannelMembers(currentChannel);
            
            // console.log('Ban process completed for:', targetUsername);
          } catch (error) {
            // console.error('Ban API error:', error);
            const errorMsg = {
              id: `error_${Date.now()}`,
              username: 'SYSTEM',
              content: `Failed to ban ${targetUsername}: ${error instanceof Error ? error.message : 'Unknown error'}`,
              timestamp: new Date(),
              channel: currentChannel
            };
            setMessages(prev => [...prev, errorMsg]);
          }
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
      // console.error('Moderation error:', error);
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

  const performChannelDeletion = async (channelToDelete: PendingDelete) => {
    if (!authUser || !userId) return;

    try {
      const { error: messagesError } = await supabase
        .from('messages')
        .delete()
        .eq('channel_id', channelToDelete.channelId);

      if (messagesError) throw messagesError;

      const { error: membersError } = await supabase
        .from('channel_members')
        .delete()
        .eq('channel_id', channelToDelete.channelId);

      if (membersError) throw membersError;

      const { error: rolesError } = await supabase
        .from('channel_roles')
        .delete()
        .eq('channel_id', channelToDelete.channelId);

      if (rolesError) throw rolesError;

      const { error: bansError } = await supabase
        .from('channel_bans')
        .delete()
        .eq('channel_id', channelToDelete.channelId);

      if (bansError) throw bansError;

      const { error: channelError } = await supabase
        .from('channels')
        .delete()
        .eq('id', channelToDelete.channelId);

      if (channelError) throw channelError;

      const successMsg = {
        id: `delete_success_${Date.now()}`,
        username: 'SYSTEM',
        content: `Channel #${channelToDelete.channelName.toUpperCase()} has been permanently deleted.`,
        timestamp: new Date(),
        channel: 'system'
      };
      setMessages(prev => [...prev, successMsg]);
      
      setLocalMessages(() => []);

    } catch (error) {
      // console.error('Error deleting channel:', error);
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
    const moderationCommands = ['ban', 'mod', 'unmod'];
    
    if (moderationCommands.includes(command)) {
      return await handleModerationCommand(command, args);
    }

    if (command === 'help') {
      const helpMsg = {
        id: `help_${Date.now()}`,
        username: 'SYSTEM',
        content: 'Available commands: /ban <user> [reason], /mod <user>, /unmod <user>, /topic <message>, /motd <message>, /delete, /info, /roles, /setrole, /createrole',
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

    if (command === 'roles') {
      const canManageRoles = userRole === 'owner' || userRole === 'Owner';
      if (!canManageRoles) {
        const errorMsg = {
          id: `error_${Date.now()}`,
          username: 'SYSTEM',
          content: 'Access denied. You need owner privileges to view roles.',
          timestamp: new Date(),
          channel: currentChannel
        };
        setMessages(prev => [...prev, errorMsg]);
        return true;
      }

      try {
        // Show built-in roles
        const builtInRoles = ['owner', 'moderator', 'member'];
        
        // Filter out custom roles that duplicate built-in roles
        const customRoles = channelRoles
          .map(role => role.name)
          .filter(roleName => 
            !builtInRoles.includes(roleName.toLowerCase())
          );
        
        const allRoles = [...builtInRoles, ...customRoles];
        const rolesMsg = {
          id: `roles_${Date.now()}`,
          username: 'SYSTEM',
          content: `Channel roles: ${allRoles.join(', ')}${customRoles.length > 0 ? ` (${customRoles.length} custom)` : ''}`,
          timestamp: new Date(),
          channel: currentChannel
        };
        setMessages(prev => [...prev, rolesMsg]);
      } catch (error) {
        const errorMsg = {
          id: `error_${Date.now()}`,
          username: 'SYSTEM',
          content: `Error fetching roles: ${error instanceof Error ? error.message : 'Unknown error'}`,
          timestamp: new Date(),
          channel: currentChannel
        };
        setMessages(prev => [...prev, errorMsg]);
      }
      
      return true;
    }

    if (command === 'motd') {
      const canSetMotd = userRole === 'owner' || userRole === 'Owner';
      if (!canSetMotd) {
        const errorMsg = {
          id: `error_${Date.now()}`,
          username: 'SYSTEM',
          content: 'Access denied. You need owner privileges to set MOTD.',
          timestamp: new Date(),
          channel: currentChannel
        };
        setMessages(prev => [...prev, errorMsg]);
        return true;
      }

      const newMotd = args.join(' ');
      if (!newMotd) {
        const errorMsg = {
          id: `error_${Date.now()}`,
          username: 'SYSTEM',
          content: 'Usage: /motd <message> - Example: /motd Welcome to the channel!',
          timestamp: new Date(),
          channel: currentChannel
        };
        setMessages(prev => [...prev, errorMsg]);
        return true;
      }

      try {
        const { error } = await supabase
          .from('channels')
          .update({ motd: newMotd })
          .eq('id', currentChannel);

        if (error) {
          const errorMsg = {
            id: `error_${Date.now()}`,
            username: 'SYSTEM',
            content: `Failed to set MOTD: ${error.message}`,
            timestamp: new Date(),
            channel: currentChannel
          };
          setMessages(prev => [...prev, errorMsg]);
        } else {
          const successMsg = {
            id: `success_${Date.now()}`,
            username: 'SYSTEM',
            content: `MOTD updated by ${username}: ${newMotd}`,
            timestamp: new Date(),
            channel: currentChannel
          };
          setMessages(prev => [...prev, successMsg]);
        }
      } catch (error) {
        const errorMsg = {
          id: `error_${Date.now()}`,
          username: 'SYSTEM',
          content: `Error setting MOTD: ${error instanceof Error ? error.message : 'Unknown error'}`,
          timestamp: new Date(),
          channel: currentChannel
        };
        setMessages(prev => [...prev, errorMsg]);
      }
      
      return true;
    }

    if (command === 'createrole') {
      const canCreateRole = userRole === 'owner' || userRole === 'Owner';
      if (!canCreateRole) {
        const errorMsg = {
          id: `error_${Date.now()}`,
          username: 'SYSTEM',
          content: 'Access denied. You need owner privileges to create roles.',
          timestamp: new Date(),
          channel: currentChannel
        };
        setMessages(prev => [...prev, errorMsg]);
        return true;
      }

      const roleName = args[0];
      const roleColor = args[1] || 'purple';

      if (!roleName) {
        const errorMsg = {
          id: `error_${Date.now()}`,
          username: 'SYSTEM',
          content: 'Usage: /createrole <name> [color] - Example: /createrole VIP purple',
          timestamp: new Date(),
          channel: currentChannel
        };
        setMessages(prev => [...prev, errorMsg]);
        return true;
      }

      // Color mapping
      const colorMap: { [key: string]: string } = {
        red: 'text-red-400',
        orange: 'text-orange-400',
        yellow: 'text-yellow-400',
        green: 'text-green-400',
        blue: 'text-blue-400',
        purple: 'text-purple-400',
        pink: 'text-pink-400',
        cyan: 'text-cyan-400',
        gray: 'text-gray-400',
        emerald: 'text-emerald-400',
        indigo: 'text-indigo-400',
        teal: 'text-teal-400'
      };

      const finalColor = colorMap[roleColor.toLowerCase()] || 'text-purple-400';

      try {
        const { error: rolesError } = await supabase
          .from('channel_roles')
          .insert({
            channel_id: currentChannel,
            name: roleName,
            color: finalColor
          });

        if (rolesError) {
          const errorMsg = {
            id: `error_${Date.now()}`,
            username: 'SYSTEM',
            content: `Failed to create role: ${rolesError.message}`,
            timestamp: new Date(),
            channel: currentChannel
          };
          setMessages(prev => [...prev, errorMsg]);
        } else {
          const successMsg = {
            id: `success_${Date.now()}`,
            username: 'SYSTEM',
            content: `Role '${roleName}' created successfully with color ${roleColor}`,
            timestamp: new Date(),
            channel: currentChannel
          };
          setMessages(prev => [...prev, successMsg]);
        }
      } catch (error) {
        const errorMsg = {
          id: `error_${Date.now()}`,
          username: 'SYSTEM',
          content: `Error creating role: ${error instanceof Error ? error.message : 'Unknown error'}`,
          timestamp: new Date(),
          channel: currentChannel
        };
        setMessages(prev => [...prev, errorMsg]);
      }
      
      return true;
    }

    if (command === 'setrole') {
      const canManageRoles = userPermissions.can_manage_roles || userRole === 'owner' || userRole === 'Owner';
      if (!canManageRoles) {
        const errorMsg = {
          id: `error_${Date.now()}`,
          username: 'SYSTEM',
          content: 'Access denied. You need role management privileges.',
          timestamp: new Date(),
          channel: currentChannel
        };
        setMessages(prev => [...prev, errorMsg]);
        return true;
      }

      const targetUsername = args[0];
      const newRole = args[1];

      if (!targetUsername || !newRole) {
        const errorMsg = {
          id: `error_${Date.now()}`,
          username: 'SYSTEM',
          content: 'Usage: /setrole <user> <role> - Example: /setrole alice moderator',
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

      try {
        // Check if it's a built-in role or custom role
        const builtInRoles = ['owner', 'moderator', 'member'];
        const customRole = channelRoles.find(r => r.name.toLowerCase() === newRole.toLowerCase());

        if (builtInRoles.includes(newRole.toLowerCase())) {
          // Update built-in role
          const { error } = await supabase
            .from('channel_members')
            .update({ role: newRole.toLowerCase() })
            .eq('channel_id', currentChannel)
            .eq('user_id', targetMember.user_id);

          if (error) throw error;
        } else if (customRole) {
          // Assign custom role
          const { error } = await supabase
            .from('channel_members')
            .update({ 
              role: 'member', // Keep base role as member
              channel_role_id: customRole.id 
            })
            .eq('channel_id', currentChannel)
            .eq('user_id', targetMember.user_id);

          if (error) throw error;
        } else {
          const errorMsg = {
            id: `error_${Date.now()}`,
            username: 'SYSTEM',
            content: `Role '${newRole}' does not exist. Use /roles to see available roles.`,
            timestamp: new Date(),
            channel: currentChannel
          };
          setMessages(prev => [...prev, errorMsg]);
          return true;
        }

        const successMsg = {
          id: `success_${Date.now()}`,
          username: 'SYSTEM',
          content: `${targetUsername} has been assigned the role '${newRole}' by ${username}`,
          timestamp: new Date(),
          channel: currentChannel
        };
        setMessages(prev => [...prev, successMsg]);

        // Refresh channel members
        fetchChannelMembers(currentChannel);

      } catch (error) {
        const errorMsg = {
          id: `error_${Date.now()}`,
          username: 'SYSTEM',
          content: `Error setting role: ${error instanceof Error ? error.message : 'Unknown error'}`,
          timestamp: new Date(),
          channel: currentChannel
        };
        setMessages(prev => [...prev, errorMsg]);
      }
      
      return true;
    }

    if (command === 'delete') {
      const canDelete = userRole === 'owner' || userRole === 'Owner';
      if (!canDelete) {
        const errorMsg = {
          id: `error_${Date.now()}`,
          username: 'SYSTEM',
          content: 'Access denied. You need owner privileges to delete the channel.',
          timestamp: new Date(),
          channel: currentChannel
        };
        setMessages(prev => [...prev, errorMsg]);
        return true;
      }

      // Set up confirmation flow
      const confirmMsg = {
        id: `delete_confirm_${Date.now()}`,
        username: 'SYSTEM',
        content: `⚠️ WARNING: You are about to PERMANENTLY DELETE this channel. All messages and data will be lost. Type 'y' to confirm or 'n' to cancel.`,
        timestamp: new Date(),
        channel: currentChannel
      };
      setLocalMessages(prev => [...prev, confirmMsg]);
      
      // Get channel name for confirmation
      const channelName = 'current';
      setPendingDeleteChannel({
        channelId: currentChannel,
        channelName: channelName,
        requestedBy: userId,
        requestedAt: new Date()
      });
      
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
    
    if (commandPart === '') {
      // Show all commands when just typing "/"
      setCommandSuggestions(availableCommands);
      setShowCommandSuggestions(true);
      setSelectedSuggestion(0);
    } else if (parts.length === 1) {
      // Show filtered commands when typing command name
      const filtered = availableCommands.filter(cmd => 
        cmd.command.toLowerCase().startsWith(command)
      );
      setCommandSuggestions(filtered);
      setShowCommandSuggestions(filtered.length > 0);
      setSelectedSuggestion(0);
    } else {
      // Handle user autocomplete for commands that take usernames
      const userCommands = ['ban', 'setrole', 'mod', 'unmod'];
      
      if (userCommands.includes(command) && parts.length === 2) {
        // Show user suggestions for the first argument
        const userInput = parts[1].toLowerCase();
        const userSuggestions = channelMembers
          .filter(member => member.username.toLowerCase().startsWith(userInput))
          .map(member => {
            // Get the correct role color and display name
            const displayRole = member.role || 'member';
            return {
              command: member.username,
              description: `${member.username} (${displayRole})`
            };
          });
        
        if (userSuggestions.length > 0) {
          setCommandSuggestions(userSuggestions);
          setShowCommandSuggestions(true);
          setSelectedSuggestion(0);
          return;
        }
      }
      
      // For commands with optional reason/additional args, show help but don't allow selection
      if (['ban'].includes(command) && parts.length >= 3) {
        const matchingCommand = availableCommands.find(cmd => 
          cmd.command.split(' ')[0].toLowerCase() === command
        );
        
        if (matchingCommand) {
          setCommandSuggestions([{
            command: '__help_only__', // Special marker to prevent selection
            description: `${matchingCommand.description} - Type reason after username`
          }]);
          setShowCommandSuggestions(true);
          setSelectedSuggestion(0);
          return;
        }
      }
      
      // Handle role autocomplete for setrole command
      if (command === 'setrole' && parts.length === 3) {
        const roleInput = parts[2].toLowerCase();
        const builtInRoles = ['owner', 'moderator', 'member'];
        const customRoles = channelRoles.map(role => role.name);
        const allRoles = [...builtInRoles, ...customRoles];
        
        const roleSuggestions = allRoles
          .filter(role => role.toLowerCase().startsWith(roleInput))
          .map(role => ({
            command: role,
            description: `Role: ${role}`
          }));
        
        if (roleSuggestions.length > 0) {
          setCommandSuggestions(roleSuggestions);
          setShowCommandSuggestions(true);
          setSelectedSuggestion(0);
          return;
        }
      }
      
      // Show matching command with description when typing arguments
      const matchingCommand = availableCommands.find(cmd => 
        cmd.command.split(' ')[0].toLowerCase() === command
      );
      
      if (matchingCommand) {
        setCommandSuggestions([matchingCommand]);
        setShowCommandSuggestions(true);
        setSelectedSuggestion(0);
      } else {
        setShowCommandSuggestions(false);
      }
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
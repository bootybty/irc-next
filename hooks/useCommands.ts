import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { RealtimeChannel } from '@supabase/supabase-js';
import type { AuthUser, ChannelMember, ChannelRole, MessageSetter } from '@/types';
import { 
  checkAdminPrivileges, 
  siteBanUser, 
  siteUnbanUser, 
  lookupUser, 
  promoteUser, 
  demoteUser,
  getAdminStats,
  getUserByUsername,
  getAdminChannelId
} from '@/lib/admin';

interface CommandSuggestion {
  command: string;
  description: string;
  requiresRole?: string;
  requiresPermission?: string;
  isUser?: boolean;
  isRole?: boolean;
  isColor?: boolean;
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
  setCurrentMotd: (motd: string) => void,
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

            // Refresh channel members to remove banned user from UI
            fetchChannelMembers(currentChannel);
            
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
    // Debug logging for commands (commented out)
    // console.log('🎯 Command execution:', { command, args });

    const moderationCommands = ['ban', 'mod', 'unmod'];
    
    if (moderationCommands.includes(command)) {
      return await handleModerationCommand(command, args);
    }

    if (command === 'help') {
      const helpMsg = {
        id: `help_${Date.now()}`,
        username: 'SYSTEM',
        content: 'Available commands: /ban <user> [reason], /mod <user>, /unmod <user>, /topic <message>, /motd <message>, /delete, /info, /roles, /setrole, /createrole, /deleterole',
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
          content: `Roles in this channel: ${allRoles.join(', ')}${customRoles.length > 0 ? ` (${customRoles.length} custom)` : ''}`,
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
          setCurrentMotd(newMotd);
          
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
          content: 'Usage: /createrole <name> [color] - Available colors: purple, teal, green, pink, indigo, orange, blue',
          timestamp: new Date(),
          channel: currentChannel
        };
        setMessages(prev => [...prev, errorMsg]);
        return true;
      }

      // Color mapping - Only custom role colors (excluding reserved: red, amber, slate)
      const colorMap: { [key: string]: string } = {
        purple: 'text-purple-500',     // VIP
        teal: 'text-teal-500',         // Helper
        green: 'text-emerald-500',     // Expert
        pink: 'text-pink-500',         // Supporter
        indigo: 'text-indigo-500',     // Veteran
        orange: 'text-orange-500',     // Contributor
        blue: 'text-blue-500'          // Trusted
      };

      // Check if color is valid
      if (!colorMap[roleColor.toLowerCase()]) {
        // Get available colors (not used in this channel)
        const usedColors = new Set([
          'text-red-500',      // Owner (system role)
          'text-amber-500',    // Moderator (system role)  
          'text-slate-500',    // Member (system role)
          ...channelRoles.map(role => role.color) // Custom roles
        ]);
        
        const allColors = ['purple', 'teal', 'green', 'pink', 'indigo', 'orange', 'blue'];
        const availableColors = allColors.filter(color => {
          const colorValue = colorMap[color];
          return colorValue && !usedColors.has(colorValue);
        });

        const errorMsg = {
          id: `error_${Date.now()}`,
          username: 'SYSTEM',
          content: `Invalid color '${roleColor}'. Available colors: ${availableColors.length > 0 ? availableColors.join(', ') : 'none (all colors are used)'}`,
          timestamp: new Date(),
          channel: currentChannel
        };
        setMessages(prev => [...prev, errorMsg]);
        return true;
      }

      const finalColor = colorMap[roleColor.toLowerCase()];

      // Check if role name is reserved (system roles)
      const reservedRoles = ['owner', 'moderator', 'member'];
      if (reservedRoles.includes(roleName.toLowerCase())) {
        const errorMsg = {
          id: `error_${Date.now()}`,
          username: 'SYSTEM',
          content: `Role name '${roleName}' is reserved for system roles. Please choose a different name.`,
          timestamp: new Date(),
          channel: currentChannel
        };
        setMessages(prev => [...prev, errorMsg]);
        return true;
      }

      // Check if role name already exists in this channel (custom roles)
      const roleExists = channelRoles.some(role => 
        role.name.toLowerCase() === roleName.toLowerCase()
      );
      
      if (roleExists) {
        const errorMsg = {
          id: `error_${Date.now()}`,
          username: 'SYSTEM',
          content: `Role name '${roleName}' already exists in this channel. Please choose a different name.`,
          timestamp: new Date(),
          channel: currentChannel
        };
        setMessages(prev => [...prev, errorMsg]);
        return true;
      }

      // Check if color is already used in this channel
      const usedColors = new Set([
        'text-red-500',      // Owner (system role)
        'text-amber-500',    // Moderator (system role)  
        'text-slate-500',    // Member (system role)
        ...channelRoles.map(role => role.color) // Custom roles
      ]);

      if (usedColors.has(finalColor)) {
        const errorMsg = {
          id: `error_${Date.now()}`,
          username: 'SYSTEM',
          content: `Color '${roleColor}' is already used by another role in this channel. Please choose a different color.`,
          timestamp: new Date(),
          channel: currentChannel
        };
        setMessages(prev => [...prev, errorMsg]);
        return true;
      }

      try {
        const { error: rolesError } = await supabase
          .from('channel_roles')
          .insert({
            channel_id: currentChannel,
            name: roleName,
            color: finalColor,
            created_by: userId
          });

        if (rolesError) {
          let errorMessage = `Failed to create role: ${rolesError.message}`;
          
          // Handle specific error cases with user-friendly messages
          if (rolesError.message?.includes('duplicate key value violates unique constraint') && 
              rolesError.message?.includes('channel_roles_channel_id_name_key')) {
            errorMessage = `Role name '${roleName}' already exists in this channel. Please choose a different name.`;
          }
          
          const errorMsg = {
            id: `error_${Date.now()}`,
            username: 'SYSTEM',
            content: errorMessage,
            timestamp: new Date(),
            channel: currentChannel
          };
          setMessages(prev => [...prev, errorMsg]);
        } else {
          // Refresh channel roles to update state
          fetchChannelMembers(currentChannel);
          
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

    if (command === 'deleterole') {
      const canDeleteRole = userRole === 'owner' || userRole === 'Owner';
      if (!canDeleteRole) {
        const errorMsg = {
          id: `error_${Date.now()}`,
          username: 'SYSTEM',
          content: 'Access denied. You need owner privileges to delete roles.',
          timestamp: new Date(),
          channel: currentChannel
        };
        setMessages(prev => [...prev, errorMsg]);
        return true;
      }

      const roleName = args[0];

      if (!roleName) {
        const errorMsg = {
          id: `error_${Date.now()}`,
          username: 'SYSTEM',
          content: 'Usage: /deleterole <name> - Example: /deleterole VIP',
          timestamp: new Date(),
          channel: currentChannel
        };
        setMessages(prev => [...prev, errorMsg]);
        return true;
      }

      // Check if role is a reserved system role
      const reservedRoles = ['owner', 'moderator', 'member'];
      if (reservedRoles.includes(roleName.toLowerCase())) {
        const errorMsg = {
          id: `error_${Date.now()}`,
          username: 'SYSTEM',
          content: `Cannot delete system role '${roleName}'. Only custom roles can be deleted.`,
          timestamp: new Date(),
          channel: currentChannel
        };
        setMessages(prev => [...prev, errorMsg]);
        return true;
      }

      // Find the role to delete
      const roleToDelete = channelRoles.find(role => 
        role.name.toLowerCase() === roleName.toLowerCase()
      );
      
      if (!roleToDelete) {
        const customRoles = channelRoles.filter(role => 
          !['owner', 'moderator', 'member'].includes(role.name.toLowerCase())
        );
        
        const errorMsg = {
          id: `error_${Date.now()}`,
          username: 'SYSTEM',
          content: `Role '${roleName}' not found. ${customRoles.length > 0 ? `Available custom roles: ${customRoles.map(r => r.name).join(', ')}` : 'No custom roles available. Create one with /createrole first.'}`,
          timestamp: new Date(),
          channel: currentChannel
        };
        setMessages(prev => [...prev, errorMsg]);
        return true;
      }

      try {
        // First, check if channel_role_id column exists, if not skip member updates
        let membersWithRole = [];
        let updateSuccessful = false;
        try {
          // Try to find members with this role using the join approach
          const { data: membersData } = await supabase
            .from('channel_members')
            .select(`
              *,
              channel_role:channel_roles(*)
            `)
            .eq('channel_id', currentChannel);
          
          if (membersData) {
            membersWithRole = membersData.filter(member => 
              member.channel_role && member.channel_role.id === roleToDelete.id
            );
          }
        } catch {
        }

        // Update members with this role back to default member role
        if (membersWithRole.length > 0) {
          
          // Try the direct column approach if it exists
          try {
            const { error: membersUpdateError } = await supabase
              .from('channel_members')
              .update({ 
                channel_role_id: null,
                role: 'member'
              })
              .eq('channel_id', currentChannel)
              .eq('channel_role_id', roleToDelete.id);

            if (membersUpdateError) {
              // If direct approach fails, update each member individually
              for (const member of membersWithRole) {
                await supabase
                  .from('channel_members')
                  .update({ role: 'member' })
                  .eq('channel_id', currentChannel)
                  .eq('user_id', member.user_id);
              }
              updateSuccessful = true;
            } else {
              updateSuccessful = true;
            }
          } catch {
            // Update each member individually without using channel_role_id
            for (const member of membersWithRole) {
              await supabase
                .from('channel_members')
                .update({ role: 'member' })
                .eq('channel_id', currentChannel)
                .eq('user_id', member.user_id);
            }
            updateSuccessful = true;
          }
        }

        // Then delete the role
        const { error: roleDeleteError } = await supabase
          .from('channel_roles')
          .delete()
          .eq('id', roleToDelete.id)
          .eq('channel_id', currentChannel);

        if (roleDeleteError) {
          throw roleDeleteError;
        }

        // Refresh channel data to update state
        await fetchChannelMembers(currentChannel);
        
        const successMsg = {
          id: `success_${Date.now()}`,
          username: 'SYSTEM',
          content: `Role '${roleName}' has been deleted from this channel.${membersWithRole.length > 0 && updateSuccessful ? ` ${membersWithRole.length} member(s) with this role have been reverted to member status.` : membersWithRole.length > 0 ? ' Note: Some members may still show the old role until they reconnect.' : ''}`,
          timestamp: new Date(),
          channel: currentChannel
        };
        setMessages(prev => [...prev, successMsg]);

      } catch (error) {
        const errorMsg = {
          id: `error_${Date.now()}`,
          username: 'SYSTEM',
          content: `Error deleting role: ${error instanceof Error ? error.message : JSON.stringify(error)}`,
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

    // Admin commands - only work in #admin channel
    const adminChannelId = await getAdminChannelId();
    if (currentChannel === adminChannelId) {
      // Check if user is admin
      const adminPrivileges = await checkAdminPrivileges(userId);
      const isSiteOwner = adminPrivileges.is_super_admin;
      const isAdmin = isSiteOwner || adminPrivileges.is_site_admin;
      const isModerator = isAdmin || adminPrivileges.is_site_moderator;

      // Site-wide ban command
      if (command === 'siteban') {
        if (!isModerator) {
          const errorMsg = {
            id: `error_${Date.now()}`,
            username: 'SYSTEM',
            content: 'Access denied. You need site moderator or admin privileges.',
            timestamp: new Date(),
            channel: currentChannel
          };
          setMessages(prev => [...prev, errorMsg]);
          return true;
        }

        const targetUsername = args[0];
        const reason = args.slice(1).join(' ') || 'No reason provided';

        if (!targetUsername) {
          const errorMsg = {
            id: `error_${Date.now()}`,
            username: 'SYSTEM',
            content: 'Usage: /siteban <username> [reason]',
            timestamp: new Date(),
            channel: currentChannel
          };
          setMessages(prev => [...prev, errorMsg]);
          return true;
        }

        // Get target user ID
        const { data: targetUser } = await supabase
          .from('users')
          .select('id, username')
          .eq('username', targetUsername)
          .single();

        if (!targetUser) {
          const errorMsg = {
            id: `error_${Date.now()}`,
            username: 'SYSTEM',
            content: `User '${targetUsername}' not found`,
            timestamp: new Date(),
            channel: currentChannel
          };
          setMessages(prev => [...prev, errorMsg]);
          return true;
        }

        const result = await siteBanUser(targetUser.id, userId, reason);
        
        const msg = {
          id: `admin_${Date.now()}`,
          username: 'SYSTEM',
          content: result.success 
            ? `✅ User ${targetUsername} has been banned from the site. Reason: ${reason}`
            : `❌ Failed to ban user: ${result.error}`,
          timestamp: new Date(),
          channel: currentChannel
        };
        setMessages(prev => [...prev, msg]);
        return true;
      }

      // Site-wide unban
      if (command === 'siteunban') {
        if (!isModerator) {
          const errorMsg = {
            id: `error_${Date.now()}`,
            username: 'SYSTEM',
            content: 'Access denied. You need site moderator or admin privileges.',
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
            content: 'Usage: /siteunban <username>',
            timestamp: new Date(),
            channel: currentChannel
          };
          setMessages(prev => [...prev, errorMsg]);
          return true;
        }

        // Get target user ID
        const { data: targetUser } = await supabase
          .from('users')
          .select('id, username')
          .eq('username', targetUsername)
          .single();

        if (!targetUser) {
          const errorMsg = {
            id: `error_${Date.now()}`,
            username: 'SYSTEM',
            content: `User '${targetUsername}' not found`,
            timestamp: new Date(),
            channel: currentChannel
          };
          setMessages(prev => [...prev, errorMsg]);
          return true;
        }

        const result = await siteUnbanUser(targetUser.id, userId);
        
        const msg = {
          id: `admin_${Date.now()}`,
          username: 'SYSTEM',
          content: result.success 
            ? `✅ User ${targetUsername} has been unbanned`
            : `❌ Failed to unban user: ${result.error}`,
          timestamp: new Date(),
          channel: currentChannel
        };
        setMessages(prev => [...prev, msg]);
        return true;
      }

      // Lookup user
      if (command === 'lookup') {
        if (!isModerator) {
          const errorMsg = {
            id: `error_${Date.now()}`,
            username: 'SYSTEM',
            content: 'Access denied. You need site moderator or admin privileges.',
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
            content: 'Usage: /lookup <username>',
            timestamp: new Date(),
            channel: currentChannel
          };
          setMessages(prev => [...prev, errorMsg]);
          return true;
        }

        const userData = await lookupUser(targetUsername);
        
        if (!userData) {
          const errorMsg = {
            id: `error_${Date.now()}`,
            username: 'SYSTEM',
            content: `User '${targetUsername}' not found`,
            timestamp: new Date(),
            channel: currentChannel
          };
          setMessages(prev => [...prev, errorMsg]);
          return true;
        }

        const { user, messageCount, recentMessageCount, channels, ban, reports } = userData;
        
        let content = `📊 User Lookup: ${user.username}\n`;
        content += `Created: ${new Date(user.created_at).toLocaleDateString()}\n`;
        content += `Channels: ${channels.join(', ') || 'None'}\n`;
        content += `Messages: ${messageCount} total (${recentMessageCount} in last 24h)\n`;
        
        if (ban) {
          content += `🚫 BANNED: ${ban.reason} (by ${ban.banned_by} on ${new Date(ban.banned_at).toLocaleDateString()})`;
        }
        
        if (reports && reports.length > 0) {
          content += `\n⚠️ Reports: ${reports.length} pending`;
        }

        const msg = {
          id: `lookup_${Date.now()}`,
          username: 'SYSTEM',
          content,
          timestamp: new Date(),
          channel: currentChannel
        };
        setMessages(prev => [...prev, msg]);
        return true;
      }

      // Promote to site admin - Only Site Owner can do this
      if (command === 'siteadmin') {
        if (!isSiteOwner) {
          const errorMsg = {
            id: `error_${Date.now()}`,
            username: 'SYSTEM',
            content: 'Access denied. Only the Site Owner can promote Site Admins.',
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
            content: 'Usage: /siteadmin <username>',
            timestamp: new Date(),
            channel: currentChannel
          };
          setMessages(prev => [...prev, errorMsg]);
          return true;
        }

        // Get target user ID
        const { data: targetUser } = await supabase
          .from('users')
          .select('id, username')
          .eq('username', targetUsername)
          .single();

        if (!targetUser) {
          const errorMsg = {
            id: `error_${Date.now()}`,
            username: 'SYSTEM',
            content: `User '${targetUsername}' not found`,
            timestamp: new Date(),
            channel: currentChannel
          };
          setMessages(prev => [...prev, errorMsg]);
          return true;
        }

        const result = await promoteUser(targetUser.id, 'admin', userId);
        
        const msg = {
          id: `admin_${Date.now()}`,
          username: 'SYSTEM',
          content: result.success 
            ? `✅ ${targetUsername} is now a site admin`
            : `❌ Failed to promote user: ${result.error}`,
          timestamp: new Date(),
          channel: currentChannel
        };
        setMessages(prev => [...prev, msg]);
        return true;
      }

      // Promote to site moderator - Site Owner or Site Admin can do this
      if (command === 'sitemoderator') {
        if (!isAdmin) {
          const errorMsg = {
            id: `error_${Date.now()}`,
            username: 'SYSTEM',
            content: 'Access denied. Only Site Owner or Site Admins can promote Site Moderators.',
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
            content: 'Usage: /sitemoderator <username>',
            timestamp: new Date(),
            channel: currentChannel
          };
          setMessages(prev => [...prev, errorMsg]);
          return true;
        }

        // Get target user ID
        const { data: targetUser } = await supabase
          .from('users')
          .select('id, username')
          .eq('username', targetUsername)
          .single();

        if (!targetUser) {
          const errorMsg = {
            id: `error_${Date.now()}`,
            username: 'SYSTEM',
            content: `User '${targetUsername}' not found`,
            timestamp: new Date(),
            channel: currentChannel
          };
          setMessages(prev => [...prev, errorMsg]);
          return true;
        }

        const result = await promoteUser(targetUser.id, 'moderator', userId);
        
        const msg = {
          id: `admin_${Date.now()}`,
          username: 'SYSTEM',
          content: result.success 
            ? `✅ ${targetUsername} is now a site moderator`
            : `❌ Failed to promote user: ${result.error}`,
          timestamp: new Date(),
          channel: currentChannel
        };
        setMessages(prev => [...prev, msg]);
        return true;
      }

      // Get admin stats
      if (command === 'stats') {
        if (!isModerator) {
          const errorMsg = {
            id: `error_${Date.now()}`,
            username: 'SYSTEM',
            content: 'Access denied. You need site moderator or admin privileges.',
            timestamp: new Date(),
            channel: currentChannel
          };
          setMessages(prev => [...prev, errorMsg]);
          return true;
        }

        const stats = await getAdminStats();
        
        const msg = {
          id: `stats_${Date.now()}`,
          username: 'SYSTEM',
          content: `📊 Site Statistics:\n` +
                  `Users: ${stats.totalUsers} (${stats.newUsersToday} new today)\n` +
                  `Messages today: ${stats.messagesToday}\n` +
                  `Channels: ${stats.totalChannels}\n` +
                  `Active bans: ${stats.activeBans}\n` +
                  `Pending reports: ${stats.pendingReports}`,
          timestamp: new Date(),
          channel: currentChannel
        };
        setMessages(prev => [...prev, msg]);
        return true;
      }

      // Reports command
      if (command === 'reports') {
        if (!isModerator) {
          const errorMsg = {
            id: `error_${Date.now()}`,
            username: 'SYSTEM',
            content: 'Access denied. You need site moderator or admin privileges.',
            timestamp: new Date(),
            channel: currentChannel
          };
          setMessages(prev => [...prev, errorMsg]);
          return true;
        }

        const { data: reports } = await supabase
          .from('admin_reports')
          .select(`
            *,
            reported_user:users!admin_reports_reported_user_id_fkey(username),
            reporter:users!admin_reports_reported_by_id_fkey(username)
          `)
          .eq('status', 'pending')
          .order('created_at', { ascending: false })
          .limit(5);

        if (!reports || reports.length === 0) {
          const msg = {
            id: `reports_${Date.now()}`,
            username: 'SYSTEM',
            content: '✅ No pending reports',
            timestamp: new Date(),
            channel: currentChannel
          };
          setMessages(prev => [...prev, msg]);
          return true;
        }

        let content = `⚠️ Pending Reports (${reports.length}):\n`;
        reports.forEach((report: Record<string, unknown>, index: number) => {
          const reportedUser = report.reported_user as { username?: string } | undefined;
          const reporter = report.reporter as { username?: string } | undefined;
          content += `${index + 1}. ${reportedUser?.username || 'Unknown'} - "${report.reason}" (by ${reporter?.username || 'Unknown'})\n`;
        });

        const msg = {
          id: `reports_${Date.now()}`,
          username: 'SYSTEM',
          content,
          timestamp: new Date(),
          channel: currentChannel
        };
        setMessages(prev => [...prev, msg]);
        return true;
      }

      // Demote Site Admin - Only Site Owner can do this
      if (command === 'demoteadmin') {
        if (!isSiteOwner) {
          const errorMsg = {
            id: `error_${Date.now()}`,
            username: 'SYSTEM',
            content: 'Access denied. Only the Site Owner can demote Site Admins.',
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
            content: 'Usage: /demoteadmin <username>',
            timestamp: new Date(),
            channel: currentChannel
          };
          setMessages(prev => [...prev, errorMsg]);
          return true;
        }

        const targetUser = await getUserByUsername(targetUsername);

        if (!targetUser) {
          const errorMsg = {
            id: `error_${Date.now()}`,
            username: 'SYSTEM',
            content: `User '${targetUsername}' not found`,
            timestamp: new Date(),
            channel: currentChannel
          };
          setMessages(prev => [...prev, errorMsg]);
          return true;
        }

        if (!targetUser.is_site_admin) {
          const errorMsg = {
            id: `error_${Date.now()}`,
            username: 'SYSTEM',
            content: `${targetUsername} is not a Site Admin`,
            timestamp: new Date(),
            channel: currentChannel
          };
          setMessages(prev => [...prev, errorMsg]);
          return true;
        }

        const result = await demoteUser(targetUser.id, 'admin', userId);
        
        const msg = {
          id: `admin_${Date.now()}`,
          username: 'SYSTEM',
          content: result.success 
            ? `✅ ${targetUsername} is no longer a Site Admin`
            : `❌ Failed to demote user: ${result.error}`,
          timestamp: new Date(),
          channel: currentChannel
        };
        setMessages(prev => [...prev, msg]);
        return true;
      }

      // Demote Site Moderator - Site Owner or Site Admin can do this
      if (command === 'demotemoderator') {
        if (!isAdmin) {
          const errorMsg = {
            id: `error_${Date.now()}`,
            username: 'SYSTEM',
            content: 'Access denied. Only Site Owner or Site Admins can demote Site Moderators.',
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
            content: 'Usage: /demotemoderator <username>',
            timestamp: new Date(),
            channel: currentChannel
          };
          setMessages(prev => [...prev, errorMsg]);
          return true;
        }

        const targetUser = await getUserByUsername(targetUsername);

        if (!targetUser) {
          const errorMsg = {
            id: `error_${Date.now()}`,
            username: 'SYSTEM',
            content: `User '${targetUsername}' not found`,
            timestamp: new Date(),
            channel: currentChannel
          };
          setMessages(prev => [...prev, errorMsg]);
          return true;
        }

        if (!targetUser.is_site_moderator || targetUser.is_site_admin) {
          const errorMsg = {
            id: `error_${Date.now()}`,
            username: 'SYSTEM',
            content: `${targetUsername} is not a Site Moderator (or is a higher rank)`,
            timestamp: new Date(),
            channel: currentChannel
          };
          setMessages(prev => [...prev, errorMsg]);
          return true;
        }

        const result = await demoteUser(targetUser.id, 'moderator', userId);
        
        const msg = {
          id: `admin_${Date.now()}`,
          username: 'SYSTEM',
          content: result.success 
            ? `✅ ${targetUsername} is no longer a Site Moderator`
            : `❌ Failed to demote user: ${result.error}`,
          timestamp: new Date(),
          channel: currentChannel
        };
        setMessages(prev => [...prev, msg]);
        return true;
      }
    }

    return false;
  };

  const getAvailableCommands = async () => {
    // Check admin privileges first for use in filtering
    let isSiteOwner = false;
    let isAdmin = false;
    let isModerator = false;
    
    // Check if we're in admin channel
    const adminChannelId = await getAdminChannelId();
    if (currentChannel === adminChannelId) {
      const adminPrivileges = await checkAdminPrivileges(userId);
      isSiteOwner = adminPrivileges.is_super_admin;
      isAdmin = isSiteOwner || adminPrivileges.is_site_admin;
      isModerator = isAdmin || adminPrivileges.is_site_moderator;
    }

    const allCommands = [
      { command: 'help', description: 'Show available commands' },
      { command: 'info', description: 'Show channel information' },
      { command: 'topic <message>', description: 'Set channel topic', requiresRole: 'Moderator+' },
      { command: 'motd <message>', description: 'Set channel Message of the Day', requiresRole: 'Owner' },
      { command: 'roles', description: 'List all channel roles', requiresRole: 'Owner' },
      { command: 'ban <user> [reason]', description: 'Ban user from channel', requiresPermission: 'can_ban' },
      { command: 'setrole <user> <role>', description: 'Assign role to user', requiresPermission: 'can_manage_roles' },
      { command: 'createrole <name> [color]', description: 'Create new custom role', requiresRole: 'Owner' },
      { command: 'deleterole <name>', description: 'Delete custom role', requiresRole: 'Owner' },
      { command: 'delete', description: 'Delete current channel (PERMANENT)', requiresRole: 'Owner' },
    ];

    // Add admin commands if in admin channel
    if (currentChannel === adminChannelId) {

      if (isModerator) {
        allCommands.push(
          { command: 'siteban <user> [reason]', description: 'Ban user from entire site', requiresRole: 'SiteModerator' },
          { command: 'siteunban <user>', description: 'Unban user from site', requiresRole: 'SiteModerator' },
          { command: 'lookup <user>', description: 'Get detailed user information', requiresRole: 'SiteModerator' },
          { command: 'stats', description: 'View site statistics', requiresRole: 'SiteModerator' },
          { command: 'reports', description: 'View pending user reports', requiresRole: 'SiteModerator' }
        );
      }

      if (isAdmin) {
        allCommands.push(
          { command: 'sitemoderator <user>', description: 'Promote user to Site Moderator', requiresRole: 'SiteAdmin' },
          { command: 'demotemoderator <user>', description: 'Demote Site Moderator to regular user', requiresRole: 'SiteAdmin' }
        );
      }

      if (isSiteOwner) {
        allCommands.push(
          { command: 'siteadmin <user>', description: 'Promote user to Site Admin', requiresRole: 'SiteOwner' },
          { command: 'demoteadmin <user>', description: 'Demote Site Admin to regular user', requiresRole: 'SiteOwner' }
        );
      }
    }

    return allCommands.filter(cmd => {
      if (!cmd.requiresRole && !cmd.requiresPermission) return true;
      
      if (cmd.requiresRole) {
        // Admin channel role checks
        if (currentChannel === adminChannelId) {
          if (cmd.requiresRole === 'SiteOwner') {
            return isSiteOwner;
          }
          if (cmd.requiresRole === 'SiteAdmin') {
            return isAdmin;
          }
          if (cmd.requiresRole === 'SiteModerator') {
            return isModerator;
          }
        }
        
        // Regular channel role checks
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

  const updateCommandSuggestions = async (input: string) => {
    // Debug logging (commented out to reduce noise)
    // if (input.startsWith('/') && currentChannel === 'admin') {
    //   console.log('🔍 Autocompletion debug:', { input, currentChannel, userId });
    // }
    
    // Handle @ mentions
    const atIndex = input.lastIndexOf('@');
    if (atIndex >= 0) {
      const afterAt = input.substring(atIndex + 1);
      
      // Only show suggestions if we're currently typing after @
      if (!afterAt.includes(' ')) {
        const userInput = afterAt.toLowerCase();
        const userSuggestions = channelMembers
          .filter(member => member.username.toLowerCase().startsWith(userInput))
          .map(member => {
            const displayRole = member.role || 'member';
            return {
              command: member.username,
              description: `@${member.username} (${displayRole})`,
              isUser: true
            };
          });
        
        if (userSuggestions.length > 0) {
          setCommandSuggestions(userSuggestions);
          setShowCommandSuggestions(true);
          setSelectedSuggestion(0);
          return;
        }
      }
    }
    
    if (!input.startsWith('/')) {
      setShowCommandSuggestions(false);
      return;
    }

    const commandPart = input.slice(1);
    const parts = commandPart.split(' ');
    const command = parts[0].toLowerCase();
    const availableCommands = await getAvailableCommands();
    

    if (command === 'createrole' && parts.length === 3) {
      const colorInput = parts[2].toLowerCase();
      
      // Get all colors already used in this channel (including system roles)
      const usedColors = new Set([
        'text-red-500',      // Owner (system role)
        'text-amber-500',    // Moderator (system role)  
        'text-slate-500',    // Member (system role)
        ...channelRoles.map(role => role.color) // Custom roles
      ]);
      
      const allColorOptions = [
        { command: 'purple', color: 'text-purple-500', description: 'Purple color for the role', isColor: true },
        { command: 'teal', color: 'text-teal-500', description: 'Teal color for the role', isColor: true },
        { command: 'green', color: 'text-emerald-500', description: 'Green color for the role', isColor: true },
        { command: 'pink', color: 'text-pink-500', description: 'Pink color for the role', isColor: true },
        { command: 'indigo', color: 'text-indigo-500', description: 'Indigo color for the role', isColor: true },
        { command: 'orange', color: 'text-orange-500', description: 'Orange color for the role', isColor: true },
        { command: 'blue', color: 'text-blue-500', description: 'Blue color for the role', isColor: true }
      ];

      // Filter out colors that are already used and match input
      const availableColors = allColorOptions.filter(color => 
        !usedColors.has(color.color) && color.command.toLowerCase().startsWith(colorInput)
      );

      const filteredColors = availableColors;

      setCommandSuggestions(filteredColors);
      setShowCommandSuggestions(filteredColors.length > 0);
      setSelectedSuggestion(0);
      return;
    }

    // Handle role suggestions for deleterole command
    if (command === 'deleterole' && parts.length === 2) {
      const roleInput = parts[1].toLowerCase();
      // Only show custom roles (not system roles)
      const reservedRoles = ['owner', 'moderator', 'member'];
      const customRoles = channelRoles
        .filter(role => !reservedRoles.includes(role.name.toLowerCase()))
        .map(role => role.name);
      
      const roleSuggestions = customRoles
        .filter(role => role.toLowerCase().startsWith(roleInput))
        .map(role => ({
          command: role,
          description: `Delete custom role: ${role}`,
          isRole: true
        }));
      
      if (roleSuggestions.length > 0) {
        setCommandSuggestions(roleSuggestions);
        setShowCommandSuggestions(true);
        setSelectedSuggestion(0);
        return;
      }
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
      const channelUserCommands = ['ban', 'setrole', 'mod', 'unmod'];
      const adminUserCommands = ['siteban', 'siteunban', 'lookup', 'siteadmin', 'sitemoderator', 'demoteadmin', 'demotemoderator'];
      
      // Channel-specific user commands
      if (channelUserCommands.includes(command) && parts.length === 2) {
        // Show user suggestions for the first argument from current channel
        const userInput = parts[1].toLowerCase();
        const userSuggestions = channelMembers
          .filter(member => member.username.toLowerCase().startsWith(userInput))
          .map(member => {
            // Get the correct role color and display name
            const displayRole = member.role || 'member';
            return {
              command: member.username,
              description: `${member.username} (${displayRole})`,
              isUser: true
            };
          });
        
        if (userSuggestions.length > 0) {
          setCommandSuggestions(userSuggestions);
          setShowCommandSuggestions(true);
          setSelectedSuggestion(0);
          return;
        }
      }

      // Admin user commands - fetch all users from database  
      if (adminUserCommands.includes(command) && parts.length === 2) {
        // Check if we're in admin channel
        const adminChannelId = await getAdminChannelId();
        if (currentChannel === adminChannelId) {
        const userInput = parts[1].toLowerCase();
        
        // Fetch users from database for admin commands
        try {
          const { data: allUsers } = await supabase
            .from('users')
            .select('username, is_super_admin, is_site_admin, is_site_moderator')
            .order('username');

          if (allUsers) {
            const userSuggestions = allUsers
              .filter(user => user.username.toLowerCase().startsWith(userInput))
              .map(user => {
                let roleDisplay = 'User';
                if (user.is_super_admin) roleDisplay = 'Site Owner';
                else if (user.is_site_admin) roleDisplay = 'Site Admin';
                else if (user.is_site_moderator) roleDisplay = 'Site Moderator';
                
                return {
                  command: user.username,
                  description: `${user.username} (${roleDisplay})`,
                  isUser: true
                };
              });

            if (userSuggestions.length > 0) {
              setCommandSuggestions(userSuggestions);
              setShowCommandSuggestions(true);
              setSelectedSuggestion(0);
              return;
            }
          }
        } catch {
        }
        }
      }
      
      // For commands with optional reason/additional args, show help but don't allow selection
      const commandsWithReasons = ['ban', 'siteban'];
      if (commandsWithReasons.includes(command) && parts.length >= 3) {
        const matchingCommand = availableCommands.find(cmd => 
          cmd.command.split(' ')[0].toLowerCase() === command
        );
        
        if (matchingCommand) {
          const helpText = command === 'siteban' 
            ? `${matchingCommand.description} - Type ban reason after username`
            : `${matchingCommand.description} - Type reason after username`;
            
          setCommandSuggestions([{
            command: '__help_only__', // Special marker to prevent selection
            description: helpText
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
            description: `Role: ${role}`,
            isRole: true
          }));
        
        if (roleSuggestions.length > 0) {
          setCommandSuggestions(roleSuggestions);
          setShowCommandSuggestions(true);
          setSelectedSuggestion(0);
          return;
        }
      }
      
      // For commands that take free text (topic, motd), don't show suggestions when typing arguments
      const freeTextCommands = ['topic', 'motd'];
      if (freeTextCommands.includes(command) && parts.length >= 2) {
        setShowCommandSuggestions(false);
        return;
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
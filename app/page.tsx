'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { RealtimeChannel } from '@supabase/supabase-js';
import AuthModal from '@/components/AuthModal';
import CreateCategoryModal from '@/components/CreateCategoryModal';
import CreateChannelModal from '@/components/CreateChannelModal';
import type { ChannelCategory, ChannelMember, ChannelRole } from '@/lib/supabase';

interface User {
  id: string;
  username: string;
  currentServer: string;
  currentChannel: string;
  role?: string;
}

interface Message {
  id: string;
  username: string;
  content: string;
  timestamp: Date;
  server: string;
  channel: string;
}

interface Server {
  id: string;
  name: string;
  categories: ChannelCategory[];
}

interface Channel {
  id: string;
  name: string;
}

export default function Home() {
  const [channel, setChannel] = useState<RealtimeChannel | null>(null);
  const [connected, setConnected] = useState(false);
  const [username, setUsername] = useState('');
  const [userId, setUserId] = useState('');
  const [currentServer, setCurrentServer] = useState('11111111-1111-1111-1111-111111111111');
  const [currentChannel, setCurrentChannel] = useState('11111111-1111-1111-1111-111111111111');
  const [servers, setServers] = useState<Server[]>([]);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [messages, setMessages] = useState<Message[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isJoined, setIsJoined] = useState(false);
  const [showSidebar, setShowSidebar] = useState(false);
  const [showUsers, setShowUsers] = useState(false);
  const [authUser, setAuthUser] = useState<any>(null);
  const [showAuthModal, setShowAuthModal] = useState(true);
  const [showCreateCategoryModal, setShowCreateCategoryModal] = useState(false);
  const [showCreateChannelModal, setShowCreateChannelModal] = useState(false);
  const [selectedCategoryForChannel, setSelectedCategoryForChannel] = useState<string>('');
  const [channelMembers, setChannelMembers] = useState<ChannelMember[]>([]);
  const [channelRoles, setChannelRoles] = useState<ChannelRole[]>([]);
  const [userRole, setUserRole] = useState<string>('member');
  const [userPermissions, setUserPermissions] = useState<any>({});
  const [showCommandSuggestions, setShowCommandSuggestions] = useState(false);
  const [commandSuggestions, setCommandSuggestions] = useState<Array<{command: string, description: string, requiresRole?: string}>>([]);
  const [selectedSuggestion, setSelectedSuggestion] = useState(0);

  useEffect(() => {
    // Check for existing session
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        const { data: profile } = await supabase
          .from('users')
          .select('*')
          .eq('id', session.user.id)
          .single();
        
        if (profile) {
          setAuthUser(session.user);
          setUsername(profile.username);
          setUserId(session.user.id);
          setShowAuthModal(false);
        }
      }
    };

    checkAuth();

    // Fetch servers with categories and channels from Supabase
    const fetchServersAndChannels = async () => {
      const { data: serversData, error: serversError } = await supabase
        .from('servers')
        .select(`
          id,
          name,
          description
        `);

      if (serversError) {
        console.error('Error fetching servers:', serversError);
        return;
      }

      // Fetch categories with channels for each server
      const serversWithCategories = await Promise.all(
        (serversData || []).map(async (server) => {
          const { data: categoriesData } = await supabase
            .from('channel_categories')
            .select(`
              id,
              name,
              emoji,
              color,
              sort_order,
              channels (
                id,
                name,
                topic,
                category_id
              )
            `)
            .eq('server_id', server.id)
            .order('sort_order');

          // Also fetch uncategorized channels
          const { data: uncategorizedChannels } = await supabase
            .from('channels')
            .select('id, name, topic, category_id')
            .eq('server_id', server.id)
            .is('category_id', null);

          const categories = categoriesData || [];
          
          // Add uncategorized channels as a special category if they exist
          if (uncategorizedChannels && uncategorizedChannels.length > 0) {
            categories.push({
              id: `uncategorized-${server.id}`,
              name: 'Uncategorized',
              emoji: '📝',
              color: 'text-gray-400',
              sort_order: 999,
              channels: uncategorizedChannels
            });
          }

          return {
            ...server,
            categories: categories
          };
        })
      );

      setServers(serversWithCategories);
      
      // Auto-expand first category of first server
      if (serversWithCategories.length > 0 && serversWithCategories[0].categories.length > 0) {
        setExpandedCategories(new Set([serversWithCategories[0].categories[0].id]));
      }
    };

    fetchServersAndChannels();

    return () => {
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, []);

  useEffect(() => {
    // Auto-join channel when authenticated
    if (authUser && !isJoined) {
      switchChannel(currentServer, currentChannel);
      setIsJoined(true);
    }
  }, [authUser, isJoined]);

  const joinChannel = (serverId: string, channelId: string) => {
    // Cleanup old channel
    if (channel) {
      supabase.removeChannel(channel);
    }

    // Create new channel subscription
    const channelName = `${serverId}:${channelId}`;
    const newChannel = supabase.channel(channelName);

    // Listen for broadcast messages (instant)
    newChannel.on('broadcast', { event: 'message' }, (payload) => {
      console.log('Received broadcast message:', payload);
      setMessages(prev => [...prev, payload.payload]);
    });

    // Listen for moderation events
    newChannel.on('broadcast', { event: 'moderation' }, (payload) => {
      console.log('Received moderation event:', payload);
      // Refresh channel members when moderation happens
      fetchChannelMembers(channelId);
    });

    // Listen for typing indicators  
    newChannel.on('broadcast', { event: 'typing' }, (payload) => {
      console.log('User typing:', payload.payload.username);
    });

    // Track online users via presence
    newChannel.on('presence', { event: 'sync' }, () => {
      const presenceState = newChannel.presenceState();
      const onlineUsers = Object.values(presenceState).flat() as User[];
      
      // Preserve role information when updating presence
      const usersWithRoles = onlineUsers.map(user => {
        const member = channelMembers.find(m => m.user_id === user.id);
        return {
          ...user,
          role: member?.role || 'member'
        };
      });
      setUsers(usersWithRoles);
    });

    // User joined
    newChannel.on('presence', { event: 'join' }, ({ key, newPresences }) => {
      console.log('User joined:', newPresences);
    });

    // User left  
    newChannel.on('presence', { event: 'leave' }, ({ key, leftPresences }) => {
      console.log('User left:', leftPresences);
    });

    // Subscribe to channel
    newChannel.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        console.log(`Connected to ${channelName}`);
        setConnected(true);
        
        // Track our presence
        await newChannel.track({
          id: userId || `user_${Date.now()}`,
          username: username,
          currentServer: serverId,
          currentChannel: channelId,
          last_seen: new Date().toISOString()
        });
      }
    });

    setChannel(newChannel);
  };

  const handleModerationCommand = async (command: string, args: string[]) => {
    if (!authUser || !userId) return false;

    // Check if user has moderation permissions
    const canModerate = userRole === 'owner' || userRole === 'moderator' || userRole === 'admin';

    if (!canModerate) {
      const errorMsg = {
        id: `error_${Date.now()}`,
        username: 'SYSTEM',
        content: `Access denied. You need owner or moderator privileges to use /${command}`,
        timestamp: new Date(),
        server: currentServer,
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
        server: currentServer,
        channel: currentChannel
      };
      setMessages(prev => [...prev, errorMsg]);
      return true;
    }

    // Find target user
    const targetMember = channelMembers.find(m => m.username.toLowerCase() === targetUsername.toLowerCase());
    if (!targetMember) {
      const errorMsg = {
        id: `error_${Date.now()}`,
        username: 'SYSTEM',
        content: `User '${targetUsername}' not found in channel`,
        timestamp: new Date(),
        server: currentServer,
        channel: currentChannel
      };
      setMessages(prev => [...prev, errorMsg]);
      return true;
    }

    // Prevent moderation of channel owner
    if (targetMember.role === 'owner' && userRole !== 'owner') {
      const errorMsg = {
        id: `error_${Date.now()}`,
        username: 'SYSTEM',
        content: `Cannot moderate channel owner`,
        timestamp: new Date(),
        server: currentServer,
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
            server: currentServer,
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
            server: currentServer,
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
              server: currentServer,
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
            server: currentServer,
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
              server: currentServer,
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
            server: currentServer,
            channel: currentChannel
          };
          setMessages(prev => [...prev, unmodMsg]);
          break;
      }

      // Refresh channel members
      await fetchChannelMembers(currentChannel);
      
      // Broadcast the action
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
        server: currentServer,
        channel: currentChannel
      };
      setMessages(prev => [...prev, errorMsg]);
    }

    return true;
  };

  const sendMessage = async () => {
    if (channel && inputMessage.trim() && authUser) {
      const trimmedInput = inputMessage.trim();

      // Check if it's a command
      if (trimmedInput.startsWith('/')) {
        const parts = trimmedInput.slice(1).split(' ');
        const command = parts[0].toLowerCase();
        const args = parts.slice(1);

        const moderationCommands = ['kick', 'ban', 'mod', 'unmod'];
        
        if (moderationCommands.includes(command)) {
          const handled = await handleModerationCommand(command, args);
          if (handled) {
            setInputMessage('');
            return;
          }
        }

        // Handle other commands like /help
        if (command === 'help') {
          const helpMsg = {
            id: `help_${Date.now()}`,
            username: 'SYSTEM',
            content: 'Available commands: /kick <user> [reason], /ban <user> [reason], /mod <user>, /unmod <user>, /info',
            timestamp: new Date(),
            server: currentServer,
            channel: currentChannel
          };
          setMessages(prev => [...prev, helpMsg]);
          setInputMessage('');
          return;
        }

        if (command === 'info') {
          const owner = channelMembers.find(m => m.role === 'owner');
          const moderators = channelMembers.filter(m => m.role === 'moderator' || m.role === 'admin');
          
          const infoMsg = {
            id: `info_${Date.now()}`,
            username: 'SYSTEM',
            content: `Channel info - Owner: ${owner ? owner.username.toUpperCase() : 'None'}${moderators.length > 0 ? ` | Moderators: ${moderators.map(m => m.username.toUpperCase()).join(', ')}` : ''} | Members: ${channelMembers.length}`,
            timestamp: new Date(),
            server: currentServer,
            channel: currentChannel
          };
          setMessages(prev => [...prev, infoMsg]);
          setInputMessage('');
          return;
        }

        if (command === 'roles') {
          if (userRole !== 'Owner') {
            const errorMsg = {
              id: `error_${Date.now()}`,
              username: 'SYSTEM',
              content: 'Access denied. Only channel owners can list roles.',
              timestamp: new Date(),
              server: currentServer,
              channel: currentChannel
            };
            setMessages(prev => [...prev, errorMsg]);
            setInputMessage('');
            return;
          }

          const roleList = channelRoles.map(role => 
            `${role.name} (${role.color}) - Members: ${channelMembers.filter(m => m.role_id === role.id).length}`
          ).join(' | ');

          const rolesMsg = {
            id: `roles_${Date.now()}`,
            username: 'SYSTEM',
            content: `Channel roles: ${roleList || 'No roles found'}`,
            timestamp: new Date(),
            server: currentServer,
            channel: currentChannel
          };
          setMessages(prev => [...prev, rolesMsg]);
          setInputMessage('');
          return;
        }

        if (command === 'createrole') {
          if (userRole !== 'Owner') {
            const errorMsg = {
              id: `error_${Date.now()}`,
              username: 'SYSTEM',
              content: 'Access denied. Only channel owners can create roles.',
              timestamp: new Date(),
              server: currentServer,
              channel: currentChannel
            };
            setMessages(prev => [...prev, errorMsg]);
            setInputMessage('');
            return;
          }

          const roleName = args[0];
          const roleColor = args[1] || 'text-blue-400';

          if (!roleName) {
            const errorMsg = {
              id: `error_${Date.now()}`,
              username: 'SYSTEM',
              content: 'Usage: /createrole <name> [color] - Example: /createrole VIP text-purple-400',
              timestamp: new Date(),
              server: currentServer,
              channel: currentChannel
            };
            setMessages(prev => [...prev, errorMsg]);
            setInputMessage('');
            return;
          }

          try {
            const { error } = await supabase
              .from('channel_roles')
              .insert({
                channel_id: currentChannel,
                name: roleName,
                color: roleColor,
                permissions: {},
                sort_order: 50,
                created_by: userId
              });

            if (error) {
              const errorMsg = {
                id: `error_${Date.now()}`,
                username: 'SYSTEM',
                content: `Failed to create role: ${error.message}`,
                timestamp: new Date(),
                server: currentServer,
                channel: currentChannel
              };
              setMessages(prev => [...prev, errorMsg]);
            } else {
              const successMsg = {
                id: `success_${Date.now()}`,
                username: 'SYSTEM',
                content: `Role "${roleName}" created successfully with color ${roleColor}`,
                timestamp: new Date(),
                server: currentServer,
                channel: currentChannel
              };
              setMessages(prev => [...prev, successMsg]);
              
              // Refresh channel roles
              fetchChannelMembers(currentChannel);
            }
          } catch (error) {
            const errorMsg = {
              id: `error_${Date.now()}`,
              username: 'SYSTEM',
              content: `Error creating role: ${error instanceof Error ? error.message : 'Unknown error'}`,
              timestamp: new Date(),
              server: currentServer,
              channel: currentChannel
            };
            setMessages(prev => [...prev, errorMsg]);
          }

          setInputMessage('');
          return;
        }

        if (command === 'setrole') {
          if (!userPermissions.can_manage_roles) {
            const errorMsg = {
              id: `error_${Date.now()}`,
              username: 'SYSTEM',
              content: 'Access denied. You need role management permissions.',
              timestamp: new Date(),
              server: currentServer,
              channel: currentChannel
            };
            setMessages(prev => [...prev, errorMsg]);
            setInputMessage('');
            return;
          }

          const targetUsername = args[0];
          const roleName = args[1];

          if (!targetUsername || !roleName) {
            const errorMsg = {
              id: `error_${Date.now()}`,
              username: 'SYSTEM',
              content: 'Usage: /setrole <username> <role> - Example: /setrole john VIP',
              timestamp: new Date(),
              server: currentServer,
              channel: currentChannel
            };
            setMessages(prev => [...prev, errorMsg]);
            setInputMessage('');
            return;
          }

          const targetMember = channelMembers.find(m => m.username.toLowerCase() === targetUsername.toLowerCase());
          const targetRole = channelRoles.find(r => r.name.toLowerCase() === roleName.toLowerCase());

          if (!targetMember) {
            const errorMsg = {
              id: `error_${Date.now()}`,
              username: 'SYSTEM',
              content: `User "${targetUsername}" not found in this channel.`,
              timestamp: new Date(),
              server: currentServer,
              channel: currentChannel
            };
            setMessages(prev => [...prev, errorMsg]);
            setInputMessage('');
            return;
          }

          if (!targetRole) {
            const errorMsg = {
              id: `error_${Date.now()}`,
              username: 'SYSTEM',
              content: `Role "${roleName}" not found. Use /roles to see available roles.`,
              timestamp: new Date(),
              server: currentServer,
              channel: currentChannel
            };
            setMessages(prev => [...prev, errorMsg]);
            setInputMessage('');
            return;
          }

          try {
            const { error } = await supabase
              .from('channel_members')
              .update({ role_id: targetRole.id })
              .eq('id', targetMember.id);

            if (error) {
              const errorMsg = {
                id: `error_${Date.now()}`,
                username: 'SYSTEM',
                content: `Failed to assign role: ${error.message}`,
                timestamp: new Date(),
                server: currentServer,
                channel: currentChannel
              };
              setMessages(prev => [...prev, errorMsg]);
            } else {
              const successMsg = {
                id: `success_${Date.now()}`,
                username: 'SYSTEM',
                content: `${targetUsername} has been assigned the role "${roleName}"`,
                timestamp: new Date(),
                server: currentServer,
                channel: currentChannel
              };
              setMessages(prev => [...prev, successMsg]);
              
              // Refresh channel members
              fetchChannelMembers(currentChannel);
            }
          } catch (error) {
            const errorMsg = {
              id: `error_${Date.now()}`,
              username: 'SYSTEM',
              content: `Error assigning role: ${error instanceof Error ? error.message : 'Unknown error'}`,
              timestamp: new Date(),
              server: currentServer,
              channel: currentChannel
            };
            setMessages(prev => [...prev, errorMsg]);
          }

          setInputMessage('');
          return;
        }
      }

      // Regular message
      const message = {
        id: `msg_${Date.now()}`,
        username: username,
        content: trimmedInput,
        timestamp: new Date(),
        server: currentServer,
        channel: currentChannel
      };

      // Send via broadcast for instant delivery
      await channel.send({
        type: 'broadcast',
        event: 'message',
        payload: message
      });

      // Also save to database
      await supabase
        .from('messages')
        .insert({
          channel_id: currentChannel,
          user_id: userId,
          username: username,
          content: trimmedInput,
          message_type: 'message'
        });

      setInputMessage('');
    }
  };

  const switchChannel = async (serverId: string, channelId: string) => {
    setCurrentServer(serverId);
    setCurrentChannel(channelId);
    setMessages([]); // Clear messages when switching
    setUsers([]); // Clear users when switching
    setChannelMembers([]); // Clear channel members when switching
    
    if (authUser) {
      // Fetch existing messages for this channel
      const { data: existingMessages } = await supabase
        .from('messages')
        .select('*')
        .eq('channel_id', channelId)
        .order('created_at', { ascending: true })
        .limit(50);

      if (existingMessages) {
        const formattedMessages = existingMessages.map(msg => ({
          id: msg.id,
          username: msg.username,
          content: msg.content,
          timestamp: new Date(msg.created_at),
          server: serverId,
          channel: channelId
        }));
        setMessages(formattedMessages);
      }
      
      await joinChannelAsMember(channelId);
      await fetchChannelMembers(channelId);
      joinChannel(serverId, channelId);
    }
  };

  const handleAuthSuccess = (user: any) => {
    setAuthUser(user);
    setUsername(user.profile.username);
    setUserId(user.id);
    setShowAuthModal(false);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setAuthUser(null);
    setUsername('');
    setUserId('');
    setShowAuthModal(true);
    setIsJoined(false);
    if (channel) {
      supabase.removeChannel(channel);
      setChannel(null);
    }
  };

  const toggleCategory = (categoryId: string) => {
    const newExpanded = new Set(expandedCategories);
    if (newExpanded.has(categoryId)) {
      newExpanded.delete(categoryId);
    } else {
      newExpanded.add(categoryId);
    }
    setExpandedCategories(newExpanded);
  };

  const getCurrentChannelName = () => {
    for (const server of servers) {
      for (const category of server.categories) {
        const channel = category.channels?.find(c => c.id === currentChannel);
        if (channel) return channel.name;
      }
    }
    return currentChannel;
  };

  const fetchChannelMembers = async (channelId: string) => {
    if (!authUser) return;

    // Fetch channel roles
    const { data: roles } = await supabase
      .from('channel_roles')
      .select('*')
      .eq('channel_id', channelId)
      .order('sort_order', { ascending: false });

    if (roles) {
      setChannelRoles(roles);
    }

    // Fetch members with role information
    const { data: members } = await supabase
      .from('channel_members')
      .select(`
        *,
        channel_role:channel_roles(*)
      `)
      .eq('channel_id', channelId);

    if (members) {
      setChannelMembers(members);

      // Set current user's role and permissions
      const currentUserMember = members.find(m => m.user_id === userId);
      if (currentUserMember?.channel_role) {
        setUserRole(currentUserMember.channel_role.name);
        setUserPermissions(currentUserMember.channel_role.permissions);
      } else {
        setUserRole('Member');
        setUserPermissions({});
      }
    }
  };

  const joinChannelAsMember = async (channelId: string) => {
    if (!authUser || !userId) return;

    // Check if user is already a member
    const { data: existingMember } = await supabase
      .from('channel_members')
      .select('id')
      .eq('channel_id', channelId)
      .eq('user_id', userId)
      .single();

    if (!existingMember) {
      // Get the Member role for this channel
      const { data: memberRole } = await supabase
        .from('channel_roles')
        .select('id')
        .eq('channel_id', channelId)
        .eq('name', 'Member')
        .single();

      // Add user as member
      await supabase
        .from('channel_members')
        .insert({
          channel_id: channelId,
          user_id: userId,
          username: username,
          role: 'member', // Legacy field
          role_id: memberRole?.id
        });
    }

    // Update last_seen
    await supabase
      .from('channel_members')
      .update({ last_seen: new Date().toISOString() })
      .eq('channel_id', channelId)
      .eq('user_id', userId);
  };

  const getRoleColor = (member: ChannelMember) => {
    if (member.channel_role) {
      return member.channel_role.color;
    }
    // Fallback to legacy role colors
    switch (member.role) {
      case 'owner': return 'text-red-400';
      case 'moderator':
      case 'admin': return 'text-yellow-400'; 
      default: return 'text-green-400';
    }
  };

  const getAvailableCommands = () => {
    const allCommands = [
      { command: 'help', description: 'Show available commands' },
      { command: 'info', description: 'Show channel information' },
      { command: 'roles', description: 'List all channel roles', requiresRole: 'Owner' },
      { command: 'kick <user> [reason]', description: 'Remove user from channel', requiresPermission: 'can_kick' },
      { command: 'ban <user> [reason]', description: 'Ban user from channel', requiresPermission: 'can_ban' },
      { command: 'setrole <user> <role>', description: 'Assign role to user', requiresPermission: 'can_manage_roles' },
      { command: 'createrole <name> <color>', description: 'Create new custom role', requiresRole: 'Owner' },
    ];

    // Filter commands based on user permissions and role
    return allCommands.filter(cmd => {
      if (!cmd.requiresRole && !cmd.requiresPermission) return true;
      
      if (cmd.requiresRole) {
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

    const commandPart = input.slice(1).toLowerCase();
    const availableCommands = getAvailableCommands();
    
    if (commandPart === '') {
      setCommandSuggestions(availableCommands);
      setShowCommandSuggestions(true);
      setSelectedSuggestion(0);
    } else {
      const filtered = availableCommands.filter(cmd => 
        cmd.command.toLowerCase().startsWith(commandPart)
      );
      setCommandSuggestions(filtered);
      setShowCommandSuggestions(filtered.length > 0);
      setSelectedSuggestion(0);
    }
  };

  const handleInputChange = (value: string) => {
    setInputMessage(value);
    updateCommandSuggestions(value);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showCommandSuggestions) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedSuggestion(prev => 
          prev < commandSuggestions.length - 1 ? prev + 1 : 0
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedSuggestion(prev => 
          prev > 0 ? prev - 1 : commandSuggestions.length - 1
        );
        break;
      case 'Tab':
      case 'Enter':
        if (e.key === 'Tab') {
          e.preventDefault();
        }
        if (commandSuggestions[selectedSuggestion]) {
          const selectedCommand = commandSuggestions[selectedSuggestion];
          const commandWithSlash = `/${selectedCommand.command.split(' ')[0]}`;
          setInputMessage(commandWithSlash + ' ');
          setShowCommandSuggestions(false);
          if (e.key === 'Tab') {
            return; // Don't send message on tab
          }
        }
        break;
      case 'Escape':
        setShowCommandSuggestions(false);
        break;
    }
  };

  const selectSuggestion = (index: number) => {
    const selectedCommand = commandSuggestions[index];
    const commandWithSlash = `/${selectedCommand.command.split(' ')[0]}`;
    setInputMessage(commandWithSlash + ' ');
    setShowCommandSuggestions(false);
  };

  const handleCreateCategory = () => {
    setShowCreateCategoryModal(true);
  };

  const handleCreateChannel = (categoryId?: string) => {
    setSelectedCategoryForChannel(categoryId || '');
    setShowCreateChannelModal(true);
  };

  const handleCreationSuccess = () => {
    // Refresh servers and channels data
    const fetchServersAndChannels = async () => {
      const { data: serversData, error: serversError } = await supabase
        .from('servers')
        .select(`
          id,
          name,
          description
        `);

      if (serversError) {
        console.error('Error fetching servers:', serversError);
        return;
      }

      // Fetch categories with channels for each server
      const serversWithCategories = await Promise.all(
        (serversData || []).map(async (server) => {
          const { data: categoriesData } = await supabase
            .from('channel_categories')
            .select(`
              id,
              name,
              emoji,
              color,
              sort_order,
              channels (
                id,
                name,
                topic,
                category_id
              )
            `)
            .eq('server_id', server.id)
            .order('sort_order');

          // Also fetch uncategorized channels
          const { data: uncategorizedChannels } = await supabase
            .from('channels')
            .select('id, name, topic, category_id')
            .eq('server_id', server.id)
            .is('category_id', null);

          const categories = categoriesData || [];
          
          // Add uncategorized channels as a special category if they exist
          if (uncategorizedChannels && uncategorizedChannels.length > 0) {
            categories.push({
              id: `uncategorized-${server.id}`,
              name: 'Uncategorized',
              emoji: '📝',
              color: 'text-gray-400',
              sort_order: 999,
              channels: uncategorizedChannels
            });
          }

          return {
            ...server,
            categories: categories
          };
        })
      );

      setServers(serversWithCategories);
    };

    fetchServersAndChannels();
  };

  if (showAuthModal) {
    return <AuthModal onAuthSuccess={handleAuthSuccess} />;
  }

  return (
    <div className="h-screen w-screen bg-black text-green-400 font-mono text-xs sm:text-sm overflow-hidden fixed inset-0 flex flex-col">
      {/* Terminal Title */}
      <div className="border-b border-green-400 p-2 flex-shrink-0">
        <div className="text-center hidden sm:block">
          ████████ ██████   ██████     ██████ ██   ██  █████  ████████ 
          ██       ██   ██ ██          ██     ██   ██ ██   ██    ██    
          ██████   ██████  ██          ██     ███████ ███████    ██    
               ██  ██   ██ ██          ██     ██   ██ ██   ██    ██    
          ████████ ██   ██  ██████     ██████ ██   ██ ██   ██ ████████ 
        </div>
        {/* Mobile header */}
        <div className="sm:hidden flex items-center justify-between">
          <button 
            onClick={() => setShowSidebar(!showSidebar)}
            className="text-green-300 hover:text-yellow-400"
          >
            [CHANNELS]
          </button>
          <div className="text-center text-green-300">IRC CHAT</div>
          <button 
            onClick={() => setShowUsers(!showUsers)}
            className="text-green-300 hover:text-yellow-400"
          >
            [USERS]
          </button>
        </div>
        {/* Desktop header with logout */}
        <div className="hidden sm:flex items-center justify-between">
          <div className="text-green-300">USER: {username.toUpperCase()}</div>
          <button 
            onClick={handleLogout}
            className="text-red-400 hover:text-yellow-400 text-xs"
          >
            [LOGOUT]
          </button>
        </div>
      </div>

      <div className="flex flex-1 relative min-h-0">
        {/* Mobile Sidebar Overlay */}
        {showSidebar && (
          <div className="absolute inset-0 bg-black bg-opacity-75 z-20 sm:hidden" onClick={() => setShowSidebar(false)}>
            <div className="w-64 h-full bg-black border-r border-green-400 p-4" onClick={(e) => e.stopPropagation()}>
              <div className="flex justify-between items-center mb-4">
                <div className="text-green-300">CHANNELS:</div>
                <div className="flex gap-1">
                  <button 
                    onClick={handleCreateCategory}
                    className="text-xs text-green-300 hover:text-yellow-400"
                    title="Create Category"
                  >
                    [+CAT]
                  </button>
                  <button 
                    onClick={() => handleCreateChannel()}
                    className="text-xs text-green-300 hover:text-yellow-400"
                    title="Create Channel"
                  >
                    [+CH]
                  </button>
                  <button onClick={() => setShowSidebar(false)} className="text-red-400">[X]</button>
                </div>
              </div>
              <div className="mb-4 pb-2 border-b border-green-400">
                <div className="text-green-300 text-xs">USER: {username.toUpperCase()}</div>
                <button 
                  onClick={handleLogout}
                  className="text-red-400 hover:text-yellow-400 text-xs mt-1"
                >
                  [LOGOUT]
                </button>
              </div>
              <div className="ml-2">
                {servers.map(server => (
                  <div key={server.id}>
                    {server.categories.map(category => (
                      <div key={category.id}>
                        <div 
                          onClick={() => toggleCategory(category.id)}
                          className="cursor-pointer text-green-300 hover:text-yellow-400 mb-1"
                        >
                          {expandedCategories.has(category.id) ? '[-]' : '[+]'} {category.name.toUpperCase()}
                        </div>
                        {expandedCategories.has(category.id) && category.channels?.map(channel => (
                          <div 
                            key={channel.id}
                            onClick={() => {
                              switchChannel(server.id, channel.id);
                              setShowSidebar(false);
                            }}
                            className={`cursor-pointer ml-4 ${
                              currentServer === server.id && currentChannel === channel.id
                                ? 'text-yellow-400'
                                : 'text-green-400 hover:text-yellow-400'
                            }`}
                          >
                            {currentServer === server.id && currentChannel === channel.id ? '> ' : '  '}
                            #{channel.name.toUpperCase()}
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
              

            </div>
          </div>
        )}

        {/* Desktop Channel List */}
        <div className="hidden sm:block w-64 lg:w-72 border-r border-green-400 p-4 flex-shrink-0 overflow-auto">
          <div className="mb-4">
            <div className="flex justify-between items-center">
              <div className="text-green-300">CHANNELS:</div>
              <div className="flex gap-1">
                <button 
                  onClick={handleCreateCategory}
                  className="text-xs text-green-300 hover:text-yellow-400 border border-green-400 px-2 py-1"
                  title="Create Category"
                >
                  [+CAT]
                </button>
                <button 
                  onClick={() => handleCreateChannel()}
                  className="text-xs text-green-300 hover:text-yellow-400 border border-green-400 px-2 py-1"
                  title="Create Channel"
                >
                  [+CH]
                </button>
              </div>
            </div>
            <div className="ml-2">
              {servers.map(server => (
                <div key={server.id}>
                  {server.categories.map(category => (
                    <div key={category.id} className="mb-2">
                      <div className="flex justify-between items-center mb-1">
                        <div 
                          onClick={() => toggleCategory(category.id)}
                          className="cursor-pointer text-green-300 hover:text-yellow-400 font-medium flex-1"
                        >
                          {expandedCategories.has(category.id) ? '[-]' : '[+]'} {category.name.toUpperCase()}
                        </div>
                        <button 
                          onClick={() => handleCreateChannel(category.id)}
                          className="text-xs text-green-300 hover:text-yellow-400 ml-2"
                          title="Add Channel to Category"
                        >
                          [+]
                        </button>
                      </div>
                      {expandedCategories.has(category.id) && category.channels?.map(channel => (
                        <div 
                          key={channel.id}
                          onClick={() => switchChannel(server.id, channel.id)}
                          className={`cursor-pointer ml-4 ${
                            currentServer === server.id && currentChannel === channel.id
                              ? 'text-yellow-400'
                              : 'text-green-400 hover:text-yellow-400'
                          }`}
                        >
                          {currentServer === server.id && currentChannel === channel.id ? '> ' : '  '}
                          #{channel.name.toUpperCase()}
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
          

        </div>

        {/* Main Terminal */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Header */}
          <div className="border-b border-green-400 p-2">
            <div className="text-center hidden sm:block">
              === CONNECTED TO #{getCurrentChannelName().toUpperCase()} ===
            </div>
            <div className="text-center sm:hidden">
              #{getCurrentChannelName().toUpperCase()}
            </div>
          </div>

          {/* Chat Area */}
          <div className="flex-1 p-2 sm:p-4 overflow-auto">
            <div className="space-y-1">
              <div className="hidden sm:block">*** MOTD: WELCOME TO THE RETRO IRC EXPERIENCE ***</div>
              <div className="hidden sm:block">*** CONNECTING TO {servers.find(s => s.id === currentServer)?.name.toUpperCase()}:6667</div>
              <div className="hidden sm:block">*** JOINING #{getCurrentChannelName().toUpperCase()}</div>
              {messages.map(message => {
                const time = new Date(message.timestamp).toLocaleTimeString('en-US', { hour12: false });
                const userColors = ['text-yellow-400', 'text-cyan-400', 'text-magenta-400', 'text-red-400', 'text-green-300', 'text-blue-400'];
                const colorIndex = message.username.charCodeAt(0) % userColors.length;
                return (
                  <div key={message.id} className={`${userColors[colorIndex]} break-words`}>
                    <span className="hidden sm:inline">{time} </span>&lt;{message.username.toUpperCase()}&gt; {message.content.toUpperCase()}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Command Autocomplete */}
          {showCommandSuggestions && (
            <div className="border-t border-green-400 bg-black max-h-48 overflow-y-auto command-suggestions" style={{
              scrollbarWidth: 'thin',
              scrollbarColor: '#4b5563 #1f2937'
            }}>
              {commandSuggestions.map((suggestion, index) => (
                <div
                  key={suggestion.command}
                  onClick={() => selectSuggestion(index)}
                  className={`p-2 cursor-pointer border-b border-green-600 ${
                    index === selectedSuggestion 
                      ? 'bg-gray-700 text-yellow-400' 
                      : 'text-green-400 hover:bg-gray-800'
                  }`}
                >
                  <div className="font-mono text-xs">
                    <span className="text-yellow-300">/{suggestion.command}</span>
                    <div className="text-gray-400 text-xs mt-1">
                      {suggestion.description}
                      {suggestion.requiresRole && (
                        <span className="ml-2 text-red-400">
                          ({suggestion.requiresRole}+ only)
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              <div className="p-1 text-xs text-gray-500 text-center border-b border-green-600">
                ↑↓ Navigate • TAB/ENTER Select • ESC Cancel
              </div>
            </div>
          )}

          {/* Input Line */}
          <div className="border-t border-green-400 p-2">
            <div className="flex">
              <span className="text-green-300 hidden sm:inline">[#{getCurrentChannelName().toUpperCase()}]&gt; </span>
              <span className="text-green-300 sm:hidden">&gt; </span>
              <input 
                type="text" 
                value={inputMessage}
                onChange={(e) => handleInputChange(e.target.value)}
                onKeyDown={handleKeyDown}
                onKeyPress={(e) => {
                  if (e.key === 'Enter' && !showCommandSuggestions) {
                    sendMessage();
                  }
                }}
                className="flex-1 bg-transparent text-green-400 outline-none ml-2 placeholder-gray-600"
                placeholder={userRole === 'owner' || userRole === 'moderator' ? "TYPE MESSAGE OR COMMAND (/help for commands)..." : "TYPE MESSAGE..."}
              />
              <span className="animate-pulse text-green-300">█</span>
            </div>
          </div>
        </div>

        {/* Mobile Users Overlay */}
        {showUsers && (
          <div className="absolute inset-0 bg-black bg-opacity-75 z-20 sm:hidden" onClick={() => setShowUsers(false)}>
            <div className="w-48 h-full bg-black border-l border-green-400 p-4 ml-auto" onClick={(e) => e.stopPropagation()}>
              <div className="flex justify-between items-center mb-4">
                <div className="text-green-300">USERS ({users.length}):</div>
                <button onClick={() => setShowUsers(false)} className="text-red-400">[X]</button>
              </div>
              <div className="space-y-1 text-xs">
                {users.map((user, index) => {
                  const member = channelMembers.find(m => m.user_id === user.id);
                  if (!member) return null;
                  const roleColor = getRoleColor(member);
                  
                  return (
                    <div key={`mobile-user-${user.id}-${index}`} className={roleColor}>
                      {user.username.toUpperCase()}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Desktop User List */}
        <div className="hidden lg:block w-48 xl:w-56 border-l border-green-400 p-4 flex-shrink-0 overflow-auto">
          <div className="text-green-300 mb-4">USERS ({users.length}):</div>
          <div className="space-y-1 text-xs">
            {users.map((user, index) => {
              const member = channelMembers.find(m => m.user_id === user.id);
              if (!member) return null;
              const roleColor = getRoleColor(member);
              
              return (
                <div key={`desktop-user-${user.id}-${index}`} className={roleColor}>
                  {user.username.toUpperCase()}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Bottom Status */}
      <div className="border-t border-green-400 p-1 text-center text-xs flex-shrink-0">
        <div className="hidden sm:block">
          USERS: {users.length} | {connected ? 'CONNECTED' : 'DISCONNECTED'}
        </div>
        <div className="sm:hidden">
          USERS: {users.length} | {connected ? 'CONNECTED' : 'DISCONNECTED'}
        </div>
      </div>

      {/* Modals */}
      {showCreateCategoryModal && (
        <CreateCategoryModal
          serverId={currentServer}
          onClose={() => setShowCreateCategoryModal(false)}
          onSuccess={handleCreationSuccess}
        />
      )}

      {showCreateChannelModal && (
        <CreateChannelModal
          serverId={currentServer}
          categoryId={selectedCategoryForChannel}
          categories={servers.find(s => s.id === currentServer)?.categories || []}
          onClose={() => setShowCreateChannelModal(false)}
          onSuccess={handleCreationSuccess}
        />
      )}
    </div>
  );
}

'use client';

import { useEffect, useState, useCallback, startTransition, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import type { RealtimeChannel } from '@supabase/supabase-js';
import AuthModal from '@/components/AuthModal';
import CreateCategoryModal from '@/components/CreateCategoryModal';
import CreateChannelModal from '@/components/CreateChannelModal';
import type { ChannelCategory, ChannelMember, ChannelRole } from '@/lib/supabase';

interface User {
  id: string;
  username: string;
  currentChannel: string;
  role?: string;
}

interface Message {
  id: string;
  username: string;
  content: string;
  timestamp: Date;
  channel: string;
}


function HomeContent() {
  // const router = useRouter(); // Not currently used but kept for future URL routing
  const searchParams = useSearchParams();
  const [channel, setChannel] = useState<RealtimeChannel | null>(null);
  const [connected, setConnected] = useState(false);
  const [username, setUsername] = useState('');
  const [userId, setUserId] = useState('');
  const [currentChannel, setCurrentChannel] = useState('');
  const [categories, setCategories] = useState<ChannelCategory[]>([]);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [messages, setMessages] = useState<Message[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isJoined, setIsJoined] = useState(false);
  const [showSidebar, setShowSidebar] = useState(false);
  const [showUsers, setShowUsers] = useState(false);
  const [authUser, setAuthUser] = useState<{ id: string; username: string } | null>(null);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showCreateCategoryModal, setShowCreateCategoryModal] = useState(false);
  const [showCreateChannelModal, setShowCreateChannelModal] = useState(false);
  const [selectedCategoryForChannel, setSelectedCategoryForChannel] = useState<string>('');
  const [channelMembers, setChannelMembers] = useState<ChannelMember[]>([]);
  const [channelRoles, setChannelRoles] = useState<ChannelRole[]>([]);
  const [userRole, setUserRole] = useState<string>('member');
  const [userPermissions, setUserPermissions] = useState<Record<string, boolean>>({});
  const [showCommandSuggestions, setShowCommandSuggestions] = useState(false);
  const [commandSuggestions, setCommandSuggestions] = useState<Array<{command: string, description: string, requiresRole?: string}>>([]);
  const [selectedSuggestion, setSelectedSuggestion] = useState(0);
  const [currentMotd, setCurrentMotd] = useState<string>('WELCOME TO THE RETRO IRC EXPERIENCE');
  const [currentTopic, setCurrentTopic] = useState<string>('');
  const [joinStatus, setJoinStatus] = useState<'joining' | 'success' | 'failed' | null>(null);
  const [joiningChannelName, setJoiningChannelName] = useState<string>('');
  // const [switchingChannel, setSwitchingChannel] = useState<string>(''); // Not currently used
  // const [urlUpdateTimeout, setUrlUpdateTimeout] = useState<NodeJS.Timeout | null>(null); // Not currently used
  const [pendingDeleteChannel, setPendingDeleteChannel] = useState<{id: string, name: string, requestedBy: string} | null>(null);
  const [localMessages, setLocalMessages] = useState<Message[]>([]);
  const [unreadMentions, setUnreadMentions] = useState<Record<string, number>>({});

  const fetchUnreadMentions = useCallback(async () => {
    if (!userId) return;
    
    const { data: mentions } = await supabase
      .from('mentions')
      .select('channel_id')
      .eq('mentioned_user_id', userId)
      .eq('is_read', false);
    
    if (mentions) {
      const mentionCounts: Record<string, number> = {};
      mentions.forEach(mention => {
        mentionCounts[mention.channel_id] = (mentionCounts[mention.channel_id] || 0) + 1;
      });
      setUnreadMentions(mentionCounts);
    }
  }, [userId]);

  // Define universal channels that should appear at the top
  const universalChannels = ['global', 'general', 'random', 'tech', 'gaming', 'music', 'news', 'help', 'projects', 'feedback'];

  // Fetch categories with channels from Supabase
  const fetchCategoriesAndChannels = useCallback(async () => {
    // OPTIMIZED: Bundle categories, uncategorized channels, and universal channels in parallel
    const [categoriesResult, uncategorizedResult, universalChannelsResult] = await Promise.all([
      supabase
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
        .order('name'),
      
      supabase
        .from('channels')
        .select('id, name, topic, category_id')
        .is('category_id', null)
        .not('name', 'in', `(${universalChannels.map(ch => `"${ch}"`).join(',')})`),
      
      supabase
        .from('channels')
        .select('id, name, topic, category_id')
        .in('name', universalChannels)
    ]);

    const categoriesData = categoriesResult.data;
    const uncategorizedChannels = uncategorizedResult.data;
    const fetchedUniversalChannels = universalChannelsResult.data || [];

    if (categoriesResult.error) {
      console.error('Error fetching categories:', categoriesResult.error);
      return;
    }

    const categories = [];
    
    // Sort universal channels alphabetically, but keep global first
    const globalChannel = fetchedUniversalChannels.find(ch => ch.name === 'global');
    const otherUniversalChannels = fetchedUniversalChannels
      .filter(ch => universalChannels.includes(ch.name) && ch.name !== 'global')
      .sort((a, b) => a.name.localeCompare(b.name));
    
    const sortedUniversalChannels = [
      ...(globalChannel ? [globalChannel] : []),
      ...otherUniversalChannels
    ].map(ch => ({ ...ch, created_at: new Date().toISOString() }));
    
    // Add universal channels at the top as individual channels (no category wrapper)
    if (sortedUniversalChannels.length > 0) {
      const universalCategory: ChannelCategory = {
        id: 'universal',
        name: '',
        emoji: '',
        color: '',
        sort_order: -1,
        channels: sortedUniversalChannels,
        created_at: new Date().toISOString()
      };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      categories.push(universalCategory as any);
    }
    
    // Add regular categories
    categories.push(...(categoriesData || []));
    
    // Add uncategorized channels directly without a category wrapper (sorted alphabetically)
    if (uncategorizedChannels && uncategorizedChannels.length > 0) {
      const sortedUncategorized = uncategorizedChannels
        .sort((a, b) => a.name.localeCompare(b.name))
        .map(ch => ({ ...ch, created_at: new Date().toISOString() }));
        
      const uncategorizedCategory: ChannelCategory = {
        id: 'no-category',
        name: '',
        emoji: '',
        color: '',
        sort_order: 0,
        channels: sortedUncategorized,
        created_at: new Date().toISOString()
      };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      categories.push(uncategorizedCategory as any);
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    setCategories(categories as any);
    
    // Fetch unread mentions
    if (userId) {
      fetchUnreadMentions();
    }
    
    // Auto-select first channel if none selected and no URL channel
    if (!currentChannel && categories.length > 0 && !Array.from(searchParams.keys())[0]) {
      // Auto-select first channel when no URL channel specified
      let firstChannel = null;
      for (const category of categories) {
        if (category.channels && category.channels.length > 0) {
          firstChannel = category.channels[0];
          break;
        }
      }
      
      if (firstChannel) {
        setCurrentChannel(firstChannel.id);
      }
    }
    
    // Keep all categories collapsed by default
    setExpandedCategories(new Set());
  }, [fetchUnreadMentions, userId]);


  useEffect(() => {
    // Check for existing session
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
    fetchCategoriesAndChannels();

    return () => {
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    // Auto-join default channel for all users (authenticated and lurkers)
    if (!isJoined && currentChannel) {
      switchChannel(currentChannel);
      setIsJoined(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isJoined, currentChannel]);

  // Listen for new mentions
  useEffect(() => {
    if (!userId) return;
    
    const mentionChannel = supabase
      .channel('mentions')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'mentions',
          filter: `mentioned_user_id=eq.${userId}`
        },
        (payload) => {
          const mention = payload.new;
          setUnreadMentions(prev => ({
            ...prev,
            [mention.channel_id]: (prev[mention.channel_id] || 0) + 1
          }));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(mentionChannel);
    };
  }, [userId]);

  const joinChannel = async (channelId: string) => {
    // Cleanup old channel
    if (channel) {
      supabase.removeChannel(channel);
    }

    // Create new channel subscription
    const channelName = `channel:${channelId}`;
    const newChannel = supabase.channel(channelName);

    // Listen for broadcast messages (instant)
    newChannel.on('broadcast', { event: 'message' }, (payload) => {
      // Don't add message if it's from ourselves (we already added it locally)
      if (payload.payload.username !== username) {
        setMessages(prev => [...prev, payload.payload]);
      }
    });

    // Listen for moderation events
    newChannel.on('broadcast', { event: 'moderation' }, (_payload) => {
      // Refresh channel members when moderation happens
      fetchChannelMembers(channelId);
    });

    // Listen for MOTD updates
    newChannel.on('broadcast', { event: 'motd_update' }, (payload) => {
      setCurrentMotd(payload.payload.motd.toUpperCase());
      
      // Show MOTD update message
      const motdMsg = {
        id: `motd_update_${Date.now()}`,
        username: 'SYSTEM',
        content: `MOTD updated by ${payload.payload.set_by}: ${payload.payload.motd}`,
        timestamp: new Date(),
        channel: channelId
      };
      setMessages(prev => [...prev, motdMsg]);
    });

    // Listen for typing indicators  
    newChannel.on('broadcast', { event: 'typing' }, (_payload) => {
      // Handle typing indicator if needed
    });

    // Track online users via presence (all users can see this)
    newChannel.on('presence', { event: 'sync' }, () => {
      const presenceState = newChannel.presenceState();
      const allConnections = Object.values(presenceState).flat() as unknown as User[];
      
      // FIXED: Deduplicate users by ID (multiple tabs = multiple connections)
      const uniqueUsers = allConnections.reduce((unique: User[], user) => {
        const existingUser = unique.find(u => u.id === user.id);
        if (!existingUser) {
          unique.push(user);
        }
        return unique;
      }, []);
      
      // Preserve role information when updating presence
      const usersWithRoles = uniqueUsers.map(user => {
        const member = channelMembers.find(m => m.user_id === user.id);
        return {
          ...user,
          role: member?.role || 'member'
        };
      });
      setUsers(usersWithRoles);
    });

    // User joined
    newChannel.on('presence', { event: 'join' }, ({ newPresences: _newPresences }) => {
      // Handle user join if needed
    });

    // User left  
    newChannel.on('presence', { event: 'leave' }, ({ leftPresences: _leftPresences }) => {
      // Handle user leave if needed
    });

    // Subscribe to channel
    newChannel.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        setConnected(true);
        
        // Track our presence only if authenticated
        if (authUser && userId && username) {
          await newChannel.track({
            id: userId,
            username: username,
            currentChannel: channelId,
            last_seen: new Date().toISOString()
          });
        }
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

    // Find target user
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

    // Prevent moderation of channel owner
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
        channel: currentChannel
      };
      setMessages(prev => [...prev, errorMsg]);
    }

    return true;
  };

  const detectAndStoreMentions = async (content: string, messageId: string) => {
    const mentionRegex = /@(\w+)/g;
    const mentions = [];
    let match;
    
    while ((match = mentionRegex.exec(content)) !== null) {
      const mentionedUsername = match[1].toLowerCase();
      mentions.push(mentionedUsername);
    }
    
    if (mentions.length > 0) {
      // Get channel members to validate mentions
      const { data: members } = await supabase
        .from('channel_members')
        .select('user_id, username')
        .eq('channel_id', currentChannel)
        .in('username', mentions.map(m => m.toLowerCase()));
      
      if (members && members.length > 0) {
        const mentionInserts = members
          .filter(member => member.user_id !== userId) // Don't mention self
          .map(member => ({
            message_id: messageId,
            channel_id: currentChannel,
            mentioned_user_id: member.user_id,
            mentioned_username: member.username,
            mentioner_user_id: userId,
            mentioner_username: username
          }));
        
        if (mentionInserts.length > 0) {
          await supabase
            .from('mentions')
            .insert(mentionInserts);
        }
      }
    }
  };

  const formatMessageContent = (content: string) => {
    // Highlight @mentions
    const mentionRegex = /@(\w+)/g;
    const parts = content.split(mentionRegex);
    
    return parts.map((part, index) => {
      if (index % 2 === 1) {
        // This is a mentioned username
        const isMentioningSelf = part.toLowerCase() === username.toLowerCase();
        return (
          <span
            key={index}
            className={`font-bold ${
              isMentioningSelf 
                ? 'bg-yellow-600 text-black px-1 rounded' 
                : 'text-cyan-400'
            }`}
          >
            @{part}
          </span>
        );
      }
      return part;
    });
  };

  const performChannelDeletion = async (channelToDelete: {id: string, name: string}) => {
    if (!authUser || !userId) return;

    try {
      // Delete in cascade order: messages, members, roles, bans, then channel
      
      // 1. Delete all messages in the channel
      const { error: messagesError } = await supabase
        .from('messages')
        .delete()
        .eq('channel_id', channelToDelete.id);

      if (messagesError) throw messagesError;

      // 2. Delete all channel members
      const { error: membersError } = await supabase
        .from('channel_members')
        .delete()
        .eq('channel_id', channelToDelete.id);

      if (membersError) throw membersError;

      // 3. Delete all channel roles
      const { error: rolesError } = await supabase
        .from('channel_roles')
        .delete()
        .eq('channel_id', channelToDelete.id);

      if (rolesError) throw rolesError;

      // 4. Delete all channel bans
      const { error: bansError } = await supabase
        .from('channel_bans')
        .delete()
        .eq('channel_id', channelToDelete.id);

      if (bansError) throw bansError;

      // 5. Finally delete the channel itself
      const { error: channelError } = await supabase
        .from('channels')
        .delete()
        .eq('id', channelToDelete.id);

      if (channelError) throw channelError;

      // Show success message
      const successMsg = {
        id: `delete_success_${Date.now()}`,
        username: 'SYSTEM',
        content: `Channel #${channelToDelete.name.toUpperCase()} has been permanently deleted.`,
        timestamp: new Date(),
        channel: 'system'
      };
      setMessages(prev => [...prev, successMsg]);
      
      // Clear local messages after successful deletion
      setLocalMessages([]);

      // Refresh categories and switch to first available channel
      await fetchCategoriesAndChannels();
      
      // If we just deleted the current channel, switch to first available
      setTimeout(() => {
        const firstAvailableChannel = categories
          .flatMap(cat => cat.channels || [])
          .find(ch => ch.id !== channelToDelete.id);
        
        if (firstAvailableChannel) {
          switchChannel(firstAvailableChannel.id);
        }
      }, 500);

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

  const sendMessage = async () => {
    if (channel && inputMessage.trim() && authUser) {
      const trimmedInput = inputMessage.trim();

      // Check for delete confirmation response (only from the user who requested it)
      if (pendingDeleteChannel && pendingDeleteChannel.requestedBy === userId && (trimmedInput.toLowerCase() === 'y' || trimmedInput.toLowerCase() === 'n')) {
        if (trimmedInput.toLowerCase() === 'y') {
          // Proceed with deletion
          await performChannelDeletion(pendingDeleteChannel);
        } else {
          // Cancel deletion
          const cancelMsg = {
            id: `delete_cancelled_${Date.now()}`,
            username: 'SYSTEM',
            content: `Channel deletion cancelled.`,
            timestamp: new Date(),
            channel: currentChannel
          };
          setLocalMessages(prev => [...prev, cancelMsg]);
        }
        setPendingDeleteChannel(null);
        setLocalMessages(prev => prev.filter(msg => !msg.id.startsWith('delete_confirm_')));
        setInputMessage('');
        return;
      }

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
            content: 'Available commands: /kick <user> [reason], /ban <user> [reason], /mod <user>, /unmod <user>, /topic <message>, /motd <message>, /delete, /info',
            timestamp: new Date(),
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
                    channel: currentChannel
            };
            setMessages(prev => [...prev, errorMsg]);
            setInputMessage('');
            return;
          }

          const roleName = args[0];
          const roleColor = args[1];

          if (!roleName) {
            const errorMsg = {
              id: `error_${Date.now()}`,
              username: 'SYSTEM',
              content: 'Usage: /createrole <name> [color] - Example: /createrole VIP purple',
              timestamp: new Date(),
                    channel: currentChannel
            };
            setMessages(prev => [...prev, errorMsg]);
            setInputMessage('');
            return;
          }

          if (!roleColor) {
            const errorMsg = {
              id: `error_${Date.now()}`,
              username: 'SYSTEM',
              content: 'Usage: /createrole <name> <color> - Use autocomplete to select a color',
              timestamp: new Date(),
                    channel: currentChannel
            };
            setMessages(prev => [...prev, errorMsg]);
            setInputMessage('');
            return;
          }

          // Convert color name to Tailwind class
          const colorMap: { [key: string]: string } = {
            'red': 'text-red-400',
            'orange': 'text-orange-400', 
            'yellow': 'text-yellow-400',
            'green': 'text-green-400',
            'blue': 'text-blue-400',
            'purple': 'text-purple-400',
            'pink': 'text-pink-400',
            'cyan': 'text-cyan-400',
            'gray': 'text-gray-400',
            'grey': 'text-gray-400',
            'emerald': 'text-emerald-400',
            'indigo': 'text-indigo-400',
            'teal': 'text-teal-400'
          };

          const finalColor = colorMap[roleColor.toLowerCase()] || roleColor;

          // Validate if it's a proper Tailwind color class
          if (!finalColor.startsWith('text-') && !colorMap[roleColor.toLowerCase()]) {
            const errorMsg = {
              id: `error_${Date.now()}`,
              username: 'SYSTEM',
              content: `Invalid color "${roleColor}". Use color names like: red, blue, purple, green, etc.`,
              timestamp: new Date(),
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
                color: finalColor,
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
                        channel: currentChannel
              };
              setMessages(prev => [...prev, errorMsg]);
            } else {
              const successMsg = {
                id: `success_${Date.now()}`,
                username: 'SYSTEM',
                content: `Role "${roleName}" created successfully with color ${roleColor}`,
                timestamp: new Date(),
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
                    channel: currentChannel
            };
            setMessages(prev => [...prev, errorMsg]);
          }

          setInputMessage('');
          return;
        }

        if (command === 'topic') {
          // Check if user is channel owner or moderator
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
            setInputMessage('');
            return;
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
            setInputMessage('');
            return;
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
              setCurrentTopic(newTopic); // Update local state immediately
              
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

          setInputMessage('');
          return;
        }

        if (command === 'motd') {
          // Check if user is channel owner
          if (userRole !== 'Owner') {
            const errorMsg = {
              id: `error_${Date.now()}`,
              username: 'SYSTEM',
              content: 'Access denied. Only channel owners can set MOTD.',
              timestamp: new Date(),
                    channel: currentChannel
            };
            setMessages(prev => [...prev, errorMsg]);
            setInputMessage('');
            return;
          }

          const newMotd = args.join(' ');
          
          if (!newMotd) {
            const errorMsg = {
              id: `error_${Date.now()}`,
              username: 'SYSTEM',
              content: 'Usage: /motd <message> - Example: /motd Welcome to our awesome channel!',
              timestamp: new Date(),
                    channel: currentChannel
            };
            setMessages(prev => [...prev, errorMsg]);
            setInputMessage('');
            return;
          }

          try {
            const { error } = await supabase
              .from('channels')
              .update({ 
                motd: newMotd,
                motd_set_by: userId,
                motd_set_at: new Date().toISOString()
              })
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

              // Broadcast MOTD update to all users in channel
              if (channel) {
                await channel.send({
                  type: 'broadcast',
                  event: 'motd_update',
                  payload: { motd: newMotd, set_by: username }
                });
              }
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

          setInputMessage('');
          return;
        }

        if (command === 'delete') {
          // Check if user is channel owner
          if (userRole !== 'Owner') {
            const errorMsg = {
              id: `error_${Date.now()}`,
              username: 'SYSTEM',
              content: 'Access denied. Only channel owners can delete channels.',
              timestamp: new Date(),
              channel: currentChannel
            };
            setMessages(prev => [...prev, errorMsg]);
            setInputMessage('');
            return;
          }

          // Get current channel info for confirmation
          const currentChannelInfo = categories
            .flatMap(cat => cat.channels || [])
            .find(ch => ch.id === currentChannel);

          if (currentChannelInfo) {
            setPendingDeleteChannel({
              id: currentChannel,
              name: currentChannelInfo.name,
              requestedBy: userId
            });
            
            const confirmMsg = {
              id: `delete_confirm_${Date.now()}`,
              username: 'SYSTEM',
              content: `⚠️ Are you sure you want to delete channel "#${currentChannelInfo.name}"? This action cannot be undone. Type "y" to confirm or "n" to cancel.`,
              timestamp: new Date(),
              channel: currentChannel
            };
            setLocalMessages(prev => [...prev, confirmMsg]);
          } else {
            const errorMsg = {
              id: `error_${Date.now()}`,
              username: 'SYSTEM',
              content: 'Error: Could not find current channel information.',
              timestamp: new Date(),
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
                        channel: currentChannel
              };
              setMessages(prev => [...prev, errorMsg]);
            } else {
              const successMsg = {
                id: `success_${Date.now()}`,
                username: 'SYSTEM',
                content: `${targetUsername} has been assigned the role "${roleName}"`,
                timestamp: new Date(),
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
        channel: currentChannel
      };

      // Add message to local state immediately for sender
      setMessages(prev => [...prev, message]);
      
      // Auto-scroll to bottom after message is added
      setTimeout(() => {
        const chatArea = document.querySelector('.chat-area');
        if (chatArea) {
          chatArea.scrollTop = chatArea.scrollHeight;
        }
      }, 0);

      // Send via broadcast for instant delivery to others
      await channel.send({
        type: 'broadcast',
        event: 'message',
        payload: message
      });

      // Also save to database
      const { data: insertedMessage } = await supabase
        .from('messages')
        .insert({
          channel_id: currentChannel,
          user_id: userId,
          username: username,
          content: trimmedInput,
          message_type: 'message'
        })
        .select()
        .single();

      // Detect and store mentions
      if (insertedMessage) {
        await detectAndStoreMentions(trimmedInput, insertedMessage.id);
      }

      setInputMessage('');
      
      // Reset textarea height
      setTimeout(() => {
        const textarea = document.querySelector('textarea');
        if (textarea) {
          textarea.style.height = 'auto';
          textarea.style.height = '1.25rem';
        }
      }, 0);
    }
  };

  const markMentionsAsRead = async (channelId: string) => {
    if (!userId) return;
    
    await supabase
      .from('mentions')
      .update({ is_read: true })
      .eq('channel_id', channelId)
      .eq('mentioned_user_id', userId)
      .eq('is_read', false);
    
    // Update local state
    setUnreadMentions(prev => {
      const updated = { ...prev };
      delete updated[channelId];
      return updated;
    });
  };

  const switchChannel = async (channelId: string, updateUrl: boolean = true) => {
    console.log('switchChannel called with:', channelId, 'current:', currentChannel);
    
    // Find channel name from categories before starting join process
    let channelName = 'unknown-channel';
    for (const category of categories) {
      const channel = category.channels?.find(c => c.id === channelId);
      if (channel) {
        channelName = channel.name;
        break;
      }
    }
    
    // Update URL to reflect current channel (using hash to minimize favicon requests)
    if (updateUrl) {
      const newUrl = channelName !== 'unknown-channel' ? `/#${channelName}` : '/';
      window.history.replaceState({}, '', newUrl);
    }
    
    console.log('Setting currentChannel to:', channelId);
    
    // Don't update currentChannel immediately to prevent jiggling
    // setCurrentChannel(channelId);
    
    // Batch non-critical UI updates to prevent jiggling
    startTransition(() => {
      setMessages([]); // Clear messages when switching
      setUsers([]); // Clear users when switching
      setLocalMessages([]); // Clear local messages when switching
      setPendingDeleteChannel(null); // Clear pending delete when switching
      setJoinStatus('joining'); // Set joining status
      setJoiningChannelName(channelName); // Store channel name for status messages
    });
    
    // Mark mentions as read in this channel
    await markMentionsAsRead(channelId);
    
    try {
      // OPTIMIZED: Bundle channel data queries in parallel
      const [channelResult, messagesResult] = await Promise.all([
        // Channel info
        supabase
          .from('channels')
          .select('name, topic, motd')
          .eq('id', channelId)
          .single(),
        
        // Recent messages  
        supabase
          .from('messages')
          .select('*')
          .eq('channel_id', channelId)
          .order('created_at', { ascending: true })
          .limit(50)
      ]);

      if (channelResult.error) {
        console.error('Error fetching channel:', channelResult.error);
        setJoinStatus('failed');
        return;
      }

    // Process channel data
    const channelData = channelResult.data;
    
    // Batch channel data updates to prevent re-renders
    startTransition(() => {
      if (channelData?.motd) {
        setCurrentMotd(channelData.motd.toUpperCase());
      } else {
        setCurrentMotd('WELCOME TO THE RETRO IRC EXPERIENCE');
      }
      
      if (channelData?.topic) {
        setCurrentTopic(channelData.topic);
      } else {
        setCurrentTopic('');
      }

      // Process messages
      if (messagesResult.data) {
        const formattedMessages = messagesResult.data.map(msg => ({
          id: msg.id,
          username: msg.username,
          content: msg.content,
          timestamp: new Date(msg.created_at),
          channel: channelId
        }));
        setMessages(formattedMessages);
      }
    });
    
    // Only authenticated users join as members and track presence
    if (authUser) {
      await joinChannelAsMember(channelId);
    }
    
    // All users fetch channel members for role colors (after joining for authenticated users)
    await fetchChannelMembers(channelId);
    
      // All users (including lurkers) can join realtime channel for messages
      await joinChannel(channelId);
      
      // Set success status if we made it this far
      setJoinStatus('success');
      
      // Only update currentChannel when everything is loaded to prevent jiggling
      setCurrentChannel(channelId);
    } catch (error) {
      console.error('Error switching channel:', error);
      setJoinStatus('failed');
      // Still update currentChannel even on error to show something
      setCurrentChannel(channelId);
    }
  };

  // Handle URL channel selection when categories are loaded
  useEffect(() => {
    // Get channel name from hash (from #tech format)
    const urlChannelName = window.location.hash.slice(1) || '';
    console.log('URL channel name from hash:', urlChannelName, 'Categories loaded:', categories.length);
    
    if (urlChannelName && categories.length > 0) {
      // Try to find channel by name from URL
      let foundChannelId = '';
      for (const category of categories) {
        const channel = category.channels?.find(c => c.name === urlChannelName);
        if (channel) {
          foundChannelId = channel.id;
          console.log('Found channel:', channel.name, 'ID:', foundChannelId);
          break;
        }
      }
      
      if (foundChannelId && foundChannelId !== currentChannel) {
        console.log('Switching to channel:', foundChannelId);
        switchChannel(foundChannelId, false); // Don't update URL when coming from URL
      }
    }
  }, [categories, currentChannel]);

  // Listen for hash changes (browser back/forward)
  useEffect(() => {
    const handleHashChange = () => {
      const urlChannelName = window.location.hash.slice(1) || '';
      if (urlChannelName && categories.length > 0) {
        for (const category of categories) {
          const channel = category.channels?.find(c => c.name === urlChannelName);
          if (channel && channel.id !== currentChannel) {
            switchChannel(channel.id, false);
            break;
          }
        }
      }
    };

    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, [categories, currentChannel]);

  const handleAuthSuccess = (user: { id: string; username: string }) => {
    setAuthUser(user);
    setUsername(user.username);  // AuthModal flattens the structure
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
    if (!currentChannel) return 'no-channel';
    
    for (const category of categories) {
      const channel = category.channels?.find(c => c.id === currentChannel);
      if (channel) return channel.name;
    }
    return 'unknown-channel';
  };

  const fetchChannelMembers = async (channelId: string) => {
    // Fetch channel members for all users (including lurkers) to get role colors

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

      // Set current user's role and permissions only if authenticated
      if (authUser && userId) {
        const currentUserMember = members.find(m => m.user_id === userId);
        if (currentUserMember?.channel_role) {
          setUserRole(currentUserMember.channel_role.name);
          setUserPermissions(currentUserMember.channel_role.permissions);
        } else {
          // Fallback to legacy role field if no channel_role
          if (currentUserMember?.role) {
            // Convert legacy role to proper case
            const legacyRole = currentUserMember.role;
            const properRole = legacyRole === 'owner' ? 'Owner' : 
                              legacyRole === 'moderator' ? 'Moderator' :
                              legacyRole === 'admin' ? 'Admin' : 'Member';
            setUserRole(properRole);
            setUserPermissions(legacyRole === 'owner' ? {can_kick: true, can_ban: true, can_manage_roles: true} : {});
          } else {
            setUserRole('Member');
            setUserPermissions({});
          }
        }
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

  const getUserRoleColor = (username: string) => {
    // Only show role-based colors if we have loaded channel members for the current channel
    const member = channelMembers.find(m => m.username.toLowerCase() === username.toLowerCase());
    if (member) {
      return getRoleColor(member);
    }
    
    // If we haven't loaded channel members yet, return a loading state
    if (channelMembers.length === 0) {
      return 'text-gray-400'; // Neutral color while loading
    }
    
    // Always use consistent fallback colors (not loading-based)
    // This prevents flashing between different colors
    const userColors = ['text-yellow-400', 'text-cyan-400', 'text-purple-400', 'text-red-400', 'text-green-300', 'text-blue-400'];
    const colorIndex = username.charCodeAt(0) % userColors.length;
    return userColors[colorIndex];
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

    // Filter commands based on user permissions and role
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

    // Check if we're typing a color for /createrole
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
          
          // Check if we're selecting a color for /createrole
          if (inputMessage.includes('/createrole ') && !selectedCommand.command.includes(' ')) {
            // This is a color selection
            const parts = inputMessage.split(' ');
            if (parts.length === 3) {
              // Replace the partial color with the selected color
              const newMessage = `${parts[0]} ${parts[1]} ${selectedCommand.command}`;
              setInputMessage(newMessage);
            } else {
              // Add the color to the command
              setInputMessage(inputMessage + selectedCommand.command);
            }
          } else {
            // Regular command selection
            const commandWithSlash = `/${selectedCommand.command.split(' ')[0]}`;
            setInputMessage(commandWithSlash + ' ');
          }
          
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
    
    // Check if we're selecting a color for /createrole
    if (inputMessage.includes('/createrole ') && !selectedCommand.command.includes(' ')) {
      // This is a color selection
      const parts = inputMessage.split(' ');
      if (parts.length === 3) {
        // Replace the partial color with the selected color
        const newMessage = `${parts[0]} ${parts[1]} ${selectedCommand.command}`;
        setInputMessage(newMessage);
      } else {
        // Add the color to the command
        setInputMessage(inputMessage + selectedCommand.command);
      }
    } else {
      // Regular command selection
      const commandWithSlash = `/${selectedCommand.command.split(' ')[0]}`;
      setInputMessage(commandWithSlash + ' ');
    }
    
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
    // Refresh categories and channels data
    fetchCategoriesAndChannels();
  };


  if (showAuthModal) {
    return <AuthModal onAuthSuccess={handleAuthSuccess} />;
  }

  return (
    <div className="h-screen w-screen bg-black text-green-400 font-mono text-xs sm:text-sm overflow-hidden fixed inset-0 flex flex-col">
      {/* Terminal Title */}
      <div className="border-b border-green-400 p-2 flex-shrink-0">
        {/* Header actions */}
        <div className="flex justify-between items-center">
          <div className="flex gap-2">
            {authUser && (
              <>
                <button 
                  onClick={handleCreateCategory}
                  className="text-green-300 hover:text-yellow-400"
                  title="Create Category"
                >
                  [+CAT]
                </button>
                <button 
                  onClick={() => handleCreateChannel()}
                  className="text-green-300 hover:text-yellow-400"
                  title="Create Channel"
                >
                  [+CH]
                </button>
              </>
            )}
          </div>
          
          <div className="flex gap-2">
            {authUser ? (
              <>
                <span className="text-yellow-400">{username.toUpperCase()}</span>
                <button 
                  onClick={handleLogout}
                  className="text-red-400 hover:text-red-300"
                >
                  [LOGOUT]
                </button>
              </>
            ) : (
              <button 
                onClick={() => setShowAuthModal(true)}
                className="text-green-400 hover:text-green-300"
              >
                [LOGIN]
              </button>
            )}
          </div>
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
          <div className="flex gap-2">
            {!authUser && (
              <button 
                onClick={() => setShowAuthModal(true)}
                className="text-green-400 hover:text-green-300"
              >
                [LOGIN]
              </button>
            )}
            <button 
              onClick={() => setShowUsers(!showUsers)}
              className="text-green-300 hover:text-yellow-400"
            >
              [USERS]
            </button>
          </div>
        </div>
      </div>

      <div className="flex flex-1 relative min-h-0">
        {/* Mobile Sidebar Overlay */}
        {showSidebar && (
          <div className="absolute inset-0 bg-black bg-opacity-75 z-20 sm:hidden" onClick={() => setShowSidebar(false)}>
            <div className="w-64 h-full bg-black border-r border-green-400 p-4" onClick={(e) => e.stopPropagation()}>
              <div className="flex justify-between items-center mb-4">
                <div className="text-green-300">CHANNELS:</div>
                <button onClick={() => setShowSidebar(false)} className="text-red-400">[X]</button>
              </div>
              <div className="ml-2">
                {categories.length === 0 ? (
                  <div className="text-gray-400 italic">No categories available</div>
                ) : (
                  categories.map(category => {
                    // Handle universal channels specially - display without category header
                    if (category.id === 'universal') {
                      return category.channels?.map(channel => (
                        <div 
                          key={channel.id}
                          onClick={() => {
                            switchChannel(channel.id);
                            setShowSidebar(false);
                          }}
                          className={`cursor-pointer mb-2 ${
                            currentChannel === channel.id
                              ? 'text-yellow-400'
                              : 'text-cyan-400 hover:text-yellow-400'
                          }`}
                        >
                          <span className="flex items-center justify-between">
                            <span>
                              <span className="w-4 inline-block">{currentChannel === channel.id ? '>' : ''}</span>
                              #{channel.name.toUpperCase()}
                            </span>
                            {unreadMentions[channel.id] && (
                              <span className="bg-red-600 text-white text-xs px-1 py-0.5 rounded ml-2">
                                @{unreadMentions[channel.id]}
                              </span>
                            )}
                          </span>
                        </div>
                      ));
                    }
                    
                    // Handle channels without category - display without category header
                    if (category.id === 'no-category') {
                      return category.channels?.map(channel => (
                        <div 
                          key={channel.id}
                          onClick={() => {
                            switchChannel(channel.id);
                            setShowSidebar(false);
                          }}
                          className={`cursor-pointer mb-1 ${
                            currentChannel === channel.id
                              ? 'text-yellow-400'
                              : 'text-green-400 hover:text-yellow-400'
                          }`}
                        >
                          <span className="flex items-center justify-between">
                            <span>
                              <span className="w-4 inline-block">{currentChannel === channel.id ? '>' : ''}</span>
                              #{channel.name.toUpperCase()}
                            </span>
                            {unreadMentions[channel.id] && (
                              <span className="bg-red-600 text-white text-xs px-1 py-0.5 rounded ml-2">
                                @{unreadMentions[channel.id]}
                              </span>
                            )}
                          </span>
                        </div>
                      ));
                    }
                    
                    // Regular categories
                    return (
                      <div key={category.id}>
                        <div 
                          onClick={() => toggleCategory(category.id)}
                          className="cursor-pointer text-green-300 hover:text-yellow-400 mb-1"
                        >
                          {expandedCategories.has(category.id) ? '[-]' : '[+]'} {category.name.toUpperCase()}
                        </div>
                        {expandedCategories.has(category.id) && (
                          category.channels?.length === 0 ? (
                            <div className="text-gray-400 italic ml-4">No channels in category</div>
                          ) : (
                            category.channels?.map(channel => (
                              <div 
                                key={channel.id}
                                onClick={() => {
                                  switchChannel(channel.id);
                                  setShowSidebar(false);
                                }}
                                className={`cursor-pointer ml-4 ${
                                  currentChannel === channel.id
                                    ? 'text-yellow-400'
                                    : 'text-green-400 hover:text-yellow-400'
                                }`}
                              >
                                <span className="flex items-center justify-between">
                                  <span>
                                    {currentChannel === channel.id ? '> ' : '  '}
                                    #{channel.name.toUpperCase()}
                                  </span>
                                  {unreadMentions[channel.id] && (
                                    <span className="bg-red-600 text-white text-xs px-1 py-0.5 rounded ml-2">
                                      @{unreadMentions[channel.id]}
                                    </span>
                                  )}
                                </span>
                              </div>
                            ))
                          )
                        )}
                      </div>
                    );
                  })
                )}
              </div>
              

            </div>
          </div>
        )}

        {/* Desktop Channel List */}
        <div className="hidden sm:block w-64 lg:w-72 border-r border-green-400 p-4 flex-shrink-0 overflow-auto">
          <div className="mb-4">
            <div className="text-green-300">CHANNELS:</div>
            <div className="ml-2">
              {categories.length === 0 ? (
                <div className="text-gray-400 italic">No categories available</div>
              ) : (
                categories.map(category => {
                  // Handle universal channels specially - display without category header
                  if (category.id === 'universal') {
                    return category.channels?.map(channel => (
                      <div 
                        key={channel.id}
                        onClick={() => switchChannel(channel.id)}
                        className={`cursor-pointer mb-2 ${
                          currentChannel === channel.id
                            ? 'text-yellow-400'
                            : 'text-cyan-400 hover:text-yellow-400'
                        }`}
                      >
                        <span className="flex items-center justify-between">
                          <span>
                            <span className="w-4 inline-block">{currentChannel === channel.id ? '>' : ''}</span>
                            #{channel.name.toUpperCase()}
                          </span>
                          {unreadMentions[channel.id] && (
                            <span className="bg-red-600 text-white text-xs px-1 py-0.5 rounded ml-2">
                              @{unreadMentions[channel.id]}
                            </span>
                          )}
                        </span>
                      </div>
                    ));
                  }
                  
                  // Handle channels without category - display without category header
                  if (category.id === 'no-category') {
                    return category.channels?.map(channel => (
                      <div 
                        key={channel.id}
                        onClick={() => switchChannel(channel.id)}
                        className={`cursor-pointer mb-1 ${
                          currentChannel === channel.id
                            ? 'text-yellow-400'
                            : 'text-green-400 hover:text-yellow-400'
                        }`}
                      >
                        <span className="flex items-center justify-between">
                          <span>
                            <span className="w-4 inline-block">{currentChannel === channel.id ? '>' : ''}</span>
                            #{channel.name.toUpperCase()}
                          </span>
                          {unreadMentions[channel.id] && (
                            <span className="bg-red-600 text-white text-xs px-1 py-0.5 rounded ml-2">
                              @{unreadMentions[channel.id]}
                            </span>
                          )}
                        </span>
                      </div>
                    ));
                  }
                  
                  // Regular categories
                  return (
                    <div key={category.id} className="mb-2">
                      <div className="flex justify-between items-center mb-1">
                        <div 
                          onClick={() => toggleCategory(category.id)}
                          className="cursor-pointer text-green-300 hover:text-yellow-400 font-medium flex-1"
                        >
                          {expandedCategories.has(category.id) ? '[-]' : '[+]'} {category.name.toUpperCase()}
                        </div>
                      </div>
                      {expandedCategories.has(category.id) && (
                        category.channels?.length === 0 ? (
                          <div className="text-gray-400 italic ml-4">No channels in category</div>
                        ) : (
                          category.channels?.map(channel => (
                            <div 
                              key={channel.id}
                              onClick={() => switchChannel(channel.id)}
                              className={`cursor-pointer ml-4 ${
                                currentChannel === channel.id
                                  ? 'text-yellow-400'
                                  : 'text-green-400 hover:text-yellow-400'
                              }`}
                            >
                              <span className="flex items-center justify-between">
                                <span>
                                  <span className="w-4 inline-block">{currentChannel === channel.id ? '>' : ''}</span>
                                  #{channel.name.toUpperCase()}
                                </span>
                                {unreadMentions[channel.id] && (
                                  <span className="bg-red-600 text-white text-xs px-1 py-0.5 rounded ml-2">
                                    @{unreadMentions[channel.id]}
                                  </span>
                                )}
                              </span>
                            </div>
                          ))
                        )
                      )}
                    </div>
                  );
                })
              )}
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
          <div className="flex-1 p-2 sm:p-4 overflow-auto chat-area" style={{
            scrollbarWidth: 'thin',
            scrollbarColor: '#1f2937 #000000'
          }}>
            <div className="space-y-1">
              {joinStatus && joiningChannelName && (
                <div className={`hidden sm:block ${
                  joinStatus === 'joining' ? 'text-yellow-400' :
                  joinStatus === 'success' ? 'text-green-400' : 'text-red-400'
                }`}>
                  *** {
                    joinStatus === 'joining' ? `JOINING #${joiningChannelName.toUpperCase()}...` :
                    joinStatus === 'success' ? `JOINED #${joiningChannelName.toUpperCase()} SUCCESSFULLY` :
                    `FAILED TO JOIN #${joiningChannelName.toUpperCase()}`
                  } ***
                </div>
              )}
              {currentTopic && (
                <div className="hidden sm:block text-cyan-400">*** TOPIC: {currentTopic.toUpperCase()} ***</div>
              )}
              <div className="hidden sm:block text-purple-400">*** MOTD: {currentMotd} ***</div>
              {!authUser && (
                <div className="text-yellow-400">*** YOU ARE LURKING - LOGIN TO PARTICIPATE ***</div>
              )}
              {[...messages, ...localMessages].sort((a, b) => 
                new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
              ).map(message => {
                const time = new Date(message.timestamp).toLocaleTimeString('en-US', { hour12: false });
                const userColor = getUserRoleColor(message.username);
                return (
                  <div key={message.id} className="text-green-400 break-words">
                    <span className="hidden sm:inline">{time} </span>&lt;<span className={userColor}>{message.username.toUpperCase()}</span>&gt; {formatMessageContent(message.content.toUpperCase())}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Command Autocomplete */}
          {authUser && showCommandSuggestions && (
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
            {authUser ? (
              <div className="flex items-center">
                <span className="text-green-300 hidden sm:inline">[#{getCurrentChannelName().toUpperCase()}]&gt; </span>
                <span className="text-green-300 sm:hidden">&gt; </span>
                <textarea 
                  value={inputMessage}
                  onChange={(e) => handleInputChange(e.target.value)}
                  onKeyDown={handleKeyDown}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey && !showCommandSuggestions) {
                      e.preventDefault();
                      sendMessage();
                    }
                  }}
                  className="flex-1 bg-transparent text-green-400 outline-none ml-2 placeholder-gray-600 resize-none overflow-y-auto flex items-center"
                  placeholder={userRole === 'owner' || userRole === 'moderator' ? "TYPE MESSAGE OR COMMAND (/help for commands)..." : "TYPE MESSAGE..."}
                  rows={1}
                  style={{
                    minHeight: '1.25rem',
                    maxHeight: '6rem',
                    scrollbarWidth: 'thin',
                    scrollbarColor: '#1f2937 #000000',
                    paddingTop: '0.125rem',
                    paddingBottom: '0.125rem'
                  }}
                  onInput={(e) => {
                    const target = e.target as HTMLTextAreaElement;
                    target.style.height = 'auto';
                    target.style.height = Math.min(target.scrollHeight, 96) + 'px';
                  }}
                />
              </div>
            ) : (
              <div className="flex justify-center">
                <button 
                  onClick={() => setShowAuthModal(true)}
                  className="text-yellow-400 hover:text-yellow-300 text-center"
                >
                  *** LOGIN TO CHAT ***
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Mobile Users Overlay */}
        {showUsers && (
          <div className="absolute inset-0 bg-black bg-opacity-75 z-20 sm:hidden" onClick={() => setShowUsers(false)}>
            <div className="w-48 h-full bg-black border-l border-green-400 p-4 ml-auto" onClick={(e) => e.stopPropagation()}>
              {(() => {
                const currentChannelName = getCurrentChannelName();
                const isGlobalChannel = currentChannelName === 'global';
                const displayUsers = users;
                const userCount = displayUsers.length;
                
                return (
                  <>
                    <div className="flex justify-between items-center mb-4">
                      <div className="text-green-300">
                        USERS ({userCount}):
                      </div>
                      <button onClick={() => setShowUsers(false)} className="text-red-400">[X]</button>
                    </div>
                    <div className="space-y-1">
                      {displayUsers.map((user, index) => {
                        const member = channelMembers.find(m => m.user_id === user.id);
                        const roleColor = member ? getRoleColor(member) : 'text-green-400';
                        
                        return (
                          <div key={`mobile-user-${user.id}-${index}`} className={roleColor}>
                            {user.username.toUpperCase()}
                          </div>
                        );
                      })}
                    </div>
                  </>
                );
              })()}
            </div>
          </div>
        )}

        {/* Desktop User List */}
        <div className="hidden lg:block w-64 lg:w-72 border-l border-green-400 p-4 flex-shrink-0 overflow-auto user-list" style={{
          scrollbarWidth: 'thin',
          scrollbarColor: '#1f2937 #000000'
        }}>
          {(() => {
            const currentChannelName = getCurrentChannelName();
            const isGlobalChannel = currentChannelName === 'global';
            // For global channel, show users from regular channel - same as other channels for now
            const displayUsers = users;
            const userCount = displayUsers.length;
            
            return (
              <>
                <div className="text-green-300 mb-4">
                  USERS ({userCount}):
                </div>
                <div className="space-y-1">
                  {displayUsers.map((user, index) => {
                    const member = channelMembers.find(m => m.user_id === user.id);
                    const roleColor = member ? getRoleColor(member) : 'text-green-400';
                    
                    return (
                      <div key={`desktop-user-${user.id}-${index}`} className={roleColor}>
                        {user.username.toUpperCase()}
                      </div>
                    );
                  })}
                </div>
              </>
            );
          })()}
        </div>
      </div>

      {/* Bottom Status */}
      <div className="border-t border-green-400 p-2 flex justify-end flex-shrink-0">
        <div className="text-xs">
          {connected ? 'CONNECTED' : 'DISCONNECTED'}
        </div>
      </div>

      {/* Modals */}
      {showCreateCategoryModal && (
        <CreateCategoryModal
          onClose={() => setShowCreateCategoryModal(false)}
          onSuccess={handleCreationSuccess}
        />
      )}

      {showCreateChannelModal && (
        <CreateChannelModal
          categoryId={selectedCategoryForChannel}
          categories={categories}
          onClose={() => setShowCreateChannelModal(false)}
          onSuccess={handleCreationSuccess}
        />
      )}

    </div>
  );
}

export default function Home() {
  return (
    <Suspense fallback={<div className="h-screen bg-black text-green-400 flex items-center justify-center">Loading...</div>}>
      <HomeContent />
    </Suspense>
  );
}

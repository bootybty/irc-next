import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import type { RealtimeChannel } from '@supabase/supabase-js';
import type { Message, User, AuthUser, ChannelMember } from '@/types';

export const useChat = (
  currentChannel: string,
  userId: string,
  username: string,
  authUser: AuthUser | null,
  channelMembers: ChannelMember[],
  setCurrentMotd: (motd: string) => void,
  fetchChannelMembers: (channelId: string) => void
) => {
  const [channel, setChannel] = useState<RealtimeChannel | null>(null);
  const [connected, setConnected] = useState(false);
  const [broadcastChannel, setBroadcastChannel] = useState<BroadcastChannel | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [localMessages, setLocalMessages] = useState<Message[]>([]);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [hasNewMessages, setHasNewMessages] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMoreMessages, setHasMoreMessages] = useState(true);
  const [loadedChannels, setLoadedChannels] = useState<Set<string>>(new Set());
  const [isBanned, setIsBanned] = useState<{banned: boolean, reason?: string}>({banned: false});
  const [isSiteBanned, setIsSiteBanned] = useState<{banned: boolean, reason?: string}>({banned: false});

  // Smart scroll behavior functions
  const scrollToBottom = useCallback((force = false) => {
    const chatArea = document.querySelector('.chat-area');
    if (chatArea && (force || isAtBottom)) {
      chatArea.scrollTop = chatArea.scrollHeight;
      setHasNewMessages(false);
    }
  }, [isAtBottom]);

  // Wait for DOM to be ready and then scroll
  const scrollToBottomWhenReady = useCallback((force = false) => {
    const chatArea = document.querySelector('.chat-area');
    if (!chatArea) return;

    const initialHeight = chatArea.scrollHeight;
    
    const checkAndScroll = () => {
      const currentHeight = chatArea.scrollHeight;
      
      // If height hasn't changed yet, DOM isn't ready - wait a bit more
      if (currentHeight === initialHeight) {
        requestAnimationFrame(checkAndScroll);
        return;
      }
      
      // DOM has updated, now we can scroll
      if (force || isAtBottom) {
        chatArea.scrollTop = chatArea.scrollHeight;
        setHasNewMessages(false);
      }
    };
    
    // Start checking after one frame
    requestAnimationFrame(checkAndScroll);
  }, [isAtBottom]);

  const loadMoreMessages = useCallback(async (channelId: string) => {
    // Simple guards
    if (isLoadingMore || !hasMoreMessages) {
      return;
    }
    
    setIsLoadingMore(true);
    
    // Get oldest message timestamp
    const oldestMessage = messages[0];
    if (!oldestMessage) {
      setIsLoadingMore(false);
      return;
    }
    
    // Use created_at if available, otherwise convert timestamp
    const oldestTimestamp = oldestMessage.created_at || oldestMessage.timestamp.toISOString();
    
    // Store scroll position for later adjustment
    const chatArea = document.querySelector('.chat-area');
    const oldScrollHeight = chatArea?.scrollHeight || 0;
    const oldScrollTop = chatArea?.scrollTop || 0;
    
    // Find the first visible message element before loading
    const messageElements = chatArea?.querySelectorAll('.message-item');
    let firstVisibleMessage = null;
    let firstVisibleOffset = 0;
    
    if (messageElements && chatArea) {
      for (const elem of messageElements) {
        const rect = elem.getBoundingClientRect();
        const chatRect = chatArea.getBoundingClientRect();
        if (rect.top >= chatRect.top) {
          firstVisibleMessage = elem;
          firstVisibleOffset = rect.top - chatRect.top;
          break;
        }
      }
    }
    
    try {
      
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('channel_id', channelId)
        .lt('created_at', oldestTimestamp)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;

      if (data && data.length > 0) {
        // Format and add messages
        const newMessages = data.reverse().map(msg => ({
          id: msg.id,
          username: msg.username,
          content: msg.content,
          timestamp: new Date(msg.created_at),
          channel: channelId,
          created_at: msg.created_at  // Keep original for queries
        }));
        
        // Add to beginning of array
        setMessages(prev => [...newMessages, ...prev]);
        
        // If we got less than 50, there are no more messages
        if (data.length < 50) {
          setHasMoreMessages(false);
        }
        
        // Maintain scroll position - keep viewing the same messages
        requestAnimationFrame(() => {
          if (chatArea) {
            // Try to find the same message that was visible before
            if (firstVisibleMessage) {
              const rect = firstVisibleMessage.getBoundingClientRect();
              const chatRect = chatArea.getBoundingClientRect();
              const currentOffset = rect.top - chatRect.top;
              const scrollAdjustment = currentOffset - firstVisibleOffset;
              chatArea.scrollTop += scrollAdjustment;
            } else {
              // Fallback to height-based adjustment
              const newScrollHeight = chatArea.scrollHeight;
              const heightAdded = newScrollHeight - oldScrollHeight;
              chatArea.scrollTop = oldScrollTop + heightAdded;
            }
          }
        });
      } else {
        // No more messages
        setHasMoreMessages(false);
      }
    } catch {
      // Error loading more messages
    }
    
    setIsLoadingMore(false);
  }, [messages, isLoadingMore, hasMoreMessages]);

  const checkScrollPosition = useCallback(() => {
    const chatArea = document.querySelector('.chat-area');
    if (!chatArea) return;

    const scrollTop = chatArea.scrollTop;
    const clientHeight = chatArea.clientHeight;
    const scrollHeight = chatArea.scrollHeight;
    
    // Check if at bottom for auto-scroll new messages
    const isAtBottom = scrollTop + clientHeight >= scrollHeight - 50;
    setIsAtBottom(isAtBottom);
    if (isAtBottom) {
      setHasNewMessages(false);
    }
  }, []);



  const detectAndStoreMentions = async (content: string, messageId: string) => {
    const mentionRegex = /@(\w+)/g;
    const mentions = [];
    let match;
    
    while ((match = mentionRegex.exec(content)) !== null) {
      const mentionedUsername = match[1].toLowerCase();
      mentions.push(mentionedUsername);
    }
    
    if (mentions.length > 0) {
      const { data: members } = await supabase
        .from('channel_members')
        .select('user_id, username')
        .eq('channel_id', currentChannel)
        .in('username', mentions.map(m => m.toLowerCase()));
      
      if (members && members.length > 0) {
        const mentionInserts = members
          .filter(member => member.user_id !== userId)
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

  // formatMessageContent moved to main component due to JSX

  const joinChannel = async (channelId: string) => {
    if (channel) {
      supabase.removeChannel(channel);
    }

    // Setup BroadcastChannel for tab coordination
    if (!broadcastChannel && typeof window !== 'undefined') {
      const bc = new BroadcastChannel(`chat:${userId}`);
      setBroadcastChannel(bc);
      
      bc.onmessage = (event) => {
        const { type, payload } = event.data;
        if (type === 'message' && payload.channel === currentChannel) {
          setMessages(prev => [...prev, payload]);
        }
      };
    }

    const channelName = `channel:${channelId}`;
    const newChannel = supabase.channel(channelName);

    // Track messages we've already added to prevent duplicates
    const processedMessageIds = new Set<string>();

    newChannel.on('broadcast', { event: 'message' }, (payload) => {
      if (payload.payload.username !== username) {
        // Only update messages if this tab is viewing the channel
        if (payload.payload.channel === currentChannel) {
          processedMessageIds.add(payload.payload.id);
          setMessages(prev => [...prev, payload.payload]);
          
          // Check if user is at bottom right now (not from state)
          const chatArea = document.querySelector('.chat-area');
          const isCurrentlyAtBottom = chatArea ? 
            chatArea.scrollTop + chatArea.clientHeight >= chatArea.scrollHeight - 50 : true;
          
          if (!isCurrentlyAtBottom) {
            setHasNewMessages(true);
          } else {
            // Auto-scroll if user is currently at bottom
            scrollToBottomWhenReady();
          }
        }
        
        // Broadcast to other tabs
        if (broadcastChannel) {
          broadcastChannel.postMessage({
            type: 'message',
            payload: payload.payload
          });
        }
      }
    });

    // CRITICAL: Subscribe to database changes for real-time message sync
    // This ensures messages appear even if broadcast is missed
    newChannel.on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `channel_id=eq.${channelId}`
      },
      async (payload) => {
        const newMessage = payload.new;
        
        // Skip processing our own messages (they're already displayed)
        if (newMessage.user_id === userId) {
          return;
        }
        
        // Only process if we haven't seen this message via broadcast
        if (!processedMessageIds.has(newMessage.id)) {
          const message = {
            id: newMessage.id,
            username: newMessage.username,
            content: newMessage.content,
            timestamp: new Date(newMessage.created_at),
            channel: channelId,
            created_at: newMessage.created_at
          };
          
          setMessages(prev => {
            // Double-check for duplicates in current state
            const exists = prev.some(m => m.id === message.id);
            if (exists) return prev;
            return [...prev, message];
          });
          
          // Check if user is at bottom right now (not from state)
          const chatArea = document.querySelector('.chat-area');
          const isCurrentlyAtBottom = chatArea ? 
            chatArea.scrollTop + chatArea.clientHeight >= chatArea.scrollHeight - 50 : true;
          
          if (!isCurrentlyAtBottom) {
            setHasNewMessages(true);
          } else {
            // Auto-scroll if user is currently at bottom
            scrollToBottomWhenReady();
          }
          
          // Broadcast to other tabs
          if (broadcastChannel) {
            broadcastChannel.postMessage({
              type: 'message',
              payload: message
            });
          }
          
          // NO AUTO-FETCH: Mentions are only updated on manual actions
          // to save bandwidth and API calls
        }
      }
    );

    newChannel.on('broadcast', { event: 'moderation' }, () => {
      fetchChannelMembers(channelId);
    });

    newChannel.on('broadcast', { event: 'user_banned' }, (payload) => {
      const banData = payload.payload;
      
      // If current user is the one being banned, show notification but don't kick them
      if (banData.bannedUserId === userId) {
        const banMsg = {
          id: `ban_${Date.now()}`,
          username: 'SYSTEM',
          content: `You have been banned from this channel by ${banData.bannedBy}. Reason: ${banData.reason}`,
          timestamp: new Date(),
          channel: channelId
        };
        setMessages(prev => [...prev, banMsg]);
        
        // Update cached ban status immediately (no database query needed!)
        setIsBanned({
          banned: true,
          reason: banData.reason
        });
      }
      
      // No need to fetch channel members since banned users remain in channel
    });

    newChannel.on('broadcast', { event: 'user_unbanned' }, (payload) => {
      const unbanData = payload.payload;
      
      // If current user is the one being unbanned, update cache and show notification
      if (unbanData.unbannedUserId === userId) {
        const unbanMsg = {
          id: `unban_${Date.now()}`,
          username: 'SYSTEM',
          content: `You have been unbanned from this channel by ${unbanData.unbannedBy}`,
          timestamp: new Date(),
          channel: channelId
        };
        setMessages(prev => [...prev, unbanMsg]);
        
        // Update cached ban status immediately (no database query needed!)
        setIsBanned({
          banned: false
        });
      }
    });

    newChannel.on('broadcast', { event: 'motd_update' }, (payload) => {
      setCurrentMotd(payload.payload.motd.toUpperCase());
      
      const motdMsg = {
        id: `motd_update_${Date.now()}`,
        username: 'SYSTEM',
        content: `MOTD updated by ${payload.payload.set_by}: ${payload.payload.motd}`,
        timestamp: new Date(),
        channel: channelId
      };
      setMessages(prev => [...prev, motdMsg]);
    });

    newChannel.on('broadcast', { event: 'user_site_banned' }, (payload) => {
      const siteBanData = payload.payload;
      
      // If current user is the one being site banned, update cache and show notification
      if (siteBanData.bannedUserId === userId) {
        const siteBanMsg = {
          id: `siteban_${Date.now()}`,
          username: 'SYSTEM',
          content: `You have been banned from the entire site by ${siteBanData.bannedBy}. Reason: ${siteBanData.reason}`,
          timestamp: new Date(),
          channel: channelId
        };
        setMessages(prev => [...prev, siteBanMsg]);
        
        // Update cached site ban status immediately
        setIsSiteBanned({
          banned: true,
          reason: siteBanData.reason
        });
      }
    });

    newChannel.on('broadcast', { event: 'user_site_unbanned' }, (payload) => {
      const unbanData = payload.payload;
      
      // If current user is the one being unbanned, update cache and show notification
      if (unbanData.unbannedUserId === userId) {
        const unbanMsg = {
          id: `siteunban_${Date.now()}`,
          username: 'SYSTEM',
          content: `You have been unbanned from the site by ${unbanData.unbannedBy}`,
          timestamp: new Date(),
          channel: channelId
        };
        setMessages(prev => [...prev, unbanMsg]);
        
        // Update cached site ban status immediately
        setIsSiteBanned({
          banned: false
        });
      }
    });

    newChannel.on('broadcast', { event: 'typing' }, () => {
      // Handle typing indicator if needed
    });

    newChannel.on('presence', { event: 'sync' }, () => {
      const presenceState = newChannel.presenceState();
      const allConnections = Object.values(presenceState).flat() as unknown as User[];
      
      const uniqueUsers = allConnections.reduce((unique: User[], user) => {
        const existingUser = unique.find(u => u.id === user.id);
        if (!existingUser) {
          unique.push(user);
        }
        return unique;
      }, []);
      
      const usersWithRoles = uniqueUsers.map(user => {
        const member = channelMembers.find(m => m.user_id === user.id);
        return {
          ...user,
          role: member?.role || 'member'
        };
      });
      
      setUsers(usersWithRoles);
    });

    newChannel.on('presence', { event: 'join' }, () => {
      // Presence sync will handle updating the users list
    });

    newChannel.on('presence', { event: 'leave' }, () => {
      // Presence sync will handle updating the users list
    });

    newChannel.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        setConnected(true);
        
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

  const sendMessage = async (
    content: string,
    handleCommand: (command: string, args: string[]) => Promise<boolean>
  ) => {
    if (channel && content.trim() && authUser) {
      const trimmedInput = content.trim();
      
      // Input length validation (5000 character limit)
      if (trimmedInput.length > 5000) {
        const errorMsg = {
          id: `error_${Date.now()}`,
          username: 'SYSTEM',
          content: 'ERROR: Message exceeds maximum length of 5000 characters',
          timestamp: new Date(),
          channel: currentChannel
        };
        setMessages(prev => [...prev, errorMsg]);
        return false;
      }

      if (trimmedInput.startsWith('/')) {
        const parts = trimmedInput.slice(1).split(' ');
        const command = parts[0].toLowerCase();
        const args = parts.slice(1);

        const handled = await handleCommand(command, args);
        if (handled) {
          return true;
        }
      }

      // Check if user is site banned (global mute)
      if (isSiteBanned.banned) {
        const siteBanMsg = {
          id: `siteban_error_${Date.now()}`,
          username: 'SYSTEM',
          content: `You are banned from the entire site and cannot send messages anywhere. Reason: ${isSiteBanned.reason || 'No reason provided'}`,
          timestamp: new Date(),
          channel: currentChannel
        };
        setMessages(prev => [...prev, siteBanMsg]);
        return true; // Message handled (blocked)
      }

      // Check if user is banned using cached status (no database query!)
      if (isBanned.banned) {
        const banMsg = {
          id: `ban_error_${Date.now()}`,
          username: 'SYSTEM',
          content: `You are banned from this channel and cannot send messages. Reason: ${isBanned.reason || 'No reason provided'}`,
          timestamp: new Date(),
          channel: currentChannel
        };
        setMessages(prev => [...prev, banMsg]);
        return true; // Message handled (blocked)
      }

      // Create temporary message with a unique temporary ID
      const tempId = `temp_${Date.now()}_${Math.random()}`;
      const message = {
        id: tempId,
        username: username,
        content: trimmedInput,
        timestamp: new Date(),
        channel: currentChannel,
        isTemp: true  // Mark as temporary
      };

      setMessages(prev => [...prev, message]);
      
      // Wait for DOM to update and then scroll
      scrollToBottomWhenReady(true);

      // Insert into database first to get the real ID
      const { data: insertedMessage, error: insertError } = await supabase
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

      if (insertError) {
        // Remove temporary message on error
        setMessages(prev => prev.filter(m => m.id !== tempId));
        const errorMsg = {
          id: `error_${Date.now()}`,
          username: 'SYSTEM',
          content: 'ERROR: Failed to send message',
          timestamp: new Date(),
          channel: currentChannel
        };
        setMessages(prev => [...prev, errorMsg]);
        return false;
      }

      // Update the temporary message with the real ID
      if (insertedMessage) {
        setMessages(prev => prev.map(m => 
          m.id === tempId 
            ? { ...m, id: insertedMessage.id, isTemp: false }
            : m
        ));

        // Send broadcast with real message ID
        await channel.send({
          type: 'broadcast',
          event: 'message',
          payload: {
            id: insertedMessage.id,
            username: username,
            content: trimmedInput,
            timestamp: new Date(insertedMessage.created_at),
            channel: currentChannel,
            created_at: insertedMessage.created_at
          }
        });

        await detectAndStoreMentions(trimmedInput, insertedMessage.id);
      }

      return true;
    }
    return false;
  };

  const loadChannelMessages = useCallback(async (channelId: string) => {
    // Dynamic message limit based on viewport height
    const viewportHeight = typeof window !== 'undefined' ? window.innerHeight : 800;
    const estimatedMessagesVisible = Math.ceil(viewportHeight / 30); // Assuming ~30px per message
    const messageLimit = Math.min(Math.max(estimatedMessagesVisible * 2, 30), 100); // Between 30-100 messages
    
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .eq('channel_id', channelId)
      .order('created_at', { ascending: false })
      .limit(messageLimit);

    if (error) {
      return;
    }

    if (data) {
      const messages = data.reverse().map(msg => ({
        id: msg.id,
        username: msg.username,
        content: msg.content,
        timestamp: new Date(msg.created_at),
        channel: channelId,
        created_at: msg.created_at  // Keep original for queries
      }));
      
      setMessages(messages);
      // If we got max messages, there might be more
      setHasMoreMessages(data.length === messageLimit);
      
      // Auto-scroll to bottom on first load
      if (!loadedChannels.has(channelId)) {
        setLoadedChannels(prev => new Set([...prev, channelId]));
        scrollToBottomWhenReady(true);
      }
    }
  }, [loadedChannels, scrollToBottomWhenReady]);

  const clearMessages = () => {
    setMessages([]);
    setUsers([]);
    setLocalMessages([]);
    setIsAtBottom(true);
    setHasNewMessages(false);
    setIsLoadingMore(false);
    setHasMoreMessages(true);
    // Keep loadedChannels - don't reset so we don't auto-scroll when switching back
  };

  const checkBanStatus = useCallback(async () => {
    if (!userId || !currentChannel) {
      setIsBanned({banned: false});
      return;
    }

    try {
      const { data: banData } = await supabase
        .from('channel_bans')
        .select('reason')
        .eq('channel_id', currentChannel)
        .eq('user_id', userId)
        .maybeSingle();

      setIsBanned({
        banned: !!banData,
        reason: banData?.reason
      });
    } catch (error) {
      console.error('Error checking ban status:', error);
      setIsBanned({banned: false});
    }
  }, [userId, currentChannel]);

  const checkSiteBanStatus = useCallback(async () => {
    if (!userId) {
      setIsSiteBanned({banned: false});
      return;
    }

    try {
      const { data: siteBanData } = await supabase
        .from('site_bans')
        .select('reason')
        .eq('user_id', userId)
        .is('unbanned_at', null)
        .maybeSingle();

      setIsSiteBanned({
        banned: !!siteBanData,
        reason: siteBanData?.reason
      });
    } catch (error) {
      console.error('Error checking site ban status:', error);
      setIsSiteBanned({banned: false});
    }
  }, [userId]);

  // Check ban status when channel changes
  useEffect(() => {
    checkBanStatus();
  }, [checkBanStatus]);

  // Check site ban status when user changes
  useEffect(() => {
    checkSiteBanStatus();
  }, [checkSiteBanStatus]);

  // Cleanup BroadcastChannel on unmount
  useEffect(() => {
    return () => {
      if (broadcastChannel) {
        broadcastChannel.close();
      }
    };
  }, [broadcastChannel]);

  return {
    channel,
    connected,
    messages,
    setMessages,
    users,
    setUsers,
    localMessages,
    setLocalMessages,
    isAtBottom,
    hasNewMessages,
    isLoadingMore,
    hasMoreMessages,
    joinChannel,
    sendMessage,
    loadChannelMessages,
    loadMoreMessages,
    clearMessages,
    scrollToBottom,
    scrollToBottomWhenReady,
    checkScrollPosition,
    isBanned,
    isSiteBanned
  };
};
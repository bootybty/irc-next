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
    console.log('🎯 loadMoreMessages CALLED with channel:', channelId);
    
    // Simple guards
    if (isLoadingMore || !hasMoreMessages) {
      console.log('❌ Cannot load more:', { 
        isLoadingMore, 
        hasMoreMessages,
        channelId,
        currentChannel,
        messagesLength: messages.length
      });
      return;
    }
    
    setIsLoadingMore(true);
    
    // Get oldest message timestamp - SIMPLE
    const oldestMessage = messages[0];
    if (!oldestMessage) {
      console.log('❌ No messages to load more from');
      setIsLoadingMore(false);
      return;
    }
    
    // Use created_at if available, otherwise convert timestamp
    const oldestTimestamp = oldestMessage.created_at || oldestMessage.timestamp.toISOString();
    console.log('📥 Loading messages older than:', oldestTimestamp, 'Current count:', messages.length);
    console.log('📊 Oldest message details:', { 
      id: oldestMessage.id, 
      created_at: oldestMessage.created_at,
      timestamp: oldestMessage.timestamp,
      username: oldestMessage.username 
    });
    
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
      // SIMPLE query - get 50 older messages
      console.log('🔍 Querying messages with:', {
        channel_id: channelId,
        before: oldestTimestamp,
        currentChannel,
        limit: 50
      });
      
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('channel_id', channelId)
        .lt('created_at', oldestTimestamp)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      
      console.log('📦 Query result:', {
        messagesFound: data?.length || 0,
        firstMessage: data?.[0],
        lastMessage: data?.[data?.length - 1]
      });

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
          console.log('✅ Loaded final batch:', data.length, 'messages');
        } else {
          console.log('✅ Loaded:', data.length, 'messages, more available');
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
              console.log('📏 Scroll adjusted by element position:', {
                scrollAdjustment,
                newScrollTop: chatArea.scrollTop
              });
            } else {
              // Fallback to height-based adjustment
              const newScrollHeight = chatArea.scrollHeight;
              const heightAdded = newScrollHeight - oldScrollHeight;
              chatArea.scrollTop = oldScrollTop + heightAdded;
              console.log('📏 Scroll adjusted by height:', {
                heightAdded,
                newScrollTop: chatArea.scrollTop
              });
            }
          }
        });
      } else {
        // No more messages
        setHasMoreMessages(false);
        console.log('✅ No more messages in database');
      }
    } catch (error) {
      console.error('❌ Load more error:', error);
    }
    
    setIsLoadingMore(false);
  }, [messages, isLoadingMore, hasMoreMessages, currentChannel]);

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

    const channelName = `user:${userId}:main`;
    const newChannel = supabase.channel(channelName);

    newChannel.on('broadcast', { event: 'message' }, (payload) => {
      if (payload.payload.username !== username) {
        // Only update messages if this tab is viewing the channel
        if (payload.payload.channel === currentChannel) {
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

    newChannel.on('broadcast', { event: 'moderation' }, () => {
      fetchChannelMembers(channelId);
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
      // Handle user join if needed
    });

    newChannel.on('presence', { event: 'leave' }, () => {
      // Handle user leave if needed
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

      if (trimmedInput.startsWith('/')) {
        const parts = trimmedInput.slice(1).split(' ');
        const command = parts[0].toLowerCase();
        const args = parts.slice(1);

        const handled = await handleCommand(command, args);
        if (handled) {
          return true;
        }
      }

      const message = {
        id: `msg_${Date.now()}`,
        username: username,
        content: trimmedInput,
        timestamp: new Date(),
        channel: currentChannel
      };

      setMessages(prev => [...prev, message]);
      
      // Wait for DOM to update and then scroll
      scrollToBottomWhenReady(true);

      await channel.send({
        type: 'broadcast',
        event: 'message',
        payload: message
      });

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

      if (insertedMessage) {
        await detectAndStoreMentions(trimmedInput, insertedMessage.id);
      }

      return true;
    }
    return false;
  };

  const loadChannelMessages = useCallback(async (channelId: string) => {
    console.log('📂 Loading initial messages for channel:', channelId);
    
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .eq('channel_id', channelId)
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) {
      console.error('❌ Error loading initial messages:', error);
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
      // If we got 100 messages, there might be more
      setHasMoreMessages(data.length === 100);
      
      console.log('✅ Loaded initial:', data.length, 'messages, hasMore:', data.length === 100);
      
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
    checkScrollPosition
  };
};
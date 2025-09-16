import { useState, useCallback } from 'react';
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
  const [messages, setMessages] = useState<Message[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [localMessages, setLocalMessages] = useState<Message[]>([]);

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

    const channelName = `channel:${channelId}`;
    const newChannel = supabase.channel(channelName);

    newChannel.on('broadcast', { event: 'message' }, (payload) => {
      if (payload.payload.username !== username) {
        setMessages(prev => [...prev, payload.payload]);
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
      
      setTimeout(() => {
        const chatArea = document.querySelector('.chat-area');
        if (chatArea) {
          chatArea.scrollTop = chatArea.scrollHeight;
        }
      }, 0);

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
    const { data: messagesResult } = await supabase
      .from('messages')
      .select('*')
      .eq('channel_id', channelId)
      .order('created_at', { ascending: true })
      .limit(50);

    if (messagesResult) {
      const formattedMessages = messagesResult.map(msg => ({
        id: msg.id,
        username: msg.username,
        content: msg.content,
        timestamp: new Date(msg.created_at),
        channel: channelId
      }));
      setMessages(formattedMessages);
    }
  }, []);

  const clearMessages = () => {
    setMessages([]);
    setUsers([]);
    setLocalMessages([]);
  };

  return {
    channel,
    connected,
    messages,
    setMessages,
    users,
    setUsers,
    localMessages,
    setLocalMessages,
    joinChannel,
    sendMessage,
    loadChannelMessages,
    clearMessages
  };
};
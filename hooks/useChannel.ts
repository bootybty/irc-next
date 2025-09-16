import { useState, useEffect, useCallback, startTransition } from 'react';
import { useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import type { ChannelCategory, ChannelMember, ChannelRole } from '@/lib/supabase';

export const useChannel = (userId: string, username: string, authUser: any) => {
  const searchParams = useSearchParams();
  const [currentChannel, setCurrentChannel] = useState('');
  const [categories, setCategories] = useState<ChannelCategory[]>([]);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [channelMembers, setChannelMembers] = useState<ChannelMember[]>([]);
  const [channelRoles, setChannelRoles] = useState<ChannelRole[]>([]);
  const [userRole, setUserRole] = useState<string>('member');
  const [userPermissions, setUserPermissions] = useState<Record<string, boolean>>({});
  const [currentTopic, setCurrentTopic] = useState<string>('');
  const [currentMotd, setCurrentMotd] = useState<string>('WELCOME TO THE RETRO IRC EXPERIENCE');
  const [joinStatus, setJoinStatus] = useState<'joining' | 'success' | 'failed' | null>(null);
  const [joiningChannelName, setJoiningChannelName] = useState<string>('');
  const [unreadMentions, setUnreadMentions] = useState<Record<string, number>>({});

  const universalChannels = ['global', 'general', 'random', 'tech', 'gaming', 'music', 'news', 'help', 'projects', 'feedback'];

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

  const fetchCategoriesAndChannels = useCallback(async () => {
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
    
    const globalChannel = fetchedUniversalChannels.find(ch => ch.name === 'global');
    const otherUniversalChannels = fetchedUniversalChannels
      .filter(ch => universalChannels.includes(ch.name) && ch.name !== 'global')
      .sort((a, b) => a.name.localeCompare(b.name));
    
    const sortedUniversalChannels = [
      ...(globalChannel ? [globalChannel] : []),
      ...otherUniversalChannels
    ].map(ch => ({ ...ch, created_at: new Date().toISOString() }));
    
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
    
    categories.push(...(categoriesData || []));
    
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
    
    if (userId) {
      fetchUnreadMentions();
    }
    
    if (!currentChannel && categories.length > 0 && !Array.from(searchParams.keys())[0]) {
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
    
    setExpandedCategories(new Set());
  }, [fetchUnreadMentions, userId, currentChannel, searchParams, universalChannels]);

  const fetchChannelMembers = async (channelId: string) => {
    const { data: roles } = await supabase
      .from('channel_roles')
      .select('*')
      .eq('channel_id', channelId)
      .order('sort_order', { ascending: false });

    if (roles) {
      setChannelRoles(roles);
    }

    const { data: members } = await supabase
      .from('channel_members')
      .select(`
        *,
        channel_role:channel_roles(*)
      `)
      .eq('channel_id', channelId);

    if (members) {
      setChannelMembers(members);

      if (authUser && userId) {
        const currentUserMember = members.find(m => m.user_id === userId);
        if (currentUserMember?.channel_role) {
          setUserRole(currentUserMember.channel_role.name);
          setUserPermissions(currentUserMember.channel_role.permissions);
        } else {
          if (currentUserMember?.role) {
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

    const { data: existingMember } = await supabase
      .from('channel_members')
      .select('id')
      .eq('channel_id', channelId)
      .eq('user_id', userId)
      .single();

    if (!existingMember) {
      const { data: memberRole } = await supabase
        .from('channel_roles')
        .select('id')
        .eq('channel_id', channelId)
        .eq('name', 'Member')
        .single();

      await supabase
        .from('channel_members')
        .insert({
          channel_id: channelId,
          user_id: userId,
          username: username,
          role: 'member',
          role_id: memberRole?.id
        });
    }

    await supabase
      .from('channel_members')
      .update({ last_seen: new Date().toISOString() })
      .eq('channel_id', channelId)
      .eq('user_id', userId);
  };

  const markMentionsAsRead = async (channelId: string) => {
    if (!userId) return;
    
    await supabase
      .from('mentions')
      .update({ is_read: true })
      .eq('channel_id', channelId)
      .eq('mentioned_user_id', userId)
      .eq('is_read', false);
    
    setUnreadMentions(prev => {
      const updated = { ...prev };
      delete updated[channelId];
      return updated;
    });
  };

  const switchChannel = async (channelId: string, updateUrl: boolean = true) => {
    console.log('switchChannel called with:', channelId, 'current:', currentChannel);
    
    let channelName = 'unknown-channel';
    for (const category of categories) {
      const channel = category.channels?.find(c => c.id === channelId);
      if (channel) {
        channelName = channel.name;
        break;
      }
    }
    
    if (updateUrl) {
      const newUrl = channelName !== 'unknown-channel' ? `/#${channelName}` : '/';
      window.history.replaceState({}, '', newUrl);
    }
    
    console.log('Setting currentChannel to:', channelId);
    
    startTransition(() => {
      setJoinStatus('joining');
      setJoiningChannelName(channelName);
    });
    
    await markMentionsAsRead(channelId);
    
    try {
      const [channelResult] = await Promise.all([
        supabase
          .from('channels')
          .select('name, topic, motd')
          .eq('id', channelId)
          .single()
      ]);

      if (channelResult.error) {
        console.error('Error fetching channel:', channelResult.error);
        setJoinStatus('failed');
        return;
      }

      const channelData = channelResult.data;
      
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
      });
      
      if (authUser) {
        await joinChannelAsMember(channelId);
      }
      
      await fetchChannelMembers(channelId);
      
      setJoinStatus('success');
      setCurrentChannel(channelId);
      
      return { success: true, channelData };
    } catch (error) {
      console.error('Error switching channel:', error);
      setJoinStatus('failed');
      setCurrentChannel(channelId);
      return { success: false, error };
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

  useEffect(() => {
    const urlChannelName = window.location.hash.slice(1) || '';
    console.log('URL channel name from hash:', urlChannelName, 'Categories loaded:', categories.length);
    
    if (urlChannelName && categories.length > 0) {
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
        switchChannel(foundChannelId, false);
      }
    }
  }, [categories, currentChannel]);

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

  return {
    currentChannel,
    setCurrentChannel,
    categories,
    expandedCategories,
    channelMembers,
    channelRoles,
    userRole,
    userPermissions,
    currentTopic,
    setCurrentTopic,
    currentMotd,
    setCurrentMotd,
    joinStatus,
    joiningChannelName,
    unreadMentions,
    setUnreadMentions,
    fetchCategoriesAndChannels,
    fetchChannelMembers,
    switchChannel,
    toggleCategory,
    getCurrentChannelName,
    getRoleColor
  };
};
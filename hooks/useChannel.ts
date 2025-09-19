import { useState, useEffect, useCallback, startTransition } from 'react';
import { useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useTheme, themes } from '@/components/ThemeProvider';
import { useNotification } from '@/contexts/NotificationContext';
import type { ChannelCategory, ChannelRole } from '@/lib/supabase';
import type { AuthUser, ChannelMember } from '@/types';
import { checkAdminPrivileges } from '@/lib/admin';

// Define universal channels outside component to prevent re-creation
const UNIVERSAL_CHANNELS = ['global', 'general', 'random', 'tech', 'gaming', 'music', 'news', 'help', 'projects', 'feedback'];

export const useChannel = (userId: string, username: string, authUser: AuthUser | null) => {
  const { theme } = useTheme();
  const currentTheme = themes[theme];
  const { showNotification } = useNotification();
  const searchParams = useSearchParams();
  const [currentChannel, setCurrentChannel] = useState('');
  const [categories, setCategories] = useState<ChannelCategory[]>([]);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [channelMembers, setChannelMembers] = useState<ChannelMember[]>([]);
  const [channelRoles, setChannelRoles] = useState<ChannelRole[]>([]);
  const [userRole, setUserRole] = useState<string>('member');
  const [userPermissions, setUserPermissions] = useState<Record<string, boolean>>({});
  const [currentTopic, setCurrentTopic] = useState<string>('');
  const [currentMotd, setCurrentMotd] = useState<string>('');
  const [joinStatus, setJoinStatus] = useState<'joining' | 'success' | 'failed' | null>(null);
  const [joiningChannelName, setJoiningChannelName] = useState<string>('');
  const [unreadMentions, setUnreadMentions] = useState<Record<string, number>>({});
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<number>(0);
  const [isInitialLoading, setIsInitialLoading] = useState(false);
  const [userSubscriptions, setUserSubscriptions] = useState<Record<string, boolean>>({});
  const [displayedChannelCount, setDisplayedChannelCount] = useState(75);


  const fetchUserSubscriptions = useCallback(async () => {
    if (!userId) return;
    
    const { data: subscriptions } = await supabase
      .from('channel_members')
      .select('channel_id, is_subscribed')
      .eq('user_id', userId);
    
    if (subscriptions) {
      const subscriptionMap: Record<string, boolean> = {};
      subscriptions.forEach(sub => {
        subscriptionMap[sub.channel_id] = sub.is_subscribed || false;
      });
      setUserSubscriptions(subscriptionMap);
    }
  }, [userId]);

  const fetchUnreadMentions = useCallback(async () => {
    if (!userId) return;
    
    // Debounce multiple calls
    const now = Date.now();
    if (now - lastRefresh < 5000) return; // Don't fetch more than once per 5 seconds
    
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
  }, [userId, lastRefresh]);

  const fetchUnreadCounts = useCallback(async () => {
    if (!userId) return;
    
    // Debounce multiple calls
    const now = Date.now();
    if (now - lastRefresh < 5000) return; // Don't fetch more than once per 5 seconds
    
    // Get all user's channel memberships with last_seen timestamps
    const { data: memberships } = await supabase
      .from('channel_members')
      .select('channel_id, last_seen')
      .eq('user_id', userId);
    
    if (!memberships || memberships.length === 0) return;
    
    // Get all channel IDs
    const channelIds = memberships.map(m => m.channel_id);
    
    // Get all messages newer than user's last_seen for each channel
    const { data: messages } = await supabase
      .from('messages')
      .select('channel_id, created_at')
      .in('channel_id', channelIds)
      .neq('user_id', userId); // Exclude user's own messages
    
    if (messages) {
      const unreadCounts: Record<string, number> = {};
      
      memberships.forEach(membership => {
        const lastSeen = membership.last_seen || '1970-01-01';
        const unreadMessages = messages.filter(msg => 
          msg.channel_id === membership.channel_id && 
          new Date(msg.created_at) > new Date(lastSeen)
        );
        
        if (unreadMessages.length > 0) {
          unreadCounts[membership.channel_id] = unreadMessages.length;
        }
      });
      
      setUnreadCounts(unreadCounts);
    }
  }, [userId, lastRefresh]);

  // Optimized function to batch multiple API calls for initial load
  const fetchInitialData = useCallback(async () => {
    if (!userId) return;
    
    // Prevent duplicate calls
    if (isInitialLoading) {
      return;
    }
    setIsInitialLoading(true);
    
    // Check if user has admin privileges to see admin channel
    const adminPrivileges = await checkAdminPrivileges(userId);
    const canSeeAdminChannel = adminPrivileges.is_super_admin || adminPrivileges.is_site_admin || adminPrivileges.is_site_moderator;
    
    // Batch multiple queries together to reduce API calls
    const [categoriesResult, uncategorizedResult, universalChannelsResult, membershipsResult, mentionsResult, subscriptionsResult] = await Promise.all([
      // Categories with channels
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
      
      // Uncategorized channels (exclude admin unless user has privileges)
      supabase
        .from('channels')
        .select('id, name, topic, category_id')
        .is('category_id', null)
        .not('name', 'in', `(${UNIVERSAL_CHANNELS.map(ch => `"${ch}"`).join(',')})`)
        .not('name', 'eq', canSeeAdminChannel ? 'never_match_anything' : 'admin'),
      
      // Universal channels
      supabase
        .from('channels')
        .select('id, name, topic, category_id')
        .in('name', UNIVERSAL_CHANNELS),
      
      // User's channel memberships for unread counts
      supabase
        .from('channel_members')
        .select('channel_id, last_seen')
        .eq('user_id', userId),
      
      // User's unread mentions
      supabase
        .from('mentions')
        .select('channel_id')
        .eq('mentioned_user_id', userId)
        .eq('is_read', false),
      
      // User's channel subscriptions
      supabase
        .from('channel_members')
        .select('channel_id, is_subscribed')
        .eq('user_id', userId)
    ]);

    // Process categories and channels
    const categoriesData = categoriesResult.data || [];
    const uncategorizedData = uncategorizedResult.data || [];
    const universalData = universalChannelsResult.data || [];

    const processedCategories = categoriesData.map(cat => ({
      ...cat,
      created_at: new Date().toISOString(),
      channels: cat.channels?.sort((a, b) => a.name.localeCompare(b.name))?.map(ch => ({
        ...ch,
        created_at: new Date().toISOString()
      }))
    }));
    
    if (universalData.length > 0) {
      processedCategories.unshift({
        id: 'universal',
        name: 'UNIVERSAL',
        emoji: '🌍',
        color: '#10b981',
        sort_order: -1,
        channels: universalData.sort((a, b) => {
          if (a.name === 'global') return -1;
          if (b.name === 'global') return 1;
          return a.name.localeCompare(b.name);
        }).map(ch => ({
          ...ch,
          created_at: new Date().toISOString()
        })),
        created_at: new Date().toISOString()
      });
    }
    
    // Separate admin channel into its own category if present
    const adminChannel = uncategorizedData.find(ch => ch.name === 'admin');
    const nonAdminUncategorized = uncategorizedData.filter(ch => ch.name !== 'admin');
    
    if (adminChannel) {
      processedCategories.unshift({
        id: 'admin-category',
        name: 'ADMINISTRATION',
        emoji: '🔐',
        color: '#dc2626',
        sort_order: -2,
        channels: [{
          ...adminChannel,
          created_at: new Date().toISOString()
        }],
        created_at: new Date().toISOString()
      });
    }
    
    if (nonAdminUncategorized.length > 0) {
      processedCategories.push({
        id: 'no-category',
        name: 'NO CATEGORY',
        emoji: '📁',
        color: '#6b7280',
        sort_order: 1000,
        channels: nonAdminUncategorized.sort((a, b) => a.name.localeCompare(b.name)).map(ch => ({
          ...ch,
          created_at: new Date().toISOString()
        })),
        created_at: new Date().toISOString()
      });
    }

    setCategories(processedCategories);

    // Process unread mentions
    if (mentionsResult.data) {
      const mentionCounts: Record<string, number> = {};
      mentionsResult.data.forEach(mention => {
        mentionCounts[mention.channel_id] = (mentionCounts[mention.channel_id] || 0) + 1;
      });
      setUnreadMentions(mentionCounts);
    }

    // Process user subscriptions
    if (subscriptionsResult.data) {
      const subscriptionMap: Record<string, boolean> = {};
      subscriptionsResult.data.forEach(sub => {
        subscriptionMap[sub.channel_id] = sub.is_subscribed || false;
      });
      setUserSubscriptions(subscriptionMap);
    }

    // Process unread counts
    if (membershipsResult.data) {
      const channelIds = membershipsResult.data.map(m => m.channel_id);
      
      if (channelIds.length > 0) {
        const { data: messages } = await supabase
          .from('messages')
          .select('channel_id, created_at')
          .in('channel_id', channelIds)
          .neq('user_id', userId);

        if (messages) {
          const unreadCounts: Record<string, number> = {};
          
          membershipsResult.data.forEach(membership => {
            const lastSeen = membership.last_seen || '1970-01-01';
            const unreadMessages = messages.filter(msg => 
              msg.channel_id === membership.channel_id && 
              new Date(msg.created_at) > new Date(lastSeen)
            );
            
            if (unreadMessages.length > 0) {
              unreadCounts[membership.channel_id] = unreadMessages.length;
            }
          });
          
          setUnreadCounts(unreadCounts);
        }
      }
    }

    setLastRefresh(Date.now());
    setIsInitialLoading(false);
  }, [userId, isInitialLoading]);

  const fetchCategoriesAndChannels = useCallback(async () => {
    // Prevent duplicate calls
    if (isInitialLoading) {
      return;
    }
    setIsInitialLoading(true);
    
    // Check if user has admin privileges to see admin channel
    const adminPrivileges = await checkAdminPrivileges(userId);
    const canSeeAdminChannel = adminPrivileges.is_super_admin || adminPrivileges.is_site_admin || adminPrivileges.is_site_moderator;
    
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
        .not('name', 'in', `(${UNIVERSAL_CHANNELS.map(ch => `"${ch}"`).join(',')})`)
        .not('name', 'eq', canSeeAdminChannel ? 'never_match_anything' : 'admin'),
      
      supabase
        .from('channels')
        .select('id, name, topic, category_id')
        .in('name', UNIVERSAL_CHANNELS)
    ]);

    const categoriesData = categoriesResult.data;
    const uncategorizedChannels = uncategorizedResult.data;
    const fetchedUniversalChannels = universalChannelsResult.data || [];

    if (categoriesResult.error) {
      // console.error('Error fetching categories:', categoriesResult.error);
      return;
    }

    const categories = [];
    
    const globalChannel = fetchedUniversalChannels.find(ch => ch.name === 'global');
    const otherUniversalChannels = fetchedUniversalChannels
      .filter(ch => UNIVERSAL_CHANNELS.includes(ch.name) && ch.name !== 'global')
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
      categories.push(universalCategory);
    }
    
    categories.push(...(categoriesData || []).map(cat => ({
      ...cat,
      // @ts-expect-error Database type mismatch
      created_at: cat.created_at || new Date().toISOString(),
      channels: cat.channels?.sort((a, b) => a.name.localeCompare(b.name))?.map(ch => ({
        ...ch,
        // @ts-expect-error Database type mismatch  
        created_at: ch.created_at || new Date().toISOString()
      }))
    })));
    
    if (uncategorizedChannels && uncategorizedChannels.length > 0) {
      // Separate admin channel into its own category if present
      const adminChannel = uncategorizedChannels.find(ch => ch.name === 'admin');
      const nonAdminUncategorized = uncategorizedChannels.filter(ch => ch.name !== 'admin');
      
      if (adminChannel) {
        const adminCategory: ChannelCategory = {
          id: 'admin-category',
          name: 'ADMINISTRATION',
          emoji: '🔐',
          color: '#dc2626',
          sort_order: -2,
          channels: [{
            ...adminChannel,
            created_at: new Date().toISOString()
          }],
          created_at: new Date().toISOString()
        };
        categories.unshift(adminCategory);
      }
      
      if (nonAdminUncategorized.length > 0) {
        const sortedUncategorized = nonAdminUncategorized
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
        categories.push(uncategorizedCategory);
      }
    }

    setCategories(categories);
    
    if (userId) {
      fetchUnreadMentions();
      fetchUnreadCounts();
    }
    
    // Only set default channel if no URL hash and no current channel
    const urlChannelName = window.location.hash.slice(1) || '';
    if (!currentChannel && categories.length > 0 && !Array.from(searchParams.keys())[0] && !urlChannelName) {
      let globalChannel = null;
      for (const category of categories) {
        if (category.channels && category.channels.length > 0) {
          globalChannel = category.channels.find(ch => ch.name === 'global');
          if (globalChannel) break;
        }
      }
      
      if (globalChannel) {
        switchChannel(globalChannel.id);
      }
    }
    
    setExpandedCategories(new Set());
    setIsInitialLoading(false);
  }, [fetchUnreadMentions, fetchUnreadCounts, userId, currentChannel, searchParams, isInitialLoading]);

  const refreshChannels = useCallback(async () => {
    const now = Date.now();
    const timeSinceLastRefresh = now - lastRefresh;
    
    // Rate limiting: max once per 10 seconds
    if (timeSinceLastRefresh < 10000) {
      return; // Silent ignore - no feedback
    }
    
    setIsRefreshing(true);
    setLastRefresh(now);
    
    try {
      await Promise.all([
        fetchCategoriesAndChannels(),
        fetchUserSubscriptions()
      ]);
      // Show success feedback for 2 seconds
      setTimeout(() => setIsRefreshing(false), 2000);
    } catch (error) {
      console.error('❌ Failed to refresh channels:', error);
      setIsRefreshing(false);
    }
  }, [lastRefresh, fetchCategoriesAndChannels]);

  const fetchChannelMembers = useCallback(async (channelId: string) => {
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
      .select('*')
      .eq('channel_id', channelId)
      .eq('is_subscribed', true);

    if (members) {
      // Fetch custom role data for members who have one
      const membersWithCustomRoles = members.filter(m => m.channel_role_id);
      if (membersWithCustomRoles.length > 0) {
        const roleIds = membersWithCustomRoles.map(m => m.channel_role_id);
        const { data: customRoles } = await supabase
          .from('channel_roles')
          .select('id, name, color, permissions')
          .in('id', roleIds);
        
        if (customRoles) {
          // Add custom role data to members
          const enrichedMembers = members.map(member => {
            if (member.channel_role_id) {
              const customRole = customRoles.find(r => r.id === member.channel_role_id);
              return {
                ...member,
                channel_role: customRole
              };
            }
            return member;
          });
          setChannelMembers(enrichedMembers);
        } else {
          setChannelMembers(members);
        }
      } else {
        setChannelMembers(members);
      }

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
  }, [authUser, userId]);

  const subscribeToChannel = useCallback(async (channelId: string) => {
    if (!authUser || !userId) return { success: false, error: 'Not authenticated' };

    try {
      const { data: existingMember } = await supabase
        .from('channel_members')
        .select('id, is_subscribed')
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

        const { error } = await supabase
          .from('channel_members')
          .insert({
            channel_id: channelId,
            user_id: userId,
            username: username,
            role: 'member',
            channel_role_id: memberRole?.id,
            is_subscribed: true,
            is_active: true,
            last_activity: new Date().toISOString(),
            last_seen: new Date().toISOString()
          });

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('channel_members')
          .update({ 
            is_subscribed: true,
            is_active: true,
            last_activity: new Date().toISOString(),
            last_seen: new Date().toISOString() 
          })
          .eq('channel_id', channelId)
          .eq('user_id', userId);

        if (error) throw error;
      }

      // Update local subscription state
      setUserSubscriptions(prev => ({ ...prev, [channelId]: true }));
      
      // Get channel name for notification
      const channelName = categories.flatMap(cat => cat.channels || [])
        .find(ch => ch.id === channelId)?.name || 'UNKNOWN';
      
      showNotification(`SUCCESSFULLY JOINED #${channelName.toUpperCase()}`);
      
      await fetchChannelMembers(channelId);
      return { success: true };
    } catch (error) {
      console.error('Error subscribing to channel:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }, [authUser, userId, username, fetchChannelMembers, categories, showNotification]);

  const unsubscribeFromChannel = useCallback(async (channelId: string) => {
    if (!authUser || !userId) return { success: false, error: 'Not authenticated' };

    try {
      const { error } = await supabase
        .from('channel_members')
        .update({ 
          is_subscribed: false,
          is_active: false,
          last_activity: new Date().toISOString()
        })
        .eq('channel_id', channelId)
        .eq('user_id', userId);

      if (error) throw error;

      // Update local subscription state
      setUserSubscriptions(prev => ({ ...prev, [channelId]: false }));

      // Get channel name for notification
      const channelName = categories.flatMap(cat => cat.channels || [])
        .find(ch => ch.id === channelId)?.name || 'UNKNOWN';
      
      showNotification(`SUCCESSFULLY LEFT #${channelName.toUpperCase()}`);

      await fetchChannelMembers(channelId);
      return { success: true };
    } catch (error) {
      console.error('Error unsubscribing from channel:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }, [authUser, userId, fetchChannelMembers, categories, showNotification]);

  const joinChannelAsMember = useCallback(async (channelId: string) => {
    if (!authUser || !userId) return;

    await supabase
      .from('channel_members')
      .update({ 
        is_active: true,
        last_activity: new Date().toISOString(),
        last_seen: new Date().toISOString() 
      })
      .eq('channel_id', channelId)
      .eq('user_id', userId)
      .eq('is_subscribed', true);
  }, [authUser, userId]);

  const markMentionsAsRead = useCallback(async (channelId: string) => {
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
  }, [userId]);

  const clearUnreadCount = useCallback((channelId: string) => {
    setUnreadCounts(prev => {
      const updated = { ...prev };
      delete updated[channelId];
      return updated;
    });
  }, []);

  const switchChannel = useCallback(async (channelId: string, updateUrl: boolean = true) => {
    
    let channelName = 'unknown-channel';
    for (const category of categories) {
      const channel = category.channels?.find(c => c.id === channelId);
      if (channel) {
        channelName = channel.name;
        break;
      }
    }
    
    // Security check: prevent access to admin channel for non-admin users
    if (channelName === 'admin') {
      const adminPrivileges = await checkAdminPrivileges(userId);
      const canAccessAdmin = adminPrivileges.is_super_admin || adminPrivileges.is_site_admin || adminPrivileges.is_site_moderator;
      
      if (!canAccessAdmin) {
        console.warn('Access denied: User lacks admin privileges for #admin channel');
        return { success: false, error: 'Access denied to admin channel' };
      }
    }
    
    if (updateUrl) {
      const newUrl = channelName !== 'unknown-channel' ? `/#${channelName}` : '/';
      window.history.replaceState({}, '', newUrl);
    }
    
    
    startTransition(() => {
      setJoinStatus('joining');
      setJoiningChannelName(channelName);
    });
    
    await markMentionsAsRead(channelId);
    clearUnreadCount(channelId);
    
    try {
      const [channelResult] = await Promise.all([
        supabase
          .from('channels')
          .select('name, topic, motd')
          .eq('id', channelId)
          .single()
      ]);

      if (channelResult.error) {
        // console.error('Error fetching channel:', channelResult.error);
        setJoinStatus('failed');
        return;
      }

      const channelData = channelResult.data;
      
      startTransition(() => {
        if (channelData?.motd) {
          setCurrentMotd(channelData.motd.toUpperCase());
        } else {
          // Check if it's a universal channel
          const channelName = categories.flatMap(cat => cat.channels || [])
            .find(ch => ch.id === channelId)?.name;
          
          if (channelName && UNIVERSAL_CHANNELS.includes(channelName)) {
            setCurrentMotd(''); // No MOTD for universal channels
          } else {
            setCurrentMotd('');
          }
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
      // console.error('Error switching channel:', error);
      setJoinStatus('failed');
      setCurrentChannel(channelId);
      return { success: false, error };
    }
  }, [categories, markMentionsAsRead, clearUnreadCount, authUser, fetchChannelMembers, joinChannelAsMember]);

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
    if (!currentChannel) return 'global';
    
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
      case 'owner': return currentTheme.roleOwner;
      case 'moderator':
      case 'admin': return currentTheme.roleModerator; 
      default: return currentTheme.roleDefault;
    }
  };

  const isUserSubscribed = useCallback((channelId: string) => {
    if (!userId) return false;
    return userSubscriptions[channelId] || false;
  }, [userId, userSubscriptions]);

  // Channel pagination functions
  const getAllChannels = useCallback(() => {
    const allChannels = [];
    for (const category of categories) {
      if (category.channels) {
        allChannels.push(...category.channels);
      }
    }
    return allChannels;
  }, [categories]);

  const loadMoreChannels = useCallback(() => {
    const totalChannels = getAllChannels().length;
    setDisplayedChannelCount(prev => Math.min(prev + 50, totalChannels));
  }, [getAllChannels]);

  const hasMoreChannels = displayedChannelCount < getAllChannels().length;

  const getDisplayCategories = useCallback(() => {
    let channelsSoFar = 0;
    const displayCategories = [];
    
    for (const category of categories) {
      if (!category.channels || category.channels.length === 0) {
        displayCategories.push(category);
        continue;
      }
      
      const remainingSlots = displayedChannelCount - channelsSoFar;
      if (remainingSlots <= 0) break;
      
      const channelsToShow = Math.min(category.channels.length, remainingSlots);
      const displayCategory = {
        ...category,
        channels: category.channels.slice(0, channelsToShow)
      };
      
      displayCategories.push(displayCategory);
      channelsSoFar += channelsToShow;
      
      if (channelsSoFar >= displayedChannelCount) break;
    }
    
    return displayCategories;
  }, [categories, displayedChannelCount]);


  useEffect(() => {
    const urlChannelName = window.location.hash.slice(1) || '';
    
    if (urlChannelName && categories.length > 0) {
      let foundChannelId = '';
      for (const category of categories) {
        const channel = category.channels?.find(c => c.name === urlChannelName);
        if (channel) {
          foundChannelId = channel.id;
          break;
        }
      }
      
      if (foundChannelId) {
        // Always switch to URL hash channel, even if already current
        setCurrentChannel(foundChannelId);
      }
    } else if (!urlChannelName && categories.length > 0 && !currentChannel) {
      // No URL hash and no current channel - set default to global
      let globalChannel = null;
      for (const category of categories) {
        if (category.channels && category.channels.length > 0) {
          globalChannel = category.channels.find(ch => ch.name === 'global');
          if (globalChannel) break;
        }
      }
      
      if (globalChannel) {
        switchChannel(globalChannel.id);
      }
    }
  }, [categories, currentChannel, switchChannel]);

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
  }, [categories, currentChannel, switchChannel]);

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

  // Fetch mentions and unread counts when userId becomes available
  useEffect(() => {
    if (userId) {
      fetchUnreadMentions();
      fetchUnreadCounts();
    }
  }, [userId, fetchUnreadMentions, fetchUnreadCounts]);

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
    unreadCounts,
    setUnreadCounts,
    fetchCategoriesAndChannels,
    fetchInitialData,
    refreshChannels,
    isRefreshing,
    fetchChannelMembers,
    switchChannel,
    toggleCategory,
    getCurrentChannelName,
    getRoleColor,
    subscribeToChannel,
    unsubscribeFromChannel,
    isUserSubscribed,
    // Channel pagination
    displayedChannelCount,
    loadMoreChannels,
    hasMoreChannels,
    getDisplayCategories,
    totalChannelCount: getAllChannels().length
  };
};
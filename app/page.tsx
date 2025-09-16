'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { RealtimeChannel } from '@supabase/supabase-js';
import AuthModal from '@/components/AuthModal';
import CreateCategoryModal from '@/components/CreateCategoryModal';
import CreateChannelModal from '@/components/CreateChannelModal';
import type { ChannelCategory } from '@/lib/supabase';

interface User {
  id: string;
  username: string;
  currentServer: string;
  currentChannel: string;
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

    // Listen for typing indicators  
    newChannel.on('broadcast', { event: 'typing' }, (payload) => {
      console.log('User typing:', payload.payload.username);
    });

    // Track online users via presence
    newChannel.on('presence', { event: 'sync' }, () => {
      const presenceState = newChannel.presenceState();
      const onlineUsers = Object.values(presenceState).flat() as User[];
      setUsers(onlineUsers);
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

  const sendMessage = async () => {
    if (channel && inputMessage.trim() && authUser) {
      const message = {
        id: `msg_${Date.now()}`,
        username: username,
        content: inputMessage.trim(),
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
          content: inputMessage.trim(),
          message_type: 'message'
        });

      setInputMessage('');
    }
  };

  const switchChannel = async (serverId: string, channelId: string) => {
    setCurrentServer(serverId);
    setCurrentChannel(channelId);
    setMessages([]); // Clear messages when switching
    
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

          {/* Input Line */}
          <div className="border-t border-green-400 p-2">
            <div className="flex">
              <span className="text-green-300 hidden sm:inline">[#{getCurrentChannelName().toUpperCase()}]&gt; </span>
              <span className="text-green-300 sm:hidden">&gt; </span>
              <input 
                type="text" 
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                className="flex-1 bg-transparent text-green-400 outline-none ml-2 placeholder-gray-600"
                placeholder="TYPE MESSAGE..."
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
                  const userColors = ['text-red-400', 'text-cyan-400', 'text-yellow-400', 'text-green-400', 'text-blue-400', 'text-magenta-400'];
                  const colorIndex = user.username.charCodeAt(0) % userColors.length;
                  const isAdmin = user.username.toLowerCase().includes('admin');
                  const isModerator = user.username.toLowerCase().includes('mod');
                  
                  return (
                    <div key={`mobile-user-${user.id}-${index}`} className={userColors[colorIndex]}>
                      {isAdmin ? '@' : isModerator ? '+' : ''}{user.username.toUpperCase()}
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
              const userColors = ['text-red-400', 'text-cyan-400', 'text-yellow-400', 'text-green-400', 'text-blue-400', 'text-magenta-400'];
              const colorIndex = user.username.charCodeAt(0) % userColors.length;
              const isAdmin = user.username.toLowerCase().includes('admin');
              const isModerator = user.username.toLowerCase().includes('mod');
              
              return (
                <div key={`desktop-user-${user.id}-${index}`} className={userColors[colorIndex]}>
                  {isAdmin ? '@' : isModerator ? '+' : ''}{user.username.toUpperCase()}
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

'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { RealtimeChannel } from '@supabase/supabase-js';

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
  channels: Channel[];
}

interface Channel {
  id: string;
  name: string;
}

export default function Home() {
  const [channel, setChannel] = useState<RealtimeChannel | null>(null);
  const [connected, setConnected] = useState(false);
  const [username, setUsername] = useState('TestUser');
  const [currentServer, setCurrentServer] = useState('general');
  const [currentChannel, setCurrentChannel] = useState('lobby');
  const [servers, setServers] = useState<Server[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isJoined, setIsJoined] = useState(false);
  const [showSidebar, setShowSidebar] = useState(false);
  const [showUsers, setShowUsers] = useState(false);

  useEffect(() => {
    // Fetch servers and channels from Supabase
    const fetchServersAndChannels = async () => {
      const { data: serversData, error: serversError } = await supabase
        .from('servers')
        .select(`
          id,
          name,
          description,
          channels (
            id,
            name,
            topic
          )
        `);

      if (serversError) {
        console.error('Error fetching servers:', serversError);
        return;
      }

      setServers(serversData || []);
    };

    fetchServersAndChannels();

    // Auto-join channel on load
    joinChannel('general', 'lobby');
    setIsJoined(true);

    return () => {
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, []);

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
          id: `user_${Date.now()}`,
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
    if (channel && inputMessage.trim()) {
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

      setInputMessage('');
    }
  };

  const switchChannel = (serverId: string, channelId: string) => {
    setCurrentServer(serverId);
    setCurrentChannel(channelId);
    setMessages([]); // Clear messages when switching
    joinChannel(serverId, channelId);
  };

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
                {servers.map(server => (
                  <div key={server.id}>
                    {server.channels.map(channel => (
                      <div 
                        key={channel.id}
                        onClick={() => {
                          switchChannel(server.id, channel.id);
                          setShowSidebar(false);
                        }}
                        className={`cursor-pointer ${
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
              
              <div className="mb-4 mt-6">
                <div className="text-green-300">SERVERS:</div>
                <div className="ml-2">
                  {servers.map(server => (
                    <div 
                      key={server.id}
                      className={currentServer === server.id ? 'text-yellow-400' : 'text-green-400'}
                    >
                      {currentServer === server.id ? '> ' : '  '}{server.name.toUpperCase()}
                    </div>
                  ))}
                </div>
              </div>

            </div>
          </div>
        )}

        {/* Desktop Channel List */}
        <div className="hidden sm:block w-64 lg:w-72 border-r border-green-400 p-4 flex-shrink-0 overflow-auto">
          <div className="mb-4">
            <div className="text-green-300">CHANNELS:</div>
            <div className="ml-2">
              {servers.map(server => (
                <div key={server.id}>
                  {server.channels.map(channel => (
                    <div 
                      key={channel.id}
                      onClick={() => switchChannel(server.id, channel.id)}
                      className={`cursor-pointer ${
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
          </div>
          
          <div className="mb-4">
            <div className="text-green-300">SERVERS:</div>
            <div className="ml-2">
              {servers.map(server => (
                <div 
                  key={server.id}
                  className={currentServer === server.id ? 'text-yellow-400' : 'text-green-400'}
                >
                  {currentServer === server.id ? '> ' : '  '}{server.name.toUpperCase()}
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
              === CONNECTED TO #{servers.find(s => s.id === currentServer)?.channels.find(c => c.id === currentChannel)?.name.toUpperCase() || currentChannel.toUpperCase()} ===
            </div>
            <div className="text-center sm:hidden">
              #{servers.find(s => s.id === currentServer)?.channels.find(c => c.id === currentChannel)?.name.toUpperCase() || currentChannel.toUpperCase()}
            </div>
          </div>

          {/* Chat Area */}
          <div className="flex-1 p-2 sm:p-4 overflow-auto">
            <div className="space-y-1">
              <div className="hidden sm:block">*** MOTD: WELCOME TO THE RETRO IRC EXPERIENCE ***</div>
              <div className="hidden sm:block">*** CONNECTING TO {servers.find(s => s.id === currentServer)?.name.toUpperCase()}:6667</div>
              <div className="hidden sm:block">*** JOINING #{servers.find(s => s.id === currentServer)?.channels.find(c => c.id === currentChannel)?.name.toUpperCase() || currentChannel.toUpperCase()}</div>
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
              <span className="text-green-300 hidden sm:inline">[#{servers.find(s => s.id === currentServer)?.channels.find(c => c.id === currentChannel)?.name.toUpperCase() || currentChannel.toUpperCase()}]&gt; </span>
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
                {users.map(user => {
                  const userColors = ['text-red-400', 'text-cyan-400', 'text-yellow-400', 'text-green-400', 'text-blue-400', 'text-magenta-400'];
                  const colorIndex = user.username.charCodeAt(0) % userColors.length;
                  const isAdmin = user.username.toLowerCase().includes('admin');
                  const isModerator = user.username.toLowerCase().includes('mod');
                  
                  return (
                    <div key={user.id} className={userColors[colorIndex]}>
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
            {users.map(user => {
              const userColors = ['text-red-400', 'text-cyan-400', 'text-yellow-400', 'text-green-400', 'text-blue-400', 'text-magenta-400'];
              const colorIndex = user.username.charCodeAt(0) % userColors.length;
              const isAdmin = user.username.toLowerCase().includes('admin');
              const isModerator = user.username.toLowerCase().includes('mod');
              
              return (
                <div key={user.id} className={userColors[colorIndex]}>
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
    </div>
  );
}

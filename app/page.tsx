'use client';

import ThemeSelector from '@/components/ThemeSelector';
import { useTheme, themes } from '@/components/ThemeProvider';
import { useState } from 'react';

export default function HomePage() {
  const { theme } = useTheme();
  const currentTheme = themes[theme];
  const [showSidebar, setShowSidebar] = useState(false);
  const [showUsers, setShowUsers] = useState(false);
  const [inputMessage, setInputMessage] = useState('');

  // Mock data for demonstration
  const mockChannels = [
    { id: '1', name: 'general', category: 'Public' },
    { id: '2', name: 'random', category: 'Public' },
    { id: '3', name: 'tech-talk', category: 'Development' },
    { id: '4', name: 'design', category: 'Development' },
  ];

  const mockUsers = [
    { id: '1', username: 'admin', role: 'owner' },
    { id: '2', username: 'moderator1', role: 'moderator' },
    { id: '3', username: 'user1', role: 'default' },
    { id: '4', username: 'user2', role: 'default' },
    { id: '5', username: 'designer', role: 'default' },
  ];

  const mockMessages = [
    { id: '1', username: 'admin', content: 'Welcome to IRC Next!', timestamp: '14:30' },
    { id: '2', username: 'user1', content: 'Thanks! This looks great.', timestamp: '14:31' },
    { id: '3', username: 'designer', content: 'The theme system is really nice', timestamp: '14:32' },
    { id: '4', username: 'moderator1', content: 'Feel free to explore all the themes', timestamp: '14:33' },
  ];

  const getUserRoleColor = (username: string) => {
    const user = mockUsers.find(u => u.username === username);
    switch (user?.role) {
      case 'owner': return currentTheme.roleOwner;
      case 'moderator': return currentTheme.roleModerator;
      default: return currentTheme.roleDefault;
    }
  };

  return (
    <div className={`h-screen w-screen ${currentTheme.background} ${currentTheme.text} font-mono text-xs sm:text-sm overflow-hidden fixed inset-0 flex flex-col`}>
      {/* Terminal Title */}
      <div className={`border-b ${currentTheme.border} p-2 flex-shrink-0`}>
        {/* Header actions */}
        <div className="flex justify-between items-center">
          <div className="flex gap-2">
            <button 
              className={`${currentTheme.accent} ${currentTheme.button} select-none`}
              title="Create Category"
            >
              [+CAT]
            </button>
            <button 
              className={`${currentTheme.accent} ${currentTheme.button} select-none`}
              title="Create Channel"
            >
              [+CH]
            </button>
          </div>
          
          {/* Center notification */}
          <div className="flex-1 text-center">
            <span className={`${currentTheme.accent} font-mono select-none`}>
              DESIGN SYSTEM PRESERVED
            </span>
          </div>
          
          <div className="flex gap-2">
            <span className={`${currentTheme.accent} select-none`}>DEMO_USER</span>
            <button 
              className="text-red-400 hover:text-red-300 select-none"
            >
              [LOGOUT]
            </button>
          </div>
        </div>
        
        {/* Mobile header */}
        <div className="sm:hidden flex items-center justify-between">
          <button 
            onClick={() => setShowSidebar(!showSidebar)}
            className="text-green-300 hover:text-yellow-400 select-none"
          >
            [CHANNELS]
          </button>
          <div className={`text-center ${currentTheme.accent} select-none`}>IRC CHAT</div>
          <div className="flex gap-2">
            <button 
              onClick={() => setShowUsers(!showUsers)}
              className={`${currentTheme.accent} ${currentTheme.button} select-none`}
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
            <div className={`w-64 h-full ${currentTheme.background} border-r ${currentTheme.border} flex flex-col`} onClick={(e) => e.stopPropagation()}>
              <div className="flex justify-between items-center p-4 border-b border-gray-600 flex-shrink-0">
                <div className="w-10"></div>
                <div className={`${currentTheme.accent} text-center select-none`}>[ CHANNELS (4) ]</div>
                <div className="flex gap-2 w-10">
                  <button 
                    className={`${currentTheme.accent} ${currentTheme.button} text-xs select-none`}
                    title="Refresh channels"
                  >
                    [↻]
                  </button>
                  <button onClick={() => setShowSidebar(false)} className={`${currentTheme.error} select-none`}>[X]</button>
                </div>
              </div>
              <div className="flex-1 p-4 overflow-auto">
                <div className="ml-2">
                  {mockChannels.map(channel => (
                    <div 
                      key={channel.id}
                      className={`cursor-pointer mb-2 select-none ${currentTheme.text} ${currentTheme.button}`}
                    >
                      <span className="flex items-center">
                        <span className="w-4 flex-shrink-0">{channel.id === '1' ? '>' : ''}</span>
                        <span className="truncate">#{channel.name.toUpperCase()}</span>
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Desktop Channel List */}
        <div className={`hidden sm:block w-64 lg:w-72 border-r ${currentTheme.border} flex-shrink-0 flex flex-col`}>
          {/* Channel Header */}
          <div className={`border-b ${currentTheme.border} p-2 flex-shrink-0`}>
            <div className="flex justify-between items-center">
              <div className="w-6"></div>
              <div className={`${currentTheme.accent} text-center select-none`}>[ CHANNELS (4) ]</div>
              <button 
                className={`${currentTheme.accent} ${currentTheme.button} text-xs w-6`}
                title="Refresh channels"
              >
                [↻]
              </button>
            </div>
          </div>
          {/* Channel List */}
          <div className="flex-1 p-4 overflow-auto" style={{
            scrollbarWidth: 'thin',
            scrollbarColor: currentTheme.scrollbar,
            maxHeight: 'calc(100vh - 120px)'
          }}>
            <div className="ml-2">
              <div className="mb-2">
                <div className={`cursor-pointer ${currentTheme.accent} ${currentTheme.button} mb-1`}>
                  [-] PUBLIC
                </div>
                {mockChannels.filter(ch => ch.category === 'Public').map(channel => (
                  <div 
                    key={channel.id}
                    className={`cursor-pointer ml-4 select-none ${
                      channel.id === '1' 
                        ? currentTheme.highlight 
                        : `${currentTheme.text} ${currentTheme.button}`
                    }`}
                  >
                    <span className="flex items-center">
                      <span className="flex-shrink-0">{channel.id === '1' ? '> ' : '  '}</span>
                      <span className="truncate">#{channel.name.toUpperCase()}</span>
                    </span>
                  </div>
                ))}
              </div>
              
              <div className="mb-2">
                <div className={`cursor-pointer ${currentTheme.accent} ${currentTheme.button} mb-1`}>
                  [-] DEVELOPMENT
                </div>
                {mockChannels.filter(ch => ch.category === 'Development').map(channel => (
                  <div 
                    key={channel.id}
                    className={`cursor-pointer ml-4 select-none ${currentTheme.text} ${currentTheme.button}`}
                  >
                    <span className="flex items-center">
                      <span className="flex-shrink-0">  </span>
                      <span className="truncate">#{channel.name.toUpperCase()}</span>
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Main Terminal */}
        <div className="flex-1 flex flex-col min-w-0 min-h-0">
          {/* Chat Header - Same height as side headers */}
          <div className={`border-b ${currentTheme.border} p-2 flex-shrink-0`}>
            <div className="flex justify-between items-center">
              <div className="w-6"></div>
              <div className={`${currentTheme.accent} text-center select-none`}>[ #GENERAL ]</div>
              <button 
                className={`${currentTheme.accent} ${currentTheme.button} text-xs w-6`}
                title="Channel info"
              >
                [i]
              </button>
            </div>
          </div>

          {/* Chat Area */}
          <div 
            className="flex-1 p-4 overflow-auto chat-area min-h-0" 
            style={{
              scrollbarWidth: 'thin',
              scrollbarColor: currentTheme.scrollbar,
              maxHeight: 'calc(100vh - 120px)'
            }}
          >
            <div className="space-y-1">
              {mockMessages.map(message => {
                const userColor = getUserRoleColor(message.username);
                return (
                  <div key={message.id} className={`message-item ${currentTheme.text} break-words`}>
                    <span className="hidden sm:inline">{message.timestamp} </span>&lt;<span className={userColor}>{message.username.toUpperCase()}</span>&gt; {message.content}
                  </div>
                );
              })}
              
              {/* Demo message */}
              <div className={`message-item ${currentTheme.muted} break-words text-xs mt-4`}>
                *** This is a demo layout preserving the original IRC design ***
              </div>
            </div>
          </div>

          {/* Input Line */}
          <div className={`relative border-t ${currentTheme.border} p-2 cursor-text`}>
            <div className="flex items-center">
              <span className={`${currentTheme.accent} hidden sm:inline`}>[#GENERAL]&gt; </span>
              <span className={`${currentTheme.accent} sm:hidden`}>&gt; </span>
              <textarea 
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                className={`flex-1 ${currentTheme.input} outline-none ml-2 resize-none overflow-y-auto`}
                placeholder="TYPE MESSAGE OR COMMAND (/help for commands)..."
                rows={1}
                style={{
                  minHeight: '1.5rem',
                  maxHeight: '4.5rem',
                  lineHeight: '1.5rem',
                  paddingTop: '0',
                  paddingBottom: '0',
                  verticalAlign: 'top',
                  scrollbarWidth: 'thin',
                  scrollbarColor: currentTheme.scrollbar
                }}
              />
            </div>
          </div>
        </div>

        {/* Mobile Users Overlay */}
        {showUsers && (
          <div className="absolute inset-0 bg-black bg-opacity-75 z-20 sm:hidden" onClick={() => setShowUsers(false)}>
            <div className={`w-48 h-full ${currentTheme.background} border-l ${currentTheme.border} ml-auto flex flex-col`} onClick={(e) => e.stopPropagation()}>
              <div className="flex justify-between items-center p-4 border-b border-gray-600 flex-shrink-0">
                <div className={`${currentTheme.accent} select-none`}>
                  USERS ({mockUsers.length}):
                </div>
                <button onClick={() => setShowUsers(false)} className={`${currentTheme.error} select-none`}>[X]</button>
              </div>
              <div className="flex-1 p-4 overflow-auto">
                <div className="space-y-1">
                  {mockUsers.map(user => {
                    const userColor = getUserRoleColor(user.username);
                    return (
                      <div key={user.id} className={userColor}>
                        {user.username.toUpperCase()}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Desktop User List */}
        <div className={`hidden lg:block w-64 lg:w-72 border-l ${currentTheme.border} flex-shrink-0 flex flex-col`}>
          {/* User Header */}
          <div className={`border-b ${currentTheme.border} p-2 flex-shrink-0`}>
            <div className={`${currentTheme.accent} text-center select-none`}>[ USERS ({mockUsers.length}) ]</div>
          </div>
          {/* User List */}
          <div className="flex-1 p-4 overflow-auto user-list" style={{
            scrollbarWidth: 'thin',
            scrollbarColor: currentTheme.scrollbar,
            maxHeight: 'calc(100vh - 120px)'
          }}>
            <div className="space-y-1">
              {mockUsers.map(user => {
                const userColor = getUserRoleColor(user.username);
                return (
                  <div key={user.id} className={userColor}>
                    {user.username.toUpperCase()}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Status */}
      <div className={`border-t ${currentTheme.border} p-2 flex justify-between items-center flex-shrink-0`}>
        <div className="flex items-center gap-2">
          <ThemeSelector />
          <button
            className={`${currentTheme.accent} ${currentTheme.button} text-xs select-none`}
            title="Information"
          >
            [INFO]
          </button>
        </div>
        <div 
          className="text-xs font-mono select-none" 
          title="Design system preserved - all themes functional"
        >
          DESIGN READY
        </div>
      </div>
    </div>
  );
}
'use client';

import { useEffect, Suspense } from 'react';
import AuthModal from '@/components/AuthModal';
import CreateCategoryModal from '@/components/CreateCategoryModal';
import CreateChannelModal from '@/components/CreateChannelModal';
import { useAuth } from '@/hooks/useAuth';
import { useChannel } from '@/hooks/useChannel';
import { useChat } from '@/hooks/useChat';
import { useCommands } from '@/hooks/useCommands';
import { useUsers } from '@/hooks/useUsers';
import { useUI } from '@/hooks/useUI';

function HomeContent() {
  const auth = useAuth();
  const ui = useUI();
  
  const channel = useChannel(auth.userId, auth.username, auth.authUser);
  
  const chat = useChat(
    channel.currentChannel,
    auth.userId,
    auth.username,
    auth.authUser,
    channel.channelMembers,
    channel.setCurrentMotd,
    channel.fetchChannelMembers
  );

  const commands = useCommands(
    channel.currentChannel,
    auth.userId,
    auth.username,
    auth.authUser,
    channel.userRole,
    channel.userPermissions,
    channel.channelMembers,
    channel.channelRoles,
    chat.setMessages,
    chat.setLocalMessages,
    channel.setCurrentTopic,
    channel.fetchChannelMembers,
    chat.channel
  );

  const users = useUsers(chat.users, channel.channelMembers, auth.username);

  const formatMessageContent = (content: string) => {
    const mentionRegex = /@(\w+)/g;
    const parts = content.split(mentionRegex);
    
    return parts.map((part, index) => {
      if (index % 2 === 1) {
        const isMentioningSelf = part.toLowerCase() === auth.username.toLowerCase();
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

  useEffect(() => {
    channel.fetchCategoriesAndChannels();

    return () => {
      if (chat.channel) {
        chat.channel.unsubscribe();
      }
    };
  }, []);

  useEffect(() => {
    if (!ui.isJoined && channel.currentChannel) {
      handleChannelSwitch(channel.currentChannel);
      ui.setIsJoined(true);
    }
  }, [ui.isJoined, channel.currentChannel]);

  const handleChannelSwitch = async (channelId: string) => {
    chat.clearMessages();
    const result = await channel.switchChannel(channelId);
    
    if (result?.success) {
      await chat.loadChannelMessages(channelId);
      await chat.joinChannel(channelId);
    }
  };

  const sendMessage = async () => {
    if (chat.channel && ui.inputMessage.trim() && auth.authUser) {
      const trimmedInput = ui.inputMessage.trim();

      if (commands.pendingDeleteChannel && commands.pendingDeleteChannel.requestedBy === auth.userId && (trimmedInput.toLowerCase() === 'y' || trimmedInput.toLowerCase() === 'n')) {
        if (trimmedInput.toLowerCase() === 'y') {
          await commands.performChannelDeletion(commands.pendingDeleteChannel);
        } else {
          const cancelMsg = {
            id: `delete_cancelled_${Date.now()}`,
            username: 'SYSTEM',
            content: `Channel deletion cancelled.`,
            timestamp: new Date(),
            channel: channel.currentChannel
          };
          chat.setLocalMessages(prev => [...prev, cancelMsg]);
        }
        commands.setPendingDeleteChannel(null);
        chat.setLocalMessages(prev => prev.filter(msg => !msg.id.startsWith('delete_confirm_')));
        ui.clearInput();
        return;
      }

      const success = await chat.sendMessage(trimmedInput, commands.handleCommand);
      if (success) {
        ui.clearInput();
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!commands.showCommandSuggestions) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        commands.setSelectedSuggestion(prev => 
          prev < commands.commandSuggestions.length - 1 ? prev + 1 : 0
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        commands.setSelectedSuggestion(prev => 
          prev > 0 ? prev - 1 : commands.commandSuggestions.length - 1
        );
        break;
      case 'Tab':
      case 'Enter':
        if (e.key === 'Tab') {
          e.preventDefault();
        }
        if (commands.commandSuggestions[commands.selectedSuggestion]) {
          const selectedCommand = commands.commandSuggestions[commands.selectedSuggestion];
          
          if (ui.inputMessage.includes('/createrole ') && !selectedCommand.command.includes(' ')) {
            const parts = ui.inputMessage.split(' ');
            if (parts.length === 3) {
              const newMessage = `${parts[0]} ${parts[1]} ${selectedCommand.command}`;
              ui.setInputMessage(newMessage);
            } else {
              ui.setInputMessage(ui.inputMessage + selectedCommand.command);
            }
          } else {
            const commandWithSlash = `/${selectedCommand.command.split(' ')[0]}`;
            ui.setInputMessage(commandWithSlash + ' ');
          }
          
          commands.setShowCommandSuggestions(false);
          if (e.key === 'Tab') {
            return;
          }
        }
        break;
      case 'Escape':
        commands.setShowCommandSuggestions(false);
        break;
    }
  };

  const selectSuggestion = (index: number) => {
    const selectedCommand = commands.commandSuggestions[index];
    
    if (ui.inputMessage.includes('/createrole ') && !selectedCommand.command.includes(' ')) {
      const parts = ui.inputMessage.split(' ');
      if (parts.length === 3) {
        const newMessage = `${parts[0]} ${parts[1]} ${selectedCommand.command}`;
        ui.setInputMessage(newMessage);
      } else {
        ui.setInputMessage(ui.inputMessage + selectedCommand.command);
      }
    } else {
      const commandWithSlash = `/${selectedCommand.command.split(' ')[0]}`;
      ui.setInputMessage(commandWithSlash + ' ');
    }
    
    commands.setShowCommandSuggestions(false);
  };

  const handleInputChange = (value: string) => {
    ui.handleInputChange(value);
    commands.updateCommandSuggestions(value);
  };

  const handleCreationSuccess = () => {
    channel.fetchCategoriesAndChannels();
  };

  if (auth.showAuthModal) {
    return <AuthModal onAuthSuccess={auth.handleAuthSuccess} />;
  }

  return (
    <div className="h-screen w-screen bg-black text-green-400 font-mono text-xs sm:text-sm overflow-hidden fixed inset-0 flex flex-col">
      {/* Terminal Title */}
      <div className="border-b border-green-400 p-2 flex-shrink-0">
        {/* Header actions */}
        <div className="flex justify-between items-center">
          <div className="flex gap-2">
            {auth.authUser && (
              <>
                <button 
                  onClick={ui.handleCreateCategory}
                  className="text-green-300 hover:text-yellow-400"
                  title="Create Category"
                >
                  [+CAT]
                </button>
                <button 
                  onClick={() => ui.handleCreateChannel()}
                  className="text-green-300 hover:text-yellow-400"
                  title="Create Channel"
                >
                  [+CH]
                </button>
              </>
            )}
          </div>
          
          <div className="flex gap-2">
            {auth.authUser ? (
              <>
                <span className="text-yellow-400">{auth.username.toUpperCase()}</span>
                <button 
                  onClick={auth.handleLogout}
                  className="text-red-400 hover:text-red-300"
                >
                  [LOGOUT]
                </button>
              </>
            ) : (
              <button 
                onClick={() => auth.setShowAuthModal(true)}
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
            onClick={() => ui.setShowSidebar(!ui.showSidebar)}
            className="text-green-300 hover:text-yellow-400"
          >
            [CHANNELS]
          </button>
          <div className="text-center text-green-300">IRC CHAT</div>
          <div className="flex gap-2">
            {!auth.authUser && (
              <button 
                onClick={() => auth.setShowAuthModal(true)}
                className="text-green-400 hover:text-green-300"
              >
                [LOGIN]
              </button>
            )}
            <button 
              onClick={() => ui.setShowUsers(!ui.showUsers)}
              className="text-green-300 hover:text-yellow-400"
            >
              [USERS]
            </button>
          </div>
        </div>
      </div>

      <div className="flex flex-1 relative min-h-0">
        {/* Mobile Sidebar Overlay */}
        {ui.showSidebar && (
          <div className="absolute inset-0 bg-black bg-opacity-75 z-20 sm:hidden" onClick={() => ui.setShowSidebar(false)}>
            <div className="w-64 h-full bg-black border-r border-green-400 p-4" onClick={(e) => e.stopPropagation()}>
              <div className="flex justify-between items-center mb-4">
                <div className="text-green-300">CHANNELS:</div>
                <button onClick={() => ui.setShowSidebar(false)} className="text-red-400">[X]</button>
              </div>
              <div className="ml-2">
                {channel.categories.length === 0 ? (
                  <div className="text-gray-400 italic">No categories available</div>
                ) : (
                  channel.categories.map(category => {
                    if (category.id === 'universal') {
                      return category.channels?.map(ch => (
                        <div 
                          key={ch.id}
                          onClick={() => {
                            handleChannelSwitch(ch.id);
                            ui.setShowSidebar(false);
                          }}
                          className={`cursor-pointer mb-2 ${
                            channel.currentChannel === ch.id
                              ? 'text-yellow-400'
                              : 'text-cyan-400 hover:text-yellow-400'
                          }`}
                        >
                          <span className="flex items-center justify-between">
                            <span>
                              <span className="w-4 inline-block">{channel.currentChannel === ch.id ? '>' : ''}</span>
                              #{ch.name.toUpperCase()}
                            </span>
                            {channel.unreadMentions[ch.id] && (
                              <span className="bg-red-600 text-white text-xs px-1 py-0.5 rounded ml-2">
                                @{channel.unreadMentions[ch.id]}
                              </span>
                            )}
                          </span>
                        </div>
                      ));
                    }
                    
                    if (category.id === 'no-category') {
                      return category.channels?.map(ch => (
                        <div 
                          key={ch.id}
                          onClick={() => {
                            handleChannelSwitch(ch.id);
                            ui.setShowSidebar(false);
                          }}
                          className={`cursor-pointer mb-1 ${
                            channel.currentChannel === ch.id
                              ? 'text-yellow-400'
                              : 'text-green-400 hover:text-yellow-400'
                          }`}
                        >
                          <span className="flex items-center justify-between">
                            <span>
                              <span className="w-4 inline-block">{channel.currentChannel === ch.id ? '>' : ''}</span>
                              #{ch.name.toUpperCase()}
                            </span>
                            {channel.unreadMentions[ch.id] && (
                              <span className="bg-red-600 text-white text-xs px-1 py-0.5 rounded ml-2">
                                @{channel.unreadMentions[ch.id]}
                              </span>
                            )}
                          </span>
                        </div>
                      ));
                    }
                    
                    return (
                      <div key={category.id}>
                        <div 
                          onClick={() => channel.toggleCategory(category.id)}
                          className="cursor-pointer text-green-300 hover:text-yellow-400 mb-1"
                        >
                          {channel.expandedCategories.has(category.id) ? '[-]' : '[+]'} {category.name.toUpperCase()}
                        </div>
                        {channel.expandedCategories.has(category.id) && (
                          category.channels?.length === 0 ? (
                            <div className="text-gray-400 italic ml-4">No channels in category</div>
                          ) : (
                            category.channels?.map(ch => (
                              <div 
                                key={ch.id}
                                onClick={() => {
                                  handleChannelSwitch(ch.id);
                                  ui.setShowSidebar(false);
                                }}
                                className={`cursor-pointer ml-4 ${
                                  channel.currentChannel === ch.id
                                    ? 'text-yellow-400'
                                    : 'text-green-400 hover:text-yellow-400'
                                }`}
                              >
                                <span className="flex items-center justify-between">
                                  <span>
                                    {channel.currentChannel === ch.id ? '> ' : '  '}
                                    #{ch.name.toUpperCase()}
                                  </span>
                                  {channel.unreadMentions[ch.id] && (
                                    <span className="bg-red-600 text-white text-xs px-1 py-0.5 rounded ml-2">
                                      @{channel.unreadMentions[ch.id]}
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
              {channel.categories.length === 0 ? (
                <div className="text-gray-400 italic">No categories available</div>
              ) : (
                channel.categories.map(category => {
                  if (category.id === 'universal') {
                    return category.channels?.map(ch => (
                      <div 
                        key={ch.id}
                        onClick={() => handleChannelSwitch(ch.id)}
                        className={`cursor-pointer mb-2 ${
                          channel.currentChannel === ch.id
                            ? 'text-yellow-400'
                            : 'text-cyan-400 hover:text-yellow-400'
                        }`}
                      >
                        <span className="flex items-center justify-between">
                          <span>
                            <span className="w-4 inline-block">{channel.currentChannel === ch.id ? '>' : ''}</span>
                            #{ch.name.toUpperCase()}
                          </span>
                          {channel.unreadMentions[ch.id] && (
                            <span className="bg-red-600 text-white text-xs px-1 py-0.5 rounded ml-2">
                              @{channel.unreadMentions[ch.id]}
                            </span>
                          )}
                        </span>
                      </div>
                    ));
                  }
                  
                  if (category.id === 'no-category') {
                    return category.channels?.map(ch => (
                      <div 
                        key={ch.id}
                        onClick={() => handleChannelSwitch(ch.id)}
                        className={`cursor-pointer mb-1 ${
                          channel.currentChannel === ch.id
                            ? 'text-yellow-400'
                            : 'text-green-400 hover:text-yellow-400'
                        }`}
                      >
                        <span className="flex items-center justify-between">
                          <span>
                            <span className="w-4 inline-block">{channel.currentChannel === ch.id ? '>' : ''}</span>
                            #{ch.name.toUpperCase()}
                          </span>
                          {channel.unreadMentions[ch.id] && (
                            <span className="bg-red-600 text-white text-xs px-1 py-0.5 rounded ml-2">
                              @{channel.unreadMentions[ch.id]}
                            </span>
                          )}
                        </span>
                      </div>
                    ));
                  }
                  
                  return (
                    <div key={category.id} className="mb-2">
                      <div className="flex justify-between items-center mb-1">
                        <div 
                          onClick={() => channel.toggleCategory(category.id)}
                          className="cursor-pointer text-green-300 hover:text-yellow-400 font-medium flex-1"
                        >
                          {channel.expandedCategories.has(category.id) ? '[-]' : '[+]'} {category.name.toUpperCase()}
                        </div>
                      </div>
                      {channel.expandedCategories.has(category.id) && (
                        category.channels?.length === 0 ? (
                          <div className="text-gray-400 italic ml-4">No channels in category</div>
                        ) : (
                          category.channels?.map(ch => (
                            <div 
                              key={ch.id}
                              onClick={() => handleChannelSwitch(ch.id)}
                              className={`cursor-pointer ml-4 ${
                                channel.currentChannel === ch.id
                                  ? 'text-yellow-400'
                                  : 'text-green-400 hover:text-yellow-400'
                              }`}
                            >
                              <span className="flex items-center justify-between">
                                <span>
                                  <span className="w-4 inline-block">{channel.currentChannel === ch.id ? '>' : ''}</span>
                                  #{ch.name.toUpperCase()}
                                </span>
                                {channel.unreadMentions[ch.id] && (
                                  <span className="bg-red-600 text-white text-xs px-1 py-0.5 rounded ml-2">
                                    @{channel.unreadMentions[ch.id]}
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
              === CONNECTED TO #{channel.getCurrentChannelName().toUpperCase()} ===
            </div>
            <div className="text-center sm:hidden">
              #{channel.getCurrentChannelName().toUpperCase()}
            </div>
          </div>

          {/* Chat Area */}
          <div className="flex-1 p-2 sm:p-4 overflow-auto chat-area" style={{
            scrollbarWidth: 'thin',
            scrollbarColor: '#1f2937 #000000'
          }}>
            <div className="space-y-1">
              {channel.joinStatus && channel.joiningChannelName && (
                <div className={`hidden sm:block ${
                  channel.joinStatus === 'joining' ? 'text-yellow-400' :
                  channel.joinStatus === 'success' ? 'text-green-400' : 'text-red-400'
                }`}>
                  *** {
                    channel.joinStatus === 'joining' ? `JOINING #${channel.joiningChannelName.toUpperCase()}...` :
                    channel.joinStatus === 'success' ? `JOINED #${channel.joiningChannelName.toUpperCase()} SUCCESSFULLY` :
                    `FAILED TO JOIN #${channel.joiningChannelName.toUpperCase()}`
                  } ***
                </div>
              )}
              {channel.currentTopic && (
                <div className="hidden sm:block text-cyan-400">*** TOPIC: {channel.currentTopic.toUpperCase()} ***</div>
              )}
              <div className="hidden sm:block text-purple-400">*** MOTD: {channel.currentMotd} ***</div>
              {!auth.authUser && (
                <div className="text-yellow-400">*** YOU ARE LURKING - LOGIN TO PARTICIPATE ***</div>
              )}
              {[...chat.messages, ...chat.localMessages].sort((a, b) => 
                new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
              ).map(message => {
                const time = new Date(message.timestamp).toLocaleTimeString('en-US', { hour12: false });
                const userColor = users.getUserRoleColor(message.username);
                return (
                  <div key={message.id} className="text-green-400 break-words">
                    <span className="hidden sm:inline">{time} </span>&lt;<span className={userColor}>{message.username.toUpperCase()}</span>&gt; {formatMessageContent(message.content)}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Command Autocomplete */}
          {auth.authUser && commands.showCommandSuggestions && (
            <div className="border-t border-green-400 bg-black max-h-48 overflow-y-auto command-suggestions" style={{
              scrollbarWidth: 'thin',
              scrollbarColor: '#4b5563 #1f2937'
            }}>
              {commands.commandSuggestions.map((suggestion, index) => (
                <div
                  key={suggestion.command}
                  onClick={() => selectSuggestion(index)}
                  className={`p-2 cursor-pointer border-b border-green-600 ${
                    index === commands.selectedSuggestion 
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
            {auth.authUser ? (
              <div className="flex items-center">
                <span className="text-green-300 hidden sm:inline">[#{channel.getCurrentChannelName().toUpperCase()}]&gt; </span>
                <span className="text-green-300 sm:hidden">&gt; </span>
                <textarea 
                  value={ui.inputMessage}
                  onChange={(e) => handleInputChange(e.target.value)}
                  onKeyDown={handleKeyDown}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey && !commands.showCommandSuggestions) {
                      e.preventDefault();
                      sendMessage();
                    }
                  }}
                  className="flex-1 bg-transparent text-green-400 outline-none ml-2 placeholder-gray-600 resize-none overflow-y-auto flex items-center"
                  placeholder={channel.userRole === 'owner' || channel.userRole === 'moderator' ? "TYPE MESSAGE OR COMMAND (/help for commands)..." : "TYPE MESSAGE..."}
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
                  onClick={() => auth.setShowAuthModal(true)}
                  className="text-yellow-400 hover:text-yellow-300 text-center"
                >
                  *** LOGIN TO CHAT ***
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Mobile Users Overlay */}
        {ui.showUsers && (
          <div className="absolute inset-0 bg-black bg-opacity-75 z-20 sm:hidden" onClick={() => ui.setShowUsers(false)}>
            <div className="w-48 h-full bg-black border-l border-green-400 p-4 ml-auto" onClick={(e) => e.stopPropagation()}>
              {(() => {
                const currentChannelName = channel.getCurrentChannelName();
                const displayUsers = users.displayUsers;
                const userCount = displayUsers.length;
                
                return (
                  <>
                    <div className="flex justify-between items-center mb-4">
                      <div className="text-green-300">
                        USERS ({userCount}):
                      </div>
                      <button onClick={() => ui.setShowUsers(false)} className="text-red-400">[X]</button>
                    </div>
                    <div className="space-y-1">
                      {displayUsers.map((user, index) => {
                        const member = channel.channelMembers.find(m => m.user_id === user.id);
                        const roleColor = member ? channel.getRoleColor(member) : 'text-green-400';
                        
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
            const currentChannelName = channel.getCurrentChannelName();
            const displayUsers = users.displayUsers;
            const userCount = displayUsers.length;
            
            return (
              <>
                <div className="text-green-300 mb-4">
                  USERS ({userCount}):
                </div>
                <div className="space-y-1">
                  {displayUsers.map((user, index) => {
                    const member = channel.channelMembers.find(m => m.user_id === user.id);
                    const roleColor = member ? channel.getRoleColor(member) : 'text-green-400';
                    
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
          {chat.connected ? 'CONNECTED' : 'DISCONNECTED'}
        </div>
      </div>

      {/* Modals */}
      {ui.showCreateCategoryModal && (
        <CreateCategoryModal
          onClose={() => ui.setShowCreateCategoryModal(false)}
          onSuccess={handleCreationSuccess}
        />
      )}

      {ui.showCreateChannelModal && (
        <CreateChannelModal
          categoryId={ui.selectedCategoryForChannel}
          categories={channel.categories}
          onClose={() => ui.setShowCreateChannelModal(false)}
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
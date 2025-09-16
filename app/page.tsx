'use client';

import { useEffect, useCallback, Suspense } from 'react';
import AuthModal from '@/components/AuthModal';
import CreateCategoryModal from '@/components/CreateCategoryModal';
import CreateChannelModal from '@/components/CreateChannelModal';
import ThemeSelector from '@/components/ThemeSelector';
import { useTheme, themes } from '@/components/ThemeProvider';
import { useAuth } from '@/hooks/useAuth';
import { useChannel } from '@/hooks/useChannel';
import { useChat } from '@/hooks/useChat';
import { useCommands } from '@/hooks/useCommands';
import { useUsers } from '@/hooks/useUsers';
import { useUI } from '@/hooks/useUI';

function HomeContent() {
  const { theme } = useTheme();
  const currentTheme = themes[theme];
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
        
        // Use the same color logic as the rest of the chat
        const userColor = users.getUserRoleColor(part);
        
        return (
          <span
            key={index}
            className={`font-bold ${
              isMentioningSelf 
                ? `${userColor} bg-green-950 bg-opacity-40 px-1 rounded-sm` 
                : `${userColor} bg-gray-800 bg-opacity-50 px-1 rounded-sm`
            }`}
          >
            @{part}
          </span>
        );
      }
      return part;
    });
  };

  const handleChannelSwitch = useCallback(async (channelId: string) => {
    chat.clearMessages();
    const result = await channel.switchChannel(channelId);
    
    if (result?.success) {
      await chat.loadChannelMessages(channelId);
      await chat.joinChannel(channelId);
    }
  }, [chat, channel]);

  useEffect(() => {
    channel.fetchCategoriesAndChannels();
    // Only run once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    return () => {
      if (chat.channel) {
        chat.channel.unsubscribe();
      }
    };
  }, [chat.channel]);

  useEffect(() => {
    if (!ui.isJoined && channel.currentChannel) {
      handleChannelSwitch(channel.currentChannel);
      ui.setIsJoined(true);
    }
  }, [ui.isJoined, channel.currentChannel, handleChannelSwitch, ui]);

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
    // Handle Enter for sending messages
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      
      // If command suggestions are shown and user presses Enter, select the highlighted suggestion
      if (commands.showCommandSuggestions && commands.commandSuggestions[commands.selectedSuggestion]) {
        const selectedCommand = commands.commandSuggestions[commands.selectedSuggestion];
        
        // Don't handle selection for help-only suggestions
        if (selectedCommand.command === '__help_only__') {
          commands.setShowCommandSuggestions(false);
          sendMessage();
          return;
        }
        
        const parts = ui.inputMessage.split(' ');
        const currentCommand = parts[0]?.slice(1); // Remove the "/"
        
        // Handle color suggestions for /createrole
        if (ui.inputMessage.includes('/createrole ') && !selectedCommand.command.includes(' ')) {
          if (parts.length === 3) {
            const newMessage = `${parts[0]} ${parts[1]} ${selectedCommand.command}`;
            ui.setInputMessage(newMessage);
          } else {
            ui.setInputMessage(ui.inputMessage + selectedCommand.command);
          }
        }
        // Handle user/role suggestions for user commands
        else if (['ban', 'setrole', 'mod', 'unmod'].includes(currentCommand) && parts.length >= 2) {
          // Replace the current incomplete argument with the selected suggestion
          const newParts = [...parts];
          newParts[parts.length - 1] = selectedCommand.command;
          ui.setInputMessage(newParts.join(' ') + ' ');
        }
        // Handle regular command suggestions
        else {
          const commandWithSlash = `/${selectedCommand.command.split(' ')[0]}`;
          ui.setInputMessage(commandWithSlash + ' ');
        }
        
        commands.setShowCommandSuggestions(false);
      } else {
        // No suggestions or none selected - send the message normally
        sendMessage();
      }
      return;
    }

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
          
          // Don't handle selection for help-only suggestions
          if (selectedCommand.command === '__help_only__') {
            if (e.key === 'Tab') {
              return;
            }
            // For Enter, continue to send message
            break;
          }
          
          const parts = ui.inputMessage.split(' ');
          const currentCommand = parts[0]?.slice(1); // Remove the "/"
          
          // Handle color suggestions for /createrole
          if (ui.inputMessage.includes('/createrole ') && !selectedCommand.command.includes(' ')) {
            if (parts.length === 3) {
              const newMessage = `${parts[0]} ${parts[1]} ${selectedCommand.command}`;
              ui.setInputMessage(newMessage);
            } else {
              ui.setInputMessage(ui.inputMessage + selectedCommand.command);
            }
          }
          // Handle user/role suggestions for user commands
          else if (['ban', 'setrole', 'mod', 'unmod'].includes(currentCommand) && parts.length >= 2) {
            // Replace the current incomplete argument with the selected suggestion
            const newParts = [...parts];
            newParts[parts.length - 1] = selectedCommand.command;
            ui.setInputMessage(newParts.join(' ') + ' ');
          }
          // Handle regular command suggestions
          else {
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
    
    // Don't handle selection for help-only suggestions
    if (selectedCommand.command === '__help_only__') {
      return;
    }
    
    const parts = ui.inputMessage.split(' ');
    const currentCommand = parts[0]?.slice(1); // Remove the "/"
    
    // Handle color suggestions for /createrole
    if (ui.inputMessage.includes('/createrole ') && !selectedCommand.command.includes(' ')) {
      if (parts.length === 3) {
        const newMessage = `${parts[0]} ${parts[1]} ${selectedCommand.command}`;
        ui.setInputMessage(newMessage);
      } else {
        ui.setInputMessage(ui.inputMessage + selectedCommand.command);
      }
    }
    // Handle user/role suggestions for user commands
    else if (['ban', 'setrole', 'mod', 'unmod'].includes(currentCommand) && parts.length >= 2) {
      // Replace the current incomplete argument with the selected suggestion
      const newParts = [...parts];
      newParts[parts.length - 1] = selectedCommand.command;
      ui.setInputMessage(newParts.join(' ') + ' ');
    }
    // Handle regular command suggestions
    else {
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
    <div className={`h-screen w-screen ${currentTheme.background} ${currentTheme.text} font-mono text-xs sm:text-sm overflow-hidden fixed inset-0 flex flex-col`}>
      {/* Terminal Title */}
      <div className={`border-b ${currentTheme.border} p-2 flex-shrink-0`}>
        {/* Header actions */}
        <div className="flex justify-between items-center">
          <div className="flex gap-2">
            {auth.authUser && (
              <>
                <button 
                  onClick={ui.handleCreateCategory}
                  className={`${currentTheme.accent} ${currentTheme.button}`}
                  title="Create Category"
                >
                  [+CAT]
                </button>
                <button 
                  onClick={() => ui.handleCreateChannel()}
                  className={`${currentTheme.accent} ${currentTheme.button}`}
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
                className={`${currentTheme.text} hover:text-green-300`}
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
          <div className={`text-center ${currentTheme.accent}`}>IRC CHAT</div>
          <div className="flex gap-2">
            {!auth.authUser && (
              <button 
                onClick={() => auth.setShowAuthModal(true)}
                className={`${currentTheme.text} hover:text-green-300`}
              >
                [LOGIN]
              </button>
            )}
            <button 
              onClick={() => ui.setShowUsers(!ui.showUsers)}
              className={`${currentTheme.accent} ${currentTheme.button}`}
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
            <div className={`w-64 h-full ${currentTheme.background} border-r ${currentTheme.border} p-4`} onClick={(e) => e.stopPropagation()}>
              <div className="flex justify-between items-center mb-4">
                <div className={currentTheme.accent}>CHANNELS:</div>
                <button onClick={() => ui.setShowSidebar(false)} className={currentTheme.error}>[X]</button>
              </div>
              <div className="ml-2">
                {channel.categories.length === 0 ? (
                  <div className={`${currentTheme.muted} italic`}>No categories available</div>
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
                              ? currentTheme.highlight
                              : `${currentTheme.cyan} ${currentTheme.button}`
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
                              ? currentTheme.highlight
                              : `${currentTheme.text} ${currentTheme.button}`
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
                          className={`cursor-pointer ${currentTheme.accent} ${currentTheme.button} mb-1`}
                        >
                          {channel.expandedCategories.has(category.id) ? '[-]' : '[+]'} {category.name.toUpperCase()}
                        </div>
                        {channel.expandedCategories.has(category.id) && (
                          category.channels?.length === 0 ? (
                            <div className={`${currentTheme.muted} italic ml-4`}>No channels in category</div>
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
                                    ? currentTheme.highlight
                                    : `${currentTheme.text} ${currentTheme.button}`
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
        <div className={`hidden sm:block w-64 lg:w-72 border-r ${currentTheme.border} p-4 flex-shrink-0 overflow-auto`}>
          <div className="mb-4">
            <div className={currentTheme.accent}>CHANNELS:</div>
            <div className="ml-2">
              {channel.categories.length === 0 ? (
                <div className={`${currentTheme.muted} italic`}>No categories available</div>
              ) : (
                channel.categories.map(category => {
                  if (category.id === 'universal') {
                    return category.channels?.map(ch => (
                      <div 
                        key={ch.id}
                        onClick={() => handleChannelSwitch(ch.id)}
                        className={`cursor-pointer mb-2 ${
                          channel.currentChannel === ch.id
                            ? currentTheme.highlight
                            : `${currentTheme.cyan} ${currentTheme.button}`
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
                            ? currentTheme.highlight
                            : `${currentTheme.text} ${currentTheme.button}`
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
                          className={`cursor-pointer ${currentTheme.accent} ${currentTheme.button} font-medium flex-1`}
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
                                  ? currentTheme.highlight
                                  : `${currentTheme.text} ${currentTheme.button}`
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
          <div className={`border-b ${currentTheme.border} p-2`}>
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
                  channel.joinStatus === 'joining' ? currentTheme.highlight :
                  channel.joinStatus === 'success' ? currentTheme.success : currentTheme.error
                }`}>
                  *** {
                    channel.joinStatus === 'joining' ? `JOINING #${channel.joiningChannelName.toUpperCase()}...` :
                    channel.joinStatus === 'success' ? `JOINED #${channel.joiningChannelName.toUpperCase()} SUCCESSFULLY` :
                    `FAILED TO JOIN #${channel.joiningChannelName.toUpperCase()}`
                  } ***
                </div>
              )}
              {channel.currentTopic && (
                <div className={`hidden sm:block ${currentTheme.cyan}`}>*** TOPIC: {channel.currentTopic.toUpperCase()} ***</div>
              )}
              {channel.currentMotd && (
                <div className={`hidden sm:block ${currentTheme.purple}`}>*** MOTD: {channel.currentMotd} ***</div>
              )}
              {!auth.authUser && (
                <div className={currentTheme.highlight}>*** YOU ARE LURKING - LOGIN TO PARTICIPATE ***</div>
              )}
              {[...chat.messages, ...chat.localMessages].sort((a, b) => 
                new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
              ).map(message => {
                const time = new Date(message.timestamp).toLocaleTimeString('en-US', { hour12: false });
                const userColor = users.getUserRoleColor(message.username);
                return (
                  <div key={message.id} className={`${currentTheme.text} break-words`}>
                    <span className="hidden sm:inline">{time} </span>&lt;<span className={userColor}>{message.username.toUpperCase()}</span>&gt; {formatMessageContent(message.content)}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Command Autocomplete */}
          {auth.authUser && commands.showCommandSuggestions && (
            <div className={`border-t ${currentTheme.border} ${currentTheme.background} max-h-48 overflow-y-auto command-suggestions`} style={{
              scrollbarWidth: 'thin',
              scrollbarColor: '#4b5563 #1f2937'
            }}>
              {commands.commandSuggestions.map((suggestion, index) => (
                <div
                  key={suggestion.command}
                  onClick={() => selectSuggestion(index)}
                  className={`p-2 cursor-pointer border-b ${currentTheme.border} ${
                    index === commands.selectedSuggestion 
                      ? `bg-gray-700 ${currentTheme.highlight}` 
                      : `${currentTheme.text} hover:bg-gray-800`
                  }`}
                >
                  <div className="font-mono text-xs">
                    <span className={currentTheme.highlight}>
                      {suggestion.command === '__help_only__' ? 'Type reason...' : `/${suggestion.command}`}
                    </span>
                    <div className={`${currentTheme.muted} text-xs mt-1`}>
                      {suggestion.description}
                      {suggestion.requiresRole && (
                        <span className={`ml-2 ${currentTheme.error}`}>
                          ({suggestion.requiresRole}+ only)
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              <div className={`p-1 text-xs ${currentTheme.muted} text-center border-b ${currentTheme.border}`}>
                ↑↓ Navigate • TAB/ENTER Select • ESC Cancel
              </div>
            </div>
          )}

          {/* Input Line */}
          <div className={`border-t ${currentTheme.border} p-2`}>
            {auth.authUser ? (
              <div className="flex items-center">
                <span className={`${currentTheme.accent} hidden sm:inline`}>[#{channel.getCurrentChannelName().toUpperCase()}]&gt; </span>
                <span className={`${currentTheme.accent} sm:hidden`}>&gt; </span>
                <textarea 
                  value={ui.inputMessage}
                  onChange={(e) => handleInputChange(e.target.value)}
                  onKeyDown={handleKeyDown}
                  className={`flex-1 ${currentTheme.input} outline-none ml-2 resize-none overflow-y-auto flex items-center`}
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
                  className={`${currentTheme.highlight} hover:text-yellow-300 text-center`}
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
            <div className={`w-48 h-full ${currentTheme.background} border-l ${currentTheme.border} p-4 ml-auto`} onClick={(e) => e.stopPropagation()}>
              {(() => {
                const displayUsers = users.displayUsers;
                const userCount = displayUsers.length;
                
                return (
                  <>
                    <div className="flex justify-between items-center mb-4">
                      <div className={currentTheme.accent}>
                        USERS ({userCount}):
                      </div>
                      <button onClick={() => ui.setShowUsers(false)} className={currentTheme.error}>[X]</button>
                    </div>
                    <div className="space-y-1">
                      {displayUsers.map((user, index) => {
                        const member = channel.channelMembers.find(m => m.user_id === user.id);
                        const roleColor = member ? channel.getRoleColor(member) : currentTheme.text;
                        
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
        <div className={`hidden lg:block w-64 lg:w-72 border-l ${currentTheme.border} p-4 flex-shrink-0 overflow-auto user-list`} style={{
          scrollbarWidth: 'thin',
          scrollbarColor: '#1f2937 #000000'
        }}>
          {(() => {
            const displayUsers = users.displayUsers;
            const userCount = displayUsers.length;
            
            return (
              <>
                <div className={`${currentTheme.accent} mb-4`}>
                  USERS ({userCount}):
                </div>
                <div className="space-y-1">
                  {displayUsers.map((user, index) => {
                    const member = channel.channelMembers.find(m => m.user_id === user.id);
                    const roleColor = member ? channel.getRoleColor(member) : currentTheme.text;
                    
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
      <div className={`border-t ${currentTheme.border} p-2 flex justify-between items-center flex-shrink-0`}>
        <ThemeSelector />
        <div className="text-xs font-mono">
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

      {/* Email Confirmation Popup */}
      {auth.emailConfirmed && (
        <div className="fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center z-50">
          <div className={`${currentTheme.modal} ${currentTheme.border} border p-6 max-w-md w-full mx-4`}>
            <div className={`${currentTheme.text} font-mono text-sm text-center`}>
              <div className={`${currentTheme.accent} mb-4`}>
                === EMAIL CONFIRMED ===
              </div>
              <div className={`${currentTheme.text} mb-4`}>
                YOUR EMAIL HAS BEEN SUCCESSFULLY CONFIRMED!
              </div>
              <div className={`${currentTheme.muted} mb-6 text-xs`}>
                PLEASE LOG IN TO CONTINUE
              </div>
              <button
                onClick={() => {
                  auth.setEmailConfirmed(false);
                  auth.setShowAuthModal(true);
                }}
                className={`w-full bg-green-400 text-black p-2 ${currentTheme.button}`}
              >
                CONTINUE TO LOGIN
              </button>
            </div>
          </div>
        </div>
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
'use client';

import { useEffect, useCallback, Suspense, useState } from 'react';
import AuthModal from '@/components/AuthModal';
import CreateCategoryModal from '@/components/CreateCategoryModal';
import CreateChannelModal from '@/components/CreateChannelModal';
import ThemeSelector from '@/components/ThemeSelector';
import PrivacyCenter from '@/components/PrivacyCenter';
import CookieConsent from '@/components/CookieConsent';
import TrackingStatus from '@/components/TrackingStatus';
import ChannelInfo from '@/components/ChannelInfo';
import { useTheme, themes } from '@/components/ThemeProvider';
import { useAuth } from '@/hooks/useAuth';
import { useChannel } from '@/hooks/useChannel';
import { useChat } from '@/hooks/useChat';
import { useCommands } from '@/hooks/useCommands';
import { useUsers } from '@/hooks/useUsers';
import { useUI } from '@/hooks/useUI';
import { NotificationProvider, useNotification } from '@/contexts/NotificationContext';

function HomeContent() {
  const { theme } = useTheme();
  const currentTheme = themes[theme];
  const auth = useAuth();
  const { notification } = useNotification();
  const ui = useUI();
  const [showPrivacyCenter, setShowPrivacyCenter] = useState(false);
  
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
    channel.setCurrentMotd,
    channel.fetchChannelMembers,
    chat.channel
  );

  const users = useUsers(chat.users, channel.channelMembers);

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
    // Clear messages first
    chat.clearMessages();
    
    // Switch channel
    await channel.switchChannel(channelId);
    
    // Always load messages regardless of switch result
    await chat.loadChannelMessages(channelId);
    
    // Then join realtime channel
    await chat.joinChannel(channelId);
  }, [chat, channel]);

  useEffect(() => {
    if (!auth.loading) {
      // Use optimized initial data fetch to reduce API calls
      if (auth.userId) {
        channel.fetchInitialData();
      } else {
        // Fallback for when user is not logged in - only fetch basic channels
        channel.fetchCategoriesAndChannels();
      }
    }
    // Only run when auth is ready
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth.loading]);

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

  // No automatic scroll effects here - handled in loadChannelMessages only

  const sendMessage = async () => {
    if (chat.channel && ui.inputMessage.trim() && auth.authUser) {
      const trimmedInput = ui.inputMessage.trim();

      // Check if user is subscribed to the channel (has membership)
      const isSubscribed = channel.isUserSubscribed(channel.currentChannel);
      if (!isSubscribed) {
        const errorMsg = {
          id: `membership_error_${Date.now()}`,
          username: 'SYSTEM',
          content: 'You must join this channel to send messages. Click [JOIN CHANNEL] to become a member.',
          timestamp: new Date(),
          channel: channel.currentChannel
        };
        chat.setLocalMessages(prev => [...prev, errorMsg]);
        ui.clearInput();
        return;
      }

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

      // Clear input immediately for snappy UX
      ui.clearInput();
      
      const success = await chat.sendMessage(trimmedInput, commands.handleCommand);
      if (!success) {
        // If sending failed, restore the message
        ui.setInputMessage(trimmedInput);
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
        
        // Handle @ mention suggestions
        const atIndex = ui.inputMessage.lastIndexOf('@');
        if (atIndex >= 0) {
          const beforeAt = ui.inputMessage.substring(0, atIndex + 1);
          const afterAt = ui.inputMessage.substring(atIndex + 1);
          
          // Only replace if we're currently typing after @
          if (!afterAt.includes(' ')) {
            ui.setInputMessage(beforeAt + selectedCommand.command + ' ');
            commands.setShowCommandSuggestions(false);
            return;
          }
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
        else if (['ban', 'setrole', 'mod', 'unmod', 'deleterole'].includes(currentCommand) && parts.length >= 2) {
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
        commands.setSelectedSuggestion(prev => {
          const newIndex = prev < commands.commandSuggestions.length - 1 ? prev + 1 : 0;
          // Scroll to the selected suggestion
          setTimeout(() => {
            const selectedElement = document.getElementById(`suggestion-${newIndex}`);
            if (selectedElement) {
              selectedElement.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }
          }, 0);
          return newIndex;
        });
        break;
      case 'ArrowUp':
        e.preventDefault();
        commands.setSelectedSuggestion(prev => {
          const newIndex = prev > 0 ? prev - 1 : commands.commandSuggestions.length - 1;
          // Scroll to the selected suggestion
          setTimeout(() => {
            const selectedElement = document.getElementById(`suggestion-${newIndex}`);
            if (selectedElement) {
              selectedElement.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }
          }, 0);
          return newIndex;
        });
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
          
          // Handle @ mention suggestions
          const atIndex = ui.inputMessage.lastIndexOf('@');
          if (atIndex >= 0) {
            const beforeAt = ui.inputMessage.substring(0, atIndex + 1);
            const afterAt = ui.inputMessage.substring(atIndex + 1);
            
            // Only replace if we're currently typing after @
            if (!afterAt.includes(' ')) {
              ui.setInputMessage(beforeAt + selectedCommand.command + ' ');
              commands.setShowCommandSuggestions(false);
              if (e.key === 'Tab') {
                return;
              }
              break;
            }
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
          else if (['ban', 'setrole', 'mod', 'unmod', 'deleterole'].includes(currentCommand) && parts.length >= 2) {
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
    
    // Handle @ mention suggestions
    const atIndex = ui.inputMessage.lastIndexOf('@');
    if (atIndex >= 0) {
      const beforeAt = ui.inputMessage.substring(0, atIndex + 1);
      const afterAt = ui.inputMessage.substring(atIndex + 1);
      
      // Only replace if we're currently typing after @
      if (!afterAt.includes(' ')) {
        ui.setInputMessage(beforeAt + selectedCommand.command + ' ');
        commands.setShowCommandSuggestions(false);
        return;
      }
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
    else if (['ban', 'setrole', 'mod', 'unmod', 'deleterole'].includes(currentCommand) && parts.length >= 2) {
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

  if (auth.loading) {
    return (
      <div className={`h-screen w-screen ${currentTheme.background} ${currentTheme.text} font-mono text-xs sm:text-sm overflow-hidden fixed inset-0 flex items-center justify-center`}>
        <div>Loading...</div>
      </div>
    );
  }

  if (auth.showAuthModal) {
    return <AuthModal onAuthSuccess={auth.handleAuthSuccess} onCancel={() => auth.setShowAuthModal(false)} />;
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
                  className={`${currentTheme.accent} ${currentTheme.button} select-none`}
                  title="Create Category"
                >
                  [+CAT]
                </button>
                <button 
                  onClick={() => ui.handleCreateChannel()}
                  className={`${currentTheme.accent} ${currentTheme.button} select-none`}
                  title="Create Channel"
                >
                  [+CH]
                </button>
              </>
            )}
          </div>
          
          {/* Center notification */}
          <div className="flex-1 text-center">
            {notification && (
              <span className={`${currentTheme.accent} font-mono select-none`}>
                {notification}
              </span>
            )}
          </div>
          
          <div className="flex gap-2">
            {auth.authUser ? (
              <>
                <span className={`${currentTheme.accent} select-none`}>{auth.username.toUpperCase()}</span>
                <button 
                  onClick={auth.handleLogout}
                  className="text-red-400 hover:text-red-300 select-none"
                >
                  [LOGOUT]
                </button>
              </>
            ) : (
              <button 
                onClick={() => auth.setShowAuthModal(true)}
                className={`${currentTheme.text} hover:text-green-300 select-none`}
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
            className="text-green-300 hover:text-yellow-400 select-none"
          >
            [CHANNELS]
          </button>
          <div className={`text-center ${currentTheme.accent} select-none`}>IRC CHAT</div>
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
              className={`${currentTheme.accent} ${currentTheme.button} select-none`}
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
            <div className={`w-64 h-full ${currentTheme.background} border-r ${currentTheme.border} flex flex-col`} onClick={(e) => e.stopPropagation()}>
              <div className="flex justify-between items-center p-4 border-b border-gray-600 flex-shrink-0">
                <div className="w-10"></div>
                <div className={`${currentTheme.accent} text-center select-none`}>[ CHANNELS ]</div>
                <div className="flex gap-2 w-10">
                  <button 
                    onClick={() => channel.refreshChannels()}
                    className={`${currentTheme.accent} ${currentTheme.button} text-xs select-none`}
                    title="Refresh channels, mentions and unread counts"
                  >
                    {channel.isRefreshing ? '[✓]' : '[↻]'}
                  </button>
                  <button onClick={() => ui.setShowSidebar(false)} className={`${currentTheme.error} select-none`}>[X]</button>
                </div>
              </div>
              <div className="flex-1 p-4 overflow-auto" style={{
                scrollbarWidth: 'thin',
                scrollbarColor: currentTheme.scrollbar,
                maxHeight: 'calc(100vh - 120px)' // Account for header and footer
              }}>
              <div className="ml-2">
                {channel.getDisplayCategories().length === 0 ? (
                  <div className={`${currentTheme.muted} italic`}>No categories available</div>
                ) : (
                  channel.getDisplayCategories().map(category => {
                    if (category.id === 'universal') {
                      return category.channels?.map(ch => (
                        <div 
                          key={ch.id}
                          onClick={() => {
                            handleChannelSwitch(ch.id);
                            ui.setShowSidebar(false);
                          }}
                          className={`cursor-pointer mb-2 select-none ${
                            channel.currentChannel === ch.id
                              ? currentTheme.highlight
                              : `${currentTheme.text} ${currentTheme.button}`
                          }`}
                        >
                          <span className="flex items-center justify-between">
                            <span className="flex items-center min-w-0">
                              <span className="w-4 flex-shrink-0">{channel.currentChannel === ch.id ? '>' : ''}</span>
                              <span className="truncate">#{ch.name.toUpperCase()}</span>
                            </span>
                            <span className="flex items-center gap-1">
                              {channel.unreadCounts[ch.id] && (
                                <span className="bg-blue-600 text-white text-xs px-1 py-0.5 rounded">
                                  {channel.unreadCounts[ch.id]}
                                </span>
                              )}
                              {channel.unreadMentions[ch.id] && (
                                <span className="bg-red-600 text-white text-xs px-1 py-0.5 rounded">
                                  @{channel.unreadMentions[ch.id]}
                                </span>
                              )}
                            </span>
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
                          className={`cursor-pointer mb-1 select-none ${
                            channel.currentChannel === ch.id
                              ? currentTheme.highlight
                              : `${currentTheme.text} ${currentTheme.button}`
                          }`}
                        >
                          <span className="flex items-center justify-between">
                            <span className="flex items-center min-w-0">
                              <span className="w-4 flex-shrink-0">{channel.currentChannel === ch.id ? '>' : ''}</span>
                              <span className="truncate">#{ch.name.toUpperCase()}</span>
                            </span>
                            <span className="flex items-center gap-1">
                              {channel.unreadCounts[ch.id] && (
                                <span className="bg-blue-600 text-white text-xs px-1 py-0.5 rounded">
                                  {channel.unreadCounts[ch.id]}
                                </span>
                              )}
                              {channel.unreadMentions[ch.id] && (
                                <span className="bg-red-600 text-white text-xs px-1 py-0.5 rounded">
                                  @{channel.unreadMentions[ch.id]}
                                </span>
                              )}
                            </span>
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
                          <span className="truncate">
                            {channel.expandedCategories.has(category.id) ? '[-]' : '[+]'} {category.name.toUpperCase()}
                          </span>
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
                                className={`cursor-pointer ml-4 select-none ${
                                  channel.currentChannel === ch.id
                                    ? currentTheme.highlight
                                    : `${currentTheme.text} ${currentTheme.button}`
                                }`}
                              >
                                <span className="flex items-center justify-between">
                                  <span className="flex items-center min-w-0">
                                    <span className="flex-shrink-0">{channel.currentChannel === ch.id ? '> ' : '  '}</span>
                                    <span className="truncate">#{ch.name.toUpperCase()}</span>
                                  </span>
                                  <span className="flex items-center gap-1 ml-2">
                                    {channel.unreadCounts[ch.id] && (
                                      <span className="bg-blue-600 text-white text-xs px-1 py-0.5 rounded">
                                        {channel.unreadCounts[ch.id]}
                                      </span>
                                    )}
                                    {channel.unreadMentions[ch.id] && (
                                      <span className="bg-red-600 text-white text-xs px-1 py-0.5 rounded">
                                        @{channel.unreadMentions[ch.id]}
                                      </span>
                                    )}
                                  </span>
                                </span>
                              </div>
                            ))
                          )
                        )}
                      </div>
                    );
                  })
                )}
                {/* Load More Channels Button */}
                {channel.hasMoreChannels && (
                  <div className="mt-4 px-2">
                    <button 
                      onClick={channel.loadMoreChannels}
                      className={`w-full text-center py-2 ${currentTheme.accent} ${currentTheme.button} text-xs select-none`}
                    >
                      LOAD MORE ({channel.totalChannelCount - channel.displayedChannelCount} remaining)
                    </button>
                  </div>
                )}
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
              <div className={`${currentTheme.accent} text-center select-none`}>[ CHANNELS ]</div>
              <button 
                onClick={() => channel.refreshChannels()}
                className={`${currentTheme.accent} ${currentTheme.button} text-xs w-6`}
                title="Refresh channels, mentions and unread counts"
              >
                {channel.isRefreshing ? '[✓]' : '[↻]'}
              </button>
            </div>
          </div>
          {/* Channel List */}
          <div className="flex-1 p-4 overflow-auto" style={{
            scrollbarWidth: 'thin',
            scrollbarColor: currentTheme.scrollbar,
            maxHeight: 'calc(100vh - 120px)' // Account for header and footer
          }}>
            <div className="ml-2">
              {channel.getDisplayCategories().length === 0 ? (
                <div className={`${currentTheme.muted} italic`}>No categories available</div>
              ) : (
                channel.getDisplayCategories().map(category => {
                  if (category.id === 'universal') {
                    return category.channels?.map(ch => (
                      <div 
                        key={ch.id}
                        onClick={() => handleChannelSwitch(ch.id)}
                        className={`cursor-pointer mb-2 select-none ${
                          channel.currentChannel === ch.id
                            ? currentTheme.highlight
                            : `${currentTheme.text} ${currentTheme.button}`
                        }`}
                      >
                        <span className="flex items-center justify-between">
                          <span className="flex items-center min-w-0">
                            <span className="w-4 flex-shrink-0">{channel.currentChannel === ch.id ? '>' : ''}</span>
                            <span className="truncate">#{ch.name.toUpperCase()}</span>
                          </span>
                          <span className="flex items-center gap-1">
                            {channel.unreadCounts[ch.id] && (
                              <span className="bg-blue-600 text-white text-xs px-1 py-0.5 rounded">
                                {channel.unreadCounts[ch.id]}
                              </span>
                            )}
                            {channel.unreadMentions[ch.id] && (
                              <span className="bg-red-600 text-white text-xs px-1 py-0.5 rounded">
                                @{channel.unreadMentions[ch.id]}
                              </span>
                            )}
                          </span>
                        </span>
                      </div>
                    ));
                  }
                  
                  if (category.id === 'no-category') {
                    return category.channels?.map(ch => (
                      <div 
                        key={ch.id}
                        onClick={() => handleChannelSwitch(ch.id)}
                        className={`cursor-pointer mb-1 select-none ${
                          channel.currentChannel === ch.id
                            ? currentTheme.highlight
                            : `${currentTheme.text} ${currentTheme.button}`
                        }`}
                      >
                        <span className="flex items-center justify-between">
                          <span className="flex items-center min-w-0">
                            <span className="w-4 flex-shrink-0">{channel.currentChannel === ch.id ? '>' : ''}</span>
                            <span className="truncate">#{ch.name.toUpperCase()}</span>
                          </span>
                          <span className="flex items-center gap-1">
                            {channel.unreadCounts[ch.id] && (
                              <span className="bg-blue-600 text-white text-xs px-1 py-0.5 rounded">
                                {channel.unreadCounts[ch.id]}
                              </span>
                            )}
                            {channel.unreadMentions[ch.id] && (
                              <span className="bg-red-600 text-white text-xs px-1 py-0.5 rounded">
                                @{channel.unreadMentions[ch.id]}
                              </span>
                            )}
                          </span>
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
                          <span className="truncate">
                            {channel.expandedCategories.has(category.id) ? '[-]' : '[+]'} {category.name.toUpperCase()}
                          </span>
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
                              className={`cursor-pointer ml-4 select-none ${
                                channel.currentChannel === ch.id
                                  ? currentTheme.highlight
                                  : `${currentTheme.text} ${currentTheme.button}`
                              }`}
                            >
                              <span className="flex items-center justify-between">
                                <span className="flex items-center min-w-0">
                                  <span className="w-4 flex-shrink-0">{channel.currentChannel === ch.id ? '>' : ''}</span>
                                  <span className="truncate">#{ch.name.toUpperCase()}</span>
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
              {/* Load More Channels Button */}
              {channel.hasMoreChannels && (
                <div className="mt-4 px-2">
                  <button 
                    onClick={channel.loadMoreChannels}
                    className={`w-full text-center py-2 ${currentTheme.accent} ${currentTheme.button} text-xs select-none`}
                  >
                    LOAD MORE ({channel.totalChannelCount - channel.displayedChannelCount} remaining)
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Main Terminal */}
        <div className="flex-1 flex flex-col min-w-0 min-h-0">
          {/* Channel Info */}
          <div className="hidden sm:block">
            <ChannelInfo
              channelName={channel.getCurrentChannelName()}
              topic={channel.currentTopic}
              motd={channel.currentMotd}
              memberCount={users.displayUsers.length}
              joinStatus={channel.joinStatus}
              joiningChannelName={channel.joiningChannelName}
              isSubscribed={channel.isUserSubscribed(channel.currentChannel)}
              onSubscribe={() => channel.subscribeToChannel(channel.currentChannel)}
              onUnsubscribe={() => channel.unsubscribeFromChannel(channel.currentChannel)}
              isAuthUser={!!auth.authUser}
              channelId={channel.currentChannel}
            />
          </div>
          {/* Mobile Header - Simplified */}
          <div className={`sm:hidden border-b ${currentTheme.border} p-2`}>
            <div className="text-center">
              <div className="truncate px-2">
                #{channel.getCurrentChannelName().toUpperCase()}
              </div>
            </div>
          </div>

          {/* Chat Area */}
          <div 
            className="flex-1 p-2 sm:p-4 overflow-y-auto chat-area min-h-0" 
            style={{
              scrollbarWidth: 'thin',
              scrollbarColor: currentTheme.scrollbar
            }}
            onScroll={chat.checkScrollPosition}
          >
            <div className="space-y-1">
              {/* Load More Button */}
              {chat.hasMoreMessages && (
                <div className="text-center py-2">
                  <button
                    onClick={() => chat.loadMoreMessages(channel.currentChannel)}
                    disabled={chat.isLoadingMore}
                    className={`${currentTheme.accent} ${currentTheme.button} px-4 py-2 ${
                      chat.isLoadingMore ? 'opacity-50 cursor-not-allowed' : ''
                    }`}
                  >
                    {chat.isLoadingMore ? 'LOADING...' : 'LOAD MORE MESSAGES'}
                  </button>
                </div>
              )}
              
              {/* No More Messages Indicator */}
              {!chat.hasMoreMessages && chat.messages.length > 100 && (
                <div className={`text-center py-2 ${currentTheme.muted} text-xs`}>
                  <div>*** NO MORE MESSAGES ***</div>
                </div>
              )}
              
              {[...chat.messages, ...chat.localMessages].sort((a, b) => 
                new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
              ).map(message => {
                const time = new Date(message.timestamp).toLocaleTimeString('en-US', { hour12: false });
                const userColor = users.getUserRoleColor(message.username);
                return (
                  <div key={message.id} className={`message-item ${currentTheme.text} break-words`}>
                    <span className="hidden sm:inline">{time} </span>&lt;<span className={userColor}>{message.username.toUpperCase()}</span>&gt; {formatMessageContent(message.content)}
                  </div>
                );
              })}
            </div>
            
            {/* New Messages Indicator */}
            {chat.hasNewMessages && !chat.isAtBottom && (
              <div className="fixed bottom-20 left-1/2 transform -translate-x-1/2 z-10">
                <button 
                  onClick={() => chat.scrollToBottom(true)}
                  className={`${currentTheme.accent} ${currentTheme.button} px-4 py-2 rounded shadow-lg animate-pulse`}
                >
                  ↓ NEW MESSAGES ↓
                </button>
              </div>
            )}
          </div>

          {/* Input Line */}
          <div className={`relative border-t ${currentTheme.border} p-2 cursor-text`} onClick={() => {
            const textarea = document.querySelector('textarea');
            if (textarea) textarea.focus();
          }}>
            {auth.authUser ? (
              <div className="flex items-center">
                <span className={`${currentTheme.accent} hidden sm:inline`}>[#{channel.getCurrentChannelName().toUpperCase()}]&gt; </span>
                <span className={`${currentTheme.accent} sm:hidden`}>&gt; </span>
                <textarea 
                  value={ui.inputMessage}
                  onChange={(e) => {
                    handleInputChange(e.target.value);
                    // Auto-resize textarea
                    e.target.style.height = '1.5rem';
                    e.target.style.height = Math.min(e.target.scrollHeight, 72) + 'px'; // max 4.5rem = 72px
                  }}
                  onKeyDown={handleKeyDown}
                  className={`flex-1 ${currentTheme.input} outline-none ml-2 resize-none overflow-y-auto ${!channel.isUserSubscribed(channel.currentChannel) ? 'opacity-50' : ''}`}
                  placeholder={
                    !channel.isUserSubscribed(channel.currentChannel) 
                      ? "JOIN CHANNEL TO SEND MESSAGES..." 
                      : channel.userRole === 'owner' || channel.userRole === 'moderator' 
                        ? "TYPE MESSAGE OR COMMAND (/help for commands)..." 
                        : "TYPE MESSAGE..."
                  }
                  disabled={!channel.isUserSubscribed(channel.currentChannel)}
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
            
            {/* Command Autocomplete */}
            {auth.authUser && commands.showCommandSuggestions && (
              <div 
                className={`absolute bottom-full left-0 right-0 border ${currentTheme.border} ${currentTheme.background} z-50 shadow-lg flex flex-col command-suggestions`} 
                style={{ 
                  maxHeight: 'min(60vh, 240px)',
                  minHeight: commands.commandSuggestions.length >= 4 ? '200px' : 'auto'
                }}
              >
                <div className={`flex-1 overflow-y-auto`} style={{
                  scrollbarWidth: 'thin',
                  scrollbarColor: currentTheme.scrollbar
                }}>
                  {commands.commandSuggestions.map((suggestion, index) => (
                    <div
                      key={suggestion.command}
                      id={`suggestion-${index}`}
                      onClick={() => selectSuggestion(index)}
                      className={`p-2 cursor-pointer border-b select-none ${currentTheme.border} ${
                        index === commands.selectedSuggestion 
                          ? `${currentTheme.suggestionSelected} ${currentTheme.highlight}` 
                          : `${currentTheme.text} ${currentTheme.suggestionHover}`
                      }`}
                    >
                      <div className="font-mono text-xs">
                        <span className={currentTheme.highlight}>
                          {suggestion.command === '__help_only__' 
                            ? 'Type reason...' 
                            : suggestion.isUser || suggestion.isRole 
                              ? suggestion.command 
                              : suggestion.isColor
                                ? suggestion.command
                                : `/${suggestion.command}`}
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
                </div>
                <div className={`p-1 text-xs ${currentTheme.muted} text-center border-t ${currentTheme.border} bg-opacity-95 ${currentTheme.background}`}>
                  ↑↓ Navigate • TAB/ENTER Select • ESC Cancel
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Mobile Users Overlay */}
        {ui.showUsers && (
          <div className="absolute inset-0 bg-black bg-opacity-75 z-20 sm:hidden" onClick={() => ui.setShowUsers(false)}>
            <div className={`w-48 h-full ${currentTheme.background} border-l ${currentTheme.border} ml-auto flex flex-col`} onClick={(e) => e.stopPropagation()}>
              <div className="flex justify-between items-center p-4 border-b border-gray-600 flex-shrink-0">
                <div className={`${currentTheme.accent} select-none`}>
                  USERS ({users.totalUserCount}):
                </div>
                <button onClick={() => ui.setShowUsers(false)} className={`${currentTheme.error} select-none`}>[X]</button>
              </div>
              <div className="flex-1 p-4 overflow-auto" style={{
                scrollbarWidth: 'thin',
                scrollbarColor: currentTheme.scrollbar,
                maxHeight: 'calc(100vh - 120px)' // Account for header and footer
              }}>
              {(() => {
                const displayUsers = users.displayUsers;
                
                return (
                  <>
                    <div className="space-y-1">
                      {displayUsers.map((user, index) => {
                        return (
                          <div key={`mobile-user-${user.id}-${index}`} className={user.roleColor}>
                            {user.username.toUpperCase()}
                          </div>
                        );
                      })}
                      {users.hasMoreUsers && (
                        <div className="pt-2">
                          <button 
                            onClick={users.loadMoreUsers}
                            className={`w-full text-center py-2 ${currentTheme.accent} ${currentTheme.button} text-xs select-none`}
                          >
                            LOAD MORE ({users.totalUserCount - users.displayedUserCount} remaining)
                          </button>
                        </div>
                      )}
                    </div>
                  </>
                );
              })()}
              </div>
            </div>
          </div>
        )}

        {/* Desktop User List */}
        <div className={`hidden lg:block w-64 lg:w-72 border-l ${currentTheme.border} flex-shrink-0 flex flex-col`}>
          {/* User Header */}
          <div className={`border-b ${currentTheme.border} p-2 flex-shrink-0`}>
            <div className={`${currentTheme.accent} text-center select-none`}>[ USERS ({users.totalUserCount}) ]</div>
          </div>
          {/* User List */}
          <div className="flex-1 p-4 overflow-auto user-list" style={{
            scrollbarWidth: 'thin',
            scrollbarColor: currentTheme.scrollbar,
            maxHeight: 'calc(100vh - 120px)' // Account for header and footer
          }}>
            {(() => {
              const displayUsers = users.displayUsers;
              
              return (
                <>
                <div className="space-y-1">
                  {displayUsers.map((user, index) => {
                    return (
                      <div key={`desktop-user-${user.id}-${index}`} className={user.roleColor}>
                        {user.username.toUpperCase()}
                      </div>
                    );
                  })}
                  {users.hasMoreUsers && (
                    <div className="pt-2">
                      <button 
                        onClick={users.loadMoreUsers}
                        className={`w-full text-center py-2 ${currentTheme.accent} ${currentTheme.button} text-xs select-none`}
                      >
                        LOAD MORE ({users.totalUserCount - users.displayedUserCount} remaining)
                      </button>
                    </div>
                  )}
                </div>
              </>
            );
          })()}
          </div>
        </div>
      </div>

      {/* Bottom Status */}
      <div className={`border-t ${currentTheme.border} p-2 flex justify-between items-center flex-shrink-0`}>
        <div className="flex items-center gap-2">
          <ThemeSelector />
          <button
            onClick={() => setShowPrivacyCenter(true)}
            className={`${currentTheme.accent} ${currentTheme.button} text-xs select-none`}
            title="Privatlivspolitik og Cookie Indstillinger"
          >
            [INFO]
          </button>
        </div>
        <div 
          className="text-xs font-mono select-none" 
          title={chat.connected 
            ? "CONNECTED - Receiving messages instantly via realtime connection" 
            : "DISCONNECTED - Realtime unavailable, refresh page for new messages"}
        >
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

      {/* Privacy Center */}
      {showPrivacyCenter && (
        <PrivacyCenter onClose={() => setShowPrivacyCenter(false)} />
      )}

      {/* Cookie Consent */}
      <CookieConsent onConsentChange={() => {}} />

      {/* Tracking Status */}
      <TrackingStatus />

    </div>
  );
}

export default function Home() {
  return (
    <NotificationProvider>
      <Suspense fallback={<div className="h-screen bg-black text-green-400 flex items-center justify-center">Loading...</div>}>
        <HomeContent />
      </Suspense>
    </NotificationProvider>
  );
}
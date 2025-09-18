'use client';

import { useTheme, themes } from './ThemeProvider';

interface ChannelInfoProps {
  channelName: string;
  topic?: string;
  motd?: string;
  memberCount?: number; // Optional since we don't use it
  joinStatus?: 'joining' | 'success' | 'failed' | null;
  joiningChannelName?: string;
  isSubscribed?: boolean;
  onSubscribe?: () => void;
  onUnsubscribe?: () => void;
  isAuthUser?: boolean;
  channelId?: string;
}

export default function ChannelInfo({ 
  channelName, 
  topic, 
  motd, 
  joinStatus, 
  joiningChannelName,
  isSubscribed,
  onSubscribe,
  onUnsubscribe,
  isAuthUser,
  channelId
}: ChannelInfoProps) {
  const { theme } = useTheme();
  const currentTheme = themes[theme];

  return (
    <div className={`border-b ${currentTheme.border} p-2 space-y-1 relative`}>
      {/* Channel Name */}
      <div className="flex items-center justify-center relative">
        <div className="text-center flex-shrink-0">
          <div className="truncate select-none">
            === CONNECTED TO #{channelName.toUpperCase()} ===
          </div>
        </div>
        
        {/* Subscribe/Unsubscribe Button */}
        {isAuthUser && channelId && (
          <div className="absolute right-0 flex-shrink-0">
            {isSubscribed ? (
              <button
                onClick={onUnsubscribe}
                className="text-xs text-red-500 hover:text-red-700 cursor-pointer whitespace-nowrap select-none"
                title="Leave channel"
              >
                [LEAVE]
              </button>
            ) : (
              <button
                onClick={onSubscribe}
                className="text-xs text-green-600 hover:text-green-800 cursor-pointer whitespace-nowrap select-none"
                title="Join channel"
              >
                [JOIN CHANNEL]
              </button>
            )}
          </div>
        )}
      </div>

      {/* Channel Info Panel */}
      <div className="space-y-1 text-xs">
        {/* Join Status */}
        {joinStatus && joiningChannelName && (
          <div className={`${
            joinStatus === 'joining' ? currentTheme.highlight :
            joinStatus === 'success' ? currentTheme.success : currentTheme.error
          }`}>
            *** {
              joinStatus === 'joining' ? `CONNECTING TO #${joiningChannelName.toUpperCase()}...` :
              joinStatus === 'success' ? `CONNECTED TO #${joiningChannelName.toUpperCase()} SUCCESSFULLY` :
              `FAILED TO CONNECT TO #${joiningChannelName.toUpperCase()}`
            } ***
          </div>
        )}

        {/* Topic */}
        {topic && (
          <div className={`${currentTheme.cyan}`}>
            *** TOPIC: {topic.toUpperCase()} ***
          </div>
        )}

        {/* MOTD */}
        {motd && (
          <div className={`${currentTheme.purple}`}>
            *** MOTD: {motd} ***
          </div>
        )}

      </div>
    </div>
  );
}
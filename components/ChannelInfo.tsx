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
    <div className={`border-b ${currentTheme.border} p-2 space-y-1`}>
      {/* Channel Name */}
      <div className="flex items-center justify-between">
        <div className="flex-1 text-center">
          <div className="truncate">
            === CONNECTED TO #{channelName.toUpperCase()} ===
          </div>
        </div>
        
        {/* Subscribe/Unsubscribe Button */}
        {isAuthUser && channelId && (
          <div className="ml-2">
            {isSubscribed ? (
              <button
                onClick={onUnsubscribe}
                className={`px-2 py-1 text-xs border ${currentTheme.border} bg-red-600 hover:bg-red-700 text-white rounded`}
                title="Leave channel"
              >
                [LEAVE]
              </button>
            ) : (
              <button
                onClick={onSubscribe}
                className={`px-2 py-1 text-xs border ${currentTheme.border} bg-green-600 hover:bg-green-700 text-white rounded`}
                title="Join channel"
              >
                [JOIN]
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
              joinStatus === 'joining' ? `JOINING #${joiningChannelName.toUpperCase()}...` :
              joinStatus === 'success' ? `JOINED #${joiningChannelName.toUpperCase()} SUCCESSFULLY` :
              `FAILED TO JOIN #${joiningChannelName.toUpperCase()}`
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
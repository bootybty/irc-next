'use client';

import { useTheme, themes } from './ThemeProvider';

interface ChannelInfoProps {
  channelName: string;
  topic?: string;
  motd?: string;
  memberCount?: number; // Optional since we don't use it
  joinStatus?: 'joining' | 'success' | 'failed' | null;
  joiningChannelName?: string;
}

export default function ChannelInfo({ 
  channelName, 
  topic, 
  motd, 
  joinStatus, 
  joiningChannelName 
}: ChannelInfoProps) {
  const { theme } = useTheme();
  const currentTheme = themes[theme];

  return (
    <div className={`border-b ${currentTheme.border} p-2 space-y-1`}>
      {/* Channel Name */}
      <div className="text-center">
        <div className="truncate">
          === CONNECTED TO #{channelName.toUpperCase()} ===
        </div>
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
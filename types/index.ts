export interface AuthUser {
  id: string;
  username: string;
}

export interface Message {
  id: string;
  username: string;
  content: string;
  timestamp: Date;
  channel: string;
  created_at?: string;  // ISO string from database for queries
}

export interface User {
  id: string;
  username: string;
  currentChannel: string;
  role?: string;
  last_seen?: string;
}

export interface ChannelMember {
  user_id: string;
  channel_id: string;
  username: string;
  role: string;
  joined_at?: string;
  permissions?: Record<string, boolean>;
}

export interface ChannelRole {
  id: string;
  channel_id: string;
  name: string;
  color: string;
  permissions: Record<string, boolean>;
  created_at?: string;
}

export interface Channel {
  id: string;
  name: string;
  description?: string;
  category_id?: string;
  created_by?: string;
  created_at?: string;
  is_universal?: boolean;
}

export interface ChannelCategory {
  id: string;
  name: string;
  emoji?: string;
  color?: string;
  sort_order?: number;
  created_at?: string;
  channels?: Channel[];
}

export interface PendingDeleteChannel {
  channelId: string;
  channelName: string;
  requestedBy: string;
  requestedAt: Date;
}

export type MessageSetter = (setter: (prev: Message[]) => Message[]) => void;
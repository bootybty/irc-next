import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
})

// Types for our IRC data
export interface User {
  id: string;
  username: string;
  current_server: string;
  current_channel: string;
  last_seen: string;
}

export interface Message {
  id: string;
  channel_id: string;
  user_id: string;
  username: string;
  content: string;
  message_type: 'message' | 'action' | 'system';
  created_at: string;
}

export interface Channel {
  id: string;
  name: string;
  topic?: string;
  category_id?: string;
  created_by?: string;
  created_at: string;
}

export interface ChannelCategory {
  id: string;
  name: string;
  emoji: string;
  color: string;
  sort_order: number;
  created_at: string;
  channels?: Channel[];
}

export interface ChannelRole {
  id: string;
  channel_id: string;
  name: string;
  color: string;
  permissions: {
    can_kick?: boolean;
    can_ban?: boolean;
    can_manage_roles?: boolean;
    can_manage_channel?: boolean;
    can_delete_messages?: boolean;
  };
  sort_order: number;
  created_by: string;
  created_at: string;
}

export interface ChannelMember {
  id: string;
  channel_id: string;
  user_id: string;
  username: string;
  role: 'owner' | 'moderator' | 'admin' | 'member'; // Legacy field
  role_id?: string;
  joined_at: string;
  last_seen: string;
  channel_role?: ChannelRole;
}

export interface ChannelBan {
  id: string;
  channel_id: string;
  user_id: string;
  banned_by: string;
  reason?: string;
  banned_at: string;
  expires_at?: string;
}
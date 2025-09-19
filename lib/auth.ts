import { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export async function verifyAuth(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { user: null, error: 'Missing or invalid authorization header' };
  }

  const token = authHeader.replace('Bearer ', '');
  const supabase = createClient(supabaseUrl, supabaseAnonKey);
  
  const { data: { user }, error } = await supabase.auth.getUser(token);
  
  if (error || !user) {
    return { user: null, error: 'Invalid token or user not found' };
  }

  return { user, error: null };
}

export async function verifyChannelPermissions(
  userId: string,
  channelId: string,
  requiredRole: 'Owner' | 'Moderator'
) {
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!supabaseServiceKey) {
    console.error('SUPABASE_SERVICE_ROLE_KEY not found in environment');
    return false;
  }

  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });

  // Check if user has required role in channel
  const { data: memberData, error } = await supabaseAdmin
    .from('channel_members')
    .select('role')
    .eq('user_id', userId)
    .eq('channel_id', channelId)
    .single();

  if (error || !memberData) {
    return false;
  }

  // Check custom roles if member role is 'Custom'
  if (memberData.role === 'Custom') {
    const { data: customRole } = await supabaseAdmin
      .from('channel_roles')
      .select('permissions')
      .eq('channel_id', channelId)
      .eq('member_id', userId)
      .single();

    if (customRole?.permissions) {
      const perms = customRole.permissions as { moderate?: boolean };
      if (requiredRole === 'Moderator') {
        return perms.moderate === true;
      }
    }
    return false;
  }

  // Check standard roles
  if (requiredRole === 'Owner') {
    return memberData.role === 'Owner';
  }

  if (requiredRole === 'Moderator') {
    return memberData.role === 'Owner' || memberData.role === 'Moderator';
  }

  return false;
}
import { supabase } from './supabase';

export interface SiteAdmin {
  id: string;
  username: string;
  is_super_admin?: boolean;
  is_site_admin?: boolean;
  is_site_moderator?: boolean;
}

export interface SiteBan {
  id: string;
  user_id: string;
  banned_by: string;
  reason: string;
  banned_at: string;
  expires_at?: string;
  unbanned_at?: string;
}

export interface AdminLog {
  id: string;
  admin_id: string;
  action_type: string;
  target_user_id?: string;
  target_channel_id?: string;
  reason?: string;
  metadata?: Record<string, unknown>;
  created_at: string;
}

export interface AdminReport {
  id: string;
  reported_user_id: string;
  reported_by_id: string;
  message_id?: string;
  channel_id?: string;
  reason: string;
  status: 'pending' | 'reviewed' | 'resolved' | 'dismissed';
  reviewed_by?: string;
  reviewed_at?: string;
  admin_notes?: string;
  created_at: string;
}

// Check if user has admin privileges
export async function checkAdminPrivileges(userId: string): Promise<{
  is_super_admin: boolean;
  is_site_admin: boolean;
  is_site_moderator: boolean;
}> {
  const { data, error } = await supabase
    .from('users')
    .select('is_super_admin, is_site_admin, is_site_moderator')
    .eq('id', userId)
    .single();

  if (error || !data) {
    return { is_super_admin: false, is_site_admin: false, is_site_moderator: false };
  }

  return {
    is_super_admin: data.is_super_admin || false,
    is_site_admin: data.is_site_admin || false,
    is_site_moderator: data.is_site_moderator || false
  };
}

// Log admin action
export async function logAdminAction(
  adminId: string,
  actionType: string,
  targetUserId?: string,
  targetChannelId?: string,
  reason?: string,
  metadata?: Record<string, unknown>
) {
  const { error } = await supabase
    .from('admin_logs')
    .insert({
      admin_id: adminId,
      action_type: actionType,
      target_user_id: targetUserId,
      target_channel_id: targetChannelId,
      reason: reason,
      metadata: metadata
    });

  if (error) {
    console.error('Failed to log admin action:', error);
  }
}

// Site-wide ban
export async function siteBanUser(
  userId: string,
  bannedBy: string,
  reason: string,
  expiresAt?: Date
): Promise<{ success: boolean; error?: string }> {
  try {
    // Check if user is already banned
    const { data: existingBan } = await supabase
      .from('site_bans')
      .select('id')
      .eq('user_id', userId)
      .is('unbanned_at', null)
      .single();

    if (existingBan) {
      return { success: false, error: 'User is already banned' };
    }

    // Create the ban
    const { error: banError } = await supabase
      .from('site_bans')
      .insert({
        user_id: userId,
        banned_by: bannedBy,
        reason: reason,
        expires_at: expiresAt?.toISOString()
      });

    if (banError) {
      return { success: false, error: banError.message };
    }

    // Remove user from all channels
    const { error: removeError } = await supabase
      .from('channel_members')
      .delete()
      .eq('user_id', userId);

    if (removeError) {
      console.error('Failed to remove user from channels:', removeError);
    }

    // Log the action
    await logAdminAction(bannedBy, 'site_ban', userId, undefined, reason);

    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

// Site-wide unban
export async function siteUnbanUser(
  userId: string,
  unbannedBy: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase
      .from('site_bans')
      .update({ 
        unbanned_at: new Date().toISOString(),
        unbanned_by: unbannedBy 
      })
      .eq('user_id', userId)
      .is('unbanned_at', null);

    if (error) {
      return { success: false, error: error.message };
    }

    // Log the action
    await logAdminAction(unbannedBy, 'site_unban', userId);

    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

// Get user details for admin lookup
export async function lookupUser(username: string) {
  // First get user info
  const { data: user, error: userError } = await supabase
    .from('users')
    .select('*')
    .eq('username', username)
    .single();

  if (userError || !user) {
    return null;
  }

  // Get channel memberships
  const { data: memberships } = await supabase
    .from('channel_members')
    .select(`
      channel_id,
      role,
      joined_at,
      channels!inner(name)
    `)
    .eq('user_id', user.id);

  // Get message count
  const { count: messageCount } = await supabase
    .from('messages')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id);

  // Get recent messages count (last 24 hours)
  const yesterday = new Date();
  yesterday.setHours(yesterday.getHours() - 24);
  
  const { count: recentMessageCount } = await supabase
    .from('messages')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .gte('created_at', yesterday.toISOString());

  // Get reports against user
  const { data: reports } = await supabase
    .from('admin_reports')
    .select('*')
    .eq('reported_user_id', user.id)
    .eq('status', 'pending');

  // Check if banned
  const { data: ban } = await supabase
    .from('site_bans')
    .select('*')
    .eq('user_id', user.id)
    .is('unbanned_at', null)
    .single();

  return {
    user,
    memberships,
    messageCount,
    recentMessageCount,
    reports,
    ban,
    channels: memberships?.map(m => {
      const membership = m as unknown as { channels?: { name: string } };
      return membership.channels?.name;
    }).filter((name): name is string => Boolean(name)) || []
  };
}

// Promote user to admin/moderator
export async function promoteUser(
  userId: string,
  role: 'admin' | 'moderator',
  promotedBy: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const updateData = role === 'admin' 
      ? { is_site_admin: true }
      : { is_site_moderator: true };

    const { error } = await supabase
      .from('users')
      .update(updateData)
      .eq('id', userId);

    if (error) {
      return { success: false, error: error.message };
    }

    // Log the action
    await logAdminAction(promotedBy, `promote_${role}`, userId);

    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

// Demote user from admin/moderator
export async function demoteUser(
  userId: string,
  role: 'admin' | 'moderator',
  demotedBy: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const updateData = role === 'admin' 
      ? { is_site_admin: false }
      : { is_site_moderator: false };

    const { error } = await supabase
      .from('users')
      .update(updateData)
      .eq('id', userId);

    if (error) {
      return { success: false, error: error.message };
    }

    // Log the action
    await logAdminAction(demotedBy, `demote_${role}`, userId);

    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

// Get admin stats
export async function getAdminStats() {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  // Get total users
  const { count: totalUsers } = await supabase
    .from('users')
    .select('*', { count: 'exact', head: true });

  // Get new users today
  const { count: newUsersToday } = await supabase
    .from('users')
    .select('*', { count: 'exact', head: true })
    .gte('created_at', today.toISOString());

  // Get total messages today
  const { count: messagesToday } = await supabase
    .from('messages')
    .select('*', { count: 'exact', head: true })
    .gte('created_at', today.toISOString());

  // Get total channels
  const { count: totalChannels } = await supabase
    .from('channels')
    .select('*', { count: 'exact', head: true });

  // Get active bans
  const { count: activeBans } = await supabase
    .from('site_bans')
    .select('*', { count: 'exact', head: true })
    .is('unbanned_at', null);

  // Get pending reports
  const { count: pendingReports } = await supabase
    .from('admin_reports')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'pending');

  return {
    totalUsers: totalUsers || 0,
    newUsersToday: newUsersToday || 0,
    messagesToday: messagesToday || 0,
    totalChannels: totalChannels || 0,
    activeBans: activeBans || 0,
    pendingReports: pendingReports || 0
  };
}

// Get user by username for admin commands
export async function getUserByUsername(username: string) {
  const { data, error } = await supabase
    .from('users')
    .select('id, username, is_super_admin, is_site_admin, is_site_moderator')
    .eq('username', username)
    .single();

  if (error) {
    return null;
  }

  return data;
}

// Cache admin channel ID to avoid repeated database calls
let cachedAdminChannelId: string | null = null;

// Get admin channel ID
export async function getAdminChannelId(): Promise<string | null> {
  if (cachedAdminChannelId) {
    return cachedAdminChannelId;
  }

  const { data, error } = await supabase
    .from('channels')
    .select('id')
    .eq('name', 'admin')
    .single();

  if (error || !data) {
    return null;
  }

  cachedAdminChannelId = data.id;
  return data.id;
}
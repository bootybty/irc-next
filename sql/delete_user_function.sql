-- Function to completely delete a user and all their data
-- This should be run in your Supabase SQL editor

CREATE OR REPLACE FUNCTION delete_user_completely(user_id UUID)
RETURNS VOID AS $$
BEGIN
  -- Delete from channel_bans (where user is banned)
  DELETE FROM channel_bans WHERE channel_bans.user_id = delete_user_completely.user_id;
  
  -- Delete from channel_bans (where user banned others)
  DELETE FROM channel_bans WHERE banned_by = delete_user_completely.user_id;
  
  -- Delete from channel_members
  DELETE FROM channel_members WHERE channel_members.user_id = delete_user_completely.user_id;
  
  -- Delete messages sent by user
  DELETE FROM messages WHERE messages.user_id = delete_user_completely.user_id;
  
  -- Delete channels created by user (this will cascade to related data)
  DELETE FROM channels WHERE created_by = delete_user_completely.user_id;
  
  -- Delete channel categories created by user
  DELETE FROM channel_categories WHERE created_by = delete_user_completely.user_id;
  
  -- Delete channel roles created by user
  DELETE FROM channel_roles WHERE created_by = delete_user_completely.user_id;
  
  -- Finally delete the user profile
  DELETE FROM users WHERE id = delete_user_completely.user_id;
  
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users (they can only delete their own account)
GRANT EXECUTE ON FUNCTION delete_user_completely(UUID) TO authenticated;

-- Add RLS policy to ensure users can only delete themselves
CREATE POLICY "Users can only delete their own account" ON users
FOR DELETE USING (auth.uid() = id);
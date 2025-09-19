'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useTheme, themes } from '@/components/ThemeProvider';

interface CreateChannelModalProps {
  categoryId?: string;
  categories: Array<{ id: string; name: string; emoji: string }>;
  onClose: () => void;
  onSuccess: (channelId?: string) => void;
}

export default function CreateChannelModal({ 
  categoryId, 
  categories, 
  onClose, 
  onSuccess 
}: CreateChannelModalProps) {
  const { theme } = useTheme();
  const currentTheme = themes[theme];
  const [name, setName] = useState('');
  const [topic, setTopic] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState(categoryId || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      // Get current user and profile
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('You must be logged in to create channels');
      }

      const { data: profile } = await supabase
        .from('users')
        .select('username')
        .eq('id', user.id)
        .single();
      
      if (!profile) {
        throw new Error('Profile not found');
      }

      // Validate channel name (only lowercase letters, numbers, hyphens)
      const cleanName = name.trim().toLowerCase().replace(/[^a-z0-9-]/g, '-');
      if (cleanName !== name.trim().toLowerCase()) {
        setError('Channel names can only contain lowercase letters, numbers, and hyphens');
        setLoading(false);
        return;
      }

      // Check if channel name already exists globally
      const { data: existingChannel } = await supabase
        .from('channels')
        .select('id')
        .eq('name', cleanName)
        .maybeSingle();

      if (existingChannel) {
        throw new Error('A channel with this name already exists');
      }

      const { data: channelData, error: insertError } = await supabase
        .from('channels')
        .insert([
          {
            name: cleanName,
            topic: topic.trim() || null,
            category_id: selectedCategoryId || null,
            created_by: user.id,
          },
        ])
        .select();

      if (insertError) throw insertError;

      const channelId = channelData[0].id;

      // Check if Owner role already exists, if not create it
      let ownerRoleId: string;
      const { data: existingOwnerRole } = await supabase
        .from('channel_roles')
        .select('id')
        .eq('channel_id', channelId)
        .eq('name', 'Owner')
        .single();

      if (existingOwnerRole) {
        ownerRoleId = existingOwnerRole.id;
      } else {
        const { data: newOwnerRole, error: roleError } = await supabase
          .from('channel_roles')
          .insert([
            {
              channel_id: channelId,
              name: 'Owner',
              color: 'text-red-500',
              permissions: {
                can_kick: true,
                can_ban: true,
                can_manage_roles: true,
                can_manage_channel: true,
                can_delete_messages: true
              },
              sort_order: 0,
              created_by: user.id,
            },
          ])
          .select();

        if (roleError) throw roleError;
        ownerRoleId = newOwnerRole![0].id;
      }

      // Check if Moderator role already exists, if not create it
      const { data: existingModeratorRole } = await supabase
        .from('channel_roles')
        .select('id')
        .eq('channel_id', channelId)
        .eq('name', 'Moderator')
        .single();

      if (!existingModeratorRole) {
        const { error: moderatorRoleError } = await supabase
          .from('channel_roles')
          .insert([
            {
              channel_id: channelId,
              name: 'Moderator',
              color: 'text-amber-500',
              permissions: {
                can_kick: true,
                can_ban: true,
                can_delete_messages: true
              },
              sort_order: 50,
              created_by: user.id,
            },
          ]);

        if (moderatorRoleError) throw moderatorRoleError;
      }

      // Check if Member role already exists, if not create it  
      const { data: existingMemberRole } = await supabase
        .from('channel_roles')
        .select('id')
        .eq('channel_id', channelId)
        .eq('name', 'Member')
        .single();

      if (!existingMemberRole) {
        const { error: memberRoleError } = await supabase
          .from('channel_roles')
          .insert([
            {
              channel_id: channelId,
              name: 'Member',
              color: 'text-slate-500',
              permissions: {},
              sort_order: 100,
              created_by: user.id,
            },
          ]);

        if (memberRoleError) throw memberRoleError;
      }

      // Add creator as Owner in channel_members (check if already exists first)
      const { data: existingMember } = await supabase
        .from('channel_members')
        .select('id')
        .eq('channel_id', channelId)
        .eq('user_id', user.id)
        .maybeSingle();

      if (!existingMember) {
        const { error: memberError } = await supabase
          .from('channel_members')
          .insert([
            {
              channel_id: channelId,
              user_id: user.id,
              username: profile.username,
              role: 'owner', // Legacy field
              channel_role_id: ownerRoleId,
              is_subscribed: true,
              is_active: true,
              last_activity: new Date().toISOString(),
              last_seen: new Date().toISOString()
            },
          ]);

        if (memberError) throw memberError;
      } else {
        // Update existing member to be subscribed and active
        const { error: updateError } = await supabase
          .from('channel_members')
          .update({
            role: 'owner',
            channel_role_id: ownerRoleId,
            is_subscribed: true,
            is_active: true,
            last_activity: new Date().toISOString(),
            last_seen: new Date().toISOString()
          })
          .eq('id', existingMember.id);

        if (updateError) throw updateError;
      }

      // Show success message briefly before closing
      setSuccess(`Channel #${cleanName} created successfully!`);
      setLoading(false);
      
      setTimeout(() => {
        onSuccess(channelId);
        onClose();
      }, 1500);
    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : 'An unknown error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center z-50">
      <div className={`${currentTheme.modal} ${currentTheme.border} border p-6 max-w-md w-full mx-4`}>
        <div className={`${currentTheme.text} font-mono text-sm`}>
          <div className="text-center mb-6">
            <div className={`${currentTheme.accent} mb-2`}>
              === CREATE NEW CHANNEL ===
            </div>
            <div className={`text-xs ${currentTheme.muted}`}>
              START A NEW CONVERSATION
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className={`block ${currentTheme.accent} mb-1`}>CHANNEL NAME:</label>
              <input
                type="text"
                value={`#${name}`}
                onChange={(e) => {
                  const value = e.target.value;
                  if (value.startsWith('#')) {
                    const cleanValue = value.slice(1).toLowerCase().replace(/[^a-z0-9-]/g, '');
                    setName(cleanValue.slice(0, 20)); // Limit to 20 characters
                  }
                }}
                onKeyDown={(e) => {
                  // Prevent deleting the # at the beginning
                  const input = e.target as HTMLInputElement;
                  const selectionStart = input.selectionStart || 0;
                  const selectionEnd = input.selectionEnd || 0;
                  
                  if ((e.key === 'Backspace' || e.key === 'Delete') && selectionStart <= 1 && selectionEnd <= 1) {
                    e.preventDefault();
                  }
                  
                  // Prevent placing cursor before #
                  if (e.key === 'ArrowLeft' && selectionStart <= 1) {
                    e.preventDefault();
                  }
                }}
                onSelect={(e) => {
                  // Prevent selecting the # character
                  const input = e.target as HTMLInputElement;
                  const selectionStart = input.selectionStart || 0;
                  
                  if (selectionStart < 1) {
                    input.setSelectionRange(1, input.selectionEnd || 1);
                  }
                }}
                onFocus={(e) => {
                  // Place cursor after # when focusing
                  const input = e.target as HTMLInputElement;
                  setTimeout(() => {
                    if (input.selectionStart === 0) {
                      input.setSelectionRange(1, 1);
                    }
                  }, 0);
                }}
                className={`w-full ${currentTheme.background} border ${currentTheme.border} ${currentTheme.text} p-2 focus:outline-none focus:border-yellow-400`}
                placeholder="#channel-name"
                maxLength={21}
                pattern="#[a-z0-9-]+"
                required
              />
              <div className={`text-xs ${currentTheme.muted} mt-1`}>
                LOWERCASE LETTERS, NUMBERS, AND HYPHENS ONLY
              </div>
            </div>

            <div>
              <label className={`block ${currentTheme.accent} mb-1`}>TOPIC (OPTIONAL):</label>
              <input
                type="text"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                className={`w-full ${currentTheme.background} border ${currentTheme.border} ${currentTheme.text} p-2 focus:outline-none focus:border-yellow-400`}
                placeholder="DESCRIBE THIS CHANNEL..."
                maxLength={200}
              />
            </div>

            <div>
              <label className={`block ${currentTheme.accent} mb-1`}>CATEGORY:</label>
              <select
                value={selectedCategoryId}
                onChange={(e) => setSelectedCategoryId(e.target.value)}
                className={`w-full ${currentTheme.background} border ${currentTheme.border} ${currentTheme.text} p-2 focus:outline-none focus:border-yellow-400`}
              >
                <option value="">NO CATEGORY</option>
                {categories
                  .filter((category) => category.id !== 'global' && category.id !== 'no-category')
                  .map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name.toUpperCase()}
                    </option>
                  ))}
              </select>
            </div>


            {error && (
              <div className={`${currentTheme.error} text-xs`}>
                *** ERROR: {error.toUpperCase()}
              </div>
            )}
            
            {success && (
              <div className={`${currentTheme.success} text-xs`}>
                *** {success.toUpperCase()}
              </div>
            )}

            <div className="flex gap-2">
              <button
                type="submit"
                disabled={loading || !name.trim()}
                className={`flex-1 bg-green-400 text-black p-2 ${currentTheme.button} disabled:opacity-50`}
              >
                {loading ? 'CREATING...' : 'CREATE CHANNEL'}
              </button>
              <button
                type="button"
                onClick={onClose}
                className={`flex-1 ${currentTheme.error} ${currentTheme.button}`}
              >
                CANCEL
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
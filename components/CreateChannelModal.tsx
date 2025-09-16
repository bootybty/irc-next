'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';

interface CreateChannelModalProps {
  serverId: string;
  categoryId?: string;
  categories: Array<{ id: string; name: string; emoji: string }>;
  onClose: () => void;
  onSuccess: () => void;
}

export default function CreateChannelModal({ 
  serverId, 
  categoryId, 
  categories, 
  onClose, 
  onSuccess 
}: CreateChannelModalProps) {
  const [name, setName] = useState('');
  const [topic, setTopic] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState(categoryId || '');
  const [isPrivate, setIsPrivate] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('You must be logged in to create channels');
      }

      // Validate channel name (only lowercase letters, numbers, hyphens)
      const cleanName = name.trim().toLowerCase().replace(/[^a-z0-9-]/g, '-');
      if (cleanName !== name.trim().toLowerCase()) {
        setError('Channel names can only contain lowercase letters, numbers, and hyphens');
        setLoading(false);
        return;
      }

      // Check if channel name already exists in this server
      const { data: existingChannel } = await supabase
        .from('channels')
        .select('id')
        .eq('server_id', serverId)
        .eq('name', cleanName)
        .single();

      if (existingChannel) {
        throw new Error('A channel with this name already exists');
      }

      const { error: insertError } = await supabase
        .from('channels')
        .insert([
          {
            server_id: serverId,
            name: cleanName,
            topic: topic.trim() || null,
            category_id: selectedCategoryId || null,
            created_by: user.id,
            is_private: isPrivate,
          },
        ]);

      if (insertError) throw insertError;

      onSuccess();
      onClose();
    } catch (error: any) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center z-50">
      <div className="bg-black border border-green-400 p-6 max-w-md w-full mx-4">
        <div className="text-green-400 font-mono text-sm">
          <div className="text-center mb-6">
            <div className="text-green-300 mb-2">
              === CREATE NEW CHANNEL ===
            </div>
            <div className="text-xs text-gray-400">
              START A NEW CONVERSATION
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-green-300 mb-1">CHANNEL NAME:</label>
              <div className="flex items-center">
                <span className="text-green-300 mr-1">#</span>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                  className="flex-1 bg-black border border-green-400 text-green-400 p-2 focus:outline-none focus:border-yellow-400"
                  placeholder="channel-name"
                  maxLength={50}
                  pattern="[a-z0-9-]+"
                  required
                />
              </div>
              <div className="text-xs text-gray-400 mt-1">
                LOWERCASE LETTERS, NUMBERS, AND HYPHENS ONLY
              </div>
            </div>

            <div>
              <label className="block text-green-300 mb-1">TOPIC (OPTIONAL):</label>
              <input
                type="text"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                className="w-full bg-black border border-green-400 text-green-400 p-2 focus:outline-none focus:border-yellow-400"
                placeholder="DESCRIBE THIS CHANNEL..."
                maxLength={200}
              />
            </div>

            <div>
              <label className="block text-green-300 mb-1">CATEGORY:</label>
              <select
                value={selectedCategoryId}
                onChange={(e) => setSelectedCategoryId(e.target.value)}
                className="w-full bg-black border border-green-400 text-green-400 p-2 focus:outline-none focus:border-yellow-400"
              >
                <option value="">UNCATEGORIZED</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.emoji} {category.name.toUpperCase()}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="flex items-center text-green-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isPrivate}
                  onChange={(e) => setIsPrivate(e.target.checked)}
                  className="mr-2"
                />
                PRIVATE CHANNEL
              </label>
              <div className="text-xs text-gray-400 mt-1">
                PRIVATE CHANNELS ARE ONLY VISIBLE TO INVITED MEMBERS
              </div>
            </div>

            {error && (
              <div className="text-red-400 text-xs">
                *** ERROR: {error.toUpperCase()}
              </div>
            )}

            <div className="flex gap-2">
              <button
                type="submit"
                disabled={loading || !name.trim()}
                className="flex-1 bg-green-400 text-black p-2 hover:bg-yellow-400 disabled:opacity-50"
              >
                {loading ? 'CREATING...' : 'CREATE CHANNEL'}
              </button>
              <button
                type="button"
                onClick={onClose}
                className="flex-1 border border-green-400 text-green-400 p-2 hover:border-yellow-400 hover:text-yellow-400"
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
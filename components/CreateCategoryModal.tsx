'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';

interface CreateCategoryModalProps {
  serverId: string;
  onClose: () => void;
  onSuccess: () => void;
}

export default function CreateCategoryModal({ serverId, onClose, onSuccess }: CreateCategoryModalProps) {
  const [name, setName] = useState('');
  const [emoji, setEmoji] = useState('📁');
  const [color, setColor] = useState('text-green-400');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const colorOptions = [
    { value: 'text-green-400', label: 'GREEN' },
    { value: 'text-blue-400', label: 'BLUE' },
    { value: 'text-yellow-400', label: 'YELLOW' },
    { value: 'text-red-400', label: 'RED' },
    { value: 'text-purple-400', label: 'PURPLE' },
    { value: 'text-cyan-400', label: 'CYAN' },
    { value: 'text-magenta-400', label: 'MAGENTA' },
  ];

  const emojiOptions = ['📁', '💬', '🆘', '💻', '🌐', '📱', '🎮', '🖥️', '🎵', '📚', '⚡', '🔧', '🎨', '📊'];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      // Get the highest sort_order for this server
      const { data: existingCategories } = await supabase
        .from('channel_categories')
        .select('sort_order')
        .eq('server_id', serverId)
        .order('sort_order', { ascending: false })
        .limit(1);

      const nextSortOrder = existingCategories && existingCategories.length > 0 
        ? existingCategories[0].sort_order + 1 
        : 0;

      const { error: insertError } = await supabase
        .from('channel_categories')
        .insert([
          {
            server_id: serverId,
            name: name.trim(),
            emoji,
            color,
            sort_order: nextSortOrder,
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
              === CREATE NEW CATEGORY ===
            </div>
            <div className="text-xs text-gray-400">
              ORGANIZE YOUR CHANNELS
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-green-300 mb-1">CATEGORY NAME:</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-black border border-green-400 text-green-400 p-2 focus:outline-none focus:border-yellow-400"
                placeholder="ENTER CATEGORY NAME..."
                maxLength={50}
                required
              />
            </div>

            <div>
              <label className="block text-green-300 mb-1">EMOJI:</label>
              <div className="grid grid-cols-7 gap-2 mb-2">
                {emojiOptions.map((emojiOption) => (
                  <button
                    key={emojiOption}
                    type="button"
                    onClick={() => setEmoji(emojiOption)}
                    className={`p-2 border text-center hover:border-yellow-400 ${
                      emoji === emojiOption ? 'border-yellow-400 bg-yellow-400 bg-opacity-20' : 'border-green-400'
                    }`}
                  >
                    {emojiOption}
                  </button>
                ))}
              </div>
              <input
                type="text"
                value={emoji}
                onChange={(e) => setEmoji(e.target.value)}
                className="w-full bg-black border border-green-400 text-green-400 p-2 focus:outline-none focus:border-yellow-400"
                placeholder="OR TYPE CUSTOM EMOJI..."
                maxLength={10}
              />
            </div>

            <div>
              <label className="block text-green-300 mb-1">COLOR:</label>
              <select
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="w-full bg-black border border-green-400 text-green-400 p-2 focus:outline-none focus:border-yellow-400"
              >
                {colorOptions.map((colorOption) => (
                  <option key={colorOption.value} value={colorOption.value}>
                    {colorOption.label}
                  </option>
                ))}
              </select>
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
                {loading ? 'CREATING...' : 'CREATE CATEGORY'}
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
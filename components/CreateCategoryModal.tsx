'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';

interface CreateCategoryModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

export default function CreateCategoryModal({ onClose, onSuccess }: CreateCategoryModalProps) {
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      // Get the highest sort_order across all categories
      const { data: existingCategories } = await supabase
        .from('channel_categories')
        .select('sort_order')
        .order('sort_order', { ascending: false })
        .limit(1);

      const nextSortOrder = existingCategories && existingCategories.length > 0 
        ? existingCategories[0].sort_order + 1 
        : 0;

      const { error: insertError } = await supabase
        .from('channel_categories')
        .insert([
          {
            name: name.trim(),
            emoji: '📁',
            color: 'text-green-400',
            sort_order: nextSortOrder,
          },
        ]);

      if (insertError) throw insertError;

      // Show success message briefly before closing
      setSuccess(`Category "${name.trim()}" created successfully!`);
      setLoading(false);
      
      setTimeout(() => {
        onSuccess();
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

            {error && (
              <div className="text-red-400 text-xs">
                *** ERROR: {error.toUpperCase()}
              </div>
            )}
            
            {success && (
              <div className="text-green-400 text-xs">
                *** {success.toUpperCase()}
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
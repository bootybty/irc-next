import { useState } from 'react';

export const useUI = () => {
  const [showSidebar, setShowSidebar] = useState(false);
  const [showUsers, setShowUsers] = useState(false);
  const [showCreateCategoryModal, setShowCreateCategoryModal] = useState(false);
  const [showCreateChannelModal, setShowCreateChannelModal] = useState(false);
  const [selectedCategoryForChannel, setSelectedCategoryForChannel] = useState<string>('');
  const [inputMessage, setInputMessage] = useState('');
  const [isJoined, setIsJoined] = useState(false);

  const handleCreateCategory = () => {
    setShowCreateCategoryModal(true);
  };

  const handleCreateChannel = (categoryId?: string) => {
    setSelectedCategoryForChannel(categoryId || '');
    setShowCreateChannelModal(true);
  };

  const handleInputChange = (value: string) => {
    setInputMessage(value);
  };

  const clearInput = () => {
    setInputMessage('');
    
    setTimeout(() => {
      const textarea = document.querySelector('textarea');
      if (textarea) {
        textarea.style.height = 'auto';
        textarea.style.height = '1.25rem';
      }
    }, 0);
  };

  return {
    showSidebar,
    setShowSidebar,
    showUsers,
    setShowUsers,
    showCreateCategoryModal,
    setShowCreateCategoryModal,
    showCreateChannelModal,
    setShowCreateChannelModal,
    selectedCategoryForChannel,
    setSelectedCategoryForChannel,
    inputMessage,
    setInputMessage,
    isJoined,
    setIsJoined,
    handleCreateCategory,
    handleCreateChannel,
    handleInputChange,
    clearInput
  };
};
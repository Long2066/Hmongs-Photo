
import React, { useState } from 'react';
import { type User } from '../types';

interface AddFriendModalProps {
  onClose: () => void;
  onAddFriend: (phone: string) => { status: 'success' | 'exists' | 'not_found' | 'self', user?: User };
}

export const AddFriendModal: React.FC<AddFriendModalProps> = ({ onClose, onAddFriend }) => {
  const [phone, setPhone] = useState('');
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState<'success' | 'error' | 'info'>('info');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!phone.trim()) {
        setMessageType('error');
        setMessage('Please enter a phone number.');
        return;
    };
    const result = onAddFriend(phone);

    switch (result.status) {
        case 'success':
            setMessageType('success');
            setMessage(`You are now connected with ${result.user?.name}!`);
            setTimeout(() => {
                onClose();
            }, 1500);
            break;
        case 'exists':
            setMessageType('info');
            setMessage(`You are already connected with ${result.user?.name}.`);
            break;
        case 'not_found':
            setMessageType('error');
            setMessage('User with this phone number was not found.');
            break;
        case 'self':
            setMessageType('error');
            setMessage('You cannot add yourself as a friend.');
            break;
    }
  };

  return (
    <div 
        className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" 
        onClick={onClose}
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-friend-title"
    >
      <div 
        className="bg-white rounded-lg shadow-xl p-6 w-full max-w-sm" 
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-4">
          <h2 id="add-friend-title" className="text-xl font-bold text-gray-800">Add Friend</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-800" aria-label="Close dialog">&times;</button>
        </div>
        <p className="text-gray-600 mb-4">
            Enter the phone number of the user you want to add.
            <br />
            (Try: 0945678901 for David)
        </p>
        <form onSubmit={handleSubmit}>
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="Enter phone number"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            autoFocus
          />
          {message && (
             <p className={`mt-3 text-sm ${
                messageType === 'success' ? 'text-green-600' : 
                messageType === 'error' ? 'text-red-600' : 'text-gray-600'
             }`}>{message}</p>
          )}
          <div className="mt-6 flex justify-end space-x-3">
            <button 
                type="button" 
                onClick={onClose} 
                className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300"
            >
              Cancel
            </button>
            <button 
                type="submit" 
                className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
            >
              Add
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

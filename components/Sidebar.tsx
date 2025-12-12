
import React from 'react';
import { type Chat, type User } from '../types';
import { Avatar } from './Avatar';
import { SearchIcon, PlusIcon } from './Icons';

interface SidebarProps {
  chats: Chat[];
  activeChatId: string;
  onSelectChat: (chatId: string) => void;
  currentUser: User;
  onAddFriendClick: () => void;
}

const ChatListItem: React.FC<{ chat: Chat; isActive: boolean; onSelect: () => void; currentUser: User }> = ({ chat, isActive, onSelect, currentUser }) => {
  const otherParticipant = chat.participants.find(p => p.id !== currentUser.id);
  const lastMessage = chat.messages[chat.messages.length - 1];

  if (!otherParticipant) return null;

  const getLastMessageText = () => {
    if (!lastMessage) return 'No messages yet';
    if (lastMessage.mediaType === 'image') return 'Sent an image';
    if (lastMessage.mediaType === 'video') return 'Sent a video';
    return lastMessage.text;
  }

  return (
    <div
      onClick={onSelect}
      className={`flex items-center p-3 cursor-pointer rounded-lg transition-colors duration-200 ${
        isActive ? 'bg-blue-100' : 'hover:bg-gray-100'
      }`}
    >
      <Avatar src={otherParticipant.avatar} alt={otherParticipant.name} />
      <div className="ml-3 flex-1 overflow-hidden">
        <p className="font-semibold text-gray-800 truncate">{otherParticipant.name}</p>
        <p className={`text-sm text-gray-500 truncate ${isActive ? 'font-medium text-gray-700' : ''}`}>
          {lastMessage?.senderId === currentUser.id && 'You: '}{getLastMessageText()}
        </p>
      </div>
    </div>
  );
};

export const Sidebar: React.FC<SidebarProps> = ({ chats, activeChatId, onSelectChat, currentUser, onAddFriendClick }) => {
  return (
    <div className="w-1/3 md:w-1/4 bg-white border-r border-gray-200 flex flex-col">
      <div className="p-4 border-b border-gray-200 flex items-center justify-between">
        <div className="flex items-center">
          <Avatar src={currentUser.avatar} alt={currentUser.name} />
          <p className="ml-3 font-bold text-lg text-gray-800 hidden md:block">Chats</p>
        </div>
        <button onClick={onAddFriendClick} className="p-2 rounded-full hover:bg-gray-200" aria-label="Add new friend">
            <PlusIcon className="w-5 h-5 text-gray-600"/>
        </button>
      </div>
      <div className="p-3">
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <SearchIcon className="w-5 h-5 text-gray-400" />
          </div>
          <input
            type="text"
            placeholder="Search friends..."
            className="w-full bg-gray-100 rounded-full py-2 pl-10 pr-4 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {[...chats]
          .sort((a, b) => {
            const lastMessageA = a.messages[a.messages.length - 1];
            const lastMessageB = b.messages[b.messages.length - 1];
            if (!lastMessageA) return 1;
            if (!lastMessageB) return -1;
            return lastMessageB.timestamp.getTime() - lastMessageA.timestamp.getTime();
          })
          .map(chat => (
            <ChatListItem
              key={chat.id}
              chat={chat}
              isActive={chat.id === activeChatId}
              onSelect={() => onSelectChat(chat.id)}
              currentUser={currentUser}
            />
        ))}
      </div>
    </div>
  );
};

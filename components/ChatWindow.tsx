
import React, { useRef, useEffect } from 'react';
import { type Chat, type User } from '../types';
import { Avatar } from './Avatar';
import { MessageBubble } from './MessageBubble';
import { ChatInput } from './ChatInput';
import { PhoneIcon, VideoCameraIcon, DotsVerticalIcon } from './Icons';

interface ChatWindowProps {
  chat: Chat;
  onSendMessage: (text: string, file?: File) => void;
  currentUser: User;
  isSending: boolean;
}

export const ChatWindow: React.FC<ChatWindowProps> = ({ chat, onSendMessage, currentUser, isSending }) => {
  const otherParticipant = chat.participants.find(p => p.id !== currentUser.id);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [chat.messages]);
  
  if (!otherParticipant) return <div className="flex-1 flex items-center justify-center"><p>Chat not found.</p></div>;

  return (
    <div className="flex-1 flex flex-col bg-blue-50">
      <div className="flex items-center justify-between p-3 bg-white border-b border-gray-200 shadow-sm">
        <div className="flex items-center">
          <Avatar src={otherParticipant.avatar} alt={otherParticipant.name} />
          <div className="ml-3">
            <p className="font-bold text-gray-800">{otherParticipant.name}</p>
            <p className="text-sm text-green-500">Online</p>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <button className="p-2 rounded-full hover:bg-gray-200 text-blue-600">
            <PhoneIcon className="w-6 h-6" />
          </button>
          <button className="p-2 rounded-full hover:bg-gray-200 text-blue-600">
            <VideoCameraIcon className="w-6 h-6" />
          </button>
           <button className="p-2 rounded-full hover:bg-gray-200 text-blue-600">
            <DotsVerticalIcon className="w-6 h-6" />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {chat.messages.map(message => (
          <MessageBubble
            key={message.id}
            message={message}
            isSender={message.senderId === currentUser.id}
            sender={chat.participants.find(p => p.id === message.senderId)}
          />
        ))}
        {isSending && (
            <div className="flex items-center space-x-2">
                <Avatar src={otherParticipant.avatar} alt={otherParticipant.name} size="sm" />
                <div className="flex items-center space-x-1">
                    <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></span>
                    <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></span>
                    <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{animationDelay: '0.4s'}}></span>
                </div>
            </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <ChatInput onSendMessage={onSendMessage} isSending={isSending}/>
    </div>
  );
};

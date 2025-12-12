
import React from 'react';
import { type Message, type User } from '../types';
import { Avatar } from './Avatar';

interface MessageBubbleProps {
  message: Message;
  isSender: boolean;
  sender?: User;
}

export const MessageBubble: React.FC<MessageBubbleProps> = ({ message, isSender, sender }) => {
  const bubbleClasses = isSender
    ? 'bg-blue-500 text-white'
    : 'bg-white text-gray-800';
  
  const containerClasses = isSender
    ? 'justify-end'
    : 'justify-start';

  const hasMedia = message.mediaType === 'image' || message.mediaType === 'video';

  return (
    <div className={`flex items-end gap-2 ${containerClasses}`}>
      {!isSender && sender && (
        <Avatar src={sender.avatar} alt={sender.name} size="sm" />
      )}
      <div className={`max-w-xs md:max-w-md lg:max-w-lg rounded-lg ${isSender ? 'mr-2' : ''} ${hasMedia && !message.text ? 'p-0' : 'p-1'}`}>
        {message.mediaType === 'image' && message.imageUrl && (
          <img src={message.imageUrl} alt="Uploaded content" className="rounded-lg max-w-full h-auto mb-1" style={{maxHeight: '300px'}}/>
        )}
        {message.mediaType === 'video' && message.videoUrl && (
          <video src={message.videoUrl} controls className="rounded-lg max-w-full h-auto mb-1" style={{maxHeight: '300px'}}/>
        )}
        {message.text && (
            <div className={`px-3 py-2 rounded-2xl shadow-sm ${bubbleClasses}`}>
                 <p className="text-sm break-words">{message.text}</p>
            </div>
        )}
      </div>
    </div>
  );
};


import { User, Chat } from './types';

// --- Mock Data ---
// Fix: Added `username` to user objects to match the updated User type.
export const users: Record<string, User> = {
  'user-me': { id: 'user-me', username: 'me', name: 'You', avatar: 'https://picsum.photos/id/1005/100/100', phone: '0901234567' },
  'user-ai': { id: 'user-ai', username: 'Gemini AI Assistant', name: 'Gemini AI Assistant', avatar: 'https://i.imgur.com/2AbC8WU.png' },
  'user-1': { id: 'user-1', username: 'Alice', name: 'Alice', avatar: 'https://picsum.photos/id/1011/100/100', phone: '0912345678' },
  'user-2': { id: 'user-2', username: 'Bob', name: 'Bob', avatar: 'https://picsum.photos/id/1012/100/100', phone: '0923456789' },
  'user-3': { id: 'user-3', username: 'Charlie', name: 'Charlie', avatar: 'https://picsum.photos/id/1025/100/100', phone: '0934567890' },
  'user-4': { id: 'user-4', username: 'David', name: 'David', avatar: 'https://picsum.photos/id/1027/100/100', phone: '0945678901' },
};

export const initialChats: Chat[] = [
  {
    id: 'chat-ai',
    participants: [users['user-me'], users['user-ai']],
    messages: [
      { id: 'msg-ai-1', senderId: 'user-ai', text: 'Xin chào! Tôi là trợ lý Gemini. Tôi có thể giúp gì cho bạn hôm nay?', timestamp: new Date(), mediaType: 'text' }
    ]
  },
  {
    id: 'chat-1',
    participants: [users['user-me'], users['user-1']],
    messages: [
      { id: 'msg-1-1', senderId: 'user-1', text: 'Hey there! How are you?', timestamp: new Date(Date.now() - 1000 * 60 * 5), mediaType: 'text' }
    ]
  },
  {
    id: 'chat-2',
    participants: [users['user-me'], users['user-2']],
    messages: [
      { id: 'msg-2-1', senderId: 'user-2', text: 'Did you see the report?', timestamp: new Date(Date.now() - 1000 * 60 * 30), mediaType: 'text' }
    ]
  },
  {
    id: 'chat-3',
    participants: [users['user-me'], users['user-3']],
    messages: [
      { id: 'msg-3-1', senderId: 'user-me', text: 'Let\'s catch up later.', timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2), mediaType: 'text' }
    ]
  },
];
// --- End Mock Data ---

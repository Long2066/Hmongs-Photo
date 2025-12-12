// Fix: Updated User interface to include properties for chat components.
export interface User {
  id: string;
  username: string;
  name: string;
  avatar: string;
  phone?: string;
}

export interface HistoryItem {
  id: string;
  prompt: string;
  aspectRatio: string;
  resolution: string;
  shotType: string;
  style: string;
  images: (string | null)[];
  timestamp: number;
}

// Fix: Added missing Message interface.
export interface Message {
    id: string;
    senderId: string;
    text: string;
    timestamp: Date;
    mediaType: 'text' | 'image' | 'video';
    imageUrl?: string;
    videoUrl?: string;
}

// Fix: Added missing Chat interface.
export interface Chat {
    id: string;
    participants: User[];
    messages: Message[];
}
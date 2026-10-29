import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { subscribeToRegistrations, subscribeToTodayActiveCount } from '../services/firebaseService';

interface Registration {
  displayName: string;
  timestamp: number;
}

// Color palette for messages
const MESSAGE_COLORS = [
  'text-emerald-400',
  'text-cyan-400',
  'text-indigo-400',
  'text-purple-400',
  'text-pink-400',
  'text-rose-400',
  'text-amber-400',
  'text-lime-400',
  'text-sky-400',
  'text-fuchsia-400',
];

// Static messages
const STATIC_MESSAGES = [
  { icon: '✨', text: 'Tính năng mới: Làm nét ảnh 4K Ultra HD' },
  { icon: '🚀', text: 'Profile chuyên nghiệp cho MXH & CV' },
  { icon: '💎', text: 'Công nghệ Banana Pro GenAI - Gemini 3' },
  { icon: '📞', text: 'Hỗ trợ kỹ thuật: 0342.733.640' },
  { icon: '🎨', text: 'ImageTool - Sáng tạo không giới hạn' },
  { icon: '⚡', text: 'Tạo ảnh thẻ chuyên nghiệp trong 30 giây' },
  { icon: '🔮', text: 'Phục hồi ảnh cũ - Tô màu AI thông minh' },
  { icon: '👔', text: 'Dream Job - Hiện thực hóa ước mơ nghề nghiệp' },
];

export const Marquee: React.FC = () => {
  const [recentRegistrations, setRecentRegistrations] = useState<Registration[]>([]);
  const [todayActiveCount, setTodayActiveCount] = useState<number>(0);
  const [messageIndex, setMessageIndex] = useState(0);
  const [isVisible, setIsVisible] = useState(false);
  const [isSystemStatus, setIsSystemStatus] = useState(true);

  useEffect(() => {
    // Subscribe to realtime registrations
    const unsubRegistrations = subscribeToRegistrations((registrations) => {
      setRecentRegistrations(registrations);
    }, 10);

    // Subscribe to today's active count
    const unsubActiveCount = subscribeToTodayActiveCount((count) => {
      setTodayActiveCount(count);
    });

    return () => {
      unsubRegistrations();
      unsubActiveCount();
    };
  }, []);

  // Build dynamic messages
  const allMessages = useMemo(() => {
    const messages = [...STATIC_MESSAGES];

    // Add active count message
    if (todayActiveCount > 0) {
      messages.unshift({ icon: '👥', text: `${todayActiveCount} người dùng đang hoạt động hôm nay` });
    }

    // Add recent registrations
    recentRegistrations.slice(0, 5).forEach(reg => {
      messages.push({ icon: '🎉', text: `${reg.displayName} vừa tham gia ImageTool!` });
    });

    return messages;
  }, [todayActiveCount, recentRegistrations]);

  const currentMessage = useMemo(() => {
    const msg = allMessages[messageIndex % allMessages.length];
    const color = MESSAGE_COLORS[(messageIndex % allMessages.length) % MESSAGE_COLORS.length];
    return { ...msg, color };
  }, [allMessages, messageIndex]);

  // Smooth rotation logic
  useEffect(() => {
    const rotate = () => {
      // Fade out
      setIsVisible(false);

      setTimeout(() => {
        setMessageIndex(prev => prev + 1);
        setIsSystemStatus(prev => !prev); // Toggle between message and system name

        // Short pause at empty state
        setTimeout(() => {
          setIsVisible(true);
        }, 50);
      }, 800);
    };

    const interval = setInterval(rotate, 6000); // Rotate every 6 seconds

    // Initial show
    const initialTimeout = setTimeout(() => setIsVisible(true), 500);

    return () => {
      clearInterval(interval);
      clearTimeout(initialTimeout);
    };
  }, [allMessages.length]);

  return (
    <div className="relative bg-[#0a0a0f] border-b border-indigo-500/40 overflow-hidden h-11 flex items-center justify-center z-50 shadow-[0_4px_20px_rgba(0,0,0,0.4)]">
      {/* Dynamic Background Glow */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(99,102,241,0.1),transparent_70%)]"></div>
      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-indigo-900/10 to-transparent"></div>

      {/* Left side: Live Status */}
      <div className="absolute left-4 flex items-center gap-2.5 z-10 px-2 py-1 bg-green-500/5 rounded-full border border-green-500/20">
        <span className="relative flex h-2.5 w-2.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]"></span>
        </span>
        <span className="text-[11px] text-green-400 font-extrabold tracking-widest uppercase animate-pulse">LIVE</span>
      </div>

      {/* Center Ticker Area */}
      <div className="relative flex items-center justify-center h-full w-full max-w-2xl px-12 overflow-hidden">
        <div
          className={`flex items-center gap-3 transition-all duration-1000 cubic-bezier(0.34, 1.56, 0.64, 1) ${isVisible
            ? 'opacity-100 transform translate-y-0 filter blur-0'
            : 'opacity-0 transform translate-y-4 filter blur-sm'
            }`}
        >
          <span className="text-xl drop-shadow-md filter saturate-150 transform transition-transform duration-500 hover:scale-125">
            {currentMessage.icon}
          </span>
          <span className={`text-sm sm:text-base font-bold tracking-tight ${currentMessage.color} drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)] whitespace-nowrap`}>
            {currentMessage.text}
          </span>
        </div>
      </div>

      {/* Right side: Activity Indicator */}
      <div className="absolute right-4 flex items-center gap-3 z-10">
        {todayActiveCount > 0 && (
          <div className="flex items-center gap-2 bg-indigo-500/10 border border-indigo-500/30 px-3 py-1.5 rounded-lg backdrop-blur-md shadow-inner group hover:border-indigo-400/60 transition-all duration-300">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 text-indigo-400 group-hover:scale-110 transition-transform">
              <path d="M4.5 6.375a4.125 4.125 0 118.25 0 4.125 4.125 0 01-8.25 0zM14.25 8.625a3.375 3.375 0 116.75 0 3.375 3.375 0 01-6.75 0zM1.5 19.125a7.125 7.125 0 0114.25 0v.003l-.001.119a.75.75 0 01-.363.63 13.067 13.067 0 01-6.761 1.873c-2.472 0-4.786-.684-6.76-1.873a.75.75 0 01-.364-.63l-.001-.122zM17.25 19.128l-.001.144a2.25 2.25 0 01-.896 1.8 13.026 13.026 0 005.627-2.012.75.75 0 00.354-.64V18a7.125 7.125 0 00-5.084-6.815z" />
            </svg>
            <div className="flex flex-col items-center leading-none">
              <span className="text-[13px] font-black text-indigo-300 tabular-nums">{todayActiveCount}</span>
              <span className="text-[7px] text-indigo-500 font-bold uppercase tracking-tighter">Active</span>
            </div>
          </div>
        )}
      </div>

      {/* Top/Bottom Accents */}
      <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-indigo-500/20 to-transparent"></div>
      <div className="absolute bottom-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-white/5 to-transparent"></div>
    </div>
  );
};
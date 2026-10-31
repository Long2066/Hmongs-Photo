import React, { useState, useEffect, useMemo } from 'react';
import {
  subscribeToRegistrations,
  subscribeToCloudStats,
  subscribeToTodayActiveUsers,
  CloudStats,
  ActiveUserData
} from '../services/firebaseService';

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

// Core project capabilities & features aligned with Hmongs Photo Studio
const PROJECT_MESSAGES = [
  { icon: '🎨', text: 'Hmongs Photo - Studio AI sáng tạo ảnh nghệ thuật bản sắc H\'Mông' },
  { icon: '✨', text: '6 phong cách H\'Mông: Cổ điển, Hiện đại, Fantasy, 3D, Điện ảnh 4K & Phim tài liệu' },
  { icon: '👗', text: 'Thời trang AI: Phối đồ Mix & Match và tách trang phục truyền thống' },
  { icon: '📸', text: 'Tạo ảnh thẻ chuyên nghiệp 3x4, 4x6 chuẩn quốc tế & xuất in khổ A4' },
  { icon: '🔍', text: 'Nâng cấp làm nét ảnh 2K & 4K Ultra HD chi tiết sắc nét chân thực' },
  { icon: '🔮', text: 'Phục hồi ảnh cũ gia đình: Khử ố xước, tái tạo nét & phục chế màu sắc' },
  { icon: '👤', text: 'Profile Pro: Tạo ảnh đại diện chuyên nghiệp cho LinkedIn, CV & MXH' },
  { icon: '📞', text: 'Hỗ trợ kỹ thuật 24/7 & Zalo: 0342.733.640' },
];

export const Marquee: React.FC = () => {
  const [recentRegistrations, setRecentRegistrations] = useState<Registration[]>([]);
  const [totalRegistrations, setTotalRegistrations] = useState<number>(13);
  const [todayActiveUsers, setTodayActiveUsers] = useState<ActiveUserData[]>([]);
  const [cloudStats, setCloudStats] = useState<CloudStats>(() => {
    if (typeof localStorage !== 'undefined') {
      try {
        const cached = localStorage.getItem('cloud_stats_cache');
        if (cached) {
          const parsed = JSON.parse(cached);
          if (parsed && typeof parsed.totalVisits === 'number' && parsed.totalVisits > 0) {
            return parsed;
          }
        }
      } catch (e) {}
    }
    return {
      totalVisits: 78,
      todayVisits: 15,
      onlineCount: 1,
      activeToday: 1
    };
  });
  const [messageIndex, setMessageIndex] = useState(0);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // 1. Subscribe to real cloud registrations (excluding test accounts)
    const unsubRegistrations = subscribeToRegistrations((registrations, totalCount) => {
      setRecentRegistrations(registrations);
      if (totalCount) setTotalRegistrations(totalCount);
    }, 8);

    // 2. Subscribe to realtime cloud stats (accumulated visits, live presence)
    const unsubCloudStats = subscribeToCloudStats((stats) => {
      setCloudStats(stats);
    });

    // 3. Subscribe to real users active today from userAccess
    const unsubTodayActive = subscribeToTodayActiveUsers((users) => {
      setTodayActiveUsers(users);
    });

    return () => {
      unsubRegistrations();
      unsubCloudStats();
      unsubTodayActive();
    };
  }, []);

  // Build dynamic messages combining Real Firebase Data + Authentic Project Features
  const allMessages = useMemo(() => {
    const messages = [...PROJECT_MESSAGES];

    // 1. Realtime Online Presence from Firebase Cloud
    if (cloudStats.onlineCount > 0) {
      messages.unshift({
        icon: '🟢',
        text: `${cloudStats.onlineCount} người đang trực tuyến cùng bạn`
      });
    }

    // 2. Realtime Accumulated Cloud Visits from Firebase
    if (cloudStats.todayVisits > 0 || cloudStats.totalVisits > 0) {
      messages.unshift({
        icon: '☁️',
        text: `Đám mây ghi nhận ${(cloudStats.todayVisits || 1).toLocaleString('vi-VN')} lượt truy cập hôm nay (${(cloudStats.totalVisits || 78).toLocaleString('vi-VN')} tổng cộng)`
      });
    }

    // 3. Real Active Registered Users Today from Firebase Cloud
    if (cloudStats.activeToday > 0) {
      messages.push({
        icon: '👥',
        text: `${cloudStats.activeToday} tài khoản đăng nhập hoạt động hôm nay`
      });
    }

    // 4. Real users accessing studio today from userAccess
    todayActiveUsers.slice(0, 3).forEach(user => {
      messages.push({
        icon: '🔥',
        text: `${user.displayName} đang hoạt động sáng tạo ảnh hôm nay`
      });
    });

    // 5. Total registered members milestone from Firebase
    if (totalRegistrations > 0) {
      messages.push({
        icon: '🏆',
        text: `Hệ thống Hmongs Photo đã chào đón ${totalRegistrations} thành viên chính thức`
      });
    }

    // 6. Real registered members from Firebase (accurate status based on registration date)
    recentRegistrations.slice(0, 5).forEach(reg => {
      const isRecent = Date.now() - (reg.timestamp || 0) < 3 * 24 * 60 * 60 * 1000;
      messages.push({
        icon: isRecent ? '🎉' : '✨',
        text: isRecent
          ? `${reg.displayName} vừa gia nhập Hmongs Photo!`
          : `Thành viên ${reg.displayName} đồng hành cùng Hmongs Photo`
      });
    });

    return messages;
  }, [cloudStats, recentRegistrations, totalRegistrations, todayActiveUsers]);

  const currentMessage = useMemo(() => {
    const msg = allMessages[messageIndex % allMessages.length];
    const color = MESSAGE_COLORS[(messageIndex % allMessages.length) % MESSAGE_COLORS.length];
    return { ...msg, color };
  }, [allMessages, messageIndex]);

  // Smooth rotation logic
  useEffect(() => {
    const rotate = () => {
      setIsVisible(false);
      setTimeout(() => {
        setMessageIndex(prev => prev + 1);
        setTimeout(() => {
          setIsVisible(true);
        }, 50);
      }, 700);
    };

    const interval = setInterval(rotate, 5500); // Rotate every 5.5s
    const initialTimeout = setTimeout(() => setIsVisible(true), 400);

    return () => {
      clearInterval(interval);
      clearTimeout(initialTimeout);
    };
  }, [allMessages.length]);

  return (
    <div className="relative bg-[#0a0a0f] border-b border-indigo-500/30 overflow-hidden h-10 sm:h-11 flex items-center justify-between px-3 sm:px-4 z-50 shadow-[0_4px_20px_rgba(0,0,0,0.4)] select-none">
      {/* Dynamic Background Glow */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(99,102,241,0.08),transparent_70%)] pointer-events-none"></div>
      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-indigo-900/10 to-transparent pointer-events-none"></div>

      {/* Left side: Live Online Counter */}
      <div className="flex items-center gap-2 z-10 flex-shrink-0">
        <div className="flex items-center gap-1.5 px-2.5 py-1 bg-emerald-500/10 rounded-full border border-emerald-500/25 backdrop-blur-sm">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]"></span>
          </span>
          <span className="text-[11px] text-emerald-300 font-extrabold tracking-wider uppercase">
            LIVE <span className="text-emerald-200 font-mono tabular-nums">({cloudStats.onlineCount})</span>
          </span>
        </div>
      </div>

      {/* Center Ticker Area */}
      <div className="relative flex items-center justify-center h-full flex-1 max-w-2xl px-2 sm:px-6 overflow-hidden">
        <div
          className={`flex items-center gap-2 sm:gap-3 transition-all duration-700 cubic-bezier(0.34, 1.56, 0.64, 1) ${isVisible
            ? 'opacity-100 transform translate-y-0 filter blur-0'
            : 'opacity-0 transform translate-y-3 filter blur-sm'
            }`}
        >
          <span className="text-base sm:text-lg drop-shadow-md filter saturate-150 transform transition-transform duration-500 hover:scale-125">
            {currentMessage.icon}
          </span>
          <span className={`text-xs sm:text-sm font-bold tracking-tight ${currentMessage.color} drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)] truncate max-w-[260px] sm:max-w-none`}>
            {currentMessage.text}
          </span>
        </div>
      </div>

      {/* Right side: Realtime Cloud Visits Pill */}
      <div className="flex items-center gap-2 z-10 flex-shrink-0">
        <div className="flex items-center gap-1.5 bg-indigo-500/10 border border-indigo-500/25 px-2.5 py-1 rounded-full backdrop-blur-md shadow-xs group hover:border-indigo-400/50 transition-all duration-300">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5 text-indigo-400 group-hover:scale-110 transition-transform">
            <path d="M4.5 9.75a6 6 0 0111.573-2.226 3.75 3.75 0 014.177 4.174A5.25 5.25 0 0118 22.25H6.75a5.25 5.25 0 01-2.25-10.024v-.002A5.976 5.976 0 014.5 9.75z" />
          </svg>
          <div className="flex items-center gap-1 leading-none">
            <span className="text-[11px] font-bold text-indigo-200 tabular-nums font-mono">
              {(cloudStats.totalVisits || 75).toLocaleString('vi-VN')}
            </span>
            <span className="text-[9px] text-indigo-400 font-semibold uppercase tracking-wider hidden sm:inline">
              Truy cập
            </span>
          </div>
        </div>
      </div>

      {/* Top/Bottom Accents */}
      <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-indigo-500/20 to-transparent pointer-events-none"></div>
      <div className="absolute bottom-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-white/5 to-transparent pointer-events-none"></div>
    </div>
  );
};

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
    <div className="relative bg-gradient-to-r from-[#0d0a29] via-[#2b1266] to-[#0f0c33] border-b border-violet-400/25 overflow-hidden h-10 sm:h-11 flex items-center justify-between px-3 sm:px-5 z-50 shadow-[0_2px_16px_rgba(46,16,101,0.35)] select-none">
      {/* Luminous Aurora Ribbons SVG */}
      <svg
        className="absolute inset-0 w-full h-full pointer-events-none opacity-80"
        preserveAspectRatio="none"
        viewBox="0 0 1440 48"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id="marqueeAuroraLeft" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#60a5fa" stopOpacity="0" />
            <stop offset="35%" stopColor="#a855f7" stopOpacity="0.65" />
            <stop offset="65%" stopColor="#38bdf8" stopOpacity="0.45" />
            <stop offset="100%" stopColor="#c084fc" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="marqueeAuroraRight" x1="100%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#c084fc" stopOpacity="0" />
            <stop offset="30%" stopColor="#e879f9" stopOpacity="0.6" />
            <stop offset="65%" stopColor="#818cf8" stopOpacity="0.45" />
            <stop offset="100%" stopColor="#38bdf8" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path
          d="M80,48 C190,12 280,-4 420,48 L340,48 C250,14 195,20 120,48 Z"
          fill="url(#marqueeAuroraLeft)"
          style={{ filter: 'blur(4px)' }}
        />
        <path
          d="M150,0 C240,34 310,42 460,0 L390,0 C290,26 230,22 180,0 Z"
          fill="url(#marqueeAuroraLeft)"
          style={{ filter: 'blur(3px)' }}
        />
        <path
          d="M980,48 C1090,8 1180,-6 1320,48 L1240,48 C1150,14 1095,22 1020,48 Z"
          fill="url(#marqueeAuroraRight)"
          style={{ filter: 'blur(4px)' }}
        />
        <path
          d="M1040,0 C1140,36 1220,44 1360,0 L1290,0 C1190,26 1130,20 1080,0 Z"
          fill="url(#marqueeAuroraRight)"
          style={{ filter: 'blur(3px)' }}
        />
      </svg>
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_50%,rgba(139,92,246,0.28),transparent_68%)] pointer-events-none"></div>

      {/* Left side: Live Online Counter */}
      <div className="flex items-center gap-2 z-10 flex-shrink-0">
        <div className="flex items-center gap-1.5 px-3 py-1 bg-slate-950/65 rounded-full border border-emerald-400/35 backdrop-blur-md shadow-[0_0_12px_rgba(16,185,129,0.18)]">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.95)]"></span>
          </span>
          <span className="text-[11px] text-emerald-300 font-bold tracking-wider uppercase">
            LIVE <span className="text-emerald-200 font-mono tabular-nums">({cloudStats.onlineCount})</span>
          </span>
        </div>
      </div>

      {/* Center Ticker Area */}
      <div className="relative flex items-center justify-center h-full flex-1 max-w-2xl px-2 sm:px-6 overflow-hidden">
        <div
          className={`flex items-center gap-2 sm:gap-2.5 transition-all duration-700 cubic-bezier(0.34, 1.56, 0.64, 1) ${isVisible
            ? 'opacity-100 transform translate-y-0 filter blur-0'
            : 'opacity-0 transform translate-y-3 filter blur-sm'
            }`}
        >
          {currentMessage.icon === '🟢' ? (
            <span className="inline-flex h-3.5 w-3.5 rounded-full bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.9)] flex-shrink-0" />
          ) : (
            <span className="text-sm sm:text-base drop-shadow-md filter saturate-150 transform transition-transform duration-500">
              {currentMessage.icon}
            </span>
          )}
          <span className="text-xs sm:text-[13px] font-semibold tracking-tight text-emerald-200 drop-shadow-[0_1px_6px_rgba(16,185,129,0.35)] truncate max-w-[240px] sm:max-w-none">
            {currentMessage.text}
          </span>
        </div>
      </div>

      {/* Right side: Realtime Cloud Visits Pill with Crown */}
      <div className="flex items-center gap-2 z-10 flex-shrink-0">
        <div className="flex items-center gap-1.5 bg-slate-950/65 border border-amber-400/30 px-3 py-1 rounded-full backdrop-blur-md shadow-[0_0_12px_rgba(251,191,36,0.12)] group hover:border-amber-300/60 transition-all duration-300">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5 text-amber-400 drop-shadow-[0_0_6px_rgba(251,191,36,0.6)] group-hover:scale-110 transition-transform">
            <path d="M2.5 19h19v2h-19v-2zm19.57-9.36c-.21-.8-1.04-1.28-1.84-1.06L14.92 10l-2.29-5.15a1.503 1.503 0 00-2.74 0L7.6 10l-5.31-1.42c-.8-.21-1.62.27-1.83 1.07-.09.33-.06.69.08 1l3.09 6.35h16.74l3.09-6.35c.14-.32.17-.68.08-1.01z" />
          </svg>
          <div className="flex items-center gap-1 leading-none">
            <span className="text-[11px] font-bold text-amber-100 tabular-nums font-mono">
              {(cloudStats.totalVisits || 75).toLocaleString('vi-VN')}
            </span>
            <span className="text-[10px] text-amber-200/90 font-semibold uppercase tracking-wider hidden sm:inline">
              TRUY CẬP
            </span>
          </div>
        </div>
      </div>

      {/* Top/Bottom Accents */}
      <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-violet-300/30 to-transparent pointer-events-none"></div>
      <div className="absolute bottom-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-fuchsia-300/20 to-transparent pointer-events-none"></div>
    </div>
  );
};

import React from 'react';

export const Marquee: React.FC = () => {
  return (
    <div className="relative bg-slate-900 border-b border-indigo-500/30 overflow-hidden h-8 flex items-center z-50 shadow-[0_4px_12px_rgba(99,102,241,0.2)]">
      <div className="absolute inset-0 bg-gradient-to-r from-slate-900 via-transparent to-slate-900 z-10 pointer-events-none"></div>
      <div className="animate-marquee whitespace-nowrap flex gap-12 text-xs font-bold tracking-widest uppercase text-white/90 items-center">
        <span className="flex items-center gap-2">
          <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse shadow-[0_0_8px_#22c55e]"></span>
          Hệ thống đang hoạt động tốt
        </span>
        <span className="text-indigo-400">✨ Tính năng mới: Làm nét ảnh 4K</span>
        <span className="text-fuchsia-400">🚀 Profile chuyên nghiệp</span>
        <span className="text-cyan-400">💎 Công nghệ Banana Pro GenAI</span>
        <span className="flex items-center gap-2 text-amber-400">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>
          Hỗ trợ kỹ thuật: 0342.733.640
        </span>
        <span className="text-slate-400">ToolPhoto2025 - Sáng tạo không giới hạn</span>
        {/* Repeat for seamless loop illusion if needed, usually css handles loop but duplication helps fill wide screens */}
        <span className="flex items-center gap-2">
          <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse shadow-[0_0_8px_#22c55e]"></span>
          Hệ thống đang hoạt động tốt
        </span>
        <span className="text-indigo-400">✨ Tính năng mới: Làm nét ảnh 4K</span>
        <span className="flex items-center gap-2 text-amber-400">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>
          Hỗ trợ kỹ thuật: 0342.733.640
        </span>
      </div>
    </div>
  );
};

import React, { useState, useEffect, useRef } from 'react';
import { MagicWandIcon, KeyIcon, UserCircleIcon, ImageIcon, SparklesIcon, AcademicCapIcon } from './Icons';
import { User } from '../types';

interface HeaderProps {
  user: User | null;
  onLoginClick: () => void;
  onLogout: () => void;
  onHistoryClick: () => void;
  onApiKeyClick: () => void;
  isHistoryVisible: boolean;
  currentMode: 'creative' | 'id_photo' | 'edit' | 'upscale' | 'profile_pro' | 'dream_job';
  onModeChange: (mode: 'creative' | 'id_photo' | 'edit' | 'upscale' | 'profile_pro' | 'dream_job') => void;
}

const ProfileMenu: React.FC<Pick<HeaderProps, 'user' | 'onLogout' | 'onHistoryClick' | 'isHistoryVisible'>> = ({ user, onLogout, onHistoryClick, isHistoryVisible }) => {
    const [isOpen, setIsOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, []);
    
    if (!user) return null;

    return (
        <div className="relative" ref={menuRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center gap-2 text-slate-700 pl-2 pr-4 py-1.5 bg-white/50 backdrop-blur-md border border-white/60 rounded-full hover:bg-white transition-all shadow-sm group"
            >
                <img src={user.avatar} alt={user.name} className="w-8 h-8 rounded-full border border-white shadow-sm object-cover" />
                <span className="font-semibold text-sm hidden sm:inline group-hover:text-indigo-600 transition-colors">{user.name}</span>
            </button>
            {isOpen && (
                <div 
                    className="absolute right-0 mt-2 w-56 bg-white/90 backdrop-blur-xl border border-white/50 rounded-2xl shadow-xl z-30 animate-fade-in origin-top-right overflow-hidden ring-1 ring-black/5"
                >
                    <div className="px-5 py-4 bg-slate-50/50 border-b border-slate-100/50">
                        <p className="text-sm font-bold text-slate-800 truncate">{user.name}</p>
                        <p className="text-xs text-slate-500 truncate">{user.username}</p>
                    </div>
                    <div className="p-2">
                        {!isHistoryVisible && (
                            <button
                                onClick={() => {
                                    onHistoryClick();
                                    setIsOpen(false);
                                }}
                                className="w-full text-left flex items-center gap-3 px-3 py-2.5 text-sm font-medium text-slate-600 hover:bg-indigo-50 hover:text-indigo-600 rounded-xl transition-colors"
                            >
                                <UserCircleIcon className="w-5 h-5"/>
                                Trang cá nhân
                            </button>
                        )}
                        <button
                            onClick={() => {
                                onLogout();
                                setIsOpen(false);
                            }}
                            className="w-full text-left flex items-center gap-3 px-3 py-2.5 text-sm font-medium text-red-600 hover:bg-red-50 rounded-xl transition-colors"
                        >
                             <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                             </svg>
                            Đăng xuất
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};


export const Header: React.FC<HeaderProps> = ({ user, onLoginClick, onLogout, onHistoryClick, onApiKeyClick, isHistoryVisible, currentMode, onModeChange }) => {
  return (
    <header className="bg-white/60 backdrop-blur-xl border-b border-white/40 sticky top-0 z-30 transition-all duration-300 supports-[backdrop-filter]:bg-white/60">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row items-center justify-between h-auto py-3 gap-4">
          
          {/* Logo Section */}
          <div className="flex items-center space-x-3 cursor-pointer self-start md:self-auto group" onClick={() => isHistoryVisible && onHistoryClick()}> 
            <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 animate-gradient-x rounded-xl flex items-center justify-center text-white shadow-lg shadow-indigo-200 group-hover:scale-105 transition-transform duration-300 neon-border">
                <MagicWandIcon className="w-6 h-6 animate-pulse" />
            </div>
            <div>
                 <h1 className="text-xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 animate-text-shimmer tracking-tight leading-none led-text">
                ToolPhoto2025
                </h1>
                <p className="text-[10px] text-slate-500 font-bold tracking-widest uppercase">Professional AI Studio</p>
            </div>
          </div>

          {/* Mode Switcher */}
          {user && !isHistoryVisible && (
              <div className="flex overflow-x-auto bg-slate-100/50 backdrop-blur-md p-1 rounded-xl shadow-inner border border-white/50 gap-1 scrollbar-hide max-w-full">
                <button onClick={() => onModeChange('creative')} className={`px-3 py-2 text-xs font-bold rounded-lg transition-all flex items-center gap-1 whitespace-nowrap ${currentMode === 'creative' ? 'bg-white text-indigo-600 shadow-sm ring-1 ring-black/5' : 'text-slate-500 hover:text-slate-700'}`}>
                    <MagicWandIcon className="w-3 h-3" /> Sáng tạo
                </button>
                <button onClick={() => onModeChange('id_photo')} className={`px-3 py-2 text-xs font-bold rounded-lg transition-all flex items-center gap-1 whitespace-nowrap ${currentMode === 'id_photo' ? 'bg-white text-blue-600 shadow-sm ring-1 ring-black/5' : 'text-slate-500 hover:text-slate-700'}`}>
                    <UserCircleIcon className="w-3 h-3" /> Ảnh thẻ
                </button>
                <button onClick={() => onModeChange('edit')} className={`px-3 py-2 text-xs font-bold rounded-lg transition-all flex items-center gap-1 whitespace-nowrap ${currentMode === 'edit' ? 'bg-white text-emerald-600 shadow-sm ring-1 ring-black/5' : 'text-slate-500 hover:text-slate-700'}`}>
                    <ImageIcon className="w-3 h-3" /> Chỉnh sửa
                </button>
                 <button onClick={() => onModeChange('upscale')} className={`px-3 py-2 text-xs font-bold rounded-lg transition-all flex items-center gap-1 whitespace-nowrap ${currentMode === 'upscale' ? 'bg-white text-cyan-600 shadow-sm ring-1 ring-black/5' : 'text-slate-500 hover:text-slate-700'}`}>
                    <SparklesIcon className="w-3 h-3" /> Tăng nét
                </button>
                 <button onClick={() => onModeChange('profile_pro')} className={`px-3 py-2 text-xs font-bold rounded-lg transition-all flex items-center gap-1 whitespace-nowrap ${currentMode === 'profile_pro' ? 'bg-white text-fuchsia-600 shadow-sm ring-1 ring-black/5' : 'text-slate-500 hover:text-slate-700'}`}>
                    <UserCircleIcon className="w-3 h-3" /> Profile Pro
                </button>
                <button onClick={() => onModeChange('dream_job')} className={`px-3 py-2 text-xs font-bold rounded-lg transition-all flex items-center gap-1 whitespace-nowrap ${currentMode === 'dream_job' ? 'bg-white text-sky-600 shadow-sm ring-1 ring-black/5' : 'text-slate-500 hover:text-slate-700'}`}>
                    <AcademicCapIcon className="w-3 h-3" /> Ước mơ
                </button>
              </div>
          )}

          {/* User & Key Actions */}
          <div className="flex items-center gap-3 self-end md:self-auto">
             {user && (
                 <button onClick={onApiKeyClick} className="p-2.5 text-slate-500 bg-white/80 border border-slate-200/50 rounded-full hover:bg-indigo-50 hover:text-indigo-600 hover:border-indigo-100 transition-all shadow-sm backdrop-blur-sm" title="Cài đặt API Key">
                    <KeyIcon className="w-5 h-5"/>
                </button>
             )}
            
            {user ? (
              <ProfileMenu 
                user={user}
                onLogout={onLogout}
                onHistoryClick={onHistoryClick}
                isHistoryVisible={isHistoryVisible}
              />
            ) : (
                <div className="hidden"></div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};

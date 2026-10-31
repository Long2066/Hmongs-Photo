
import React, { useState, useEffect, useRef } from 'react';
import { MagicWandIcon, UserCircleIcon, ImageIcon, SparklesIcon } from './Icons';
import { User } from '../types';

interface HeaderProps {
    user: User | null;
    onLoginClick: () => void;
    onLogout: () => void;
    onHistoryClick: () => void;
    onApiKeyClick?: () => void;
    isHistoryVisible: boolean;
    currentMode: 'creative' | 'id_photo' | 'edit' | 'upscale' | 'profile_pro' | 'restore' | 'video';
    onModeChange: (mode: 'creative' | 'id_photo' | 'edit' | 'upscale' | 'profile_pro' | 'restore' | 'video') => void;
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
                className="flex items-center gap-2 text-slate-800 pl-2 pr-3.5 py-1.5 bg-white border border-slate-200 rounded-full hover:border-slate-300 transition-all shadow-xs group"
            >
                <img src={user.avatar} alt={user.name} className="w-7 h-7 rounded-full border border-slate-200 object-cover" />
                <span className="font-semibold text-xs hidden sm:inline text-slate-800 group-hover:text-indigo-600 transition-colors">{user.name}</span>
            </button>
            {isOpen && (
                <div
                    className="absolute right-0 mt-2 w-56 bg-white border border-slate-200 rounded-2xl shadow-xl z-30 animate-fade-in origin-top-right overflow-hidden ring-1 ring-slate-900/5"
                >
                    <div className="px-5 py-4 bg-slate-50 border-b border-slate-100">
                        <p className="text-sm font-bold text-slate-900 truncate">{user.name}</p>
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
                                <UserCircleIcon className="w-5 h-5" />
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
    const [isMobileMenuOpen, setMobileMenuOpen] = useState(false);
    const mobileMenuRef = useRef<HTMLDivElement>(null);

    // Close mobile menu when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (mobileMenuRef.current && !mobileMenuRef.current.contains(event.target as Node)) {
                setMobileMenuOpen(false);
            }
        };
        if (isMobileMenuOpen) {
            document.addEventListener("mousedown", handleClickOutside);
        }
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [isMobileMenuOpen]);

    const modeLabels = {
        creative: { icon: '✨', label: 'Sáng tạo', color: 'indigo' },
        id_photo: { icon: '📸', label: 'Ảnh thẻ', color: 'blue' },
        edit: { icon: '🖌️', label: 'Chỉnh sửa', color: 'emerald' },
        upscale: { icon: '🔍', label: 'Tăng nét', color: 'cyan' },
        profile_pro: { icon: '👤', label: 'Profile Pro', color: 'fuchsia' },
        restore: { icon: '🔧', label: 'Phục hồi', color: 'amber' },
        video: { icon: '🎬', label: 'Tạo Video', color: 'rose' }
    };

    return (
        <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-xs">
            <div className="container mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex flex-col md:flex-row items-center justify-between h-auto py-2.5 gap-4">

                    {/* Logo Section */}
                    <div className="flex items-center space-x-3 cursor-pointer self-start md:self-auto group" onClick={() => isHistoryVisible && onHistoryClick()}>
                        <img 
                            src="/icon.png" 
                            alt="ImageTool Logo" 
                            className="w-9 h-9 rounded-xl object-contain shadow-xs group-hover:scale-105 transition-transform duration-200 ring-1 ring-slate-900/5" 
                        />
                        <div>
                            <h1 className="text-lg font-bold text-slate-900 tracking-tight leading-none">
                                ImageTool
                            </h1>
                            <p className="text-[10px] text-slate-500 font-semibold tracking-wider uppercase mt-0.5">Professional AI Studio</p>
                        </div>
                    </div>

                    {/* Mode Switcher - Responsive: Dropdown on mobile, tabs on larger (Always visible) */}
                    {!isHistoryVisible && (
                        <>
                            {/* Mobile: Dropdown Selector */}
                            <div className="relative sm:hidden w-full" ref={mobileMenuRef}>
                                <button
                                    onClick={() => setMobileMenuOpen(!isMobileMenuOpen)}
                                    className="w-full flex items-center justify-between px-4 py-3 bg-white rounded-xl border border-slate-300 shadow-xs"
                                >
                                    <span className="flex items-center gap-2 font-bold text-slate-800">
                                        <span className="text-lg">{modeLabels[currentMode].icon}</span>
                                        {modeLabels[currentMode].label}
                                    </span>
                                    <svg className={`w-5 h-5 text-slate-500 transition-transform ${isMobileMenuOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                    </svg>
                                </button>

                                {isMobileMenuOpen && (
                                    <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-xl border border-slate-200 shadow-xl z-50 overflow-hidden animate-fade-in ring-1 ring-slate-900/5">
                                        {(Object.keys(modeLabels) as Array<keyof typeof modeLabels>).map((modeKey) => (
                                            <button
                                                key={modeKey}
                                                onClick={() => {
                                                    onModeChange(modeKey);
                                                    setMobileMenuOpen(false);
                                                }}
                                                className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${currentMode === modeKey
                                                    ? `bg-${modeLabels[modeKey].color}-50 text-${modeLabels[modeKey].color}-700 font-bold`
                                                    : 'text-slate-700 hover:bg-slate-50 font-medium'
                                                    }`}
                                            >
                                                <span className="text-lg">{modeLabels[modeKey].icon}</span>
                                                <span className="font-medium">{modeLabels[modeKey].label}</span>
                                                {currentMode === modeKey && (
                                                    <svg className="w-5 h-5 ml-auto text-indigo-600" fill="currentColor" viewBox="0 0 20 20">
                                                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                                    </svg>
                                                )}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Tablet/Desktop: Horizontal Tabs */}
                            <div className="hidden sm:flex overflow-x-auto bg-slate-100 p-1 rounded-xl border border-slate-200/90 gap-1 scrollbar-hide max-w-full">
                                <button onClick={() => onModeChange('creative')} className={`px-3 py-1.5 text-xs rounded-lg transition-all flex items-center gap-1 whitespace-nowrap ${currentMode === 'creative' ? 'bg-white text-indigo-700 font-bold shadow-xs ring-1 ring-slate-900/5' : 'text-slate-600 hover:text-slate-900 font-medium'}`}>
                                    <MagicWandIcon className="w-3.5 h-3.5" /> Sáng tạo
                                </button>
                                <button onClick={() => onModeChange('id_photo')} className={`px-3 py-1.5 text-xs rounded-lg transition-all flex items-center gap-1 whitespace-nowrap ${currentMode === 'id_photo' ? 'bg-white text-blue-700 font-bold shadow-xs ring-1 ring-slate-900/5' : 'text-slate-600 hover:text-slate-900 font-medium'}`}>
                                    <UserCircleIcon className="w-3.5 h-3.5" /> Ảnh thẻ
                                </button>
                                <button onClick={() => onModeChange('edit')} className={`px-3 py-1.5 text-xs rounded-lg transition-all flex items-center gap-1 whitespace-nowrap ${currentMode === 'edit' ? 'bg-white text-emerald-700 font-bold shadow-xs ring-1 ring-slate-900/5' : 'text-slate-600 hover:text-slate-900 font-medium'}`}>
                                    <ImageIcon className="w-3.5 h-3.5" /> Chỉnh sửa
                                </button>
                                <button onClick={() => onModeChange('upscale')} className={`px-3 py-1.5 text-xs rounded-lg transition-all flex items-center gap-1 whitespace-nowrap ${currentMode === 'upscale' ? 'bg-white text-cyan-700 font-bold shadow-xs ring-1 ring-slate-900/5' : 'text-slate-600 hover:text-slate-900 font-medium'}`}>
                                    <SparklesIcon className="w-3.5 h-3.5" /> Tăng nét
                                </button>
                                <button onClick={() => onModeChange('profile_pro')} className={`px-3 py-1.5 text-xs rounded-lg transition-all flex items-center gap-1 whitespace-nowrap ${currentMode === 'profile_pro' ? 'bg-white text-fuchsia-700 font-bold shadow-xs ring-1 ring-slate-900/5' : 'text-slate-600 hover:text-slate-900 font-medium'}`}>
                                    <UserCircleIcon className="w-3.5 h-3.5" /> Profile Pro
                                </button>
                                <button onClick={() => onModeChange('restore')} className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1 whitespace-nowrap ${currentMode === 'restore' ? 'bg-white text-amber-600 shadow-sm ring-1 ring-black/5' : 'text-slate-500 hover:text-slate-700'}`}>
                                    <SparklesIcon className="w-3.5 h-3.5" /> Phục hồi
                                </button>
                                <button onClick={() => onModeChange('video')} className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1 whitespace-nowrap ${currentMode === 'video' ? 'bg-white text-rose-600 shadow-xs ring-1 ring-slate-900/5' : 'text-slate-600 hover:text-slate-900'}`}>
                                    <span className="text-xs">🎬</span> Tạo Video
                                </button>
                            </div>
                        </>
                    )}

                    {/* User & Key Actions */}
                    <div className="flex items-center gap-3 self-end md:self-auto">



                        {user ? (
                            <ProfileMenu
                                user={user}
                                onLogout={onLogout}
                                onHistoryClick={onHistoryClick}
                                isHistoryVisible={isHistoryVisible}
                            />
                        ) : (
                            <button
                                onClick={onLoginClick}
                                className="px-4 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white text-xs font-bold rounded-xl shadow-md shadow-indigo-100 hover:shadow-indigo-200 transition-all flex items-center gap-1.5 active:scale-95"
                            >
                                <UserCircleIcon className="w-4 h-4" />
                                <span>Đăng nhập</span>
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </header>
    );
};

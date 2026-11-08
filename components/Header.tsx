
import React, { useState, useEffect, useRef } from 'react';
import { MagicWandIcon, UserCircleIcon, ImageIcon, SparklesIcon } from './Icons';
import { User } from '../types';

interface HeaderProps {
    user: User | null;
    onLoginClick: () => void;
    onLogout: () => void;
    onHistoryClick: () => void;
    onApiKeyClick?: () => void;
    onQuotaStationClick?: () => void;
    isHistoryVisible: boolean;
    currentMode: 'creative' | 'id_photo' | 'edit' | 'upscale' | 'profile_pro' | 'restore' | 'video';
    onModeChange: (mode: 'creative' | 'id_photo' | 'edit' | 'upscale' | 'profile_pro' | 'restore' | 'video') => void;
}

const ProfileMenu: React.FC<Pick<HeaderProps, 'user' | 'onLogout' | 'onHistoryClick' | 'isHistoryVisible' | 'onQuotaStationClick'>> = ({ user, onLogout, onHistoryClick, isHistoryVisible, onQuotaStationClick }) => {
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
                className="flex items-center gap-2 text-slate-800 pl-1.5 pr-3 py-1 bg-white border border-slate-200/90 rounded-full hover:border-violet-300 hover:bg-violet-50/30 transition-all shadow-xs group min-h-[40px]"
            >
                <img src={user.avatar} alt={user.name} className="w-7 h-7 rounded-full border border-slate-200 object-cover" />
                <span className="font-semibold text-xs hidden sm:inline text-slate-800 group-hover:text-violet-700 transition-colors">{user.name}</span>
                <svg className={`w-3.5 h-3.5 text-slate-400 hidden sm:inline transition-transform duration-200 ${isOpen ? 'rotate-180 text-violet-600' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
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
                        <button
                            onClick={() => {
                                onQuotaStationClick?.();
                                setIsOpen(false);
                            }}
                            className="w-full min-h-[44px] text-left flex items-center gap-3 px-3 py-2.5 text-sm font-semibold text-amber-700 hover:bg-amber-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-600 active:scale-[0.98] rounded-xl transition-all"
                        >
                            <span className="text-base">⚙️</span>
                            <span>Cấu hình & gói dịch vụ</span>
                        </button>
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
                        {typeof window !== 'undefined' && (window as any)?.electronAPI && (
                            <button
                                onClick={() => {
                                    setIsOpen(false);
                                    (window as any).electronAPI.checkForUpdates?.();
                                }}
                                className="w-full text-left flex items-center gap-3 px-3 py-2.5 text-sm font-medium text-slate-600 hover:bg-indigo-50 hover:text-indigo-600 rounded-xl transition-colors"
                            >
                                <span className="text-base">🔄</span>
                                <span>Kiểm tra cập nhật</span>
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


export const Header: React.FC<HeaderProps> = ({ user, onLoginClick, onLogout, onHistoryClick, onApiKeyClick, onQuotaStationClick, isHistoryVisible, currentMode, onModeChange }) => {
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
        <header className="bg-white/95 backdrop-blur-md border-b border-indigo-100/80 sticky top-0 z-30 shadow-[0_1px_8px_rgba(99,102,241,0.05)]">
            <div className="w-full max-w-[1920px] mx-auto px-4 sm:px-6">
                <div className="flex flex-col md:flex-row items-center justify-between h-auto py-2.5 gap-3">

                    {/* Logo Section */}
                    <div className="flex items-center space-x-2.5 cursor-pointer self-start md:self-auto group" onClick={() => isHistoryVisible && onHistoryClick()}>
                        <img 
                            src="/icon.png" 
                            alt="ImageTool Logo" 
                            className="w-9 h-9 rounded-xl object-contain shadow-xs group-hover:scale-105 transition-transform duration-200 ring-1 ring-indigo-900/5" 
                        />
                        <div>
                            <h1 className="text-[17px] font-bold text-slate-900 tracking-tight leading-none">
                                ImageTool
                            </h1>
                            <p className="text-[9.5px] text-slate-400 font-semibold tracking-wider uppercase mt-0.5">Professional AI Studio</p>
                        </div>
                    </div>

                    {/* Mode Switcher - Responsive: Dropdown on mobile, tabs on larger (Always visible) */}
                    {!isHistoryVisible && (
                        <>
                            {/* Mobile: Dropdown Selector */}
                            <div className="relative sm:hidden w-full" ref={mobileMenuRef}>
                                <button
                                    onClick={() => setMobileMenuOpen(!isMobileMenuOpen)}
                                    className="w-full flex items-center justify-between px-4 py-3 bg-white rounded-xl border border-indigo-200 shadow-xs min-h-[44px]"
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
                                                className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors min-h-[44px] ${currentMode === modeKey
                                                    ? 'bg-violet-50 text-violet-700 font-bold'
                                                    : 'text-slate-700 hover:bg-slate-50 font-medium'
                                                    }`}
                                            >
                                                <span className="text-lg">{modeLabels[modeKey].icon}</span>
                                                <span className="font-medium">{modeLabels[modeKey].label}</span>
                                                {currentMode === modeKey && (
                                                    <svg className="w-5 h-5 ml-auto text-violet-600" fill="currentColor" viewBox="0 0 20 20">
                                                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                                    </svg>
                                                )}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Tablet/Desktop: Pill Tabs matching Studio UI */}
                            <div className="hidden sm:flex overflow-x-auto items-center gap-1.5 scrollbar-hide max-w-full py-0.5 px-1">
                                <button
                                    onClick={() => onModeChange('creative')}
                                    className={`px-4 py-2 text-xs rounded-full transition-all duration-200 flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${currentMode === 'creative'
                                        ? 'bg-gradient-to-r from-[#5b3bf7] via-[#7c3aed] to-[#9333ea] text-white font-semibold shadow-md shadow-violet-500/30'
                                        : 'text-slate-600 hover:text-violet-700 hover:bg-violet-50/80 font-medium'
                                    }`}
                                >
                                    <MagicWandIcon className="w-3.5 h-3.5" />
                                    <span>Sáng tạo</span>
                                </button>
                                <button
                                    onClick={() => onModeChange('id_photo')}
                                    className={`px-3.5 py-2 text-xs rounded-full transition-all duration-200 flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${currentMode === 'id_photo'
                                        ? 'bg-gradient-to-r from-[#5b3bf7] via-[#7c3aed] to-[#9333ea] text-white font-semibold shadow-md shadow-violet-500/30'
                                        : 'text-slate-600 hover:text-violet-700 hover:bg-violet-50/80 font-medium'
                                    }`}
                                >
                                    <UserCircleIcon className="w-3.5 h-3.5" />
                                    <span>Ảnh thẻ</span>
                                </button>
                                <button
                                    onClick={() => onModeChange('edit')}
                                    className={`px-3.5 py-2 text-xs rounded-full transition-all duration-200 flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${currentMode === 'edit'
                                        ? 'bg-gradient-to-r from-[#5b3bf7] via-[#7c3aed] to-[#9333ea] text-white font-semibold shadow-md shadow-violet-500/30'
                                        : 'text-slate-600 hover:text-violet-700 hover:bg-violet-50/80 font-medium'
                                    }`}
                                >
                                    <ImageIcon className="w-3.5 h-3.5" />
                                    <span>Chỉnh sửa</span>
                                </button>
                                <button
                                    onClick={() => onModeChange('upscale')}
                                    className={`px-3.5 py-2 text-xs rounded-full transition-all duration-200 flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${currentMode === 'upscale'
                                        ? 'bg-gradient-to-r from-[#5b3bf7] via-[#7c3aed] to-[#9333ea] text-white font-semibold shadow-md shadow-violet-500/30'
                                        : 'text-slate-600 hover:text-violet-700 hover:bg-violet-50/80 font-medium'
                                    }`}
                                >
                                    <SparklesIcon className="w-3.5 h-3.5" />
                                    <span>Tăng nét</span>
                                </button>
                                <button
                                    onClick={() => onModeChange('profile_pro')}
                                    className={`px-3.5 py-2 text-xs rounded-full transition-all duration-200 flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${currentMode === 'profile_pro'
                                        ? 'bg-gradient-to-r from-[#5b3bf7] via-[#7c3aed] to-[#9333ea] text-white font-semibold shadow-md shadow-violet-500/30'
                                        : 'text-slate-600 hover:text-violet-700 hover:bg-violet-50/80 font-medium'
                                    }`}
                                >
                                    <UserCircleIcon className="w-3.5 h-3.5" />
                                    <span>Profile Pro</span>
                                </button>
                                <button
                                    onClick={() => onModeChange('restore')}
                                    className={`px-3.5 py-2 text-xs rounded-full transition-all duration-200 flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${currentMode === 'restore'
                                        ? 'bg-gradient-to-r from-[#5b3bf7] via-[#7c3aed] to-[#9333ea] text-white font-semibold shadow-md shadow-violet-500/30'
                                        : 'text-slate-600 hover:text-violet-700 hover:bg-violet-50/80 font-medium'
                                    }`}
                                >
                                    <SparklesIcon className="w-3.5 h-3.5" />
                                    <span>Phục hồi</span>
                                </button>
                                <button
                                    onClick={() => onModeChange('video')}
                                    className={`px-3.5 py-2 text-xs rounded-full transition-all duration-200 flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${currentMode === 'video'
                                        ? 'bg-gradient-to-r from-[#5b3bf7] via-[#7c3aed] to-[#9333ea] text-white font-semibold shadow-md shadow-violet-500/30'
                                        : 'text-slate-600 hover:text-violet-700 hover:bg-violet-50/80 font-medium'
                                    }`}
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.7} stroke="currentColor" className="w-3.5 h-3.5">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M3.375 19.5h17.25m-17.25 0a1.125 1.125 0 01-1.125-1.125M3.375 19.5h1.5C5.496 19.5 6 18.996 6 18.375m-3.75 0V5.625m0 12.75v-1.5c0-.621.504-1.125 1.125-1.125m18.375 2.625V5.625m0 12.75c0 .621-.504 1.125-1.125 1.125m1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125m0 3.75h-1.5A1.125 1.125 0 0118 18.375M20.625 4.5H3.375m17.25 0c.621 0 1.125.504 1.125 1.125M20.625 4.5h-1.5C18.504 4.5 18 5.004 18 5.625m3.75 0v1.5c0 .621-.504 1.125-1.125 1.125M3.375 4.5c-.621 0-1.125.504-1.125 1.125M3.375 4.5h1.5C5.496 4.5 6 5.004 6 5.625m-3.75 0v1.5c0 .621.504 1.125 1.125 1.125m0 0h1.5m-1.5 0c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125m1.5-3.75C5.496 8.25 6 7.746 6 7.125v-1.5M4.875 8.25C5.496 8.25 6 8.754 6 9.375v1.5m0-5.25v5.25m0-5.25C6 5.004 6.504 4.5 7.125 4.5h9.75c.621 0 1.125.504 1.125 1.125m1.125 2.625h1.5m-1.5 0A1.125 1.125 0 0118 7.125v-1.5m1.125 2.625c-.621 0-1.125.504-1.125 1.125v1.5m2.625-2.625c.621 0 1.125.504 1.125 1.125v1.5c0 .621-.504 1.125-1.125 1.125M18 5.625v5.25M7.125 12h9.75m-9.75 0A1.125 1.125 0 016 10.875M7.125 12C6.504 12 6 12.504 6 13.125m0-2.25C6 11.496 5.496 12 4.875 12M18 10.875c0 .621-.504 1.125-1.125 1.125M18 10.875c0 .621.504 1.125 1.125 1.125m-2.25 0c.621 0 1.125.504 1.125 1.125m-12 5.25v-5.25m0 5.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125m-12 0v-1.5c0-.621-.504-1.125-1.125-1.125M18 18.375v-5.25m0 5.25v-1.5c0-.621.504-1.125 1.125-1.125M18 13.125v1.5c0 .621.504 1.125 1.125 1.125M18 13.125c0-.621.504-1.125 1.125-1.125M6 13.125v1.5c0 .621-.504 1.125-1.125 1.125M6 13.125C6 12.504 5.496 12 4.875 12m-1.5 0h1.5m-1.5 0c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125M19.125 12h1.5m0 0c.621 0 1.125.504 1.125 1.125v1.5c0 .621-.504 1.125-1.125 1.125m-17.25 0h1.5m14.25 0h1.5" />
                                    </svg>
                                    <span>Tạo Video</span>
                                </button>
                            </div>
                        </>
                    )}

                    {/* User & Key Actions */}
                    <div className="flex items-center gap-2.5 self-end md:self-auto">
                        {user ? (
                            <div className="flex items-center gap-2.5">
                                <button
                                    onClick={onQuotaStationClick}
                                    title="Cấu hình - Nhận ngay 10 ảnh miễn phí"
                                    className="w-10 h-10 bg-white hover:bg-violet-50 text-slate-600 hover:text-violet-700 border border-slate-200/90 hover:border-violet-200 rounded-full transition-all shadow-xs active:scale-95 flex items-center justify-center relative group cursor-pointer"
                                    aria-label="Cấu hình"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.6} stroke="currentColor" className="w-5 h-5 group-hover:rotate-45 transition-transform duration-300">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" />
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                    </svg>
                                    <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-amber-400 rounded-full ring-2 ring-white animate-pulse" />
                                </button>
                                <ProfileMenu
                                    user={user}
                                    onLogout={onLogout}
                                    onHistoryClick={onHistoryClick}
                                    isHistoryVisible={isHistoryVisible}
                                    onQuotaStationClick={onQuotaStationClick}
                                />
                            </div>
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

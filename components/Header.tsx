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
    onBotClick?: () => void;
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
                className="flex items-center gap-2 text-slate-800 pl-1.5 pr-3 py-1 bg-white border border-slate-200/90 rounded-full hover:border-violet-300 hover:bg-violet-50/30 transition-all shadow-xs group min-h-[40px] cursor-pointer"
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
                            className="w-full min-h-[44px] text-left flex items-center gap-3 px-3 py-2.5 text-sm font-semibold text-amber-700 hover:bg-amber-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-600 active:scale-[0.98] rounded-xl transition-all cursor-pointer"
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
                                className="w-full min-h-[44px] text-left flex items-center gap-3 px-3 py-2.5 text-sm font-medium text-slate-600 hover:bg-indigo-50 hover:text-indigo-600 rounded-xl transition-colors cursor-pointer"
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
                                className="w-full min-h-[44px] text-left flex items-center gap-3 px-3 py-2.5 text-sm font-medium text-slate-600 hover:bg-indigo-50 hover:text-indigo-600 rounded-xl transition-colors cursor-pointer"
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
                            className="w-full min-h-[44px] text-left flex items-center gap-3 px-3 py-2.5 text-sm font-medium text-red-600 hover:bg-red-50 rounded-xl transition-colors cursor-pointer"
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

export const Header: React.FC<HeaderProps> = ({
    user,
    onLoginClick,
    onLogout,
    onHistoryClick,
    onApiKeyClick,
    onQuotaStationClick,
    onBotClick,
    isHistoryVisible,
    currentMode,
    onModeChange
}) => {
    const [isDrawerOpen, setDrawerOpen] = useState(false);

    // Prevent body scrolling when mobile drawer is open
    useEffect(() => {
        if (isDrawerOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
        }
        return () => {
            document.body.style.overflow = '';
        };
    }, [isDrawerOpen]);

    const modeLabels: Record<string, { icon: string; label: string; desc: string }> = {
        creative: { icon: '✨', label: 'Sáng tạo', desc: 'Visual thổ cẩm H\'Mông, Idol, Nghệ thuật' },
        id_photo: { icon: '📸', label: 'Ảnh thẻ', desc: 'Chuẩn hộ chiếu, visa, CCCD, in khổ A4' },
        edit: { icon: '🖌️', label: 'Chỉnh sửa', desc: 'Inpaint thay đồ, đổi tóc, giữ mặt gốc' },
        upscale: { icon: '🔍', label: 'Tăng nét', desc: 'Siêu phân giải 2K & 4K Ultra Sharp' },
        profile_pro: { icon: '👤', label: 'Profile Pro', desc: 'Ảnh chân dung doanh nhân, studio đẳng cấp' },
        restore: { icon: '🔧', label: 'Phục hồi', desc: 'Phục chế ảnh cũ rách, tô màu đen trắng' },
        video: { icon: '🎬', label: 'Tạo Video', desc: 'Video AI điện ảnh Grok 1.5 & Alibaba Wan' }
    };

    return (
        <>
            <header className="bg-white/95 backdrop-blur-md border-b border-indigo-100/80 sticky top-0 z-30 shadow-[0_1px_8px_rgba(99,102,241,0.05)]">
                <div className="w-full max-w-[1920px] mx-auto px-3 sm:px-6">

                    {/* ============================================================== */}
                    {/* MOBILE TOP BAR (lg:hidden): 3-Gạch góc trái, Bot AI góc phải */}
                    {/* ============================================================== */}
                    <div className="flex lg:hidden items-center justify-between h-14 w-full">
                        {/* GÓC TRÁI: Nút 3 gạch hamburger + Brand Logo */}
                        <div className="flex items-center gap-2 min-w-0">
                            {/* Nút Hamburger 3 gạch (Touch target chuẩn 44x44px) */}
                            <button
                                type="button"
                                onClick={() => setDrawerOpen(true)}
                                aria-label="Mở menu tính năng và trang cá nhân"
                                className="min-w-[44px] min-h-[44px] w-11 h-11 flex items-center justify-center rounded-xl text-slate-700 hover:text-indigo-600 hover:bg-indigo-50/80 active:scale-95 transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.2} stroke="currentColor" className="w-6 h-6">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
                                </svg>
                            </button>

                            {/* Brand Logo & Mode Badge */}
                            <div
                                className="flex items-center gap-2 cursor-pointer truncate select-none group"
                                onClick={() => {
                                    if (isHistoryVisible) onHistoryClick();
                                    else setDrawerOpen(true);
                                }}
                            >
                                <img
                                    src="/icon.png"
                                    alt="ImageTool"
                                    className="w-8 h-8 rounded-lg object-contain shadow-2xs ring-1 ring-indigo-900/5 group-hover:scale-105 transition-transform"
                                />
                                <div className="flex flex-col min-w-0">
                                    <div className="flex items-center gap-1.5 truncate">
                                        <span className="text-sm font-extrabold text-slate-900 tracking-tight">ImageTool</span>
                                        <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-violet-100 text-violet-700 truncate max-w-[110px]">
                                            {modeLabels[currentMode]?.icon} {modeLabels[currentMode]?.label}
                                        </span>
                                    </div>
                                    <span className="text-[9px] text-slate-400 font-semibold tracking-wider uppercase leading-none">Studio Edition</span>
                                </div>
                            </div>
                        </div>

                        {/* GÓC PHẢI: Con bot AI lên đầu trang góc phải */}
                        <div className="flex items-center gap-2 flex-shrink-0">
                            {/* Nút Bot Hỗ trợ AI (Touch target 44x44px) */}
                            <button
                                type="button"
                                onClick={onBotClick}
                                aria-label="Mở Bot Hỗ trợ AI"
                                className="min-h-[44px] px-3 py-2 bg-gradient-to-r from-indigo-600 via-indigo-700 to-purple-600 hover:from-indigo-700 hover:to-purple-700 active:scale-95 text-white rounded-xl shadow-md shadow-indigo-500/20 transition-all flex items-center gap-1.5 cursor-pointer relative group"
                                title="Bot Hỗ trợ AI - Hỏi đáp tính năng & gói cước"
                            >
                                <div className="relative flex items-center justify-center">
                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5 text-white">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                                    </svg>
                                    <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-emerald-400 rounded-full ring-2 ring-indigo-700 animate-pulse" />
                                </div>
                                <span className="text-xs font-bold tracking-tight">Bot AI</span>
                            </button>
                        </div>
                    </div>

                    {/* ============================================================== */}
                    {/* DESKTOP BAR (hidden lg:flex): Layout đầy đủ 3 phần */}
                    {/* ============================================================== */}
                    <div className="hidden lg:flex items-center justify-between h-16 py-2.5 gap-3">
                        {/* Logo Section */}
                        <div className="flex items-center space-x-2.5 cursor-pointer group flex-shrink-0" onClick={() => isHistoryVisible && onHistoryClick()}>
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

                        {/* Mode Switcher - 7 Pill Tabs */}
                        {!isHistoryVisible && (
                            <div className="flex overflow-x-auto items-center gap-1.5 scrollbar-hide max-w-full py-0.5 px-1">
                                {(Object.keys(modeLabels) as Array<keyof typeof modeLabels>).map((modeKey) => {
                                    const item = modeLabels[modeKey];
                                    const isActive = currentMode === modeKey;
                                    return (
                                        <button
                                            key={modeKey}
                                            onClick={() => onModeChange(modeKey as any)}
                                            className={`px-3.5 py-2 text-xs rounded-full transition-all duration-200 flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${isActive
                                                ? 'bg-gradient-to-r from-[#5b3bf7] via-[#7c3aed] to-[#9333ea] text-white font-semibold shadow-md shadow-violet-500/30'
                                                : 'text-slate-600 hover:text-violet-700 hover:bg-violet-50/80 font-medium'
                                                }`}
                                        >
                                            <span>{item.icon}</span>
                                            <span>{item.label}</span>
                                        </button>
                                    );
                                })}
                            </div>
                        )}

                        {/* User & Actions */}
                        <div className="flex items-center gap-2.5 flex-shrink-0">
                            {/* Bot AI Button on Desktop */}
                            <button
                                onClick={onBotClick}
                                aria-label="Mở Bot Hỗ trợ AI"
                                className="h-10 px-3 bg-indigo-50 hover:bg-indigo-100/80 text-indigo-700 border border-indigo-200/80 rounded-full transition-all shadow-2xs active:scale-95 flex items-center gap-1.5 cursor-pointer relative group"
                                title="Bot Hỗ trợ AI - Giải đáp thắc mắc 24/7"
                            >
                                <div className="relative">
                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" className="w-4 h-4 text-indigo-600">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                                    </svg>
                                    <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-emerald-500 rounded-full ring-2 ring-white animate-pulse" />
                                </div>
                                <span className="text-xs font-bold">Bot AI</span>
                            </button>

                            {/* Bánh răng Cấu hình */}
                            <button
                                onClick={onQuotaStationClick}
                                title="Cấu hình & gói dịch vụ"
                                className="w-10 h-10 bg-white hover:bg-violet-50 text-slate-600 hover:text-violet-700 border border-slate-200/90 hover:border-violet-200 rounded-full transition-all shadow-xs active:scale-95 flex items-center justify-center relative group cursor-pointer"
                                aria-label="Cấu hình & gói dịch vụ"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.6} stroke="currentColor" className="w-5 h-5 group-hover:rotate-45 transition-transform duration-300">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" />
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                </svg>
                                <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-amber-400 rounded-full ring-2 ring-white animate-pulse" />
                            </button>

                            {/* Profile Menu hoặc Nút Đăng nhập */}
                            {user ? (
                                <ProfileMenu
                                    user={user}
                                    onLogout={onLogout}
                                    onHistoryClick={onHistoryClick}
                                    isHistoryVisible={isHistoryVisible}
                                    onQuotaStationClick={onQuotaStationClick}
                                />
                            ) : (
                                <button
                                    onClick={onLoginClick}
                                    className="px-4 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white text-xs font-bold rounded-xl shadow-md shadow-indigo-100 hover:shadow-indigo-200 transition-all flex items-center gap-1.5 active:scale-95 cursor-pointer"
                                >
                                    <UserCircleIcon className="w-4 h-4" />
                                    <span>Đăng nhập</span>
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </header>

            {/* ============================================================== */}
            {/* MOBILE SLIDE-OVER DRAWER (Bảng trượt từ góc trái khi bấm 3 gạch) */}
            {/* ============================================================== */}
            {isDrawerOpen && (
                <div className="fixed inset-0 z-[80] lg:hidden animate-fade-in">
                    {/* Backdrop */}
                    <div
                        className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity"
                        onClick={() => setDrawerOpen(false)}
                    />

                    {/* Drawer Panel */}
                    <div className="fixed inset-y-0 left-0 w-[320px] max-w-[85vw] bg-white shadow-2xl z-[85] flex flex-col justify-between overflow-y-auto border-r border-slate-200">
                        {/* Drawer Header */}
                        <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/60">
                            <div className="flex items-center gap-2.5">
                                <img src="/icon.png" alt="ImageTool" className="w-8 h-8 rounded-lg object-contain shadow-xs" />
                                <div>
                                    <h3 className="text-sm font-bold text-slate-900">ImageTool Menu</h3>
                                    <p className="text-[10px] text-slate-500 font-medium">Bản quyền ImageTool Studio</p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => setDrawerOpen(false)}
                                aria-label="Đóng menu"
                                className="w-10 h-10 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-all cursor-pointer"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.2} stroke="currentColor" className="w-5 h-5">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>

                        {/* Drawer Body */}
                        <div className="p-4 space-y-5 flex-1">
                            {/* 1. MỤC TRANG CÁ NHÂN & TÀI KHOẢN */}
                            <div className="bg-gradient-to-br from-indigo-50/80 to-purple-50/50 rounded-2xl p-3.5 border border-indigo-100/90 shadow-2xs">
                                {user ? (
                                    <div className="space-y-3">
                                        <div className="flex items-center gap-3">
                                            <img
                                                src={user.avatar}
                                                alt={user.name}
                                                className="w-11 h-11 rounded-full border-2 border-indigo-300 object-cover shadow-xs"
                                            />
                                            <div className="min-w-0 flex-1">
                                                <p className="text-sm font-bold text-slate-900 truncate">{user.name}</p>
                                                <p className="text-xs text-slate-500 truncate">{user.username}</p>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-2 gap-2 pt-1 border-t border-indigo-100/70">
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setDrawerOpen(false);
                                                    onHistoryClick();
                                                }}
                                                className="min-h-[44px] flex items-center justify-center gap-1.5 px-3 py-2 bg-white hover:bg-indigo-50 text-indigo-700 text-xs font-bold rounded-xl border border-indigo-200/80 shadow-2xs transition-all active:scale-95 cursor-pointer"
                                            >
                                                <UserCircleIcon className="w-4 h-4" />
                                                <span>Trang cá nhân</span>
                                            </button>

                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setDrawerOpen(false);
                                                    onLogout();
                                                }}
                                                className="min-h-[44px] flex items-center justify-center gap-1.5 px-3 py-2 bg-white hover:bg-red-50 text-red-600 text-xs font-bold rounded-xl border border-red-200/80 shadow-2xs transition-all active:scale-95 cursor-pointer"
                                            >
                                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75" />
                                                </svg>
                                                <span>Đăng xuất</span>
                                            </button>
                                        </div>
                                    </div>
                               ) : (
                                    <div className="text-center py-2">
                                        <p className="text-xs text-slate-600 mb-2.5 font-medium">Đăng nhập để lưu trữ lịch sử và quản lý gói cước</p>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setDrawerOpen(false);
                                                onLoginClick();
                                            }}
                                            className="min-h-[44px] w-full py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white text-xs font-bold rounded-xl shadow-md transition-all active:scale-95 flex items-center justify-center gap-1.5 cursor-pointer"
                                        >
                                            <UserCircleIcon className="w-4 h-4" />
                                            <span>Đăng nhập ngay</span>
                                        </button>
                                    </div>
                                )}
                            </div>

                            {/* 2. MỤC BÁNH RĂNG CẤU HÌNH & GÓI DỊCH VỤ */}
                            <button
                                type="button"
                                onClick={() => {
                                    setDrawerOpen(false);
                                    onQuotaStationClick?.();
                                }}
                                className="w-full min-h-[50px] p-3 rounded-2xl bg-gradient-to-r from-amber-50 to-orange-50/70 border border-amber-200/80 hover:border-amber-300 text-left flex items-center justify-between shadow-2xs active:scale-[0.99] transition-all cursor-pointer group"
                            >
                                <div className="flex items-center gap-3">
                                    <div className="w-9 h-9 rounded-xl bg-amber-500 text-white flex items-center justify-center text-lg shadow-xs group-hover:rotate-45 transition-transform duration-300">
                                        ⚙️
                                    </div>
                                    <div>
                                        <div className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                                            Cấu hình & Gói dịch vụ
                                            <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-amber-200 text-amber-900">HOT</span>
                                        </div>
                                        <p className="text-[11px] text-slate-500">Nâng cấp Plus, Pro & Nạp ví Video</p>
                                    </div>
                                </div>
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.2} stroke="currentColor" className="w-4 h-4 text-amber-600">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                                </svg>
                            </button>

                            {/* 3. MENU TÍNH NĂNG (7 CHẾ ĐỘ SÁNG TẠO) */}
                            <div>
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
                                        Danh mục tính năng (7 Chế độ)
                                    </span>
                                    <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full">
                                        7 Chế độ AI
                                    </span>
                                </div>

                                <div className="space-y-1.5">
                                    {(Object.keys(modeLabels) as Array<keyof typeof modeLabels>).map((modeKey) => {
                                        const item = modeLabels[modeKey];
                                        const isActive = currentMode === modeKey;
                                        return (
                                            <button
                                                key={modeKey}
                                                type="button"
                                                onClick={() => {
                                                    onModeChange(modeKey as any);
                                                    setDrawerOpen(false);
                                                }}
                                                className={`w-full min-h-[48px] p-2.5 rounded-xl border text-left flex items-center justify-between transition-all cursor-pointer ${isActive
                                                    ? 'bg-violet-50/90 border-violet-400/90 ring-1 ring-violet-400/30 shadow-xs'
                                                    : 'bg-white border-slate-200/80 hover:bg-slate-50 hover:border-slate-300'
                                                    }`}
                                            >
                                                <div className="flex items-center gap-2.5 min-w-0">
                                                    <span className="text-xl flex-shrink-0">{item.icon}</span>
                                                    <div className="min-w-0">
                                                        <p className={`text-xs truncate ${isActive ? 'font-bold text-violet-900' : 'font-semibold text-slate-800'}`}>
                                                            {item.label}
                                                        </p>
                                                        <p className="text-[10px] text-slate-400 truncate">{item.desc}</p>
                                                    </div>
                                                </div>
                                                {isActive && (
                                                    <svg className="w-4 h-4 text-violet-600 flex-shrink-0 ml-2" fill="currentColor" viewBox="0 0 20 20">
                                                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                                    </svg>
                                                )}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>

                        {/* Drawer Footer */}
                        <div className="p-4 border-t border-slate-100 bg-slate-50 space-y-2">
                            <div className="flex items-center justify-between text-xs text-slate-600">
                                <span>Hotline / Zalo 24/7:</span>
                                <a href="tel:0342733640" className="font-bold text-indigo-600 hover:underline">0342.733.640</a>
                            </div>
                            <p className="text-[10px] text-slate-400 text-center">ImageTool © All rights reserved</p>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

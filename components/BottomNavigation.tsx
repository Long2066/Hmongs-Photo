/**
 * Mobile Bottom Navigation Component
 * Provides touch-friendly navigation for mobile devices with Input/Config/Run tabs
 */

import React from 'react';

interface BottomNavigationProps {
    onInputClick: () => void;
    onConfigClick: () => void;
    onRunClick: () => void;
    isLoading: boolean;
    activeTab: 'input' | 'config' | null;
}

export const BottomNavigation: React.FC<BottomNavigationProps> = ({
    onInputClick,
    onConfigClick,
    onRunClick,
    isLoading,
    activeTab
}) => {
    return (
        <div className="lg:hidden fixed bottom-0 left-0 right-0 z-50 safe-area-bottom">
            {/* Background with blur */}
            <div className="bg-white/95 border-t border-slate-200 shadow-lg">
                <div className="flex items-center justify-around py-2 px-4 gap-2">
                    {/* Input Button */}
                    <button
                        onClick={onInputClick}
                        className={`flex-1 flex flex-col items-center gap-1 py-3 px-2 rounded-xl transition-all ${activeTab === 'input'
                                ? 'bg-indigo-100 text-indigo-600'
                                : 'text-slate-500 hover:bg-slate-100'
                            }`}
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
                        </svg>
                        <span className="text-xs font-bold">Nhập liệu</span>
                    </button>

                    {/* Run Button (Center, Highlighted) */}
                    <button
                        onClick={onRunClick}
                        disabled={isLoading}
                        className={`flex flex-col items-center justify-center w-20 h-20 -mt-6 rounded-full shadow-lg transition-all ${isLoading
                                ? 'bg-slate-400 cursor-not-allowed'
                                : 'bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 hover:shadow-xl active:scale-95'
                            }`}
                    >
                        {isLoading ? (
                            <div className="w-7 h-7 border-3 border-white/30 border-t-white rounded-full animate-spin"></div>
                        ) : (
                            <>
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-7 h-7 text-white">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                                </svg>
                                <span className="text-[10px] font-bold text-white mt-0.5">TẠO ẢNH</span>
                            </>
                        )}
                    </button>

                    {/* Config Button */}
                    <button
                        onClick={onConfigClick}
                        className={`flex-1 flex flex-col items-center gap-1 py-3 px-2 rounded-xl transition-all ${activeTab === 'config'
                                ? 'bg-indigo-100 text-indigo-600'
                                : 'text-slate-500 hover:bg-slate-100'
                            }`}
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6h9.75M10.5 6a1.5 1.5 0 11-3 0m3 0a1.5 1.5 0 10-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-9.75 0h9.75" />
                        </svg>
                        <span className="text-xs font-bold">Cấu hình</span>
                    </button>
                </div>
            </div>
        </div>
    );
};

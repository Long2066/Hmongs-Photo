import React, { useState, useEffect, useCallback } from 'react';
import { subscribeToNotifications, markNotificationAsRead, isNotificationRead, NotificationData } from '../services/firebaseService';

interface NotificationPopupProps {
    userId: string;
}

export const NotificationPopup: React.FC<NotificationPopupProps> = ({ userId }) => {
    const [currentNotification, setCurrentNotification] = useState<NotificationData | null>(null);
    const [isVisible, setIsVisible] = useState(false);
    const [isClosing, setIsClosing] = useState(false);

    // Track last shown notification to avoid re-showing
    const [lastShownId, setLastShownId] = useState<string | null>(() => {
        return localStorage.getItem(`last_shown_notif_${userId}`);
    });

    const handleClose = useCallback(() => {
        setIsClosing(true);

        // Mark as read
        if (currentNotification) {
            markNotificationAsRead(userId, currentNotification.id);
            localStorage.setItem(`last_shown_notif_${userId}`, currentNotification.id);
        }

        setTimeout(() => {
            setIsVisible(false);
            setIsClosing(false);
            setCurrentNotification(null);
        }, 300);
    }, [currentNotification, userId]);

    useEffect(() => {
        if (!userId) return;

        const unsubscribe = subscribeToNotifications(userId, (notifications) => {
            if (notifications.length === 0) return;

            // Find the newest unread notification
            const unreadNotif = notifications.find(n => {
                const alreadyRead = isNotificationRead(userId, n.id);
                const alreadyShown = n.id === lastShownId;
                return !alreadyRead && !alreadyShown;
            });

            if (unreadNotif && !currentNotification) {
                setCurrentNotification(unreadNotif);
                setIsVisible(true);
                setLastShownId(unreadNotif.id);
            }
        });

        return () => unsubscribe();
    }, [userId, lastShownId, currentNotification]);

    // Auto-close after 15 seconds
    useEffect(() => {
        if (isVisible && currentNotification) {
            const timer = setTimeout(() => {
                handleClose();
            }, 15000);

            return () => clearTimeout(timer);
        }
    }, [isVisible, currentNotification, handleClose]);

    if (!isVisible || !currentNotification) return null;

    const formatTime = (timestamp: number) => {
        const now = Date.now();
        const diff = now - timestamp;

        if (diff < 60000) return 'Vừa xong';
        if (diff < 3600000) return `${Math.floor(diff / 60000)} phút trước`;
        if (diff < 86400000) return `${Math.floor(diff / 3600000)} giờ trước`;
        return new Date(timestamp).toLocaleDateString('vi-VN');
    };

    return (
        <div
            className={`fixed top-20 right-4 z-50 max-w-md transition-all duration-300 ${isClosing ? 'opacity-0 translate-x-full' : 'opacity-100 translate-x-0'
                }`}
            style={{
                animation: isClosing ? 'none' : 'slideInRight 0.4s cubic-bezier(0.16, 1, 0.3, 1)'
            }}
        >
            <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
                {/* Gradient Header */}
                <div className="bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 px-5 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <span className="text-white text-lg">🔔</span>
                        <span className="text-white font-bold text-sm tracking-wide">THÔNG BÁO MỚI</span>
                    </div>
                    <button
                        onClick={handleClose}
                        className="text-white/80 hover:text-white transition-colors p-1 rounded-full hover:bg-white/20"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* Content */}
                <div className="p-5">
                    <h3 className="text-lg font-bold text-slate-800 mb-2">
                        {currentNotification.title}
                    </h3>
                    <p className="text-slate-600 text-sm leading-relaxed mb-4">
                        {currentNotification.message}
                    </p>

                    <div className="flex items-center justify-between">
                        <span className="text-xs text-slate-400">
                            {formatTime(currentNotification.timestamp)}
                        </span>
                        <button
                            onClick={handleClose}
                            className="px-4 py-2 bg-gradient-to-r from-indigo-500 to-purple-600 text-white text-sm font-bold rounded-lg hover:shadow-lg hover:shadow-indigo-500/30 transition-all"
                        >
                            Đã hiểu
                        </button>
                    </div>
                </div>

                {/* Progress bar for auto-close */}
                <div className="h-1 bg-slate-100">
                    <div
                        className="h-full bg-gradient-to-r from-indigo-500 to-purple-600 transition-all"
                        style={{
                            animation: 'shrinkWidth 15s linear forwards'
                        }}
                    />
                </div>
            </div>

            {/* Animation keyframes */}
            <style>{`
                @keyframes slideInRight {
                    from {
                        opacity: 0;
                        transform: translateX(100%);
                    }
                    to {
                        opacity: 1;
                        transform: translateX(0);
                    }
                }
                @keyframes shrinkWidth {
                    from {
                        width: 100%;
                    }
                    to {
                        width: 0%;
                    }
                }
            `}</style>
        </div>
    );
};

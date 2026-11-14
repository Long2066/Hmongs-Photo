import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
    subscribeToNotifications,
    markNotificationAsRead,
    isNotificationRead,
    dismissNotification,
    NotificationData
} from '../services/firebaseService';

interface NotificationPopupProps {
    userId: string;
}

export const NotificationPopup: React.FC<NotificationPopupProps> = ({ userId }) => {
    const [currentNotification, setCurrentNotification] = useState<NotificationData | null>(null);
    const [isVisible, setIsVisible] = useState(false);
    const [isClosing, setIsClosing] = useState(false);

    // Track last shown notification to avoid re-showing
    const [lastShownId, setLastShownId] = useState<string | null>(() => {
        try {
            return localStorage.getItem(`last_shown_notif_${userId}`);
        } catch {
            return null;
        }
    });

    const isDismissing = useRef(false);

    const handleClose = useCallback(async () => {
        if (isDismissing.current) return;
        isDismissing.current = true;
        setIsClosing(true);

        // Mark as read & permanently delete from Firestore if user-targeted
        if (currentNotification) {
            try {
                await dismissNotification(userId, currentNotification.id, currentNotification.targetUserId);
            } catch (err) {
                console.warn("[NotificationPopup] Error dismissing notification:", err);
            }
        }

        setTimeout(() => {
            setIsVisible(false);
            setIsClosing(false);
            setCurrentNotification(null);
            isDismissing.current = false;
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
                // ĐÁNH DẤU ĐÃ XEM NGAY LẬP TỨC:
                // Ghi vào localStorage ngay tại thời điểm xuất hiện để tránh trường hợp user tắt app/F5 thì bị hiện lại
                markNotificationAsRead(userId, unreadNotif.id);
                try {
                    localStorage.setItem(`last_shown_notif_${userId}`, unreadNotif.id);
                } catch (e) {
                    console.warn(e);
                }

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
            className={`fixed top-16 md:top-20 left-4 right-4 md:left-auto md:right-6 md:max-w-md z-50 transition-all duration-300 ${
                isClosing ? 'opacity-0 translate-y-[-10px] md:translate-x-full' : 'opacity-100 translate-y-0 md:translate-x-0'
            }`}
            style={{
                animation: isClosing ? 'none' : 'slideInRight 0.4s cubic-bezier(0.16, 1, 0.3, 1)'
            }}
            role="alert"
            aria-live="polite"
        >
            <div className="bg-white/95 backdrop-blur-md rounded-2xl shadow-2xl ring-1 ring-slate-900/10 overflow-hidden">
                {/* Gradient Header */}
                <div className="bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 px-5 py-3.5 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <span className="text-white text-base select-none">🔔</span>
                        <span className="text-white font-bold text-xs uppercase tracking-wider">THÔNG BÁO MỚI</span>
                    </div>
                    <button
                        onClick={handleClose}
                        className="text-white/80 hover:text-white transition-colors p-2 min-w-[36px] min-h-[36px] flex items-center justify-center rounded-full hover:bg-white/20 active:scale-90"
                        title="Đóng thông báo"
                        aria-label="Đóng"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* Content */}
                <div className="p-5">
                    <h3 className="text-base md:text-lg font-bold text-slate-900 mb-2 leading-snug">
                        {currentNotification.title}
                    </h3>
                    <p className="text-slate-600 text-sm leading-relaxed mb-4 whitespace-pre-line">
                        {currentNotification.message}
                    </p>

                    <div className="flex items-center justify-between pt-1">
                        <span className="text-xs font-mono tabular-nums text-slate-400">
                            {formatTime(currentNotification.timestamp)}
                        </span>
                        <button
                            onClick={handleClose}
                            className="min-h-[44px] px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white text-sm font-semibold rounded-xl hover:shadow-lg hover:shadow-indigo-500/25 active:scale-95 transition-all focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
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
                        transform: translateY(-10px);
                    }
                    to {
                        opacity: 1;
                        transform: translateY(0);
                    }
                }
                @media (min-width: 768px) {
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

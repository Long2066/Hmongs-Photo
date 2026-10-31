import React, { useState, useRef } from 'react';
import emailjs from '@emailjs/browser';
import { submitUserFeedback } from '../services/firebaseService';

// EmailJS Configuration
const EMAILJS_SERVICE_ID = 'service_7nxzcwc';
const EMAILJS_TEMPLATE_ID = 'template_x0ox4cd';
const EMAILJS_PUBLIC_KEY = 'DnCgag4BDRk19OGNV';

interface FeedbackBubbleProps {
    userName?: string;
    userEmail?: string;
}

export const FeedbackBubble: React.FC<FeedbackBubbleProps> = ({ userName = '', userEmail = '' }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [isSending, setIsSending] = useState(false);
    const [isSent, setIsSent] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [formData, setFormData] = useState({
        name: userName,
        email: userEmail,
        title: '',
        message: ''
    });

    const formRef = useRef<HTMLFormElement>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!formData.name.trim() || !formData.email.trim() || !formData.message.trim()) {
            setError('Vui lòng điền đầy đủ thông tin!');
            return;
        }

        setIsSending(true);
        setError(null);

        try {
            // 1. Primary: Save directly to Firebase Firestore for Admin Panel "Hòm thư góp ý"
            await submitUserFeedback({
                name: formData.name,
                email: formData.email,
                title: formData.title || 'Góp ý ImageTool',
                message: formData.message
            });

            // 2. Secondary: Attempt email notification via EmailJS (non-blocking)
            try {
                await emailjs.send(
                    EMAILJS_SERVICE_ID,
                    EMAILJS_TEMPLATE_ID,
                    {
                        name: formData.name,
                        email: formData.email,
                        title: formData.title || 'Góp ý ImageTool',
                        message: formData.message
                    },
                    EMAILJS_PUBLIC_KEY
                );
            } catch (emailErr) {
                console.warn('[Feedback] EmailJS dispatch non-critical error:', emailErr);
            }

            setIsSent(true);
            setFormData({ name: userName, email: userEmail, title: '', message: '' });

            // Auto close after 3 seconds
            setTimeout(() => {
                setIsOpen(false);
                setIsSent(false);
            }, 3000);
        } catch (err) {
            console.error('Feedback submit error:', err);
            setError('Gửi không thành công. Vui lòng thử lại!');
        } finally {
            setIsSending(false);
        }
    };

    return (
        <>
            {/* Bubble Button */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className={`fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full shadow-2xl transition-all duration-300 flex items-center justify-center group ${isOpen
                    ? 'bg-slate-600 hover:bg-slate-700 rotate-45'
                    : 'bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 hover:scale-110'
                    }`}
                title={isOpen ? 'Đóng' : 'Góp ý & Phản hồi'}
            >
                {isOpen ? (
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6 text-white">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                    </svg>
                ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6 text-white">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
                    </svg>
                )}

                {/* Notification dot */}
                {!isOpen && (
                    <span className="absolute -top-1 -right-1 w-4 h-4 bg-pink-500 rounded-full animate-pulse border-2 border-white"></span>
                )}
            </button>

            {/* Feedback Modal */}
            {isOpen && (
                <div className="fixed bottom-24 right-6 z-50 w-80 bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden animate-fade-in">
                    {/* Header */}
                    <div className="bg-gradient-to-r from-indigo-600 to-purple-600 p-4">
                        <h3 className="text-white font-bold text-lg flex items-center gap-2">
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
                            </svg>
                            Góp ý & Phản hồi
                        </h3>
                        <p className="text-indigo-100 text-xs mt-1">Ý kiến của bạn giúp chúng tôi cải thiện!</p>
                    </div>

                    {/* Content */}
                    <div className="p-4">
                        {isSent ? (
                            <div className="text-center py-8">
                                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-8 h-8 text-green-600">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                </div>
                                <h4 className="text-lg font-bold text-slate-800">Cảm ơn bạn!</h4>
                                <p className="text-slate-500 text-sm mt-1">Góp ý đã được gửi thành công.</p>
                            </div>
                        ) : (
                            <form ref={formRef} onSubmit={handleSubmit} className="space-y-3">
                                <div>
                                    <input
                                        type="text"
                                        placeholder="Họ và tên *"
                                        value={formData.name}
                                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 outline-none transition-all"
                                    />
                                </div>
                                <div>
                                    <input
                                        type="email"
                                        placeholder="Email *"
                                        value={formData.email}
                                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 outline-none transition-all"
                                    />
                                </div>
                                <div>
                                    <input
                                        type="text"
                                        placeholder="Tiêu đề (tùy chọn)"
                                        value={formData.title}
                                        onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 outline-none transition-all"
                                    />
                                </div>
                                <div>
                                    <textarea
                                        placeholder="Nội dung góp ý... *"
                                        rows={4}
                                        value={formData.message}
                                        onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 outline-none transition-all resize-none"
                                    />
                                </div>

                                {error && (
                                    <div className="text-red-500 text-xs bg-red-50 p-2 rounded-lg">
                                        {error}
                                    </div>
                                )}

                                <button
                                    type="submit"
                                    disabled={isSending}
                                    className="w-full py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-bold text-sm rounded-lg hover:from-indigo-700 hover:to-purple-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                >
                                    {isSending ? (
                                        <>
                                            <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                            </svg>
                                            Đang gửi...
                                        </>
                                    ) : (
                                        <>
                                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
                                            </svg>
                                            Gửi góp ý
                                        </>
                                    )}
                                </button>
                            </form>
                        )}
                    </div>
                </div>
            )}
        </>
    );
};

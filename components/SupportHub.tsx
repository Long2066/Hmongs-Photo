import React, { useState, useRef, useEffect, useCallback } from 'react';
import emailjs from '@emailjs/browser';
import * as storage from '../services/storageService';

// EmailJS Configuration
const EMAILJS_SERVICE_ID = 'service_7nxzcwc';
const EMAILJS_TEMPLATE_ID = 'template_x0ox4cd';
const EMAILJS_PUBLIC_KEY = 'DnCgag4BDRk19OGNV';

// System prompt with ImageTool knowledge
const SYSTEM_PROMPT = `Bạn là nhân viên hỗ trợ của ImageTool - phần mềm tạo ảnh AI chuyên nghiệp.

QUY TẮC TRẢ LỜI BẮT BUỘC:
- TUYỆT ĐỐI KHÔNG dùng ký tự đặc biệt như **, *, #, - (gạch đầu dòng), >, \`\`, []
- KHÔNG định dạng markdown, KHÔNG in đậm, KHÔNG in nghiêng
- Viết văn xuôi tự nhiên, thân thiện như đang nói chuyện trực tiếp
- Trả lời ngắn gọn, dễ hiểu, tối đa 2-3 câu mỗi ý
- Xưng hô "em" với khách, gọi khách là "anh/chị" hoặc "bạn"

KIẾN THỨC VỀ TOOLPHOTO2025:

Các chế độ chính:
Sáng tạo vô hạn giúp tạo ảnh từ prompt văn bản, có thể upload ảnh trang phục để AI tham khảo.
Ảnh thẻ chuyên nghiệp tạo ảnh thẻ passport, CMND từ ảnh chân dung, chọn kích thước và nền.
Chỉnh sửa AI giúp thay đồ, mix đồ, chỉnh sáng, xóa nền cho ảnh có sẵn.
Siêu phân giải tăng độ nét ảnh lên 2x hoặc 4x.
Profile Pro tạo ảnh đại diện chuyên nghiệp cho LinkedIn, mạng xã hội.

Cách sử dụng cơ bản: Chọn mode từ menu trên cùng, upload ảnh nếu cần, điền prompt và cấu hình, rồi nhấn Tạo Prompt, sau đó nhấn Tiến hành vẽ.

Về API Key: Cần Gemini API Key để sử dụng, lấy miễn phí tại aistudio.google.com/apikey, nhấn biểu tượng chìa khóa ở góc phải để nhập.

Tự động tải về: Bật toggle "Tự động tải về" ở sidebar trái, nhấn "Cấu hình thư mục" để chọn nơi lưu ảnh.

Vấn đề thường gặp: Nếu báo không có API Key thì vào cài đặt nhập key Gemini. Nếu lỗi tạo ảnh thì thử đổi prompt hoặc kiểm tra key. Nếu ảnh không đúng ý thì điều chỉnh prompt chi tiết hơn.

Nếu không biết câu trả lời, hãy hướng dẫn liên hệ hotline 0342.733.640 hoặc email support.`;

// Helper function to clean markdown from text
const cleanMarkdown = (text: string): string => {
    return text
        .replace(/\*\*(.*?)\*\*/g, '$1')  // Remove bold **text**
        .replace(/\*(.*?)\*/g, '$1')       // Remove italic *text*
        .replace(/#{1,6}\s/g, '')          // Remove headings
        .replace(/`{1,3}/g, '')            // Remove code blocks
        .replace(/^\s*[-*+]\s/gm, '')      // Remove list markers
        .replace(/^\s*\d+\.\s/gm, '')      // Remove numbered lists
        .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // Remove links, keep text
        .replace(/>/g, '')                  // Remove blockquotes
        .replace(/\n{3,}/g, '\n\n')        // Reduce multiple newlines
        .trim();
};

interface Message {
    role: 'user' | 'assistant';
    content: string;
    isTypingComplete?: boolean; // Track if typing animation is done
}

// TypingText component for natural typing animation
const TypingText: React.FC<{ text: string; onComplete: () => void }> = ({ text, onComplete }) => {
    const [displayedText, setDisplayedText] = useState('');
    const [isComplete, setIsComplete] = useState(false);

    useEffect(() => {
        setDisplayedText('');
        setIsComplete(false);
        let index = 0;

        const typeNextChar = () => {
            if (index < text.length) {
                setDisplayedText(text.slice(0, index + 1));
                index++;
                // Random delay between 20-50ms for natural typing feel
                const delay = 20 + Math.random() * 30;
                setTimeout(typeNextChar, delay);
            } else {
                setIsComplete(true);
                onComplete();
            }
        };

        // Start typing after a short delay
        const startTimeout = setTimeout(typeNextChar, 100);
        return () => clearTimeout(startTimeout);
    }, [text, onComplete]);

    return (
        <>
            {displayedText}
            {!isComplete && <span className="animate-pulse text-indigo-400">|</span>}
        </>
    );
};

interface SupportHubProps {
    userName?: string;
    userEmail?: string;
}

export const SupportHub: React.FC<SupportHubProps> = ({ userName = '', userEmail = '' }) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const [showBot, setShowBot] = useState(false);
    const [showFeedback, setShowFeedback] = useState(false);
    const [currentIcon, setCurrentIcon] = useState<'bot' | 'feedback'>('bot');

    // Bot state
    const [messages, setMessages] = useState<Message[]>([
        { role: 'assistant', content: 'Xin chào! 👋 Tôi là trợ lý AI của ImageTool. Bạn cần hỗ trợ gì?', isTypingComplete: true }
    ]);
    const [inputMessage, setInputMessage] = useState('');
    const [isTyping, setIsTyping] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    // Feedback state
    const [isSending, setIsSending] = useState(false);
    const [isSent, setIsSent] = useState(false);
    const [feedbackError, setFeedbackError] = useState<string | null>(null);
    const [formData, setFormData] = useState({
        name: userName,
        email: userEmail,
        title: '',
        message: ''
    });

    // Rotate icon when not expanded
    useEffect(() => {
        if (!isExpanded) {
            const interval = setInterval(() => {
                setCurrentIcon(prev => prev === 'bot' ? 'feedback' : 'bot');
            }, 3000);
            return () => clearInterval(interval);
        }
    }, [isExpanded]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    useEffect(() => {
        setFormData(prev => ({ ...prev, name: userName || prev.name, email: userEmail || prev.email }));
    }, [userName, userEmail]);

    const handleMainClick = () => {
        if (isExpanded) {
            // Collapse all
            setIsExpanded(false);
            setShowBot(false);
            setShowFeedback(false);
        } else {
            // Expand to show options
            setIsExpanded(true);
        }
    };

    const sendToGemini = async (userMessage: string) => {
        // ALWAYS use system key for support chatbot - no user configuration needed
        try {
            const { getSystemApiKey, GEMINI_VIP_MODEL } = await import('../services/geminiCoreService');
            const systemKey = getSystemApiKey();
            if (systemKey) {
                const response = await fetch(
                    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_VIP_MODEL}:generateContent?key=${systemKey}`,
                    {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            contents: [
                                { role: 'user', parts: [{ text: SYSTEM_PROMPT }] },
                                { role: 'model', parts: [{ text: 'Tôi hiểu. Tôi sẽ hỗ trợ người dùng về ImageTool.' }] },
                                ...messages.slice(-6).map(m => ({
                                    role: m.role === 'user' ? 'user' : 'model',
                                    parts: [{ text: m.content }]
                                })),
                                { role: 'user', parts: [{ text: userMessage }] }
                            ],
                            generationConfig: {
                                temperature: 0.7,
                                maxOutputTokens: 500
                            }
                        })
                    }
                );

                if (!response.ok) {
                    const errText = await response.text();
                    console.error('Support API Error:', errText);
                    throw new Error('System API Error');
                }
                const data = await response.json();
                const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text || 'Xin lỗi, em không thể trả lời lúc này.';
                return cleanMarkdown(rawText); // Clean markdown from response
            }
        } catch (error) {
            console.error('Support Chatbot Error:', error);
        }

        // Fallback message - no user key needed for support chatbot
        return 'Xin lỗi, hệ thống hỗ trợ đang bảo trì. Vui lòng liên hệ hotline 0342.733.640.';
    };

    const handleSendMessage = async () => {
        if (!inputMessage.trim() || isTyping) return;
        const userMsg = inputMessage.trim();
        setInputMessage('');
        setMessages(prev => [...prev, { role: 'user', content: userMsg, isTypingComplete: true }]);
        setIsTyping(true);
        const response = await sendToGemini(userMsg);
        // Add new assistant message with isTypingComplete: false to trigger typing animation
        setMessages(prev => [...prev, { role: 'assistant', content: response, isTypingComplete: false }]);
        setIsTyping(false);
    };

    // Mark a message as typing complete
    const handleTypingComplete = useCallback((messageIndex: number) => {
        setMessages(prev => prev.map((msg, idx) =>
            idx === messageIndex ? { ...msg, isTypingComplete: true } : msg
        ));
    }, []);

    const handleKeyPress = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSendMessage();
        }
    };

    const handleFeedbackSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.name.trim() || !formData.email.trim() || !formData.message.trim()) {
            setFeedbackError('Vui lòng điền đầy đủ thông tin!');
            return;
        }
        setIsSending(true);
        setFeedbackError(null);
        try {
            await emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, {
                name: formData.name,
                email: formData.email,
                title: formData.title || 'Góp ý ImageTool',
                message: formData.message
            }, EMAILJS_PUBLIC_KEY);
            setIsSent(true);
            setFormData({ name: userName, email: userEmail, title: '', message: '' });
            setTimeout(() => setIsSent(false), 3000);
        } catch (err) {
            console.error('EmailJS Error:', err);
            setFeedbackError('Gửi không thành công. Vui lòng thử lại!');
        } finally {
            setIsSending(false);
        }
    };

    return (
        <>
            {/* Main Bubble Button - Rotates when not expanded */}
            <button
                onClick={handleMainClick}
                className={`fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full shadow-2xl transition-all duration-300 flex items-center justify-center ${isExpanded
                    ? 'bg-slate-600 hover:bg-slate-700'
                    : 'bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 hover:scale-110'
                    }`}
                title={isExpanded ? 'Đóng' : (currentIcon === 'bot' ? 'Bot Hỗ trợ' : 'Góp ý')}
            >
                {isExpanded ? (
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6 text-white">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                ) : currentIcon === 'bot' ? (
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6 text-white animate-fade-in">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                    </svg>
                ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6 text-white animate-fade-in">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
                    </svg>
                )}
                {!isExpanded && <span className="absolute -top-1 -right-1 w-4 h-4 bg-pink-500 rounded-full animate-pulse border-2 border-white"></span>}
            </button>

            {/* Expanded Options - Buttons with Labels (only show when no panel is open) */}
            {isExpanded && !showBot && !showFeedback && (
                <div className="fixed bottom-24 right-6 z-50 flex flex-col gap-3 animate-fade-in">
                    {/* Bot Button with Label */}
                    <button
                        onClick={() => { setShowBot(!showBot); setShowFeedback(false); }}
                        className={`flex items-center gap-2 px-4 py-2.5 rounded-full shadow-xl transition-all hover:scale-105 ${showBot ? 'bg-indigo-600 ring-2 ring-indigo-300' : 'bg-white border border-slate-200 hover:border-indigo-300 hover:shadow-indigo-100'
                            }`}
                        title="Bot Hỗ trợ AI"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={`w-5 h-5 ${showBot ? 'text-white' : 'text-indigo-600'}`}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                        </svg>
                        <span className={`text-xs font-bold whitespace-nowrap ${showBot ? 'text-white' : 'text-indigo-600'}`}>Chat hỗ trợ</span>
                    </button>

                    {/* Feedback Button with Label */}
                    <button
                        onClick={() => { setShowFeedback(!showFeedback); setShowBot(false); }}
                        className={`flex items-center gap-2 px-4 py-2.5 rounded-full shadow-xl transition-all hover:scale-105 ${showFeedback ? 'bg-purple-600 ring-2 ring-purple-300' : 'bg-white border border-slate-200 hover:border-purple-300 hover:shadow-purple-100'
                            }`}
                        title="Góp ý & Phản hồi"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={`w-5 h-5 ${showFeedback ? 'text-white' : 'text-purple-600'}`}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
                        </svg>
                        <span className={`text-xs font-bold whitespace-nowrap ${showFeedback ? 'text-white' : 'text-purple-600'}`}>Góp ý</span>
                    </button>
                </div>
            )}

            {/* Bot Popup */}
            {showBot && (
                <div className="fixed bottom-24 right-24 z-40 w-80 bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden animate-fade-in flex flex-col" style={{ height: '450px' }}>
                    <div className="bg-gradient-to-r from-indigo-600 to-blue-600 p-3 flex-shrink-0">
                        <h3 className="text-white font-bold flex items-center gap-2">
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                            </svg>
                            Bot Hỗ trợ AI
                        </h3>
                        <p className="text-blue-100 text-xs">Hỏi bất cứ điều gì về ImageTool</p>
                    </div>
                    <div className="flex-1 overflow-y-auto p-3 space-y-2 custom-scrollbar">
                        {messages.map((msg, idx) => (
                            <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                <div className={`max-w-[85%] px-3 py-2 rounded-2xl text-sm ${msg.role === 'user' ? 'bg-indigo-600 text-white rounded-br-md' : 'bg-slate-100 text-slate-800 rounded-bl-md'
                                    }`}>
                                    {msg.role === 'assistant' && !msg.isTypingComplete ? (
                                        <TypingText text={msg.content} onComplete={() => handleTypingComplete(idx)} />
                                    ) : (
                                        msg.content
                                    )}
                                </div>
                            </div>
                        ))}
                        {isTyping && (
                            <div className="flex justify-start">
                                <div className="bg-slate-100 rounded-2xl rounded-bl-md px-4 py-2 flex gap-1">
                                    <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce"></span>
                                    <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                                    <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
                                </div>
                            </div>
                        )}
                        <div ref={messagesEndRef} />
                    </div>
                    <div className="p-3 border-t border-slate-200 flex-shrink-0 flex gap-2">
                        <input
                            type="text"
                            value={inputMessage}
                            onChange={(e) => setInputMessage(e.target.value)}
                            onKeyPress={handleKeyPress}
                            placeholder="Nhập câu hỏi..."
                            className="flex-1 px-3 py-2 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 outline-none"
                            disabled={isTyping}
                        />
                        <button
                            onClick={handleSendMessage}
                            disabled={isTyping || !inputMessage.trim()}
                            className="px-3 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
                            </svg>
                        </button>
                    </div>
                </div>
            )}

            {/* Feedback Popup */}
            {showFeedback && (
                <div className="fixed bottom-24 right-24 z-40 w-80 bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden animate-fade-in">
                    <div className="bg-gradient-to-r from-purple-600 to-pink-600 p-3">
                        <h3 className="text-white font-bold flex items-center gap-2">
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
                            </svg>
                            Góp ý & Phản hồi
                        </h3>
                        <p className="text-pink-100 text-xs">Ý kiến của bạn giúp chúng tôi cải thiện!</p>
                    </div>
                    <div className="p-4">
                        {isSent ? (
                            <div className="text-center py-8">
                                <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-7 h-7 text-green-600">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                </div>
                                <h4 className="text-lg font-bold text-slate-800">Cảm ơn bạn!</h4>
                                <p className="text-slate-500 text-sm">Góp ý đã được gửi thành công.</p>
                            </div>
                        ) : (
                            <form onSubmit={handleFeedbackSubmit} className="space-y-3">
                                <input type="text" placeholder="Họ và tên *" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-purple-500/30 focus:border-purple-500 outline-none" />
                                <input type="email" placeholder="Email *" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-purple-500/30 focus:border-purple-500 outline-none" />
                                <input type="text" placeholder="Tiêu đề (tùy chọn)" value={formData.title} onChange={(e) => setFormData({ ...formData, title: e.target.value })} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-purple-500/30 focus:border-purple-500 outline-none" />
                                <textarea placeholder="Nội dung góp ý... *" rows={4} value={formData.message} onChange={(e) => setFormData({ ...formData, message: e.target.value })} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-purple-500/30 focus:border-purple-500 outline-none resize-none" />
                                {feedbackError && <div className="text-red-500 text-xs bg-red-50 p-2 rounded-lg">{feedbackError}</div>}
                                <button type="submit" disabled={isSending} className="w-full py-2.5 bg-gradient-to-r from-purple-600 to-pink-600 text-white font-bold text-sm rounded-lg hover:from-purple-700 hover:to-pink-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2">
                                    {isSending ? (
                                        <><svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>Đang gửi...</>
                                    ) : (
                                        <><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" /></svg>Gửi góp ý</>
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

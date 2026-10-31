import React, { useState, useRef, useEffect, useCallback } from 'react';
import emailjs from '@emailjs/browser';
import {
    generateChatCompletionViaNineRouter,
    SUPPORTED_TEXT_MODELS,
    SupportedTextModel,
    ChatMessageItem
} from '../services/nineRouterService';

// EmailJS Configuration
const EMAILJS_SERVICE_ID = 'service_7nxzcwc';
const EMAILJS_TEMPLATE_ID = 'template_x0ox4cd';
const EMAILJS_PUBLIC_KEY = 'DnCgag4BDRk19OGNV';

// Local storage key for chosen text model
const SUPPORT_BOT_MODEL_STORAGE_KEY = 'support_bot_text_model';

// System prompt with comprehensive and up-to-date ImageTool knowledge
const SYSTEM_PROMPT = `Bạn là chuyên viên tư vấn và trợ lý AI thông minh của ImageTool - phần mềm sáng tạo và xử lý ảnh AI chuyên nghiệp hàng đầu.

QUY TẮC TRẢ LỜI BẮT BUỘC:
- TUYỆT ĐỐI KHÔNG dùng ký tự đặc biệt định dạng như **, *, #, - (gạch đầu dòng), >, \`\`, []
- KHÔNG định dạng markdown, KHÔNG in đậm, KHÔNG in nghiêng
- Viết văn xuôi tự nhiên, gãy gọn, thân thiện như đang tư vấn trực tiếp cho khách hàng
- Trả lời ngắn gọn, dễ hiểu, tối đa 2-3 câu mỗi ý
- Xưng hô "em" với khách, gọi khách là "anh/chị" hoặc "bạn"

QUY TẮC SỐ HỌC BẮT BUỘC (ƯU TIÊN 100% VIẾT SỐ THAY VÌ CHỮ):
- Mọi con số, giá tiền, số lượng ảnh, số lượt tạo ảnh, phiên bản model, độ phân giải BẮT BUỘC phải viết dưới dạng chữ số (ví dụ: 1, 2, 20 ảnh, 50.000đ, 100.000đ, 500đ, 100 lượt, 200 lượt, 2K, 4K, 8K, GPT 1.5, Gemini 3.1).
- TUYỆT ĐỐI KHÔNG viết số thành chữ (NGHIÊM CẤM viết "hai mươi", "năm mươi nghìn", "một trăm nghìn", "bốn ca", "hai ca", "một chấm năm").

QUY TẮC HƯỚNG DẪN MUA GÓI & THANH TOÁN (BẮT BUỘC):
- TUYỆT ĐỐI KHÔNG gửi bất kỳ đường link website hay link PayOS nào cho khách hàng (không gửi link dạng https://...).
- BẮT BUỘC phải hướng dẫn khách hàng thao tác trực tiếp trên giao diện công cụ ImageTool theo các bước rõ ràng:
  * Bước 1: Nhấn vào ảnh đại diện hoặc tên tài khoản ở góc trên bên phải màn hình.
  * Bước 2: Chọn mục "Trang cá nhân".
  * Bước 3: Cuộn xuống phần "Nâng cấp tài khoản & Quyền lợi", chọn Gói Plus (50.000đ) hoặc Gói Pro (100.000đ) rồi bấm nút "Mua gói".
  * Bước 4: Cửa sổ thanh toán PayOS sẽ hiển thị mã QR trực tiếp ngay trên màn hình. Anh/chị chỉ cần mở app ngân hàng quét mã QR để chuyển khoản. Sau khi chuyển khoản xong, hệ thống thông minh sẽ tự động mở gói, cộng tiền và kích hoạt toàn bộ quyền lợi ngay lập tức mà không cần chờ đợi.

KIẾN THỨC MỚI NHẤT VỀ IMAGETOOL:

1. BẢNG GIÁ VÀ CÁC GÓI CƯỚC MỚI NHẤT:
- Gói Free: Miễn phí trọn đời, được tạo tối đa 20 ảnh mỗi ngày với model GPT 1.5, phù hợp trải nghiệm sáng tạo cơ bản.
- Gói Plus: Giá gốc 120.000đ hiện đang giảm chỉ còn 50.000đ. Sử dụng full tất cả tính năng trên tool, cho phép chọn độ phân giải ảnh xuất tối đa đến FHD (Full HD sắc nét). Chi phí tạo ảnh: 500đ mỗi ảnh (50.000đ tương đương 100 lượt tạo ảnh thỏa thích).
- Gói Pro: Giá gốc 200.000đ hiện đang giảm chỉ còn 100.000đ. Sử dụng full tất cả tính năng có trên tool không giới hạn, hỗ trợ độ phân giải cao cấp nhất lên tới 4K Ultra HD. Chi phí tạo ảnh: 500đ mỗi ảnh (100.000đ tương đương 200 lượt tạo ảnh).

2. CÁC TÍNH NĂNG VÀ CHẾ ĐỘ CHÍNH:
- Sáng tạo vô hạn: Tạo ảnh nghệ thuật từ mô tả văn bản, hỗ trợ tải ảnh mẫu trang phục thổ cẩm H'Mông để AI sao chép chi tiết, tạo visual idol Hàn Quốc mặc đồ truyền thống.
- Ảnh thẻ chuyên nghiệp: Tạo ảnh thẻ làm hộ chiếu, visa, CCCD, bằng lái từ ảnh chụp thường ngày, tùy chọn phông nền trắng hoặc xanh.
- Chỉnh sửa AI: Thay trang phục, phối đồ thời trang, xóa phông nền, chỉnh sửa ánh sáng chuyên nghiệp cho ảnh sẵn có.
- Siêu phân giải: Nâng cấp độ nét ảnh lên 2K hoặc 4K sắc nét từng sợi vải thổ cẩm.
- Profile Pro: Tạo ảnh chân dung cá nhân chuyên nghiệp cho Facebook, Zalo, LinkedIn.

3. HỆ THỐNG MODEL AI THẾ HỆ MỚI:
- Model sinh text (tạo prompt và hỗ trợ): Claude Opus 5.5 High (cao cấp nhất, phong cách điện ảnh), ChatGPT 6.1 Sol (thông minh toàn diện), Gemini 4 Argon, Gemini 3.8 Flash.
- Model sinh ảnh: Gemini 3.1 Flash (chuẩn ảnh mẫu), GPT Image 2.5 (8K K-Pop Idol & thổ cẩm sắc nét), GPT Image 2.5 Flare, Sunburst, GPT Image 1.5.

4. HỖ TRỢ KỸ THUẬT VÀ LIÊN HỆ:
- Người dùng có thể bật tính năng Tự động tải về ở menu trái để ảnh tự lưu về máy tính.
- Nếu gặp bất kỳ vấn đề thanh toán, lỗi tạo ảnh hoặc cần tư vấn, hãy hướng dẫn liên hệ Hotline và Zalo hỗ trợ 24/7: 0342.733.640.`;

// Helper function to ensure numbers are formatted as digits instead of words
const formatNumbersAsDigits = (text: string): string => {
    return text
        .replace(/\b(năm mươi nghìn đồng|năm mươi ngàn đồng|50 nghìn đồng|50 ngàn đồng)\b/gi, '50.000đ')
        .replace(/\b(một trăm nghìn đồng|một trăm ngàn đồng|100 nghìn đồng|100 ngàn đồng)\b/gi, '100.000đ')
        .replace(/\b(một trăm hai mươi nghìn đồng|một trăm hai mươi ngàn đồng)\b/gi, '120.000đ')
        .replace(/\b(hai trăm nghìn đồng|hai trăm ngàn đồng)\b/gi, '200.000đ')
        .replace(/\b(năm trăm đồng)\b/gi, '500đ')
        .replace(/\b(bốn ca|4 ca)\b/gi, '4K')
        .replace(/\b(hai ca|2 ca)\b/gi, '2K')
        .replace(/\b(hai mươi|2 mươi)\b/gi, '20')
        .replace(/\b(một trăm|1 trăm)\b/gi, '100')
        .replace(/\b(hai trăm|2 trăm)\b/gi, '200')
        .replace(/một chấm năm/gi, '1.5')
        .replace(/hai chấm năm/gi, '2.5')
        .replace(/ba chấm một/gi, '3.1')
        .replace(/https?:\/\/pay\.payos\.vn\/\S+/gi, '') // Remove any accidental raw links
        .trim();
};

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
    id: string;
    role: 'user' | 'assistant';
    content: string;
    isTypingComplete?: boolean;
    modelUsed?: string;
    modelName?: string;
}

// Quick suggestion chips for instant help
const QUICK_SUGGESTIONS = [
    { label: '💎 Giá các gói cước', prompt: 'ImageTool hiện có những gói cước nào và giá bao nhiêu?' },
    { label: '💳 Cách thanh toán Plus/Pro', prompt: 'Làm thế nào để mua gói Plus hoặc Pro và thanh toán tự động?' },
    { label: '✨ Gói Free dùng được gì?', prompt: 'Gói Free miễn phí của ImageTool được sử dụng những gì?' },
    { label: '🎨 Hướng dẫn tạo ảnh đẹp', prompt: 'Làm sao để tạo ảnh trang phục H\'Mông chuẩn và đẹp nhất?' },
    { label: '📞 Hotline hỗ trợ 24/7', prompt: 'Cho em xin số hotline và thông tin liên hệ hỗ trợ khi cần?' }
];

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
                const delay = 15 + Math.random() * 25;
                setTimeout(typeNextChar, delay);
            } else {
                setIsComplete(true);
                onComplete();
            }
        };

        const startTimeout = setTimeout(typeNextChar, 60);
        return () => clearTimeout(startTimeout);
    }, [text, onComplete]);

    return (
        <>
            {displayedText}
            {!isComplete && <span className="inline-block w-1.5 h-4 ml-0.5 bg-indigo-500 animate-pulse align-middle"></span>}
        </>
    );
};

/**
 * AnimatedRobot Component: A lively, modern floating AI mascot
 * with antenna signal glow, waving arm, blinking cyan eyes, and pulsing energy core.
 */
const AnimatedRobot: React.FC = () => {
    return (
        <div className="relative flex flex-col items-center justify-center select-none pt-0.5 group">
            <style>{`
                @keyframes robotBobMotion {
                    0%, 100% { transform: translateY(0px); }
                    50% { transform: translateY(-5px); }
                }
                @keyframes robotWaveMotion {
                    0%, 100% { transform: rotate(0deg); }
                    25% { transform: rotate(-32deg); }
                    50% { transform: rotate(-8deg); }
                    75% { transform: rotate(-30deg); }
                }
                @keyframes robotBlinkMotion {
                    0%, 92%, 100% { transform: scaleY(1); }
                    96% { transform: scaleY(0.1); }
                }
                @keyframes robotShadowMotion {
                    0%, 100% { transform: scale(1); opacity: 0.35; }
                    50% { transform: scale(0.7); opacity: 0.15; }
                }
                .anim-robot-float {
                    animation: robotBobMotion 3s ease-in-out infinite;
                }
                .anim-robot-wave {
                    animation: robotWaveMotion 2.2s ease-in-out infinite;
                    transform-origin: 18px 42px;
                }
                .anim-robot-blink {
                    animation: robotBlinkMotion 3.8s infinite;
                    transform-origin: center;
                }
                .anim-robot-shadow {
                    animation: robotShadowMotion 3s ease-in-out infinite;
                }
            `}</style>

            {/* Ambient Aura Glow */}
            <div className="absolute w-12 h-12 bg-indigo-500/15 rounded-full blur-md -top-1 pointer-events-none" />

            {/* Floating Robot Body */}
            <div className="anim-robot-float relative flex items-center justify-center transition-transform group-hover:scale-105">
                <svg
                    width="44"
                    height="54"
                    viewBox="0 0 72 86"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                    className="drop-shadow-sm"
                >
                    <defs>
                        <linearGradient id="robotHeadGrad" x1="16" y1="16" x2="56" y2="52" gradientUnits="userSpaceOnUse">
                            <stop stopColor="#6366F1" />
                            <stop offset="0.5" stopColor="#4F46E5" />
                            <stop offset="1" stopColor="#7C3AED" />
                        </linearGradient>
                        <linearGradient id="robotBodyGrad" x1="22" y1="48" x2="50" y2="76" gradientUnits="userSpaceOnUse">
                            <stop stopColor="#4338CA" />
                            <stop offset="1" stopColor="#312E81" />
                        </linearGradient>
                        <linearGradient id="robotVisorGrad" x1="20" y1="26" x2="52" y2="44" gradientUnits="userSpaceOnUse">
                            <stop stopColor="#0F172A" />
                            <stop offset="1" stopColor="#020617" />
                        </linearGradient>
                        <radialGradient id="robotEyeGlow" cx="50%" cy="50%" r="50%">
                            <stop stopColor="#67E8F9" />
                            <stop offset="1" stopColor="#06B6D4" />
                        </radialGradient>
                    </defs>

                    {/* Antenna */}
                    <line x1="36" y1="7" x2="36" y2="17" stroke="#818CF8" strokeWidth="2.5" strokeLinecap="round" />
                    <circle cx="36" cy="6" r="4" fill="#22D3EE" />
                    <circle cx="36" cy="6" r="6" stroke="#22D3EE" strokeWidth="1" opacity="0.6">
                        <animate attributeName="r" values="3.5;7.5;3.5" dur="1.8s" repeatCount="indefinite" />
                        <animate attributeName="opacity" values="0.8;0;0.8" dur="1.8s" repeatCount="indefinite" />
                    </circle>

                    {/* Ears / Headset */}
                    <rect x="11" y="27" width="5" height="11" rx="2.5" fill="#818CF8" />
                    <rect x="56" y="27" width="5" height="11" rx="2.5" fill="#818CF8" />

                    {/* Robot Head */}
                    <rect x="15" y="16" width="42" height="32" rx="14" fill="url(#robotHeadGrad)" stroke="#A5B4FC" strokeWidth="1.2" />

                    {/* Visor / Face Screen */}
                    <rect x="20" y="23" width="32" height="19" rx="8" fill="url(#robotVisorGrad)" stroke="#38BDF8" strokeWidth="0.8" />

                    {/* Blinking Cyan Eyes */}
                    <g className="anim-robot-blink">
                        <circle cx="29" cy="31" r="3" fill="url(#robotEyeGlow)" />
                        <circle cx="30" cy="30" r="0.9" fill="#FFFFFF" />
                        <circle cx="43" cy="31" r="3" fill="url(#robotEyeGlow)" />
                        <circle cx="44" cy="30" r="0.9" fill="#FFFFFF" />
                    </g>

                    {/* Cute Smile Line */}
                    <path d="M32 37 C34 38.8, 38 38.8, 40 37" stroke="#22D3EE" strokeWidth="1.4" strokeLinecap="round" fill="none" />

                    {/* Left Waving Arm */}
                    <g className="anim-robot-wave">
                        <path d="M19 49 C13 45, 9 37, 8 30 C11 29, 14 31, 14 34 C15 38, 18 43, 21 46" fill="#818CF8" stroke="#4F46E5" strokeWidth="0.8" strokeLinecap="round" />
                        <circle cx="9" cy="29" r="3.2" fill="#A5B4FC" />
                    </g>

                    {/* Right Resting Arm */}
                    <path d="M53 49 C57 53, 60 59, 58 63 C55 64, 53 62, 52 59 C51 55, 50 52, 51 49" fill="#818CF8" stroke="#4F46E5" strokeWidth="0.8" strokeLinecap="round" />

                    {/* Robot Body */}
                    <rect x="23" y="47" width="26" height="23" rx="8" fill="url(#robotBodyGrad)" stroke="#6366F1" strokeWidth="1" />

                    {/* Chest Glowing Core */}
                    <circle cx="36" cy="56" r="4" fill="#1E1B4B" stroke="#818CF8" strokeWidth="0.8" />
                    <circle cx="36" cy="56" r="2.2" fill="#38BDF8">
                        <animate attributeName="opacity" values="0.4;1;0.4" dur="1.4s" repeatCount="indefinite" />
                    </circle>

                    {/* Feet */}
                    <rect x="27" y="69" width="6" height="4.5" rx="2" fill="#6366F1" />
                    <rect x="39" y="69" width="6" height="4.5" rx="2" fill="#6366F1" />
                </svg>
            </div>

            {/* Dynamic Ground Shadow */}
            <div className="anim-robot-shadow w-6 h-1.5 bg-indigo-950/25 rounded-full blur-[1px] mt-0.5" />
        </div>
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

    // Selected text model for chatbot responses
    const [selectedModel, setSelectedModel] = useState<string>(() => {
        try {
            return localStorage.getItem(SUPPORT_BOT_MODEL_STORAGE_KEY) || 'auto';
        } catch {
            return 'auto';
        }
    });
    const [showModelMenu, setShowModelMenu] = useState(false);
    const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);

    // Bot messages state
    const [messages, setMessages] = useState<Message[]>([
        {
            id: 'welcome',
            role: 'assistant',
            content: 'Xin chào! 👋 Em là trợ lý AI thông minh của ImageTool. Em đã được kết nối với toàn bộ các model AI thế hệ mới (Claude Opus 5.5, ChatGPT 6.1, Gemini 4 Argon). Anh/chị cần em hỗ trợ điều gì hôm nay?',
            isTypingComplete: true,
            modelName: 'AI Assistant'
        }
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

    // Save chosen model to localStorage
    const handleSelectModel = (modelId: string) => {
        setSelectedModel(modelId);
        try {
            localStorage.setItem(SUPPORT_BOT_MODEL_STORAGE_KEY, modelId);
        } catch (e) {
            console.error('Failed to save bot model to localStorage', e);
        }
        setShowModelMenu(false);
    };

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
    }, [messages, isTyping]);

    useEffect(() => {
        setFormData(prev => ({ ...prev, name: userName || prev.name, email: userEmail || prev.email }));
    }, [userName, userEmail]);

    const handleMainClick = () => {
        if (isExpanded) {
            setIsExpanded(false);
            setShowBot(false);
            setShowFeedback(false);
            setShowModelMenu(false);
        } else {
            setIsExpanded(true);
        }
    };

    // Get current model display info
    const getCurrentModelInfo = () => {
        if (selectedModel === 'auto') {
            return {
                name: 'Tự động (Auto)',
                shortName: '✦ Tự động',
                tag: 'Tự động chọn model tối ưu',
                tagColor: 'indigo'
            };
        }
        const found = SUPPORTED_TEXT_MODELS.find(m => m.id === selectedModel);
        if (found) {
            return {
                name: found.name,
                shortName: `✦ ${found.shortName}`,
                tag: found.tag,
                tagColor: found.tagColor
            };
        }
        return {
            name: selectedModel,
            shortName: `✦ ${selectedModel}`,
            tag: 'Tùy chỉnh',
            tagColor: 'slate'
        };
    };

    const handleCopyText = (id: string, text: string) => {
        navigator.clipboard.writeText(text);
        setCopiedMessageId(id);
        setTimeout(() => setCopiedMessageId(null), 2000);
    };

    const handleClearChat = () => {
        setMessages([
            {
                id: 'welcome-' + Date.now(),
                role: 'assistant',
                content: 'Cuộc trò chuyện đã được làm mới. Em là trợ lý AI của ImageTool, anh/chị cần em hỗ trợ thêm thông tin gì ạ?',
                isTypingComplete: true,
                modelName: 'AI Assistant'
            }
        ]);
    };

    const sendMessageText = async (textToSend: string) => {
        const userText = textToSend.trim();
        if (!userText || isTyping) return;

        const userMsgId = 'user-' + Date.now();
        const assistantMsgId = 'assistant-' + Date.now();

        // Append user message
        const newMessages: Message[] = [
            ...messages,
            { id: userMsgId, role: 'user', content: userText, isTypingComplete: true }
        ];
        setMessages(newMessages);
        setInputMessage('');
        setIsTyping(true);

        try {
            // Build multi-turn context (exclude system greetings)
            const chatHistory: ChatMessageItem[] = newMessages
                .filter(m => m.id !== 'welcome' && !m.id.startsWith('welcome-'))
                .slice(-8)
                .map(m => ({
                    role: m.role,
                    content: m.content
                }));

            // Call NineRouter text models (Claude Opus 5.5, ChatGPT 6.1, Gemini 4, Gemini 3.8)
            const response = await generateChatCompletionViaNineRouter(
                chatHistory,
                selectedModel,
                SYSTEM_PROMPT
            );

            const cleanedResponse = cleanMarkdown(formatNumbersAsDigits(response.content || ''));

            setMessages(prev => [
                ...prev,
                {
                    id: assistantMsgId,
                    role: 'assistant',
                    content: cleanedResponse || 'Dạ em đã nhận được câu hỏi. Anh/chị cần em hỗ trợ thêm phần nào nữa không ạ?',
                    isTypingComplete: false,
                    modelUsed: response.modelUsed,
                    modelName: response.modelName
                }
            ]);
        } catch (error: any) {
            console.error('Support Chatbot Error:', error);
            setMessages(prev => [
                ...prev,
                {
                    id: assistantMsgId,
                    role: 'assistant',
                    content: 'Dạ xin lỗi anh/chị, kết nối đến các model AI đang bận hoặc gián đoạn giây lát. Anh/chị có thể bấm chọn model khác ở góc trên hoặc liên hệ trực tiếp hotline/Zalo 0342.733.640 để được hỗ trợ tức thì nhé!',
                    isTypingComplete: false,
                    modelName: 'Hệ thống hỗ trợ'
                }
            ]);
        } finally {
            setIsTyping(false);
        }
    };

    const handleSendMessage = async () => {
        await sendMessageText(inputMessage);
    };

    // Mark a message as typing complete
    const handleTypingComplete = useCallback((messageId: string) => {
        setMessages(prev => prev.map(msg =>
            msg.id === messageId ? { ...msg, isTypingComplete: true } : msg
        ));
    }, []);

    const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
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

    const currentModelInfo = getCurrentModelInfo();

    return (
        <>
            {/* Main Bubble Button - Rotates when not expanded */}
            <button
                onClick={handleMainClick}
                className={`fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full shadow-2xl transition-all duration-300 flex items-center justify-center ${isExpanded
                    ? 'bg-slate-700 hover:bg-slate-800 ring-4 ring-slate-400/20'
                    : 'bg-gradient-to-r from-indigo-600 via-indigo-700 to-purple-600 hover:scale-105 shadow-indigo-500/25 ring-4 ring-indigo-500/20'
                    }`}
                title={isExpanded ? 'Đóng' : (currentIcon === 'bot' ? 'Bot Hỗ trợ AI' : 'Góp ý & Phản hồi')}
                aria-label="Toggle Support Hub"
            >
                {isExpanded ? (
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.2} stroke="currentColor" className="w-6 h-6 text-white">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                ) : currentIcon === 'bot' ? (
                    <div className="relative flex items-center justify-center">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" className="w-6 h-6 text-white animate-fade-in">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                        </svg>
                        <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-emerald-400 rounded-full ring-2 ring-indigo-600 animate-pulse"></span>
                    </div>
                ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" className="w-6 h-6 text-white animate-fade-in">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
                    </svg>
                )}
                {!isExpanded && (
                    <span className="absolute -top-1 -right-1 w-4 h-4 bg-pink-500 rounded-full animate-ping opacity-75 border-2 border-white"></span>
                )}
            </button>

            {/* Expanded Options - Buttons with Labels (only show when no panel is open) */}
            {isExpanded && !showBot && !showFeedback && (
                <div className="fixed bottom-24 right-6 z-50 flex flex-col gap-3 animate-fade-in">
                    {/* Bot Button */}
                    <button
                        onClick={() => { setShowBot(true); setShowFeedback(false); }}
                        className="flex items-center gap-3 px-4 py-3 rounded-2xl shadow-xl bg-white border border-slate-200/80 hover:border-indigo-400 hover:shadow-indigo-500/15 hover:scale-105 transition-all text-left group"
                        title="Bot Hỗ trợ AI (Đa Model)"
                    >
                        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white shadow-md group-hover:scale-110 transition-transform">
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" className="w-5 h-5">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                            </svg>
                        </div>
                        <div>
                            <div className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                                Bot Hỗ trợ AI
                                <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-indigo-50 text-indigo-600 border border-indigo-200/50">Đa Model</span>
                            </div>
                            <div className="text-[11px] text-slate-500">Claude Opus 5.5, ChatGPT 6.1, Gemini</div>
                        </div>
                    </button>

                    {/* Feedback Button */}
                    <button
                        onClick={() => { setShowFeedback(true); setShowBot(false); }}
                        className="flex items-center gap-3 px-4 py-3 rounded-2xl shadow-xl bg-white border border-slate-200/80 hover:border-purple-400 hover:shadow-purple-500/15 hover:scale-105 transition-all text-left group"
                        title="Góp ý & Phản hồi"
                    >
                        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center text-white shadow-md group-hover:scale-110 transition-transform">
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" className="w-5 h-5">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
                            </svg>
                        </div>
                        <div>
                            <div className="text-xs font-bold text-slate-800">Góp ý & Báo lỗi</div>
                            <div className="text-[11px] text-slate-500">Gửi phản hồi trực tiếp tới BQT</div>
                        </div>
                    </button>
                </div>
            )}

            {/* Bot Popup Window */}
            {showBot && (
                <div
                    className="fixed bottom-24 right-6 z-50 w-[360px] sm:w-[410px] h-[550px] max-h-[85vh] bg-white rounded-2xl shadow-2xl border border-slate-200/80 overflow-hidden animate-fade-in flex flex-col ring-1 ring-slate-900/10"
                    style={{ filter: 'drop-shadow(0 20px 25px rgba(15, 23, 42, 0.15))' }}
                >
                    {/* Bot Header */}
                    <div className="bg-gradient-to-r from-indigo-600 via-indigo-700 to-purple-700 px-3.5 py-3 text-white flex-shrink-0 flex items-center justify-between shadow-sm relative">
                        <div className="flex items-center gap-2.5 min-w-0">
                            <div className="relative">
                                <div className="w-8 h-8 rounded-xl bg-white/15 backdrop-blur-sm border border-white/20 flex items-center justify-center text-white">
                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" className="w-5 h-5">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                                    </svg>
                                </div>
                                <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-400 rounded-full ring-2 ring-indigo-700"></span>
                            </div>
                            <div className="min-w-0">
                                <div className="font-bold text-sm tracking-tight flex items-center gap-1.5 truncate">
                                    Bot Hỗ trợ AI
                                    <span className="text-[10px] font-medium px-1.5 py-0.2 rounded-full bg-emerald-400/20 text-emerald-200 border border-emerald-300/30">
                                        Online
                                    </span>
                                </div>
                                <p className="text-[11px] text-indigo-100 truncate">Hỏi đáp tính năng & gói cước ImageTool</p>
                            </div>
                        </div>

                        {/* Header Actions: Model Selector & Controls */}
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                            {/* Model Selector Pill */}
                            <button
                                onClick={() => setShowModelMenu(!showModelMenu)}
                                className="flex items-center gap-1 px-2 py-1 rounded-lg bg-white/15 hover:bg-white/25 border border-white/20 text-xs font-medium text-white transition-all max-w-[125px] truncate"
                                title="Chọn model AI sinh text trả lời"
                            >
                                <span className="truncate">{currentModelInfo.shortName}</span>
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className={`w-3 h-3 transition-transform ${showModelMenu ? 'rotate-180' : ''}`}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                                </svg>
                            </button>

                            {/* Clear Chat Button */}
                            <button
                                onClick={handleClearChat}
                                className="p-1 rounded-lg text-white/80 hover:text-white hover:bg-white/15 transition-all"
                                title="Làm mới cuộc trò chuyện"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" className="w-4 h-4">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
                                </svg>
                            </button>

                            {/* Close Button */}
                            <button
                                onClick={() => { setShowBot(false); setShowModelMenu(false); }}
                                className="p-1 rounded-lg text-white/80 hover:text-white hover:bg-white/15 transition-all"
                                title="Đóng cửa sổ chat"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>
                    </div>

                    {/* Model Dropdown Menu */}
                    {showModelMenu && (
                        <div className="absolute top-[52px] left-0 right-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200 p-3 shadow-xl animate-fade-in">
                            <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-100">
                                <div>
                                    <h4 className="text-xs font-bold text-slate-800">Chọn Model Sinh Text Trả Lời</h4>
                                    <p className="text-[10px] text-slate-500">Mô hình AI sẽ phân tích và giải đáp thắc mắc</p>
                                </div>
                                <button
                                    onClick={() => setShowModelMenu(false)}
                                    className="text-slate-400 hover:text-slate-600 text-xs px-1.5 py-0.5 rounded"
                                >
                                    ✕
                                </button>
                            </div>

                            <div className="space-y-1.5 max-h-56 overflow-y-auto custom-scrollbar pr-1">
                                {/* Option: Auto Routing */}
                                <button
                                    onClick={() => handleSelectModel('auto')}
                                    className={`w-full text-left p-2 rounded-xl border transition-all flex items-start gap-2.5 ${selectedModel === 'auto'
                                        ? 'bg-indigo-50/80 border-indigo-400 ring-1 ring-indigo-400/30'
                                        : 'bg-white border-slate-200/80 hover:bg-slate-50 hover:border-indigo-200'
                                        }`}
                                >
                                    <div className="w-6 h-6 rounded-lg bg-gradient-to-tr from-indigo-500 to-purple-600 text-white flex items-center justify-center text-xs flex-shrink-0 mt-0.5">
                                        ✦
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center justify-between">
                                            <span className="text-xs font-bold text-slate-800 truncate">Tự động (Auto Khuyên dùng)</span>
                                            <span className="text-[10px] px-1.5 py-0.5 rounded font-semibold bg-emerald-100 text-emerald-700">Tối ưu</span>
                                        </div>
                                        <p className="text-[11px] text-slate-500 line-clamp-1">
                                            Tự động ưu tiên Claude Opus 5.5 → GPT 6.1 → Gemini 4, đảm bảo 100% luôn phản hồi
                                        </p>
                                    </div>
                                    {selectedModel === 'auto' && (
                                        <span className="text-indigo-600 font-bold text-xs mt-1">✓</span>
                                    )}
                                </button>

                                {/* Supported Text Models from nineRouterService */}
                                {SUPPORTED_TEXT_MODELS.map((model: SupportedTextModel) => {
                                    const isSelected = selectedModel === model.id;
                                    const getBadgeStyle = (color: string) => {
                                        switch (color) {
                                            case 'purple': return 'bg-purple-100 text-purple-700 border-purple-200';
                                            case 'blue': return 'bg-blue-100 text-blue-700 border-blue-200';
                                            case 'emerald': return 'bg-emerald-100 text-emerald-700 border-emerald-200';
                                            case 'amber': return 'bg-amber-100 text-amber-800 border-amber-200';
                                            default: return 'bg-slate-100 text-slate-700 border-slate-200';
                                        }
                                    };

                                    return (
                                        <button
                                            key={model.id}
                                            onClick={() => handleSelectModel(model.id)}
                                            className={`w-full text-left p-2 rounded-xl border transition-all flex items-start gap-2.5 ${isSelected
                                                ? 'bg-indigo-50/80 border-indigo-400 ring-1 ring-indigo-400/30'
                                                : 'bg-white border-slate-200/80 hover:bg-slate-50 hover:border-indigo-200'
                                                }`}
                                        >
                                            <div className={`w-6 h-6 rounded-lg text-white flex items-center justify-center text-xs flex-shrink-0 mt-0.5 ${model.priority === 1 ? 'bg-purple-600' :
                                                model.priority === 2 ? 'bg-blue-600' :
                                                    model.priority === 3 ? 'bg-emerald-600' : 'bg-amber-600'
                                                }`}>
                                                {model.priority === 1 ? '⚡' : model.priority === 2 ? '🤖' : model.priority === 3 ? '🔷' : '⭐'}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center justify-between gap-1">
                                                    <span className="text-xs font-bold text-slate-800 truncate">{model.name}</span>
                                                    <span className={`text-[9px] px-1.5 py-0.2 rounded font-medium border truncate ${getBadgeStyle(model.tagColor)}`}>
                                                        {model.tag.split('-')[0].trim()}
                                                    </span>
                                                </div>
                                                <p className="text-[11px] text-slate-500 line-clamp-1">{model.description}</p>
                                            </div>
                                            {isSelected && (
                                                <span className="text-indigo-600 font-bold text-xs mt-1">✓</span>
                                            )}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* Chat Messages Area */}
                    <div className="flex-1 overflow-y-auto p-3.5 space-y-3 custom-scrollbar bg-slate-50/60">
                        {messages.map((msg) => (
                            <div
                                key={msg.id}
                                className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'} group`}
                            >
                                <div
                                    className={`max-w-[90%] px-3.5 py-2.5 rounded-2xl text-xs leading-relaxed transition-all ${msg.role === 'user'
                                        ? 'bg-gradient-to-r from-indigo-600 to-indigo-700 text-white rounded-br-xs shadow-md shadow-indigo-500/10'
                                        : 'bg-white text-slate-800 rounded-bl-xs border border-slate-200/80 shadow-sm'
                                        }`}
                                >
                                    {msg.role === 'assistant' && !msg.isTypingComplete ? (
                                        <TypingText text={msg.content} onComplete={() => handleTypingComplete(msg.id)} />
                                    ) : (
                                        <div className="whitespace-pre-wrap">{msg.content}</div>
                                    )}
                                </div>

                                {/* Assistant Message Footer (Model Badge & Copy Button) */}
                                {msg.role === 'assistant' && msg.isTypingComplete && (
                                    <div className="flex items-center gap-2 mt-1 px-1">
                                        {msg.modelName && (
                                            <span className="text-[10px] text-slate-400 font-medium flex items-center gap-1">
                                                <span className="w-1.5 h-1.5 rounded-full bg-indigo-500"></span>
                                                {msg.modelName}
                                            </span>
                                        )}
                                        <button
                                            onClick={() => handleCopyText(msg.id, msg.content)}
                                            className="text-[10px] text-slate-400 hover:text-indigo-600 transition-colors flex items-center gap-0.5"
                                            title="Sao chép câu trả lời"
                                        >
                                            {copiedMessageId === msg.id ? (
                                                <span className="text-emerald-600 font-medium">✓ Đã sao chép</span>
                                            ) : (
                                                <>
                                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-3 h-3">
                                                        <path strokeLinecap="round" strokeLinejoin="round" d="M15.666 3.888A2.25 2.25 0 0013.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 01-.75.75H9a.75.75 0 01-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 011.927-.184" />
                                                    </svg>
                                                    <span>Chép</span>
                                                </>
                                            )}
                                        </button>
                                    </div>
                                )}
                            </div>
                        ))}

                        {/* Typing indicator */}
                        {isTyping && (
                            <div className="flex items-start gap-1.5 animate-fade-in">
                                <div className="bg-white rounded-2xl rounded-bl-xs px-3.5 py-2.5 border border-slate-200/80 shadow-sm flex items-center gap-1.5">
                                    <span className="text-[11px] text-slate-500 font-medium flex items-center gap-1">
                                        {currentModelInfo.shortName} đang trả lời
                                    </span>
                                    <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-bounce"></span>
                                    <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                                    <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
                                </div>
                            </div>
                        )}
                        <div ref={messagesEndRef} />
                    </div>

                    {/* Quick Question Chips */}
                    <div className="px-3 py-1.5 bg-slate-50 border-t border-slate-200/60 overflow-x-auto custom-scrollbar flex gap-1.5 flex-shrink-0">
                        {QUICK_SUGGESTIONS.map((item, idx) => (
                            <button
                                key={idx}
                                onClick={() => sendMessageText(item.prompt)}
                                disabled={isTyping}
                                className="whitespace-nowrap px-2.5 py-1 rounded-full text-[11px] bg-white border border-slate-200/80 text-slate-600 hover:text-indigo-600 hover:border-indigo-300 hover:bg-indigo-50/50 transition-all disabled:opacity-50 flex-shrink-0 shadow-2xs"
                            >
                                {item.label}
                            </button>
                        ))}
                    </div>

                    {/* Input Area */}
                    <div className="p-3 bg-white border-t border-slate-200/80 flex-shrink-0 flex items-center gap-2">
                        <input
                            type="text"
                            value={inputMessage}
                            onChange={(e) => setInputMessage(e.target.value)}
                            onKeyDown={handleKeyPress}
                            placeholder="Nhập câu hỏi cho trợ lý AI..."
                            className="flex-1 px-3.5 py-2.5 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all placeholder:text-slate-400"
                            disabled={isTyping}
                        />
                        <button
                            onClick={handleSendMessage}
                            disabled={isTyping || !inputMessage.trim()}
                            className="w-10 h-10 rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-700 text-white flex items-center justify-center hover:from-indigo-700 hover:to-indigo-800 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-sm active:scale-95 flex-shrink-0"
                            title="Gửi câu hỏi (Enter)"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.2} stroke="currentColor" className="w-4 h-4">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
                            </svg>
                        </button>
                    </div>
                </div>
            )}

            {/* Feedback Popup */}
            {showFeedback && (
                <div className="fixed bottom-24 right-6 z-50 w-84 bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden animate-fade-in">
                    <div className="bg-gradient-to-r from-purple-600 to-pink-600 p-3.5 flex items-center justify-between text-white">
                        <div>
                            <h3 className="font-bold text-sm flex items-center gap-2">
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" className="w-5 h-5">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
                                </svg>
                                Góp ý & Báo lỗi
                            </h3>
                            <p className="text-pink-100 text-[11px]">Ý kiến của anh/chị giúp ImageTool hoàn thiện hơn!</p>
                        </div>
                        <button
                            onClick={() => setShowFeedback(false)}
                            className="p-1 rounded-lg text-white/80 hover:text-white hover:bg-white/15 transition-all"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>
                    <div className="p-4">
                        {isSent ? (
                            <div className="text-center py-8">
                                <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-7 h-7 text-green-600">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                </div>
                                <h4 className="text-base font-bold text-slate-800">Cảm ơn anh/chị!</h4>
                                <p className="text-slate-500 text-xs mt-1">Nội dung góp ý đã được gửi trực tiếp đến ban quản trị.</p>
                            </div>
                        ) : (
                            <form onSubmit={handleFeedbackSubmit} className="space-y-3">
                                <input
                                    type="text"
                                    placeholder="Họ và tên *"
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-purple-500/30 focus:border-purple-500 outline-none"
                                />
                                <input
                                    type="email"
                                    placeholder="Email liên hệ *"
                                    value={formData.email}
                                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-purple-500/30 focus:border-purple-500 outline-none"
                                />
                                <input
                                    type="text"
                                    placeholder="Tiêu đề (tùy chọn)"
                                    value={formData.title}
                                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-purple-500/30 focus:border-purple-500 outline-none"
                                />
                                <textarea
                                    placeholder="Nội dung góp ý hoặc mô tả lỗi gặp phải... *"
                                    rows={4}
                                    value={formData.message}
                                    onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-purple-500/30 focus:border-purple-500 outline-none resize-none"
                                />
                                {feedbackError && <div className="text-red-500 text-xs bg-red-50 p-2 rounded-lg">{feedbackError}</div>}
                                <button
                                    type="submit"
                                    disabled={isSending}
                                    className="w-full py-2.5 bg-gradient-to-r from-purple-600 to-pink-600 text-white font-bold text-xs rounded-lg hover:from-purple-700 hover:to-pink-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-sm"
                                >
                                    {isSending ? (
                                        <>
                                            <svg className="animate-spin h-3.5 w-3.5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                            </svg>
                                            Đang gửi góp ý...
                                        </>
                                    ) : (
                                        <>
                                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-3.5 h-3.5">
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

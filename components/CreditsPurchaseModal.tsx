import React, { useState, useRef } from 'react';
import { BANK_INFO } from '../services/firebaseService';
import { processAndAddCredits } from '../services/billVerificationService';
import { formatVND, AVAILABLE_IMAGE_MODELS } from '../services/geminiCoreService';

interface CreditsPurchaseModalProps {
    userId: string;
    userName: string;
    userEmail: string;
    currentBalance: number; // VND instead of credits
    onClose: () => void;
    onSuccess: (newBalance: number) => void;
}

type Step = 'input' | 'preview' | 'payment' | 'verification' | 'result';

export const CreditsPurchaseModal: React.FC<CreditsPurchaseModalProps> = ({
    userId,
    userName,
    userEmail,
    currentBalance,
    onClose,
    onSuccess
}) => {
    const [step, setStep] = useState<Step>('input');
    const [amount, setAmount] = useState<number>(0);
    const [billImage, setBillImage] = useState<string | null>(null);
    const [isVerifying, setIsVerifying] = useState(false);
    const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);

    const fileInputRef = useRef<HTMLInputElement>(null);

    // Calculate estimated images based on cheapest model (120đ/image)
    const estimatedImages = Math.floor(amount / 120);

    // Handle amount input
    const handleAmountChange = (value: string) => {
        const numValue = parseInt(value.replace(/\D/g, '')) || 0;
        setAmount(numValue);
    };

    // Preview calculation
    const handlePreview = () => {
        if (amount < 10000) {
            alert('Số tiền tối thiểu là 10.000đ');
            return;
        }
        setStep('preview');
    };

    // Start payment
    const handleStartPayment = () => {
        setStep('payment');
    };

    // Handle bill image upload - automatically triggers verification
    const handleBillUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (event) => {
            const base64 = (event.target?.result as string).split(',')[1];
            setBillImage(base64);
            setStep('verification');

            // Auto-trigger verification after a short delay for UI update
            setTimeout(() => {
                handleVerifyInternal(base64);
            }, 100);
        };
        reader.readAsDataURL(file);
    };

    // Internal verification handler that accepts base64 directly
    const handleVerifyInternal = async (billBase64: string) => {
        if (!billBase64) return;

        setIsVerifying(true);
        try {
            const res = await processAndAddCredits(
                userId,
                userName,
                userEmail,
                billBase64,
                amount,
                amount // Now using VND directly as balance instead of credits
            );

            setResult(res);
            setStep('result');

            if (res.success && res.newBalance !== undefined) {
                onSuccess(res.newBalance);
            }
        } catch (error: any) {
            console.error('Verify error:', error);
            setResult({
                success: false,
                message: error.message || ('Lỗi xác minh. Vui lòng liên hệ ' + BANK_INFO.supportPhone)
            });
            setStep('result');
        }
        setIsVerifying(false);
    };

    // Verify and add credits
    const handleVerify = async () => {
        if (!billImage) return;

        setIsVerifying(true);
        try {
            const res = await processAndAddCredits(
                userId,
                userName,
                userEmail,
                billImage,
                amount,
                amount // Now using VND directly as balance instead of credits
            );

            setResult(res);
            setStep('result');

            if (res.success && res.newBalance !== undefined) {
                onSuccess(res.newBalance);
            }
        } catch (error: any) {
            console.error('Verify error:', error);
            setResult({
                success: false,
                message: error.message || ('Lỗi xác minh. Vui lòng liên hệ ' + BANK_INFO.supportPhone)
            });
            setStep('result');
        }
        setIsVerifying(false);
    };

    // Remove Vietnamese accents and convert to uppercase
    const removeVietnameseAccents = (str: string): string => {
        const accents: { [key: string]: string } = {
            'à': 'a', 'á': 'a', 'ả': 'a', 'ã': 'a', 'ạ': 'a',
            'ă': 'a', 'ằ': 'a', 'ắ': 'a', 'ẳ': 'a', 'ẵ': 'a', 'ặ': 'a',
            'â': 'a', 'ầ': 'a', 'ấ': 'a', 'ẩ': 'a', 'ẫ': 'a', 'ậ': 'a',
            'đ': 'd',
            'è': 'e', 'é': 'e', 'ẻ': 'e', 'ẽ': 'e', 'ẹ': 'e',
            'ê': 'e', 'ề': 'e', 'ế': 'e', 'ể': 'e', 'ễ': 'e', 'ệ': 'e',
            'ì': 'i', 'í': 'i', 'ỉ': 'i', 'ĩ': 'i', 'ị': 'i',
            'ò': 'o', 'ó': 'o', 'ỏ': 'o', 'õ': 'o', 'ọ': 'o',
            'ô': 'o', 'ồ': 'o', 'ố': 'o', 'ổ': 'o', 'ỗ': 'o', 'ộ': 'o',
            'ơ': 'o', 'ờ': 'o', 'ớ': 'o', 'ở': 'o', 'ỡ': 'o', 'ợ': 'o',
            'ù': 'u', 'ú': 'u', 'ủ': 'u', 'ũ': 'u', 'ụ': 'u',
            'ư': 'u', 'ừ': 'u', 'ứ': 'u', 'ử': 'u', 'ữ': 'u', 'ự': 'u',
            'ỳ': 'y', 'ý': 'y', 'ỷ': 'y', 'ỹ': 'y', 'ỵ': 'y',
            'À': 'A', 'Á': 'A', 'Ả': 'A', 'Ã': 'A', 'Ạ': 'A',
            'Ă': 'A', 'Ằ': 'A', 'Ắ': 'A', 'Ẳ': 'A', 'Ẵ': 'A', 'Ặ': 'A',
            'Â': 'A', 'Ầ': 'A', 'Ấ': 'A', 'Ẩ': 'A', 'Ẫ': 'A', 'Ậ': 'A',
            'Đ': 'D',
            'È': 'E', 'É': 'E', 'Ẻ': 'E', 'Ẽ': 'E', 'Ẹ': 'E',
            'Ê': 'E', 'Ề': 'E', 'Ế': 'E', 'Ể': 'E', 'Ễ': 'E', 'Ệ': 'E',
            'Ì': 'I', 'Í': 'I', 'Ỉ': 'I', 'Ĩ': 'I', 'Ị': 'I',
            'Ò': 'O', 'Ó': 'O', 'Ỏ': 'O', 'Õ': 'O', 'Ọ': 'O',
            'Ô': 'O', 'Ồ': 'O', 'Ố': 'O', 'Ổ': 'O', 'Ỗ': 'O', 'Ộ': 'O',
            'Ơ': 'O', 'Ờ': 'O', 'Ớ': 'O', 'Ở': 'O', 'Ỡ': 'O', 'Ợ': 'O',
            'Ù': 'U', 'Ú': 'U', 'Ủ': 'U', 'Ũ': 'U', 'Ụ': 'U',
            'Ư': 'U', 'Ừ': 'U', 'Ứ': 'U', 'Ử': 'U', 'Ữ': 'U', 'Ự': 'U',
            'Ỳ': 'Y', 'Ý': 'Y', 'Ỷ': 'Y', 'Ỹ': 'Y', 'Ỵ': 'Y'
        };
        return str.split('').map(char => accents[char] || char).join('').toUpperCase();
    };

    // Generate transfer content with normalized name
    const normalizedName = removeVietnameseAccents(userName);
    const transferContent = `${normalizedName} NAP ${amount}`;

    // Quick amount buttons
    const quickAmounts = [10000, 20000, 50000, 100000];

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
                {/* Header */}
                <div className="bg-gradient-to-r from-amber-500 to-orange-600 text-white p-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <span className="text-2xl">💳</span>
                            <div>
                                <h2 className="font-bold text-lg">Nạp Tiền VIP</h2>
                                <p className="text-xs text-white/80">Số dư: {formatVND(currentBalance)}</p>
                            </div>
                        </div>
                        <button onClick={onClose} className="p-2 hover:bg-white/20 rounded-lg transition-colors">
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>
                </div>

                <div className="p-5">
                    {/* Step 1: Input Amount */}
                    {step === 'input' && (
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-2">Nhập số tiền nạp (VND)</label>
                                <input
                                    type="text"
                                    value={amount ? amount.toLocaleString() : ''}
                                    onChange={(e) => handleAmountChange(e.target.value)}
                                    placeholder="Ví dụ: 50,000"
                                    className="w-full p-3 border-2 border-slate-200 rounded-xl text-lg font-bold focus:border-amber-500 focus:ring-2 focus:ring-amber-200 outline-none transition-all"
                                />
                            </div>

                            <div className="flex flex-wrap gap-2">
                                {quickAmounts.map(amt => (
                                    <button
                                        key={amt}
                                        onClick={() => setAmount(amt)}
                                        className={`px-4 py-2 rounded-lg font-bold text-sm transition-all ${amount === amt
                                            ? 'bg-amber-500 text-white'
                                            : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                                            }`}
                                    >
                                        {amt.toLocaleString()}đ
                                    </button>
                                ))}
                            </div>

                            <div className="bg-amber-50 rounded-xl p-4 border border-amber-100">
                                <h4 className="font-bold text-amber-800 mb-2">💡 Bảng giá ảnh theo Model:</h4>
                                <div className="space-y-2 text-sm">
                                    {AVAILABLE_IMAGE_MODELS.map(model => (
                                        <div key={model.id} className="flex justify-between text-amber-700">
                                            <span>{model.nameShort}</span>
                                            <span className="font-bold">{formatVND(model.pricePerImage)}/ảnh</span>
                                        </div>
                                    ))}
                                </div>
                                <p className="text-xs text-amber-600 mt-2">💰 Nạp bao nhiêu = Số dư bấy nhiêu (VNĐ)</p>
                            </div>

                            <button
                                onClick={handlePreview}
                                disabled={amount < 10000}
                                className="w-full py-3 bg-gradient-to-r from-amber-500 to-orange-600 text-white font-bold rounded-xl hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                Xem trước khi nạp
                            </button>
                        </div>
                    )}

                    {/* Step 2: Preview */}
                    {step === 'preview' && (
                        <div className="space-y-4">
                            <div className="bg-gradient-to-br from-amber-100 to-orange-100 rounded-xl p-5 text-center">
                                <p className="text-sm text-amber-700 mb-1">Số tiền nạp</p>
                                <p className="text-3xl font-extrabold text-amber-800">{formatVND(amount)}</p>
                                <div className="mt-4 flex items-center justify-center gap-4">
                                    <div className="text-center">
                                        <p className="text-2xl font-bold text-orange-600">{formatVND(amount)}</p>
                                        <p className="text-xs text-slate-600">Số dư mới</p>
                                    </div>
                                    <div className="text-2xl text-slate-400">≈</div>
                                    <div className="text-center">
                                        <p className="text-2xl font-bold text-green-600">~{estimatedImages}</p>
                                        <p className="text-xs text-slate-600">Ảnh (Gemini Flash)</p>
                                    </div>
                                </div>
                            </div>

                            <div className="flex gap-3">
                                <button
                                    onClick={() => setStep('input')}
                                    className="flex-1 py-3 bg-slate-100 text-slate-700 font-bold rounded-xl hover:bg-slate-200 transition-all"
                                >
                                    Sửa số tiền
                                </button>
                                <button
                                    onClick={handleStartPayment}
                                    className="flex-1 py-3 bg-gradient-to-r from-green-500 to-emerald-600 text-white font-bold rounded-xl hover:shadow-lg transition-all"
                                >
                                    Bắt đầu thanh toán
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Step 3: Payment Info */}
                    {step === 'payment' && (
                        <div className="space-y-4">
                            <div className="bg-blue-50 rounded-xl p-4 border border-blue-100">
                                <h4 className="font-bold text-blue-800 mb-3 flex items-center gap-2">
                                    <span>🏦</span> Thông tin chuyển khoản
                                </h4>
                                <div className="space-y-2 text-sm">
                                    <div className="flex justify-between">
                                        <span className="text-slate-600">Ngân hàng:</span>
                                        <span className="font-bold text-blue-800">{BANK_INFO.bankName}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-slate-600">Chủ TK:</span>
                                        <span className="font-bold text-blue-800">{BANK_INFO.accountHolder}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-slate-600">Số TK:</span>
                                        <span className="font-bold text-blue-800 font-mono">{BANK_INFO.accountNumber}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-slate-600">Số tiền:</span>
                                        <span className="font-bold text-green-600">{amount.toLocaleString()}đ</span>
                                    </div>
                                    <div className="mt-3 p-3 bg-white rounded-lg border-2 border-dashed border-blue-300">
                                        <p className="text-xs text-slate-500 mb-1">Nội dung chuyển khoản:</p>
                                        <p className="font-bold text-blue-800 break-all">{transferContent}</p>
                                    </div>
                                </div>
                            </div>

                            <div className="bg-amber-50 rounded-xl p-3 border border-amber-200">
                                <p className="text-xs text-amber-700">
                                    ⚠️ <strong>Quan trọng:</strong> Vui lòng ghi đúng nội dung chuyển khoản.
                                    Bill chỉ hợp lệ trong <strong>20 phút</strong> sau khi chuyển.
                                </p>
                            </div>

                            <div>
                                <p className="text-sm font-bold text-slate-700 mb-2">Upload bill chuyển khoản:</p>
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept="image/*"
                                    onChange={handleBillUpload}
                                    className="hidden"
                                />
                                <button
                                    onClick={() => fileInputRef.current?.click()}
                                    className="w-full py-4 border-2 border-dashed border-slate-300 rounded-xl text-slate-600 hover:border-amber-500 hover:text-amber-600 transition-all flex items-center justify-center gap-2"
                                >
                                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                    </svg>
                                    Chọn ảnh bill chuyển khoản
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Step 4: Verification */}
                    {step === 'verification' && (
                        <div className="space-y-4">
                            {billImage && (
                                <div className="relative">
                                    <img
                                        src={`data:image/png;base64,${billImage}`}
                                        alt="Bill"
                                        className="w-full rounded-xl border-2 border-slate-200"
                                    />
                                    <button
                                        onClick={() => {
                                            setBillImage(null);
                                            setStep('payment');
                                        }}
                                        className="absolute top-2 right-2 p-2 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors"
                                    >
                                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                        </svg>
                                    </button>
                                </div>
                            )}

                            <button
                                onClick={handleVerify}
                                disabled={isVerifying}
                                className="w-full py-3 bg-gradient-to-r from-green-500 to-emerald-600 text-white font-bold rounded-xl hover:shadow-lg transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                            >
                                {isVerifying ? (
                                    <>
                                        <svg className="animate-spin h-5 w-5 text-white" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                        </svg>
                                        Vui lòng chờ...
                                    </>
                                ) : (
                                    <>
                                        <span>🔍</span>
                                        Xác minh và nạp tiền
                                    </>
                                )}
                            </button>
                        </div>
                    )}

                    {/* Step 5: Result */}
                    {step === 'result' && result && (
                        <div className="space-y-4 text-center">
                            <div className={`p-6 rounded-xl ${result.success ? 'bg-green-50' : 'bg-red-50'}`}>
                                <div className="text-5xl mb-3">{result.success ? '✅' : '❌'}</div>
                                <h3 className={`font-bold text-lg ${result.success ? 'text-green-800' : 'text-red-800'}`}>
                                    {result.success ? 'Thành công!' : 'Thất bại'}
                                </h3>
                                <p className={`mt-2 text-sm ${result.success ? 'text-green-700' : 'text-red-700'}`}>
                                    {result.message}
                                </p>
                            </div>

                            <button
                                onClick={onClose}
                                className="w-full py-3 bg-slate-100 text-slate-700 font-bold rounded-xl hover:bg-slate-200 transition-all"
                            >
                                Đóng
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

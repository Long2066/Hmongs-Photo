import React from 'react';
import { formatVND, getSelectedImageModel, getModelConfig } from '../services/geminiCoreService';

interface CreditsConfirmDialogProps {
    imageCount: number;
    currentCredits: number; // This is now VND balance
    onConfirm: () => void;
    onCancel: () => void;
}

export const CreditsConfirmDialog: React.FC<CreditsConfirmDialogProps> = ({
    imageCount,
    currentCredits, // Now represents VND balance
    onConfirm,
    onCancel
}) => {
    const modelId = getSelectedImageModel();
    const model = getModelConfig(modelId);
    const pricePerImage = model?.pricePerImage || 120;
    const balanceRequired = imageCount * pricePerImage;
    const currentBalance = currentCredits; // VND
    const hasEnough = currentBalance >= balanceRequired;
    const remainingBalance = currentBalance - balanceRequired;

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden animate-fade-in">
                {/* Header */}
                <div className="bg-gradient-to-r from-amber-500 to-orange-600 text-white p-4 text-center">
                    <span className="text-3xl">💰</span>
                    <h2 className="font-bold text-lg mt-1">Xác nhận thanh toán</h2>
                </div>

                <div className="p-5 space-y-4">
                    {/* Model Info */}
                    <div className="bg-indigo-50 rounded-xl p-3 border border-indigo-100">
                        <p className="text-xs text-indigo-600">
                            🤖 Model: <strong>{model?.name || 'Gemini 2.5 Flash'}</strong>
                        </p>
                    </div>

                    {/* Balance Usage */}
                    <div className="bg-amber-50 rounded-xl p-4 border border-amber-100">
                        <div className="flex items-center justify-between text-sm mb-2">
                            <span className="text-slate-600">Số ảnh tạo ra:</span>
                            <span className="font-bold text-slate-800">{imageCount} ảnh</span>
                        </div>
                        <div className="flex items-center justify-between text-sm mb-2">
                            <span className="text-slate-600">Đơn giá:</span>
                            <span className="font-bold text-orange-600">{formatVND(pricePerImage)}/ảnh</span>
                        </div>
                        <div className="flex items-center justify-between text-sm mb-2">
                            <span className="text-slate-600">Tổng chi phí:</span>
                            <span className="font-bold text-red-600 text-lg">{formatVND(balanceRequired)}</span>
                        </div>
                        <hr className="my-2 border-amber-200" />
                        <div className="flex items-center justify-between text-sm mb-2">
                            <span className="text-slate-600">Số dư hiện có:</span>
                            <span className="font-bold text-amber-700">{formatVND(currentBalance)}</span>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                            <span className="text-slate-600">Còn lại sau khi tạo:</span>
                            <span className={`font-bold ${hasEnough ? 'text-green-600' : 'text-red-600'}`}>
                                {hasEnough ? formatVND(remainingBalance) : 'Không đủ số dư!'}
                            </span>
                        </div>
                    </div>

                    {!hasEnough && (
                        <div className="bg-red-50 rounded-xl p-3 border border-red-200">
                            <p className="text-xs text-red-700">
                                ⚠️ Bạn cần nạp thêm <strong>{formatVND(balanceRequired - currentBalance)}</strong> để tiếp tục.
                            </p>
                        </div>
                    )}

                    {/* Buttons */}
                    <div className="flex gap-3">
                        <button
                            onClick={onCancel}
                            className="flex-1 py-3 bg-slate-100 text-slate-700 font-bold rounded-xl hover:bg-slate-200 transition-all"
                        >
                            Hủy
                        </button>
                        <button
                            onClick={onConfirm}
                            disabled={!hasEnough}
                            className="flex-1 py-3 bg-gradient-to-r from-amber-500 to-orange-600 text-white font-bold rounded-xl hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            Thanh toán
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};


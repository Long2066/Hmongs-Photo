import React from 'react';

export type GenerationMode = 'antigravity' | 'vip' | 'free';

interface ModeSelectionDialogProps {
    isOpen: boolean;
    onClose: () => void;
    onSelectMode: (mode: GenerationMode | 'retry' | 'cancel') => void;
    reason: 'antigravity_disconnected' | 'antigravity_failed' | 'vip_failed' | 'free_failed';
    availableModes: {
        antigravity: boolean;
        vip: boolean;
        free: boolean;
    };
}

/**
 * Dialog hiển thị khi cần hỏi user chọn mode
 * Hiển thị khi Antigravity không kết nối hoặc mode hiện tại fail
 */
export const ModeSelectionDialog: React.FC<ModeSelectionDialogProps> = ({
    isOpen,
    onClose,
    onSelectMode,
    reason,
    availableModes
}) => {
    if (!isOpen) return null;

    const getTitle = () => {
        switch (reason) {
            case 'antigravity_disconnected':
                return '⚠️ Antigravity Không Kết Nối';
            case 'antigravity_failed':
                return '❌ Antigravity Thất Bại';
            case 'vip_failed':
                return '❌ VIP Mode Thất Bại';
            case 'free_failed':
                return '❌ Tạo Ảnh Thất Bại';
            default:
                return '⚠️ Chọn Chế Độ';
        }
    };

    const getMessage = () => {
        switch (reason) {
            case 'antigravity_disconnected':
                return 'Antigravity được bật nhưng không kết nối được. Bạn muốn:';
            case 'antigravity_failed':
                return 'Antigravity đã thất bại khi tạo ảnh. Bạn muốn:';
            case 'vip_failed':
                return 'VIP Mode đã thất bại. Bạn muốn:';
            case 'free_failed':
                return 'Không thể tạo ảnh. Bạn muốn:';
            default:
                return 'Chọn phương thức tạo ảnh:';
        }
    };

    return (
        <div className="mode-selection-overlay">
            <div className="mode-selection-dialog">
                <h3>{getTitle()}</h3>
                <p>{getMessage()}</p>

                <div className="mode-options">
                    {reason === 'antigravity_disconnected' && (
                        <button
                            className="mode-btn mode-btn-retry"
                            onClick={() => onSelectMode('retry')}
                        >
                            🔄 Thử kết nối lại
                        </button>
                    )}

                    {availableModes.antigravity && reason !== 'antigravity_failed' && (
                        <button
                            className="mode-btn mode-btn-antigravity"
                            onClick={() => onSelectMode('antigravity')}
                        >
                            🚀 Dùng Antigravity
                        </button>
                    )}

                    {availableModes.vip && reason !== 'vip_failed' && (
                        <button
                            className="mode-btn mode-btn-vip"
                            onClick={() => onSelectMode('vip')}
                        >
                            ⭐ Dùng VIP (PRO)
                        </button>
                    )}

                    {availableModes.free && reason !== 'free_failed' && (
                        <button
                            className="mode-btn mode-btn-free"
                            onClick={() => onSelectMode('free')}
                        >
                            🔑 Dùng API Key cá nhân
                        </button>
                    )}

                    <button
                        className="mode-btn mode-btn-cancel"
                        onClick={() => onSelectMode('cancel')}
                    >
                        ❌ Hủy
                    </button>
                </div>
            </div>

            <style>{`
                .mode-selection-overlay {
                    position: fixed;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    background: rgba(0, 0, 0, 0.7);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    z-index: 10000;
                    backdrop-filter: blur(4px);
                }

                .mode-selection-dialog {
                    background: linear-gradient(145deg, #1a1a2e, #16213e);
                    border-radius: 16px;
                    padding: 24px;
                    max-width: 400px;
                    width: 90%;
                    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
                    border: 1px solid rgba(255, 255, 255, 0.1);
                }

                .mode-selection-dialog h3 {
                    margin: 0 0 12px 0;
                    color: #fff;
                    font-size: 1.25rem;
                }

                .mode-selection-dialog p {
                    margin: 0 0 20px 0;
                    color: rgba(255, 255, 255, 0.7);
                    font-size: 0.95rem;
                }

                .mode-options {
                    display: flex;
                    flex-direction: column;
                    gap: 10px;
                }

                .mode-btn {
                    padding: 14px 20px;
                    border: none;
                    border-radius: 10px;
                    font-size: 1rem;
                    font-weight: 500;
                    cursor: pointer;
                    transition: all 0.2s ease;
                    text-align: left;
                }

                .mode-btn:hover {
                    transform: translateY(-2px);
                }

                .mode-btn-retry {
                    background: linear-gradient(135deg, #667eea, #764ba2);
                    color: white;
                }

                .mode-btn-antigravity {
                    background: linear-gradient(135deg, #11998e, #38ef7d);
                    color: white;
                }

                .mode-btn-vip {
                    background: linear-gradient(135deg, #f093fb, #f5576c);
                    color: white;
                }

                .mode-btn-free {
                    background: linear-gradient(135deg, #4facfe, #00f2fe);
                    color: white;
                }

                .mode-btn-cancel {
                    background: rgba(255, 255, 255, 0.1);
                    color: rgba(255, 255, 255, 0.7);
                    margin-top: 10px;
                }

                .mode-btn-cancel:hover {
                    background: rgba(255, 255, 255, 0.2);
                }
            `}</style>
        </div>
    );
};

export default ModeSelectionDialog;

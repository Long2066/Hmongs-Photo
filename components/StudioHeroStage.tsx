import React from 'react';

interface StudioHeroStageProps {
    onOpenConfig?: () => void;
}

const PETALS = [
    { left: '14%', delay: '-1s', duration: '13s', size: 13 },
    { left: '29%', delay: '-6s', duration: '15s', size: 11 },
    { left: '46%', delay: '-3s', duration: '12s', size: 14 },
    { left: '64%', delay: '-9s', duration: '14s', size: 12 },
    { left: '79%', delay: '-4s', duration: '13s', size: 15 },
    { left: '89%', delay: '-11s', duration: '16s', size: 11 },
];

export const StudioHeroStage: React.FC<StudioHeroStageProps> = ({ onOpenConfig }) => {
    return (
        <div className="relative w-full h-full min-h-[480px] sm:min-h-[540px] lg:min-h-[calc(100vh-128px)] rounded-2xl overflow-hidden shadow-[0_8px_30px_rgba(79,70,229,0.10)] ring-1 ring-indigo-200/70 flex items-center justify-center select-none bg-[#cfe9ff]">
            {/* High-resolution Scenic Studio Hero Artwork */}
            <img
                src="/studio-hero-art.webp"
                alt="ImageTool AI Studio"
                draggable={false}
                className="absolute inset-0 w-full h-full object-cover object-center pointer-events-none"
            />

            {/* Subtle Ambient Halo Shimmer over the Robot Platform */}
            <div
                className="absolute left-1/2 top-[44%] -translate-x-1/2 -translate-y-1/2 w-[34%] h-[10%] rounded-full pointer-events-none opacity-45 animate-pulse"
                style={{
                    background: 'radial-gradient(ellipse at center, rgba(240,171,252,0.55) 0%, rgba(56,189,248,0.28) 55%, transparent 80%)',
                    filter: 'blur(10px)',
                }}
                aria-hidden="true"
            />

            {/* Gentle Live Drifting Sakura Petals */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none z-10" aria-hidden="true">
                {PETALS.map((petal, idx) => (
                    <span
                        key={idx}
                        className="absolute -top-6 rounded-tl-full rounded-br-full bg-gradient-to-br from-pink-100 via-pink-300 to-rose-400/85 shadow-2xs"
                        style={{
                            left: petal.left,
                            width: `${petal.size}px`,
                            height: `${petal.size * 0.7}px`,
                            opacity: 0.82,
                            animation: `auth-petal-fall ${petal.duration} linear infinite`,
                            animationDelay: petal.delay,
                        }}
                    />
                ))}
            </div>

            {/* Crisp Vector HTML Typography Positioned Directly in the Mist Zone (58.5% vertical center) */}
            <div
                className="absolute inset-x-4 top-[58.5%] -translate-y-1/2 z-20 flex flex-col items-center text-center px-4"
                style={{
                    textShadow: '0 1px 14px rgba(255,255,255,0.95), 0 0 28px rgba(255,255,255,0.9)',
                }}
            >
                <h2 className="text-xl sm:text-2xl lg:text-[27px] font-extrabold text-[#162654] tracking-tight leading-tight">
                    Khung xem ảnh Studio sẵn sàng
                </h2>
                <p className="text-xs sm:text-[13.5px] lg:text-[14.5px] text-[#35466e] mt-2 leading-relaxed font-medium max-w-lg">
                    Cấu hình ảnh mẫu, góc chụp, phong cách và nhấn “Bắt đầu tạo”
                    <br className="hidden sm:inline" />{' '}
                    để AI render bộ sưu tập ảnh sắc nét tại đây.
                </p>
                {onOpenConfig && (
                    <button
                        type="button"
                        onClick={onOpenConfig}
                        style={{ textShadow: 'none' }}
                        className="lg:hidden mt-3.5 inline-flex items-center gap-2 px-4 py-2.5 rounded-full bg-gradient-to-r from-[#5b3bf7] to-[#9333ea] text-white text-xs font-semibold shadow-md shadow-violet-500/25 min-h-[44px]"
                    >
                        <span>Mở cấu hình AI ngay</span>
                    </button>
                )}
            </div>
        </div>
    );
};


import React, { useState, useEffect, useRef } from 'react';

interface DreamJobPresentationProps {
  inputs: { base64: string, name: string, job: string }[];
  outputs: (string | null)[]; // Array of base64 strings or null
  onComplete: () => void;
}

export const DreamJobPresentation: React.FC<DreamJobPresentationProps> = ({ inputs, outputs, onComplete }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  // Phase 1: Show Input (3s), Phase 2: Show Output (7s)
  const [showOutput, setShowOutput] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Auto Fullscreen on mount
  useEffect(() => {
      const enterFullscreen = async () => {
          if (containerRef.current) {
              try {
                  if (containerRef.current.requestFullscreen) {
                      await containerRef.current.requestFullscreen();
                  } else if ((containerRef.current as any).webkitRequestFullscreen) {
                      await (containerRef.current as any).webkitRequestFullscreen();
                  }
              } catch (e) {
                  console.warn("Auto fullscreen blocked by browser policy", e);
              }
          }
      };
      enterFullscreen();
  }, []);

  // Keyboard listener for ESC
  useEffect(() => {
      const handleKeyDown = (e: KeyboardEvent) => {
          if (e.key === 'Escape') {
              onComplete();
          }
      };
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onComplete]);

  // Main Loop Logic
  useEffect(() => {
      let timeoutId: ReturnType<typeof setTimeout>;

      if (!showOutput) {
          // PHASE 1: SHOW INPUT (Student) for 4 seconds
          timeoutId = setTimeout(() => {
              setShowOutput(true); // Switch to Output
          }, 4000);
      } else {
          // PHASE 2: SHOW OUTPUT (Dream Job) for 8 seconds
          timeoutId = setTimeout(() => {
              // EXPLICITLY RESET PHASE BEFORE CHANGING SLIDE
              setShowOutput(false);
              setCurrentIndex((prev) => (prev + 1) % inputs.length);
          }, 8000);
      }

      return () => clearTimeout(timeoutId);
  }, [showOutput, inputs.length]);

  const total = inputs.length;

  // Helper to determine position class
  const getSlideConfig = (index: number) => {
      // Calculate circular distance
      // 0: Active, -1 (or total-1): Prev, 1: Next
      let diff = (index - currentIndex + total) % total;
      
      // Handle the wrap-around for Previous item to ensure it slides LEFT not RIGHT across screen
      // If total is large, total-1 is "Left". If total is small (e.g. 2), logic needs care.
      
      const isCurrent = index === currentIndex;
      const isNext = diff === 1; 
      const isPrev = diff === total - 1;

      // Special handling for 2 items to prevent overlap issues
      if (total === 2) {
          if (isCurrent) return { style: "left-1/2 -translate-x-1/2 scale-100 opacity-100 z-30", type: 'current' };
          return { style: "left-[85%] -translate-x-1/2 scale-75 opacity-40 z-20 blur-[1px]", type: 'next' }; // Make the other one 'next'
      }

      if (isCurrent) {
          return { style: "left-1/2 -translate-x-1/2 scale-100 opacity-100 z-30", type: 'current' };
      } else if (isPrev) {
          return { style: "left-[15%] -translate-x-1/2 scale-75 opacity-40 z-20 blur-[1px]", type: 'prev' };
      } else if (isNext) {
          return { style: "left-[85%] -translate-x-1/2 scale-75 opacity-40 z-20 blur-[1px]", type: 'next' };
      } else {
          // Hidden items (stacked behind center or off-screen)
          // We put them centrally but invisible so they can slide OUT to Right or IN from Left smoothly if needed, 
          // or just stay hidden. Best to hide them.
          return { style: "left-1/2 -translate-x-1/2 scale-0 opacity-0 z-0", type: 'hidden' };
      }
  };

  return (
    <div 
        ref={containerRef}
        className="fixed inset-0 z-[9999] bg-slate-950 flex overflow-hidden font-sans"
    >
        {/* Animated Background */}
        <div className="absolute inset-0 opacity-40 bg-[url('https://www.transparenttextures.com/patterns/stardust.png')] animate-pulse pointer-events-none"></div>
        <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-indigo-950 to-black opacity-90 pointer-events-none"></div>
        
        {/* Radial spotlight for center */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[80vh] h-[80vh] bg-indigo-500/10 blur-[100px] rounded-full pointer-events-none"></div>

        {/* --- CAROUSEL CONTAINER --- */}
        <div className="relative w-full h-full flex items-center justify-center perspective-1000">
            
            {inputs.map((input, index) => {
                const config = getSlideConfig(index);
                const outputImage = outputs[index];
                const hasOutput = !!outputImage;

                // LOGIC FOR WHAT IMAGE TO SHOW:
                // 1. If it's the PREV slide (type='prev'), we want to show the RESULT (Output) because it's done.
                // 2. If it's the CURRENT slide (type='current'), we toggle Input -> Output.
                // 3. If it's the NEXT slide (type='next'), we show Input (waiting).
                
                let showResultImage = false;
                if (config.type === 'prev') showResultImage = true;
                if (config.type === 'current' && showOutput) showResultImage = true;

                // If we want to show result but it doesn't exist (error/loading), fallback to input
                const imageSrc = (showResultImage && hasOutput) 
                    ? `data:image/png;base64,${outputImage}`
                    : `data:image/png;base64,${input.base64}`;

                return (
                    <div 
                        key={index}
                        className={`absolute top-[7.5%] bottom-[7.5%] w-[90%] md:w-[45%] transition-all duration-1000 ease-in-out flex flex-col items-center justify-center ${config.style}`}
                    >
                         {/* Image Container */}
                        <div className="relative w-full h-full rounded-2xl overflow-hidden shadow-[0_0_60px_rgba(79,70,229,0.3)] border border-white/10 bg-black/50 group">
                            
                            {/* We use a single img tag with transition for src changes OR two layered images for crossfade.
                                Two layered images is smoother for the Input->Output transition in the Center card.
                            */}

                            {/* LAYER 1: INPUT (Always rendered as base layer) */}
                             <img 
                                src={`data:image/png;base64,${input.base64}`} 
                                alt="Input" 
                                className={`absolute inset-0 w-full h-full object-contain bg-black/40 backdrop-blur-sm transition-all duration-1000 ease-in-out
                                     ${(showResultImage && hasOutput) ? 'opacity-0 scale-105' : 'opacity-100 scale-100'}
                                `}
                            />

                            {/* LAYER 2: OUTPUT (Rendered on top if exists) */}
                            {hasOutput && (
                                <img 
                                    src={`data:image/png;base64,${outputImage}`} 
                                    alt="Output" 
                                    className={`absolute inset-0 w-full h-full object-contain bg-black/40 backdrop-blur-sm transition-all duration-1000 ease-in-out
                                        ${showResultImage ? 'opacity-100 scale-100' : 'opacity-0 scale-95'}
                                    `}
                                />
                            )}

                             {/* TEXT OVERLAY */}
                             <div className={`absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black via-black/80 to-transparent pt-24 pb-8 px-8 text-center transition-opacity duration-500 ${config.type === 'hidden' ? 'opacity-0' : 'opacity-100'}`}>
                                <div className={`transition-all duration-700 transform ${config.type === 'current' && showOutput ? 'translate-y-0' : 'translate-y-0'}`}>
                                    {config.type === 'current' && (
                                        <p className="text-blue-300 font-bold tracking-[0.2em] uppercase text-sm mb-2 flex items-center justify-center gap-2 animate-fade-in">
                                            <span className="w-8 h-[1px] bg-blue-500 inline-block"></span>
                                            {showOutput && hasOutput ? "TƯƠNG LAI RẠNG NGỜI" : "HỌC SINH TIÊU BIỂU"}
                                            <span className="w-8 h-[1px] bg-blue-500 inline-block"></span>
                                        </p>
                                    )}
                                    <h1 className={`font-black text-white uppercase drop-shadow-lg mb-2 transition-all duration-700 ${config.type === 'current' ? 'text-4xl md:text-6xl' : 'text-xl'}`}>
                                        {input.name}
                                    </h1>
                                    
                                    {/* Job Title - Only prominent on Current card */}
                                    {config.type === 'current' && (
                                        <p className={`text-2xl md:text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 to-amber-500 uppercase transition-all duration-1000 ${showOutput ? 'opacity-100 scale-100' : 'opacity-60 scale-95 blur-[1px]'}`}>
                                            {showOutput && hasOutput ? input.job : "ƯỚC MƠ..."}
                                        </p>
                                    )}

                                    {/* Labels for Prev/Next */}
                                    {config.type === 'next' && (
                                         <span className="inline-block mt-2 px-3 py-1 bg-white/20 rounded-full text-xs font-bold text-white uppercase">Sắp chiếu</span>
                                    )}
                                    {config.type === 'prev' && (
                                         <span className="inline-block mt-2 px-3 py-1 bg-indigo-600/50 rounded-full text-xs font-bold text-white uppercase">Đã chiếu</span>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                );
            })}

        </div>

        {/* Progress Bar */}
        <div className="absolute bottom-0 left-0 w-full h-1.5 bg-slate-800/50">
            <div 
                className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 transition-all duration-1000 ease-linear"
                style={{ width: `${((currentIndex + 1) / total) * 100}%` }}
            ></div>
        </div>

        <div className="absolute top-6 right-8 text-slate-500 text-xs font-mono uppercase tracking-widest flex items-center gap-2 z-50">
            <span className="animate-pulse text-green-500">●</span> Trình chiếu: {currentIndex + 1} / {total}
            <span className="mx-2 text-slate-700">|</span>
            Nhấn <kbd className="bg-white/10 px-1.5 py-0.5 rounded text-white font-bold border border-white/20">ESC</kbd> để thoát
        </div>
    </div>
  );
};

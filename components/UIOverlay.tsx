import React, { useRef } from "react";
import { TreeMode } from "../types";

interface UIOverlayProps {
  mode: TreeMode;
  onPhotosUpload: (photos: string[]) => void;
  hasPhotos: boolean;
  onClearPhotos: () => void;
  rotationSpeed: number;
  onRotationSpeedChange: (speed: number) => void;
  isFullScreen: boolean;
  onToggleFullScreen: () => void;
  selectedPhoto: string | null;
  onBack: () => void;
}

export const UIOverlay: React.FC<UIOverlayProps> = ({
  mode,
  onPhotosUpload,
  hasPhotos,
  onClearPhotos,
  rotationSpeed,
  onRotationSpeedChange,
  isFullScreen,
  onToggleFullScreen,
  selectedPhoto,
  onBack,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const photoUrls: string[] = [];
    const readers: Promise<string>[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (!file.type.startsWith("image/")) continue;

      const promise = new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = (event) => {
          if (event.target?.result) {
            resolve(event.target.result as string);
          }
        };
        reader.readAsDataURL(file);
      });

      readers.push(promise);
    }

    Promise.all(readers).then((urls) => {
      onPhotosUpload(urls);
    });
  };

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  // If selected photo is active, show Back button overlay
  if (selectedPhoto) {
    return (
      <div className="absolute top-0 left-0 w-full h-full pointer-events-none flex flex-col z-20">
        <div className="p-4 pointer-events-auto">
          <button
            onClick={onBack}
            className="px-6 py-2 bg-black/50 text-[#D4AF37] border border-[#D4AF37] hover:bg-[#D4AF37] hover:text-black transition-all font-serif"
          >
            BACK
          </button>
        </div>
      </div>
    );
  }

  // If in Full Screen mode, maybe hide controls or show minimal?
  // User requirement: "Entered full screen... click back to return".
  // "Click phone navigation back button" -> Browser back? Or just a UI back button?
  // "Click phone system navigation back button" implies using history API or just a logical back.
  // Since this is a web app, I'll provide a visible "Back" or "Exit Full Screen" button for better UX on desktop too,
  // but primarily for "Mobile system back", we'd need to push state to history.
  // For now, I will just show a "Exit Full Screen" button if user wants to return manually, or handle it via UI.
  // Actually, standard web app "Back" button is good.

  if (isFullScreen) {
    return (
      <div className="absolute top-0 left-0 w-full h-full pointer-events-none flex flex-col z-20">
        {/* Optional: Add a subtle 'Exit' button or rely on interaction */}
        <div className="absolute top-4 left-4 pointer-events-auto">
          <button
            onClick={onToggleFullScreen}
            className="px-4 py-2 bg-black/30 text-white/50 hover:text-white hover:bg-black/50 rounded-full transition-all"
          >
            Exit Full Screen
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="absolute top-0 left-0 w-full h-full pointer-events-none flex flex-col justify-between p-4 md:p-8 z-10 transition-opacity duration-500">
      {/* Header */}
      <header className="flex flex-col items-center">
        <h1 className="text-4xl md:text-6xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-[#D4AF37] via-[#F5E6BF] to-[#D4AF37] font-serif drop-shadow-lg tracking-wider text-center">
          MERRY CHRISTMAS
        </h1>
      </header>

      {/* Control Panel */}
      <div className="pointer-events-auto bg-black/60 backdrop-blur-md border border-[#D4AF37]/30 p-6 rounded-xl flex flex-col gap-6 max-w-md mx-auto w-full">
        {/* Row 1: Main Controls */}
        <div className="flex gap-4 justify-center">
          {/* Full Screen Button */}
          <button
            onClick={hasPhotos ? onToggleFullScreen : undefined}
            disabled={!hasPhotos}
            className={`
                    flex-1 py-3 px-4 border transition-all duration-300 font-serif tracking-widest text-center
                    ${
                      hasPhotos
                        ? "border-[#D4AF37] text-[#D4AF37] hover:bg-[#D4AF37] hover:text-black cursor-pointer shadow-[0_0_15px_rgba(212,175,55,0.3)]"
                        : "border-gray-600 text-gray-600 cursor-not-allowed bg-black/20"
                    }
                `}
          >
            全屏模式
          </button>

          {/* Import Button */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            onChange={handleFileChange}
            className="hidden"
          />
          <button
            onClick={handleUploadClick}
            className="flex-1 py-3 px-4 border border-[#D4AF37] text-[#D4AF37] hover:bg-[#D4AF37] hover:text-black transition-all duration-300 font-serif tracking-widest cursor-pointer shadow-[0_0_15px_rgba(212,175,55,0.3)]"
          >
            导入照片
          </button>
        </div>

        {/* Clear Button (Conditional) */}
        {hasPhotos && (
          <button
            onClick={onClearPhotos}
            className="w-full py-2 border border-red-500/50 text-red-400 hover:bg-red-500/20 transition-colors font-serif text-sm tracking-wider"
          >
            一键清空
          </button>
        )}

        {/* Speed Control */}
        <div className="flex flex-col gap-2">
          <div className="flex justify-between text-[#D4AF37] text-xs font-serif tracking-wider">
            <span>SLOW</span>
            <span>SPEED</span>
            <span>FAST</span>
          </div>
          <input
            type="range"
            min="0.5"
            max="10"
            step="0.5"
            value={rotationSpeed}
            onChange={(e) => onRotationSpeedChange(parseFloat(e.target.value))}
            className="w-full h-2 bg-gray-800 rounded-lg appearance-none cursor-pointer accent-[#D4AF37]"
          />
        </div>
      </div>

      {/* Decorative Corners */}
      <div className="absolute top-8 left-8 w-16 h-16 border-t-2 border-l-2 border-[#D4AF37] opacity-50 pointer-events-none"></div>
      <div className="absolute top-8 right-8 w-16 h-16 border-t-2 border-r-2 border-[#D4AF37] opacity-50 pointer-events-none"></div>
      <div className="absolute bottom-8 left-8 w-16 h-16 border-b-2 border-l-2 border-[#D4AF37] opacity-50 pointer-events-none"></div>
      <div className="absolute bottom-8 right-8 w-16 h-16 border-b-2 border-r-2 border-[#D4AF37] opacity-50 pointer-events-none"></div>
    </div>
  );
};

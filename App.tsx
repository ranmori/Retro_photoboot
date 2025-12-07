import React, { useState, useRef, useEffect, useCallback, Suspense } from 'react';
import { GoogleGenAI } from "@google/genai";
import { Photo, FilterType, FilterConfig } from './types';
import { generateVintageCaption } from './services/gemini';

// Lazy load UI components
// Adapting named exports to default exports for React.lazy
const Tape = React.lazy(() => import('./components/Tape').then(module => ({ default: module.Tape })));
const FloppyDisk = React.lazy(() => import('./components/FloppyDisk').then(module => ({ default: module.FloppyDisk })));

const FILTERS: FilterConfig[] = [
  { name: 'normal', label: 'Normal', class: '', cssFilter: 'none' },
  { name: 'grayscale', label: 'B&W', class: 'grayscale', cssFilter: 'grayscale(100%) contrast(110%)' },
  { name: 'sepia', label: 'Sepia', class: 'sepia', cssFilter: 'sepia(80%) contrast(90%) brightness(110%)' },
  { name: 'vintage', label: 'Vintage', class: 'sepia contrast-125 brightness-90', cssFilter: 'sepia(50%) contrast(125%) brightness(90%) saturate(80%)' },
  { name: 'warm', label: 'Warm', class: '', cssFilter: 'sepia(30%) saturate(140%) hue-rotate(-10deg)' },
];

// Memoized PhotoGrid component to prevent re-renders when parent state (like countdown) changes
const PhotoGrid = React.memo(({ photos }: { photos: Photo[] }) => {
  return (
    <div className="flex-1 grid grid-cols-2 gap-3 p-2 overflow-y-auto max-h-[600px] custom-scrollbar relative z-10">
      {photos.length === 0 ? (
        <div className="col-span-2 h-64 flex flex-col items-center justify-center text-gray-400 font-mono text-center p-4 border-2 border-dashed border-gray-300 rounded-lg">
          <p>No photos yet.</p>
          <p className="text-sm mt-2">Take 4 shots!</p>
        </div>
      ) : (
        photos.map((photo) => (
          <div key={photo.id} className="relative bg-white p-1.5 shadow-sm transform transition-transform hover:scale-[1.02]">
            <img 
              src={photo.dataUrl} 
              alt="Capture" 
              loading="lazy"
              className="w-full h-auto filter-none block border border-gray-200" 
            />
          </div>
        ))
      )}
    </div>
  );
});

const App: React.FC = () => {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [selectedFilter, setSelectedFilter] = useState<FilterConfig>(FILTERS[0]);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [generatedCaption, setGeneratedCaption] = useState<string>('');
  const [isGeneratingCaption, setIsGeneratingCaption] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Initialize Camera
  useEffect(() => {
    const startCamera = async () => {
      try {
        // Lower resolution (QVGA) for retro feel, much better performance, and to avoid timeouts
        // Limiting framerate also helps significantly with "lag"
        const constraints = { 
          video: { 
            width: { ideal: 320 }, 
            height: { ideal: 240 },
            frameRate: { ideal: 24, max: 30 },
            facingMode: "user" 
          },
          audio: false 
        };

        let mediaStream;
        try {
          mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
        } catch (e) {
          console.warn("Specific constraints failed, trying basic config", e);
          // Fallback to basic constraints if the specific ones fail/timeout
          mediaStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        }
        
        setStream(mediaStream);
        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
        }
      } catch (err) {
        console.error("Error accessing camera:", err);
        alert("Could not access camera. Please check permissions and ensure another app isn't using it.");
      }
    };

    startCamera();

    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  const takePhoto = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d', { alpha: false }); // Optimize for no alpha channel

    if (!ctx) return;

    // Set canvas dimensions to match video
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    // Draw filter background if needed (e.g. for sepia tinting base)
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Apply filters
    ctx.filter = selectedFilter.cssFilter;
    
    // Draw video frame
    // Mirror the image to feel like a mirror
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    ctx.setTransform(1, 0, 0, 1, 0, 0); // Reset transform

    // Add grain/noise overlay via canvas operations for baked-in retro feel
    // Optimized loop for performance
    if (selectedFilter.name !== 'normal') {
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;
        const len = data.length;
        // Optimization: Use a smaller noise buffer or just iterate simply
        for (let i = 0; i < len; i += 4) {
            // Simplified noise calculation
            const noise = (Math.random() * 20) - 10;
            data[i] = data[i] + noise;
            data[i + 1] = data[i + 1] + noise;
            data[i + 2] = data[i + 2] + noise;
        }
        ctx.putImageData(imageData, 0, 0);
    }

    const dataUrl = canvas.toDataURL('image/png');
    const newPhoto: Photo = {
      id: Date.now().toString(),
      dataUrl,
      timestamp: Date.now(),
      filter: selectedFilter.name
    };

    setPhotos(prev => [...prev, newPhoto]);
  }, [selectedFilter]);

  const startCountdown = () => {
    if (isCapturing) return;
    setIsCapturing(true);
    let count = 3;
    setCountdown(count);

    const timer = setInterval(() => {
      count--;
      if (count > 0) {
        setCountdown(count);
      } else {
        clearInterval(timer);
        setCountdown(null);
        takePhoto();
        setIsCapturing(false);
      }
    }, 1000);
  };

  const clearPhotos = useCallback(() => {
    setPhotos([]);
    setGeneratedCaption('');
  }, []);

  const handleGenerateCaption = async () => {
    if (photos.length === 0) return;
    setIsGeneratingCaption(true);
    // Use the last photo for context
    const caption = await generateVintageCaption(photos[photos.length - 1].dataUrl);
    setGeneratedCaption(caption);
    setIsGeneratingCaption(false);
  };

  const downloadPhotoStrip = () => {
    const stripCanvas = document.createElement('canvas');
    const ctx = stripCanvas.getContext('2d');
    if (!ctx) return;

    // Config for 2-column layout (approx 4 photos total visual style)
    const cols = 2;
    const photoWidth = 300;
    const photoHeight = 225; // 4:3 Aspect
    const gap = 20;
    const padding = 40;
    const bottomLabelHeight = 150;
    
    // Calculate rows needed
    const rows = Math.ceil(photos.length / cols) || 2; // Default to at least space for 2 rows if empty/small

    const contentWidth = (cols * photoWidth) + ((cols - 1) * gap);
    const contentHeight = (rows * photoHeight) + ((rows - 1) * gap);
    
    stripCanvas.width = contentWidth + (padding * 2);
    stripCanvas.height = contentHeight + (padding * 2) + bottomLabelHeight;

    // Draw background (Paper texture color)
    ctx.fillStyle = '#fdfbf7';
    ctx.fillRect(0, 0, stripCanvas.width, stripCanvas.height);
    
    // Add subtle texture to base background
    ctx.fillStyle = 'rgba(0,0,0,0.03)';
    for(let i=0; i<stripCanvas.width; i+=4) {
        for(let j=0; j<stripCanvas.height; j+=4) {
            if(Math.random() > 0.5) ctx.fillRect(i, j, 2, 2);
        }
    }

    // Draw Photos in Grid
    photos.forEach((photo, index) => {
      const col = index % cols;
      const row = Math.floor(index / cols);

      const x = padding + (col * (photoWidth + gap));
      const y = padding + (row * (photoHeight + gap));

      const img = new Image();
      img.src = photo.dataUrl;
      
      // Draw photo container shadow
      ctx.fillStyle = 'rgba(0,0,0,0.1)';
      ctx.fillRect(x + 4, y + 4, photoWidth, photoHeight);
      
      // Draw Image
      ctx.drawImage(img, x, y, photoWidth, photoHeight);
      
      // Draw border
      ctx.strokeStyle = '#333';
      ctx.lineWidth = 1;
      ctx.strokeRect(x, y, photoWidth, photoHeight);
    });

    // Draw Caption/Label at bottom
    ctx.fillStyle = '#222';
    ctx.font = '30px "Courier New", monospace';
    ctx.textAlign = 'center';
    
    const dateStr = new Date().toLocaleDateString();
    ctx.fillText(dateStr, stripCanvas.width / 2, stripCanvas.height - 100);

    if (generatedCaption) {
        ctx.font = 'italic 24px "Courier New", monospace';
        ctx.fillStyle = '#555';
        // Simple word wrap
        const words = generatedCaption.split(' ');
        let line = '';
        let y = stripCanvas.height - 60;
        
        for(let n = 0; n < words.length; n++) {
          const testLine = line + words[n] + ' ';
          const metrics = ctx.measureText(testLine);
          if (metrics.width > stripCanvas.width - 60 && n > 0) {
            ctx.fillText(line, stripCanvas.width / 2, y);
            line = words[n] + ' ';
            y += 30;
          }
          else {
            line = testLine;
          }
        }
        ctx.fillText(line, stripCanvas.width / 2, y);
    }

    // Apply Vintage Overlay to final canvas
    ctx.save();
    ctx.globalCompositeOperation = 'multiply';
    
    // Vignette
    const gradient = ctx.createRadialGradient(
      stripCanvas.width / 2, stripCanvas.height / 2, stripCanvas.width * 0.2,
      stripCanvas.width / 2, stripCanvas.height / 2, stripCanvas.width * 0.8
    );
    gradient.addColorStop(0, 'rgba(255, 245, 230, 0.1)');
    gradient.addColorStop(1, 'rgba(139, 115, 85, 0.3)');
    
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, stripCanvas.width, stripCanvas.height);
    
    // Noise simulation
    ctx.globalAlpha = 0.05;
    ctx.fillStyle = '#000';
    for(let i=0; i<stripCanvas.width; i+=4) {
       for(let j=0; j<stripCanvas.height; j+=4) {
          if(Math.random() > 0.5) ctx.fillRect(i, j, 2, 2);
       }
    }
    
    ctx.restore();

    // Trigger download
    const link = document.createElement('a');
    link.download = `retro-booth-${Date.now()}.png`;
    link.href = stripCanvas.toDataURL();
    link.click();
  };

  return (
    <div className="min-h-screen bg-neutral-900 text-gray-100 flex flex-col items-center justify-center p-4 relative overflow-hidden">
      
      {/* Background Decor */}
      <div className="absolute top-0 left-0 w-full h-full opacity-10 pointer-events-none" 
           style={{ backgroundImage: 'radial-gradient(circle, #444 1px, transparent 1px)', backgroundSize: '20px 20px' }}>
      </div>

      <header className="mb-4 z-10 text-center relative">
        <h1 className="text-6xl text-transparent bg-clip-text bg-gradient-to-r from-pink-500 via-purple-500 to-cyan-500 font-typewriter font-bold tracking-widest drop-shadow-[2px_2px_0_rgba(255,255,255,0.2)]">
          RETRO.BOOTH
        </h1>
        <p className="font-mono text-pink-400 text-sm tracking-widest mt-2 uppercase">v1.1 // Whispers </p>
      </header>

      <div className="w-full max-w-7xl flex flex-col lg:flex-row gap-8 z-10 items-start justify-center">
        
        {/* Main Interface: Camera */}
        <div className="flex-1 flex flex-col items-center relative w-full">
          <div className="relative bg-neutral-800 p-4 rounded-sm shadow-2xl border-b-8 border-r-8 border-neutral-950 w-full max-w-md">
            
            {/* Camera Frame Decoration */}
            <div className="absolute top-2 left-1/2 -translate-x-1/2 text-neutral-500 text-xs font-mono tracking-widest">LENS: 35MM F/2.8</div>
            <div className="absolute top-2 right-4 flex gap-1">
                <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></div>
                <div className="text-[10px] text-red-500 font-mono">REC</div>
            </div>

            <div className="relative overflow-hidden bg-black aspect-video rounded-sm border-2 border-neutral-700 shadow-inner group">
              <video 
                ref={videoRef}
                autoPlay 
                muted 
                playsInline
                className={`w-full h-full object-cover transform -scale-x-100 will-change-transform ${FILTERS.find(f => f.name === selectedFilter.name)?.class}`}
                style={{ filter: FILTERS.find(f => f.name === selectedFilter.name)?.cssFilter }}
              />
              <canvas ref={canvasRef} className="hidden" />
              
              {/* Scanlines Overlay */}
              <div className="scanlines opacity-30"></div>
              
              {/* Countdown Overlay */}
              {countdown !== null && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/20 backdrop-blur-sm z-20">
                  <span className="text-9xl font-bold text-white font-mono animate-ping">{countdown}</span>
                </div>
              )}
            </div>

            {/* Controls */}
            <div className="mt-4 flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="flex gap-2 overflow-x-auto pb-2 w-full md:w-auto px-2 custom-scrollbar">
                 {FILTERS.map(filter => (
                   <button
                    key={filter.name}
                    onClick={() => setSelectedFilter(filter)}
                    className={`px-2 py-1 text-xs font-mono border-2 transition-all whitespace-nowrap ${selectedFilter.name === filter.name ? 'border-pink-500 text-pink-500 bg-pink-500/10' : 'border-neutral-600 text-neutral-400 hover:border-neutral-400'}`}
                   >
                     {filter.label}
                   </button>
                 ))}
              </div>
              
              <button 
                onClick={startCountdown}
                disabled={isCapturing}
                className="w-14 h-14 rounded-full bg-red-600 border-4 border-neutral-800 shadow-[0_0_0_2px_#ef4444] active:scale-95 transition-transform flex items-center justify-center hover:bg-red-500 disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
                title="Snap Photo"
              >
                <div className="w-10 h-10 rounded-full border border-white/20"></div>
              </button>
            </div>
          </div>
        </div>

        {/* Output Strip / Gallery */}
        <div className="w-full lg:w-[32rem] flex flex-col gap-6">
          <div className="bg-[#f4f1ea] p-4 pt-12 relative shadow-xl transform rotate-1 transition-transform hover:rotate-0 min-h-[500px] flex flex-col">
            
            {/* Vintage Overlay on UI */}
            <div className="vintage-overlay"></div>

            <Suspense fallback={<div className="h-8 w-24 bg-gray-200/20 animate-pulse absolute top-0 left-1/2 -translate-x-1/2"></div>}>
              <Tape variant="top" className="left-1/2 -translate-x-1/2 -top-4" />
            </Suspense>
            
            <h2 className="text-gray-800 font-typewriter text-2xl text-center mb-4 border-b-2 border-gray-300 pb-2 relative z-10">
              PHOTO STRIP
            </h2>

            {/* Photos List - Memoized Grid */}
            <PhotoGrid photos={photos} />

            {/* Generated Caption Area */}
            {photos.length > 0 && (
              <div className="mt-6 border-t-2 border-gray-300 pt-4 relative z-10">
                 <div className="bg-gray-100/50 p-3 rounded font-typewriter text-gray-700 text-center min-h-[3rem] flex items-center justify-center relative backdrop-blur-sm">
                    {isGeneratingCaption ? (
                        <span className="animate-pulse">Consulting the AI spirits...</span>
                    ) : generatedCaption ? (
                        <p>"{generatedCaption}"</p>
                    ) : (
                        <button 
                            onClick={handleGenerateCaption}
                            className="text-sm underline text-blue-600 hover:text-blue-800"
                        >
                            Generate Vibe Check ✨
                        </button>
                    )}
                 </div>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex justify-center gap-6 mt-4">
             {photos.length > 0 && (
                 <>
                    <Suspense fallback={<div className="w-32 h-32 bg-gray-700/50 rounded-md animate-pulse"></div>}>
                      <FloppyDisk 
                          color="pink" 
                          label="SAVE STRIP" 
                          onClick={downloadPhotoStrip}
                      />
                    </Suspense>
                     <button 
                        onClick={clearPhotos}
                        className="group relative w-20 h-20 bg-neutral-800 rounded-lg border-b-4 border-r-4 border-black/50 active:border-0 active:translate-y-1 active:translate-x-1 transition-all flex flex-col items-center justify-center text-red-500 hover:text-red-400"
                        title="Clear All"
                    >
                        <span className="text-3xl">🗑️</span>
                        <span className="text-[10px] font-mono mt-1">RESET</span>
                    </button>
                 </>
             )}
          </div>
        </div>
      </div>
      
      {/* Footer info */}
      <footer className="mt-8 text-neutral-600 font-mono text-xs z-10 text-center">
        <p>USE THE MOUSE TO INTERACT.</p>
      </footer>
    </div>
  );
};

export default App;
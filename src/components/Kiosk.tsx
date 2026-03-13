import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Mic, MicOff, Heart, User, Calendar, MapPin, CheckCircle2, AlertCircle, Volume2, VolumeX } from 'lucide-react';
import { LiveSessionManager, Caption } from '../lib/gemini';
import { useVoiceUi } from '../hooks/useVoiceUi';

export default function Kiosk() {
  const { ui, handleUiState } = useVoiceUi();
  const [status, setStatus] = useState<'idle' | 'connecting' | 'listening' | 'error'>('idle');
  const [captions, setCaptions] = useState<Caption[]>([]);
  const [isStarted, setIsStarted] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const sessionManager = useRef<LiveSessionManager | null>(null);
  const captionsEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    captionsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [captions]);

  const handleStart = async () => {
    setIsStarted(true);
    const manager = new LiveSessionManager(
      process.env.GEMINI_API_KEY!,
      (caption) => {
        setCaptions(prev => [...prev, caption]);
      },
      (newStatus) => {
        if (newStatus === 'Connecting...') setStatus('connecting');
        else if (newStatus === 'Listening') setStatus('listening');
        else if (newStatus === 'Error' || newStatus === 'Failed to connect') {
          setStatus('error');
          handleUiState('ERROR');
        }
        else if (newStatus === 'Disconnected') setStatus('idle');
      },
      (uiState) => {
        handleUiState(uiState);
      }
    );
    sessionManager.current = manager;
    await manager.start();
  };

  const toggleMute = () => {
    if (sessionManager.current) {
      const muted = sessionManager.current.toggleMute();
      setIsMuted(muted);
    }
  };

  // Screen Components
  const GreetingScreen = () => (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-8">
      <div className="space-y-4">
        <h2 className="text-4xl font-light text-[#1a1a1a] leading-tight">
          Welcome to your <br />
          <span className="italic">hands-free</span> check-in.
        </h2>
        <p className="text-[#5A5A40]/70 text-lg">Tap the mic to begin your private session.</p>
      </div>
      <button onClick={handleStart} className="w-24 h-24 bg-[#5A5A40] rounded-full flex items-center justify-center hover:scale-105 transition-transform cursor-pointer shadow-lg mx-auto">
        <Mic className="text-white w-8 h-8" />
      </button>
    </motion.div>
  );

  const ListeningScreen = () => (
    <div className="w-full space-y-8">
      <div className="flex flex-col items-center gap-4">
        <div className="relative">
          <motion.div 
            animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.6, 0.3] }}
            transition={{ repeat: Infinity, duration: 2 }}
            className="absolute inset-0 bg-[#5A5A40] rounded-full"
          />
          <div className="relative w-20 h-20 rounded-full flex items-center justify-center bg-[#5A5A40]">
            <Mic className="text-white w-8 h-8" />
          </div>
        </div>
        <p className="text-sm uppercase tracking-[0.2em] font-sans font-semibold text-[#5A5A40]">Listening...</p>
      </div>
      <div className="grid grid-cols-2 gap-6 text-left">
        <div className="p-6 bg-white/50 rounded-3xl space-y-2 border border-black/5">
          <User className="w-5 h-5 text-[#5A5A40]" />
          <p className="text-xs uppercase tracking-wider font-sans font-bold text-[#5A5A40]/60">Step 1</p>
          <p className="text-sm font-medium">State your full legal name</p>
        </div>
        <div className="p-6 bg-white/50 rounded-3xl space-y-2 border border-black/5">
          <Calendar className="w-5 h-5 text-[#5A5A40]" />
          <p className="text-xs uppercase tracking-wider font-sans font-bold text-[#5A5A40]/60">Step 2</p>
          <p className="text-sm font-medium">State your date of birth</p>
        </div>
      </div>
    </div>
  );

  const VerifyScreen = () => (
    <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="w-full space-y-6">
      <div className="p-8 bg-white rounded-3xl shadow-xl shadow-black/5 border border-black/5 text-left space-y-6">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-blue-100 rounded-2xl flex items-center justify-center">
            <User className="text-blue-600 w-6 h-6" />
          </div>
          <div>
            <h3 className="text-xl font-medium">Verifying Identity</h3>
            <p className="text-sm text-gray-500">Please confirm your details</p>
          </div>
        </div>
        <div className="space-y-4">
          <div className="flex justify-between items-center py-3 border-b border-gray-100">
            <span className="text-gray-500">Status</span>
            <span className="font-medium text-blue-600">Appointment Found</span>
          </div>
          <p className="text-center italic text-gray-600">"Shall I check you in now?"</p>
        </div>
      </div>
    </motion.div>
  );

  const CheckedInScreen = () => (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col items-center space-y-6">
      <div className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center">
        <CheckCircle2 className="text-green-600 w-12 h-12" />
      </div>
      <div className="space-y-2">
        <h2 className="text-3xl font-medium">You're all set!</h2>
        <p className="text-gray-500">Please proceed to the reception desk.</p>
      </div>
    </motion.div>
  );

  const ErrorScreen = () => (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center space-y-6">
      <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center">
        <AlertCircle className="text-red-600 w-10 h-10" />
      </div>
      <div className="space-y-2">
        <h2 className="text-2xl font-medium">Something went wrong</h2>
        <p className="text-gray-500">Please see the front desk for assistance.</p>
      </div>
      <button onClick={() => window.location.reload()} className="px-6 py-2 bg-[#5A5A40] text-white rounded-full font-medium">
        Try Again
      </button>
    </motion.div>
  );

  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      setCaptions(prev => prev.filter(c => now - c.timestamp < 3000));
    }, 500);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 font-serif">
      {/* Header */}
      <motion.div 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="absolute top-12 flex items-center justify-between w-full max-w-2xl px-6"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-[#5A5A40] rounded-full flex items-center justify-center">
            <Heart className="text-white w-5 h-5" />
          </div>
          <h1 className="text-2xl font-medium text-[#1a1a1a] tracking-tight">ZeroWait Health</h1>
        </div>

        {isStarted && (
          <button 
            onClick={toggleMute}
            className="p-3 bg-white/80 backdrop-blur rounded-full shadow-sm hover:bg-white transition-colors border border-black/5"
          >
            {isMuted ? <VolumeX className="w-5 h-5 text-red-500" /> : <Volume2 className="w-5 h-5 text-[#5A5A40]" />}
          </button>
        )}
      </motion.div>

      {/* Main Kiosk Area */}
      <div className="w-full max-w-2xl bg-white/80 backdrop-blur-md rounded-[40px] shadow-2xl shadow-black/5 p-12 flex flex-col items-center text-center relative overflow-hidden border border-white/20">
        
        <AnimatePresence mode="wait">
          {ui === "GREETING" && !isStarted && <GreetingScreen key="greeting" />}
          {ui === "GREETING" && isStarted && (
            <div key="connecting" className="flex flex-col items-center gap-4">
               <div className="w-12 h-12 border-4 border-[#5A5A40]/20 border-t-[#5A5A40] rounded-full animate-spin" />
               <p className="text-[#5A5A40]/70">Initializing secure session...</p>
            </div>
          )}
          {ui === "LISTENING" && <ListeningScreen key="listening" />}
          {ui === "VERIFY" && <VerifyScreen key="verify" />}
          {ui === "CHECKED_IN" && <CheckedInScreen key="checked-in" />}
          {ui === "ERROR" && <ErrorScreen key="error" />}
        </AnimatePresence>

        {/* Persistent Captions Area */}
        {isStarted && (
          <div className="w-full mt-12 pt-8 border-t border-black/5">
            <div className="h-48 overflow-y-auto pr-2 space-y-4 scrollbar-hide">
              <AnimatePresence mode="popLayout">
                {captions.map((caption, idx) => (
                  <motion.div
                    key={`${caption.timestamp}-${idx}`}
                    initial={{ opacity: 0, x: caption.isUser ? 20 : -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    className={`flex ${caption.isUser ? 'justify-end' : 'justify-start'}`}
                  >
                    <div className={`max-w-[80%] px-5 py-3 rounded-2xl text-base ${
                      caption.isUser 
                        ? 'bg-[#5A5A40] text-white rounded-tr-none' 
                        : 'bg-white text-[#1a1a1a] border border-black/5 rounded-tl-none shadow-sm'
                    }`}>
                      {caption.text}
                    </div>
                  </motion.div>
                ))}
                <div ref={captionsEndRef} />
              </AnimatePresence>
            </div>
          </div>
        )}

        {/* Decorative elements */}
        <div className="absolute -bottom-12 -right-12 w-48 h-48 bg-[#5A5A40]/5 rounded-full blur-3xl" />
        <div className="absolute -top-12 -left-12 w-48 h-48 bg-[#5A5A40]/5 rounded-full blur-3xl" />
      </div>

      {/* Footer Info */}
      <div className="mt-12 flex flex-wrap justify-center gap-8 text-[#5A5A40]/50 text-[10px] uppercase tracking-[0.2em] font-sans font-bold">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="w-3 h-3" />
          HIPAA Compliant
        </div>
        <div className="flex items-center gap-2">
          <CheckCircle2 className="w-3 h-3" />
          Zero Data Retention
        </div>
        <div className="flex items-center gap-2">
          <CheckCircle2 className="w-3 h-3" />
          Secure TLS 1.3
        </div>
      </div>
    </div>
  );
}

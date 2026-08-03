import { motion } from 'framer-motion';
import { sceneTransitions, springs } from '@/lib/video';
import { useEffect, useState } from 'react';

export function Scene4() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 300),
      setTimeout(() => setPhase(2), 1000),
      setTimeout(() => setPhase(3), 1600),
      setTimeout(() => setPhase(4), 2200),
    ];
    return () => timers.forEach(clearTimeout);
  }, []);

  return (
    <motion.div
      className="absolute inset-0 z-10 flex flex-col items-center justify-center"
      {...sceneTransitions.splitHorizontal}
    >
      <div className="absolute top-16 text-center flex flex-col items-center z-30">
        <motion.div
          className="text-7xl font-display font-bold text-[var(--color-primary)] uppercase tracking-wide"
          initial={{ opacity: 0, y: -30 }}
          animate={{ opacity: phase >= 1 ? 1 : 0, y: phase >= 1 ? 0 : -30 }}
          transition={{ duration: 0.8, ease: 'circOut' }}
        >
          Form your <span className="text-[var(--color-accent)]">Tribe</span>
        </motion.div>
        
        <motion.div
          className="text-3xl font-body text-[var(--color-secondary)] mt-4"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: phase >= 2 ? 1 : 0, scale: phase >= 2 ? 1 : 0.9 }}
          transition={{ duration: 0.8, ease: 'circOut' }}
        >
          Climb the leaderboard. Trash talk in the chat.
        </motion.div>
      </div>

      <div className="flex gap-16 mt-32 relative z-20 items-center justify-center">
        {/* Phone 1: Chat */}
        <motion.div 
          className="relative perspective-1000 w-[360px] -rotate-6"
          initial={{ opacity: 0, y: 100, rotateZ: -20, scale: 0.8 }}
          animate={{ 
            opacity: phase >= 3 ? 1 : 0, 
            y: phase >= 3 ? 0 : 100, 
            rotateZ: phase >= 3 ? -6 : -20, 
            scale: phase >= 3 ? 1 : 0.8 
          }}
          transition={{ ...springs.poppy, duration: 1 }}
        >
          <div className="rounded-[2.5rem] overflow-hidden border-[10px] border-[#1b261d] shadow-2xl bg-white">
            <img 
              src={`${import.meta.env.BASE_URL}images/chat.jpg`}
              className="w-full h-auto object-cover"
              alt="Chat"
            />
          </div>
        </motion.div>

        {/* Phone 2: Leaderboard */}
        <motion.div 
          className="relative perspective-1000 w-[380px] rotate-3 z-10"
          initial={{ opacity: 0, y: 100, rotateZ: 20, scale: 0.8 }}
          animate={{ 
            opacity: phase >= 4 ? 1 : 0, 
            y: phase >= 4 ? -20 : 100, 
            rotateZ: phase >= 4 ? 3 : 20, 
            scale: phase >= 4 ? 1.1 : 0.8 
          }}
          transition={{ ...springs.poppy, duration: 1 }}
        >
          <div className="rounded-[2.5rem] overflow-hidden border-[10px] border-[#1b261d] shadow-2xl bg-white">
            <img 
              src={`${import.meta.env.BASE_URL}images/leaderboard.jpg`}
              className="w-full h-auto object-cover"
              alt="Leaderboard"
            />
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
}

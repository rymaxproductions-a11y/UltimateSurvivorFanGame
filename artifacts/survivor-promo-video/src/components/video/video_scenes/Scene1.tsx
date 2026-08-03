import { motion } from 'framer-motion';
import { sceneTransitions, springs } from '@/lib/video';
import { useEffect, useState } from 'react';

export function Scene1() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 800), // Outwit
      setTimeout(() => setPhase(2), 1600), // Outplay
      setTimeout(() => setPhase(3), 2400), // Outlast
      setTimeout(() => setPhase(4), 3800), // With your friends
    ];
    return () => timers.forEach(clearTimeout);
  }, []);

  return (
    <motion.div
      className="absolute inset-0 z-10 flex flex-col items-center justify-center pt-10"
      {...sceneTransitions.zoomThrough}
    >
      <motion.img
        src={`${import.meta.env.BASE_URL}images/logo.png`}
        className="w-[500px] object-contain drop-shadow-[0_10px_30px_rgba(0,0,0,0.8)]"
        initial={{ opacity: 0, scale: 0.8, y: 50 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ ...springs.smooth, duration: 1.5 }}
      />
      
      <div className="mt-8 flex gap-6 text-6xl font-display font-bold text-white tracking-widest text-shadow-strong">
        <motion.span
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: phase >= 1 ? 1 : 0, x: phase >= 1 ? 0 : -20 }}
          transition={{ duration: 0.5, ease: 'circOut' }}
          className="text-[var(--color-accent)]"
        >
          OUTWIT.
        </motion.span>
        <motion.span
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: phase >= 2 ? 1 : 0, y: phase >= 2 ? 0 : 20 }}
          transition={{ duration: 0.5, ease: 'circOut' }}
        >
          OUTPLAY.
        </motion.span>
        <motion.span
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: phase >= 3 ? 1 : 0, x: phase >= 3 ? 0 : 20 }}
          transition={{ duration: 0.5, ease: 'circOut' }}
        >
          OUTLAST.
        </motion.span>
      </div>

      <motion.div
        className="mt-6 text-4xl font-body font-medium text-white/90 tracking-widest text-shadow-strong"
        initial={{ opacity: 0, scale: 0.9, filter: 'blur(10px)' }}
        animate={{ 
          opacity: phase >= 4 ? 1 : 0, 
          scale: phase >= 4 ? 1 : 0.9,
          filter: phase >= 4 ? 'blur(0px)' : 'blur(10px)' 
        }}
        transition={{ duration: 1, ease: 'circOut' }}
      >
        WITH YOUR FRIENDS.
      </motion.div>
    </motion.div>
  );
}

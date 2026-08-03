import { motion } from 'framer-motion';
import { sceneTransitions, springs } from '@/lib/video';
import { useEffect, useState } from 'react';

export function Scene5() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 500),
      setTimeout(() => setPhase(2), 1500),
      setTimeout(() => setPhase(3), 2500),
    ];
    return () => timers.forEach(clearTimeout);
  }, []);

  return (
    <motion.div
      className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-black/40"
      {...sceneTransitions.fadeBlur}
    >
      <motion.img
        src={`${import.meta.env.BASE_URL}images/logo.png`}
        className="w-[600px] object-contain drop-shadow-[0_10px_30px_rgba(0,0,0,0.8)]"
        initial={{ opacity: 0, scale: 0.5, filter: 'blur(20px)' }}
        animate={{ 
          opacity: 1, 
          scale: 1, 
          filter: 'blur(0px)' 
        }}
        transition={{ duration: 1.5, ease: 'circOut' }}
      />

      <motion.div
        className="mt-12 text-5xl font-display text-white tracking-widest text-shadow-strong uppercase"
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: phase >= 1 ? 1 : 0, y: phase >= 1 ? 0 : 30 }}
        transition={{ duration: 0.8, ease: 'circOut' }}
      >
        The Ultimate Fan Experience
      </motion.div>

      <motion.div
        className="mt-8 bg-[var(--color-accent)] text-[var(--color-text-primary)] font-display text-4xl px-12 py-4 rounded-xl shadow-[0_0_40px_rgba(240,157,67,0.4)]"
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ 
          opacity: phase >= 2 ? 1 : 0, 
          scale: phase >= 2 ? 1 : 0.8 
        }}
        transition={springs.bouncy}
        whileInView={{
          scale: phase >= 2 ? [1, 1.05, 1] : 1,
          transition: { repeat: Infinity, duration: 2, repeatDelay: 1 }
        }}
      >
        PLAY NOW
      </motion.div>
    </motion.div>
  );
}

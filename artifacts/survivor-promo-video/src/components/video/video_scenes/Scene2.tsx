import { motion } from 'framer-motion';
import { sceneTransitions, springs } from '@/lib/video';
import { useEffect, useState } from 'react';

export function Scene2() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 500),
      setTimeout(() => setPhase(2), 1500),
      setTimeout(() => setPhase(3), 2200),
    ];
    return () => timers.forEach(clearTimeout);
  }, []);

  return (
    <motion.div
      className="absolute inset-0 z-10 flex items-center justify-between px-32"
      {...sceneTransitions.wipe}
    >
      <div className="flex flex-col gap-6 max-w-2xl relative z-20">
        <motion.div
          className="text-8xl font-display font-bold text-[var(--color-primary)] leading-[0.85] tracking-tight uppercase"
          initial={{ opacity: 0, x: -50 }}
          animate={{ opacity: phase >= 1 ? 1 : 0, x: phase >= 1 ? 0 : -50 }}
          transition={{ duration: 0.8, ease: 'circOut' }}
        >
          Lock In<br/>
          <span className="text-[var(--color-accent)]">Your Picks</span>
        </motion.div>
        
        <motion.p
          className="text-3xl font-body text-[var(--color-secondary)] max-w-xl"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: phase >= 2 ? 1 : 0, y: phase >= 2 ? 0 : 20 }}
          transition={{ duration: 0.8, ease: 'circOut' }}
        >
          Draft your winner before the premiere. 
          Will your survivor make it to the final three?
        </motion.p>
      </div>

      <motion.div 
        className="relative perspective-1000 w-[450px]"
        initial={{ opacity: 0, x: 100, rotateY: 30, scale: 0.8 }}
        animate={{ 
          opacity: 1, 
          x: 0, 
          rotateY: -15, 
          scale: 1,
          y: phase >= 3 ? -10 : 0
        }}
        transition={{ 
          ...springs.smooth, 
          duration: 1.5,
          y: {
            repeat: Infinity,
            repeatType: 'reverse',
            duration: 3,
            ease: 'easeInOut'
          }
        }}
      >
        <div className="rounded-[3rem] overflow-hidden border-[12px] border-[#1b261d] shadow-[30px_30px_60px_rgba(0,0,0,0.3)] bg-white">
          <img 
            src={`${import.meta.env.BASE_URL}images/picks.jpg`}
            className="w-full h-auto object-cover"
            alt="Picks"
          />
        </div>
        
        {/* Floating Accent Element */}
        <motion.div
          className="absolute -bottom-10 -left-20 bg-[var(--color-accent)] text-white font-display text-4xl px-8 py-4 rounded-xl shadow-2xl -rotate-6"
          initial={{ opacity: 0, scale: 0, y: 50 }}
          animate={{ opacity: phase >= 3 ? 1 : 0, scale: phase >= 3 ? 1 : 0, y: phase >= 3 ? 0 : 50 }}
          transition={springs.bouncy}
        >
          100 POINTS
        </motion.div>
      </motion.div>
    </motion.div>
  );
}

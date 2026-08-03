import { motion } from 'framer-motion';
import { sceneTransitions, springs } from '@/lib/video';
import { useEffect, useState } from 'react';

export function Scene3() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 400),
      setTimeout(() => setPhase(2), 1200),
      setTimeout(() => setPhase(3), 2000),
    ];
    return () => timers.forEach(clearTimeout);
  }, []);

  return (
    <motion.div
      className="absolute inset-0 z-10 flex items-center justify-between px-32"
      {...sceneTransitions.clipPolygon}
    >
      <motion.div 
        className="relative perspective-1000 w-[450px] z-10"
        initial={{ opacity: 0, x: -100, rotateY: -30, scale: 0.8 }}
        animate={{ 
          opacity: 1, 
          x: 0, 
          rotateY: 15, 
          scale: 1,
          y: phase >= 3 ? 15 : 0
        }}
        transition={{ 
          ...springs.smooth, 
          duration: 1.5,
          y: {
            repeat: Infinity,
            repeatType: 'reverse',
            duration: 3.5,
            ease: 'easeInOut'
          }
        }}
      >
        <div className="rounded-[3rem] overflow-hidden border-[12px] border-[#1b261d] shadow-[30px_30px_60px_rgba(0,0,0,0.3)] bg-white">
          <img 
            src={`${import.meta.env.BASE_URL}images/dashboard.jpg`}
            className="w-full h-auto object-cover"
            alt="Dashboard"
          />
        </div>
      </motion.div>

      <div className="flex flex-col gap-6 max-w-2xl relative z-20 text-right items-end">
        <motion.div
          className="text-8xl font-display font-bold text-[var(--color-primary)] leading-[0.85] tracking-tight uppercase"
          initial={{ opacity: 0, x: 50 }}
          animate={{ opacity: phase >= 1 ? 1 : 0, x: phase >= 1 ? 0 : 50 }}
          transition={{ duration: 0.8, ease: 'circOut' }}
        >
          Track Every<br/>
          <span className="text-[#10b981]">Episode</span>
        </motion.div>
        
        <motion.p
          className="text-3xl font-body text-[var(--color-secondary)] max-w-lg"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: phase >= 2 ? 1 : 0, y: phase >= 2 ? 0 : 20 }}
          transition={{ duration: 0.8, ease: 'circOut' }}
        >
          Answer weekly questions. Who wins immunity? Who gets voted out? Rack up points all season.
        </motion.p>
      </div>
    </motion.div>
  );
}

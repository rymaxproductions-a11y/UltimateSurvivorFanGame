import { motion } from 'framer-motion';

export function PersistentBackground({ currentScene }: { currentScene: number }) {
  // Scene 0: Intro - Jungle bg visible, dark overlay
  // Scene 1: Picks - Cream bg, jungle blurred
  // Scene 2: Dash - Cream bg
  // Scene 3: Leaderboard - Cream bg
  // Scene 4: Outro - Embers bg, dark overlay

  return (
    <div className="absolute inset-0 z-0 bg-[var(--color-bg-light)] overflow-hidden">
      {/* Jungle Video */}
      <motion.video
        src={`${import.meta.env.BASE_URL}videos/jungle-bg.mp4`}
        autoPlay
        muted
        loop
        playsInline
        className="absolute inset-0 w-full h-full object-cover"
        animate={{
          opacity: currentScene === 4 ? 0 : 1,
          scale: currentScene === 0 ? 1 : 1.1,
          filter: currentScene === 0 ? 'blur(0px) brightness(0.6)' : 'blur(10px) brightness(1.2)',
        }}
        transition={{ duration: 1.5, ease: 'circOut' }}
      />

      {/* Embers Video */}
      <motion.video
        src={`${import.meta.env.BASE_URL}videos/embers-bg.mp4`}
        autoPlay
        muted
        loop
        playsInline
        className="absolute inset-0 w-full h-full object-cover mix-blend-screen"
        animate={{
          opacity: currentScene === 4 || currentScene === 0 ? 0.8 : 0,
        }}
        transition={{ duration: 1.5, ease: 'easeInOut' }}
      />

      {/* Color Overlay for UI scenes */}
      <motion.div
        className="absolute inset-0 bg-[var(--color-bg-light)]"
        animate={{
          opacity: (currentScene > 0 && currentScene < 4) ? 0.85 : 0,
        }}
        transition={{ duration: 1, ease: 'easeInOut' }}
      />
      
      {/* Noise Texture */}
      <div 
        className="absolute inset-0 opacity-[0.03] pointer-events-none mix-blend-overlay"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`
        }}
      />
    </div>
  );
}

export function PersistentElements({ currentScene }: { currentScene: number }) {
  // A persistent logo in the top left during the UI scenes
  return (
    <div className="absolute inset-0 pointer-events-none z-50">
      <motion.img
        src={`${import.meta.env.BASE_URL}images/logo.png`}
        className="absolute top-8 left-10 w-24 object-contain origin-top-left"
        initial={{ opacity: 0, scale: 0 }}
        animate={{
          opacity: (currentScene > 0 && currentScene < 4) ? 1 : 0,
          scale: (currentScene > 0 && currentScene < 4) ? 1 : 0,
          y: (currentScene > 0 && currentScene < 4) ? 0 : -50,
        }}
        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
      />
    </div>
  );
}

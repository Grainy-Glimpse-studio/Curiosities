import React, { useEffect, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { X } from 'lucide-react';

const AboutPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();

  // Get source from navigation state
  const source = (location.state as { from?: string })?.from || 'homepage';

  // Generate stars with stable positions (using seed-based random)
  const stars = useMemo(() => {
    const seed = 12345;
    const pseudoRandom = (n: number) => {
      const x = Math.sin(seed + n) * 10000;
      return x - Math.floor(x);
    };

    return Array.from({ length: 50 }).map((_, i) => ({
      left: `${pseudoRandom(i * 3) * 100}%`,
      top: `${pseudoRandom(i * 3 + 1) * 100}%`,
      width: `${1 + pseudoRandom(i * 3 + 2) * 2}px`,
      height: `${1 + pseudoRandom(i * 3 + 2) * 2}px`,
      opacity: 0.2 + pseudoRandom(i * 5) * 0.3,
    }));
  }, []);

  // Handle navigation back - remember source
  const handleReturn = () => {
    if (source === 'archive') {
      // Return to home with archive open
      navigate('/', { state: { openArchive: true } });
    } else {
      navigate('/');
    }
  };

  // Space key to return
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        e.preventDefault();
        handleReturn();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 2, ease: 'easeInOut' }}
      className="min-h-screen bg-black flex items-center justify-center cursor-auto relative"
    >
      {/* Starfield Background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        {stars.map((star, i) => (
          <div
            key={i}
            className="absolute rounded-full bg-white"
            style={star}
          />
        ))}
      </div>

      {/* Close button */}
      <button
        onClick={handleReturn}
        className="fixed top-8 right-8 p-2 text-white/40 hover:text-white transition-colors z-10"
      >
        <X size={24} />
      </button>

      {/* Content - scrollable */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 1, delay: 0.5 }}
        className="relative z-10 max-w-2xl px-8 py-16 max-h-screen overflow-y-auto"
      >
        {/* Title */}
        <h1
          className="text-4xl md:text-5xl text-white mb-6 tracking-tight text-center"
          style={{ fontFamily: "'LORE', serif" }}
        >
          Ephemera
        </h1>

        <div className="h-px w-24 mx-auto bg-[#903e4f]/50 mb-10" />

        {/* Artist Statement */}
        <div
          className="text-white/70 text-sm leading-relaxed space-y-6 mb-12 text-center"
          style={{ fontFamily: "'Consulate', monospace" }}
        >
          <p className="text-white/50 italic">
            Everything can be generated now.
          </p>

          <p>
            But no one would generate this — a voice murmuring something it never thought worth keeping. Purposeless. Unpolished. Spoken into the air before the mind could stop it. There is no prompt for that. No reason to make it.
          </p>

          <p>
            And yet these are the words that live closest to our inner world.
          </p>

          <div className="h-px w-16 mx-auto bg-white/10 my-8" />

          <p>
            <em>Diane</em> is a virtual recorder — named after the unseen listener in Twin Peaks, the one Agent Cooper spoke to alone, in the dark, without expecting a reply.
          </p>

          <p>
            Open it, and you find yourself inside a night sky. Stars flicker. Speak, and your words begin to surface — fragments appearing and dissolving at their own pace, like thoughts that don't quite finish themselves. You can reach out and catch one before it goes. Click it, and it vanishes from the sky — but somewhere quieter, it's been kept. Underlined. Saved.
          </p>

          <div className="h-px w-16 mx-auto bg-white/10 my-8" />

          <p>
            We perform for each other constantly. Face to face, we speak in pleasantries, in surfaces — the careful language of people who know they are being watched. There are barriers between us, necessary and invisible, and we navigate them without thinking.
          </p>

          <p>
            But something shifts when the audience disappears. Alone with a screen, with a void, with something that doesn't judge — people speak differently. More honestly. More strangely. The words that come out are not the words we prepared.
          </p>

          <div className="h-px w-16 mx-auto bg-white/10 my-8" />

          <p>
            If you choose, you can send me what you caught.
          </p>

          <p>
            Fragments from strangers arrive, accumulate — a chorus of inner weather, spoken by no one in particular. These words seem to mean nothing. But they are the shape of someone's mind at a particular moment, the texture of a consciousness passing through. From these I make things: words read aloud onto magnetic tape, pressed into a printed folio, exposed as cyanotype prints. What began as breath becomes object. The ephemeral, briefly, returns to the world.
          </p>

          <p>
            And perhaps this is what the technology quietly offers — not a replacement for the human voice, but a shelter for it. A place safe enough to murmur. To not perform. To just speak.
          </p>

          <p className="text-white/90">
            This project listens.
          </p>

          <div className="h-px w-16 mx-auto bg-white/10 my-8" />

          <p className="text-white/50 italic text-center">
            Every voice surfaces and dissolves. Every star emerges and fades. Every moment arrives already leaving.
          </p>

          <p className="text-white/50 italic text-center">
            And yet something remains — our hearts of things.
          </p>
        </div>

        {/* Divider */}
        <div className="flex items-center justify-center gap-4 mb-10">
          <div className="h-px w-12 bg-white/20" />
          <span className="text-white/30 text-xs">✦</span>
          <div className="h-px w-12 bg-white/20" />
        </div>

        {/* About Me */}
        <div className="mb-12">
          <h2
            className="text-lg text-white/80 mb-6 tracking-wide text-center"
            style={{ fontFamily: "'LORE', serif" }}
          >
            About Me
          </h2>
          <div
            className="text-white/60 text-sm leading-relaxed space-y-4 text-center"
            style={{ fontFamily: "'Consulate', monospace" }}
          >
            <p>
              I'm an artist and creative technologist exploring the intersection of art and technology. My practice is human-centered — I'm drawn to work that invites participation, collects traces of real people, and turns the private into something collective.
            </p>
            <p>
              Ephemera is one of many projects to come. If you're curious about what I make, you can follow me on X, Xiaohongshu, or GitHub — all as <span className="text-white/80">Grainy Glimpse</span>. As the physical works from this project emerge — tape, print, cyanotype — I'll be sharing them there too.
            </p>
            <p>
              If you'd like to collaborate or just say something, I'm listening.
            </p>
            <p className="text-white/50 text-center mt-6">
              <a
                href="mailto:grainyglimpsestudio@gmail.com"
                className="hover:text-white/80 transition-colors underline underline-offset-4"
              >
                grainyglimpsestudio@gmail.com
              </a>
            </p>
          </div>
        </div>

        {/* Year */}
        <div className="text-white/30 text-xs tracking-widest uppercase text-center pb-8">
          <p>2026</p>
        </div>
      </motion.div>

      {/* Bottom navigation hint */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1, delay: 1.5 }}
        className="fixed bottom-8 left-1/2 transform -translate-x-1/2"
      >
        <span
          className="text-white/30 text-xs tracking-widest uppercase"
          style={{ fontFamily: "'Consulate', monospace" }}
        >
          press space to return
        </span>
      </motion.div>
    </motion.div>
  );
};

export default AboutPage;

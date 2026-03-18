'use client';

import { useRef } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Rocket, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AiMatcher, type AiMatcherRef } from '@/components/ai-matcher';
import { GradientMesh } from './gradient-mesh';

const stagger = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.2, delayChildren: 0.3 } },
};

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.25, 0.1, 0.25, 1] } },
};

const scaleUp = {
  hidden: { opacity: 0, scale: 0.95 },
  visible: { opacity: 1, scale: 1, transition: { duration: 0.4, delay: 1.1, ease: [0.25, 0.1, 0.25, 1] } },
};

// SVG path data for the Hireverse diamond
const DIAMOND_OUTER = 'M1260.11,1059.79h-80.94a115.88,115.88,0,0,0-94.86,49.38l-10,14.23L1052,1155.31a52.2,52.2,0,0,1-85.53,0l-22.36-31.91-10-14.23a115.88,115.88,0,0,0-94.85-49.38h-81a116,116,0,0,0-115.83,115.83v248.76a116,116,0,0,0,115.83,115.83h81a115.88,115.88,0,0,0,94.85-49.38l10-14.23,22.36-31.91a52.2,52.2,0,0,1,85.53,0l22.37,31.91,10,14.23a115.88,115.88,0,0,0,94.86,49.38h80.94a116,116,0,0,0,115.83-115.83V1175.62A116,116,0,0,0,1260.11,1059.79Zm52.23,268.41v96.18a52.28,52.28,0,0,1-52.23,52.22h-80.94a52.21,52.21,0,0,1-42.77-22.27l-32.32-46.14a115.82,115.82,0,0,0-189.75,0L882,1454.35a52.29,52.29,0,0,1-42.76,22.25h-81a52.27,52.27,0,0,1-52.22-52.22V1175.62a52.27,52.27,0,0,1,52.22-52.22h81A52.29,52.29,0,0,1,882,1145.65l32.31,46.14a115.82,115.82,0,0,0,189.75,0l32.32-46.14a52.21,52.21,0,0,1,42.77-22.27h80.94a52.28,52.28,0,0,1,52.23,52.22Z';
const DIAMOND_DOT = 'M1009.21,1256.44a43.56,43.56,0,1,0,43.56,43.56A43.56,43.56,0,0,0,1009.21,1256.44Z';

export function HeroSection() {
  const aiMatcherRef = useRef<AiMatcherRef>(null);

  return (
    <section className="relative py-24 md:py-36 text-center overflow-hidden">
      <GradientMesh />

      <motion.div
        variants={stagger}
        initial="hidden"
        animate="visible"
        className="container mx-auto px-4 md:px-6 max-w-4xl relative z-10"
      >
        {/* Animated logo */}
        <div className="relative mx-auto mb-10 flex h-36 w-36 items-center justify-center">
          {/* Pulsing glow layers */}
          <motion.div
            className="absolute inset-0 rounded-full bg-primary/10 blur-3xl"
            animate={{ opacity: [0.5, 1, 0.5] }}
            transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
          />
          <motion.div
            className="absolute inset-[15%] rounded-full bg-primary/15 blur-2xl"
            animate={{ opacity: [0.6, 1, 0.6] }}
            transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut', delay: 0.5 }}
          />
          <motion.div
            className="absolute inset-[30%] rounded-full bg-primary/20 blur-xl"
            animate={{ opacity: [0.7, 1, 0.7] }}
            transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut', delay: 1 }}
          />

          {/* SVG with path draw animation */}
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="630 1050 760 505"
            className="relative h-24 w-auto"
            aria-hidden="true"
          >
            <motion.path
              d={DIAMOND_OUTER}
              fill="#03b9ff"
              stroke="#03b9ff"
              strokeWidth="3"
              initial={{ pathLength: 0, fillOpacity: 0 }}
              animate={{ pathLength: 1, fillOpacity: 1 }}
              transition={{
                pathLength: { duration: 1.5, ease: 'easeInOut' },
                fillOpacity: { duration: 0.5, delay: 1.2 },
              }}
            />
            <motion.path
              d={DIAMOND_DOT}
              fill="#03b9ff"
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.3, delay: 1.5 }}
              style={{ transformOrigin: '1009px 1300px' }}
            />
          </svg>
        </div>

        {/* Heading */}
        <motion.h1
          variants={fadeUp}
          className="text-5xl font-extrabold tracking-tight sm:text-6xl md:text-7xl leading-[1.1] mb-6"
        >
          Expert work done,{' '}
          <motion.span variants={fadeUp} className="text-primary">
            faster than ever
          </motion.span>
        </motion.h1>

        {/* Subtitle */}
        <motion.p
          variants={fadeUp}
          className="mx-auto max-w-2xl text-lg text-muted-foreground md:text-xl mb-10"
        >
          Describe your project in plain English, and our AI instantly matches you with
          vetted freelancers, decomposes work into parallel microtasks, and delivers
          quality-assured results at unprecedented speed.
        </motion.p>

        {/* CTA buttons */}
        <motion.div
          variants={fadeUp}
          className="flex flex-col sm:flex-row justify-center gap-4 mb-12"
        >
          <Button
            size="lg"
            onClick={() => aiMatcherRef.current?.triggerSubmit()}
            className="shadow-lg shadow-primary/20"
          >
            Start a Project <Rocket className="ml-2 h-5 w-5" />
          </Button>
          <Button size="lg" variant="outline" asChild>
            <Link href="#how-it-works">
              See How It Works <ChevronRight className="ml-2 h-5 w-5" />
            </Link>
          </Button>
        </motion.div>

        {/* AI Matcher Form */}
        <motion.div variants={scaleUp} className="mx-auto max-w-xl">
          <AiMatcher ref={aiMatcherRef} />
        </motion.div>
      </motion.div>
    </section>
  );
}

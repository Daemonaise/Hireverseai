// src/components/landing/hero-section.tsx
'use client';

import { motion } from 'framer-motion';
import { GradientMesh } from './gradient-mesh';
import { ProjectBuilder } from './project-builder';

const stagger = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.15, delayChildren: 0.3 } },
};

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.25, 0.1, 0.25, 1] } },
};

const DIAMOND_OUTER = 'M1260.11,1059.79h-80.94a115.88,115.88,0,0,0-94.86,49.38l-10,14.23L1052,1155.31a52.2,52.2,0,0,1-85.53,0l-22.36-31.91-10-14.23a115.88,115.88,0,0,0-94.85-49.38h-81a116,116,0,0,0-115.83,115.83v248.76a116,116,0,0,0,115.83,115.83h81a115.88,115.88,0,0,0,94.85-49.38l10-14.23,22.36-31.91a52.2,52.2,0,0,1,85.53,0l22.37,31.91,10,14.23a115.88,115.88,0,0,0,94.86,49.38h80.94a116,116,0,0,0,115.83-115.83V1175.62A116,116,0,0,0,1260.11,1059.79Zm52.23,268.41v96.18a52.28,52.28,0,0,1-52.23,52.22h-80.94a52.21,52.21,0,0,1-42.77-22.27l-32.32-46.14a115.82,115.82,0,0,0-189.75,0L882,1454.35a52.29,52.29,0,0,1-42.76,22.25h-81a52.27,52.27,0,0,1-52.22-52.22V1175.62a52.27,52.27,0,0,1,52.22-52.22h81A52.29,52.29,0,0,1,882,1145.65l32.31,46.14a115.82,115.82,0,0,0,189.75,0l32.32-46.14a52.21,52.21,0,0,1,42.77-22.27h80.94a52.28,52.28,0,0,1,52.23,52.22Z';
const DIAMOND_DOT = 'M1009.21,1256.44a43.56,43.56,0,1,0,43.56,43.56A43.56,43.56,0,0,0,1009.21,1256.44Z';

export function HeroSection() {
  return (
    <section className="relative min-h-screen flex items-center overflow-hidden py-16 md:py-24">
      <GradientMesh />

      <div className="container mx-auto px-4 md:px-6 relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          {/* Left  - Copy */}
          <motion.div
            variants={stagger}
            initial="hidden"
            animate="visible"
          >
            {/* Animated logo  - smaller */}
            <div className="relative mb-6 flex h-20 w-20 items-center justify-center">
              <motion.div
                className="absolute inset-0 rounded-full bg-primary/10 blur-2xl"
                animate={{ opacity: [0.5, 1, 0.5] }}
                transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
              />
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="630 1050 760 505"
                className="relative h-14 w-auto"
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

            <motion.h1
              variants={fadeUp}
              className="text-4xl font-extrabold tracking-tight sm:text-5xl lg:text-6xl leading-[1.1] mb-4"
            >
              Expert work done,{' '}
              <span className="text-primary">faster than ever</span>
            </motion.h1>

            <motion.p
              variants={fadeUp}
              className="max-w-lg text-lg text-muted-foreground md:text-xl mb-6"
            >
              Describe your project. AI handles the rest: matching, decomposition,
              quality assurance, delivery.
            </motion.p>

            {/* Trust line */}
            <motion.div
              variants={fadeUp}
              className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-muted-foreground"
            >
              <span><span className="font-semibold text-foreground">500+</span> clients</span>
              <span><span className="font-semibold text-foreground">1,200+</span> freelancers</span>
              <span><span className="font-semibold text-foreground">2,000+</span> projects delivered</span>
            </motion.div>
          </motion.div>

          {/* Right  - Project Builder */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, delay: 0.8, ease: [0.25, 0.1, 0.25, 1] }}
          >
            <ProjectBuilder />
          </motion.div>
        </div>
      </div>
    </section>
  );
}

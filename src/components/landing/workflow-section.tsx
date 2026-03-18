// src/components/landing/workflow-section.tsx
'use client';

import { motion } from 'framer-motion';
import { FileText, BrainCircuit, CheckCircle } from 'lucide-react';

const steps = [
  { icon: FileText, number: '01', title: 'Describe', description: 'Tell us what you need in plain English.' },
  { icon: BrainCircuit, number: '02', title: 'Match & Build', description: 'AI matches freelancers, decomposes work, and kicks off parallel tasks.' },
  { icon: CheckCircle, number: '03', title: 'Deliver', description: 'Quality-checked results, assembled and delivered.' },
];

const cardVariant = {
  hidden: { opacity: 0, scale: 0.85 },
  visible: (i: number) => ({
    opacity: 1,
    scale: 1,
    transition: { duration: 0.5, delay: i * 0.15, ease: [0.25, 0.1, 0.25, 1] },
  }),
};

export function WorkflowSection() {
  return (
    <section id="how-it-works" className="bg-chrome py-16 md:py-20">
      <div className="container mx-auto px-4 md:px-6">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.4 }}
          className="mb-10 text-center"
        >
          <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-primary">
            &#10217; Process
          </p>
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl text-white">
            How it works
          </h2>
        </motion.div>

        {/* Connecting line (desktop) */}
        <div className="hidden lg:block relative mb-6">
          <motion.svg
            viewBox="0 0 1200 20"
            className="w-full h-5"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-40px' }}
          >
            <motion.line
              x1="200" y1="10" x2="1000" y2="10"
              stroke="hsl(197 100% 50%)"
              strokeWidth="2"
              strokeLinecap="round"
              variants={{
                hidden: { pathLength: 0, opacity: 0.3 },
                visible: { pathLength: 1, opacity: 1, transition: { duration: 1.2, ease: 'easeInOut' } },
              }}
            />
            {[200, 600, 1000].map((cx, i) => (
              <motion.circle
                key={i}
                cx={cx}
                cy="10"
                r="5"
                fill="hsl(197 100% 50%)"
                variants={{
                  hidden: { scale: 0, opacity: 0 },
                  visible: {
                    scale: 1,
                    opacity: 1,
                    transition: { delay: (i / 2) * 1.2 + 0.1, duration: 0.3 },
                  },
                }}
              />
            ))}
          </motion.svg>
        </div>

        {/* Step cards */}
        <motion.div
          className="grid grid-cols-1 md:grid-cols-3 gap-4"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-80px' }}
        >
          {steps.map((step, index) => (
            <motion.div
              key={step.title}
              custom={index}
              variants={cardVariant}
              className="group rounded-xl border border-border bg-chrome-muted p-6 transition-all duration-200 hover:border-primary/50 hover:-translate-y-1"
            >
              <p className="text-xs font-bold uppercase tracking-widest text-primary mb-3">
                {step.number}
              </p>
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/15 mb-4 transition-transform duration-200 group-hover:scale-110">
                <step.icon className="h-5 w-5 text-primary" />
              </div>
              <h3 className="text-base font-semibold text-chrome-foreground mb-2">{step.title}</h3>
              <p className="text-sm text-chrome-foreground/60 leading-relaxed">
                {step.description}
              </p>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}

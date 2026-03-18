'use client';

import { motion } from 'framer-motion';
import {
  FileText,
  BrainCircuit,
  Split,
  GanttChart,
  CheckCircle,
  Rocket,
} from 'lucide-react';
import { ScrollReveal } from '@/components/motion/scroll-reveal';

const steps = [
  { icon: FileText, title: 'Submit Your Brief', description: 'Provide your project goals and requirements easily and clearly.' },
  { icon: BrainCircuit, title: 'Instant Talent Matching', description: "AI immediately matches you with precisely vetted freelancers suited to your project's unique needs." },
  { icon: Split, title: 'Microtask Efficiency', description: 'Your project is intelligently divided into parallel microtasks, speeding up delivery through simultaneous expert collaboration.' },
  { icon: GanttChart, title: 'Dynamic Project Management', description: 'Track real-time progress, communicate effortlessly, and request updates or changes anytime.' },
  { icon: CheckCircle, title: 'Quality-Assured Delivery', description: 'Every task undergoes automated quality checks and optional peer reviews for unmatched precision.' },
  { icon: Rocket, title: 'Seamless Project Completion', description: 'Receive your fully assembled, ready-to-launch project seamlessly integrated from completed microtasks.' },
];

const cardVariant = {
  hidden: { opacity: 0, scale: 0.85 },
  visible: (i: number) => ({
    opacity: 1,
    scale: 1,
    transition: { duration: 0.5, delay: i * 0.1, ease: [0.25, 0.1, 0.25, 1] },
  }),
};

const numberVariant = {
  hidden: { opacity: 0 },
  visible: (i: number) => ({
    opacity: 1,
    transition: { duration: 0.3, delay: i * 0.1 - 0.05 },
  }),
};

export function WorkflowSection() {
  return (
    <section id="how-it-works" className="py-16 md:py-20 border-t border-border">
      <div className="container mx-auto px-4 md:px-6">
        <ScrollReveal>
          <div className="mb-10 text-center">
            <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-primary">
              &#10217; Process
            </p>
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Our workflow, simplified
            </h2>
          </div>
        </ScrollReveal>

        {/* Connecting line (desktop only) */}
        <div className="hidden lg:block relative mb-6">
          <motion.svg
            viewBox="0 0 1200 20"
            className="w-full h-5"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-40px' }}
          >
            {/* Main line */}
            <motion.line
              x1="100" y1="10" x2="1100" y2="10"
              stroke="hsl(197 100% 50%)"
              strokeWidth="2"
              strokeLinecap="round"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 1.2, ease: 'easeInOut' }}
              variants={{
                hidden: { pathLength: 0, opacity: 0.3 },
                visible: { pathLength: 1, opacity: 1, transition: { duration: 1.2, ease: 'easeInOut' } },
              }}
            />
            {/* Dots at each step position */}
            {steps.map((_, i) => {
              const cx = 100 + (i * 1000) / (steps.length - 1);
              return (
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
                      transition: { delay: (i / (steps.length - 1)) * 1.2 + 0.1, duration: 0.3 },
                    },
                  }}
                />
              );
            })}
          </motion.svg>
        </div>

        {/* Step cards */}
        <motion.div
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-80px' }}
        >
          {steps.map((step, index) => (
            <motion.div
              key={step.title}
              custom={index}
              variants={cardVariant}
              className="group rounded-xl border border-border bg-card p-6 transition-all duration-200 hover:border-primary/50 hover:-translate-y-1"
            >
              <motion.p
                custom={index}
                variants={numberVariant}
                className="text-xs font-bold uppercase tracking-widest text-primary mb-3"
              >
                {String(index + 1).padStart(2, '0')}
              </motion.p>
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/15 mb-4 transition-transform duration-200 group-hover:scale-110">
                <step.icon className="h-5 w-5 text-primary" />
              </div>
              <h3 className="text-base font-semibold mb-2">{step.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {step.description}
              </p>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}

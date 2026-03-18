'use client';

import { Star } from 'lucide-react';
import { ScrollReveal } from '@/components/motion/scroll-reveal';

const testimonials = [
  {
    quote: 'We posted a rebrand project and had a matched team working within minutes. The quality gates caught issues we would have missed.',
    name: 'Alex Chen',
    role: 'Startup Founder',
    type: 'Client',
  },
  {
    quote: 'No more bidding on projects for hours. Work comes to me based on my skills, and I get paid fairly every time.',
    name: 'Maria Santos',
    role: 'UI Designer',
    type: 'Freelancer',
  },
  {
    quote: 'The microtask decomposition is a game-changer. Our 3-month project was delivered in 3 weeks.',
    name: 'Jordan Kim',
    role: 'Product Manager',
    type: 'Client',
  },
];

export function TestimonialsSection() {
  return (
    <section className="bg-white text-gray-900 py-16 md:py-20">
      <div className="container mx-auto px-4 md:px-6">
        <ScrollReveal>
          <div className="mb-10 text-center">
            <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-primary">
              &#10217; Testimonials
            </p>
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl text-gray-900">
              Trusted by teams and freelancers
            </h2>
          </div>
        </ScrollReveal>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-5xl mx-auto">
          {testimonials.map((t) => (
            <ScrollReveal key={t.name}>
              <div className="rounded-xl border border-gray-200 bg-gray-50 p-6 h-full flex flex-col relative">
                {/* Quote decoration */}
                <span className="absolute top-4 right-4 text-5xl leading-none text-primary/10 font-serif select-none">
                  &ldquo;
                </span>

                <div className="flex gap-0.5 mb-3">
                  {Array.from({ length: 5 }, (_, i) => (
                    <Star key={i} className="h-4 w-4 fill-primary text-primary" />
                  ))}
                </div>

                <p className="text-sm text-gray-700 leading-relaxed flex-1 mb-4">
                  &ldquo;{t.quote}&rdquo;
                </p>

                <div className="border-t border-gray-200 pt-3">
                  <p className="text-sm font-semibold text-gray-900">{t.name}</p>
                  <p className="text-xs text-gray-500">{t.role} · {t.type}</p>
                </div>
              </div>
            </ScrollReveal>
          ))}
        </div>
      </div>
    </section>
  );
}

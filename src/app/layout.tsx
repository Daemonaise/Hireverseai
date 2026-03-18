import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Toaster } from '@/components/ui/toaster';
import { Providers } from '@/components/providers';
import { getLocale, getMessages } from 'next-intl/server';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
});

export const metadata: Metadata = {
  title: {
    default: 'Hireverse AI | Expert Freelance Work, Delivered Faster',
    template: '%s | Hireverse AI',
  },
  description:
    'AI-powered freelancer marketplace. Describe your project, get matched with vetted talent instantly. Parallel microtasks, built-in quality assurance, transparent pricing.',
  keywords: [
    'freelancer marketplace',
    'AI matching',
    'hire freelancers',
    'microtasks',
    'project management',
    'quality assurance',
    'remote work',
  ],
  openGraph: {
    title: 'Hireverse AI | Expert Freelance Work, Delivered Faster',
    description:
      'Describe your project in plain English. AI matches you with vetted freelancers, decomposes work into parallel tasks, and delivers quality-assured results.',
    url: 'https://hireverse.ai',
    siteName: 'Hireverse AI',
    type: 'website',
    images: [
      {
        url: '/opengraph-image',
        width: 1200,
        height: 630,
        alt: 'Hireverse AI | Expert Freelance Work, Delivered Faster',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Hireverse AI | Expert Freelance Work, Delivered Faster',
    description:
      'AI-powered freelancer marketplace. Post a project, get matched instantly, receive quality-checked deliverables.',
    images: ['/opengraph-image'],
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = await getLocale();
  const messages = await getMessages();

  return (
    <html lang={locale}>
      <body className={`${inter.variable} font-sans antialiased`}>
        <Providers locale={locale} messages={messages}>
          {children}
          <Toaster />
        </Providers>
      </body>
    </html>
  );
}

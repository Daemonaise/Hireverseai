
import type { Metadata } from 'next';
import { Inter } from 'next/font/google'; // Using Inter for clean readability
import './globals.css';
import { Toaster } from '@/components/ui/toaster'; // Import Toaster

// Use Inter font
const inter = Inter({
  subsets: ['latin'],
  variable: '--font-sans', // Define CSS variable for sans-serif font
});


export const metadata: Metadata = {
  title: 'Hireverse AI', // Update title
  description: 'AI Hiring Solutions Built for Speed and Precision', // Updated description
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      {/* Apply Inter font variable to body */}
      <body className={`${inter.variable} font-sans antialiased`}>
        {children}
        <Toaster /> {/* Add Toaster component */}
      </body>
    </html>
  );
}

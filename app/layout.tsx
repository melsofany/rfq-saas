import './globals.css';
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { AuthProvider } from '@/lib/auth-context';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Qotix — Procurement SaaS Platform',
  description: 'Streamline your procurement process with Qotix. Manage suppliers, RFQs, purchase orders, and offers all in one platform.',
  openGraph: {
    title: 'Qotix — Procurement SaaS Platform',
    description: 'Streamline your procurement process with Qotix.',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className} suppressHydrationWarning>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}

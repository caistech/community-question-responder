import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Community Question Responder',
  description:
    'Automated thoughtful replies for dev-tool community Slacks and Discords. Polls a channel, drafts a high-quality reply against a vendor-specific knowledge base, holds it for one-click approval.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className={inter.className}>{children}</body>
    </html>
  );
}

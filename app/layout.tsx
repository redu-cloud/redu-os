import type { Metadata } from 'next';
import Script from 'next/script';
import './globals.css';

export const metadata: Metadata = {
  title: 'reduOS - AI Operating System for Startups',
  description: 'Open-source AI operating system for startup teams. Connect your stack and run your startup from one command center.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-white text-gray-900">
        {children}
        <Script
          src="https://umami-foyrsg53.redu.cloud/script.js"
          data-website-id="cb152712-190c-4a26-905f-42aef233eb0a"
          strategy="afterInteractive"
        />
      </body>
    </html>
  );
}

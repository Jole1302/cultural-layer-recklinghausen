import type { Metadata } from 'next';
import { CookieBanner } from '@/components/cookie-banner';
import './globals.css';

export const metadata: Metadata = {
  title: 'Cultural Layer Recklinghausen',
  description:
    'Bilaterale Event-Plattform für Künstler:innen und Locations im Kreis Recklinghausen.',
  metadataBase: new URL('https://example.vercel.app'),
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de">
      <body className="min-h-screen bg-white text-neutral-900 antialiased">
        <a
          href="#main"
          className="sr-only focus-visible:not-sr-only focus-visible:fixed focus-visible:left-4 focus-visible:top-4 focus-visible:rounded focus-visible:bg-black focus-visible:px-4 focus-visible:py-2 focus-visible:text-white"
        >
          Zum Inhalt springen
        </a>
        {children}
        <CookieBanner />
      </body>
    </html>
  );
}

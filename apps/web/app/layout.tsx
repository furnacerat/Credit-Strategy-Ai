import './globals.css';
import { Fraunces, Spline_Sans } from 'next/font/google';
import type { Metadata } from 'next';

const heading = Fraunces({ subsets: ['latin'], variable: '--font-heading' });
const body = Spline_Sans({ subsets: ['latin'], variable: '--font-body' });

export const metadata: Metadata = {
  title: 'Credit Repair',
  description: 'Upload your report, get a full analysis, and generate dispute letters.'
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${heading.variable} ${body.variable}`}>
      <body>
        <div className="bg" aria-hidden="true" />
        {children}
      </body>
    </html>
  );
}

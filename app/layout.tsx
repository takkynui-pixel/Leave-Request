import type { Metadata, Viewport } from 'next';
import { Prompt } from 'next/font/google';
import './globals.css';

// ฟอนต์ถูกดาวน์โหลดตอน build แล้วให้บริการจากโดเมนเดียวกัน (ไม่บล็อกการแสดงผลเหมือนลิงก์ Google Fonts)
const prompt = Prompt({
  subsets: ['thai', 'latin'],
  weight: ['400', '500', '600', '700'],
  display: 'swap',
  variable: '--font-prompt',
});

export const metadata: Metadata = {
  title: 'ระบบแจ้งลา | VTA Service',
  description: 'ระบบแจ้งลาออนไลน์ บริษัท วีทีเอ เซอร์วิส จำกัด',
  icons: { icon: '/favicon.ico' },
};

export const viewport: Viewport = { width: 'device-width', initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="th" className={prompt.variable}>
      <body>{children}</body>
    </html>
  );
}

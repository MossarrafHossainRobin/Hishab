import './globals.css';
import RegisterSW from '@/components/RegisterSW';

export const metadata = {
  title: 'Hishab',
  description: 'Monthly and yearly income, expenses and net balance. Works offline.',
  appleWebApp: { capable: true, title: 'Hishab', statusBarStyle: 'default' },
  icons: { icon: '/icon-192.png', apple: '/apple-touch-icon.png' },
};

export const viewport = { themeColor: '#0f3d2e', width: 'device-width', initialScale: 1 };

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        {children}
        <RegisterSW />
      </body>
    </html>
  );
}

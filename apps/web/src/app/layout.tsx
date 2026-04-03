import type { Metadata, Viewport } from "next";
import Script from "next/script";
import "./globals.css";
import { LocaleProvider, ThemeProvider } from "@tayyar/ui";
import AuthGate from "@/components/auth/AuthGate";
import PwaBoot from "@/components/pwa/PwaBoot";

const fontVariables = {
  "--font-cairo": '"Cairo"',
  "--font-ibm-plex-arabic": '"IBM Plex Sans Arabic"',
  "--font-syne": '"Syne"',
  "--font-dm-sans": '"DM Sans"',
  "--font-dm-mono": '"DM Mono"',
} as React.CSSProperties;

export const metadata: Metadata = {
  title: "Tayyar",
  description: "Mobile-first delivery operations platform",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Tayyar",
  },
  icons: {
    icon: [
      { url: "/icon.svg", type: "image/svg+xml" },
      { url: "/icon-192.svg", sizes: "192x192", type: "image/svg+xml" },
      { url: "/icon-512.svg", sizes: "512x512", type: "image/svg+xml" },
    ],
    apple: [{ url: "/icon-192.svg", type: "image/svg+xml" }],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#030509",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ar-EG" dir="rtl" className="theme-midnight" suppressHydrationWarning>
      <head>
        <Script id="tayyar-theme-bootstrap" strategy="beforeInteractive">
          {`
            (function () {
              try {
                var savedTheme = window.localStorage.getItem('tayyar-theme');
                var theme = savedTheme === 'fajr' || savedTheme === 'midnight' ? savedTheme : 'midnight';
                document.documentElement.classList.remove('theme-midnight', 'theme-fajr');
                document.documentElement.classList.add('theme-' + theme);
                document.documentElement.dataset.theme = theme;
              } catch (error) {}
            })();
          `}
        </Script>
        <Script id="tayyar-locale-bootstrap" strategy="beforeInteractive">
          {`
            (function () {
              try {
                var saved = window.localStorage.getItem('tayyar-locale');
                var locale = saved === 'en' || saved === 'ar'
                  ? saved
                  : (navigator.language || '').toLowerCase().startsWith('ar') ? 'ar' : 'en';
                var dir = locale === 'ar' ? 'rtl' : 'ltr';
                document.documentElement.lang = locale === 'ar' ? 'ar-EG' : 'en';
                document.documentElement.dir = dir;
                document.documentElement.dataset.locale = locale;
              } catch (error) {}
            })();
          `}
        </Script>
      </head>
      <body
        className="min-h-screen antialiased"
        style={fontVariables}
      >
        <LocaleProvider>
          <ThemeProvider>
            <AuthGate>{children}</AuthGate>
            <PwaBoot />
          </ThemeProvider>
        </LocaleProvider>
      </body>
    </html>
  );
}

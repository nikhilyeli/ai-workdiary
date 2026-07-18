import type { Metadata, Viewport } from "next";
import Script from "next/script";
import "./globals.css";

export const metadata: Metadata = {
  title: "AI Work Diary",
  description:
    "Orchestrator reviewer and summarizer for Jira, Bitbucket, and work activities",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "AI Work Diary",
  },
  formatDetection: { telephone: false },
  other: {
    "mobile-web-app-capable": "yes",
    "apple-mobile-web-app-capable": "yes",
    "apple-mobile-web-app-status-bar-style": "default",
    "apple-mobile-web-app-title": "WorkDiary",
  },
};

export const viewport: Viewport = {
  themeColor: "#2563eb",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <head>
        <link rel="apple-touch-icon" href="/icons/icon-180.svg" />
      </head>
      <body className="min-h-full flex flex-col font-sans">
        {children}
        {/* Register service worker after page is interactive (non-blocking) */}
        <Script id="sw-register" strategy="afterInteractive">
          {`if('serviceWorker' in navigator){navigator.serviceWorker.register('/sw.js').catch(function(){});}`}
        </Script>
      </body>
    </html>
  );
}

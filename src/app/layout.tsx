import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "GereoTimes",
    template: "%s · GereoTimes",
  },
  description:
    "Gestion du temps de travail, des congés et des validations managériales.",
};

/**
 * Posé dans <head> et exécuté avant la peinture : choisit le thème sans
 * provoquer de clignotement clair→sombre au chargement.
 * `system` est le défaut quand rien n'a été choisi explicitement.
 */
const THEME_SCRIPT = `try{var e=localStorage.getItem('theme');var d=e?e==='dark':matchMedia('(prefers-color-scheme: dark)').matches;document.documentElement.classList.toggle('dark',d)}catch(e){}`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="fr"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="min-h-full bg-surface-muted text-content">{children}</body>
    </html>
  );
}

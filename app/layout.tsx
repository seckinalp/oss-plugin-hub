import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Plugin Discovery Hub - Open Source Plugins",
  description: "Discover and explore open-source plugins for Obsidian and beyond",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}


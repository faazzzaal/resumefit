import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ResumeFit | Resume Upload",
  description: "Upload a resume securely for job matching and career recommendations.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}

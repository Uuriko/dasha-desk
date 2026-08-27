import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://dasha-bloom.jjohnpotter.chatgpt.site"),
  title: "Dasha Compute — make the Macs do something",
  description: "An open community inference network for builders and idle computers.",
  openGraph: {
    title: "Dasha Compute",
    description: "Make the Macs do something. Open community inference from $dasha.",
    type: "website",
    images: [{ url: "/og.png", width: 1731, height: 909, alt: "$DASHA COMPUTE — Make the Macs do something." }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Dasha Compute",
    description: "Make the Macs do something. Open community inference from $dasha.",
    images: ["/og.png"],
  },
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

import type { Metadata } from "next";
import { Crimson_Pro, Geist, Geist_Mono } from "next/font/google";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { ThemeProvider } from "@/components/layout/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import {
  SITE_DESCRIPTION,
  SITE_NAME,
  SITE_OPEN_GRAPH,
  SITE_URL,
  siteOgImage,
} from "@/lib/seo";
import { srdDataHash } from "@/lib/srd/data-hash";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});
const crimson = Crimson_Pro({
  variable: "--font-crimson",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

// Pages set their own canonical URL and Open Graph fields with `pageMetadata`.
export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: SITE_NAME, template: `%s · ${SITE_NAME}` },
  description: SITE_DESCRIPTION,
  openGraph: { ...SITE_OPEN_GRAPH, images: siteOgImage() },
  twitter: { card: "summary_large_image" },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      data-srd-hash={process.env.SRD_DATA_HASH ?? srdDataHash()}
      className={`${geistSans.variable} ${geistMono.variable} ${crimson.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <TooltipProvider delayDuration={300}>
            <SiteHeader />
            <main className="flex flex-1 flex-col">{children}</main>
            <SiteFooter />
            <Toaster position="bottom-right" />
          </TooltipProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}

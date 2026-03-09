import type { Metadata, Viewport } from "next";
import { Suspense } from "react";
import "./globals.css";
import { BlobsProvider } from "@/contexts/BlobsContext";
import { PresenceProvider } from "@/contexts/PresenceContext";
import { ThemeApplied } from "@/components/ThemeApplied";
import { TypeScriptErrorsDebug } from "@/components/TypeScriptErrorsDebug";
import { AuthHashRedirect } from "@/components/AuthHashRedirect";
import { AppErrorBoundary } from "@/components/AppErrorBoundary";
import { ConnectivityGuard } from "@/components/ConnectivityGuard";
import { E2ESyncOverlay } from "@/components/e2e/E2ESyncOverlay";

/** Allow pinch-zoom on iOS Safari so two-finger gestures are treated as zoom, not "pull out of tab". */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
};

export const metadata: Metadata = {
  title: "blob",
  description: "Tap to create blobs. Bulleted lists, drag to move.",
  icons: { icon: "/assets/icons/web/icon-32.png" },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var p=localStorage.getItem("blob_preferences");if(p){var j=JSON.parse(p);if(j.theme)document.documentElement.setAttribute("data-theme",j.theme);}}catch(e){}})();`,
          }}
        />
      </head>
      <body>
        <AppErrorBoundary>
          <BlobsProvider>
            <PresenceProvider>
            <ConnectivityGuard>
              <AuthHashRedirect />
              <ThemeApplied>{children}</ThemeApplied>
              <Suspense fallback={null}>
                <E2ESyncOverlay />
              </Suspense>
              <TypeScriptErrorsDebug />
            </ConnectivityGuard>
            </PresenceProvider>
          </BlobsProvider>
        </AppErrorBoundary>
      </body>
    </html>
  );
}

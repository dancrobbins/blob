import type { Metadata } from "next";
import "./globals.css";
import { BlobsProvider } from "@/contexts/BlobsContext";
import { ThemeApplied } from "@/components/ThemeApplied";
import { TypeScriptErrorsDebug } from "@/components/TypeScriptErrorsDebug";
import { AuthHashRedirect } from "@/components/AuthHashRedirect";

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
        <BlobsProvider>
          <AuthHashRedirect />
          <ThemeApplied>{children}</ThemeApplied>
          <TypeScriptErrorsDebug />
        </BlobsProvider>
      </body>
    </html>
  );
}

import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import "./globals.css";

export const metadata: Metadata = {
  title: "Recy",
  description: "Registrazioni · trascrizioni · riassunti",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <ClerkProvider
      appearance={{
        variables: {
          colorPrimary: "#27272A",
          colorText: "#18181B",
          colorTextSecondary: "#71717A",
          colorBackground: "#FFFFFF",
          colorInputBackground: "#F4F4F5",
          colorInputText: "#18181B",
          colorNeutral: "#27272A",
          colorDanger: "#DC2626",
          colorSuccess: "#10B981",
          colorWarning: "#F59E0B",
          fontFamily:
            '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", Roboto, sans-serif',
          borderRadius: "10px",
          fontSize: "15px",
        },
        elements: {
          card: {
            boxShadow: "0 12px 40px rgba(0,0,0,0.06)",
            borderRadius: 16,
            border: "1px solid #E4E4E7",
          },
          headerTitle: { fontSize: 24, fontWeight: 700, letterSpacing: -0.4 },
          headerSubtitle: { color: "#71717A" },
          formButtonPrimary: {
            backgroundColor: "#27272A",
            color: "#FFFFFF",
            fontWeight: 600,
            textTransform: "none",
            "&:hover, &:focus, &:active": { backgroundColor: "#18181B" },
          },
          socialButtonsBlockButton: {
            border: "1px solid #E4E4E7",
            borderRadius: 10,
          },
          formFieldInput: {
            borderRadius: 10,
            border: "1px solid #E4E4E7",
          },
          footer: { background: "transparent", display: "none" },
          footerAction: { background: "transparent" },
          badge: { background: "#F4F4F5", color: "#71717A" },
          logoBox: { display: "none" },
        },
      }}
    >
      <html lang="it">
        <body>{children}</body>
      </html>
    </ClerkProvider>
  );
}

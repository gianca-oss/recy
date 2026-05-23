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
    <ClerkProvider>
      <html lang="it">
        <body>{children}</body>
      </html>
    </ClerkProvider>
  );
}

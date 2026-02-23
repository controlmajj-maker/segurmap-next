import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "SegurMap MAQ",
  description: "Sistema de auditorías de seguridad industrial",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <head>
        <link
          rel="stylesheet"
          href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css"
        />
        <script src="https://cdn.tailwindcss.com"></script>
      </head>
      <body style={{ margin: 0, padding: 0, fontFamily: "system-ui, sans-serif" }}>
        {children}
      </body>
    </html>
  );
}

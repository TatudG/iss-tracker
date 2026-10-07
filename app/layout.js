import "./globals.css";

export const metadata = {
  title: "ISS Live-Tracker",
  description: "Aktuelle Position, Höhe und Geschwindigkeit der ISS auf einer Live-Karte.",
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }) {
  return (
    <html lang="de">
      <body>{children}</body>
    </html>
  );
}

import "./globals.css";

export const metadata = {
  title: "Useful Tools",
  description: "A collection of handy everyday tools.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

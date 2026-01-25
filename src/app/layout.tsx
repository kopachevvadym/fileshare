import "@/styles/globals.css";


export default function RootLayout({ children }: { children: React.ReactNode; }) {
  return (
    <html lang="en">
    <head>
      <title>FileShare</title>
      <meta charSet="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    </head>
    <body>{children}</body>
    </html>
  );
}

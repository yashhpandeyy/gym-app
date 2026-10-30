import { ScrollViewStyleReset } from 'expo-router/html';
import type { PropsWithChildren } from 'react';

/** The page shell for the website build: language, viewport, a readable default font and keyboard focus rings. */
export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no" />
        <meta name="description" content="Owner dashboard: members, payments, slots and check-ins for your gym." />
        <ScrollViewStyleReset />
        <style dangerouslySetInnerHTML={{ __html: css }} />
      </head>
      <body>{children}</body>
    </html>
  );
}

const css = `
html, body { height: 100%; }
body { font-family: Inter, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; -webkit-font-smoothing: antialiased; text-rendering: optimizeLegibility; }
[role="button"], [role="link"], [role="tab"] { cursor: pointer; }
:focus-visible { outline: 2px solid #2F45FF; outline-offset: 2px; }
input:focus-visible, textarea:focus-visible { outline: none; }
`;

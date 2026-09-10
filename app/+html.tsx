import { ScrollViewStyleReset } from 'expo-router/html';

// This file is web-only and used to configure the root HTML for every
// web page during static rendering.
// The contents of this function only run in Node.js environments and
// do not have access to the DOM or browser APIs.
export default function Root({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no" />

        {/* 
          Disable body scrolling on web. This makes ScrollView components work closer to how they do on native. 
          However, body scrolling is often nice to have for mobile web. If you want to enable it, remove this line.
        */}
        <ScrollViewStyleReset />

        {/* Using raw CSS styles as an escape-hatch to ensure the background color never flickers on first paint. */}
        <style dangerouslySetInnerHTML={{ __html: responsiveBackground }} />
        {/* Add any additional <head> elements that you want globally available on web... */}
      </head>
      <body>{children}</body>
    </html>
  );
}

const responsiveBackground = `
:root {
  color-scheme: light;
  --fitverse-bg: #F7F9FC;
  --fitverse-surface: #FFFFFF;
  --fitverse-navy: #0C2340;
  --fitverse-gold: #C99700;
}
html, body {
  height: 100%;
  width: 100%;
  margin: 0;
  padding: 0;
  background-color: var(--fitverse-bg);
  color: var(--fitverse-navy);
  -webkit-font-smoothing: antialiased;
}
body {
  display: flex;
  min-height: 100%;
  overflow: hidden;
}
/* Expo / React Native Web root wrappers */
#root, [data-expo-root], body > div:first-child {
  display: flex;
  flex: 1;
  flex-direction: column;
  width: 100%;
  min-height: 100%;
  background-color: var(--fitverse-bg);
}
/* Prevent transparent RN views from showing browser black */
div[class*="css-view"] {
  min-height: 0;
}
input, textarea {
  outline: none;
}
input:focus, textarea:focus {
  border-color: var(--fitverse-gold) !important;
}
@media (min-width: 900px) {
  body {
    background: linear-gradient(180deg, #FFFFFF 0%, #F7F9FC 40%, #EEF2F7 100%);
  }
}`;

/*
 * CodeDeX VisualNoteX Frontend Entry Point
 * This is where my vision for user-friendly automation tools comes to life
 * Every pixel, every interaction is designed with the user's experience in mind
 */

import { StrictMode } from 'react';
import * as ReactDOM from 'react-dom/client';

import App from './app/app';

// CodeDeX custom console message - only in debug builds
if (import.meta.env.DEV) {
  console.log(`
  🚀 CodeDeX VisualNoteX Frontend Initialized
  💡 Built by CodeDeX - "Automation Engineer with a soul"
  📧 Contact: code@codeDeX.dev
  `);
}

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);

// CodeDeX custom wrapper for additional future features
const CodeDeXApp = () => (
  <StrictMode>
    <App />
  </StrictMode>
);

root.render(<CodeDeXApp />);

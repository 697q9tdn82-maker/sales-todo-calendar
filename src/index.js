import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import KeyGate from './KeyGate';
import reportWebVitals from './reportWebVitals';
import * as serviceWorkerRegistration from './serviceWorkerRegistration';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <KeyGate><App /></KeyGate>
  </React.StrictMode>
);

reportWebVitals();
serviceWorkerRegistration.register();
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import GuideLauncher from './Guide';
import './styles.css';
import './guide.css';

createRoot(document.getElementById('root')!).render(<StrictMode><App/><GuideLauncher/></StrictMode>);
if('serviceWorker' in navigator)window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(()=>undefined));

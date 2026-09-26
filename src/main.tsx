import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import GuideLauncher from './Guide';
import VoiceSummary from './VoiceSummary';
import './styles.css';
import './guide.css';
import './voice-summary.css';

createRoot(document.getElementById('root')!).render(<StrictMode><App/><GuideLauncher/><VoiceSummary/></StrictMode>);
if('serviceWorker' in navigator)window.addEventListener('load',async()=>{try{const registration=await navigator.serviceWorker.register('./sw.js',{updateViaCache:'none'});await registration.update();}catch{}});

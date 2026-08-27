import { useEffect, useState } from 'react';
import { BookOpen, Activity, BarChart3, Gamepad2, Globe2, HeartPulse, MousePointerClick, ShieldCheck, Smartphone, Timer, Users, X, Zap } from 'lucide-react';

const sections = [
  {title:'Bienvenue dans CR3@TIX ANALYTIX', icon:BookOpen, body:'ANALYTIX centralise les statistiques de tes projets CR3@TIX. MAP fournit le registre des projets, analytics.js collecte les événements et Supabase stocke les données affichées dans ce cockpit privé.'},
  {title:'1. Commencer par choisir une période', icon:Timer, body:'Utilise le sélecteur de période en haut du tableau de bord : Aujourd’hui, 24 h, 7 jours, 30 jours, 90 jours, 1 an, Toujours ou une période personnalisée. Les tendances comparent la période courante à la période précédente.'},
  {title:'2. Lire les indicateurs principaux', icon:Users, body:'Visiteurs uniques = personnes distinctes détectées. Nouveaux visiteurs = première visite sur la période. Sessions = périodes d’utilisation. Pages vues = vues enregistrées. Durée moyenne = engagement moyen. Actifs maintenant = sessions vues dans les 5 dernières minutes.'},
  {title:'3. Comprendre Audience et Acquisition', icon:BarChart3, body:'Audience montre l’évolution des sessions et pages vues. Acquisition indique d’où arrivent les visiteurs : Direct, Google, Facebook, TikTok, Instagram, YouTube et autres referrals. Les paramètres UTM permettent de comparer précisément les campagnes.'},
  {title:'4. Suivre tous les projets CR3@TIX', icon:Globe2, body:'La rubrique Projets est synchronisée avec CR3@TIX MAP. Un projet retiré de MAP est archivé sans supprimer son historique. Les statuts EN LIGNE, DÉGRADÉ, HORS LIGNE, EN ATTENTE et ARCHIVÉ donnent son état général.'},
  {title:'5. Utiliser la vue LIVE', icon:Activity, body:'LIVE montre les sessions actives, le projet utilisé, la dernière page connue, le type d’appareil et les événements récents. Cette vue est idéale juste après une publication ou une mise à jour.'},
  {title:'6. Analyser mobile, tablette et ordinateur', icon:Smartphone, body:'ANALYTIX classe les appareils en mobile, tablette ou desktop et détecte notamment Android, iOS, Windows, macOS, Linux ainsi que les principaux navigateurs. Ces informations aident à repérer des bugs propres à certains appareils.'},
  {title:'7. Exploiter les événements de jeu', icon:Gamepad2, body:'Pour les jeux, surveille game_start, game_end, level_start, level_complete, score, boss_start, boss_defeated, power_used, ultimate_used et game_time. Ils permettent de mesurer la vraie progression des joueurs, pas seulement les visites.'},
  {title:'8. Suivre les clics et actions importantes', icon:MousePointerClick, body:'Le tracker peut enregistrer installations, plein écran, téléchargements, liens externes et événements personnalisés. Tu peux aussi ajouter data-analytics-event sur un bouton HTML pour suivre son utilisation sans code supplémentaire.'},
  {title:'9. Repérer les erreurs et ralentissements', icon:HeartPulse, body:'Les erreurs JavaScript et promesses rejetées peuvent être remontées automatiquement. Les Web Vitals LCP, INP, CLS, TTFB et LOAD permettent de surveiller vitesse d’affichage, réactivité, stabilité visuelle et temps de chargement.'},
  {title:'10. Sécurité et confidentialité', icon:ShieldCheck, body:'Le tableau de bord est privé et protégé par Supabase Auth. Les visiteurs n’ont aucun compte ANALYTIX. Le tracker respecte Do Not Track et Global Privacy Control, et n’a pas besoin de conserver d’IP brute, de nom ou d’e-mail visiteur.'},
  {title:'Routine simple à retenir', icon:Zap, body:'Chaque jour : regarde visiteurs, sessions, durée moyenne et classement. Après une publication : LIVE + Acquisition. Après une mise à jour : Erreurs + Performances + Santé. Pour un jeu : game_start, game_end, level_complete, score et game_time.'}
];

export default function GuideLauncher(){
  const [open,setOpen]=useState(false);
  useEffect(()=>{const onKey=(e:KeyboardEvent)=>{if(e.key==='Escape')setOpen(false)};window.addEventListener('keydown',onKey);return()=>window.removeEventListener('keydown',onKey)},[]);
  return <>
    <button className="guideLauncher" onClick={()=>setOpen(true)} aria-label="Ouvrir le mode d’emploi"><BookOpen/><span>Mode d’emploi</span></button>
    {open&&<div className="guideOverlay" role="dialog" aria-modal="true" aria-label="Mode d’emploi CR3@TIX ANALYTIX" onMouseDown={e=>{if(e.target===e.currentTarget)setOpen(false)}}>
      <div className="guideModal">
        <button className="guideClose" onClick={()=>setOpen(false)} aria-label="Fermer le mode d’emploi"><X/></button>
        <div className="guidePage">
          <section className="guideHero"><div className="guideHeroIcon"><BookOpen/></div><div><span className="eyebrow">MODE D’EMPLOI INTÉGRÉ</span><h2>Comment utiliser CR3@TIX ANALYTIX</h2><p>Un guide pratique directement dans l’application pour comprendre les données, contrôler tes projets et retrouver la bonne routine d’analyse.</p></div></section>
          <div className="guideGrid">{sections.map(({title,icon:Icon,body})=><article className="guideCard" key={title}><div className="guideCardIcon"><Icon/></div><div><h3>{title}</h3><p>{body}</p></div></article>)}</div>
          <section className="guideQuick"><h3>Le principe en une phrase</h3><p><b>CR3@TIX MAP</b> dit quels projets existent, <b>analytics.js</b> observe ce que font les utilisateurs et <b>CR3@TIX ANALYTIX</b> transforme ces données en décisions utiles.</p></section>
        </div>
      </div>
    </div>}
  </>;
}

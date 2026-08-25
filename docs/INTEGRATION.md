# Intégrer CR3@TIX ANALYTIX

Le snippet exact est disponible dans la fiche ANALYTIX de chaque projet :

```html
<script async
  src="https://kevinlabens-del.github.io/CR3-TIX-ANALYTIX./analytics.js"
  data-project-id="PROJECT_ID"
  data-project-key="PROJECT_TRACKING_KEY"></script>
```

Événement personnalisé :

```js
CreatixAnalytics.track('game_start');
CreatixAnalytics.track('score', { value: 1250, level: 4 });
```

Un élément HTML peut être suivi sans JavaScript supplémentaire :

```html
<button data-analytics-event="power_used" data-analytics-label="Glace">Pouvoir</button>
```

Le tracker détecte automatiquement les pages vues, navigations SPA, sessions, engagement, installations, plein écran, téléchargements, liens externes, erreurs JavaScript et Web Vitals.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.56.1';
const URL=Deno.env.get('SUPABASE_URL')!,SERVICE=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const admin=createClient(URL,SERVICE,{auth:{persistSession:false,autoRefreshToken:false}}),enc=new TextEncoder();
async function sha(v:string){return [...new Uint8Array(await crypto.subtle.digest('SHA-256',enc.encode(v)))].map(b=>b.toString(16).padStart(2,'0')).join('');}
async function check(project:any){
  const start=Date.now();let code=0,html='',error='';
  try{const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),12000);const res=await fetch(project.url,{signal:controller.signal,headers:{'user-agent':'CR3ATIX-ANALYTIX-Health/1.0'}});clearTimeout(timer);code=res.status;html=(await res.text()).slice(0,200000);}catch(e){error=String(e).slice(0,300);}
  const responseMs=Date.now()-start,reachable=code>=200&&code<400,tracker=/CreatixAnalytics|analytics\.js|analytix-collect/i.test(html),manifest=/<link[^>]+rel=["']manifest/i.test(html),sw=/serviceWorker|service-worker|sw\.js/i.test(html);
  const stale=!project.last_event_at||Date.now()-new Date(project.last_event_at).getTime()>48*3600000;const status=!reachable?'DOWN':(!tracker||responseMs>3000?'DEGRADED':'ONLINE');
  const row={project_id:project.id,status,checked_at:new Date().toISOString(),http_status:code||null,response_ms:responseMs,https_ok:project.url.startsWith('https://'),tracker_ok:tracker,manifest_ok:manifest,service_worker_ok:sw,last_event_at:project.last_event_at,version:project.version,details:{error,stale_data:stale}};
  await admin.from('analytics_health').upsert(row);await admin.from('analytics_health_history').insert({project_id:project.id,status,http_status:code||null,response_ms:responseMs,tracker_ok:tracker});
  await admin.from('analytics_projects').update({status:status==='ONLINE'?'ONLINE':status}).eq('id',project.id).neq('status','ARCHIVED');
  const alerts:any[]=[];if(status==='DOWN')alerts.push({kind:'PROJECT_DOWN',severity:'critical',title:`${project.name} est indisponible`,message:`La vérification HTTP a échoué (${code||error}).`,dedupe_key:`down:${project.id}`});
  if(reachable&&!tracker)alerts.push({kind:'TRACKER_INACTIVE',severity:'warning',title:`Tracker absent sur ${project.name}`,message:'Le tracker ANALYTIX n’a pas été détecté dans la page publique.',dedupe_key:`tracker:${project.id}`});
  if(stale&&project.tracker_last_seen_at)alerts.push({kind:'NO_DATA',severity:'warning',title:`Aucune donnée récente — ${project.name}`,message:'Aucun événement reçu depuis plus de 48 heures.',dedupe_key:`stale:${project.id}`});
  const since=new Date(Date.now()-8*86400000).toISOString().slice(0,10);
  const [{data:days},{data:perf}]=await Promise.all([
    admin.from('analytics_daily_stats').select('day,pageviews,errors').eq('project_id',project.id).gte('day',since).order('day'),
    admin.from('analytics_performance').select('metric,value').eq('project_id',project.id).gte('recorded_at',new Date(Date.now()-86400000).toISOString()).limit(1000)
  ]);
  const stats=days||[],today=new Date().toISOString().slice(0,10),current=stats.find((x:any)=>x.day===today)||{pageviews:0,errors:0},past=stats.filter((x:any)=>x.day!==today);
  const avg=past.length?past.reduce((a:number,x:any)=>a+Number(x.pageviews||0),0)/past.length:0;
  const errAvg=past.length?past.reduce((a:number,x:any)=>a+Number(x.errors||0),0)/past.length:0;
  if(avg>=10&&current.pageviews>avg*2.5)alerts.push({kind:'TRAFFIC_SPIKE',severity:'info',title:`Pic de trafic — ${project.name}`,message:`Le trafic du jour dépasse 2,5 fois la moyenne récente.`,dedupe_key:`traffic-spike:${project.id}:${today}`});
  if(avg>=10&&new Date().getUTCHours()>=18&&current.pageviews<avg*.3)alerts.push({kind:'TRAFFIC_DROP',severity:'warning',title:`Chute de trafic — ${project.name}`,message:'Le trafic est nettement sous sa moyenne récente.',dedupe_key:`traffic-drop:${project.id}:${today}`});
  if(current.errors>=5&&current.errors>Math.max(3,errAvg*2))alerts.push({kind:'ERROR_SPIKE',severity:'critical',title:`Hausse des erreurs — ${project.name}`,message:`${current.errors} erreurs détectées aujourd’hui.`,dedupe_key:`error-spike:${project.id}:${today}`});
  const bad=(perf||[]).filter((x:any)=>(x.metric==='LCP'&&x.value>4000)||(x.metric==='INP'&&x.value>500)||(x.metric==='CLS'&&x.value>.25));
  if(bad.length>=3)alerts.push({kind:'PERFORMANCE_DEGRADED',severity:'warning',title:`Performances dégradées — ${project.name}`,message:`${bad.length} mesures Web Vitals critiques sur 24 h.`,dedupe_key:`performance:${project.id}:${today}`});
  for(const a of alerts){const {data:existing}=await admin.from('analytics_alerts').select('id').eq('dedupe_key',a.dedupe_key).eq('status','OPEN').maybeSingle();if(!existing)await admin.from('analytics_alerts').insert({...a,project_id:project.id});}
  const activeKeys=alerts.map(a=>a.dedupe_key);for(const key of [`down:${project.id}`,`tracker:${project.id}`,`stale:${project.id}`])if(!activeKeys.includes(key))await admin.from('analytics_alerts').update({status:'RESOLVED',resolved_at:new Date().toISOString(),updated_at:new Date().toISOString()}).eq('dedupe_key',key).eq('status','OPEN');
  return {id:project.id,status,code,responseMs,tracker};
}
Deno.serve(async req=>{
  if(req.method!=='POST')return new Response(JSON.stringify({error:'method_not_allowed'}),{status:405,headers:{'content-type':'application/json'}});
  const secret=req.headers.get('x-analytix-health')||'';const {data:setting}=await admin.from('analytics_internal_settings').select('value').eq('key','health_secret_hash').maybeSingle();
  if(!setting||!secret||await sha(secret)!==setting.value)return new Response(JSON.stringify({error:'unauthorized'}),{status:401,headers:{'content-type':'application/json'}});
  const {data:projects}=await admin.from('analytics_projects').select('id,name,url,version,last_event_at,tracker_last_seen_at').eq('analytics_enabled',true).neq('status','ARCHIVED');
  const results=[];for(let i=0;i<(projects||[]).length;i+=5)results.push(...await Promise.all((projects||[]).slice(i,i+5).map(check)));
  return new Response(JSON.stringify({checked:results.length,results}),{headers:{'content-type':'application/json','cache-control':'no-store'}});
});

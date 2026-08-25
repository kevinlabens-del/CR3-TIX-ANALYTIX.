import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.56.1';
const URL=Deno.env.get('SUPABASE_URL')!,SERVICE=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const admin=createClient(URL,SERVICE,{auth:{persistSession:false,autoRefreshToken:false}});
function cors(origin:string){return {'access-control-allow-origin':origin,'access-control-allow-methods':'POST,OPTIONS','access-control-allow-headers':'authorization,content-type,apikey','content-type':'application/json;charset=utf-8','cache-control':'no-store','vary':'Origin'};}
function reply(body:unknown,status:number,origin:string){return new Response(JSON.stringify(body),{status,headers:cors(origin)});}
function iso(value:unknown,fallback:Date){const d=new Date(String(value||''));return isNaN(d.getTime())?fallback.toISOString():d.toISOString();}
Deno.serve(async req=>{
  const origin=req.headers.get('origin')||'';if(req.method==='OPTIONS')return new Response(null,{status:204,headers:cors(origin)});if(req.method!=='POST')return reply({error:'method_not_allowed'},405,origin);
  const token=(req.headers.get('authorization')||'').replace(/^Bearer\s+/i,'');if(!token)return reply({error:'unauthorized'},401,origin);
  const {data:{user}}=await admin.auth.getUser(token);if(!user)return reply({error:'unauthorized'},401,origin);
  const {data:isAdmin}=await admin.from('analytics_admins').select('user_id').eq('user_id',user.id).maybeSingle();if(!isAdmin)return reply({error:'forbidden'},403,origin);
  let body:any;try{body=await req.json();}catch{return reply({error:'invalid_json'},400,origin);}const action=String(body.action||'overview');
  const now=new Date(),fallback=new Date(now.getTime()-30*86400000);const from=iso(body.from,fallback),to=iso(body.to,now);if(new Date(to).getTime()-new Date(from).getTime()>3660*86400000)return reply({error:'range_too_large'},400,origin);
  if(action==='sync_registry'){const {data,error}=await admin.rpc('analytics_force_registry_sync');return error?reply({error:error.message},400,origin):reply({synced:data},200,origin);}
  if(action==='alert_update'){
    const status=['ACKNOWLEDGED','RESOLVED'].includes(body.status)?body.status:null;if(!status)return reply({error:'invalid_status'},400,origin);
    const {data,error}=await admin.from('analytics_alerts').update({status,resolved_at:status==='RESOLVED'?new Date().toISOString():null,updated_at:new Date().toISOString()}).eq('id',body.id).select().single();return error?reply({error:error.message},400,origin):reply(data,200,origin);
  }
  if(action==='live'){
    const since=new Date(Date.now()-5*60000).toISOString();
    const [sessions,events]=await Promise.all([admin.from('analytics_sessions').select('project_id,session_id,visitor_id,last_seen_at,exit_page,device_type,country_code').gte('last_seen_at',since).order('last_seen_at',{ascending:false}).limit(200),admin.from('analytics_events').select('id,project_id,event_type,occurred_at,page_path,device_type,country_code').gte('occurred_at',since).order('occurred_at',{ascending:false}).limit(100)]);
    return reply({sessions:sessions.data||[],events:events.data||[],generated_at:new Date().toISOString()},200,origin);
  }
  const projectId=body.project_id&&/^[0-9a-f-]{36}$/i.test(body.project_id)?body.project_id:null;
  const scoped=<T>(q:T)=>projectId?(q as any).eq('project_id',projectId):q;
  const dayFrom=from.slice(0,10),dayTo=to.slice(0,10);
  const [projects,daily,dimensions,health,alerts,errors,performance,sessions,events,campaigns]=await Promise.all([
    admin.from('analytics_projects').select('*').order('name'),
    scoped(admin.from('analytics_daily_stats').select('*').gte('day',dayFrom).lte('day',dayTo)).order('day').limit(5000),
    scoped(admin.from('analytics_daily_dimensions').select('*').gte('day',dayFrom).lte('day',dayTo)).order('events',{ascending:false}).limit(4000),
    scoped(admin.from('analytics_health').select('*')).order('checked_at',{ascending:false}),
    scoped(admin.from('analytics_alerts').select('*').gte('created_at',from).lte('created_at',to)).order('created_at',{ascending:false}).limit(500),
    scoped(admin.from('analytics_errors').select('*').gte('last_seen_at',from).lte('last_seen_at',to)).order('occurrences',{ascending:false}).limit(500),
    scoped(admin.from('analytics_performance').select('*').gte('recorded_at',from).lte('recorded_at',to)).order('recorded_at',{ascending:false}).limit(2000),
    scoped(admin.from('analytics_sessions').select('*').gte('started_at',from).lte('started_at',to)).order('started_at',{ascending:false}).limit(2000),
    scoped(admin.from('analytics_events').select('id,project_id,event_type,occurred_at,page_path,source,medium,campaign,country_code,device_type,browser,os,properties').gte('occurred_at',from).lte('occurred_at',to)).order('occurred_at',{ascending:false}).limit(2500),
    scoped(admin.from('analytics_campaigns').select('*').gte('day',dayFrom).lte('day',dayTo)).order('sessions',{ascending:false}).limit(1000)
  ]);
  const failure=[projects,daily,dimensions,health,alerts,errors,performance,sessions,events,campaigns].find(x=>x.error);if(failure?.error)return reply({error:failure.error.message},500,origin);
  return reply({projects:projects.data||[],daily:daily.data||[],dimensions:dimensions.data||[],health:health.data||[],alerts:alerts.data||[],errors:errors.data||[],performance:performance.data||[],sessions:sessions.data||[],events:events.data||[],campaigns:campaigns.data||[],range:{from,to}},200,origin);
});

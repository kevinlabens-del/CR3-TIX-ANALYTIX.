import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.56.1';

const SUPABASE_URL=Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const admin=createClient(SUPABASE_URL,SERVICE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
const encoder=new TextEncoder();
const EVENT=/^[a-z][a-z0-9_]{0,63}$/;
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const COUNTRY=/^[A-Z]{2}$/;
const GEO_TTL_MS=24*60*60*1000;

function cors(origin:string){return {'access-control-allow-origin':origin,'access-control-allow-methods':'POST,OPTIONS','access-control-allow-headers':'content-type','access-control-max-age':'86400','vary':'Origin'};}
function json(body:unknown,status:number,origin:string){return new Response(JSON.stringify(body),{status,headers:{...cors(origin),'content-type':'application/json;charset=utf-8','cache-control':'no-store'}});}
function cleanText(value:unknown,max=500){return typeof value==='string'?value.replace(/[\u0000-\u001f\u007f]/g,' ').trim().slice(0,max):undefined;}
function cleanPath(value:unknown){const raw=cleanText(value,500)||'/';try{const u=new URL(raw,'https://local.invalid');return (u.pathname||'/').slice(0,500);}catch{return '/';}}
function cleanObject(value:unknown,depth=0):Record<string,unknown>{
  if(!value||typeof value!=='object'||Array.isArray(value)||depth>2)return {};
  const out:Record<string,unknown>={};
  for(const [key,raw] of Object.entries(value as Record<string,unknown>).slice(0,32)){
    if(/email|phone|name|address|password|token|secret|cookie|authorization|ip/i.test(key))continue;
    const k=key.replace(/[^a-zA-Z0-9_.-]/g,'').slice(0,48); if(!k)continue;
    if(typeof raw==='string')out[k]=cleanText(raw,300);
    else if(typeof raw==='number'&&Number.isFinite(raw))out[k]=raw;
    else if(typeof raw==='boolean'||raw===null)out[k]=raw;
    else if(typeof raw==='object')out[k]=cleanObject(raw,depth+1);
  }
  return out;
}
async function sha(value:string){const data=await crypto.subtle.digest('SHA-256',encoder.encode(value));return [...new Uint8Array(data)].map(b=>b.toString(16).padStart(2,'0')).join('');}
function countryHeader(req:Request){
  for(const h of ['cf-ipcountry','x-vercel-ip-country','x-country-code','x-client-country']){
    const v=(req.headers.get(h)||'').trim().toUpperCase();
    if(COUNTRY.test(v)&&v!=='XX')return v;
  }
  return null;
}
function clientIp(req:Request){
  let raw=(req.headers.get('x-forwarded-for')||req.headers.get('x-real-ip')||'').split(',')[0].trim();
  if(!raw)return null;
  raw=raw.replace(/^"|"$/g,'');
  const bracket=raw.match(/^\[([0-9a-f:]+)\](?::\d+)?$/i); if(bracket)raw=bracket[1];
  const ipv4Port=raw.match(/^(\d{1,3}(?:\.\d{1,3}){3})(?::\d+)?$/); if(ipv4Port)raw=ipv4Port[1];
  if(/^\d{1,3}(?:\.\d{1,3}){3}$/.test(raw)){
    const p=raw.split('.').map(Number);if(p.some(x=>x<0||x>255))return null;
    if(p[0]===10||p[0]===127||(p[0]===169&&p[1]===254)||(p[0]===172&&p[1]>=16&&p[1]<=31)||(p[0]===192&&p[1]===168))return null;
    return raw;
  }
  if(/^[0-9a-f:]+$/i.test(raw)&&raw.includes(':')){
    const l=raw.toLowerCase();if(l==='::1'||l.startsWith('fc')||l.startsWith('fd')||l.startsWith('fe80:'))return null;
    return raw;
  }
  return null;
}
async function resolveCountry(req:Request,hash:string){
  const fromHeader=countryHeader(req);if(fromHeader)return fromHeader;
  const ip=clientIp(req);if(!ip)return null;
  const now=new Date();
  try{
    const {data:cached}=await admin.from('analytics_geo_cache').select('country_code,expires_at').eq('client_hash',hash).gt('expires_at',now.toISOString()).maybeSingle();
    const cc=String(cached?.country_code||'').toUpperCase();if(COUNTRY.test(cc))return cc;
  }catch{/* La géolocalisation ne doit jamais bloquer la collecte. */}
  try{
    const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),1800);
    const res=await fetch(`https://ipwho.is/${encodeURIComponent(ip)}?fields=success,country_code`,{signal:controller.signal,headers:{'accept':'application/json','user-agent':'CR3ATIX-ANALYTIX/1.1'}});
    clearTimeout(timer);
    if(!res.ok)return null;
    const body=await res.json();const cc=String(body?.country_code||'').trim().toUpperCase();
    if(body?.success!==true||!COUNTRY.test(cc)||cc==='XX')return null;
    await admin.from('analytics_geo_cache').delete().lt('expires_at',now.toISOString());
    await admin.from('analytics_geo_cache').upsert({client_hash:hash,country_code:cc,expires_at:new Date(Date.now()+GEO_TTL_MS).toISOString(),updated_at:new Date().toISOString()},{onConflict:'client_hash'});
    return cc;
  }catch{return null;}
}

Deno.serve(async req=>{
  const origin=req.headers.get('origin')||'';
  if(req.method==='OPTIONS')return new Response(null,{status:204,headers:cors(origin)});
  if(req.method!=='POST')return json({error:'method_not_allowed'},405,origin);
  const length=Number(req.headers.get('content-length')||0); if(length>65536)return json({error:'payload_too_large'},413,origin);
  let raw='';try{raw=await req.text();}catch{return json({error:'invalid_body'},400,origin);} if(encoder.encode(raw).byteLength>65536)return json({error:'payload_too_large'},413,origin);
  let body:any;try{body=JSON.parse(raw);}catch{return json({error:'invalid_json'},400,origin);}
  if(!body||typeof body!=='object'||!UUID.test(body.project_id||'')||!UUID.test(body.project_key||'')||!UUID.test(body.visitor_id||'')||!UUID.test(body.session_id||''))return json({error:'invalid_identifiers'},400,origin);
  if(!Array.isArray(body.events)||body.events.length<1||body.events.length>20)return json({error:'invalid_batch'},400,origin);
  const {data:project}=await admin.from('analytics_projects').select('id,tracking_key,allowed_origins,analytics_enabled,status').eq('id',body.project_id).maybeSingle();
  if(!project||project.tracking_key!==body.project_key||!project.analytics_enabled||project.status==='ARCHIVED')return json({error:'unknown_project'},404,origin);
  const allowed=(project.allowed_origins||[]) as string[];
  const dev=/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
  if(!origin||(!allowed.includes(origin)&&!dev))return json({error:'origin_not_allowed'},403,origin);
  const events=[];
  for(const item of body.events){
    if(!item||typeof item!=='object'||!EVENT.test(String(item.type||'')))return json({error:'invalid_event'},400,origin);
    const props=cleanObject(item.properties); if(encoder.encode(JSON.stringify(props)).byteLength>4096)return json({error:'properties_too_large'},413,origin);
    const parsedTime=new Date(String(item.timestamp||''));
    events.push({id:UUID.test(item.id||'')?item.id:crypto.randomUUID(),type:String(item.type),timestamp:Number.isNaN(parsedTime.getTime())?new Date().toISOString():parsedTime.toISOString(),path:cleanPath(item.path),title:cleanText(item.title,300),properties:props});
  }
  const c=body.context||{};
  const context={page_path:cleanPath(c.page_path),referrer:cleanText(c.referrer,500),source:cleanText(c.source,120),medium:cleanText(c.medium,120),utm_source:cleanText(c.utm_source,120),utm_medium:cleanText(c.utm_medium,120),utm_campaign:cleanText(c.utm_campaign,160),utm_content:cleanText(c.utm_content,160),utm_term:cleanText(c.utm_term,160),device_type:cleanText(c.device_type,40),browser:cleanText(c.browser,80),os:cleanText(c.os,80)};
  const ip=clientIp(req)||'0';
  const day=new Date().toISOString().slice(0,10); const clientHash=await sha(`${day}|${project.id}|${ip}|cr3atix`);
  const country=await resolveCountry(req,clientHash);
  const {data,error}=await admin.rpc('analytics_ingest_batch',{p_project_id:project.id,p_visitor_id:body.visitor_id,p_session_id:body.session_id,p_events:events,p_context:context,p_client_hash:clientHash,p_country_code:country});
  if(error){console.error('ingest',error.code,error.message);const status=error.message.includes('rate_limited')?429:400;return json({error:status===429?'rate_limited':'rejected'},status,origin);}
  if(country){
    await admin.from('analytics_sessions').update({country_code:country}).eq('project_id',project.id).eq('session_id',body.session_id).is('country_code',null);
  }
  return json(data,202,origin);
});

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.56.1';

const SUPABASE_URL=Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const admin=createClient(SUPABASE_URL,SERVICE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
const encoder=new TextEncoder();
const EVENT=/^[a-z][a-z0-9_]{0,63}$/;
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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
  const forwarded=(req.headers.get('x-forwarded-for')||'0').split(',')[0].trim();
  const day=new Date().toISOString().slice(0,10); const clientHash=await sha(`${day}|${project.id}|${forwarded}|cr3atix`);
  const country=(req.headers.get('cf-ipcountry')||req.headers.get('x-vercel-ip-country')||'').toUpperCase().slice(0,2)||null;
  const {data,error}=await admin.rpc('analytics_ingest_batch',{p_project_id:project.id,p_visitor_id:body.visitor_id,p_session_id:body.session_id,p_events:events,p_context:context,p_client_hash:clientHash,p_country_code:country});
  if(error){console.error('ingest',error.code,error.message);const status=error.message.includes('rate_limited')?429:400;return json({error:status===429?'rate_limited':'rejected'},status,origin);}
  return json(data,202,origin);
});

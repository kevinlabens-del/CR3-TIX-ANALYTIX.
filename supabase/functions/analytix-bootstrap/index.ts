import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.56.1';
const URL=Deno.env.get('SUPABASE_URL')!;const SERVICE=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const admin=createClient(URL,SERVICE,{auth:{persistSession:false,autoRefreshToken:false}});const enc=new TextEncoder();
const allowed=/^https:\/\/kevinlabens-del\.github\.io$/;
function headers(origin:string){return {'access-control-allow-origin':origin,'access-control-allow-methods':'GET,POST,OPTIONS','access-control-allow-headers':'content-type','content-type':'application/json','cache-control':'no-store','vary':'Origin'};}
async function hash(v:string){return [...new Uint8Array(await crypto.subtle.digest('SHA-256',enc.encode(v)))].map(b=>b.toString(16).padStart(2,'0')).join('');}
Deno.serve(async req=>{
  const origin=req.headers.get('origin')||''; if(req.method==='OPTIONS')return new Response(null,{status:204,headers:headers(origin)});
  if(!allowed.test(origin)&&!/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin))return new Response(JSON.stringify({error:'origin_not_allowed'}),{status:403,headers:headers(origin)});
  const {data:boot}=await admin.from('analytics_bootstrap').select('claimed_at').eq('id',true).maybeSingle();
  if(req.method==='GET')return new Response(JSON.stringify({setup_required:!boot?.claimed_at}),{headers:headers(origin)});
  if(req.method!=='POST'||boot?.claimed_at)return new Response(JSON.stringify({error:boot?.claimed_at?'already_configured':'method_not_allowed'}),{status:boot?.claimed_at?409:405,headers:headers(origin)});
  let body:any;try{body=await req.json();}catch{return new Response(JSON.stringify({error:'invalid_json'}),{status:400,headers:headers(origin)});}
  const email=String(body.email||'').trim().toLowerCase(),password=String(body.password||''),token=String(body.token||'');
  if(!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)||password.length<12||!/^[a-f0-9]{48}$/i.test(token))return new Response(JSON.stringify({error:'invalid_setup'}),{status:400,headers:headers(origin)});
  const {data:record}=await admin.from('analytics_bootstrap').select('token_hash,claimed_at').eq('id',true).single();
  if(!record||record.claimed_at||await hash(token)!==record.token_hash)return new Response(JSON.stringify({error:'invalid_token'}),{status:401,headers:headers(origin)});
  const {data:created,error}=await admin.auth.admin.createUser({email,password,email_confirm:true,app_metadata:{role:'analytix_admin'}});
  if(error||!created.user)return new Response(JSON.stringify({error:'user_creation_failed',detail:error?.message}),{status:400,headers:headers(origin)});
  const {data:claimed,error:claimError}=await admin.rpc('analytics_claim_bootstrap',{p_user_id:created.user.id,p_email:email});
  if(claimError||!claimed){await admin.auth.admin.deleteUser(created.user.id);return new Response(JSON.stringify({error:'claim_failed'}),{status:409,headers:headers(origin)});}
  return new Response(JSON.stringify({ok:true}),{status:201,headers:headers(origin)});
});

import { createClient, type Session } from '@supabase/supabase-js';

export const SUPABASE_URL='https://gwqojqwcbwoulxrctaqz.supabase.co';
export const SUPABASE_KEY='sb_publishable_dGDmhiMdBSuFW8ffS3zMuA_KZ4dj2YH';
export const supabase=createClient(SUPABASE_URL,SUPABASE_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});

export async function bootstrapStatus(){const r=await fetch(`${SUPABASE_URL}/functions/v1/analytix-bootstrap`,{cache:'no-store'});if(!r.ok)throw new Error('Configuration inaccessible');return r.json();}
export async function bootstrap(email:string,password:string,token:string){const r=await fetch(`${SUPABASE_URL}/functions/v1/analytix-bootstrap`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({email,password,token})});const j=await r.json();if(!r.ok)throw new Error(j.error||'Configuration refusée');return j;}
export async function api(session:Session,body:Record<string,unknown>){const r=await fetch(`${SUPABASE_URL}/functions/v1/analytix-api`,{method:'POST',headers:{authorization:`Bearer ${session.access_token}`,'content-type':'application/json',apikey:SUPABASE_KEY},body:JSON.stringify(body)});const j=await r.json();if(!r.ok)throw new Error(j.error||'Erreur API');return j;}

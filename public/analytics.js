/* CR3@TIX ANALYTIX tracker v1.0.1 — privacy-first, dependency-free, fail-safe */
(function(w,d){
  'use strict';
  try{
    var script=d.currentScript||d.querySelector('script[data-project-id][data-project-key]');
    var PROJECT=script&&script.getAttribute('data-project-id'),KEY=script&&script.getAttribute('data-project-key');
    var ENDPOINT=(script&&script.getAttribute('data-endpoint'))||'https://gwqojqwcbwoulxrctaqz.supabase.co/functions/v1/analytix-collect';
    var disabled=!PROJECT||!KEY||w.localStorage.getItem('cr3atix_analytics_optout')==='1'||navigator.doNotTrack==='1'||navigator.globalPrivacyControl===true;
    var uuid=function(){return crypto&&crypto.randomUUID?crypto.randomUUID():'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g,function(c){var r=Math.random()*16|0,v=c==='x'?r:(r&3|8);return v.toString(16);});};
    var now=Date.now(),visitor,session,sessionAt;
    try{visitor=localStorage.getItem('cr3atix_av');if(!visitor){visitor=uuid();localStorage.setItem('cr3atix_av',visitor);}var saved=JSON.parse(sessionStorage.getItem('cr3atix_as')||'null');if(saved&&now-saved.at<1800000){session=saved.id;sessionAt=saved.at;}else{session=uuid();sessionAt=now;}sessionStorage.setItem('cr3atix_as',JSON.stringify({id:session,at:now}));}catch(e){visitor=uuid();session=uuid();sessionAt=now;}
    var queue=[],sending=false,lastPath='',engaged=0,visibleAt=!d.hidden?Date.now():0;
    var trim=function(v,n){return String(v==null?'':v).replace(/[\u0000-\u001f\u007f]/g,' ').slice(0,n||300);};
    var path=function(){return (location.pathname||'/').slice(0,500);};
    var param=function(k){try{return new URLSearchParams(location.search).get(k)||'';}catch(e){return '';}};
    var browser=function(){var u=navigator.userAgent;if(/Edg\//.test(u))return'Edge';if(/Firefox\//.test(u))return'Firefox';if(/CriOS|Chrome\//.test(u))return'Chrome';if(/Safari\//.test(u))return'Safari';return'Autre';};
    var os=function(){var u=navigator.userAgent;if(/Android/.test(u))return'Android';if(/iPhone|iPad/.test(u))return'iOS';if(/Windows/.test(u))return'Windows';if(/Mac OS/.test(u))return'macOS';if(/Linux/.test(u))return'Linux';return'Autre';};
    var device=function(){var width=Math.min(screen.width||innerWidth,screen.height||innerHeight);return /Tablet|iPad/.test(navigator.userAgent)||(width>=600&&width<1024)?'tablet':(/Mobi|Android|iPhone/.test(navigator.userAgent)||width<600?'mobile':'desktop');};
    var source=function(){var u=param('utm_source');if(u)return u;var r=d.referrer;if(!r)return'Direct';try{var h=new URL(r).hostname;if(/google\./.test(h))return'Google';if(/facebook|fb\./.test(h))return'Facebook';if(/tiktok/.test(h))return'TikTok';if(/instagram/.test(h))return'Instagram';if(/youtube/.test(h))return'YouTube';return h;}catch(e){return'Referral';}};
    var context=function(){return{page_path:path(),referrer:d.referrer?trim(d.referrer.split('?')[0],500):'',source:source(),medium:param('utm_medium')||(source()==='Direct'?'(none)':'referral'),utm_source:param('utm_source'),utm_medium:param('utm_medium'),utm_campaign:param('utm_campaign'),utm_content:param('utm_content'),utm_term:param('utm_term'),device_type:device(),browser:browser(),os:os()};};
    var baseProps=function(){return{language:navigator.language||'',timezone:(Intl.DateTimeFormat().resolvedOptions().timeZone||''),screen_width:screen.width,screen_height:screen.height,viewport_width:innerWidth,viewport_height:innerHeight,orientation:(screen.orientation&&screen.orientation.type)||'',online:navigator.onLine,display_mode:matchMedia('(display-mode: standalone)').matches||navigator.standalone?'standalone':'browser'};};
    function track(type,properties){if(disabled||!/^[a-z][a-z0-9_]{0,63}$/.test(type))return false;var p=Object.assign({},properties||{});queue.push({id:uuid(),type:type,timestamp:new Date().toISOString(),path:path(),title:trim(d.title,300),properties:p});if(queue.length>=10)flush();return true;}
    function flush(beacon){if(disabled||sending||!queue.length)return;var batch=queue.splice(0,20),payload=JSON.stringify({project_id:PROJECT,project_key:KEY,visitor_id:visitor,session_id:session,events:batch,context:context()});
      if(beacon&&navigator.sendBeacon){try{if(navigator.sendBeacon(ENDPOINT,new Blob([payload],{type:'text/plain;charset=UTF-8'})))return;}catch(e){}}
      sending=true;fetch(ENDPOINT,{method:'POST',headers:{'content-type':'text/plain;charset=UTF-8'},body:payload,keepalive:!!beacon,credentials:'omit',mode:'cors'}).then(function(r){if(!r.ok&&r.status!==400&&r.status!==403&&r.status!==404)queue=batch.concat(queue);}).catch(function(){queue=batch.concat(queue).slice(-50);}).finally(function(){sending=false;});
    }
    function pageview(){var p=path();if(p===lastPath)return;lastPath=p;track('pageview',baseProps());}
    function engagement(){if(engaged>0){track('engagement',{seconds:Math.min(engaged,300)});engaged=0;}}
    w.CreatixAnalytics={track:track,flush:flush,optOut:function(){try{localStorage.setItem('cr3atix_analytics_optout','1');}catch(e){}disabled=true;queue=[];},optIn:function(){try{localStorage.removeItem('cr3atix_analytics_optout');}catch(e){}location.reload();},version:'1.0.1'};
    if(disabled)return;
    track('session_start',baseProps());pageview();
    var originalPush=history.pushState,originalReplace=history.replaceState;history.pushState=function(){originalPush.apply(this,arguments);setTimeout(pageview,0);};history.replaceState=function(){originalReplace.apply(this,arguments);setTimeout(pageview,0);};addEventListener('popstate',pageview);
    d.addEventListener('visibilitychange',function(){if(d.hidden){if(visibleAt)engaged+=Math.round((Date.now()-visibleAt)/1000);visibleAt=0;engagement();flush(true);}else visibleAt=Date.now();});
    addEventListener('pagehide',function(){if(visibleAt)engaged+=Math.round((Date.now()-visibleAt)/1000);track('session_end',{duration_seconds:Math.round((Date.now()-sessionAt)/1000)});engagement();flush(true);});
    d.addEventListener('click',function(e){var el=e.target&&e.target.closest?e.target.closest('a,button,[data-analytics-event]'):null;if(!el)return;var custom=el.getAttribute('data-analytics-event');if(custom)track(custom,{label:trim(el.getAttribute('data-analytics-label')||el.textContent,120)});if(el.tagName==='A'){var href=el.href||'',external=false;try{external=new URL(href).origin!==location.origin;}catch(x){}if(external)track('external_link',{url:trim(href.split('?')[0],300)});if(/\.(pdf|zip|apk|csv|json|docx?|xlsx?)($|#|\?)/i.test(href))track('download',{file:trim(href.split('?')[0],300)});}},true);
    addEventListener('online',function(){track('online');flush();});addEventListener('offline',function(){track('offline');});addEventListener('appinstalled',function(){track('install');});addEventListener('fullscreenchange',function(){track('fullscreen',{active:!!d.fullscreenElement});});
    addEventListener('error',function(e){var msg=trim(e.message||'Erreur JavaScript',300),src=trim((e.filename||'').split('?')[0],200);track('js_error',{message:msg,source:src,line:e.lineno||0,column:e.colno||0,fingerprint:simpleHash(msg+'|'+src)});});
    addEventListener('unhandledrejection',function(e){var msg=trim(e.reason&&e.reason.message||e.reason||'Promesse rejetée',300);track('unhandled_rejection',{message:msg,fingerprint:simpleHash(msg)});});
    function simpleHash(s){var h=2166136261;for(var i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619);}return('00000000'+(h>>>0).toString(16)).slice(-8);}
    function vital(metric,value,rating){track('web_vital',{metric:metric,value:Math.round(value*1000)/1000,rating:rating});}
    try{new PerformanceObserver(function(list){list.getEntries().forEach(function(x){if(x.entryType==='largest-contentful-paint')vital('LCP',x.startTime,x.startTime<=2500?'good':x.startTime<=4000?'needs-improvement':'poor');});}).observe({type:'largest-contentful-paint',buffered:true});}catch(e){}
    try{new PerformanceObserver(function(list){list.getEntries().forEach(function(x){var v=x.duration;vital('INP',v,v<=200?'good':v<=500?'needs-improvement':'poor');});}).observe({type:'event',buffered:true,durationThreshold:40});}catch(e){}
    try{var cls=0;new PerformanceObserver(function(list){list.getEntries().forEach(function(x){if(!x.hadRecentInput)cls+=x.value;});vital('CLS',cls,cls<=.1?'good':cls<=.25?'needs-improvement':'poor');}).observe({type:'layout-shift',buffered:true});}catch(e){}
    addEventListener('load',function(){setTimeout(function(){var nav=performance.getEntriesByType('navigation')[0];if(nav){vital('TTFB',nav.responseStart,nav.responseStart<=800?'good':nav.responseStart<=1800?'needs-improvement':'poor');vital('LOAD',nav.loadEventEnd,nav.loadEventEnd<=2500?'good':nav.loadEventEnd<=4000?'needs-improvement':'poor');}},0);});
    setInterval(function(){if(!d.hidden&&visibleAt){engaged+=Math.round((Date.now()-visibleAt)/1000);visibleAt=Date.now();engagement();}flush();},60000);setInterval(flush,3000);
  }catch(fatal){/* Analytics must never break the host project. */}
})(window,document);

module.exports=[93695,(e,t,r)=>{t.exports=e.x("next/dist/shared/lib/no-fallback-error.external.js",()=>require("next/dist/shared/lib/no-fallback-error.external.js"))},32319,(e,t,r)=>{t.exports=e.x("next/dist/server/app-render/work-unit-async-storage.external.js",()=>require("next/dist/server/app-render/work-unit-async-storage.external.js"))},24725,(e,t,r)=>{t.exports=e.x("next/dist/server/app-render/after-task-async-storage.external.js",()=>require("next/dist/server/app-render/after-task-async-storage.external.js"))},18622,(e,t,r)=>{t.exports=e.x("next/dist/compiled/next-server/app-page-turbo.runtime.prod.js",()=>require("next/dist/compiled/next-server/app-page-turbo.runtime.prod.js"))},56704,(e,t,r)=>{t.exports=e.x("next/dist/server/app-render/work-async-storage.external.js",()=>require("next/dist/server/app-render/work-async-storage.external.js"))},70406,(e,t,r)=>{t.exports=e.x("next/dist/compiled/@opentelemetry/api",()=>require("next/dist/compiled/@opentelemetry/api"))},7223,e=>{"use strict";var t=e.i(47909),r=e.i(74017),n=e.i(96250),a=e.i(59756),s=e.i(61916),i=e.i(74677),o=e.i(69741),l=e.i(16795),u=e.i(87718),d=e.i(95169),c=e.i(47587),p=e.i(66012),x=e.i(70101),m=e.i(26937),h=e.i(10372),g=e.i(93695);e.i(52474);var v=e.i(220),f=e.i(89171),R=e.i(60070);async function w(e){try{let t=await (0,R.getTokenFromCookies)();if(!t)return f.NextResponse.json({error:"Non authentifié. Connectez votre compte LinkedIn."},{status:401});let{searchParams:r}=new URL(e.url),n=r.get("linkedinId");if(!n)return f.NextResponse.json({error:"L'ID LinkedIn est requis"},{status:400});let a=`urn:li:person:${n}`,s=`https://api.linkedin.com/v2/shares?q=owners&owners=${encodeURIComponent(a)}&count=10`,i=await fetch(s,{headers:{Authorization:`Bearer ${t}`}});if(!i.ok){let e=await i.text();return console.error("LinkedIn feed fetch failed:",i.status,e),f.NextResponse.json({simulated:!0,message:"L'API LinkedIn Feed nécessite un accès Marketing Developer Platform. Affichage du mode aperçu.",posts:[{id:"sim-1",text:`Le saviez-vous ? 78% des d\xe9cideurs B2B pr\xe9f\xe8rent \xeatre contact\xe9s par un pair plut\xf4t que par un commercial.

C'est exactement pourquoi les agents IA changent la donne en mati\xe8re de prospection :

→ Ils identifient les signaux d'achat en temps r\xe9el
→ Ils personnalisent chaque premier message \xe0 partir du contexte
→ Ils maintiennent le suivi sans que vous n'ayez \xe0 y penser

Le r\xe9sultat ? Un taux de r\xe9ponse 3x sup\xe9rieur aux s\xe9quences traditionnelles.

Qui utilise d\xe9j\xe0 l'IA dans sa prospection ? 👇`,author:"Sophie Martin",authorRole:"CEO @ AutomatePro",createdAt:new Date(Date.now()-18e5).toISOString(),likes:142,comments:23,visibility:"PUBLIC"},{id:"sim-2",text:`J'ai automatis\xe9 100% de ma prospection LinkedIn en 30 jours.

Voici ce qui a chang\xe9 :

📊 156 profils qualifi\xe9s / semaine (vs 12 avant)
📧 28 messages personnalis\xe9s / jour (vs 5)
🎯 8 RDV g\xe9n\xe9r\xe9s / semaine (vs 2)

Le secret ? 3 agents IA qui travaillent 24/7 :
1️⃣ Agent Contenu → publie chaque matin
2️⃣ Agent Qualification → collecte et score les leads
3️⃣ Agent Prospection → envoie les messages et g\xe8re les relances

Le tout sans un seul cold call.

D\xe9tail du setup en commentaire 👇`,author:"Thomas Dubois",authorRole:"Head of Growth @ ScaleUp",createdAt:new Date(Date.now()-72e5).toISOString(),likes:287,comments:45,visibility:"PUBLIC"},{id:"sim-3",text:`Le scoring ICP, c'est pas un buzzword. C'est du math.

Score = (Titre match \xd7 30) + (Secteur match \xd7 20) + (Taille entreprise \xd7 20) + (Engagement \xd7 15) + (Connexion 1er degr\xe9 \xd7 15)

Un prospect \xe0 80+ ? Vous le contactez en priorit\xe9.
Un prospect \xe0 40- ? Vous l'archivez automatiquement.

R\xe9sultat : 60% de temps gagn\xe9 sur la qualification manuelle.

Combien de temps passez-vous \xe0 qualifier vos leads manuellement ?`,author:"Léa Chen",authorRole:"Directrice Marketing @ DataPulse",createdAt:new Date(Date.now()-18e6).toISOString(),likes:94,comments:12,visibility:"PUBLIC"},{id:"sim-4",text:`Stop aux messages LinkedIn copi\xe9s-coll\xe9s.

"Bonjour, je me permets de vous contacter car..."

Non. Arr\xeatez. S\xe9rieusement.

La bonne approche :
✅ R\xe9f\xe9rencez une action pr\xe9cise (un post, un commentaire)
✅ Ajoutez UNE valeur sp\xe9cifique \xe0 leur secteur
✅ Posez UNE question ouverte

80 mots max. Pas de pitch. Pas de lien Calendly.

Le but du 1er message ? Obtenir une r\xe9ponse. Pas un RDV.

Qui est d'accord ? 🤝`,author:"Pierre Lefèvre",authorRole:"Co-fondateur @ GrowthLab",createdAt:new Date(Date.now()-288e5).toISOString(),likes:312,comments:67,visibility:"PUBLIC"},{id:"sim-5",text:`L'IA ne remplace pas les commerciaux.

Elle leur redonne du temps.

Temps pour les conversations qui comptent vraiment.
Temps pour les n\xe9gos complexes.
Temps pour la strat\xe9gie au lieu du data entry.

Le commercial de demain ? Un chef d'orchestre d'agents IA.

Pas un ex\xe9cutant de t\xe2ches r\xe9p\xe9titives.

Votre avis ? L'IA va-t-elle renforcer ou affaiblir le r\xf4le commercial ?`,author:"Camille Rousseau",authorRole:"VP Sales @ CloudPeak",createdAt:new Date(Date.now()-864e5).toISOString(),likes:198,comments:34,visibility:"PUBLIC"},{id:"sim-6",text:`Thread 🧵 : Comment j'ai construit mon syst\xe8me de prospection LinkedIn automatis\xe9

1/ Setup : HERM\xc8S Dashboard + 3 agents IA
- Agent Contenu : publie 5x/semaine \xe0 8h
- Agent Qualification : scan les interactions toutes les 4h  
- Agent Prospection : envoie les messages toutes les 2h

2/ R\xe9sultats apr\xe8s 30 jours :
- 156 profils collect\xe9s
- 34 leads qualifi\xe9s (score ≥ 60)
- 28 messages envoy\xe9s
- 8 RDVs g\xe9n\xe9r\xe9s

3/ Le secret : la boucle de r\xe9troaction
Chaque action alimente la suivante. Le contenu attire → les interactions qualifient → la prospection convertit.

D\xe9tails techniques dans le thread 👇`,author:"Antoine Mercier",authorRole:"Fondateur @ NexaConsulting",createdAt:new Date(Date.now()-1296e5).toISOString(),likes:421,comments:89,visibility:"PUBLIC"}]})}let o=((await i.json()).elements||[]).map(e=>({id:e.id||e.updateKey||String(Math.random()),text:e.commentary||e.text?.text||"",author:e.owner||"",createdAt:e.created?.time||new Date().toISOString(),likes:0,comments:0,visibility:e.visibility?.code||"PUBLIC"}));return f.NextResponse.json({simulated:!1,posts:o})}catch(e){return console.error("LinkedIn feed error:",e),f.NextResponse.json({error:"Erreur interne du serveur"},{status:500})}}e.s(["GET",()=>w],50297);var C=e.i(50297);let A=new t.AppRouteRouteModule({definition:{kind:r.RouteKind.APP_ROUTE,page:"/api/linkedin/feed/route",pathname:"/api/linkedin/feed",filename:"route",bundlePath:""},distDir:".next",relativeProjectDir:"",resolvedPagePath:"[project]/src/app/api/linkedin/feed/route.ts",nextConfigOutput:"standalone",userland:C}),{workAsyncStorage:y,workUnitAsyncStorage:I,serverHooks:E}=A;function k(){return(0,n.patchFetch)({workAsyncStorage:y,workUnitAsyncStorage:I})}async function b(e,t,n){A.isDev&&(0,a.addRequestMeta)(e,"devRequestTimingInternalsEnd",process.hrtime.bigint());let f="/api/linkedin/feed/route";f=f.replace(/\/index$/,"")||"/";let R=await A.prepare(e,t,{srcPage:f,multiZoneDraftMode:!1});if(!R)return t.statusCode=400,t.end("Bad Request"),null==n.waitUntil||n.waitUntil.call(n,Promise.resolve()),null;let{buildId:w,params:C,nextConfig:y,parsedUrl:I,isDraftMode:E,prerenderManifest:k,routerServerContext:b,isOnDemandRevalidate:P,revalidateOnlyGenerated:S,resolvedPathname:q,clientReferenceManifest:L,serverActionsManifest:D}=R,N=(0,o.normalizeAppPath)(f),T=!!(k.dynamicRoutes[N]||k.routes[q]),U=async()=>((null==b?void 0:b.render404)?await b.render404(e,t,I,!1):t.end("This page could not be found"),null);if(T&&!E){let e=!!k.routes[q],t=k.dynamicRoutes[N];if(t&&!1===t.fallback&&!e){if(y.experimental.adapterPath)return await U();throw new g.NoFallbackError}}let j=null;!T||A.isDev||E||(j="/index"===(j=q)?"/":j);let O=!0===A.isDev||!T,_=T&&!O;D&&L&&(0,i.setManifestsSingleton)({page:f,clientReferenceManifest:L,serverActionsManifest:D});let H=e.method||"GET",M=(0,s.getTracer)(),B=M.getActiveScopeSpan(),z={params:C,prerenderManifest:k,renderOpts:{experimental:{authInterrupts:!!y.experimental.authInterrupts},cacheComponents:!!y.cacheComponents,supportsDynamicResponse:O,incrementalCache:(0,a.getRequestMeta)(e,"incrementalCache"),cacheLifeProfiles:y.cacheLife,waitUntil:n.waitUntil,onClose:e=>{t.on("close",e)},onAfterTaskError:void 0,onInstrumentationRequestError:(t,r,n,a)=>A.onRequestError(e,t,n,a,b)},sharedContext:{buildId:w}},$=new l.NodeNextRequest(e),F=new l.NodeNextResponse(t),V=u.NextRequestAdapter.fromNodeNextRequest($,(0,u.signalFromNodeResponse)(t));try{let i=async e=>A.handle(V,z).finally(()=>{if(!e)return;e.setAttributes({"http.status_code":t.statusCode,"next.rsc":!1});let r=M.getRootSpanAttributes();if(!r)return;if(r.get("next.span_type")!==d.BaseServerSpan.handleRequest)return void console.warn(`Unexpected root span type '${r.get("next.span_type")}'. Please report this Next.js issue https://github.com/vercel/next.js`);let n=r.get("next.route");if(n){let t=`${H} ${n}`;e.setAttributes({"next.route":n,"http.route":n,"next.span_name":t}),e.updateName(t)}else e.updateName(`${H} ${f}`)}),o=!!(0,a.getRequestMeta)(e,"minimalMode"),l=async a=>{var s,l;let u=async({previousCacheEntry:r})=>{try{if(!o&&P&&S&&!r)return t.statusCode=404,t.setHeader("x-nextjs-cache","REVALIDATED"),t.end("This page could not be found"),null;let s=await i(a);e.fetchMetrics=z.renderOpts.fetchMetrics;let l=z.renderOpts.pendingWaitUntil;l&&n.waitUntil&&(n.waitUntil(l),l=void 0);let u=z.renderOpts.collectedTags;if(!T)return await (0,p.sendResponse)($,F,s,z.renderOpts.pendingWaitUntil),null;{let e=await s.blob(),t=(0,x.toNodeOutgoingHttpHeaders)(s.headers);u&&(t[h.NEXT_CACHE_TAGS_HEADER]=u),!t["content-type"]&&e.type&&(t["content-type"]=e.type);let r=void 0!==z.renderOpts.collectedRevalidate&&!(z.renderOpts.collectedRevalidate>=h.INFINITE_CACHE)&&z.renderOpts.collectedRevalidate,n=void 0===z.renderOpts.collectedExpire||z.renderOpts.collectedExpire>=h.INFINITE_CACHE?void 0:z.renderOpts.collectedExpire;return{value:{kind:v.CachedRouteKind.APP_ROUTE,status:s.status,body:Buffer.from(await e.arrayBuffer()),headers:t},cacheControl:{revalidate:r,expire:n}}}}catch(t){throw(null==r?void 0:r.isStale)&&await A.onRequestError(e,t,{routerKind:"App Router",routePath:f,routeType:"route",revalidateReason:(0,c.getRevalidateReason)({isStaticGeneration:_,isOnDemandRevalidate:P})},!1,b),t}},d=await A.handleResponse({req:e,nextConfig:y,cacheKey:j,routeKind:r.RouteKind.APP_ROUTE,isFallback:!1,prerenderManifest:k,isRoutePPREnabled:!1,isOnDemandRevalidate:P,revalidateOnlyGenerated:S,responseGenerator:u,waitUntil:n.waitUntil,isMinimalMode:o});if(!T)return null;if((null==d||null==(s=d.value)?void 0:s.kind)!==v.CachedRouteKind.APP_ROUTE)throw Object.defineProperty(Error(`Invariant: app-route received invalid cache entry ${null==d||null==(l=d.value)?void 0:l.kind}`),"__NEXT_ERROR_CODE",{value:"E701",enumerable:!1,configurable:!0});o||t.setHeader("x-nextjs-cache",P?"REVALIDATED":d.isMiss?"MISS":d.isStale?"STALE":"HIT"),E&&t.setHeader("Cache-Control","private, no-cache, no-store, max-age=0, must-revalidate");let g=(0,x.fromNodeOutgoingHttpHeaders)(d.value.headers);return o&&T||g.delete(h.NEXT_CACHE_TAGS_HEADER),!d.cacheControl||t.getHeader("Cache-Control")||g.get("Cache-Control")||g.set("Cache-Control",(0,m.getCacheControlHeader)(d.cacheControl)),await (0,p.sendResponse)($,F,new Response(d.value.body,{headers:g,status:d.value.status||200})),null};B?await l(B):await M.withPropagatedContext(e.headers,()=>M.trace(d.BaseServerSpan.handleRequest,{spanName:`${H} ${f}`,kind:s.SpanKind.SERVER,attributes:{"http.method":H,"http.target":e.url}},l))}catch(t){if(t instanceof g.NoFallbackError||await A.onRequestError(e,t,{routerKind:"App Router",routePath:N,routeType:"route",revalidateReason:(0,c.getRevalidateReason)({isStaticGeneration:_,isOnDemandRevalidate:P})},!1,b),T)throw t;return await (0,p.sendResponse)($,F,new Response(null,{status:500})),null}}e.s(["handler",()=>b,"patchFetch",()=>k,"routeModule",()=>A,"serverHooks",()=>E,"workAsyncStorage",()=>y,"workUnitAsyncStorage",()=>I],7223)}];

//# sourceMappingURL=%5Broot-of-the-server%5D__b3d26674._.js.map
# Genera las 5 portadas demo de la red de portales de viaje.
import json, os, html
H = os.path.dirname(os.path.abspath(__file__))

def t(es, en):
    """Texto bilingüe: el JS muestra el idioma activo."""
    return f'<span data-es="{html.escape(es, True)}" data-en="{html.escape(en, True)}">{html.escape(es)}</span>'

JS = """
<script>
(function(){
  var KEY='lang-'+document.body.dataset.site, first=document.body.dataset.first;
  var lang; try{lang=localStorage.getItem(KEY)}catch(e){}
  lang=lang||first;
  function apply(l){
    document.documentElement.lang=l;
    document.querySelectorAll('[data-es]').forEach(function(n){n.textContent=n.getAttribute('data-'+l)});
    document.querySelectorAll('.lang button').forEach(function(b){b.setAttribute('aria-pressed',b.dataset.l===l)});
    try{localStorage.setItem(KEY,l)}catch(e){}
  }
  document.querySelectorAll('.lang button').forEach(function(b){b.addEventListener('click',function(){apply(b.dataset.l)})});
  apply(lang);
})();
</script>"""

def langsw(first):
    order = ['es', 'en'] if first == 'es' else ['en', 'es']
    return '<div class="lang">' + ''.join(f'<button data-l="{l}">{l.upper()}</button>' for l in order) + '</div>'

def head(site, title, desc_es, fonts, css, domain, first, org_type='NewsMediaOrganization'):
    ld = {"@context": "https://schema.org", "@graph": [
        {"@type": org_type, "name": title, "url": f"https://www.{domain}/", "logo": f"https://www.{domain}/logo.png",
         "inLanguage": ["es", "en"] if first == 'es' else ["en", "es"]},
        {"@type": "WebSite", "name": title, "url": f"https://www.{domain}/"}]}
    return f"""<!doctype html>
<html lang="{first}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{title}</title>
<meta name="description" content="{html.escape(desc_es, True)}">
<link rel="alternate" hreflang="es" href="https://www.{domain}/es/">
<link rel="alternate" hreflang="en" href="https://www.{domain}/en/">
<link rel="icon" href="logo.png">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?{fonts}&display=swap">
<script type="application/ld+json">{json.dumps(ld, ensure_ascii=False)}</script>
<style>
*{{box-sizing:border-box}} body{{margin:0}} img{{max-width:100%;display:block}} a{{color:inherit;text-decoration:none}}
.lang{{display:inline-flex;gap:2px}} .lang button{{font:inherit;cursor:pointer;border:1px solid currentColor;background:transparent;color:inherit;padding:4px 9px;opacity:.55}}
.lang button[aria-pressed=true]{{opacity:1}}
.demo-tag{{position:fixed;right:12px;bottom:12px;z-index:50;font:500 11px/1 system-ui,sans-serif;letter-spacing:.08em;text-transform:uppercase;background:#111;color:#fff;padding:7px 10px;border-radius:2px;opacity:.8}}
{css}
</style>
</head>
<body data-site="{site}" data-first="{first}">
"""

def foot():
    return '<div class="demo-tag">Demo · Preview</div>' + JS + '\n</body>\n</html>\n'

SUB = {  # subcanales por sitio (orden: fintech, seguros, F&B, retail, telecom, salud, educación, auto, estilo, eventos)
 'turisenda': [("Viajar con tu dinero","Travel money"),("Viaja protegido","Travel safe"),("Sabores del camino","Flavors on the road"),("Maleta y compras","Packing & shopping"),("Conectados en ruta","Connected on the road"),("Bienestar y spa","Wellness & spa"),("Aprender viajando","Learn by traveling"),("Carretera y road trips","Road trips"),("Vivir viajando","Travel lifestyle"),("Agenda y festivales","Festivals & events")],
 'destinara': [("Pagos y fintech","Payments & fintech"),("Seguros y asistencia","Insurance & assistance"),("F&B en hotelería","Hotel F&B"),("Retail y duty free","Retail & duty free"),("Conectividad","Connectivity"),("Wellness y spa","Wellness & spa"),("Capacitación","Training & talent"),("Movilidad y renta de autos","Mobility & car rental"),("Lujo y estilo de vida","Luxury & lifestyle"),("MICE y congresos","MICE & conventions")],
 'viajentra': [("Pagar fuera sin comisiones","Paying abroad, fee-free"),("Seguros: lo que cubre","Insurance: what it covers"),("Comer y beber","Food & drink"),("Compras y outlets","Shopping & outlets"),("Móvil y datos fuera","Mobile data abroad"),("Balnearios y bienestar","Spas & wellness"),("Estudiar fuera","Study abroad"),("Coche de alquiler","Car hire"),("Estilo de vida","Lifestyle"),("Fiestas y eventos","Festivals & events")],
 'turisync': [("Pagos y fintech","Payments & Fintech"),("Insurtech","Insurtech"),("F&B Tech","F&B Tech"),("Commerce Tech","Commerce Tech"),("Conectividad y eSIM","Connectivity & eSIM"),("Salud y wellness tech","Health & Wellness Tech"),("Aprendizaje","Learning & Upskilling"),("Movilidad y EV","Mobility & EV"),("Vida nómada digital","Digital Nomad Life"),("Eventos y conferencias","Events & Conferences")],
 'travelytix': [("Dinero y tipo de cambio","Money & Exchange Rates"),("Seguro de viaje","Travel Insurance"),("Comida y bebida","Food & Drink"),("Compras y ofertas","Shopping & Deals"),("Celular y datos","Phone & Data Abroad"),("Salud, wellness y belleza","Health, Wellness & Beauty"),("Estudiar fuera","Study Abroad"),("Road trips y renta","Road Trips & Rentals"),("Estilo de vida","Lifestyle"),("Calendario de eventos","Events Calendar")],
}
def subnav(site, cls='sub'):
    return f'<nav class="{cls}" aria-label="Subcanales">' + ''.join(f'<a href="#">{t(*s)}</a>' for s in SUB[site]) + '</nav>'

# ---------------------------------------------------------------- TURISENDA
def turisenda():
    css = """
:root{--terra:#C45234;--sea:#175462;--sand:#E9C48C;--ink:#261C18;--cream:#FAF4EA;--mute:#6f625a}
body{background:var(--cream);color:var(--ink);font:400 17px/1.6 Lora,Georgia,serif}
.wrap{max-width:1180px;margin:0 auto;padding:0 max(16px,env(safe-area-inset-left))}
header{padding:22px 0 10px;border-bottom:1px solid #e3d6c4}
.top{display:flex;justify-content:space-between;align-items:center;gap:16px;flex-wrap:wrap}
.top img{height:64px;width:auto}
.top .meta{font:500 12px/1.3 Montserrat,sans-serif;letter-spacing:.12em;text-transform:uppercase;color:var(--mute);display:flex;gap:16px;align-items:center}
nav.main{display:flex;gap:26px;flex-wrap:wrap;padding:14px 0;font:600 13px Montserrat,sans-serif;letter-spacing:.08em;text-transform:uppercase}
nav.main a:hover{color:var(--terra)}
nav.sub{display:flex;gap:18px;flex-wrap:wrap;font:italic 400 14px Lora,serif;color:var(--mute);padding:0 0 14px}
.cover{display:grid;grid-template-columns:1.35fr 1fr;gap:36px;padding:40px 0}
.art{aspect-ratio:4/5;border-radius:2px;position:relative;overflow:hidden;background:linear-gradient(180deg,#f2c98f 0%,#e9a36d 34%,#d7774c 47%,#175462 47.2%,#0f3c47 100%)}
.art::before{content:"";position:absolute;width:30%;aspect-ratio:1;left:35%;top:24%;border-radius:50%;background:#fbe3b4;box-shadow:0 0 80px 30px rgba(251,227,180,.5)}
.art::after{content:"";position:absolute;inset:auto 0 0 0;height:53%;background:repeating-linear-gradient(180deg,transparent 0 22px,rgba(233,196,140,.35) 22px 24px)}
.art .cap{position:absolute;left:18px;bottom:16px;z-index:2;color:#fff;font:500 12px Montserrat,sans-serif;letter-spacing:.1em;text-transform:uppercase}
.kick{font:600 12px Montserrat,sans-serif;letter-spacing:.14em;text-transform:uppercase;color:var(--terra)}
h1{font:600 clamp(36px,5vw,60px)/1.05 Fraunces,serif;margin:10px 0 16px;text-wrap:balance}
.dek{font-size:20px;color:#4a3c34}
.by{font:500 13px Montserrat,sans-serif;color:var(--mute);margin-top:18px}
.trio{display:grid;grid-template-columns:repeat(3,1fr);gap:28px;padding:10px 0 40px;border-top:1px solid #e3d6c4}
.card .ph{aspect-ratio:3/2;margin:18px 0 12px}
.card h3{font:600 24px/1.2 Fraunces,serif;margin:6px 0}
.card p{margin:0;color:#4a3c34;font-size:16px}
.obs{background:var(--sea);color:#eaf3f2;margin:10px 0 40px;padding:32px;display:grid;grid-template-columns:1fr 1.2fr;gap:28px;align-items:center}
.obs h2{font:600 32px/1.1 Fraunces,serif;margin:6px 0 10px;color:#fff}
.obs .kick{color:var(--sand)}
.bars{display:grid;gap:10px;font:500 13px Montserrat,sans-serif}
.bar{display:grid;grid-template-columns:150px 1fr 54px;gap:10px;align-items:center}
.bar i{height:10px;background:rgba(255,255,255,.15);position:relative}.bar i b{position:absolute;inset:0 auto 0 0;background:var(--sand)}
.btn{display:inline-block;margin-top:14px;font:600 13px Montserrat,sans-serif;letter-spacing:.08em;text-transform:uppercase;border:1px solid currentColor;padding:10px 16px}
.lanes{display:grid;grid-template-columns:repeat(4,1fr);gap:24px;padding:0 0 48px}
.lane{border-top:3px solid var(--terra);padding-top:12px}
.lane h4{font:600 19px/1.25 Fraunces,serif;margin:6px 0}
footer{background:var(--ink);color:#d9cbbd;padding:36px 0;font:400 14px Montserrat,sans-serif}
footer .wrap{display:flex;justify-content:space-between;gap:20px;flex-wrap:wrap}
.p1{background:linear-gradient(135deg,#d9a46d,#9b4a2c)}.p2{background:linear-gradient(135deg,#7fb0b0,#175462)}.p3{background:linear-gradient(135deg,#e9c48c,#c45234)}
@media(max-width:820px){.cover,.obs{grid-template-columns:1fr}.trio{grid-template-columns:1fr}.lanes{grid-template-columns:1fr 1fr}.art{aspect-ratio:4/3}}
"""
    fonts = "family=Fraunces:opsz,wght@9..144,600&family=Lora:ital,wght@0,400;1,400&family=Montserrat:wght@500;600"
    b = head('turisenda', 'Turisenda', 'Revista de viaje: escapadas y primera visita en México, EE.UU. y Canadá. Observatorio Latinoamericano de Sargazo.', fonts, css, 'turisenda.com', 'es')
    b += f"""<header><div class="wrap">
<div class="top"><a href="#"><img src="logo.png" alt="Turisenda — Revista de viaje"></a>
<div class="meta">{t('Martes y viernes, 13:00','Tuesdays & Fridays, 1 pm')}{langsw('es')}</div></div>
<nav class="main">{''.join(f'<a href="#">{t(*x)}</a>' for x in [('Escapadas','Getaways'),('Primera vez en…','First time in…'),('Rutas','Routes'),('Hoteles con historia','Hotels with history'),('Observatorio de Sargazo','Sargassum Observatory')])}</nav>
{subnav('turisenda')}
</div></header>
<main class="wrap">
<section class="cover">
<div class="art"><span class="cap">{t('Bacalar, Quintana Roo','Bacalar, Quintana Roo')}</span></div>
<div><div class="kick">{t('Historia de portada','Cover story')}</div>
<h1>{t('Bacalar al amanecer: la laguna de los siete colores sin prisa','Bacalar at dawn: the lagoon of seven colors, unhurried')}</h1>
<p class="dek">{t('Tres días entre cenotes, kayak y cocina maya. Lo que aprendí viajando despacio por el sur de Quintana Roo.','Three days of cenotes, kayaks and Mayan cooking. What I learned slowing down in southern Quintana Roo.')}</p>
<p class="by">{t('Por Mariana Robles · 14 min de lectura','By Mariana Robles · 14 min read')}</p>
<a class="btn" href="#">{t('Leer la crónica','Read the story')}</a></div>
</section>
<section class="trio">
{''.join(f'<article class="card"><div class="ph {c}"></div><div class="kick">{t(*k)}</div><h3>{t(*h)}</h3><p>{t(*p)}</p></article>' for c,k,h,p in [
 ('p1',('Primera vez en…','First time in…'),('Primera vez en Oaxaca: 48 horas entre mercados y mezcal','First time in Oaxaca: 48 hours of markets and mezcal'),('Una guía para no perderte lo esencial.','A guide to the essentials.')),
 ('p2',('Rutas','Routes'),('De San Diego a Ensenada por la costa: la Ruta del Vino en un fin de semana','San Diego to Ensenada along the coast: Wine Route in a weekend'),('Paradas, horarios y dónde dormir.','Stops, timing and where to sleep.')),
 ('p3',('Hoteles con historia','Hotels with history'),('Dormir en una hacienda henequenera en Yucatán','Sleeping in a henequen hacienda in Yucatán'),('Cinco casas que se volvieron hotel.','Five estates turned into hotels.'))])}
</section>
<section class="obs">
<div><div class="kick">{t('Observatorio Latinoamericano de Sargazo','Latin American Sargassum Observatory')}</div>
<h2>{t('Sargazo esta semana','Sargassum this week')}</h2>
<p>{t('Qué playas tienen sargazo hoy y qué destinos lo comunican con transparencia.','Which beaches have sargassum today and which destinations report it openly.')}</p>
<a class="btn" href="https://potenttial.github.io/promter-n3/turisenda/observatorio-sargazo/">{t('Ver el mapa en vivo','See the live map')}</a></div>
<div class="bars">{''.join(f'<div class="bar"><span>{n}</span><i><b style="width:{v}%"></b></i><span>{t(*l)}</span></div>' for n,v,l in [('Tulum',62,('Alto','High')),('Playa del Carmen',48,('Medio','Mid')),('Cancún',30,('Bajo','Low')),('Punta Cana',71,('Alto','High')),('Miami Beach',12,('Bajo','Low'))])}</div>
</section>
<section class="lanes">
{''.join(f'<div class="lane"><div class="kick">{t(*k)}</div><h4>{t(*h)}</h4></div>' for k,h in [
 (SUB['turisenda'][7],('Ruta Chihuahua–Creel en auto: lo que nadie te dice','Driving Chihuahua to Creel: what nobody tells you')),
 (SUB['turisenda'][2],('Dónde comer cochinita como en Mérida','Where to eat cochinita like in Mérida')),
 (SUB['turisenda'][9],('Festivales de diciembre en México y el sur de EE.UU.','December festivals in Mexico and the US South')),
 (SUB['turisenda'][5],('Temazcal y spa en Tepoztlán','Temazcal and spa in Tepoztlán'))])}
</section>
</main>
<footer><div class="wrap"><span>{t('Turisenda · Revista de viaje · México, EE.UU. y Canadá','Turisenda · Travel magazine · Mexico, US & Canada')}</span><span>{t('Newsletter: sábados 8:30','Newsletter: Saturdays 8:30 am')}</span></div></footer>
"""
    return b + foot()

# ---------------------------------------------------------------- DESTINARA
def destinara():
    css = """
:root{--navy:#1C2A4A;--orange:#E08A2C;--gray:#EEF1F5;--line:#d7dde6;--mute:#5b6577}
body{background:#fff;color:#18213a;font:400 15px/1.5 "IBM Plex Sans",Arial,sans-serif}
.wrap{max-width:1240px;margin:0 auto;padding:0 max(16px,env(safe-area-inset-left))}
.ticker{background:var(--navy);color:#fff;font:500 13px "IBM Plex Sans",sans-serif;overflow:hidden;white-space:nowrap}
.ticker .wrap{display:flex;gap:14px;align-items:center;padding-block:8px}
.ticker b{background:var(--orange);color:var(--navy);padding:2px 8px;font:600 12px Oswald,sans-serif;letter-spacing:.06em;text-transform:uppercase}
.ticker .run{display:inline-block;animation:run 38s linear infinite}
@keyframes run{from{transform:translateX(0)}to{transform:translateX(-50%)}}
@media(prefers-reduced-motion:reduce){.ticker .run{animation:none}}
header .wrap{display:flex;justify-content:space-between;align-items:center;gap:16px;padding-block:16px;flex-wrap:wrap}
header img{height:58px;width:auto}
.date{font:500 12px "IBM Plex Sans";color:var(--mute);text-transform:uppercase;letter-spacing:.08em;display:flex;gap:14px;align-items:center}
nav.main{border-top:3px solid var(--navy);border-bottom:1px solid var(--line)}
nav.main .wrap{display:flex;gap:22px;flex-wrap:wrap;padding-block:10px;font:600 14px Oswald,sans-serif;letter-spacing:.06em;text-transform:uppercase}
nav.sub{display:flex;gap:16px;flex-wrap:wrap;padding:8px 0;font-size:12.5px;color:var(--mute)}
nav.sub a::after{content:" ·";color:var(--line)}
.grid{display:grid;grid-template-columns:2fr 1fr 1fr;gap:24px;padding:22px 0}
.lead .ph{aspect-ratio:16/9;background:linear-gradient(120deg,#1C2A4A,#3d5a8a 60%,#E08A2C)}
.sec{font:600 12px Oswald,sans-serif;letter-spacing:.08em;text-transform:uppercase;color:var(--orange)}
h1{font:700 clamp(30px,3.6vw,44px)/1.08 Oswald,sans-serif;text-transform:uppercase;margin:10px 0;color:var(--navy);text-wrap:balance}
h3{font:600 20px/1.15 Oswald,sans-serif;margin:6px 0;color:var(--navy)}
.col{display:grid;gap:18px;align-content:start}
.col article{border-bottom:1px solid var(--line);padding-bottom:14px}
.col .ph{aspect-ratio:16/10;background:var(--gray);margin-bottom:8px}
.rail{background:var(--gray);padding:16px}
.rail h2{font:700 16px Oswald,sans-serif;text-transform:uppercase;letter-spacing:.05em;margin:0 0 10px;color:var(--navy)}
.rail ol{margin:0;padding-left:20px;display:grid;gap:10px;font-weight:500}
.kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:0;border:1px solid var(--line);margin:8px 0 26px}
.kpi{padding:16px;border-right:1px solid var(--line)}.kpi:last-child{border:0}
.kpi .n{font:700 34px Oswald,sans-serif;color:var(--navy);font-variant-numeric:tabular-nums}
.kpi .d{font-size:12px;color:var(--mute)} .up{color:#1f8a4c}.down{color:#c0392b}
.four{display:grid;grid-template-columns:repeat(4,1fr);gap:22px;padding-bottom:36px;border-top:3px solid var(--navy);padding-top:16px}
.brief{background:var(--navy);color:#fff;padding:22px;display:flex;justify-content:space-between;gap:18px;flex-wrap:wrap;align-items:center;margin-bottom:36px}
.brief strong{font:700 22px Oswald,sans-serif;text-transform:uppercase}
.brief span.btn{background:var(--orange);color:var(--navy);padding:10px 16px;font:600 13px Oswald;text-transform:uppercase;letter-spacing:.06em}
footer{border-top:1px solid var(--line);padding:24px 0;color:var(--mute);font-size:13px}
@media(max-width:900px){.grid{grid-template-columns:1fr}.kpis,.four{grid-template-columns:1fr 1fr}.kpi:nth-child(2){border-right:0}}
"""
    fonts = "family=Oswald:wght@500;600;700&family=IBM+Plex+Sans:wght@400;500;600"
    news = [('Aeroméxico suma 4 rutas a Canadá para el verano 2027','Aeroméxico adds 4 Canada routes for summer 2027'),('Ocupación hotelera en Los Cabos llega a 81% en noviembre','Los Cabos hotel occupancy hits 81% in November'),('OTAs: nueva regulación de precios totales en México','OTAs: new all-in pricing rules in Mexico'),('Cruceros: récord de pasajeros en Cozumel','Cruises: record passengers in Cozumel')]
    tick = ' &nbsp;•&nbsp; '.join(t(*n) for n in news)
    b = head('destinara', 'Destinara', 'Noticias de la industria turística: aerolíneas, hotelería, agencias, OTAs, destinos y cruceros.', fonts, css, 'destinara.net', 'es')
    b += f"""<div class="ticker"><div class="wrap"><b>{t('Última hora','Breaking')}</b><span class="run">{tick} &nbsp;•&nbsp; {tick}</span></div></div>
<header><div class="wrap"><a href="#"><img src="logo.png" alt="Destinara — Noticias de la industria turística"></a>
<div class="date">{t('Briefing diario · 6:30 CDMX','Daily briefing · 6:30 am CDMX')}{langsw('es')}</div></div></header>
<nav class="main"><div class="wrap">{''.join(f'<a href="#">{t(*x)}</a>' for x in [('Aerolíneas','Airlines'),('Hotelería','Hospitality'),('Agencias y OTAs','Agencies & OTAs'),('Destinos','Destinations'),('Cruceros','Cruises'),('Indicadores','Indicators')])}</div></nav>
<main class="wrap">
{subnav('destinara')}
<section class="grid">
<article class="lead"><div class="ph"></div><div class="sec">{t('Aerolíneas','Airlines')}</div>
<h1>{t('El corredor México–Canadá crece 18% y las aerolíneas reordenan rutas para 2027','Mexico–Canada corridor grows 18% as airlines reshuffle 2027 routes')}</h1>
<p>{t('Datos de la AFAC y entrevistas con tres directores comerciales muestran hacia dónde va la conectividad aérea.','AFAC data and interviews with three commercial directors show where air connectivity is heading.')}</p></article>
<div class="col">{''.join(f'<article><div class="ph"></div><div class="sec">{t(*s)}</div><h3>{t(*h)}</h3></article>' for s,h in [(('Hotelería','Hospitality'),news[1]),(('Agencias y OTAs','Agencies & OTAs'),news[2])])}</div>
<aside class="rail"><h2>{t('Lo más leído','Most read')}</h2><ol>{''.join(f'<li>{t(*n)}</li>' for n in [news[3],('Entrevista: el nuevo director de Visit Mexico','Interview: Visit Mexico’s new director'),('Tianguis Turístico 2027: sede y fechas','Tianguis Turístico 2027: venue and dates'),('Tarifas aéreas: qué esperar en temporada alta','Airfares: what to expect in high season')])}</ol></aside>
</section>
<section class="kpis">{''.join(f'<div class="kpi"><div class="d">{t(*l)}</div><div class="n">{n}</div><div class="d {c}">{d}</div></div>' for l,n,d,c in [(('Ocupación hotelera nacional','National hotel occupancy'),'64.2%','▲ 2.1 pp','up'),(('Pasajeros aéreos (oct)','Air passengers (Oct)'),'9.8 M','▲ 6.4%','up'),(('Llegadas internacionales','International arrivals'),'3.1 M','▲ 4.0%','up'),(('Tarifa aérea promedio','Average airfare'),'$3,420','▼ 1.8%','down')])}</section>
<section class="four">{''.join(f'<article><div class="sec">{t(*s)}</div><h3>{t(*h)}</h3></article>' for s,h in [(SUB['destinara'][9],('Los 10 congresos que llegan a México en 2027','10 conventions coming to Mexico in 2027')),(SUB['destinara'][0],('Pagos en tiempo real llegan a las agencias','Real-time payments reach travel agencies')),(SUB['destinara'][7],('Renta de autos eléctricos en aeropuertos','EV car rental at airports')),(SUB['destinara'][1],('Asistencia en viaje: lo que piden las OTAs','Travel assistance: what OTAs require'))])}</section>
<div class="brief"><strong>{t('Recibe el briefing de las 6:30','Get the 6:30 am briefing')}</strong><span class="btn">{t('Suscribirme','Subscribe')}</span></div>
</main>
<footer><div class="wrap">{t('Destinara · Noticias de la industria turística · ES / EN','Destinara · Travel industry news · ES / EN')}</div></footer>
"""
    return b + foot()

# ---------------------------------------------------------------- VIAJENTRA
def viajentra():
    css = """
:root{--bk:#111;--yl:#E8C24A;--off:#F5F2EA;--red:#D9442B}
body{background:var(--off);color:var(--bk);font:400 16px/1.55 "Work Sans",Arial,sans-serif}
.wrap{max-width:1200px;margin:0 auto;padding:0 max(16px,env(safe-area-inset-left))}
header{background:var(--bk);color:var(--off)}
header .wrap{display:flex;justify-content:space-between;align-items:center;gap:16px;flex-wrap:wrap;padding-block:14px}
header img{height:54px;width:auto;background:var(--off);padding:6px}
header .r{display:flex;gap:16px;align-items:center;font:600 12px "Work Sans";letter-spacing:.1em;text-transform:uppercase}
nav.main{background:var(--yl)}
nav.main .wrap{display:flex;gap:24px;flex-wrap:wrap;padding-block:10px;font:400 18px Anton,sans-serif;letter-spacing:.03em;text-transform:uppercase}
nav.sub{display:flex;gap:14px;flex-wrap:wrap;padding:10px 0;font-size:13px}
nav.sub a{border-bottom:2px solid var(--yl)}
.duel{display:grid;grid-template-columns:1fr auto 1fr;margin:26px 0 8px;background:var(--bk);color:var(--off)}
.side{padding:28px;display:grid;gap:10px}
.side.b{background:var(--yl);color:var(--bk)}
.vs{display:grid;place-items:center;background:var(--red);color:#fff;font:400 44px Anton,sans-serif;padding:0 18px}
.side h2{font:400 clamp(40px,6vw,72px)/.95 Anton,sans-serif;margin:0;text-transform:uppercase}
.score{display:grid;gap:8px;font-weight:600;font-size:14px}
.score div{display:grid;grid-template-columns:120px 1fr 32px;gap:10px;align-items:center}
.score i{height:12px;background:rgba(255,255,255,.2)}.side.b .score i{background:rgba(0,0,0,.15)}
.score i b{display:block;height:100%;background:var(--yl)}.side.b .score i b{background:var(--bk)}
.verdict{background:var(--bk);color:var(--off);padding:18px 28px;display:flex;justify-content:space-between;gap:16px;flex-wrap:wrap;margin-bottom:30px}
.verdict b{color:var(--yl);font:400 22px Anton,sans-serif;text-transform:uppercase;letter-spacing:.02em}
h1.big{font:400 clamp(44px,7vw,92px)/.92 Anton,sans-serif;text-transform:uppercase;margin:26px 0 8px;text-wrap:balance}
.kick{font:700 12px "Work Sans";letter-spacing:.14em;text-transform:uppercase;color:var(--red)}
.rank{display:grid;grid-template-columns:repeat(5,1fr);gap:0;border:3px solid var(--bk);margin:10px 0 34px}
.rk{padding:16px;border-right:3px solid var(--bk);display:grid;gap:4px}.rk:last-child{border:0}
.rk .n{font:400 46px/1 Anton,sans-serif}.rk:first-child{background:var(--yl)}
.rk .e{font:600 13px "Work Sans"}
.cols{display:grid;grid-template-columns:repeat(3,1fr);gap:26px;padding-bottom:40px}
.cols article{border-top:6px solid var(--bk);padding-top:12px}
.cols h3{font:400 28px/1.02 Anton,sans-serif;text-transform:uppercase;margin:8px 0}
.duo{aspect-ratio:3/2;background:linear-gradient(135deg,#111 0 50%,#E8C24A 50% 100%);filter:contrast(1.1)}
footer{background:var(--bk);color:#bdb6a6;padding:24px 0;font-size:13px}
@media(max-width:860px){.duel{grid-template-columns:1fr}.vs{padding:10px}.rank{grid-template-columns:1fr 1fr}.rk{border-bottom:3px solid var(--bk)}.cols{grid-template-columns:1fr}}
"""
    fonts = "family=Anton&family=Work+Sans:wght@400;600;700"
    b = head('viajentra', 'Viajentra', 'Destinos en contraste: comparativas, rankings y precios en euros para viajar desde España a América y el Caribe.', fonts, css, 'viajentra.com', 'es')
    b += f"""<header><div class="wrap"><a href="#"><img src="logo.png" alt="Viajentra — Destinos en contraste"></a>
<div class="r">{t('Miércoles y domingos · 9:00 Madrid','Wednesdays & Sundays · 9 am Madrid')}{langsw('es')}</div></div></header>
<nav class="main"><div class="wrap">{''.join(f'<a href="#">{t(*x)}</a>' for x in [('Duelos','Head to head'),('Rankings','Rankings'),('Cuánto cuesta','What it costs'),('Desde Madrid y Barcelona','From Madrid & Barcelona'),('Lo que no te cuentan','What they don’t tell you')])}</div></nav>
<main class="wrap">
{subnav('viajentra')}
<h1 class="big">{t('Riviera Maya o Punta Cana: ¿dónde os sale mejor en 2027?','Riviera Maya or Punta Cana: which works better in 2027?')}</h1>
<div class="kick">{t('Duelo de la semana · Por Javier Ortega, desde Madrid','Head to head of the week · By Javier Ortega, Madrid')}</div>
<section class="duel">
<div class="side a"><h2>Riviera Maya</h2><div class="score">{''.join(f'<div><span>{t(*l)}</span><i><b style="width:{v*10}%"></b></i><span>{v}</span></div>' for l,v in [(('Precio','Price'),7),(('Playas','Beaches'),8),(('Cultura','Culture'),10),(('Sargazo','Sargassum'),6)])}</div></div>
<div class="vs">VS</div>
<div class="side b"><h2>Punta Cana</h2><div class="score">{''.join(f'<div><span>{t(*l)}</span><i><b style="width:{v*10}%"></b></i><span>{v}</span></div>' for l,v in [(('Precio','Price'),8),(('Playas','Beaches'),8),(('Cultura','Culture'),5),(('Sargazo','Sargassum'),5)])}</div></div>
</section>
<div class="verdict"><span>{t('Vuelo directo desde Madrid desde 640 € ida y vuelta · 7 noches todo incluido desde 1.290 €','Direct flight from Madrid from €640 return · 7 nights all-inclusive from €1,290')}</span><b>{t('Gana Riviera Maya: 31 a 26','Riviera Maya wins: 31 to 26')}</b></div>
<div class="kick">{t('Ranking · Caribe para ir desde España','Ranking · Caribbean from Spain')}</div>
<section class="rank">{''.join(f'<div class="rk"><span class="n">{i}</span><strong>{d}</strong><span class="e">{p}</span></div>' for i,d,p in [(1,'Riviera Maya','1.290 €'),(2,'Punta Cana','1.180 €'),(3,'Cuba','990 €'),(4,'Aruba','1.640 €'),(5,'Puerto Rico','1.520 €')])}</section>
<section class="cols">{''.join(f'<article><div class="duo"></div><div class="kick">{t(*k)}</div><h3>{t(*h)}</h3><p>{t(*p)}</p></article>' for k,h,p in [
 (('¿Merece la pena?','Is it worth it?'),('Cancún en Semana Santa: ¿merece la pena o es un timo?','Cancún at Easter: worth it or a rip-off?'),('Hemos hecho cuentas con billete, hotel y traslados.','We did the maths on flights, hotel and transfers.')),
 (SUB['viajentra'][4],('Datos en México: eSIM contra tarifa de tu operador','Mobile data in Mexico: eSIM vs your carrier'),('Cuánto pagas de verdad con el móvil fuera.','What you really pay for mobile data abroad.')),
 (SUB['viajentra'][7],('Coche de alquiler en Yucatán: lo que no te cuentan','Car hire in Yucatán: what they don’t tell you'),('Seguros, gasolina y controles: sin sustos.','Insurance, fuel and checkpoints, no surprises.'))])}</section>
</main>
<footer><div class="wrap">{t('Viajentra · Destinos en contraste · Hecho en Madrid · ES / EN','Viajentra · Destinations in contrast · Made in Madrid · ES / EN')}</div></footer>
"""
    return b + foot()

# ---------------------------------------------------------------- TURISYNC
def turisync():
    css = """
:root{--bg:#14121F;--card:#1d1a2e;--line:#2c2843;--vio:#5B3FD9;--cy:#4FC1D6;--lav:#EDEAFB;--mute:#a19cc0}
body{background:var(--bg);color:var(--lav);font:400 15px/1.6 Inter,Arial,sans-serif}
.wrap{max-width:1220px;margin:0 auto;padding:0 max(16px,env(safe-area-inset-left))}
header .wrap{display:flex;justify-content:space-between;align-items:center;gap:16px;flex-wrap:wrap;padding-block:18px}
header img{height:56px;width:auto}
.r{display:flex;gap:14px;align-items:center;font:500 12px "JetBrains Mono",monospace;color:var(--mute)}
nav.main{border-block:1px solid var(--line)}
nav.main .wrap{display:flex;gap:8px;flex-wrap:wrap;padding-block:10px}
nav.main a{font:500 14px Poppins,sans-serif;padding:6px 12px;border:1px solid var(--line);border-radius:999px}
nav.main a:first-child{background:var(--vio);border-color:var(--vio)}
nav.sub{display:flex;gap:14px;flex-wrap:wrap;padding:12px 0;font:400 12.5px "JetBrains Mono",monospace;color:var(--mute)}
.hero{display:grid;grid-template-columns:1.2fr 1fr;gap:28px;padding:28px 0;align-items:center}
.tag{font:500 12px "JetBrains Mono",monospace;color:var(--cy);letter-spacing:.04em}
h1{font:600 clamp(32px,4.4vw,54px)/1.08 Poppins,sans-serif;margin:10px 0 14px;text-transform:lowercase;text-wrap:balance}
h1 em{font-style:normal;color:var(--cy)}
.panel{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:20px}
.panel h3{font:600 14px Poppins;margin:0 0 14px}
.chart{display:flex;align-items:flex-end;gap:10px;height:170px;border-bottom:1px solid var(--line)}
.chart div{flex:1;background:linear-gradient(180deg,var(--cy),var(--vio));border-radius:6px 6px 0 0;position:relative}
.chart span{position:absolute;top:-20px;left:0;right:0;text-align:center;font:500 11px "JetBrains Mono"}
.axis{display:flex;gap:10px;font:500 11px "JetBrains Mono";color:var(--mute);margin-top:6px}.axis span{flex:1;text-align:center}
.cards{display:grid;grid-template-columns:repeat(3,1fr);gap:18px;padding:10px 0 30px}
.card{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:20px;display:grid;gap:8px}
.card h3{font:600 19px/1.3 Poppins;margin:0}
.card p{margin:0;color:var(--mute);font-size:14px}
.stack{display:grid;grid-template-columns:repeat(6,1fr);gap:12px;margin:6px 0 34px}
.tool{border:1px solid var(--line);border-radius:12px;padding:14px;display:grid;gap:6px}
.tool b{font:600 15px Poppins}.tool small{font:500 11px "JetBrains Mono";color:var(--cy)}
h2.sec{font:600 22px Poppins;margin:26px 0 12px;text-transform:lowercase}
.index{background:linear-gradient(120deg,var(--vio),#2b1f73);border-radius:16px;padding:24px;display:flex;justify-content:space-between;align-items:center;gap:18px;flex-wrap:wrap;margin-bottom:36px}
.index strong{font:600 22px Poppins}.index .btn{background:var(--lav);color:var(--bg);padding:10px 16px;border-radius:999px;font:600 14px Poppins}
footer{border-top:1px solid var(--line);padding:24px 0;color:var(--mute);font:400 12px "JetBrains Mono"}
@media(max-width:900px){.hero{grid-template-columns:1fr}.cards{grid-template-columns:1fr}.stack{grid-template-columns:repeat(2,1fr)}}
"""
    fonts = "family=Poppins:wght@500;600&family=Inter:wght@400;500&family=JetBrains+Mono:wght@400;500"
    b = head('turisync', 'Turisync', 'Travel tech and digital transformation: AI in travel, distribution, hotel and airline tech, startups and funding.', fonts, css, 'turisync.com', 'en')
    b = b.replace('href="logo.png"', 'href="logo-dark.png"', 1)
    b += f"""<header><div class="wrap"><a href="#"><img src="logo-dark.png" alt="Turisync — Travel tech · Transformación digital"></a>
<div class="r">{t('mar y jue · 8:00 ET','tue & thu · 8:00 am ET')}{langsw('en')}</div></div></header>
<nav class="main"><div class="wrap">{''.join(f'<a href="#">{t(*x)}</a>' for x in [('IA en viajes','AI in Travel'),('Distribución y OTAs','Distribution & OTAs'),('Hotel tech','Hotel Tech'),('Airline tech','Airline Tech'),('Startups e inversión','Startups & Funding'),('Reseñas de herramientas','Tool Reviews')])}</div></nav>
<main class="wrap">
{subnav('turisync')}
<section class="hero"><div><div class="tag">// {t('análisis','analysis')}</div>
<h1>{t('los agentes de ia ya reservan viajes.','ai agents now book trips.')} <em>{t('¿quién se queda la comisión?','who keeps the commission?')}</em></h1>
<p>{t('Cómo ChatGPT, Gemini y los agentes de las OTAs están cambiando la distribución hotelera, con datos de 40 cadenas.','How ChatGPT, Gemini and OTA agents are reshaping hotel distribution, with data from 40 chains.')}</p></div>
<div class="panel"><h3>{t('Reservas iniciadas por IA, % del total','AI-initiated bookings, % of total')}</h3>
<div class="chart">{''.join(f'<div style="height:{h}%"><span>{v}</span></div>' for h,v in [(14,'2.1'),(24,'3.6'),(38,'5.8'),(57,'8.7'),(82,'12.4')])}</div>
<div class="axis"><span>Q3·25</span><span>Q4·25</span><span>Q1·26</span><span>Q2·26</span><span>Q3·26</span></div></div>
</section>
<section class="cards">{''.join(f'<article class="card"><div class="tag">{t(*k)}</div><h3>{t(*h)}</h3><p>{t(*p)}</p></article>' for k,h,p in [
 (('Startups e inversión','Startups & Funding'),('Las 12 startups de viajes que levantaron capital en LatAm este año','12 LatAm travel startups that raised capital this year'),('Rondas, inversionistas y qué resuelven.','Rounds, investors and what they solve.')),
 (('Hotel tech','Hotel Tech'),('PMS en la nube: qué migrar primero','Cloud PMS: what to migrate first'),('Guía para CIOs de hoteles independientes.','A guide for independent hotel CIOs.')),
 (SUB['turisync'][4],('eSIM para huéspedes: el nuevo amenity','Guest eSIM: the new amenity'),('Tres hoteles que ya lo venden.','Three hotels already selling it.'))])}</section>
<h2 class="sec">{t('stack de la semana','stack of the week')}</h2>
<section class="stack">{''.join(f'<div class="tool"><small>{c}</small><b>{n}</b></div>' for c,n in [('PMS','Cloudbeds'),('RMS','Duetto'),('CRS','SynXis'),('CRM','Revinate'),('AI','Prompter N3'),('Pay','Adyen')])}</section>
<div class="index"><strong>{t('Travel Tech Index · primer lunes de cada mes','Travel Tech Index · first Monday of each month')}</strong><span class="btn">{t('Recibir el index','Get the index')}</span></div>
</main>
<footer><div class="wrap">turisync.com · {t('travel tech · transformación digital · EN / ES','travel tech · digital transformation · EN / ES')}</div></footer>
"""
    return b + foot()

# ---------------------------------------------------------------- TRAVELYTIX
def travelytix():
    css = """
:root{--blue:#1E5AA8;--red:#D6363E;--bg:#F3F5F8;--ink:#1B2333;--line:#dde3ec;--mute:#5d6878}
body{background:var(--bg);color:var(--ink);font:400 15px/1.55 "Source Sans 3",Arial,sans-serif}
.wrap{max-width:1200px;margin:0 auto;padding:0 max(16px,env(safe-area-inset-left))}
header{background:#fff;border-bottom:1px solid var(--line)}
header .wrap{display:flex;justify-content:space-between;align-items:center;gap:16px;flex-wrap:wrap;padding-block:14px}
header img{height:52px;width:auto}
.r{display:flex;gap:14px;align-items:center;font:600 12px Montserrat,sans-serif;color:var(--mute);text-transform:uppercase;letter-spacing:.06em}
nav.main{background:#fff;border-bottom:1px solid var(--line)}
nav.main .wrap{display:flex;gap:22px;flex-wrap:wrap;padding-block:10px;font:600 14px Montserrat,sans-serif}
nav.main a:hover{color:var(--red)}
nav.sub{display:flex;gap:10px;flex-wrap:wrap;padding:12px 0}
nav.sub a{background:#fff;border:1px solid var(--line);border-radius:6px;padding:4px 10px;font-size:13px}
.planner{background:var(--blue);color:#fff;border-radius:12px;padding:24px;margin:18px 0}
.planner h1{font:700 clamp(26px,3.4vw,40px)/1.1 Montserrat,sans-serif;margin:0 0 6px;text-wrap:balance}
.form{display:grid;grid-template-columns:2fr 1fr 1fr auto;gap:10px;margin-top:16px}
.form div{background:#fff;color:var(--ink);border-radius:8px;padding:10px 12px;font-size:14px}
.form small{display:block;color:var(--mute);font-size:11px;text-transform:uppercase;letter-spacing:.06em}
.form button{background:var(--red);color:#fff;border:0;border-radius:8px;font:700 15px Montserrat;padding:0 22px;cursor:pointer}
.tiles{display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin:8px 0 26px}
.tile{background:#fff;border:1px solid var(--line);border-radius:12px;overflow:hidden}
.tile .top{height:96px;background:linear-gradient(120deg,#1E5AA8,#7ca6dc)}
.tile:nth-child(2) .top{background:linear-gradient(120deg,#0e8a8a,#7fd0c8)}.tile:nth-child(3) .top{background:linear-gradient(120deg,#c0623a,#efb27d)}
.tile .b{padding:14px 16px}
.tile h3{font:700 19px Montserrat,sans-serif;margin:0 0 8px}
.m{display:grid;grid-template-columns:1fr 1fr;gap:8px 14px;font-size:13px}
.m b{display:block;font:700 18px Montserrat;font-variant-numeric:tabular-nums}
.badge{display:inline-block;font:700 11px Montserrat;padding:2px 8px;border-radius:999px;background:#e5f4ea;color:#1c7a3e}
.badge.w{background:#fff3df;color:#9a5b00}
h2{font:700 22px Montserrat,sans-serif;margin:26px 0 12px}
.best{background:#fff;border:1px solid var(--line);border-radius:12px;padding:16px;overflow-x:auto;margin-bottom:26px}
.best table{border-collapse:collapse;width:100%;min-width:720px;font-size:13px}
.best th,.best td{padding:8px 6px;text-align:center;border-bottom:1px solid var(--line)}
.best th:first-child,.best td:first-child{text-align:left;font-weight:600}
.g{background:#d5ecdc}.y{background:#fdf0cf}.r{}
.cell-r{background:#f7d6d8}
.list{display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin-bottom:36px}
.list article{background:#fff;border-left:4px solid var(--red);padding:14px 16px;border-radius:0 10px 10px 0}
.list h3{font:700 17px/1.3 Montserrat;margin:4px 0}
.kick{font:700 11px Montserrat;letter-spacing:.08em;text-transform:uppercase;color:var(--blue)}
footer{background:var(--ink);color:#c9d1dd;padding:24px 0;font-size:13px}
@media(max-width:860px){.form{grid-template-columns:1fr 1fr}.tiles,.list{grid-template-columns:1fr}}
"""
    fonts = "family=Montserrat:wght@600;700&family=Source+Sans+3:wght@400;600"
    b = head('travelytix', 'Travelytix', 'Smart travel for US & Canada: trip planner, costs in USD and CAD, best time to go and travel requirements for Mexico and the Caribbean.', fonts, css, 'travelytix.net', 'en')
    months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
    rows = {'Cancún':'gggyyrrrryyg','Cabo San Lucas':'ggggyyyrryyg','Mexico City':'gggggyyyyggg','Puerto Vallarta':'gggggyyrrygg','Oaxaca':'ggggyyyyyggg'}
    cls = {'g':'g','y':'y','r':'cell-r'}
    table = '<table><thead><tr><th>' + t('Destino','Destination') + '</th>' + ''.join(f'<th>{m}</th>' for m in months) + '</tr></thead><tbody>' + ''.join(f'<tr><td>{d}</td>' + ''.join(f'<td class="{cls[c]}">{"★" if c=="g" else ""}</td>' for c in v) + '</tr>' for d,v in rows.items()) + '</tbody></table>'
    b += f"""<header><div class="wrap"><a href="#"><img src="logo.png" alt="Travelytix — Smart travel for US & Canada"></a>
<div class="r">{t('Miércoles 18:00 y sábados 9:00 ET','Wed 6 pm & Sat 9 am ET')}{langsw('en')}</div></div></header>
<nav class="main"><div class="wrap">{''.join(f'<a href="#">{t(*x)}</a>' for x in [('Destinos','Destinations'),('TravelSmart Planner','TravelSmart Planner'),('Ofertas y vuelos','Deals & Flights'),('Mejor época','Best Time to Go'),('Requisitos de viaje','Travel Requirements')])}</div></nav>
<main class="wrap">
{subnav('travelytix')}
<section class="planner"><h1>{t('Planea tu viaje a México con datos reales','Plan your Mexico trip with real numbers')}</h1>
<p>{t('Costo diario, clima, vuelos y seguridad en un solo lugar, en USD o CAD.','Daily cost, weather, flights and safety in one place, in USD or CAD.')}</p>
<div class="form"><div><small>{t('Desde','From')}</small>Toronto (YYZ)</div><div><small>{t('Destino','To')}</small>Cancún</div><div><small>{t('Fechas','Dates')}</small>Feb 12 – 19</div><button>TravelSmart</button></div></section>
<section class="tiles">{''.join(f'<article class="tile"><div class="top"></div><div class="b"><h3>{d}</h3><div class="m"><div>{t("Costo diario","Daily cost")}<b>{c}</b></div><div>{t("Clima feb","Feb weather")}<b>{w}</b></div><div>{t("Vuelo desde","Flight from")}<b>{f}</b></div><div>{t("Seguridad","Safety")}<br><span class="badge {k}">{t(*s)}</span></div></div></div></article>' for d,c,w,f,k,s in [
 ('Cancún','US$185 · C$252','82°F / 28°C','US$389','',('Buena','Good')),('Puerto Vallarta','US$140 · C$190','81°F / 27°C','US$412','',('Buena','Good')),('Oaxaca','US$95 · C$129','77°F / 25°C','US$455','w',('Precaución','Caution'))])}</section>
<h2>{t('Mejor época para ir','Best time to go')}</h2>
<div class="best">{table}</div>
<section class="list">{''.join(f'<article><div class="kick">{t(*k)}</div><h3>{t(*h)}</h3></article>' for k,h in [
 (SUB['travelytix'][0],('Pesos, dólares o tarjeta: cómo pagar en México','Pesos, dollars or card: how to pay in Mexico')),
 (SUB['travelytix'][7],('Road trip por Baja California: millas, gasolina y seguro','Baja road trip: miles, gas and insurance')),
 (('Requisitos de viaje','Travel Requirements'),('Lo que necesitan los canadienses para entrar a México en 2027','What Canadians need to enter Mexico in 2027'))])}</section>
</main>
<footer><div class="wrap">{t('Travelytix · Viaje inteligente para EE.UU. y Canadá · EN / ES','Travelytix · Smart travel for US & Canada · EN / ES')}</div></footer>
"""
    return b + foot()

for name, fn in [('turisenda', turisenda), ('destinara', destinara), ('viajentra', viajentra), ('turisync', turisync), ('travelytix', travelytix)]:
    with open(os.path.join(H, name, 'index.html'), 'w') as f:
        f.write(fn())
print('ok')

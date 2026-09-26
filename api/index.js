const express = require('express');
const multer = require('multer');
const { put, list, del } = require('@vercel/blob');

const app = express();
const upload = multer({ storage: multer.memoryStorage(), limits: { files: 5, fileSize: 4 * 1024 * 1024 } });
app.use(express.json({ limit: '1mb' }));

const TOKEN = process.env.CHOPBLOB_READ_WRITE_TOKEN || process.env.BLOB_READ_WRITE_TOKEN;
const STORE_ID = process.env.CHOPBLOB_STORE_ID;
const ADMIN_KEY = process.env.ADMIN_KEY;
const TG_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TG_CHAT = process.env.TELEGRAM_CHAT_ID;
const WA = process.env.WHATSAPP_NUMBER || '22781289418';
const OG = 'https://files.catbox.moe/oaxlfi.jpg';
const SITE = 'https://chop-city.vercel.app/';
const DATA_PATH = 'chop-city/data.json';

function blobOpts(extra={}) {
  const o = { access:'public', ...extra };
  if (TOKEN) o.token = TOKEN;
  if (STORE_ID) o.storeId = STORE_ID;
  return o;
}
function admin(req){ return !!ADMIN_KEY && req.headers['x-admin-key'] === ADMIN_KEY; }
function id(){ return Date.now().toString(36) + '-' + Math.random().toString(36).slice(2,9); }
function now(){ return new Date().toISOString(); }
function normalize(p){ return {...p, status: p.status || 'approved', views:Number(p.views||0), contacts:Number(p.contacts||0), featured:!!p.featured}; }
async function readState(){
  if(!TOKEN && !STORE_ID) return {products:[], events:[], reports:[]};
  const r = await list(blobOpts({prefix:'chop-city/data.json'}));
  const b = r.blobs?.find(x => x.pathname === DATA_PATH) || r.blobs?.[0];
  if(!b) return {products:[],events:[],reports:[]};
  try { const res=await fetch(b.url,{cache:'no-store'}); const d=await res.json(); return {products:(d.products||[]).map(normalize),events:d.events||[],reports:d.reports||[]}; }
  catch { return {products:[],events:[],reports:[]}; }
}
async function writeState(state){
  const saved = await put(DATA_PATH, JSON.stringify(state), blobOpts({contentType:'application/json', addRandomSuffix:false}));
  return saved.url;
}
async function telegram(text, keyboard){
  if(!TG_TOKEN || !TG_CHAT) return;
  const body={chat_id:TG_CHAT,text,parse_mode:'HTML'};
  if(keyboard) body.reply_markup={inline_keyboard:keyboard};
  try{ await fetch(`https://api.telegram.org/bot${TG_TOKEN}/sendMessage`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)}); }catch{}
}
function esc(s){return String(s??'').replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]));}

app.get('/api/health',(req,res)=>res.json({ok:true,version:'7.0.0'}));
app.get('/api/config',(req,res)=>res.json({whatsapp:WA,site:SITE}));

app.get('/api/products', async (req,res)=>{
  try{
    const s=await readState();
    const all=admin(req);
    res.json((all?s.products:s.products.filter(p=>p.status==='approved')).sort((a,b)=>(b.featured-a.featured)||(new Date(b.createdAt)-new Date(a.createdAt))));
  }catch(e){res.status(500).json({error:'Impossible de charger les produits'});}
});

app.post('/api/products', upload.array('images',5), async (req,res)=>{
  try{
    const s=await readState();
    const p={id:id(),name:req.body.name||'',price:req.body.price||'',seller:req.body.seller||'',category:req.body.category||'Autre',description:req.body.description||'',images:[],image:'',status:'pending',featured:false,views:0,contacts:0,createdAt:now()};
    if(!p.name||!p.price||!p.seller||!p.description) return res.status(400).json({error:'Champs obligatoires manquants'});
    for(const f of (req.files||[])){
      if(!TOKEN) return res.status(500).json({error:'Stockage image non configuré : CHOPBLOB_READ_WRITE_TOKEN manquant.'});
      if(!STORE_ID) return res.status(500).json({error:'Stockage image non configuré : CHOPBLOB_STORE_ID manquant.'});
      const ext=(f.originalname.match(/\.[a-z0-9]+$/i)||['.jpg'])[0].toLowerCase();
      const b=await put(`chop-city/images/${p.id}-${id()}${ext}`,f.buffer,blobOpts({contentType:f.mimetype || 'image/jpeg', addRandomSuffix:false}));
      if(!b?.url) throw new Error('Vercel Blob n’a pas retourné d’URL image');
      p.images.push(b.url);
    }
    p.image=p.images[0]||OG;
    s.products.push(p); await writeState(s);
    await telegram(`🆕 <b>Nouveau produit en attente</b>\n\n📦 ${esc(p.name)}\n💰 ${esc(p.price)}\n👤 ${esc(p.seller)}\n🏷️ ${esc(p.category)}\n🆔 <code>${esc(p.id)}</code>`,[[{text:'🌐 Ouvrir CHOP CITY',url:SITE}]]);
    res.status(201).json({ok:true,message:'Produit envoyé pour validation',product:p});
  }catch(e){console.error('UPLOAD_PRODUCT_ERROR',e);res.status(500).json({error:'Erreur lors de la publication : '+(e?.message||'upload image impossible')});}
});

app.post('/api/products/:id/view', async (req,res)=>{
  try{const s=await readState();const p=s.products.find(x=>x.id===req.params.id);if(!p)return res.sendStatus(404);p.views++;s.events.push({type:'view',productId:p.id,at:now()});await writeState(s);res.json({ok:true});}catch(e){res.status(500).json({error:'stats'});}
});
app.post('/api/products/:id/contact', async (req,res)=>{
  try{const s=await readState();const p=s.products.find(x=>x.id===req.params.id);if(!p)return res.sendStatus(404);p.contacts++;s.events.push({type:'contact',productId:p.id,at:now()});await writeState(s);res.json({ok:true});}catch(e){res.status(500).json({error:'stats'});}
});

app.put('/api/products/:id', upload.array('images',5), async (req,res)=>{
  if(!admin(req)) return res.status(403).json({error:'Accès refusé'});
  try{const s=await readState();const p=s.products.find(x=>x.id===req.params.id);if(!p)return res.sendStatus(404);
    for(const k of ['name','price','seller','category','description','status']) if(req.body[k]!==undefined) p[k]=req.body[k];
    if(req.body.featured!==undefined) p.featured=req.body.featured==='true'||req.body.featured===true;
    if(req.files?.length){p.images=[];for(const f of req.files){const ext=(f.originalname.match(/\.[a-z0-9]+$/i)||['.jpg'])[0];const b=await put(`chop-city/images/${p.id}-${id()}${ext}`,f.buffer,blobOpts({contentType:f.mimetype}));p.images.push(b.url);}p.image=p.images[0];}
    p.updatedAt=now();await writeState(s);
    await telegram(`✏️ <b>Produit modifié</b>\n📦 ${esc(p.name)}\n📌 Statut: ${esc(p.status)}\n🆔 <code>${esc(p.id)}</code>`);
    res.json({ok:true,product:p});
  }catch(e){res.status(500).json({error:'Modification impossible'});}
});

app.delete('/api/products/:id', async(req,res)=>{if(!admin(req))return res.status(403).json({error:'Accès refusé'});try{const s=await readState();const i=s.products.findIndex(p=>p.id===req.params.id);if(i<0)return res.sendStatus(404);const p=s.products[i];s.products.splice(i,1);await writeState(s);await telegram(`🗑️ <b>Produit supprimé</b>\n📦 ${esc(p.name)}\n🆔 <code>${esc(p.id)}</code>`);res.json({ok:true});}catch(e){res.status(500).json({error:'Suppression impossible'});}});

app.get('/api/stats',async(req,res)=>{if(!admin(req))return res.status(403).json({error:'Accès refusé'});try{const s=await readState();res.json({products:s.products.length,approved:s.products.filter(p=>p.status==='approved').length,pending:s.products.filter(p=>p.status==='pending').length,views:s.products.reduce((a,p)=>a+p.views,0),contacts:s.products.reduce((a,p)=>a+p.contacts,0),reports:s.reports.length});}catch(e){res.status(500).json({error:'stats'});}});

app.post('/api/report',async(req,res)=>{try{const s=await readState();const r={id:id(),subject:req.body.subject||'Sans sujet',message:req.body.message||'',at:now()};s.reports.push(r);await writeState(s);await telegram(`⚠️ <b>Nouveau signalement</b>\n\n<b>${esc(r.subject)}</b>\n${esc(r.message)}`);res.json({ok:true});}catch(e){res.status(500).json({error:'Erreur'});}});

// Page partageable d'un produit avec métadonnées Open Graph.
app.get('/p/:id',async(req,res)=>{try{const s=await readState();const p=s.products.find(x=>x.id===req.params.id&&x.status==='approved');if(!p)return res.status(404).send('Produit introuvable');const image=p.image||OG;const url=`${SITE}p/${encodeURIComponent(p.id)}`;res.set('Content-Type','text/html; charset=utf-8');res.send(`<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(p.name)} — CHOP CITY</title><meta name="description" content="${esc(p.price)} — ${esc(p.description)}"><meta property="og:type" content="product"><meta property="og:title" content="${esc(p.name)} — CHOP CITY"><meta property="og:description" content="${esc(p.price)} • ${esc(p.seller)}"><meta property="og:url" content="${url}"><meta property="og:image" content="${image}"><meta property="og:image:secure_url" content="${image}"><meta property="og:image:type" content="image/jpeg"><meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${esc(p.name)} — CHOP CITY"><meta name="twitter:description" content="${esc(p.price)}"><meta name="twitter:image" content="${image}"><meta http-equiv="refresh" content="0;url=${SITE}"></head><body style="background:#070707;color:white;font-family:Arial;padding:30px">⚡ CHOP CITY — ${esc(p.name)}</body></html>`);}catch(e){res.status(500).send('Erreur');}});

module.exports = app;

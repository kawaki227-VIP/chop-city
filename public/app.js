let products = [];
let adminKey = sessionStorage.getItem("chop_admin_key") || "";
let whatsapp = "22781289418";

const $ = s => document.querySelector(s);

function openModal(id){document.getElementById(id).classList.add("show")}
function closeModal(id){document.getElementById(id).classList.remove("show")}

document.querySelectorAll(".modal").forEach(m => m.addEventListener("click", e => {
  if(e.target === m) m.classList.remove("show");
}));

async function loadConfig(){
  try{
    const r = await fetch("/api/config");
    const d = await r.json();
    whatsapp = d.whatsapp || whatsapp;
  }catch{}
}

async function loadProducts(){
  try{
    const r = await fetch("/api/products");
    products = await r.json();
    buildCategories();
    render();
  }catch(e){
    document.querySelector(".products").innerHTML = '<div class="empty">Impossible de charger les produits.</div>';
  }
}

function buildCategories(){
  const sel = $("#category"), current = sel.value;
  const cats = [...new Set(products.map(p => p.category).filter(Boolean))].sort();
  sel.innerHTML = '<option value="">Toutes les catégories</option>' +
    cats.map(c => `<option value="${esc(c)}">${esc(c)}</option>`).join("");
  sel.value = current;
}

function render(){
  const q = ($("#search").value || "").toLowerCase().trim();
  const cat = $("#category").value;
  const list = products.filter(p => {
    const text = `${p.name} ${p.seller} ${p.description} ${p.category}`.toLowerCase();
    return (!q || text.includes(q)) && (!cat || p.category === cat);
  });
  const box = $(".products");
  if(!list.length){box.innerHTML='<div class="empty">😶 Aucun produit trouvé.</div>';return}
  box.innerHTML = list.map(p => {
    const wa = (p.whatsapp || whatsapp).replace(/[^\d+]/g,"");
    const link = `https://wa.me/${wa.replace("+","")}?text=${encodeURIComponent("Bonjour, je suis intéressé par : " + p.name)}`;
    return `<article class="card">
      ${p.image ? `<img class="cardImg" src="${escAttr(p.image)}" alt="">` : `<div class="cardImg"></div>`}
      <div class="cardBody">
        <div class="cat">${esc(p.category || "Autre")}</div>
        <h3>${esc(p.name)}</h3>
        <div class="price">${esc(p.price)}</div>
        <p class="desc">${esc(p.description)}</p>
        <div class="seller">👤 ${esc(p.seller)}</div>
        <a class="buy" target="_blank" rel="noopener" href="${link}">💬 Acheter sur WhatsApp</a>
      </div>
    </article>`;
  }).join("");
}

$("#sellForm").addEventListener("submit", async e => {
  e.preventDefault();
  const form = e.currentTarget;
  const msg = $("#sellMsg");
  msg.textContent = "Publication...";
  try{
    const r = await fetch("/api/products",{method:"POST",body:new FormData(form)});
    const d = await r.json();
    if(!r.ok) throw new Error(d.error || "Erreur");
    form.reset(); msg.textContent = "✅ Produit publié !";
    await loadProducts();
    setTimeout(()=>closeModal("sellModal"),800);
  }catch(err){msg.textContent = "❌ " + err.message}
});

$("#reportForm").addEventListener("submit", async e => {
  e.preventDefault();
  const msg = $("#reportMsg");
  msg.textContent = "Envoi...";
  try{
    const r = await fetch("/api/report",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(Object.fromEntries(new FormData(e.currentTarget)))});
    if(!r.ok) throw new Error();
    e.currentTarget.reset(); msg.textContent = "✅ Signalement envoyé.";
  }catch{msg.textContent="❌ Impossible d'envoyer le signalement."}
});

function openAdmin(){
  openModal("adminModal");
  if(adminKey){$("#adminLogin").hidden=true;$("#adminPanel").hidden=false;loadAdmin()}
}

function loginAdmin(){
  const key=$("#adminKey").value.trim();
  if(!key){$("#adminLoginMsg").textContent="Entre ta clé admin.";return}
  adminKey=key;sessionStorage.setItem("chop_admin_key",key);
  $("#adminLogin").hidden=true;$("#adminPanel").hidden=false;loadAdmin();
}

function logoutAdmin(){
  adminKey="";sessionStorage.removeItem("chop_admin_key");
  $("#adminPanel").hidden=true;$("#adminLogin").hidden=false;$("#adminKey").value="";
}

async function loadAdmin(){
  const box=$("#adminList");
  box.innerHTML="Chargement...";
  const r=await fetch("/api/products");
  const list=await r.json();
  box.innerHTML=list.map(p=>`<div class="adminItem">
    ${p.image?`<img src="${escAttr(p.image)}" alt="">`:"<div style='width:58px'></div>"}
    <div class="meta"><b>${esc(p.name)}</b><small>${esc(p.price)} • ${esc(p.seller)}</small></div>
    <div class="adminActions">
      <button class="secondary" onclick="editProduct('${p.id}')">Modifier</button>
      <button class="danger" onclick="deleteProduct('${p.id}')">Supprimer</button>
    </div>
  </div>`).join("") || "<p class='muted'>Aucun produit.</p>";
}

function editProduct(id){
  const p=products.find(x=>x.id===id);
  if(!p){alert("Recharge les produits.");return}
  const f=$("#editForm");
  f.hidden=false;
  f.elements.id.value=p.id;f.elements.name.value=p.name;f.elements.price.value=p.price;
  f.elements.seller.value=p.seller;f.elements.whatsapp.value=p.whatsapp||"";
  f.elements.category.value=p.category||"";f.elements.description.value=p.description||"";
  f.scrollIntoView({behavior:"smooth"});
}

function cancelEdit(){$("#editForm").hidden=true}

$("#editForm").addEventListener("submit",async e=>{
  e.preventDefault();const msg=$("#editMsg");msg.textContent="Enregistrement...";
  const id=e.currentTarget.elements.id.value;
  try{
    const r=await fetch("/api/products/"+encodeURIComponent(id),{method:"PUT",headers:{"x-admin-key":adminKey},body:new FormData(e.currentTarget)});
    const d=await r.json();if(!r.ok)throw new Error(d.error||"Erreur");
    msg.textContent="✅ Modifié";e.currentTarget.hidden=true;await loadProducts();await loadAdmin();
  }catch(err){msg.textContent="❌ "+err.message}
});

async function deleteProduct(id){
  if(!confirm("Supprimer ce produit ?"))return;
  const r=await fetch("/api/products/"+encodeURIComponent(id),{method:"DELETE",headers:{"x-admin-key":adminKey}});
  if(r.status===401){logoutAdmin();alert("Clé admin invalide.");return}
  if(!r.ok){alert("Suppression impossible.");return}
  await loadProducts();await loadAdmin();
}

function esc(v){return String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]))}
function escAttr(v){return esc(v)}

loadConfig();loadProducts();

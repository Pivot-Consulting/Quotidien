/* ============ Mon Quotidien v5 — socle historique ============ */

// ---------- Stockage ----------
const CLE = "mon-quotidien-v1";
let memoireSeule = false;
let etat = chargerEtat();

function etatVide(){
  return { taches:[], projets:["Perso","Travail"], evenements:[], notes:[], habitudes:[], seances:[],
    programmesPerso:[], poids:[], sommeil:[], repas:[], mesures:[], eau:{}, notifie:{},
    prefs:{theme:"clair", notif:false, pin:null, dernierExport:null, objectifSeances:3, tri:"auto"} };
}
function chargerEtat(){
  try{
    const brut = localStorage.getItem(CLE);
    if(!brut) return etatVide();
    const e = Object.assign(etatVide(), JSON.parse(brut));
    e.prefs = Object.assign(etatVide().prefs, e.prefs||{});
    return e;
  }catch(err){ memoireSeule = true; return etatVide(); }
}
function sauver(){
  if(memoireSeule) return;
  try{ localStorage.setItem(CLE, JSON.stringify(etat)); }
  catch(e){ memoireSeule = true; document.getElementById("bandeau-memoire").style.display="block"; }
}

// ---------- Utilitaires ----------
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2,7);
function cleDate(d){ return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0"); }
let AUJ = cleDate(new Date());
function dateLisible(iso){ const [a,m,j]=iso.split("-").map(Number); return new Date(a,m-1,j).toLocaleDateString("fr-FR",{weekday:"short",day:"numeric",month:"short"}); }
function jourSemaine(iso){ const [a,m,j]=iso.split("-").map(Number); return new Date(a,m-1,j).getDay(); }
function decaler(iso, n){ const [a,m,j]=iso.split("-").map(Number); const d=new Date(a,m-1,j); d.setDate(d.getDate()+n); return cleDate(d); }
function lundiDe(iso){ return decaler(iso, -((jourSemaine(iso)+6)%7)); }
function echap(s){ return String(s).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c])); }
function attr(s){ return String(s).replace(/\\/g,"\\\\").replace(/'/g,"\\'").replace(/"/g,"&quot;"); }
const CAT = { perso:{c:"#B04BD9",n:"Perso"}, travail:{c:"#2E6FE0",n:"Travail"}, sante:{c:"#0FA36B",n:"Santé"}, autre:{c:"#8896A6",n:"Autre"} };

// ---------- Graphiques SVG maison ----------
function svgBarres(vals, labels, couleur, h){
  h = h||84;
  const max = Math.max(...vals, 1), n = vals.length, w = 300, lw = w/n, bw = lw*0.58;
  let s = `<svg viewBox="0 0 ${w} ${h+18}" class="graph" role="img">`;
  vals.forEach((v,i)=>{
    const x = i*lw + (lw-bw)/2, bh = Math.max(v/max*(h-14), v?3:0);
    s += `<rect x="${x}" y="${h-bh}" width="${bw}" height="${bh}" rx="3" fill="${couleur}" opacity="${v?0.9:0.18}"/>`;
    if(v) s += `<text x="${x+bw/2}" y="${h-bh-4}" font-size="9.5" text-anchor="middle" fill="var(--texte2)">${v}</text>`;
    if(labels && labels[i]!=null) s += `<text x="${x+bw/2}" y="${h+13}" font-size="9" text-anchor="middle" fill="var(--texte2)">${labels[i]}</text>`;
  });
  return s+"</svg>";
}
function svgLigne(points, couleur, h){
  h = h||100;
  if(points.length<1) return '<div class="vide">Pas encore de données — ça viendra vite !</div>';
  const w=300, pad=14;
  const ys=points.map(p=>p.y), min=Math.min(...ys), max=Math.max(...ys), plage=(max-min)||1;
  const px=i=> points.length===1 ? w/2 : pad + i*(w-2*pad)/(points.length-1);
  const py=v=> 14 + (h-28)*(1-(v-min)/plage);
  let chemin = points.map((p,i)=>(i?"L":"M")+px(i).toFixed(1)+" "+py(p.y).toFixed(1)).join(" ");
  let s = `<svg viewBox="0 0 ${w} ${h+16}" class="graph" role="img">`;
  s += `<path d="${chemin}" fill="none" stroke="${couleur}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>`;
  points.forEach((p,i)=>{ s += `<circle cx="${px(i)}" cy="${py(p.y)}" r="3" fill="${couleur}"/>`; });
  const der = points[points.length-1];
  s += `<text x="${px(points.length-1)}" y="${py(der.y)-7}" font-size="10" font-weight="700" text-anchor="middle" fill="${couleur}">${der.y}</text>`;
  s += `<text x="${pad}" y="${h+13}" font-size="9" fill="var(--texte2)">${points[0].x}</text>`;
  s += `<text x="${w-pad}" y="${h+13}" font-size="9" text-anchor="end" fill="var(--texte2)">${der.x}</text>`;
  return s+"</svg>";
}

// ---------- Thème ----------
function appliquerTheme(){
  document.documentElement.dataset.theme = etat.prefs.theme;
  document.getElementById("btn-theme").textContent = etat.prefs.theme==="sombre" ? "☀️" : "🌙";
  document.querySelector('meta[name="theme-color"]').content = etat.prefs.theme==="sombre" ? "#0B1220" : "#12233B";
}
document.getElementById("btn-theme").addEventListener("click", ()=>{
  etat.prefs.theme = etat.prefs.theme==="sombre" ? "clair" : "sombre";
  sauver(); appliquerTheme();
});

// ---------- Verrou PIN ----------
async function hacher(code){
  try{
    const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode("mq:"+code));
    return [...new Uint8Array(buf)].map(b=>b.toString(16).padStart(2,"0")).join("");
  }catch(e){ return "brut:"+code; }
}
async function definirPin(){
  const code = document.getElementById("pin-nouveau").value.trim();
  if(!/^\d{4,8}$/.test(code)){ alert("Le code doit contenir 4 à 8 chiffres."); return; }
  etat.prefs.pin = await hacher(code);
  document.getElementById("pin-nouveau").value = "";
  sauver(); majEtatPin();
}
function supprimerPin(){ etat.prefs.pin = null; sauver(); majEtatPin(); }
function majEtatPin(){
  document.getElementById("pin-etat").textContent = etat.prefs.pin ? "✓ Un code protège l'ouverture de l'app." : "Aucun code défini.";
}
async function deverrouiller(){
  const champ = document.getElementById("verrou-code");
  const h = await hacher(champ.value.trim());
  if(h === etat.prefs.pin){
    document.getElementById("verrou").classList.remove("actif");
    champ.value=""; document.getElementById("verrou-erreur").textContent="";
  }else{
    document.getElementById("verrou-erreur").textContent = "Code incorrect";
    champ.value=""; champ.focus();
  }
}
document.getElementById("verrou-code").addEventListener("keydown", e=>{ if(e.key==="Enter") deverrouiller(); });

// ---------- Navigation & dialogues ----------
document.querySelectorAll("nav button").forEach(b=> b.addEventListener("click", ()=> montrerEcran(b.dataset.ecran)));
function montrerEcran(nom){
  document.querySelectorAll(".ecran").forEach(e=>e.classList.remove("actif"));
  document.querySelectorAll("nav button").forEach(b=>b.classList.toggle("actif", b.dataset.ecran===nom));
  document.getElementById("ecran-"+nom).classList.add("actif");
  toutAfficher();
}
function ouvrir(id){ document.getElementById(id).classList.add("ouvert"); }
function fermer(id){ document.getElementById(id).classList.remove("ouvert"); }
["dlg-donnees","dlg-revue","dlg-graphe","recherche-fond"].forEach(id=>{
  document.getElementById(id).addEventListener("click", e=>{ if(e.target.id===id) fermer(id); });
});
document.getElementById("btn-donnees").addEventListener("click", ()=>{ ouvrir("dlg-donnees"); majEtatNotif(); majEtatPin(); });

// ---------- Recherche globale ----------
document.getElementById("btn-recherche").addEventListener("click", ()=>{
  ouvrir("recherche-fond");
  const c = document.getElementById("recherche-globale");
  c.value=""; document.getElementById("recherche-resultats").innerHTML=""; c.focus();
});
function rechercheGlobale(){
  const q = document.getElementById("recherche-globale").value.trim().toLowerCase();
  const zone = document.getElementById("recherche-resultats");
  if(q.length<2){ zone.innerHTML=""; return; }
  const res = [];
  etat.taches.forEach(t=>{ if(t.libelle.toLowerCase().includes(q)) res.push({type:"Tâche", c:"var(--ligne2)", titre:t.libelle, extrait:(t.fait?"terminée":"à faire")+(t.echeance?" · "+dateLisible(t.echeance):""), action:`montrerEcran('taches');fermer('recherche-fond')`}); });
  etat.notes.forEach(n=>{ if((n.titre+" "+n.corps+" "+n.tags.join(" ")).toLowerCase().includes(q)) res.push({type:"Note", c:"var(--ligne4)", titre:n.titre, extrait:(n.corps||"").slice(0,80), action:`fermer('recherche-fond');ouvrirNote('${attr(n.titre)}')`}); });
  etat.evenements.forEach(e=>{ if((e.titre+" "+(e.lieu||"")).toLowerCase().includes(q)) res.push({type:"Événement", c:"var(--ligne3)", titre:e.titre, extrait:dateLisible(e.date)+(e.heure?" · "+e.heure:""), action:`fermer('recherche-fond');montrerEcran('agenda');choisirJour('${e.date}')`}); });
  etat.seances.forEach(s=>{ if((s.type+" "+(s.notes||"")).toLowerCase().includes(q)) res.push({type:"Séance", c:"var(--ligne5)", titre:s.type+" · "+s.duree+" min", extrait:dateLisible(s.date), action:`montrerEcran('sport');fermer('recherche-fond')`}); });
  zone.innerHTML = res.length ? res.slice(0,25).map(r=>
    `<div class="resultat" onclick="${r.action}">
      <div class="rtype" style="color:${r.c}">${r.type}</div>
      <div class="rtitre">${echap(r.titre)}</div>
      ${r.extrait?`<div class="rextrait">${echap(r.extrait)}</div>`:""}
    </div>`).join("")
  : '<div class="vide" style="padding:10px 4px">Aucun résultat.</div>';
}

// ---------- Aujourd'hui ----------
function captureRapide(){
  const champ = document.getElementById("capture-rapide");
  const texte = champ.value.trim();
  if(!texte) return;
  etat.notes.unshift({ id:uid(), titre:texte.slice(0,60), corps:texte, tags:["boîte de réception"], date:AUJ });
  champ.value = ""; sauver(); toutAfficher();
}
function afficherAujourdhui(){
  const dj = etat.taches.filter(t => !t.fait && t.echeance && t.echeance <= AUJ);
  document.getElementById("auj-taches").innerHTML = dj.length ? dj.map(t=>ligneTacheHTML(t,false)).join("")
    : '<div class="vide">Rien d\'urgent aujourd\'hui ✨</div>';
  const charge = dj.reduce((a,t)=>a+(t.duree||0),0);
  document.getElementById("charge-jour").textContent = charge ? "⏱ "+(charge>=60? Math.floor(charge/60)+"h"+String(charge%60).padStart(2,"0") : charge+" min") : "";

  const evts = evenementsDuJour(AUJ);
  document.getElementById("auj-agenda").innerHTML = evts.length ? evts.map(evenementHTML).join("")
    : '<div class="vide">Aucun événement prévu aujourd\'hui.</div>';

  document.getElementById("auj-habitudes").innerHTML = etat.habitudes.length ? etat.habitudes.map(habitudeHTML).join("")
    : '<div class="vide">Crée tes habitudes dans l\'onglet Suivi pour les cocher ici.</div>';

  // Comptes à rebours
  const stars = etat.evenements.filter(e=>e.star && !e.recur && e.date>=AUJ).sort((a,b)=>a.date.localeCompare(b.date)).slice(0,4);
  document.getElementById("carte-comptes").style.display = stars.length ? "block" : "none";
  document.getElementById("auj-comptes").innerHTML = stars.map(e=>{
    const jours = Math.round((new Date(e.date)-new Date(AUJ))/864e5);
    return `<div class="compte"><span class="j">${jours===0?"Auj.":"J−"+jours}</span><span>${echap(e.titre)} · ${dateLisible(e.date)}</span></div>`;
  }).join("");
}
function majStatsSemaine(){
  const lundi = lundiDe(AUJ);
  const tachesFaites = etat.taches.filter(t=>t.fait && t.faitLe && t.faitLe>=lundi);
  const seances = etat.seances.filter(s=>s.date>=lundi);
  const notes = etat.notes.filter(n=>n.date>=lundi);
  document.getElementById("chiffre-taches").textContent = tachesFaites.length;
  document.getElementById("chiffre-minutes").textContent = seances.reduce((a,s)=>a+s.duree,0);
  document.getElementById("chiffre-notes").textContent = notes.length;
  let coches=0,total=0;
  const nbJours = ((jourSemaine(AUJ)+6)%7)+1;
  etat.habitudes.forEach(h=>{ for(let i=0;i<nbJours;i++){ total++; if(h.jours[decaler(lundi,i)]) coches++; } });
  document.getElementById("chiffre-habitudes").textContent = total? Math.round(coches/total*100)+"%" : "—";
  const labels=["L","M","M","J","V","S","D"];
  const vals = labels.map((_,i)=> etat.taches.filter(t=>t.fait && t.faitLe===decaler(lundi,i)).length);
  document.getElementById("graph-semaine").innerHTML =
    '<div style="font-size:12px;color:var(--texte2);margin-top:10px">Tâches terminées par jour</div>' + svgBarres(vals, labels, "#2E6FE0");
}

// ---------- Revue hebdomadaire ----------
function ouvrirRevue(){
  const lundi = lundiDe(AUJ);
  const tf = etat.taches.filter(t=>t.fait && t.faitLe && t.faitLe>=lundi).length;
  const sc = etat.seances.filter(s=>s.date>=lundi);
  document.getElementById("revue-stats").innerHTML =
    `<p>Semaine du ${dateLisible(lundi)} : <b>${tf}</b> tâches terminées · <b>${sc.length}</b> séances (${sc.reduce((a,s)=>a+s.duree,0)} min) · <b>${etat.notes.filter(n=>n.date>=lundi).length}</b> notes créées.</p>`;
  ouvrir("dlg-revue");
}
function sauverRevue(){
  const r1=document.getElementById("revue-1").value.trim(), r2=document.getElementById("revue-2").value.trim(), r3=document.getElementById("revue-3").value.trim();
  const corps = "# Ce qui a bien avancé\n"+(r1||"—")+"\n\n# Ce qui a bloqué\n"+(r2||"—")+"\n\n# Priorités de la semaine prochaine\n"+(r3||"—");
  etat.notes.unshift({ id:uid(), titre:"Revue de la semaine du "+dateLisible(lundiDe(AUJ)), corps, tags:["revue"], date:AUJ });
  ["revue-1","revue-2","revue-3"].forEach(i=>document.getElementById(i).value="");
  sauver(); fermer("dlg-revue"); toutAfficher();
}

// ---------- Tâches ----------
let filtreTaches = "actives", vueTaches = "liste", projetFiltre = null;
document.getElementById("filtres-taches").addEventListener("click", e=>{
  if(e.target.dataset.f){
    filtreTaches = e.target.dataset.f;
    document.querySelectorAll("#filtres-taches button").forEach(b=>b.classList.toggle("actif", b===e.target));
    afficherTaches();
  }
});
function changerVueTaches(v){
  vueTaches = v;
  document.getElementById("chip-vue-liste").classList.toggle("actif", v==="liste");
  document.getElementById("chip-vue-matrice").classList.toggle("actif", v==="matrice");
  afficherTaches();
}
function basculerTri(){
  etat.prefs.tri = etat.prefs.tri==="auto" ? "manuel" : "auto";
  document.getElementById("chip-tri").textContent = "Tri : "+etat.prefs.tri;
  sauver(); afficherTaches();
}
function majSelectProjets(){
  document.getElementById("tache-projet").innerHTML = etat.projets.map(p=>`<option>${echap(p)}</option>`).join("");
  document.getElementById("filtres-projets").innerHTML =
    `<button class="chip ${projetFiltre===null?"actif":""}" onclick="filtrerProjet(null)">Toutes les listes</button>` +
    etat.projets.map(p=>`<button class="chip ${projetFiltre===p?"actif":""}" onclick="filtrerProjet('${attr(p)}')">${echap(p)}</button>`).join("");
  document.getElementById("liste-projets").innerHTML = etat.projets.map(p=>
    `<div class="habitude"><div class="nom">${echap(p)}</div>${etat.projets.length>1?`<button class="btn-suppr" onclick="supprimerProjet('${attr(p)}')">×</button>`:""}</div>`).join("");
}
function filtrerProjet(p){ projetFiltre = p; majSelectProjets(); afficherTaches(); }
function ajouterProjet(){
  const nom = document.getElementById("projet-nom").value.trim();
  if(!nom || etat.projets.includes(nom)) return;
  etat.projets.push(nom);
  document.getElementById("projet-nom").value="";
  sauver(); majSelectProjets();
}
function supprimerProjet(nom){
  etat.projets = etat.projets.filter(p=>p!==nom);
  etat.taches.forEach(t=>{ if(t.projet===nom) t.projet = etat.projets[0]; });
  if(projetFiltre===nom) projetFiltre=null;
  sauver(); majSelectProjets(); afficherTaches();
}
function ajouterTache(){
  const champ = document.getElementById("tache-libelle");
  const libelle = champ.value.trim();
  if(!libelle) return;
  const repete = document.getElementById("tache-repete").value;
  let echeance = document.getElementById("tache-date").value || null;
  if(repete && !echeance) echeance = AUJ;
  etat.taches.unshift({
    id:uid(), libelle, echeance, repete, fait:false,
    projet: document.getElementById("tache-projet").value,
    duree: parseInt(document.getElementById("tache-duree").value,10)||0,
    urgent: document.getElementById("chip-urgent").classList.contains("actif"),
    important: document.getElementById("chip-important").classList.contains("actif"),
    sous:[], ordre: Date.now()
  });
  champ.value=""; document.getElementById("tache-date").value="";
  document.getElementById("tache-duree").value=""; document.getElementById("tache-repete").value="";
  document.getElementById("chip-urgent").classList.remove("actif");
  document.getElementById("chip-important").classList.remove("actif");
  sauver(); toutAfficher();
}
function prochaineEcheance(iso, repete){
  const base = iso > AUJ ? iso : AUJ;
  const [a,m,j] = base.split("-").map(Number);
  const d = new Date(a,m-1,j);
  if(repete==="quotidien") d.setDate(d.getDate()+1);
  if(repete==="hebdo")     d.setDate(d.getDate()+7);
  if(repete==="mensuel")   d.setMonth(d.getMonth()+1);
  return cleDate(d);
}
function basculerTache(id){
  const t = etat.taches.find(t=>t.id===id);
  if(!t) return;
  t.fait = !t.fait;
  t.faitLe = t.fait ? AUJ : null;
  if(t.fait && t.repete){
    etat.taches.unshift({ id:uid(), libelle:t.libelle, projet:t.projet, duree:t.duree, urgent:t.urgent, important:t.important,
      repete:t.repete, echeance:prochaineEcheance(t.echeance||AUJ, t.repete), fait:false, sous:(t.sous||[]).map(s=>({id:uid(),l:s.l,f:false})), ordre:Date.now() });
    t.repete = "";
  }
  sauver(); toutAfficher();
}
function supprimerTache(id){ etat.taches = etat.taches.filter(t=>t.id!==id); sauver(); toutAfficher(); }
function reporterDemain(id){
  const t = etat.taches.find(t=>t.id===id);
  if(t){ t.echeance = decaler(AUJ,1); sauver(); toutAfficher(); }
}
function deplacerTache(id, sens){
  const visibles = tachesFiltrees();
  const i = visibles.findIndex(t=>t.id===id);
  const cible = visibles[i+sens];
  if(!cible) return;
  const t = etat.taches.find(t=>t.id===id);
  [t.ordre, cible.ordre] = [cible.ordre, t.ordre];
  sauver(); afficherTaches();
}
function ajouterSousTache(id){
  const champ = document.getElementById("st-"+id);
  const l = champ.value.trim();
  if(!l) return;
  const t = etat.taches.find(t=>t.id===id);
  (t.sous = t.sous||[]).push({id:uid(), l, f:false});
  sauver(); afficherTaches(); afficherAujourdhui();
  const nouveau = document.getElementById("st-"+id); if(nouveau) nouveau.focus();
}
function basculerSous(tid, sid){
  const t = etat.taches.find(t=>t.id===tid);
  const s = (t.sous||[]).find(s=>s.id===sid);
  if(s){ s.f = !s.f; sauver(); afficherTaches(); afficherAujourdhui(); }
}
function supprimerSous(tid, sid){
  const t = etat.taches.find(t=>t.id===tid);
  t.sous = (t.sous||[]).filter(s=>s.id!==sid);
  sauver(); afficherTaches(); afficherAujourdhui();
}
const LIB_REPETE = {quotidien:"↻ quotidien", hebdo:"↻ hebdo", mensuel:"↻ mensuel"};
function ligneTacheHTML(t, complet){
  const retard = !t.fait && t.echeance && t.echeance < AUJ;
  const sous = t.sous||[];
  const nf = sous.filter(s=>s.f).length;
  return `<div class="item ${t.fait?"fait":""}">
    ${complet && etat.prefs.tri==="manuel" && filtreTaches!=="faites" ? `<div class="ordre-btns"><button onclick="deplacerTache('${t.id}',-1)">▲</button><button onclick="deplacerTache('${t.id}',1)">▼</button></div>`:""}
    <button class="coche ${t.fait?"fait":""}" onclick="basculerTache('${t.id}')" aria-label="Basculer">${t.fait?"✓":""}</button>
    <div class="contenu">
      <div class="libelle">${echap(t.libelle)}</div>
      <div class="meta">
        <span class="badge projet">${echap(t.projet||"Perso")}</span>
        ${t.urgent?'<span class="badge urgent">🔥 urgent</span>':""}
        ${t.important?'<span class="badge important">⭐ important</span>':""}
        ${t.repete?`<span class="badge repete">${LIB_REPETE[t.repete]}</span>`:""}
        ${t.duree?`<span>⏱ ${t.duree} min</span>`:""}
        ${t.echeance ? (retard ? `<span class="badge retard">en retard · ${dateLisible(t.echeance)}</span>` : `<span>📅 ${dateLisible(t.echeance)}</span>`) : ""}
        ${sous.length?`<span>☑ ${nf}/${sous.length}</span>`:""}
        ${!t.fait && t.echeance && t.echeance<=AUJ ? `<button class="btn-mini" onclick="reporterDemain('${t.id}')">→ demain</button>`:""}
      </div>
      ${complet ? `<div class="sous">
        ${sous.map(s=>`<div class="srow ${s.f?"faite":""}">
          <button class="mini-coche ${s.f?"fait":""}" onclick="basculerSous('${t.id}','${s.id}')">${s.f?"✓":""}</button>
          <span style="flex:1">${echap(s.l)}</span>
          <button class="btn-suppr" style="font-size:13px" onclick="supprimerSous('${t.id}','${s.id}')">×</button>
        </div>`).join("")}
        ${!t.fait?`<div class="ajout"><input type="text" id="st-${t.id}" placeholder="＋ sous-tâche" onkeydown="if(event.key==='Enter')ajouterSousTache('${t.id}')"></div>`:""}
      </div>`:""}
    </div>
    <button class="btn-suppr" onclick="supprimerTache('${t.id}')" aria-label="Supprimer">×</button>
  </div>`;
}
function tachesFiltrees(){
  let liste = etat.taches;
  if(filtreTaches==="actives") liste = liste.filter(t=>!t.fait);
  if(filtreTaches==="faites")  liste = liste.filter(t=>t.fait);
  if(filtreTaches==="auj")     liste = liste.filter(t=>!t.fait && t.echeance && t.echeance<=AUJ);
  if(projetFiltre) liste = liste.filter(t=>(t.projet||"Perso")===projetFiltre);
  if(etat.prefs.tri==="manuel"){
    liste = [...liste].sort((a,b)=>(a.ordre||0)-(b.ordre||0));
  }else{
    liste = [...liste].sort((a,b)=>{
      const ea = a.echeance||"9999", eb = b.echeance||"9999";
      if(ea!==eb) return ea.localeCompare(eb);
      return (b.urgent+b.important) - (a.urgent+a.important);
    });
  }
  return liste;
}
function afficherTaches(){
  document.getElementById("chip-tri").textContent = "Tri : "+etat.prefs.tri;
  const liste = tachesFiltrees();
  const zone = document.getElementById("liste-taches");
  if(vueTaches==="matrice"){
    const q = {
      fi:{t:"🔥⭐ Faire d'abord", c:"var(--danger)", l:liste.filter(t=>t.urgent&&t.important)},
      pl:{t:"⭐ Planifier", c:"#9A6B00", l:liste.filter(t=>!t.urgent&&t.important)},
      vf:{t:"🔥 Vite fait", c:"var(--ligne5)", l:liste.filter(t=>t.urgent&&!t.important)},
      op:{t:"En option", c:"var(--texte2)", l:liste.filter(t=>!t.urgent&&!t.important)}
    };
    zone.innerHTML = `<div class="quad">`+Object.values(q).map(b=>
      `<div class="bloc"><h4 style="color:${b.c}">${b.t}</h4>${b.l.length? b.l.map(t=>ligneTacheHTML(t,false)).join("") : '<div class="vide" style="font-size:12.5px">—</div>'}</div>`).join("")+`</div>`;
  }else{
    zone.innerHTML = liste.length ? liste.map(t=>ligneTacheHTML(t,true)).join("") : '<div class="vide">Aucune tâche ici.</div>';
  }
}

// ---------- Agenda ----------
let moisAffiche = new Date(); moisAffiche.setDate(1);
let jourChoisi = AUJ, semaineBase = lundiDe(AUJ), vueAgenda = "mois";
function occursOn(e, iso){
  if(!e.recur) return e.date===iso;
  if(iso < e.date) return false;
  if(e.recur==="quotidien") return true;
  if(e.recur==="hebdo") return jourSemaine(iso)===jourSemaine(e.date);
  if(e.recur==="mensuel") return iso.slice(8)===e.date.slice(8);
  return false;
}
function evenementsDuJour(iso){
  return etat.evenements.filter(e=>occursOn(e,iso)).sort((a,b)=>(a.heure||"").localeCompare(b.heure||""));
}
function changerVueAgenda(v){
  vueAgenda = v;
  document.getElementById("chip-mois").classList.toggle("actif", v==="mois");
  document.getElementById("chip-semaine").classList.toggle("actif", v==="semaine");
  document.getElementById("carte-cal-mois").style.display = v==="mois"?"block":"none";
  document.getElementById("carte-cal-semaine").style.display = v==="semaine"?"block":"none";
  afficherCalendrier();
}
function changerMois(delta){ moisAffiche.setMonth(moisAffiche.getMonth()+delta); afficherCalendrier(); }
function changerSemaine(delta){ semaineBase = decaler(semaineBase, delta*7); afficherCalendrier(); }
function choisirJour(iso){
  jourChoisi = iso;
  document.getElementById("evt-date").value = iso;
  afficherCalendrier(); afficherEvenementsJour();
}
function afficherCalendrier(){
  // Vue mois
  document.getElementById("cal-mois").textContent = moisAffiche.toLocaleDateString("fr-FR",{month:"long",year:"numeric"});
  const g = document.getElementById("cal-grille");
  let html = ["L","M","M","J","V","S","D"].map(n=>`<div class="jour-nom">${n}</div>`).join("");
  const decal = (new Date(moisAffiche).getDay()+6)%7;
  for(let i=0;i<decal;i++) html += `<div class="cal-case"></div>`;
  const nbJours = new Date(moisAffiche.getFullYear(), moisAffiche.getMonth()+1, 0).getDate();
  for(let j=1;j<=nbJours;j++){
    const iso = cleDate(new Date(moisAffiche.getFullYear(), moisAffiche.getMonth(), j));
    const aEvt = etat.evenements.some(e=>occursOn(e,iso));
    const cls = ["cal-case", iso===AUJ?"aujourdhui":"", iso===jourChoisi?"choisi":""].join(" ");
    html += `<button class="${cls}" onclick="choisirJour('${iso}')">${j}${aEvt?'<span class="point"></span>':""}</button>`;
  }
  g.innerHTML = html;
  // Vue semaine
  document.getElementById("sem-titre").textContent = "Semaine du "+dateLisible(semaineBase);
  document.getElementById("sem-liste").innerHTML = [0,1,2,3,4,5,6].map(i=>{
    const iso = decaler(semaineBase,i);
    const evts = evenementsDuJour(iso);
    return `<div class="sem-jour ${iso===AUJ?"auj":""}" onclick="choisirJour('${iso}')" style="cursor:pointer">
      <div class="nom">${dateLisible(iso)}</div>
      <div class="evts">${evts.length? evts.map(e=>`<span class="cat-point" style="background:${CAT[e.cat||"autre"].c}"></span>${e.heure?e.heure+" ":""}${echap(e.titre)}`).join("<br>") : "—"}</div>
    </div>`;
  }).join("");
}
const LIB_RAPPEL = {0:"à l'heure", 10:"10 min avant", 30:"30 min avant", 60:"1 h avant", 1440:"1 j avant"};
function ajouterEvenement(){
  const titre = document.getElementById("evt-titre").value.trim();
  const date = document.getElementById("evt-date").value;
  if(!titre || !date) return;
  etat.evenements.push({
    id:uid(), titre, date,
    heure: document.getElementById("evt-heure").value || "",
    lieu: document.getElementById("evt-lieu").value.trim(),
    duree: parseInt(document.getElementById("evt-duree").value,10)||0,
    cat: document.getElementById("evt-cat").value,
    recur: document.getElementById("evt-recur").value,
    rappel: parseInt(document.getElementById("evt-rappel").value,10),
    star: document.getElementById("chip-star").classList.contains("actif")
  });
  ["evt-titre","evt-heure","evt-lieu","evt-duree"].forEach(i=>document.getElementById(i).value="");
  document.getElementById("evt-rappel").value="-1"; document.getElementById("evt-recur").value="";
  document.getElementById("chip-star").classList.remove("actif");
  document.getElementById("form-evt").open = false;
  jourChoisi = date;
  sauver(); toutAfficher();
}
function supprimerEvenement(id){ etat.evenements = etat.evenements.filter(e=>e.id!==id); sauver(); toutAfficher(); }
function evenementHTML(e){
  return `<div class="evenement">
    <div class="heure">${e.heure||"—"}</div>
    <div class="contenu">
      <div class="titre"><span class="cat-point" style="background:${CAT[e.cat||"autre"].c}"></span>${echap(e.titre)}${e.duree?` <span style="font-size:12px;color:var(--texte2)">(${e.duree} min)</span>`:""}${e.recur?` <span class="badge repete">${LIB_REPETE[e.recur]}</span>`:""}</div>
      ${e.lieu?`<div class="lieu">📍 ${echap(e.lieu)}</div>`:""}
      ${e.rappel>=0?`<div class="rappel-info">🔔 ${LIB_RAPPEL[e.rappel]||""}</div>`:""}
    </div>
    <button class="btn-suppr" onclick="supprimerEvenement('${e.id}')" aria-label="Supprimer">×</button>
  </div>`;
}
function afficherEvenementsJour(){
  document.getElementById("titre-jour-choisi").textContent = jourChoisi===AUJ ? "Aujourd'hui" : dateLisible(jourChoisi);
  const evts = evenementsDuJour(jourChoisi);
  document.getElementById("liste-evenements-jour").innerHTML =
    evts.length ? evts.map(evenementHTML).join("") : '<div class="vide">Rien de prévu ce jour-là.</div>';
}
function afficherAVenir(){
  let html = "";
  for(let i=0;i<=7;i++){
    const iso = decaler(AUJ,i);
    evenementsDuJour(iso).forEach(e=>{
      html += `<div class="evenement">
        <div class="heure" style="width:auto;min-width:52px">${dateLisible(iso)}</div>
        <div class="contenu"><div class="titre"><span class="cat-point" style="background:${CAT[e.cat||"autre"].c}"></span>${e.heure?e.heure+" · ":""}${echap(e.titre)}</div>
        ${e.lieu?`<div class="lieu">📍 ${echap(e.lieu)}</div>`:""}</div>
      </div>`;
    });
  }
  document.getElementById("liste-a-venir").innerHTML = html || '<div class="vide">Semaine calme pour l\'instant.</div>';
}

// ---------- Export / import ICS ----------
function icsDate(iso, heure){
  const d = iso.replace(/-/g,"");
  return heure ? d+"T"+heure.replace(":","")+"00" : d;
}
function exporterICS(){
  const L = ["BEGIN:VCALENDAR","VERSION:2.0","PRODID:-//MonQuotidien//FR"];
  etat.evenements.forEach(e=>{
    L.push("BEGIN:VEVENT","UID:"+e.id+"@mon-quotidien");
    if(e.heure){ L.push("DTSTART:"+icsDate(e.date,e.heure)); if(e.duree) L.push("DURATION:PT"+e.duree+"M"); }
    else L.push("DTSTART;VALUE=DATE:"+icsDate(e.date));
    L.push("SUMMARY:"+e.titre.replace(/[\n,;]/g," "));
    if(e.lieu) L.push("LOCATION:"+e.lieu.replace(/[\n,;]/g," "));
    if(e.recur) L.push("RRULE:FREQ="+({quotidien:"DAILY",hebdo:"WEEKLY",mensuel:"MONTHLY"}[e.recur]));
    L.push("END:VEVENT");
  });
  L.push("END:VCALENDAR");
  telecharger(new Blob([L.join("\r\n")],{type:"text/calendar"}), "mon-quotidien-agenda.ics");
}
function importerICS(ev){
  const f = ev.target.files[0]; if(!f) return;
  const lecteur = new FileReader();
  lecteur.onload = ()=>{
    const texte = lecteur.result.replace(/\r\n[ \t]/g,""); // déplier les lignes
    const blocs = texte.split("BEGIN:VEVENT").slice(1);
    let n = 0;
    blocs.forEach(b=>{
      const prendre = re => { const m = b.match(re); return m ? m[1].trim() : ""; };
      const titre = prendre(/SUMMARY[^:]*:(.*)/);
      const dt = prendre(/DTSTART[^:]*:([0-9T]+)/);
      if(!titre || !dt) return;
      const date = dt.slice(0,4)+"-"+dt.slice(4,6)+"-"+dt.slice(6,8);
      const heure = dt.length>=13 ? dt.slice(9,11)+":"+dt.slice(11,13) : "";
      const freq = prendre(/RRULE:.*FREQ=(\w+)/);
      etat.evenements.push({ id:uid(), titre, date, heure,
        lieu: prendre(/LOCATION[^:]*:(.*)/), duree:0, cat:"autre",
        recur: {DAILY:"quotidien",WEEKLY:"hebdo",MONTHLY:"mensuel"}[freq]||"", rappel:-1, star:false });
      n++;
    });
    sauver(); toutAfficher();
    alert(n+" événement(s) importé(s).");
  };
  lecteur.readAsText(f); ev.target.value="";
}
function telecharger(blob, nom){
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob); a.download = nom; a.click();
  URL.revokeObjectURL(a.href);
}

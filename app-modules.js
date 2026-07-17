// ---------- Notes ----------
let tagFiltre = null, vueNotes = "actives";
const MODELES = {
  reunion:"# Objectif\n\n# Points abordés\n- \n\n# Décisions\n- [ ] \n\n# Prochaines étapes\n- [ ] ",
  idee:"# L'idée en une phrase\n\n# Pourquoi c'est intéressant\n\n# Première petite étape\n- [ ] ",
  lecture:"# Livre / article\n\n**Auteur :** \n\n# Les 3 idées clés\n- \n- \n- \n\n# Ce que j'en retire"
};
function appliquerModele(){
  const m = document.getElementById("note-modele").value;
  if(m){ document.getElementById("note-corps").value = MODELES[m]; document.getElementById("note-modele").value=""; }
}
function journalDuJour(){
  const titre = "Journal — "+dateLisible(AUJ);
  const existante = etat.notes.find(n=>n.titre===titre);
  if(existante){ ouvrirNote(titre); return; }
  etat.notes.unshift({ id:uid(), titre,
    corps:"# Humeur du jour\n\n# 3 bonnes choses aujourd'hui\n- \n- \n- \n\n# En vrac", tags:["journal"], date:AUJ });
  sauver(); toutAfficher(); ouvrirNote(titre);
}
function ajouterNote(){
  const titre = document.getElementById("note-titre").value.trim();
  const corps = document.getElementById("note-corps").value.trim();
  if(!titre && !corps) return;
  const tags = document.getElementById("note-tags").value.split(",").map(t=>t.trim()).filter(Boolean);
  etat.notes.unshift({ id:uid(), titre: titre || corps.slice(0,60), corps, tags, date:AUJ });
  ["note-titre","note-corps","note-tags"].forEach(i=>document.getElementById(i).value="");
  sauver(); toutAfficher();
}
function supprimerNote(id){ etat.notes = etat.notes.filter(n=>n.id!==id); sauver(); toutAfficher(); }
function basculerNote(id){ document.querySelector(`#note-${id} .corps`)?.classList.toggle("replie"); }
function epinglerNote(id){ const n=etat.notes.find(n=>n.id===id); n.epingle=!n.epingle; sauver(); afficherNotes(); }
function archiverNote(id){ const n=etat.notes.find(n=>n.id===id); n.archive=!n.archive; sauver(); afficherNotes(); }
function changerVueNotes(btn){
  vueNotes = btn.dataset.vn;
  document.querySelectorAll("[data-vn]").forEach(b=>b.classList.toggle("actif", b===btn));
  afficherNotes();
}
function filtrerTag(tag){ tagFiltre = (tagFiltre===tag)?null:tag; afficherNotes(); }
function mdInline(s){
  return echap(s)
    .replace(/\[\[([^\[\]]+)\]\]/g,(m,t)=>`<a class="lien-note" onclick="event.stopPropagation();ouvrirNote('${attr(t)}')">${t}</a>`)
    .replace(/\*\*([^*]+)\*\*/g,"<b>$1</b>")
    .replace(/\*([^*]+)\*/g,"<i>$1</i>")
    .replace(/`([^`]+)`/g,"<code>$1</code>");
}
function rendreMd(txt, noteId){
  return txt.split("\n").map((l,i)=>{
    const c = l.match(/^\s*- \[( |x)\] ?(.*)$/);
    if(c) return `<div class="md-case"><button class="case ${c[1]==="x"?"cochee":""}" onclick="event.stopPropagation();basculerCase('${noteId}',${i})">${c[1]==="x"?"✓":""}</button><span class="${c[1]==="x"?"barre":""}">${mdInline(c[2])}</span></div>`;
    if(/^## /.test(l)) return `<div class="md-h2">${mdInline(l.slice(3))}</div>`;
    if(/^# /.test(l))  return `<div class="md-h1">${mdInline(l.slice(2))}</div>`;
    if(/^\s*[-*] /.test(l)) return `<div class="md-li">• ${mdInline(l.replace(/^\s*[-*] /,""))}</div>`;
    return l.trim() ? `<div>${mdInline(l)}</div>` : `<div class="md-vide"></div>`;
  }).join("");
}
function basculerCase(noteId, ligne){
  const n = etat.notes.find(n=>n.id===noteId);
  if(!n) return;
  const lignes = n.corps.split("\n");
  lignes[ligne] = lignes[ligne].includes("[ ]") ? lignes[ligne].replace("[ ]","[x]") : lignes[ligne].replace("[x]","[ ]");
  n.corps = lignes.join("\n");
  sauver(); afficherNotes();
}
function trouverNoteParTitre(titre){
  const t = titre.trim().toLowerCase();
  return etat.notes.find(n=>n.titre.toLowerCase()===t) || etat.notes.find(n=>n.titre.toLowerCase().includes(t));
}
function ouvrirNote(titre){
  const n = trouverNoteParTitre(titre);
  montrerEcran("notes");
  if(n){
    tagFiltre = null;
    vueNotes = n.archive ? "archivees" : "actives";
    document.querySelectorAll("[data-vn]").forEach(b=>b.classList.toggle("actif", b.dataset.vn===vueNotes));
    document.getElementById("recherche-notes").value = "";
    afficherNotes();
    const el = document.getElementById("note-"+n.id);
    if(el){
      el.querySelector(".corps")?.classList.remove("replie");
      el.classList.add("surbrillance");
      el.scrollIntoView({behavior:"smooth", block:"center"});
      setTimeout(()=>el.classList.remove("surbrillance"), 1600);
    }
  }else{
    document.getElementById("note-titre").value = titre;
    document.getElementById("note-corps").focus();
    window.scrollTo({top:0, behavior:"smooth"});
  }
}
function retroliens(note){
  const motif = "[["+note.titre.toLowerCase();
  return etat.notes.filter(n => n.id!==note.id && (n.corps||"").toLowerCase().includes(motif));
}
function afficherNotes(){
  const q = document.getElementById("recherche-notes").value.trim().toLowerCase();
  const tousTags = [...new Set(etat.notes.filter(n=>!n.archive).flatMap(n=>n.tags))];
  document.getElementById("filtres-tags").innerHTML = tousTags.map(t=>
    `<button class="chip ${tagFiltre===t?"actif":""}" onclick="filtrerTag('${attr(t)}')">#${echap(t)}</button>`).join("");
  let liste = etat.notes;
  if(vueNotes==="actives")   liste = liste.filter(n=>!n.archive);
  if(vueNotes==="epinglees") liste = liste.filter(n=>n.epingle && !n.archive);
  if(vueNotes==="archivees") liste = liste.filter(n=>n.archive);
  if(tagFiltre) liste = liste.filter(n=>n.tags.includes(tagFiltre));
  if(q) liste = liste.filter(n=> (n.titre+" "+n.corps+" "+n.tags.join(" ")).toLowerCase().includes(q));
  liste = [...liste].sort((a,b)=> (b.epingle?1:0)-(a.epingle?1:0));
  document.getElementById("liste-notes").innerHTML = liste.length ? liste.map(n=>{
    const liens = retroliens(n);
    return `<div class="note ${n.epingle?"epinglee":""}" id="note-${n.id}">
      <div class="titre"><span>${n.epingle?"📌 ":""}${echap(n.titre)}</span>
        <span class="outils">
          <button class="${n.epingle?"on":""}" onclick="epinglerNote('${n.id}')" aria-label="Épingler">📌</button>
          <button onclick="archiverNote('${n.id}')" aria-label="Archiver">${n.archive?"↩":"🗄"}</button>
          <button class="btn-suppr" onclick="supprimerNote('${n.id}')" aria-label="Supprimer">×</button>
        </span></div>
      ${n.corps?`<div class="corps replie" onclick="basculerNote('${n.id}')">${rendreMd(n.corps, n.id)}</div>`:""}
      ${n.tags.length?`<div class="tags">${n.tags.map(t=>`<span class="tag">#${echap(t)}</span>`).join("")}</div>`:""}
      ${liens.length?`<div class="retroliens">↩ Mentionnée dans : ${liens.map(l=>`<a class="lien-note" onclick="ouvrirNote('${attr(l.titre)}')">${echap(l.titre)}</a>`).join(", ")}</div>`:""}
      <div class="pied">${dateLisible(n.date)}</div>
    </div>`;
  }).join("")
  : '<div class="vide" style="padding:10px 4px">Aucune note ici. Ton second cerveau attend 🧠</div>';
}

// ---------- Graphe des notes ----------
function ouvrirGraphe(){
  const notes = etat.notes.filter(n=>!n.archive).slice(0,30);
  if(notes.length<2){ alert("Ajoute au moins deux notes (avec des liens [[…]]) pour voir le graphe."); return; }
  const T=320, cx=T/2, cy=T/2, r=T/2-46;
  const pos = {};
  notes.forEach((n,i)=>{
    const a = (i/notes.length)*Math.PI*2 - Math.PI/2;
    pos[n.id] = {x:cx+r*Math.cos(a), y:cy+r*Math.sin(a)};
  });
  let traits="", bulles="";
  notes.forEach(n=>{
    notes.forEach(m=>{
      if(n.id!==m.id && (n.corps||"").toLowerCase().includes("[["+m.titre.toLowerCase()))
        traits += `<line x1="${pos[n.id].x}" y1="${pos[n.id].y}" x2="${pos[m.id].x}" y2="${pos[m.id].y}" stroke="var(--trait)" stroke-width="1.5"/>`;
    });
  });
  notes.forEach(n=>{
    const nb = retroliens(n).length;
    const ray = 7 + Math.min(nb*2.5, 10);
    const court = n.titre.length>13 ? n.titre.slice(0,12)+"…" : n.titre;
    bulles += `<g onclick="fermer('dlg-graphe');ouvrirNote('${attr(n.titre)}')" style="cursor:pointer">
      <circle cx="${pos[n.id].x}" cy="${pos[n.id].y}" r="${ray}" fill="var(--ligne4)" opacity="0.85"/>
      <text x="${pos[n.id].x}" y="${pos[n.id].y + ray + 11}" font-size="8.5" text-anchor="middle" fill="var(--texte2)">${echap(court)}</text></g>`;
  });
  document.getElementById("graphe-svg").innerHTML = `<svg viewBox="0 0 ${T} ${T}" class="graph">${traits}${bulles}</svg>`;
  ouvrir("dlg-graphe");
}

// ---------- Export Markdown (zip maison, sans compression) ----------
const TABLE_CRC = (()=>{ let t=[]; for(let n=0;n<256;n++){ let c=n; for(let k=0;k<8;k++) c = c&1 ? 0xEDB88320 ^ (c>>>1) : c>>>1; t[n]=c>>>0; } return t; })();
function crc32(o){ let c=0xFFFFFFFF; for(let i=0;i<o.length;i++) c = TABLE_CRC[(c^o[i])&0xFF] ^ (c>>>8); return (c^0xFFFFFFFF)>>>0; }
function zipper(fichiers){
  const enc = new TextEncoder(), parts=[], centraux=[]; let offset=0;
  const u16=v=>[v&255,(v>>8)&255], u32=v=>[v&255,(v>>8)&255,(v>>16)&255,(v>>>24)&255];
  fichiers.forEach(f=>{
    const nom=enc.encode(f.nom), data=enc.encode(f.contenu), crc=crc32(data);
    const local=new Uint8Array([0x50,0x4B,3,4,...u16(20),...u16(0x0800),...u16(0),...u16(0),...u16(0),...u32(crc),...u32(data.length),...u32(data.length),...u16(nom.length),...u16(0)]);
    parts.push(local,nom,data);
    centraux.push({nom,taille:data.length,crc,offset});
    offset += local.length+nom.length+data.length;
  });
  let tailleCD=0;
  centraux.forEach(c=>{
    const e=new Uint8Array([0x50,0x4B,1,2,...u16(20),...u16(20),...u16(0x0800),...u16(0),...u16(0),...u16(0),...u32(c.crc),...u32(c.taille),...u32(c.taille),...u16(c.nom.length),...u16(0),...u16(0),...u16(0),...u16(0),...u32(0),...u32(c.offset)]);
    parts.push(e,c.nom); tailleCD += e.length+c.nom.length;
  });
  parts.push(new Uint8Array([0x50,0x4B,5,6,0,0,0,0,...u16(centraux.length),...u16(centraux.length),...u32(tailleCD),...u32(offset),0,0]));
  return new Blob(parts,{type:"application/zip"});
}
function exporterMarkdown(){
  if(!etat.notes.length){ alert("Aucune note à exporter."); return; }
  const noms = new Set();
  const fichiers = etat.notes.map(n=>{
    let base = n.titre.replace(/[\\/:*?"<>|#^[\]]/g,"").trim().slice(0,80) || "note";
    let nom = base; let i=2;
    while(noms.has(nom)){ nom = base+" "+i; i++; }
    noms.add(nom);
    const entete = n.tags.length ? "---\ntags: ["+n.tags.join(", ")+"]\ndate: "+n.date+"\n---\n\n" : "";
    return { nom: nom+".md", contenu: entete+n.corps };
  });
  telecharger(zipper(fichiers), "mon-second-cerveau.zip");
}

// ---------- Sport : programmes, progression, minuteur ----------
const PROGRAMMES = [
  {nom:"Full body débutant", type:"Musculation", duree:35, detail:"3 tours : 12 squats · 10 pompes · 12 rowings élastique · 30 s gainage · 15 fentes. 1 min de repos entre les tours."},
  {nom:"HIIT express", type:"HIIT", duree:20, detail:"8 tours de 30 s effort / 30 s repos : jumping jacks · squats · mountain climbers · burpees."},
  {nom:"Course débutant", type:"Course", duree:30, detail:"5 min de marche rapide · 8 × (1 min course / 2 min marche) · 4 min retour au calme."},
  {nom:"Haut du corps", type:"Musculation", duree:40, detail:"4 tours : 10 pompes · 10 dips · 12 élévations latérales · 10 curls · 45 s gainage."},
  {nom:"Mobilité & étirements", type:"Yoga", duree:15, detail:"Nuque · 10 chat-vache · pigeon 1 min/côté · ischios 1 min/côté · 2 min de respiration."}
];
let seanceExos = null;
function afficherProgrammes(){
  document.getElementById("liste-programmes").innerHTML = PROGRAMMES.map((p,i)=>`
    <div class="programme"><div class="entete">
      <div><div class="nom">${p.nom}</div><div class="infos">${p.type} · ${p.duree} min</div></div>
      <button class="btn secondaire petit" onclick="utiliserProgramme(${i})">Utiliser</button></div>
      <div class="detail">${p.detail}</div></div>`).join("");
  document.getElementById("liste-programmes-perso").innerHTML = etat.programmesPerso.length ? etat.programmesPerso.map(p=>`
    <div class="programme"><div class="entete">
      <div><div class="nom">${echap(p.nom)}</div><div class="infos">${p.exercices.length} exercices</div></div>
      <div style="display:flex;gap:4px">
        <button class="btn petit" onclick="lancerProgrammePerso('${p.id}')">▶ Lancer</button>
        <button class="btn-mini" onclick="modifierProgramme('${p.id}')">✎</button>
        <button class="btn-suppr" onclick="supprimerProgramme('${p.id}')">×</button>
      </div></div>
      <div class="detail">${p.exercices.map(e=>echap(e.nom)+" "+e.series+"×"+e.reps+(e.charge?" @ "+e.charge+" kg":"")).join(" · ")}</div>
    </div>`).join("") : '<div class="vide">Crée ton premier programme ci-dessous 💪</div>';
}
function ajouterLigneExo(exo){
  exo = exo||{};
  const div = document.createElement("div");
  div.className = "exo-ligne";
  div.innerHTML = `<input type="text" placeholder="Squat" value="${echap(exo.nom||"")}">
    <input type="number" min="1" value="${exo.series||3}">
    <input type="number" min="1" value="${exo.reps||10}">
    <input type="number" min="0" step="0.5" value="${exo.charge||""}" placeholder="—">
    <button class="btn-suppr" onclick="this.parentElement.remove()">×</button>`;
  document.getElementById("prog-exos").appendChild(div);
}
function sauverProgramme(){
  const nom = document.getElementById("prog-nom").value.trim();
  if(!nom) return;
  const exercices = [...document.querySelectorAll("#prog-exos .exo-ligne")].map(l=>{
    const c = l.querySelectorAll("input");
    return { nom:c[0].value.trim(), series:parseInt(c[1].value,10)||1, reps:parseInt(c[2].value,10)||1, charge:parseFloat(c[3].value)||0 };
  }).filter(e=>e.nom);
  if(!exercices.length){ alert("Ajoute au moins un exercice."); return; }
  const id = document.getElementById("prog-id").value;
  if(id){
    const p = etat.programmesPerso.find(p=>p.id===id);
    p.nom = nom; p.exercices = exercices;
  }else{
    etat.programmesPerso.push({ id:uid(), nom, exercices });
  }
  document.getElementById("prog-nom").value=""; document.getElementById("prog-id").value="";
  document.getElementById("prog-exos").innerHTML="";
  document.getElementById("form-prog").open=false;
  sauver(); afficherProgrammes();
}
function modifierProgramme(id){
  const p = etat.programmesPerso.find(p=>p.id===id);
  document.getElementById("prog-id").value = p.id;
  document.getElementById("prog-nom").value = p.nom;
  document.getElementById("prog-exos").innerHTML = "";
  p.exercices.forEach(e=>ajouterLigneExo(e));
  document.getElementById("form-prog").open = true;
}
function supprimerProgramme(id){ etat.programmesPerso = etat.programmesPerso.filter(p=>p.id!==id); sauver(); afficherProgrammes(); }
function lancerProgrammePerso(id){
  const p = etat.programmesPerso.find(p=>p.id===id);
  seanceExos = p.exercices.map(e=>({...e}));
  document.getElementById("seance-type").value = "Musculation";
  document.getElementById("seance-notes").value = p.nom+" :\n"+p.exercices.map(e=>e.nom+" "+e.series+"×"+e.reps+(e.charge?" @ "+e.charge+" kg":"")).join("\n");
  document.getElementById("carte-seance").scrollIntoView({behavior:"smooth"});
}
function utiliserProgramme(i){
  const p = PROGRAMMES[i];
  seanceExos = null;
  document.getElementById("seance-type").value = p.type;
  document.getElementById("seance-duree").value = p.duree;
  document.getElementById("seance-notes").value = p.nom+" — "+p.detail;
  document.getElementById("carte-seance").scrollIntoView({behavior:"smooth"});
}
function ajouterSeance(){
  const duree = parseInt(document.getElementById("seance-duree").value,10);
  if(!duree || duree<1){ alert("Indique la durée de la séance."); return; }
  etat.seances.unshift({ id:uid(), type:document.getElementById("seance-type").value, duree,
    notes:document.getElementById("seance-notes").value.trim(), exos:seanceExos||[], date:AUJ });
  seanceExos = null;
  document.getElementById("seance-duree").value=""; document.getElementById("seance-notes").value="";
  sauver(); toutAfficher();
}
function supprimerSeance(id){ etat.seances = etat.seances.filter(s=>s.id!==id); sauver(); toutAfficher(); }
function changerObjectif(){
  etat.prefs.objectifSeances = parseInt(document.getElementById("objectif-seances").value,10)||3;
  sauver(); afficherSport();
}
function afficherSport(){
  document.getElementById("liste-seances").innerHTML = etat.seances.length
    ? etat.seances.slice(0,30).map(s=>`<div class="seance">
        <div class="contenu" style="flex:1">
          <div class="type">${echap(s.type)} · ${s.duree} min</div>
          <div class="details">${dateLisible(s.date)}${s.notes?"\n"+echap(s.notes):""}</div>
        </div>
        <button class="btn-suppr" onclick="supprimerSeance('${s.id}')">×</button>
      </div>`).join("")
    : '<div class="vide">Aucune séance enregistrée pour l\'instant.</div>';
  const lundi = lundiDe(AUJ);
  const seancesSem = etat.seances.filter(s=>s.date>=lundi);
  document.getElementById("stat-seances").textContent = seancesSem.length;
  document.getElementById("stat-minutes").textContent = seancesSem.reduce((a,s)=>a+s.duree,0);
  const obj = etat.prefs.objectifSeances;
  document.getElementById("objectif-seances").value = obj;
  document.getElementById("objectif-texte").textContent = seancesSem.length+" / "+obj+" séances";
  document.getElementById("jauge-objectif").style.width = Math.min(seancesSem.length/obj*100,100)+"%";
  // Minutes par semaine (8 dernières)
  const labels=[], vals=[];
  for(let i=7;i>=0;i--){
    const deb = decaler(lundi,-7*i), fin = decaler(deb,6);
    labels.push(i===0?"cette sem.":"S−"+i);
    vals.push(etat.seances.filter(s=>s.date>=deb && s.date<=fin).reduce((a,s)=>a+s.duree,0));
  }
  document.getElementById("graph-sport").innerHTML =
    '<div style="font-size:12px;color:var(--texte2);margin-top:12px">Minutes de sport par semaine</div>'+svgBarres(vals, labels, "#E85D3A");
  afficherProgression();
}
function afficherProgression(){
  const sel = document.getElementById("prog-exo-select");
  const noms = [...new Set(etat.seances.flatMap(s=>(s.exos||[]).map(e=>e.nom)))];
  const actuel = sel.value;
  sel.innerHTML = noms.length ? noms.map(n=>`<option ${n===actuel?"selected":""}>${echap(n)}</option>`).join("") : '<option value="">Aucun exercice suivi pour l\'instant</option>';
  const exo = sel.value;
  const zone = document.getElementById("graph-progression");
  if(!exo){ zone.innerHTML = '<div class="vide">Lance un de tes programmes puis enregistre la séance : la charge de chaque exercice sera suivie ici.</div>'; return; }
  const points = etat.seances.filter(s=>(s.exos||[]).some(e=>e.nom===exo))
    .map(s=>({x:dateLisible(s.date).replace(/^\S+ /,""), y:(s.exos.find(e=>e.nom===exo).charge)||0}))
    .reverse();
  zone.innerHTML = svgLigne(points, "#E85D3A") +
    '<div style="font-size:11.5px;color:var(--texte2);margin-top:4px">Charge (kg) au fil des séances — modifie la charge dans ton programme quand tu progresses.</div>';
}

// Minuteur d'intervalles
let minEtat = null, minInterval = null, ctxAudio = null;
function bip(freq, duree){
  try{
    ctxAudio = ctxAudio || new (window.AudioContext||window.webkitAudioContext)();
    const o = ctxAudio.createOscillator(), g = ctxAudio.createGain();
    o.frequency.value = freq; o.connect(g); g.connect(ctxAudio.destination);
    g.gain.setValueAtTime(0.25, ctxAudio.currentTime);
    o.start(); o.stop(ctxAudio.currentTime + (duree||0.15));
  }catch(e){}
}
function minAfficher(){
  const aff = document.getElementById("minuteur-aff");
  aff.className = "minuteur-aff " + (minEtat ? (minEtat.phase==="effort"?"effort":"repos") : "");
  document.getElementById("min-phase").textContent = minEtat ? (minEtat.phase==="effort"?"💥 Effort":"😮‍💨 Repos") : "Prêt ?";
  const s = minEtat ? minEtat.restant : parseInt(document.getElementById("min-effort").value,10)||30;
  document.getElementById("min-temps").textContent = Math.floor(s/60)+":"+String(s%60).padStart(2,"0");
  document.getElementById("min-compteur").textContent = minEtat ? "Tour "+minEtat.tour+" / "+minEtat.tours : "";
}
function minuteurStart(){
  if(minInterval){ // pause
    clearInterval(minInterval); minInterval = null;
    document.getElementById("btn-min-start").textContent = "▶ Reprendre"; return;
  }
  if(!minEtat){
    minEtat = {
      effort: parseInt(document.getElementById("min-effort").value,10)||30,
      repos: parseInt(document.getElementById("min-repos").value,10)||0,
      tours: parseInt(document.getElementById("min-tours").value,10)||1,
      tour:1, phase:"effort", restant: parseInt(document.getElementById("min-effort").value,10)||30
    };
    bip(880,0.2);
  }
  document.getElementById("btn-min-start").textContent = "⏸ Pause";
  minInterval = setInterval(()=>{
    minEtat.restant--;
    if(minEtat.restant<=3 && minEtat.restant>0) bip(660,0.1);
    if(minEtat.restant<=0){
      if(minEtat.phase==="effort" && minEtat.repos>0){
        minEtat.phase="repos"; minEtat.restant=minEtat.repos; bip(440,0.3);
      }else{
        if(minEtat.tour>=minEtat.tours){
          clearInterval(minInterval); minInterval=null;
          bip(880,0.5); setTimeout(()=>bip(1100,0.6),250);
          document.getElementById("min-phase").textContent = "🎉 Terminé !";
          minEtat = null;
          document.getElementById("btn-min-start").textContent = "▶ Démarrer";
          minAfficher(); document.getElementById("min-phase").textContent = "🎉 Terminé !";
          return;
        }
        minEtat.tour++; minEtat.phase="effort"; minEtat.restant=minEtat.effort; bip(880,0.3);
      }
    }
    minAfficher();
  }, 1000);
  minAfficher();
}
function minuteurReset(){
  clearInterval(minInterval); minInterval=null; minEtat=null;
  document.getElementById("btn-min-start").textContent = "▶ Démarrer";
  minAfficher();
}

// ---------- Suivi ----------
function ajouterHabitude(){
  const champ = document.getElementById("habitude-nom");
  const nom = champ.value.trim();
  if(!nom) return;
  etat.habitudes.push({ id:uid(), nom, jours:{} });
  champ.value=""; sauver(); toutAfficher();
}
function supprimerHabitude(id){ etat.habitudes = etat.habitudes.filter(h=>h.id!==id); sauver(); toutAfficher(); }
function basculerHabitude(id){
  const h = etat.habitudes.find(h=>h.id===id);
  if(!h) return;
  if(h.jours[AUJ]) delete h.jours[AUJ]; else h.jours[AUJ]=true;
  sauver(); toutAfficher();
}
function serieHabitude(h){
  let n=0; const d=new Date();
  if(!h.jours[cleDate(d)]) d.setDate(d.getDate()-1);
  while(h.jours[cleDate(d)]){ n++; d.setDate(d.getDate()-1); }
  return n;
}
function habitudeHTML(h){
  const fait = !!h.jours[AUJ], serie = serieHabitude(h);
  return `<div class="habitude">
    <button class="coche-hab ${fait?"fait":""}" onclick="basculerHabitude('${h.id}')">${fait?"✓":""}</button>
    <div class="nom">${echap(h.nom)}</div>
    <div class="serie">${serie>0?"🔥 "+serie+" j":""}</div>
    <button class="btn-suppr" onclick="supprimerHabitude('${h.id}')">×</button>
  </div>`;
}
function ajouterPoids(){
  const kg = parseFloat(document.getElementById("poids-kg").value);
  if(!kg) return;
  etat.poids = etat.poids.filter(p=>p.date!==AUJ);
  etat.poids.push({id:uid(), date:AUJ, kg});
  etat.poids.sort((a,b)=>a.date.localeCompare(b.date));
  document.getElementById("poids-kg").value="";
  sauver(); afficherSuivi();
}
function ajouterSommeil(){
  const h = parseFloat(document.getElementById("sommeil-h").value);
  if(!h && h!==0) return;
  etat.sommeil = etat.sommeil.filter(s=>s.date!==AUJ);
  etat.sommeil.push({id:uid(), date:AUJ, heures:h, qualite:parseInt(document.getElementById("sommeil-q").value,10)});
  etat.sommeil.sort((a,b)=>a.date.localeCompare(b.date));
  document.getElementById("sommeil-h").value="";
  sauver(); afficherSuivi();
}
function changerEau(delta){
  etat.eau[AUJ] = Math.max((etat.eau[AUJ]||0)+delta, 0);
  sauver(); afficherSuivi();
}
function ajouterRepas(){
  const desc = document.getElementById("repas-desc").value.trim();
  if(!desc) return;
  etat.repas.unshift({id:uid(), date:AUJ, type:document.getElementById("repas-type").value, desc});
  document.getElementById("repas-desc").value="";
  sauver(); afficherSuivi();
}
function supprimerRepas(id){ etat.repas = etat.repas.filter(r=>r.id!==id); sauver(); afficherSuivi(); }
function ajouterMesure(){
  const nom = document.getElementById("mesure-nom").value.trim();
  const val = parseFloat(document.getElementById("mesure-val").value);
  if(!nom || !val) return;
  etat.mesures.push({id:uid(), date:AUJ, nom, valeur:val});
  document.getElementById("mesure-val").value="";
  sauver(); afficherSuivi(); afficherMesures();
}
function afficherMesures(){
  const sel = document.getElementById("mesure-select");
  const noms = [...new Set(etat.mesures.map(m=>m.nom))];
  const actuel = sel.value;
  sel.innerHTML = noms.length ? noms.map(n=>`<option ${n===actuel?"selected":""}>${echap(n)}</option>`).join("") : '<option value="">Aucune mesure enregistrée</option>';
  const nom = sel.value;
  document.getElementById("graph-mesures").innerHTML = nom
    ? svgLigne(etat.mesures.filter(m=>m.nom===nom).map(m=>({x:dateLisible(m.date).replace(/^\S+ /,""), y:m.valeur})), "#12A5B8")
    : "";
}
function afficherSuivi(){
  document.getElementById("liste-habitudes").innerHTML = etat.habitudes.length
    ? etat.habitudes.map(habitudeHTML).join("") : '<div class="vide">Ajoute une première habitude ci-dessous.</div>';
  // Graph habitudes : % coché sur les 7 derniers jours
  if(etat.habitudes.length){
    const labels=[], vals=[];
    for(let i=6;i>=0;i--){
      const iso = decaler(AUJ,-i);
      labels.push(dateLisible(iso).slice(0,2));
      const n = etat.habitudes.filter(h=>h.jours[iso]).length;
      vals.push(Math.round(n/etat.habitudes.length*100));
    }
    document.getElementById("graph-habitudes").innerHTML =
      '<div style="font-size:12px;color:var(--texte2);margin-top:10px">% d\'habitudes tenues (7 jours)</div>'+svgBarres(vals, labels, "#12A5B8");
  }else document.getElementById("graph-habitudes").innerHTML="";
  document.getElementById("graph-poids").innerHTML =
    svgLigne(etat.poids.slice(-30).map(p=>({x:dateLisible(p.date).replace(/^\S+ /,""), y:p.kg})), "#12A5B8");
  const s14 = etat.sommeil.slice(-14);
  document.getElementById("graph-sommeil").innerHTML = s14.length
    ? svgBarres(s14.map(s=>s.heures), s14.map(s=>dateLisible(s.date).slice(0,2)), "#12A5B8")
      + '<div style="font-size:11.5px;color:var(--texte2)">Heures de sommeil (14 dernières nuits)</div>'
    : '<div class="vide">Enregistre ta première nuit ci-dessus.</div>';
  const eau = etat.eau[AUJ]||0;
  document.getElementById("eau-n").textContent = eau+" verre"+(eau>1?"s":"");
  const repasJour = etat.repas.filter(r=>r.date===AUJ);
  document.getElementById("liste-repas").innerHTML = repasJour.length
    ? repasJour.map(r=>`<div class="habitude"><div class="nom"><b>${r.type}</b> — ${echap(r.desc)}</div><button class="btn-suppr" onclick="supprimerRepas('${r.id}')">×</button></div>`).join("")
    : "";
  afficherMesures();
}

// ---------- Notifications ----------
function majEtatNotif(){
  const zone = document.getElementById("etat-notif"), btn = document.getElementById("btn-notif");
  if(!("Notification" in window)){ zone.textContent="Les notifications ne sont pas disponibles dans ce navigateur."; zone.className="etat-notif ko"; btn.style.display="none"; return; }
  if(Notification.permission==="granted" && etat.prefs.notif){ zone.textContent="✓ Rappels activés"; zone.className="etat-notif ok"; btn.textContent="Désactiver les rappels"; }
  else if(Notification.permission==="denied"){ zone.textContent="Notifications refusées : autorise-les dans les réglages du navigateur."; zone.className="etat-notif ko"; btn.style.display="none"; }
  else{ zone.textContent=""; btn.textContent="Activer les rappels"; }
}
async function activerNotifications(){
  if(etat.prefs.notif && Notification.permission==="granted"){ etat.prefs.notif=false; sauver(); majEtatNotif(); return; }
  const perm = await Notification.requestPermission();
  if(perm==="granted"){ etat.prefs.notif=true; sauver(); new Notification("Mon Quotidien",{body:"Les rappels sont activés 🎉"}); }
  majEtatNotif();
}
function verifierRappels(){
  if(!("Notification" in window) || Notification.permission!=="granted" || !etat.prefs.notif) return;
  const maintenant = new Date(); let modif = false;
  etat.evenements.forEach(e=>{
    if(e.rappel==null || e.rappel<0) return;
    const dateOcc = e.recur ? (occursOn(e,AUJ)?AUJ:null) : e.date;
    if(!dateOcc || etat.notifie[e.id+dateOcc]) return;
    const [a,m,j]=dateOcc.split("-").map(Number);
    const [h,mn]=(e.heure||"08:00").split(":").map(Number);
    const debut = new Date(a,m-1,j,h,mn);
    const decl = new Date(debut.getTime()-e.rappel*60000);
    if(maintenant>=decl && maintenant<=debut){
      new Notification("📅 "+e.titre, {body:(e.rappel===0?"C'est maintenant":LIB_RAPPEL[e.rappel]||"") + (e.heure?" · "+e.heure:"") + (e.lieu?" · "+e.lieu:"")});
      etat.notifie[e.id+dateOcc]=true; modif=true;
    }
  });
  if(modif) sauver();
}
setInterval(verifierRappels, 30000);

// ---------- Sauvegarde ----------
function majBandeauExport(){
  if(!etat.prefs.dernierExport){ etat.prefs.dernierExport = AUJ; sauver(); return; }
  const jours = Math.round((new Date(AUJ)-new Date(etat.prefs.dernierExport))/864e5);
  const contenu = etat.taches.length + etat.notes.length + etat.evenements.length + etat.seances.length;
  document.getElementById("bandeau-export").style.display = (jours>=14 && contenu>5) ? "block" : "none";
}
function exporterDonnees(){
  telecharger(new Blob([JSON.stringify(etat,null,2)],{type:"application/json"}), "mon-quotidien-sauvegarde-"+AUJ+".json");
  etat.prefs.dernierExport = AUJ; sauver(); majBandeauExport();
}
function importerDonnees(ev){
  const f = ev.target.files[0]; if(!f) return;
  const lecteur = new FileReader();
  lecteur.onload = ()=>{
    try{
      const donnees = JSON.parse(lecteur.result);
      etat = Object.assign(etatVide(), donnees);
      etat.prefs = Object.assign(etatVide().prefs, etat.prefs||{});
      sauver(); appliquerTheme(); majSelectProjets(); toutAfficher(); fermer("dlg-donnees");
    }catch(e){ alert("Fichier invalide : impossible de lire cette sauvegarde."); }
  };
  lecteur.readAsText(f); ev.target.value="";
}

// ---------- Rendu global & démarrage ----------
function toutAfficher(){
  afficherAujourdhui(); majStatsSemaine(); afficherTaches();
  afficherCalendrier(); afficherEvenementsJour(); afficherAVenir();
  afficherNotes(); afficherSport(); afficherProgrammes(); afficherSuivi();
}
document.getElementById("date-tete").textContent = new Date().toLocaleDateString("fr-FR",{weekday:"long",day:"numeric",month:"long"});
document.getElementById("evt-date").value = AUJ;
if(memoireSeule) document.getElementById("bandeau-memoire").style.display="block";
document.getElementById("capture-rapide").addEventListener("keydown",e=>{ if(e.key==="Enter") captureRapide(); });
document.getElementById("tache-libelle").addEventListener("keydown",e=>{ if(e.key==="Enter") ajouterTache(); });
document.getElementById("habitude-nom").addEventListener("keydown",e=>{ if(e.key==="Enter") ajouterHabitude(); });
if(etat.prefs.pin){ document.getElementById("verrou").classList.add("actif"); document.getElementById("verrou-code").focus(); }
appliquerTheme(); majSelectProjets(); majBandeauExport(); ajouterLigneExo();
toutAfficher(); minAfficher(); verifierRappels();

// ---------- Service worker (hors connexion) ----------
if("serviceWorker" in navigator && (location.protocol==="https:" || location.hostname==="localhost")){
  navigator.serviceWorker.register("./sw.js").catch(()=>{});
}

/* =============================================================
   Mon Quotidien v5 — couche d'amélioration progressive
   Conserve les données et fonctions de la v4, puis ajoute :
   IndexedDB, capture universelle, planification, édition, corbeille,
   routines, focus, rappels enrichis, ICS Apple et mise à jour PWA.
============================================================= */
(() => {
  const VERSION_APP = "5.0.0";
  const DB_NAME = "mon-quotidien-db";
  const DB_VERSION = 1;
  const DB_STORE = "state";
  const TZ = Intl.DateTimeFormat().resolvedOptions().timeZone || "Europe/Paris";

  /* ---------- État v5 et migration douce ---------- */
  function ensureV5State(source) {
    const e = source || etat;
    e.meta = Object.assign({ version: VERSION_APP, updatedAt: null }, e.meta || {});
    e.corbeille = Array.isArray(e.corbeille) ? e.corbeille : [];
    e.routines = Array.isArray(e.routines) ? e.routines : [];
    e.focusSessions = Array.isArray(e.focusSessions) ? e.focusSessions : [];
    e.prefs = Object.assign({
      defaultEventReminder: 30,
      defaultTaskReminderHour: "09:00",
      morningSummary: "07:30",
      eveningSummary: "21:30",
      autoRollOverdue: false,
      top3: {},
      lastActiveDate: AUJ,
      installDismissed: false
    }, e.prefs || {});
    e.habitudes.forEach(h => {
      h.joursSemaine = Array.isArray(h.joursSemaine) ? h.joursSemaine : [0,1,2,3,4,5,6];
      h.objectifHebdo = Number.isFinite(h.objectifHebdo) ? h.objectifHebdo : h.joursSemaine.length;
    });
    e.routines.forEach(r => {
      r.joursSemaine = Array.isArray(r.joursSemaine) ? r.joursSemaine : [1,2,3,4,5];
      r.etapes = Array.isArray(r.etapes) ? r.etapes : [];
      r.fait = r.fait || {};
    });
    e.corbeille = e.corbeille.filter(x => {
      const age = Date.now() - new Date(x.deletedAt || 0).getTime();
      return age < 30 * 864e5;
    });
    return e;
  }
  ensureV5State(etat);

  /* ---------- IndexedDB, avec localStorage conservé en miroir ---------- */
  let dbPromise = null;
  function ouvrirDB() {
    if (!('indexedDB' in window)) return Promise.resolve(null);
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(DB_STORE)) db.createObjectStore(DB_STORE);
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    }).catch(() => null);
    return dbPromise;
  }
  async function lireIDB() {
    const db = await ouvrirDB();
    if (!db) return null;
    return new Promise(resolve => {
      const tx = db.transaction(DB_STORE, 'readonly');
      const req = tx.objectStore(DB_STORE).get('main');
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => resolve(null);
    });
  }
  async function ecrireIDB(valeur) {
    const db = await ouvrirDB();
    if (!db) return false;
    return new Promise(resolve => {
      const tx = db.transaction(DB_STORE, 'readwrite');
      tx.objectStore(DB_STORE).put(typeof structuredClone === 'function' ? structuredClone(valeur) : JSON.parse(JSON.stringify(valeur)), 'main');
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => resolve(false);
    });
  }

  const sauverV4 = sauver;
  sauver = function sauverV5() {
    ensureV5State(etat);
    etat.meta.version = VERSION_APP;
    etat.meta.updatedAt = new Date().toISOString();
    sauverV4();
    ecrireIDB(etat).then(updateStorageStatus);
  };

  async function initialiserIDB() {
    const distantLocal = await lireIDB();
    const idbDate = distantLocal?.meta?.updatedAt || '';
    const memDate = etat?.meta?.updatedAt || '';
    if (distantLocal && idbDate > memDate) {
      etat = ensureV5State(Object.assign(etatVide(), distantLocal));
      etat.prefs = Object.assign(etatVide().prefs, distantLocal.prefs || {}, etat.prefs || {});
      sauverV4();
      appliquerTheme();
      majSelectProjets();
      toutAfficher();
      toast('Données locales restaurées depuis IndexedDB.');
    } else {
      await ecrireIDB(etat);
    }
    updateStorageStatus();
  }

  /* ---------- Infrastructure d'interface ---------- */
  function injecterInterface() {
    document.body.insertAdjacentHTML('beforeend', `
      <button class="capture-fab" id="capture-fab" aria-label="Capture rapide">＋</button>
      <div class="v5-toast" id="v5-toast"><span id="v5-toast-text"></span><button id="v5-toast-action"></button></div>
      <div class="v5-update" id="v5-update"><div class="txt"><b>Nouvelle version disponible</b><br>Recharge l'application pour appliquer la mise à jour.</div><button class="btn petit" id="v5-update-btn">Mettre à jour</button><button class="btn-suppr" id="v5-update-close">×</button></div>
      <div class="v5-install" id="v5-install"><div class="txt"><b>Installer Mon Quotidien</b><br>Accès rapide, plein écran et fonctionnement hors connexion.</div><button class="btn petit" id="v5-install-btn">Installer</button><button class="btn-suppr" id="v5-install-close">×</button></div>

      <div class="v5-overlay" id="v5-capture"><div class="v5-sheet"><div class="v5-handle"></div><h2>Capture rapide</h2><div class="v5-mode-grid" id="v5-capture-modes"></div><div id="v5-capture-form"></div></div></div>
      <div class="v5-overlay" id="v5-editor"><div class="v5-sheet"><div class="v5-handle"></div><div id="v5-editor-content"></div></div></div>
      <div class="v5-overlay" id="v5-plan"><div class="v5-sheet"><div class="v5-handle"></div><div id="v5-plan-content"></div></div></div>
      <div class="v5-overlay" id="v5-focus"><div class="v5-sheet"><div class="v5-handle"></div><div id="v5-focus-content"></div></div></div>
      <div class="v5-overlay" id="v5-plus"><div class="v5-sheet"><div class="v5-handle"></div><h2>Plus</h2><div class="v5-mode-grid">
        <button class="v5-mode" onclick="v5OuvrirEcran('sport')"><span>🏋️</span>Sport</button>
        <button class="v5-mode" onclick="v5OuvrirEcran('suivi')"><span>📊</span>Suivi</button>
        <button class="v5-mode" onclick="v5OuvrirReglages()"><span>⚙️</span>Réglages</button>
      </div><p class="v5-help">Les fonctions fréquentes restent dans la barre du bas. Sport, suivi détaillé et réglages sont regroupés ici pour laisser plus d'espace aux zones tactiles.</p></div></div>
    `);

    document.querySelectorAll('.v5-overlay').forEach(el => el.addEventListener('click', ev => {
      if (ev.target === el) fermerV5(el.id);
    }));

    const titreAuj = document.querySelector('#ecran-auj .titre-section');
    if (titreAuj) titreAuj.insertAdjacentHTML('afterend', `
      <div class="v5-dashboard" id="v5-dashboard">
        <div class="carte" style="margin-bottom:0"><h3>Prochaine étape <button class="btn-mini" onclick="ouvrirPlanJour()">Planifier ma journée</button></h3><div id="v5-prochain"></div></div>
        <div class="carte" style="margin-bottom:0"><h3>Mes 3 priorités <span class="normal" id="v5-charge"></span></h3><div class="v5-top3" id="v5-top3"></div></div>
      </div>
    `);

    const titreSuivi = document.querySelector('#ecran-suivi .titre-section');
    if (titreSuivi) titreSuivi.insertAdjacentHTML('afterend', `
      <div class="carte" id="v5-routines-card"><h3>Routines <button class="btn-mini" onclick="ouvrirEditionRoutine()">＋ Nouvelle</button></h3><div id="v5-routines"></div></div>
    `);

    injecterReglages();
    remplacerNavigation();
  }

  function remplacerNavigation() {
    const nav = document.querySelector('nav .nav-int');
    if (!nav) return;
    nav.innerHTML = `
      <button data-ecran="auj" class="actif"><span class="station">A</span>Aujourd'hui</button>
      <button data-ecran="taches"><span class="station">T</span>Tâches</button>
      <button data-ecran="agenda"><span class="station">C</span>Agenda</button>
      <button data-ecran="notes"><span class="station">N</span>Notes</button>
      <button data-ecran="plus"><span class="station">•••</span>Plus</button>`;
    nav.querySelectorAll('button').forEach(btn => btn.addEventListener('click', () => {
      if (btn.dataset.ecran === 'plus') ouvrirV5('v5-plus');
      else montrerEcran(btn.dataset.ecran);
    }));
  }

  function injecterReglages() {
    const dialogue = document.querySelector('#dlg-donnees .dialogue');
    if (!dialogue) return;
    const derniereAction = dialogue.querySelector('.actions:last-child');
    const bloc = document.createElement('div');
    bloc.className = 'v5-settings-block';
    bloc.innerHTML = `
      <h4>Planification quotidienne</h4>
      <div class="deux-cols">
        <div class="champ"><label>Rappel événement par défaut</label><select id="v5-default-event">
          <option value="-1">Aucun</option><option value="0">À l'heure</option><option value="10">10 min avant</option><option value="30">30 min avant</option><option value="60">1 h avant</option><option value="1440">1 jour avant</option>
        </select></div>
        <div class="champ"><label>Heure des tâches du jour</label><input type="time" id="v5-task-time"></div>
      </div>
      <div class="deux-cols">
        <div class="champ"><label>Résumé du matin</label><input type="time" id="v5-morning"></div>
        <div class="champ"><label>Bilan du soir</label><input type="time" id="v5-evening"></div>
      </div>
      <label class="v5-check"><input type="checkbox" id="v5-auto-roll"> Reporter à aujourd'hui les tâches échues non terminées au changement de jour</label>
      <button class="btn petit" style="margin-top:10px" onclick="sauverReglagesV5()">Enregistrer ces réglages</button>
      <p class="v5-help">Sur iPhone, les notifications réellement garanties lorsque l'app est fermée nécessitent Web Push et un petit serveur. Cette version effectue aussi un rattrapage dès la réouverture.</p>

      <h4>Stockage et installation</h4>
      <div class="v5-status"><span class="v5-dot" id="v5-storage-dot"></span><span id="v5-storage-status">Vérification du stockage…</span></div>
      <button class="btn secondaire petit" onclick="installerOuExpliquer()">Installer sur ce téléphone</button>

      <h4>Corbeille — conservation 30 jours</h4>
      <div id="v5-trash"></div>
      <div class="actions" style="margin-top:8px"><button class="btn secondaire petit" onclick="restaurerTouteCorbeille()">Tout restaurer</button><button class="btn secondaire petit" onclick="viderCorbeille()">Vider</button></div>
    `;
    dialogue.insertBefore(bloc, derniereAction || null);
  }

  function ouvrirV5(id) { document.getElementById(id)?.classList.add('ouvert'); }
  function fermerV5(id) { document.getElementById(id)?.classList.remove('ouvert'); }
  window.ouvrirV5 = ouvrirV5;
  window.fermerV5 = fermerV5;

  let toastTimer = null;
  let toastCallback = null;
  function toast(message, actionLabel = '', callback = null) {
    const box = document.getElementById('v5-toast');
    if (!box) return;
    clearTimeout(toastTimer);
    toastCallback = callback;
    document.getElementById('v5-toast-text').textContent = message;
    const btn = document.getElementById('v5-toast-action');
    btn.textContent = actionLabel;
    btn.style.display = actionLabel ? 'block' : 'none';
    box.classList.add('visible');
    toastTimer = setTimeout(() => box.classList.remove('visible'), actionLabel ? 6500 : 3200);
  }
  window.v5ToastAction = function() {
    if (toastCallback) toastCallback();
    document.getElementById('v5-toast')?.classList.remove('visible');
    toastCallback = null;
  };

  injecterInterface();

  /* ---------- Navigation enveloppée ---------- */
  const montrerEcranV4 = montrerEcran;
  montrerEcran = function montrerEcranV5(nom) {
    montrerEcranV4(nom);
    document.querySelectorAll('nav button').forEach(b => {
      const cible = b.dataset.ecran;
      b.classList.toggle('actif', cible === nom || (cible === 'plus' && ['sport','suivi'].includes(nom)));
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  window.v5OuvrirEcran = function(nom) { fermerV5('v5-plus'); montrerEcran(nom); };
  window.v5OuvrirReglages = function() { fermerV5('v5-plus'); ouvrir('dlg-donnees'); remplirReglagesV5(); majEtatNotif(); majEtatPin(); };

  /* ---------- Capture universelle ---------- */
  const CAPTURE_MODES = [
    ['tache','✅','Tâche'], ['evenement','📅','Événement'], ['note','🧠','Note'],
    ['sport','🏋️','Séance'], ['mesure','📈','Mesure'], ['routine','🔁','Routine']
  ];
  let captureMode = 'tache';
  function ouvrirCapture(mode = 'tache') {
    captureMode = mode;
    document.getElementById('v5-capture-modes').innerHTML = CAPTURE_MODES.map(([id,ico,nom]) => `<button class="v5-mode ${id===captureMode?'actif':''}" onclick="changerModeCapture('${id}')"><span>${ico}</span>${nom}</button>`).join('');
    rendreFormCapture();
    ouvrirV5('v5-capture');
  }
  window.changerModeCapture = function(mode) { captureMode = mode; ouvrirCapture(mode); };
  function rendreFormCapture() {
    const zone = document.getElementById('v5-capture-form');
    const date = AUJ;
    if (captureMode === 'tache') zone.innerHTML = `
      <div class="champ"><label>Tâche</label><input id="cap-title" type="text" placeholder="Que faut-il faire ?" autofocus></div>
      <div class="v5-grid"><div class="champ"><label>Échéance</label><input id="cap-date" type="date" value="${date}"></div><div class="champ"><label>Durée estimée</label><input id="cap-duration" type="number" min="0" placeholder="25 min"></div></div>
      <div class="v5-checks"><label class="v5-check"><input id="cap-urgent" type="checkbox"> Urgent</label><label class="v5-check"><input id="cap-important" type="checkbox"> Important</label></div>
      <div class="v5-actions"><button class="btn secondaire" onclick="fermerV5('v5-capture')">Annuler</button><button class="btn" onclick="validerCapture()">Ajouter</button></div>`;
    if (captureMode === 'evenement') zone.innerHTML = `
      <div class="champ"><label>Événement</label><input id="cap-title" type="text" placeholder="Titre"></div>
      <div class="v5-grid"><div class="champ"><label>Date</label><input id="cap-date" type="date" value="${date}"></div><div class="champ"><label>Heure</label><input id="cap-time" type="time"></div></div>
      <div class="v5-grid"><div class="champ"><label>Durée</label><input id="cap-duration" type="number" min="0" value="60"></div><div class="champ"><label>Lieu</label><input id="cap-location" type="text"></div></div>
      <div class="v5-actions"><button class="btn secondaire" onclick="fermerV5('v5-capture')">Annuler</button><button class="btn" onclick="validerCapture()">Ajouter</button></div>`;
    if (captureMode === 'note') zone.innerHTML = `
      <div class="champ"><label>Titre</label><input id="cap-title" type="text" placeholder="Une idée, une référence…"></div>
      <div class="champ"><label>Contenu</label><textarea id="cap-body" placeholder="Écris sans classer : la note arrive dans ta boîte de réception."></textarea></div>
      <div class="v5-actions"><button class="btn secondaire" onclick="fermerV5('v5-capture')">Annuler</button><button class="btn" onclick="validerCapture()">Capturer</button></div>`;
    if (captureMode === 'sport') zone.innerHTML = `
      <div class="v5-grid"><div class="champ"><label>Type</label><select id="cap-sport-type"><option>Musculation</option><option>Course</option><option>Vélo</option><option>Natation</option><option>Yoga</option><option>Marche</option><option>HIIT</option><option>Autre</option></select></div><div class="champ"><label>Durée</label><input id="cap-duration" type="number" min="1" value="45"></div></div>
      <div class="champ"><label>Détails</label><textarea id="cap-body" style="min-height:70px"></textarea></div>
      <div class="v5-actions"><button class="btn secondaire" onclick="fermerV5('v5-capture')">Annuler</button><button class="btn" onclick="validerCapture()">Enregistrer</button></div>`;
    if (captureMode === 'mesure') zone.innerHTML = `
      <div class="v5-grid"><div class="champ"><label>Mesure</label><input id="cap-title" type="text" list="mesures-connues" placeholder="Tour de taille"></div><div class="champ"><label>Valeur</label><input id="cap-value" type="number" step="0.1" placeholder="cm ou kg"></div></div>
      <div class="v5-actions"><button class="btn secondaire" onclick="fermerV5('v5-capture')">Annuler</button><button class="btn" onclick="validerCapture()">Enregistrer</button></div>`;
    if (captureMode === 'routine') zone.innerHTML = formulaireRoutine(null,'capture');
    setTimeout(() => zone.querySelector('input,textarea')?.focus(), 120);
  }
  window.validerCapture = function() {
    const title = document.getElementById('cap-title')?.value.trim() || '';
    if (captureMode === 'tache') {
      if (!title) return;
      etat.taches.unshift({ id:uid(), libelle:title, echeance:document.getElementById('cap-date').value || null, repete:'', fait:false, projet:etat.projets[0] || 'Perso', duree:parseInt(document.getElementById('cap-duration').value,10)||0, urgent:document.getElementById('cap-urgent').checked, important:document.getElementById('cap-important').checked, sous:[], ordre:Date.now() });
    } else if (captureMode === 'evenement') {
      if (!title) return;
      etat.evenements.push({ id:uid(), titre:title, date:document.getElementById('cap-date').value || AUJ, heure:document.getElementById('cap-time').value || '', lieu:document.getElementById('cap-location').value.trim(), duree:parseInt(document.getElementById('cap-duration').value,10)||0, cat:'perso', recur:'', rappel:etat.prefs.defaultEventReminder, star:false });
    } else if (captureMode === 'note') {
      const body = document.getElementById('cap-body').value.trim();
      if (!title && !body) return;
      etat.notes.unshift({ id:uid(), titre:title || body.slice(0,60), corps:body, tags:['boîte de réception'], date:AUJ });
    } else if (captureMode === 'sport') {
      const duree = parseInt(document.getElementById('cap-duration').value,10)||0;
      if (!duree) return;
      etat.seances.unshift({ id:uid(), type:document.getElementById('cap-sport-type').value, duree, notes:document.getElementById('cap-body').value.trim(), exos:[], date:AUJ });
    } else if (captureMode === 'mesure') {
      const valeur = parseFloat(document.getElementById('cap-value').value);
      if (!title || !Number.isFinite(valeur)) return;
      etat.mesures.push({ id:uid(), date:AUJ, nom:title, valeur });
    } else if (captureMode === 'routine') {
      sauverRoutineDepuisForm();
      return;
    }
    sauver(); fermerV5('v5-capture'); toutAfficher(); toast('Ajout enregistré.');
  };
  document.getElementById('capture-fab').addEventListener('click', () => ouvrirCapture('tache'));

  /* ---------- Tableau Aujourd'hui et planification ---------- */
  function tachesPrioritaires() {
    const manuelles = etat.prefs.top3?.[AUJ] || [];
    const actives = etat.taches.filter(t => !t.fait);
    const choisies = manuelles.map(id => actives.find(t => t.id === id)).filter(Boolean);
    if (choisies.length) return choisies.slice(0,3);
    return [...actives].sort((a,b) => {
      const score = t => (t.urgent?8:0)+(t.important?5:0)+(t.echeance&&t.echeance<=AUJ?4:0)+(t.echeance===AUJ?2:0);
      return score(b)-score(a) || (a.echeance||'9999').localeCompare(b.echeance||'9999');
    }).slice(0,3);
  }
  function prochainEvenement() {
    const maintenant = new Date();
    const heure = maintenant.getHours()*60 + maintenant.getMinutes();
    const auj = evenementsDuJour(AUJ).filter(e => {
      if (!e.heure) return true;
      const [h,m] = e.heure.split(':').map(Number);
      return h*60+m >= heure;
    });
    if (auj.length) return { evt: auj[0], date: AUJ };
    for (let i=1;i<=7;i++) {
      const iso=decaler(AUJ,i), evts=evenementsDuJour(iso);
      if (evts.length) return {evt:evts[0],date:iso};
    }
    return null;
  }
  function capaciteJour() {
    const fenetre = 13*60;
    const occupe = evenementsDuJour(AUJ).reduce((n,e) => n + (e.duree || 60), 0);
    return Math.max(0, fenetre - occupe);
  }
  function renderDashboard() {
    const nextZone = document.getElementById('v5-prochain');
    if (!nextZone) return;
    const next = prochainEvenement();
    if (next) {
      const labelDate = next.date===AUJ ? 'Aujourd’hui' : dateLisible(next.date);
      nextZone.innerHTML = `<div class="v5-next"><div class="v5-next-time">${next.evt.heure||'Journée'}</div><div class="v5-next-main"><div class="v5-next-title">${echap(next.evt.titre)}</div><div class="v5-next-meta">${labelDate}${next.evt.lieu?' · '+echap(next.evt.lieu):''}</div></div><button class="btn-mini" onclick="montrerEcran('agenda');choisirJour('${next.date}')">Voir</button></div>`;
    } else nextZone.innerHTML = '<div class="vide">Aucun événement dans les 7 prochains jours.</div>';
    const top = tachesPrioritaires();
    document.getElementById('v5-top3').innerHTML = top.length ? top.map((t,i)=>`<div class="v5-priority"><span class="v5-rank">${i+1}</span><button class="coche ${t.fait?'fait':''}" onclick="basculerTache('${t.id}')">${t.fait?'✓':''}</button><span class="label">${echap(t.libelle)}</span>${t.duree?`<span class="v5-help">${t.duree} min</span>`:''}<button class="btn-mini v5-focus-btn" onclick="lancerFocus('${t.id}')">▶</button></div>`).join('') : '<div class="vide">Choisis trois priorités ou profite d’une journée légère.</div>';
    const charge = top.reduce((n,t)=>n+(t.duree||0),0), cap=capaciteJour();
    const chargeZone=document.getElementById('v5-charge');
    chargeZone.textContent = charge ? `${charge} min / ${cap} min libres` : `${cap} min libres`;
    chargeZone.classList.toggle('v5-warning', charge>cap);
  }
  window.ouvrirPlanJour = function() {
    const actives = etat.taches.filter(t=>!t.fait).sort((a,b)=>(a.echeance||'9999').localeCompare(b.echeance||'9999'));
    const selection = new Set(etat.prefs.top3?.[AUJ] || tachesPrioritaires().map(t=>t.id));
    const chargeAgenda = evenementsDuJour(AUJ).reduce((n,e)=>n+(e.duree||60),0);
    document.getElementById('v5-plan-content').innerHTML = `<h2>Planifier ma journée</h2><div class="v5-capacity"><b>Capacité indicative :</b> ${capaciteJour()} min disponibles après ${chargeAgenda} min d'agenda.<br><span class="v5-help">Sélectionne jusqu'à trois tâches. Les durées estimées servent à détecter une journée trop chargée.</span></div><h3>Mes trois priorités</h3><div id="v5-plan-list">${actives.length?actives.map(t=>`<label class="v5-task-choice"><input type="checkbox" value="${t.id}" ${selection.has(t.id)?'checked':''} onchange="limiterTop3(this)"><span class="main"><span class="title">${echap(t.libelle)}</span><span class="meta">${t.echeance?dateLisible(t.echeance):'Sans échéance'}${t.duree?' · '+t.duree+' min':''}</span></span></label>`).join(''):'<div class="vide">Aucune tâche active.</div>'}</div><div class="v5-actions"><button class="btn secondaire" onclick="fermerV5('v5-plan')">Annuler</button><button class="btn" onclick="sauverPlanJour()">Enregistrer</button></div>`;
    ouvrirV5('v5-plan');
  };
  window.limiterTop3 = function(input) {
    const checked = [...document.querySelectorAll('#v5-plan-list input:checked')];
    if (checked.length>3) { input.checked=false; toast('Maximum : trois priorités.'); }
  };
  window.sauverPlanJour = function() {
    etat.prefs.top3[AUJ] = [...document.querySelectorAll('#v5-plan-list input:checked')].map(i=>i.value).slice(0,3);
    sauver(); fermerV5('v5-plan'); toutAfficher();
  };

  /* ---------- Édition des éléments ---------- */
  function champChecked(v){ return v ? 'checked' : ''; }
  window.ouvrirEditionTache = function(id) {
    const t=etat.taches.find(x=>x.id===id); if(!t)return;
    ouvrirEditeur(`<h2>Modifier la tâche</h2><div class="champ"><label>Libellé</label><input id="ed-title" value="${echap(t.libelle)}"></div><div class="v5-grid"><div class="champ"><label>Échéance</label><input id="ed-date" type="date" value="${t.echeance||''}"></div><div class="champ"><label>Durée</label><input id="ed-duration" type="number" value="${t.duree||''}"></div></div><div class="v5-grid"><div class="champ"><label>Liste</label><select id="ed-project">${etat.projets.map(p=>`<option ${p===(t.projet||'Perso')?'selected':''}>${echap(p)}</option>`).join('')}</select></div><div class="champ"><label>Répétition</label><select id="ed-repeat"><option value="">Jamais</option><option value="quotidien" ${t.repete==='quotidien'?'selected':''}>Chaque jour</option><option value="hebdo" ${t.repete==='hebdo'?'selected':''}>Chaque semaine</option><option value="mensuel" ${t.repete==='mensuel'?'selected':''}>Chaque mois</option></select></div></div><div class="v5-checks"><label class="v5-check"><input id="ed-urgent" type="checkbox" ${champChecked(t.urgent)}> Urgent</label><label class="v5-check"><input id="ed-important" type="checkbox" ${champChecked(t.important)}> Important</label></div><div class="v5-actions"><button class="btn secondaire" onclick="fermerV5('v5-editor')">Annuler</button><button class="btn" onclick="sauverEditionTache('${id}')">Enregistrer</button></div>`);
  };
  window.sauverEditionTache = function(id){ const t=etat.taches.find(x=>x.id===id); if(!t)return; t.libelle=document.getElementById('ed-title').value.trim()||t.libelle;t.echeance=document.getElementById('ed-date').value||null;t.duree=parseInt(document.getElementById('ed-duration').value,10)||0;t.projet=document.getElementById('ed-project').value;t.repete=document.getElementById('ed-repeat').value;t.urgent=document.getElementById('ed-urgent').checked;t.important=document.getElementById('ed-important').checked;sauver();fermerV5('v5-editor');toutAfficher();};
  window.ouvrirEditionEvenement = function(id){const e=etat.evenements.find(x=>x.id===id);if(!e)return;ouvrirEditeur(`<h2>Modifier l'événement</h2><div class="champ"><label>Titre</label><input id="ed-title" value="${echap(e.titre)}"></div><div class="v5-grid"><div class="champ"><label>Date</label><input id="ed-date" type="date" value="${e.date}"></div><div class="champ"><label>Heure</label><input id="ed-time" type="time" value="${e.heure||''}"></div></div><div class="v5-grid"><div class="champ"><label>Durée</label><input id="ed-duration" type="number" value="${e.duree||''}"></div><div class="champ"><label>Lieu</label><input id="ed-location" value="${echap(e.lieu||'')}"></div></div><div class="v5-grid"><div class="champ"><label>Catégorie</label><select id="ed-cat">${Object.entries(CAT).map(([k,v])=>`<option value="${k}" ${e.cat===k?'selected':''}>${v.n}</option>`).join('')}</select></div><div class="champ"><label>Rappel</label><select id="ed-reminder">${[[-1,'Aucun'],[0,"À l'heure"],[10,'10 min avant'],[30,'30 min avant'],[60,'1 h avant'],[1440,'1 jour avant']].map(([v,l])=>`<option value="${v}" ${e.rappel==v?'selected':''}>${l}</option>`).join('')}</select></div></div><div class="v5-grid"><div class="champ"><label>Répétition</label><select id="ed-repeat"><option value="">Jamais</option><option value="quotidien" ${e.recur==='quotidien'?'selected':''}>Chaque jour</option><option value="hebdo" ${e.recur==='hebdo'?'selected':''}>Chaque semaine</option><option value="mensuel" ${e.recur==='mensuel'?'selected':''}>Chaque mois</option></select></div><label class="v5-check" style="align-self:end;margin-bottom:10px"><input id="ed-star" type="checkbox" ${champChecked(e.star)}> Compte à rebours</label></div><div class="v5-actions"><button class="btn secondaire" onclick="fermerV5('v5-editor')">Annuler</button><button class="btn" onclick="sauverEditionEvenement('${id}')">Enregistrer</button></div>`);};
  window.sauverEditionEvenement=function(id){const e=etat.evenements.find(x=>x.id===id);if(!e)return;e.titre=document.getElementById('ed-title').value.trim()||e.titre;e.date=document.getElementById('ed-date').value||e.date;e.heure=document.getElementById('ed-time').value;e.duree=parseInt(document.getElementById('ed-duration').value,10)||0;e.lieu=document.getElementById('ed-location').value.trim();e.cat=document.getElementById('ed-cat').value;e.rappel=parseInt(document.getElementById('ed-reminder').value,10);e.recur=document.getElementById('ed-repeat').value;e.star=document.getElementById('ed-star').checked;sauver();fermerV5('v5-editor');toutAfficher();};
  window.ouvrirEditionNote=function(id){const n=etat.notes.find(x=>x.id===id);if(!n)return;ouvrirEditeur(`<h2>Modifier la note</h2><div class="champ"><label>Titre</label><input id="ed-title" value="${echap(n.titre)}"></div><div class="champ"><label>Contenu</label><textarea id="ed-body" style="min-height:220px">${echap(n.corps||'')}</textarea></div><div class="champ"><label>Tags</label><input id="ed-tags" value="${echap((n.tags||[]).join(', '))}"></div><div class="v5-actions"><button class="btn secondaire" onclick="fermerV5('v5-editor')">Annuler</button><button class="btn" onclick="sauverEditionNote('${id}')">Enregistrer</button></div>`);};
  window.sauverEditionNote=function(id){const n=etat.notes.find(x=>x.id===id);if(!n)return;n.titre=document.getElementById('ed-title').value.trim()||n.titre;n.corps=document.getElementById('ed-body').value;n.tags=document.getElementById('ed-tags').value.split(',').map(x=>x.trim()).filter(Boolean);n.updatedAt=new Date().toISOString();sauver();fermerV5('v5-editor');toutAfficher();};
  window.ouvrirEditionHabitude=function(id){const h=etat.habitudes.find(x=>x.id===id);if(!h)return;const jours=[['D',0],['L',1],['M',2],['M',3],['J',4],['V',5],['S',6]];ouvrirEditeur(`<h2>Modifier l'habitude</h2><div class="champ"><label>Nom</label><input id="ed-title" value="${echap(h.nom)}"></div><h3>Jours prévus</h3><div class="v5-checks">${jours.map(([l,v])=>`<label class="v5-check"><input type="checkbox" name="ed-day" value="${v}" ${h.joursSemaine.includes(v)?'checked':''}>${l}</label>`).join('')}</div><div class="champ" style="margin-top:12px"><label>Objectif hebdomadaire</label><input id="ed-target" type="number" min="1" max="7" value="${h.objectifHebdo||h.joursSemaine.length}"></div><div class="v5-actions"><button class="btn secondaire" onclick="fermerV5('v5-editor')">Annuler</button><button class="btn" onclick="sauverEditionHabitude('${id}')">Enregistrer</button></div>`);};
  window.sauverEditionHabitude=function(id){const h=etat.habitudes.find(x=>x.id===id);if(!h)return;h.nom=document.getElementById('ed-title').value.trim()||h.nom;h.joursSemaine=[...document.querySelectorAll('[name=ed-day]:checked')].map(x=>+x.value);h.objectifHebdo=Math.min(7,Math.max(1,parseInt(document.getElementById('ed-target').value,10)||h.joursSemaine.length||1));sauver();fermerV5('v5-editor');toutAfficher();};
  function ouvrirEditeur(html){document.getElementById('v5-editor-content').innerHTML=html;ouvrirV5('v5-editor');setTimeout(()=>document.querySelector('#v5-editor-content input, #v5-editor-content textarea')?.focus(),100);}

  /* ---------- Enrichissement des rendus existants ---------- */
  const ligneTacheV4 = ligneTacheHTML;
  ligneTacheHTML = function(t, complet) {
    let html=ligneTacheV4(t,complet);
    const actions=`${!t.fait?`<button class="btn-mini v5-focus-btn" onclick="lancerFocus('${t.id}')" aria-label="Démarrer un focus">▶</button>`:''}<button class="btn-mini" onclick="ouvrirEditionTache('${t.id}')" aria-label="Modifier">✎</button>`;
    return html.replace(`<button class="btn-suppr" onclick="supprimerTache('${t.id}')"`,`${actions}<button class="btn-suppr" onclick="supprimerTache('${t.id}')"`);
  };
  const evenementV4 = evenementHTML;
  evenementHTML = function(e){let html=evenementV4(e);const actions=`<button class="btn-mini v5-apple-btn" onclick="partagerICS('${e.id}')" aria-label="Ajouter au calendrier Apple"></button><button class="btn-mini" onclick="ouvrirEditionEvenement('${e.id}')" aria-label="Modifier">✎</button>`;return html.replace(`<button class="btn-suppr" onclick="supprimerEvenement('${e.id}')"`,`${actions}<button class="btn-suppr" onclick="supprimerEvenement('${e.id}')"`);};
  const habitudeV4=habitudeHTML;
  habitudeHTML=function(h){ensureV5State(etat);let html=habitudeV4(h);const sem=Object.keys(h.jours||{}).filter(d=>d>=lundiDe(AUJ)&&d<=decaler(lundiDe(AUJ),6)).length;return html.replace(`<button class="btn-suppr" onclick="supprimerHabitude('${h.id}')">`, `<span class="v5-help">${sem}/${h.objectifHebdo||7}</span><button class="btn-mini" onclick="ouvrirEditionHabitude('${h.id}')">✎</button><button class="btn-suppr" onclick="supprimerHabitude('${h.id}')">`);};
  const afficherAujV4=afficherAujourdhui;
  afficherAujourdhui=function(){afficherAujV4();const jour=new Date().getDay();const hs=etat.habitudes.filter(h=>(h.joursSemaine||[0,1,2,3,4,5,6]).includes(jour));const z=document.getElementById('auj-habitudes');if(z)z.innerHTML=hs.length?hs.map(habitudeHTML).join(''):'<div class="vide">Aucune habitude prévue aujourd’hui.</div>';renderDashboard();};
  const afficherNotesV4=afficherNotes;
  afficherNotes=function(){afficherNotesV4();augmenterNotes();};
  function augmenterNotes(){document.querySelectorAll('#liste-notes .note').forEach(el=>{const id=el.id.replace('note-','');const outils=el.querySelector('.outils');if(outils&&!outils.querySelector('.v5-edit-note'))outils.insertAdjacentHTML('afterbegin',`<button class="v5-edit-note" onclick="ouvrirEditionNote('${id}')" aria-label="Modifier">✎</button>`);});}

  /* ---------- Corbeille avec annulation ---------- */
  const TRASH_CONFIG={
    tache:['taches','Tâche'], evenement:['evenements','Événement'], note:['notes','Note'], seance:['seances','Séance'], habitude:['habitudes','Habitude'], repas:['repas','Repas'], programme:['programmesPerso','Programme'], routine:['routines','Routine']
  };
  function supprimerSouple(kind,id){const [cle,label]=TRASH_CONFIG[kind];const liste=etat[cle];const index=liste.findIndex(x=>x.id===id);if(index<0)return;const item=liste.splice(index,1)[0];const entree={id:uid(),kind,item,index,deletedAt:new Date().toISOString()};etat.corbeille.unshift(entree);sauver();toutAfficher();toast(`${label} déplacé${label.endsWith('e')?'e':''} dans la corbeille.`,'Annuler',()=>restaurerCorbeille(entree.id));}
  supprimerTache=id=>supprimerSouple('tache',id); supprimerEvenement=id=>supprimerSouple('evenement',id); supprimerNote=id=>supprimerSouple('note',id); supprimerSeance=id=>supprimerSouple('seance',id); supprimerHabitude=id=>supprimerSouple('habitude',id); supprimerRepas=id=>supprimerSouple('repas',id); supprimerProgramme=id=>supprimerSouple('programme',id);
  function restaurerCorbeille(id){const i=etat.corbeille.findIndex(x=>x.id===id);if(i<0)return;const x=etat.corbeille.splice(i,1)[0];const [cle]=TRASH_CONFIG[x.kind];const index=Math.min(x.index??etat[cle].length,etat[cle].length);if(!etat[cle].some(y=>y.id===x.item.id))etat[cle].splice(index,0,x.item);sauver();toutAfficher();toast('Élément restauré.');}
  window.restaurerCorbeille=restaurerCorbeille;
  window.restaurerTouteCorbeille=function(){[...etat.corbeille].reverse().forEach(x=>{const [cle]=TRASH_CONFIG[x.kind]||[];if(cle&&!etat[cle].some(y=>y.id===x.item.id))etat[cle].push(x.item);});etat.corbeille=[];sauver();toutAfficher();};
  window.viderCorbeille=function(){if(!etat.corbeille.length)return;if(confirm('Vider définitivement la corbeille ?')){etat.corbeille=[];sauver();renderTrash();}};
  function renderTrash(){const z=document.getElementById('v5-trash');if(!z)return;z.innerHTML=etat.corbeille.length?etat.corbeille.slice(0,20).map(x=>{const label=TRASH_CONFIG[x.kind]?.[1]||x.kind;const titre=x.item.libelle||x.item.titre||x.item.nom||x.item.type||'Élément';return `<div class="v5-trash-item"><div class="txt"><div class="type">${label}</div>${echap(titre)}</div><button class="btn-mini" onclick="restaurerCorbeille('${x.id}')">Restaurer</button></div>`;}).join(''):'<div class="vide">La corbeille est vide.</div>';}

  /* ---------- Routines ---------- */
  function formulaireRoutine(r=null, contexte='capture'){const jours=[['D',0],['L',1],['M',2],['M',3],['J',4],['V',5],['S',6]], actifs=r?.joursSemaine||[1,2,3,4,5];return `<input type="hidden" id="routine-id" value="${r?.id||''}"><div class="champ"><label>Nom</label><input id="routine-name" value="${echap(r?.nom||'')}" placeholder="Routine du matin"></div><div class="champ"><label>Étapes — une par ligne</label><textarea id="routine-steps" style="min-height:130px" placeholder="Boire un verre d'eau\nLire 10 minutes\nChoisir mes priorités">${echap((r?.etapes||[]).map(x=>x.libelle).join('\n'))}</textarea></div><h3>Jours</h3><div class="v5-checks">${jours.map(([l,v])=>`<label class="v5-check"><input name="routine-day" type="checkbox" value="${v}" ${actifs.includes(v)?'checked':''}>${l}</label>`).join('')}</div><div class="v5-actions"><button class="btn secondaire" onclick="fermerV5('${contexte==='capture'?'v5-capture':'v5-editor'}')">Annuler</button><button class="btn" onclick="sauverRoutineDepuisForm()">Enregistrer</button></div>`;}
  window.ouvrirEditionRoutine=function(id=null){const r=id?etat.routines.find(x=>x.id===id):null;ouvrirEditeur(`<h2>${r?'Modifier':'Nouvelle'} routine</h2>${formulaireRoutine(r,'editor')}`);};
  window.sauverRoutineDepuisForm=function(){const nom=document.getElementById('routine-name')?.value.trim();const labels=(document.getElementById('routine-steps')?.value||'').split('\n').map(x=>x.trim()).filter(Boolean);if(!nom||!labels.length){toast('Ajoute un nom et au moins une étape.');return;}const id=document.getElementById('routine-id')?.value;const jours=[...document.querySelectorAll('[name=routine-day]:checked')].map(x=>+x.value);if(id){const r=etat.routines.find(x=>x.id===id);r.nom=nom;r.joursSemaine=jours;r.etapes=labels.map((l,i)=>r.etapes[i]?.libelle===l?r.etapes[i]:{id:uid(),libelle:l});}else etat.routines.push({id:uid(),nom,joursSemaine:jours,etapes:labels.map(l=>({id:uid(),libelle:l})),fait:{}});sauver();fermerV5('v5-editor');fermerV5('v5-capture');toutAfficher();};
  window.basculerEtapeRoutine=function(rid,sid){const r=etat.routines.find(x=>x.id===rid);if(!r)return;const set=new Set(r.fait[AUJ]||[]);set.has(sid)?set.delete(sid):set.add(sid);r.fait[AUJ]=[...set];sauver();renderRoutines();};
  window.supprimerRoutine=id=>supprimerSouple('routine',id);
  function renderRoutines(){const z=document.getElementById('v5-routines');if(!z)return;const jour=new Date().getDay();const liste=etat.routines.filter(r=>(r.joursSemaine||[]).includes(jour));z.innerHTML=liste.length?liste.map(r=>{const faits=new Set(r.fait[AUJ]||[]);return `<div class="v5-routine"><div class="v5-routine-head"><div class="v5-routine-name">${echap(r.nom)}</div><div class="v5-routine-progress">${faits.size}/${r.etapes.length}</div><button class="btn-mini" onclick="ouvrirEditionRoutine('${r.id}')">✎</button><button class="btn-suppr" onclick="supprimerRoutine('${r.id}')">×</button></div>${r.etapes.map(s=>`<div class="v5-routine-step ${faits.has(s.id)?'fait':''}"><button class="${faits.has(s.id)?'fait':''}" onclick="basculerEtapeRoutine('${r.id}','${s.id}')">${faits.has(s.id)?'✓':''}</button><span>${echap(s.libelle)}</span></div>`).join('')}</div>`;}).join(''):'<div class="vide">Aucune routine prévue aujourd’hui.</div>';}

  /* ---------- Mode concentration ---------- */
  let focus={task:null,total:0,remaining:0,running:false,timer:null,startedAt:null,wakeLock:null};
  window.lancerFocus=function(id){const t=etat.taches.find(x=>x.id===id);if(!t)return;focus={task:t,total:(t.duree||25)*60,remaining:(t.duree||25)*60,running:false,timer:null,startedAt:null,wakeLock:null};rendreFocus();ouvrirV5('v5-focus');};
  function rendreFocus(){const m=Math.floor(focus.remaining/60),s=focus.remaining%60,done=focus.total?100*(focus.total-focus.remaining)/focus.total:0;document.getElementById('v5-focus-content').innerHTML=`<h2>Mode concentration</h2><div class="v5-focus"><div class="v5-focus-title">${echap(focus.task?.libelle||'')}</div><div class="v5-focus-time">${m}:${String(s).padStart(2,'0')}</div><div class="v5-focus-progress"><i style="width:${done}%"></i></div><div class="v5-focus-meta">Durée prévue : ${Math.round(focus.total/60)} min</div></div><div class="v5-actions"><button class="btn secondaire" onclick="arreterFocus(false)">Arrêter</button><button class="btn" onclick="basculerFocus()">${focus.running?'⏸ Pause':'▶ Démarrer'}</button><button class="btn secondaire" onclick="arreterFocus(true)">✓ Terminer</button></div>`;}
  window.basculerFocus=async function(){if(focus.running){clearInterval(focus.timer);focus.running=false;rendreFocus();return;}focus.running=true;focus.startedAt=focus.startedAt||new Date().toISOString();try{focus.wakeLock=await navigator.wakeLock?.request('screen');}catch(e){}focus.timer=setInterval(()=>{focus.remaining=Math.max(0,focus.remaining-1);if(!focus.remaining){arreterFocus(false,true);return;}rendreFocus();},1000);rendreFocus();};
  window.arreterFocus=function(marquer=false,termineNaturel=false){clearInterval(focus.timer);focus.wakeLock?.release?.();const utilise=Math.max(0,focus.total-focus.remaining);if(utilise>=30){etat.focusSessions.unshift({id:uid(),taskId:focus.task.id,titre:focus.task.libelle,date:AUJ,secondes:utilise,startedAt:focus.startedAt||new Date().toISOString()});}if(marquer&&!focus.task.fait)basculerTache(focus.task.id);else sauver();fermerV5('v5-focus');toutAfficher();if(termineNaturel){showAppNotification('Session terminée',{body:focus.task.libelle,tag:'focus-'+focus.task.id});toast('Session de concentration terminée.');}else if(utilise>=30)toast(`Focus enregistré : ${Math.round(utilise/60)} min.`);focus={task:null,total:0,remaining:0,running:false,timer:null,startedAt:null,wakeLock:null};};

  /* ---------- ICS enrichi et partage Apple ---------- */
  function icsEscape(s){return String(s||'').replace(/\\/g,'\\\\').replace(/\n/g,'\\n').replace(/,/g,'\\,').replace(/;/g,'\\;');}
  function dtstamp(){return new Date().toISOString().replace(/[-:]/g,'').replace(/\.\d{3}Z$/,'Z');}
  function addMinutes(iso,time,min){const [y,m,d]=iso.split('-').map(Number),[h,mi]=(time||'00:00').split(':').map(Number);const x=new Date(y,m-1,d,h,mi);x.setMinutes(x.getMinutes()+min);return {date:cleDate(x),time:String(x.getHours()).padStart(2,'0')+':'+String(x.getMinutes()).padStart(2,'0')};}
  function icsPourEvenement(e){const l=['BEGIN:VCALENDAR','VERSION:2.0','CALSCALE:GREGORIAN','METHOD:PUBLISH','PRODID:-//Mon Quotidien v5//FR','BEGIN:VEVENT',`UID:${e.id}@mon-quotidien`,`DTSTAMP:${dtstamp()}`];if(e.heure){l.push(`DTSTART;TZID=${TZ}:${icsDate(e.date,e.heure)}`);const fin=addMinutes(e.date,e.heure,e.duree||60);l.push(`DTEND;TZID=${TZ}:${icsDate(fin.date,fin.time)}`);}else{l.push(`DTSTART;VALUE=DATE:${icsDate(e.date)}`);l.push(`DTEND;VALUE=DATE:${icsDate(decaler(e.date,1))}`);}l.push(`SUMMARY:${icsEscape(e.titre)}`);if(e.lieu)l.push(`LOCATION:${icsEscape(e.lieu)}`);if(e.recur)l.push('RRULE:FREQ='+({quotidien:'DAILY',hebdo:'WEEKLY',mensuel:'MONTHLY'}[e.recur]));if(e.rappel>=0){l.push('BEGIN:VALARM',`TRIGGER:${e.rappel===0?'PT0M':'-PT'+e.rappel+'M'}`,'ACTION:DISPLAY',`DESCRIPTION:${icsEscape(e.titre)}`,'END:VALARM');}l.push('END:VEVENT','END:VCALENDAR');return l.join('\r\n');}
  window.partagerICS=async function(id){const e=etat.evenements.find(x=>x.id===id);if(!e)return;const blob=new Blob([icsPourEvenement(e)],{type:'text/calendar;charset=utf-8'});const file=new File([blob],`${e.titre.replace(/[^a-z0-9à-ÿ_-]+/gi,'-').slice(0,50)||'evenement'}.ics`,{type:'text/calendar'});try{if(navigator.canShare?.({files:[file]})){await navigator.share({title:e.titre,files:[file]});return;}}catch(err){if(err?.name==='AbortError')return;}telecharger(blob,file.name);toast('Fichier calendrier créé. Ouvre-le pour l’ajouter à Calendrier.');};
  const exporterICSV4=exporterICS;
  exporterICS=function(){if(!etat.evenements.length){toast('Aucun événement à exporter.');return;}const corps=etat.evenements.map(e=>icsPourEvenement(e).split('\r\n').filter(x=>!['BEGIN:VCALENDAR','END:VCALENDAR','VERSION:2.0','CALSCALE:GREGORIAN','METHOD:PUBLISH','PRODID:-//Mon Quotidien v5//FR'].includes(x)).join('\r\n')).join('\r\n');const head=['BEGIN:VCALENDAR','VERSION:2.0','CALSCALE:GREGORIAN','METHOD:PUBLISH','PRODID:-//Mon Quotidien v5//FR'];telecharger(new Blob([[...head,corps,'END:VCALENDAR'].join('\r\n')],{type:'text/calendar;charset=utf-8'}),'mon-quotidien-agenda.ics');};

  /* ---------- Notifications améliorées ---------- */
  async function showAppNotification(title,options={}){if(!('Notification'in window)||Notification.permission!=='granted')return false;try{const reg=await navigator.serviceWorker?.ready;if(reg){await reg.showNotification(title,Object.assign({icon:'icon-192.png',badge:'icon-192.png',data:{url:'./index.html'}},options));return true;}}catch(e){}try{new Notification(title,options);return true;}catch(e){return false;}}
  activerNotifications=async function(){if(etat.prefs.notif&&Notification.permission==='granted'){etat.prefs.notif=false;sauver();majEtatNotif();return;}const perm=await Notification.requestPermission();if(perm==='granted'){etat.prefs.notif=true;sauver();await showAppNotification('Mon Quotidien',{body:'Les rappels sont activés 🎉',tag:'welcome'});}majEtatNotif();};
  majEtatNotif=function(){const zone=document.getElementById('etat-notif'),btn=document.getElementById('btn-notif');if(!('Notification'in window)){zone.textContent='Notifications indisponibles dans ce navigateur.';zone.className='etat-notif ko';btn.style.display='none';return;}btn.style.display='inline-block';if(Notification.permission==='granted'&&etat.prefs.notif){zone.textContent='✓ Rappels actifs. Rattrapage automatique à la réouverture.';zone.className='etat-notif ok';btn.textContent='Désactiver les rappels';}else if(Notification.permission==='denied'){zone.textContent='Notifications bloquées dans les réglages du navigateur.';zone.className='etat-notif ko';btn.style.display='none';}else{zone.textContent='';btn.textContent='Activer les rappels';}};
  function tempsPasse(hhmm){const [h,m]=hhmm.split(':').map(Number),n=new Date();return n.getHours()*60+n.getMinutes()>=h*60+m;}
  async function verifierRappelsV5(){rafraichirJour();if(!etat.prefs.notif||Notification.permission!=='granted')return;const maintenant=new Date();let modif=false;for(const e of etat.evenements){if(e.rappel==null||e.rappel<0)continue;const dateOcc=e.recur?(occursOn(e,AUJ)?AUJ:null):e.date;if(!dateOcc)continue;const cle=e.id+dateOcc;if(etat.notifie[cle])continue;const [a,m,j]=dateOcc.split('-').map(Number),[h,mn]=(e.heure||'08:00').split(':').map(Number),debut=new Date(a,m-1,j,h,mn),decl=new Date(debut.getTime()-e.rappel*60000);if(maintenant>=decl&&maintenant<=new Date(debut.getTime()+15*60000)){await showAppNotification('📅 '+e.titre,{body:(e.rappel===0?"C'est maintenant":LIB_RAPPEL[e.rappel]||'Rappel')+(e.heure?' · '+e.heure:'')+(e.lieu?' · '+e.lieu:''),tag:cle,data:{url:`./index.html?screen=agenda&date=${dateOcc}`},actions:[{action:'open',title:'Ouvrir'}]});etat.notifie[cle]=true;modif=true;}}
    for(const t of etat.taches.filter(t=>!t.fait&&t.echeance===AUJ)){const cle='task-'+t.id+AUJ;if(!etat.notifie[cle]&&tempsPasse(etat.prefs.defaultTaskReminderHour)){await showAppNotification('✅ Tâche du jour',{body:t.libelle,tag:cle,data:{url:'./index.html?screen=taches'}});etat.notifie[cle]=true;modif=true;}}
    const matin='summary-am-'+AUJ;if(!etat.notifie[matin]&&tempsPasse(etat.prefs.morningSummary)){const nT=etat.taches.filter(t=>!t.fait&&t.echeance&&t.echeance<=AUJ).length,nE=evenementsDuJour(AUJ).length;await showAppNotification('Bonjour — ta journée',{body:`${nE} événement${nE>1?'s':''} · ${nT} tâche${nT>1?'s':''} à traiter`,tag:matin,data:{url:'./index.html?screen=auj'}});etat.notifie[matin]=true;modif=true;}
    const soir='summary-pm-'+AUJ;if(!etat.notifie[soir]&&tempsPasse(etat.prefs.eveningSummary)){const faites=etat.taches.filter(t=>t.fait&&t.faitLe===AUJ).length,mins=etat.seances.filter(s=>s.date===AUJ).reduce((n,s)=>n+s.duree,0);await showAppNotification('Bilan du jour',{body:`${faites} tâche${faites>1?'s':''} terminée${faites>1?'s':''} · ${mins} min de sport`,tag:soir,data:{url:'./index.html?screen=auj'}});etat.notifie[soir]=true;modif=true;}
    if(modif)sauver();
  }
  setInterval(verifierRappelsV5,30000);

  /* ---------- Changement de jour ---------- */
  function rafraichirJour(){const nouveau=cleDate(new Date());if(nouveau===AUJ)return;const ancien=AUJ;AUJ=nouveau;if(etat.prefs.autoRollOverdue)etat.taches.forEach(t=>{if(!t.fait&&t.echeance&&t.echeance<AUJ)t.echeance=AUJ;});etat.prefs.lastActiveDate=AUJ;document.getElementById('date-tete').textContent=new Date().toLocaleDateString('fr-FR',{weekday:'long',day:'numeric',month:'long'});document.getElementById('evt-date').value=AUJ;jourChoisi=AUJ;semaineBase=lundiDe(AUJ);sauver();toutAfficher();toast(`Nouvelle journée : ${dateLisible(AUJ)}.`);}
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'){rafraichirJour();verifierRappelsV5();}});
  setInterval(rafraichirJour,60000);

  /* ---------- Réglages v5 ---------- */
  function remplirReglagesV5(){ensureV5State(etat);const set=(id,v)=>{const e=document.getElementById(id);if(e)e.value=v;};set('v5-default-event',etat.prefs.defaultEventReminder);set('v5-task-time',etat.prefs.defaultTaskReminderHour);set('v5-morning',etat.prefs.morningSummary);set('v5-evening',etat.prefs.eveningSummary);const c=document.getElementById('v5-auto-roll');if(c)c.checked=etat.prefs.autoRollOverdue;renderTrash();updateStorageStatus();}
  window.sauverReglagesV5=function(){etat.prefs.defaultEventReminder=parseInt(document.getElementById('v5-default-event').value,10);etat.prefs.defaultTaskReminderHour=document.getElementById('v5-task-time').value||'09:00';etat.prefs.morningSummary=document.getElementById('v5-morning').value||'07:30';etat.prefs.eveningSummary=document.getElementById('v5-evening').value||'21:30';etat.prefs.autoRollOverdue=document.getElementById('v5-auto-roll').checked;sauver();toast('Réglages enregistrés.');};
  function updateStorageStatus(ok=true){const txt=document.getElementById('v5-storage-status'),dot=document.getElementById('v5-storage-dot');if(!txt)return;if(!('indexedDB'in window)){txt.textContent='Mode localStorage uniquement : exporte régulièrement tes données.';dot.className='v5-dot warn';return;}txt.textContent='Données enregistrées dans IndexedDB et localStorage, disponibles hors connexion.';dot.className='v5-dot';}

  /* ---------- Installation et mises à jour PWA ---------- */
  let deferredInstall=null;
  window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferredInstall=e;if(!etat.prefs.installDismissed)document.getElementById('v5-install').classList.add('visible');});
  async function lancerInstallation(){if(deferredInstall){deferredInstall.prompt();await deferredInstall.userChoice;deferredInstall=null;document.getElementById('v5-install').classList.remove('visible');}else expliquerInstallation();}
  function expliquerInstallation(){const ios=/iphone|ipad|ipod/i.test(navigator.userAgent);alert(ios?"Sur iPhone : ouvre le menu Partager de Safari, puis touche « Sur l’écran d’accueil ».":"Ouvre le menu du navigateur puis choisis « Installer l’application » ou « Ajouter à l’écran d’accueil ».");}
  window.installerOuExpliquer=lancerInstallation;
  document.getElementById('v5-install-btn').addEventListener('click',lancerInstallation);
  document.getElementById('v5-install-close').addEventListener('click',()=>{document.getElementById('v5-install').classList.remove('visible');etat.prefs.installDismissed=true;sauver();});
  document.getElementById('v5-update-close').addEventListener('click',()=>document.getElementById('v5-update').classList.remove('visible'));
  let waitingWorker=null;
  if('serviceWorker'in navigator&&(location.protocol==='https:'||location.hostname==='localhost')){
    navigator.serviceWorker.register('./sw.js').then(reg=>{if(reg.waiting){waitingWorker=reg.waiting;document.getElementById('v5-update').classList.add('visible');}reg.addEventListener('updatefound',()=>{const w=reg.installing;w?.addEventListener('statechange',()=>{if(w.state==='installed'&&navigator.serviceWorker.controller){waitingWorker=w;document.getElementById('v5-update').classList.add('visible');}});});});
    navigator.serviceWorker.addEventListener('controllerchange',()=>location.reload());
  }
  document.getElementById('v5-update-btn').addEventListener('click',()=>waitingWorker?.postMessage({type:'SKIP_WAITING'}));

  /* ---------- Rendu global enveloppé ---------- */
  const toutAfficherV4=toutAfficher;
  toutAfficher=function(){ensureV5State(etat);toutAfficherV4();renderDashboard();renderRoutines();renderTrash();augmenterNotes();remplirDefaultsFormulaire();};
  function remplirDefaultsFormulaire(){const rappel=document.getElementById('evt-rappel');if(rappel&&rappel.value==='-1'&&!document.getElementById('form-evt')?.open)rappel.value=String(etat.prefs.defaultEventReminder);}

  /* ---------- Paramètres d'ouverture et raccourcis PWA ---------- */
  function traiterURL(){const p=new URLSearchParams(location.search);const capture=p.get('capture'),screen=p.get('screen'),date=p.get('date');if(screen&&document.getElementById('ecran-'+screen))montrerEcran(screen);if(date&&screen==='agenda')choisirJour(date);if(capture&&CAPTURE_MODES.some(x=>x[0]===capture))setTimeout(()=>ouvrirCapture(capture),150);if(location.search)history.replaceState({},'',location.pathname);}

  /* ---------- Branchement des actions ---------- */
  document.getElementById('v5-toast-action').addEventListener('click',window.v5ToastAction);
  document.getElementById('btn-donnees').addEventListener('click',remplirReglagesV5);

  remplirReglagesV5();
  toutAfficher();
  if (!document.querySelector('.ecran.actif')) montrerEcran('auj');
  traiterURL();
  initialiserIDB();
  verifierRappelsV5();
})();

(function () {
  "use strict";
  var KEY = "quotidien-rebuild-2";
  var LIFE = [
    "Finances",
    "Projets de vie",
    "Apprentissage",
    "Documents",
    "Maison",
    "Nutrition",
    "Santé avancée",
    "Relations",
    "Voyages",
    "Carrière",
    "Décisions",
    "Journal",
    "Automatisations",
    "Assistant",
    "Vie numérique",
    "Sécurité",
    "Impact",
    "Foyer",
    "Progression",
    "Équilibre",
  ];
  var state, repository, committed, bootError;
  var root = document.getElementById("app");
  var editing = null,
    planTab = "tasks",
    lastFocus = null,
    pendingImport = null,
    draft = null;
  try {
    repository = new Q.Repository(localStorage);
    state = repository.load();
    committed = Q.clone(state);
  } catch (error) {
    bootError = error;
  }
  var os = createLifeOS({
    state: () => state,
    esc,
    id,
    save,
    modal,
    close: closeModal,
    render,
    toast,
    error: showError,
    download,
    listLife,
    openForm,
    get kinds() {
      return kinds;
    },
  });
  function id() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }
  function day() {
    return Q.day();
  }
  function esc(v) {
    return String(v == null ? "" : v).replace(/[&<>"']/g, function (c) {
      return {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      }[c];
    });
  }
  function save(checkpoint) {
    try {
      state = repository.commit(state, !!checkpoint);
      committed = Q.clone(state);
      draft = null;
      return true;
    } catch (error) {
      draft = Q.clone(state);
      state = Q.clone(committed);
      showError(
        "Sauvegarde impossible. " +
          error.message +
          " La saisie reste dans le formulaire.",
      );
      return false;
    }
  }
  function showError(message) {
    var parent =
      document.querySelector(".modal") ||
      document.querySelector(".shell") ||
      root;
    var box = parent.querySelector("[role=alert]");
    if (!box) {
      box = document.createElement("p");
      box.setAttribute("role", "alert");
      box.className = "error";
      parent.prepend(box);
    }
    box.textContent = message;
  }
  function download(text, name) {
    var blob = new Blob([text], { type: "application/json" }),
      link = document.createElement("a"),
      url = URL.createObjectURL(blob);
    link.href = url;
    link.download = name;
    link.click();
    setTimeout(function () {
      URL.revokeObjectURL(url);
    }, 1000);
  }
  function recovery(error) {
    root.innerHTML =
      '<main class="shell recovery"><h1>Retrouvons tes données</h1><p>Le chargement a échoué. Aucune donnée existante n’a été remplacée.</p><p role="alert"></p><div class="list"><button id="raw-export" class="primary">Exporter les données brutes</button><button id="previous-export" class="mini">Exporter la copie précédente</button><button id="retry" class="mini">Réessayer le chargement</button></div><p>Conserve les exports avant toute réparation.</p></main>';
    root.querySelector("[role=alert]").textContent = error.message;
    root.querySelector("#retry").onclick = function () {
      location.reload();
    };
    ["raw-export", "previous-export"].forEach(function (name) {
      root.querySelector("#" + name).onclick = function () {
        try {
          var raw = localStorage.getItem(
            name === "raw-export" ? KEY : Q.BACKUP_KEY,
          );
          if (raw === null) throw new Error("Aucune copie disponible.");
          download(raw, "quotidien-recuperation-" + name + ".json");
        } catch (err) {
          showError(err.message);
        }
      };
    });
  }
  function toast(t) {
    var e = document.createElement("div");
    e.className = "toast";
    e.setAttribute("role", "status");
    e.textContent = t;
    document.body.appendChild(e);
    setTimeout(function () {
      e.remove();
    }, 1700);
  }
  function fmt(d) {
    try {
      return new Intl.DateTimeFormat("fr-FR", {
        day: "numeric",
        month: "short",
      }).format(new Date(d + "T12:00:00"));
    } catch (e) {
      return esc(d);
    }
  }
  function active(arr) {
    return arr.filter(function (x) {
      return !x.deleted;
    });
  }
  function shell(content) {
    return (
      '<div class="shell"><header class="topbar"><div><div class="brand">QUOTIDIEN <span>2.2</span></div><div class="date">' +
      esc(
        new Intl.DateTimeFormat("fr-FR", {
          weekday: "long",
          day: "numeric",
          month: "long",
        }).format(new Date()),
      ) +
      '</div></div><div class="top-actions"><button class="icon" aria-label="Rechercher" data-action="search">⌕</button><button class="icon" aria-label="Ajouter" data-action="quick">＋</button><button class="icon" aria-label="Réglages" data-action="settings">⚙</button></div></header>' +
      content +
      "</div>" +
      nav() +
      '<div id="modal"></div>'
    );
  }
  function nav() {
    var items = [
      ["today", "⌂", "Aujourd’hui"],
      ["plan", "▦", "Planifier"],
      ["notes", "◇", "Notes"],
      ["tracking", "↗", "Suivi"],
      ["life", "✦", "Life OS"],
      ["wave", "◆", "Pilotage"],
    ];
    return (
      '<nav class="bottom"><div class="inner">' +
      items
        .map(function (i) {
          return (
            '<button class="nav ' +
            (state.screen === i[0] ? "active" : "") +
            '" data-screen="' +
            i[0] +
            '"><span>' +
            i[1] +
            "</span>" +
            i[2] +
            "</button>"
          );
        })
        .join("") +
      "</div></nav>"
    );
  }
  function render() {
    document.documentElement.dataset.theme = state.settings.theme;
    var c =
      state.screen === "today"
        ? todayView()
        : state.screen === "plan"
          ? planView()
          : state.screen === "notes"
            ? notesView()
            : state.screen === "tracking"
              ? trackingView()
              : state.screen === "life"
                ? lifeView()
                : waveView();
    document.body.classList.remove("modal-open");
    root.innerHTML = shell(c);
    decorateForms();
    root.querySelectorAll(".nav").forEach(function (button) {
      button.setAttribute(
        "aria-current",
        button.dataset.screen === state.screen ? "page" : "false",
      );
    });
    if (state.screen === "plan") {
      root.querySelectorAll("[data-plan-section]").forEach(function (section) {
        section.hidden = section.dataset.planSection !== planTab;
      });
      root.querySelectorAll("[data-tab]").forEach(function (button) {
        button.classList.toggle("active", button.dataset.tab === planTab);
        button.setAttribute(
          "aria-pressed",
          String(button.dataset.tab === planTab),
        );
      });
    }
  }
  function todayView() {
    var open = active(state.tasks).filter(function (t) {
      return !t.done;
    });
    var due = open.filter(function (t) {
      return t.due === day();
    });
    var top = open
      .slice()
      .sort(function (a, b) {
        return (
          (b.important || 0) +
          (b.urgent || 0) -
          (a.important || 0) -
          (a.urgent || 0)
        );
      })
      .slice(0, 3);
    var ev = active(state.events)
      .filter(function (e) {
        return e.date === day();
      })
      .sort(function (a, b) {
        return (a.time || "").localeCompare(b.time || "");
      });
    var doneWeek = active(state.tasks).filter(function (t) {
      return t.done;
    }).length;
    var focus = Q.focusMinutes(state);
    return (
      '<section class="hero"><span class="eyebrow">AUJOURD’HUI</span><h1>Bonjour Raphaël</h1><p>' +
      (ev[0]
        ? "Aujourd’hui : <strong>" +
          esc(ev[0].time || "Journée") +
          " · " +
          esc(ev[0].title) +
          "</strong>"
        : "Ta journée est libre : choisis une prochaine action.") +
      '</p><button class="primary" data-screen="plan">Planifier</button></section><section class="grid stat-grid"><article class="card stat"><strong>' +
      doneWeek +
      '</strong><span>tâches terminées</span></article><article class="card stat"><strong>' +
      focus +
      '</strong><span>min focus</span></article><article class="card stat"><strong>' +
      active(state.workouts).length +
      '</strong><span>séances sport</span></article><article class="card stat"><strong>' +
      due.length +
      '</strong><span>échéances aujourd’hui</span></article><article class="card wide"><div class="section-head"><div><span class="eyebrow">CHRONOLOGIE</span><h2>Ma journée</h2></div><button class="mini" data-action="add-event">＋ Événement</button></div>' +
      listEvents(ev) +
      '</article><article class="card"><div class="section-head"><div><span class="eyebrow">TOP 3</span><h2>Priorités</h2></div></div>' +
      listTasks(top) +
      '</article><article class="card"><div class="section-head"><div><span class="eyebrow">HABITUDES</span><h2>À cocher</h2></div></div>' +
      listHabits(active(state.habits)) +
      '</article><article class="card wide"><div class="section-head"><div><span class="eyebrow">OBJECTIFS</span><h2>Cap</h2></div><button class="mini" data-action="add-goal">＋</button></div>' +
      listGoals(active(state.goals)) +
      "</article></section>"
    );
  }
  function planView() {
    return (
      '<div class="page-title"><div><span class="eyebrow">ORGANISER</span><h1>Planifier</h1></div><button class="primary" data-action="quick">＋ Ajouter</button></div><div class="tabs"><button class="active" data-tab="tasks">Tâches</button><button data-tab="agenda">Agenda</button><button data-tab="goals">Objectifs</button><button data-tab="routines">Routines</button></div><section class="card" data-plan-section="tasks"><form class="form" id="inline-task-form"><input name="title" class="full" placeholder="Nouvelle tâche" required><input name="due" type="date"><select name="project"><option>Personnel</option><option>Travail</option><option>Santé</option><option>Finances</option></select><label><input name="important" type="checkbox"> Important</label><label><input name="urgent" type="checkbox"> Urgente</label><button class="primary">Ajouter</button></form></section><section class="card" data-plan-section="tasks"><div class="section-head"><div><span class="eyebrow">MES TÂCHES</span><h2>' +
      active(state.tasks).filter(function (t) {
        return !t.done;
      }).length +
      " ouvertes</h2></div></div>" +
      listTasks(active(state.tasks)) +
      '</section><section class="card" data-plan-section="agenda"><div class="section-head"><div><span class="eyebrow">AGENDA</span><h2>Événements</h2></div><button class="mini" data-action="add-event">＋</button></div>' +
      listEvents(
        active(state.events).sort(function (a, b) {
          return String(a.date || "").localeCompare(String(b.date || ""));
        }),
      ) +
      '</section><section class="card" data-plan-section="routines"><div class="section-head"><div><span class="eyebrow">ROUTINES</span><h2>Mes séquences</h2></div><button class="mini" data-action="add-routine">＋</button></div>' +
      listRoutines(active(state.routines)) +
      '</section><section class="card" data-plan-section="goals"><div class="section-head"><h2>Objectifs</h2><button class="mini" data-action="add-goal">＋ Objectif</button></div>' +
      listGoals(active(state.goals)) +
      "</section>"
    );
  }
  function notesView() {
    return (
      '<div class="page-title"><div><span class="eyebrow">SECOND CERVEAU</span><h1>Notes</h1></div><button class="primary" data-action="add-note">＋ Note</button></div><section class="card"><form class="form" id="inline-note-form"><input name="title" placeholder="Titre" required><input name="tags" placeholder="Tags"><textarea name="body" class="full" placeholder="Écris en Markdown ou en texte libre…"></textarea><button class="primary">Enregistrer</button></form></section><section class="grid">' +
      (active(state.notes).length
        ? ""
        : '<p class="empty">Conserve ici tes idées et informations. Crée ta première note avec « + Note ».</p>') +
      active(state.notes)
        .map(function (n) {
          return (
            '<article class="card"><div class="section-head"><div><span class="eyebrow">' +
            esc(n.tags || "NOTE") +
            '</span><h2><button class="text-button" data-edit="notes" data-id="' +
            esc(n.id) +
            '">' +
            esc(n.title) +
            '</button></h2></div><button class="danger" data-del="notes" data-id="' +
            esc(n.id) +
            '">×</button></div><p class="meta">' +
            esc(n.body).replace(/\n/g, "<br>") +
            "</p></article>"
          );
        })
        .join("") +
      "</section>"
    );
  }
  function trackingView() {
    return (
      '<div class="page-title"><div><span class="eyebrow">SUIVI</span><h1>Santé & progression</h1></div><button class="primary" data-action="track">＋ Mesure</button></div><section class="grid"><article class="card"><div class="section-head"><div><span class="eyebrow">HABITUDES</span><h2>Régularité</h2></div><button class="mini" data-action="add-habit">＋</button></div>' +
      listHabits(active(state.habits)) +
      '</article><article class="card"><div class="section-head"><div><span class="eyebrow">SPORT</span><h2>Séances</h2></div><button class="mini" data-action="add-workout">＋</button></div>' +
      listWorkouts(active(state.workouts)) +
      '</article><article class="card wide"><div class="section-head"><div><span class="eyebrow">SANTÉ</span><h2>Dernières mesures</h2></div><button class="mini" data-action="track">＋</button></div><div class="health-grid">' +
      active(state.health)
        .slice(0, 8)
        .map(function (h) {
          return (
            '<div class="kpi"><strong>' +
            esc(h.value) +
            " " +
            esc(h.unit || "") +
            "</strong><span>" +
            esc(h.kind) +
            " · " +
            fmt(h.date) +
            "</span></div>"
          );
        })
        .join("") +
      "</div></article></section>"
    );
  }
  function lifeView() {
    return os.view();
  }
  function waveView() {
    return (
      '<div class="page-title"><div><span class="eyebrow">PILOTAGE</span><h1>Pilotage avancé</h1></div></div><section class="grid"><article class="card"><div class="section-head"><div><span class="eyebrow">PROJETS DE VIE</span><h2>Objectifs</h2></div><button class="mini" data-action="add-goal">＋</button></div>' +
      listGoals(active(state.goals)) +
      '</article><article class="card"><div class="section-head"><div><span class="eyebrow">FINANCES</span><h2>' +
      money(balance()) +
      '</h2></div><button class="mini" data-action="finance">＋</button></div>' +
      listFinance(active(state.finances)) +
      '</article><article class="card"><div class="section-head"><div><span class="eyebrow">DOCUMENTS</span><h2>Échéances</h2></div><button class="mini" data-action="document">＋</button></div>' +
      listGeneric(state.documents, "documents") +
      '</article><article class="card"><div class="section-head"><div><span class="eyebrow">MAISON</span><h2>Équipements</h2></div><button class="mini" data-action="asset">＋</button></div>' +
      listGeneric(state.assets, "assets") +
      '</article><article class="card wide"><div class="section-head"><div><span class="eyebrow">AUTOMATISATIONS</span><h2>Idées de règles</h2></div><button class="mini" data-action="automation">＋</button></div>' +
      listGeneric(state.automations, "automations") +
      "</article></section>"
    );
  }
  function listTasks(arr) {
    if (!arr.length) return '<p class="empty">Aucune tâche.</p>';
    return (
      '<div class="list">' +
      arr
        .map(function (t) {
          return (
            '<article class="item ' +
            (t.done ? "done" : "") +
            '"><button class="check" data-toggle="task" data-id="' +
            esc(t.id) +
            '">' +
            (t.done ? "✓" : "") +
            '</button><div><div class="title"><button class="text-button" data-edit="tasks" data-id="' +
            esc(t.id) +
            '">' +
            esc(t.title) +
            '</button></div><div class="meta">' +
            esc(t.project || "Personnel") +
            (t.due ? " · " + fmt(t.due) : "") +
            (t.urgent ? " · 🔥 urgente" : "") +
            (t.important ? " · ⭐ importante" : "") +
            '</div></div><button class="danger" data-del="tasks" data-id="' +
            esc(t.id) +
            '">×</button></article>'
          );
        })
        .join("") +
      "</div>"
    );
  }
  function listEvents(arr) {
    if (!arr.length) return '<p class="empty">Aucun événement.</p>';
    return (
      '<div class="list">' +
      arr
        .map(function (e) {
          return (
            '<article class="item"><div class="check">' +
            esc(e.time || "•") +
            '</div><div><div class="title"><button class="text-button" data-edit="events" data-id="' +
            esc(e.id) +
            '">' +
            esc(e.title) +
            '</button></div><div class="meta">' +
            fmt(e.date) +
            " · " +
            esc(e.category || "Personnel") +
            '</div></div><button class="danger" data-del="events" data-id="' +
            esc(e.id) +
            '">×</button></article>'
          );
        })
        .join("") +
      "</div>"
    );
  }
  function listHabits(arr) {
    if (!arr.length) return '<p class="empty">Aucune habitude.</p>';
    return (
      '<div class="list">' +
      arr
        .map(function (h) {
          var done = !!(h.days && h.days[day()]);
          return (
            '<article class="item ' +
            (done ? "done" : "") +
            '"><button class="check" data-toggle="habit" data-id="' +
            esc(h.id) +
            '">' +
            (done ? "✓" : "") +
            '</button><div><div class="title"><button class="text-button" data-edit="habits" data-id="' +
            esc(h.id) +
            '">' +
            esc(h.name) +
            '</button></div><div class="meta">Objectif ' +
            esc(h.target || 1) +
            " " +
            esc(h.unit || "fois") +
            '</div></div><button class="danger" data-del="habits" data-id="' +
            esc(h.id) +
            '">×</button></article>'
          );
        })
        .join("") +
      "</div>"
    );
  }
  function listGoals(arr) {
    if (!arr.length) return '<p class="empty">Aucun objectif.</p>';
    return (
      '<div class="list">' +
      arr
        .map(function (g) {
          return (
            '<article class="item"><div class="check">' +
            Math.round(g.progress || 0) +
            '%</div><div><div class="title"><button class="text-button" data-edit="goals" data-id="' +
            esc(g.id) +
            '">' +
            esc(g.title) +
            '</button></div><div class="progress"><i style="width:' +
            Math.max(0, Math.min(100, g.progress || 0)) +
            '%"></i></div><div class="meta">' +
            esc(g.area || "Personnel") +
            (g.date ? " · " + fmt(g.date) : "") +
            '</div></div><button class="danger" data-del="goals" data-id="' +
            esc(g.id) +
            '">×</button></article>'
          );
        })
        .join("") +
      "</div>"
    );
  }
  function listRoutines(arr) {
    if (!arr.length) return '<p class="empty">Aucune routine.</p>';
    return (
      '<div class="list">' +
      arr
        .map(function (r) {
          return (
            '<article class="item"><div class="check">↻</div><div><div class="title"><button class="text-button" data-edit="routines" data-id="' +
            esc(r.id) +
            '">' +
            esc(r.name) +
            '</button></div><div class="meta">' +
            esc(r.time || "Sans horaire") +
            " · " +
            esc(r.steps || "") +
            '</div></div><button class="danger" data-del="routines" data-id="' +
            esc(r.id) +
            '">×</button></article>'
          );
        })
        .join("") +
      "</div>"
    );
  }
  function listWorkouts(arr) {
    if (!arr.length) return '<p class="empty">Aucune séance.</p>';
    return (
      '<div class="list">' +
      arr
        .map(function (w) {
          return (
            '<article class="item"><div class="check">↗</div><div><div class="title"><button class="text-button" data-edit="workouts" data-id="' +
            esc(w.id) +
            '">' +
            esc(w.type) +
            '</button></div><div class="meta">' +
            fmt(w.date) +
            " · " +
            esc(w.minutes) +
            " min · effort " +
            esc(w.effort) +
            '/10</div></div><button class="danger" data-del="workouts" data-id="' +
            esc(w.id) +
            '">×</button></article>'
          );
        })
        .join("") +
      "</div>"
    );
  }
  function listLife(arr) {
    if (!arr.length) return '<p class="empty">Aucune capture.</p>';
    return (
      '<div class="list">' +
      arr
        .map(function (x) {
          return (
            '<article class="item"><div class="check">✦</div><div><div class="title"><button class="text-button" data-edit="life" data-id="' +
            esc(x.id) +
            '">' +
            esc(x.title) +
            '</button></div><div class="meta">' +
            esc(x.domain) +
            " · " +
            esc(x.status || "En cours") +
            '</div></div><button class="danger" data-del="life" data-id="' +
            esc(x.id) +
            '">×</button></article>'
          );
        })
        .join("") +
      "</div>"
    );
  }
  function listFinance(arr) {
    if (!arr.length) return '<p class="empty">Aucun mouvement.</p>';
    return (
      '<div class="list">' +
      arr
        .map(function (x) {
          return (
            '<article class="item"><div class="check">€</div><div><div class="title"><button class="text-button" data-edit="finances" data-id="' +
            esc(x.id) +
            '">' +
            esc(x.label) +
            '</button></div><div class="meta">' +
            fmt(x.date) +
            " · " +
            esc(x.category) +
            "</div></div><strong>" +
            money(x.amount) +
            '</strong><button class="danger" data-del="finances" data-id="' +
            esc(x.id) +
            '">×</button></article>'
          );
        })
        .join("") +
      "</div>"
    );
  }
  function listGeneric(arr, key) {
    if (!active(arr).length) return '<p class="empty">Aucun élément.</p>';
    return (
      '<div class="list">' +
      active(arr)
        .map(function (x) {
          return (
            '<article class="item"><div class="check">•</div><div><div class="title"><button class="text-button" data-edit="' +
            key +
            '" data-id="' +
            esc(x.id) +
            '">' +
            esc(x.title) +
            '</button></div><div class="meta">' +
            esc(x.category || "Général") +
            (x.date ? " · " + fmt(x.date) : "") +
            '</div></div><button class="danger" data-del="' +
            key +
            '" data-id="' +
            esc(x.id) +
            '">×</button></article>'
          );
        })
        .join("") +
      "</div>"
    );
  }
  function balance() {
    return active(state.finances).reduce(function (s, x) {
      return s + (+x.amount || 0);
    }, 0);
  }
  function money(v) {
    return new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency: "EUR",
    }).format(+v || 0);
  }
  function closeModal() {
    document.getElementById("modal").innerHTML = "";
    document.body.classList.remove("modal-open");
    root.querySelector(".shell")?.removeAttribute("inert");
    root.querySelector(".bottom")?.removeAttribute("inert");
    editing = null;
    pendingImport = null;
    if (lastFocus && lastFocus.isConnected) lastFocus.focus();
  }
  function modal(title, body) {
    if (!document.querySelector(".modal")) lastFocus = document.activeElement;
    editing = null;
    document.getElementById("modal").innerHTML =
      '<div class="modal-wrap"><section class="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title" tabindex="-1"><header><h2 id="modal-title">' +
      esc(title) +
      '</h2><button class="icon" aria-label="Fermer" data-close="1">×</button></header>' +
      body +
      "</section></div>";
    document.body.classList.add("modal-open");
    root.querySelector(".shell").setAttribute("inert", "");
    root.querySelector(".bottom").setAttribute("inert", "");
    decorateForms();
    (
      document.querySelector(".modal input,.modal select,.modal textarea") ||
      document.querySelector(".modal button")
    )?.focus();
  }
  function form(fields, idf) {
    return (
      '<form class="form" id="' +
      idf +
      '">' +
      fields +
      '<button class="primary">Enregistrer</button></form>'
    );
  }
  function quick() {
    modal(
      "Capture rapide",
      '<div class="quick-grid">' +
        [
          ["task", "Tâche"],
          ["event", "Événement"],
          ["finance", "Dépense / revenu"],
          ["note", "Note"],
          ["workout", "Séance"],
          ["habit", "Habitude"],
        ]
          .map(function (x) {
            return (
              '<button class="mini" data-create="' +
              x[0] +
              '">' +
              x[1] +
              "</button>"
            );
          })
          .join("") +
        "</div>",
    );
  }
  function settings() {
    modal(
      "Réglages & données",
      '<div class="list"><button class="primary" data-action="export">Exporter mes données</button><button class="mini" data-action="import">Importer une sauvegarde</button><button class="mini" data-action="trash">Éléments retirés</button><button class="mini" data-action="restore">Récupérer la copie précédente</button><button class="mini" data-action="checkpoint">Récupérer avant le dernier import</button><button class="mini" data-action="theme">Passer au thème ' +
        (state.settings.theme === "dark" ? "clair" : "sombre") +
        "</button>" +
        (draft
          ? '<button class="mini" data-action="export-draft">Exporter la saisie non enregistrée</button>'
          : "") +
        '<button class="mini" data-action="clear">Réinitialiser les données</button><p class="meta">Tes données restent dans ce navigateur. Exporte régulièrement une sauvegarde pour les conserver ailleurs. Version ' +
        Q.RELEASE +
        ".</p></div>",
    );
  }
  function importPreview(next) {
    modal(
      "Vérifier la restauration",
      "<p>Cette sauvegarde remplacera les données actuelles. Une copie de celles-ci sera conservée avant le remplacement.</p><p>" +
        esc(Q.summary(next)) +
        '</p><button class="primary" data-action="confirm-import">Restaurer cette sauvegarde</button>',
    );
    pendingImport = next;
  }
  function trash() {
    var rows = [];
    Q.collections.forEach(function (key) {
      state[key]
        .filter(function (x) {
          return x.deleted;
        })
        .forEach(function (x) {
          rows.push(
            '<div class="item"><div><strong>' +
              esc(
                x.title || x.name || x.label || x.type || x.kind || "Élément",
              ) +
              '</strong><p class="meta">' +
              esc(collectionLabels[key]) +
              '</p></div><button class="mini" data-restore="' +
              key +
              '" data-id="' +
              esc(x.id) +
              '">Rétablir</button></div>',
          );
        });
    });
    modal(
      "Éléments retirés",
      '<p>Rétablis un élément sans remplacer les autres données.</p><div class="list">' +
        (rows.join("") || '<p class="empty">Aucun élément retiré.</p>') +
        "</div>",
    );
  }
  function search() {
    modal(
      "Recherche globale",
      '<label>Rechercher<input id="global-search" type="search" placeholder="Tâches, notes, dépenses, objectifs…"></label><div id="search-results" class="list" aria-live="polite"></div>',
    );
    searchResults("");
  }
  function searchResults(query) {
    var items = Q.matches(state, query);
    document.getElementById("search-results").innerHTML =
      '<p class="meta">' +
      items.length +
      " résultat(s)</p>" +
      items
        .slice(0, 100)
        .map(function (hit) {
          var x = hit.record;
          return (
            '<button class="search-result" data-edit="' +
            hit.key +
            '" data-id="' +
            esc(x.id) +
            '"><strong>' +
            esc(x.title || x.name || x.label || x.type || x.kind || "Élément") +
            "</strong><span>" +
            esc(collectionLabels[hit.key]) +
            " · " +
            esc(x.date || x.due || x.domain || "") +
            "</span></button>"
          );
        })
        .join("") +
      (items.length > 100
        ? "<p>Précise la recherche pour voir les autres résultats.</p>"
        : "");
  }
  var collectionLabels = {
    os: "Life OS spécialisé",
    tasks: "Tâches",
    events: "Événements",
    notes: "Notes",
    habits: "Habitudes",
    routines: "Routines",
    goals: "Objectifs",
    workouts: "Séances",
    health: "Mesures",
    life: "Life OS",
    finances: "Finances",
    documents: "Documents",
    assets: "Équipements",
    automations: "Idées d’automatisation",
  };
  var kinds = {
    tasks: "task",
    events: "event",
    notes: "note",
    habits: "habit",
    routines: "routine",
    goals: "goal",
    workouts: "workout",
    health: "track",
    life: "life",
    finances: "finance",
    documents: "document",
    assets: "asset",
    automations: "automation",
  };
  function decorateForms() {
    var labels = {
      title: "Titre",
      name: "Nom",
      label: "Libellé",
      date: "Date",
      due: "Échéance",
      time: "Heure",
      category: "Catégorie",
      project: "Projet / liste",
      area: "Domaine",
      progress: "Progression (%)",
      target: "Objectif",
      unit: "Unité",
      type: "Sport",
      minutes: "Durée (minutes)",
      effort: "Effort (1 à 10)",
      kind: "Mesure",
      value: "Valeur",
      domain: "Domaine de vie",
      status: "Statut",
      body: "Contenu",
      tags: "Tags",
      details: "Détails",
      steps: "Étapes",
      amount: "Montant (€)",
      important: "Important",
      urgent: "Urgente",
    };
    root.querySelectorAll("input,textarea,select").forEach(function (input) {
      if (input.closest("label")) return;
      var label = document.createElement("label");
      label.textContent =
        labels[input.name] || input.placeholder || "Recherche";
      label.className = input.classList.contains("full") ? "full" : "";
      input.before(label);
      label.appendChild(input);
    });
    root.querySelectorAll("[data-del]").forEach(function (button) {
      button.setAttribute("aria-label", "Supprimer cet élément");
    });
    root.querySelectorAll("[data-toggle]").forEach(function (button) {
      button.setAttribute(
        "aria-label",
        button.dataset.toggle === "task"
          ? "Terminer ou rouvrir la tâche"
          : "Cocher ou décocher l’habitude",
      );
      button.setAttribute("aria-pressed", String(button.textContent === "✓"));
    });
  }
  function openForm(kind, extra) {
    var map = {
      task: [
        "Nouvelle tâche",
        '<input name="title" required><input name="due" type="date"><input name="project" value="Personnel"><label><input name="important" type="checkbox"> Important</label><label><input name="urgent" type="checkbox"> Urgente</label><textarea name="details" class="full"></textarea>',
      ],
      note: [
        "Nouvelle note",
        '<input name="title" required><input name="tags"><textarea name="body" class="full"></textarea>',
      ],
      event: [
        "Nouvel événement",
        '<input name="title" placeholder="Titre" required><input name="date" type="date" value="' +
          day() +
          '"><input name="time" type="time"><select name="category"><option>Personnel</option><option>Travail</option><option>Santé</option></select>',
      ],
      goal: [
        "Nouvel objectif",
        '<input name="title" placeholder="Objectif" required><select name="area"><option>Personnel</option><option>Travail</option><option>Santé</option><option>Finances</option><option>Apprentissage</option></select><input name="date" type="date"><input name="progress" type="number" min="0" max="100" value="0">',
      ],
      habit: [
        "Nouvelle habitude",
        '<input name="name" placeholder="Habitude" required><input name="target" type="number" min="1" value="1"><input name="unit" value="fois"><input name="time" type="time">',
      ],
      routine: [
        "Nouvelle routine",
        '<input name="name" placeholder="Routine" required><input name="time" type="time"><textarea name="steps" class="full" placeholder="Étapes séparées par des virgules"></textarea>',
      ],
      workout: [
        "Nouvelle séance",
        '<input name="type" placeholder="Type de séance" required><input name="date" type="date" value="' +
          day() +
          '"><input name="minutes" type="number" min="1" value="45"><input name="effort" type="number" min="1" max="10" value="6">',
      ],
      track: [
        "Nouvelle mesure",
        '<select name="kind"><option>Poids</option><option>Sommeil</option><option>Hydratation</option><option>Humeur</option><option>Énergie</option><option>Stress</option><option>Focus</option></select><input name="value" type="number" step="0.1" required><input name="unit" placeholder="kg, h, ml, /5, min"><input name="date" type="date" value="' +
          day() +
          '">',
      ],
      life: [
        "Capture Life OS",
        '<select name="domain">' +
          LIFE.map(function (x) {
            return "<option>" + esc(x) + "</option>";
          }).join("") +
          '</select><input name="title" placeholder="Élément" required><select name="status"><option>Idée</option><option>En cours</option><option>En attente</option><option>Terminé</option></select><textarea name="details" class="full" placeholder="Contexte et prochaine étape"></textarea>',
      ],
      finance: [
        "Mouvement financier",
        '<input name="label" placeholder="Libellé" required><input name="amount" type="number" step="0.01" placeholder="Positif = revenu, négatif = dépense" required><input name="category" placeholder="Catégorie"><input name="date" type="date" value="' +
          day() +
          '">',
      ],
      document: [
        "Document",
        '<input name="title" placeholder="Nom du document" required><input name="category" placeholder="Catégorie"><input name="date" type="date"><textarea name="details" class="full" placeholder="Notes, emplacement, renouvellement"></textarea>',
      ],
      asset: [
        "Maison / équipement",
        '<input name="title" placeholder="Équipement ou entretien" required><input name="category" placeholder="Catégorie"><input name="date" type="date"><textarea name="details" class="full" placeholder="Garantie, entretien, notes"></textarea>',
      ],
      automation: [
        "Idée d’automatisation",
        '<input name="title" placeholder="Nom de la règle" required><input name="category" placeholder="Déclencheur"><textarea name="details" class="full" placeholder="Décrire une idée (aucune exécution automatique)"></textarea>',
      ],
    };
    if (kind === "task")
      map.task[1] +=
        '<label>Durée estimée (min)<input name="estimate" type="number" min="1" value="25"></label><label>Fiche Life OS liée<select name="osSourceId"><option value="">Aucune</option>' +
        state.os
          .filter((x) => !x.deleted || x.id === extra?.osSourceId)
          .map(
            (x) =>
              '<option value="' + esc(x.id) + '">' + esc(x.title) + "</option>",
          )
          .join("") +
        "</select></label>";
    if (kind === "finance")
      map.finance[1] +=
        '<label>Compte<select name="accountId"><option value="">Non affecté</option>' +
        state.os
          .filter(
            (x) =>
              x.kind === "account" && (!x.deleted || x.id === extra?.accountId),
          )
          .map(
            (x) =>
              '<option value="' + esc(x.id) + '">' + esc(x.title) + "</option>",
          )
          .join("") +
        "</select></label>";
    var m = map[kind];
    if (!m) return;
    modal(extra ? "Modifier · " + m[0] : m[0], form(m[1], kind + "-form"));
    if (extra) {
      editing = {
        key: Object.keys(kinds).find(function (key) {
          return kinds[key] === kind;
        }),
        id: extra.id,
      };
      var f = document.getElementById(kind + "-form");
      Object.keys(extra).forEach(function (key) {
        var input = f.elements.namedItem(key);
        if (!input) return;
        if (input.type === "checkbox") input.checked = !!extra[key];
        else input.value = extra[key] == null ? "" : String(extra[key]);
      });
    }
  }
  root.addEventListener("click", function (e) {
    if (!(e.target instanceof Element)) return;
    // The backdrop closes only when it is the direct target, never for an input inside it.
    if (e.target.classList.contains("modal-wrap")) {
      closeModal();
      return;
    }
    var t = e.target.closest("button");
    if (!t) return;
    if (t.dataset.close) {
      closeModal();
      return;
    }
    if (t.dataset.screen) {
      navigate(t.dataset.screen);
      return;
    }
    if (t.dataset.tab) {
      planTab = t.dataset.tab;
      render();
      return;
    }
    if (t.dataset.create) {
      openForm(t.dataset.create);
      if (t.dataset.domain) {
        var select = document.querySelector(".modal [name=domain]");
        if (select) select.value = t.dataset.domain;
      }
      return;
    }
    if (os.handleClick(t)) return;
    if (t.dataset.edit === "os") {
      var osRecord = state.os.find((x) => x.id === t.dataset.id);
      if (osRecord) os.edit(osRecord.kind, osRecord);
      return;
    }
    if (t.dataset.edit) {
      var record = state[t.dataset.edit]?.find(function (x) {
        return x.id === t.dataset.id;
      });
      if (record) openForm(kinds[t.dataset.edit], record);
      return;
    }
    if (t.dataset.restore) {
      var removed = state[t.dataset.restore]?.find(function (x) {
        return x.id === t.dataset.id;
      });
      if (removed) {
        removed.deleted = false;
        if (save()) {
          render();
          trash();
          toast("Élément rétabli");
        }
      }
      return;
    }
    if (t.dataset.del) {
      var item = state[t.dataset.del]?.find(function (x) {
        return x.id === t.dataset.id;
      });
      if (!item) return;
      item.deleted = true;
      if (save()) {
        render();
        toast("Élément retiré. Retrouve-le dans les éléments retirés.");
      }
      return;
    }
    if (t.dataset.toggle === "task") {
      var task = state.tasks.find(function (x) {
        return x.id === t.dataset.id;
      });
      if (task) {
        task.done = !task.done;
        task.completedAt = task.done ? new Date().toISOString() : null;
        if (save()) render();
      }
      return;
    }
    if (t.dataset.toggle === "habit") {
      var habit = state.habits.find(function (x) {
        return x.id === t.dataset.id;
      });
      if (habit) {
        habit.days = Object.assign({}, habit.days || {});
        habit.days[day()] = !habit.days[day()];
        if (save()) render();
      }
      return;
    }
    if (t.dataset.life) {
      os.open(t.dataset.life);
      return;
    }
    var a = t.dataset.action;
    if (a === "quick") quick();
    else if (a === "settings") settings();
    else if (a === "trash") trash();
    else if (a === "search") search();
    else if (a === "add-note") openForm("note");
    else if (a === "add-event") openForm("event");
    else if (a === "add-goal") openForm("goal");
    else if (a === "add-habit") openForm("habit");
    else if (a === "add-routine") openForm("routine");
    else if (a === "add-workout") openForm("workout");
    else if (a === "track") openForm("track");
    else if (a === "life-entry") openForm("life");
    else if (["finance", "document", "asset", "automation"].includes(a))
      openForm(a);
    else if (a === "export")
      download(Q.backup(state), "quotidien-backup-" + day() + ".json");
    else if (a === "export-draft" && draft)
      download(
        Q.backup(draft),
        "quotidien-saisie-non-enregistree-" + day() + ".json",
      );
    else if (a === "theme") {
      state.settings.theme = state.settings.theme === "dark" ? "light" : "dark";
      if (save()) {
        render();
        settings();
      }
    } else if (a === "restore" || a === "checkpoint") {
      try {
        var raw = localStorage.getItem(
          a === "restore" ? Q.BACKUP_KEY : Q.CHECKPOINT_KEY,
        );
        if (!raw) throw new Error("Aucune copie disponible.");
        importPreview(Q.parseBackup(raw));
      } catch (err) {
        showError(err.message);
      }
    } else if (a === "import") {
      var i = document.createElement("input");
      i.type = "file";
      i.accept = ".json,application/json";
      i.onchange = function () {
        var file = i.files && i.files[0];
        if (!file) return;
        if (file.size > 20 * 1024 * 1024) {
          showError("Fichier trop volumineux (20 Mo maximum).");
          return;
        }
        var reader = new FileReader();
        reader.onerror = function () {
          showError("Lecture du fichier impossible.");
        };
        reader.onload = function () {
          try {
            importPreview(Q.parseBackup(String(reader.result)));
          } catch (err) {
            showError("Import refusé : " + err.message);
          }
        };
        reader.readAsText(file);
      };
      i.click();
    } else if (a === "confirm-import" && pendingImport) {
      state = Q.clone(pendingImport);
      if (save(true)) {
        closeModal();
        render();
        toast("Sauvegarde restaurée");
      }
    } else if (a === "clear") {
      modal(
        "Réinitialiser les données",
        '<p>Une copie sera conservée avant le remplacement. Tu peux aussi exporter tes données avant cette action.</p><button class="mini" data-action="export">Exporter mes données</button><button class="primary" data-action="confirm-clear">Confirmer la réinitialisation</button>',
      );
    } else if (a === "confirm-clear") {
      state = Q.empty();
      if (save(true)) {
        closeModal();
        render();
        toast("Données réinitialisées ; copie conservée");
      }
    }
  });
  root.addEventListener("submit", function (e) {
    e.preventDefault();
    var f = e.target;
    if (!(f instanceof HTMLFormElement) || !f.reportValidity()) return;
    if (os.submit(f)) return;
    var d = Object.fromEntries(new FormData(f).entries());
    Object.keys(d).forEach(function (key) {
      if (typeof d[key] === "string") d[key] = d[key].trim();
    });
    if (
      ["title", "name", "label"].some(function (key) {
        var input = f.elements.namedItem(key);
        return input && input.required && !d[key];
      })
    ) {
      showError("Renseigne un titre ou un nom non vide.");
      return;
    }
    var kind = f.id.replace("inline-", "").replace("-form", ""),
      key = Object.keys(kinds).find(function (k) {
        return kinds[k] === kind;
      });
    if (!key) return;
    var original =
      editing &&
      state[key].find(function (x) {
        return x.id === editing.id;
      });
    var obj = Object.assign(
      { id: id(), createdAt: new Date().toISOString() },
      original || {},
      d,
      { updatedAt: new Date().toISOString() },
    );
    if (kind === "task") {
      obj.important = !!f.elements.namedItem("important").checked;
      obj.urgent = !!f.elements.namedItem("urgent").checked;
      obj.done = original ? original.done : false;
    }
    if (kind === "habit") obj.days = original ? original.days || {} : {};
    if (original)
      state[key] = state[key].map(function (x) {
        return x.id === original.id ? obj : x;
      });
    else state[key].unshift(obj);
    if (save()) {
      closeModal();
      render();
      toast("Enregistré");
    }
  });
  root.addEventListener("input", function (e) {
    os.inputEvent(e.target);
    if (e.target.id === "global-search") searchResults(e.target.value);
  });
  root.addEventListener("change", function (e) {
    os.changeEvent(e.target);
  });
  function navigate(screen) {
    if (!Q.screens.includes(screen)) screen = "today";
    state.screen = screen;
    closeModal();
    render();
    if (location.hash !== "#" + screen) location.hash = screen;
    window.scrollTo(0, 0);
  }
  window.addEventListener("hashchange", function () {
    if (bootError) return;
    if (os.route(location.hash)) {
      state.screen = "life";
      closeModal();
      render();
      return;
    }
    var screen = Q.screens.includes(location.hash.slice(1))
      ? location.hash.slice(1)
      : "today";
    if (screen !== state.screen) navigate(screen);
  });
  document.addEventListener("keydown", function (e) {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
      e.preventDefault();
      if (!bootError) search();
      return;
    }
    var dialog = document.querySelector(".modal");
    if (!dialog) return;
    if (e.key === "Escape") {
      e.preventDefault();
      closeModal();
      return;
    }
    if (e.key === "Tab") {
      var controls = Array.from(
        dialog.querySelectorAll('button,input,select,textarea,[tabindex="0"]'),
      ).filter(function (el) {
        return !el.disabled && !el.hidden;
      });
      var first = controls[0],
        last = controls[controls.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last?.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first?.focus();
      }
    }
  });
  window.addEventListener("storage", function (e) {
    if (e.key === KEY && !bootError)
      showError(
        "Données modifiées dans un autre onglet. Termine ou exporte ta saisie, puis recharge pour utiliser la dernière version.",
      );
  });
  window.addEventListener("pageshow", function (e) {
    if (e.persisted && !bootError) {
      if (document.querySelector(".modal")) return;
      try {
        repository = new Q.Repository(localStorage);
        state = repository.load();
        committed = Q.clone(state);
        render();
      } catch (err) {
        recovery(err);
      }
    }
  });
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker
      .getRegistrations()
      .then(function (registrations) {
        var scope = new URL("./", location.href).href;
        return Promise.all(
          registrations
            .filter(function (r) {
              return r.scope === scope;
            })
            .map(function (r) {
              return r.unregister();
            }),
        );
      })
      .catch(function () {
        /* Optional cleanup must never prevent opening the application. */
      });
  }
  if (bootError) recovery(bootError);
  else {
    if (location.hash)
      state.screen = Q.screens.includes(location.hash.slice(1))
        ? location.hash.slice(1)
        : "today";
    if (os.route(location.hash)) state.screen = "life";
    render();
  }
})();

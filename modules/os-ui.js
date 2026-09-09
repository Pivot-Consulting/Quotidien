/* Domain workspaces. All changes go through the application's existing repository. */
function createLifeOS(ctx) {
  "use strict";
  const O = Q.OS,
    e = ctx.esc;
  let selected = "",
    selectedType = "",
    filter = "",
    query = "",
    period = Q.day(),
    editingId = null,
    editType = "",
    pendingRules = [],
    pendingCSV = [];
  const state = () => ctx.state();
  const rs = (kind) => O.rows(state(), kind);
  const num = O.n;
  const format = (value) =>
    new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 }).format(value);
  const euro = (value) =>
    new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency: "EUR",
    }).format(value === 0 ? 0 : value);
  const dateText = (value) =>
    value
      ? new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium" }).format(
          new Date(value + "T12:00:00"),
        )
      : "Sans date";
  const lookup = (id) => state().os.find((r) => r.id === id);
  const refTitle = (id) => lookup(id)?.title || "Non lié";
  const button = (action, label, attrs = "", cls = "mini") =>
    `<button class="${cls}" data-os="${action}" ${attrs}>${e(label)}</button>`;
  const metric = (label, value, detail = "") =>
    `<div class="kpi"><strong>${e(value)}</strong><span>${e(label)}</span>${detail ? `<small>${e(detail)}</small>` : ""}</div>`;
  const line = (title, value, note = "", id = "") =>
    `<div class="os-insight"><div>${id ? button("edit", title, `data-id="${e(id)}"`, "text-button") : `<strong>${e(title)}</strong>`}${note ? `<p class="meta">${e(note)}</p>` : ""}</div><strong>${e(value)}</strong></div>`;
  const progress = (label, value, detail = "") =>
    `<div class="os-progress"><div><strong>${e(label)}</strong><span>${e(detail || format(value) + " %")}</span></div><progress max="100" value="${O.clamp(value)}" aria-label="${e(label)}"></progress></div>`;
  const noData = (text) => `<p class="empty">${e(text)}</p>`;
  const statusOptions = ["Idée", "En cours", "En attente", "Terminé"];
  const latest = (kind, key = "date") =>
    [...rs(kind)].sort(
      (a, b) =>
        String(b[key] || "").localeCompare(String(a[key] || "")) ||
        String(b.createdAt || "").localeCompare(String(a.createdAt || "")),
    );
  const monthRows = (kind, key = "date") =>
    rs(kind).filter((r) => String(r[key] || "").startsWith(period.slice(0, 7)));
  function overview() {
    return `<div class="page-title"><div><span class="eyebrow">TON SYSTÈME PERSONNEL</span><h1>Les 20 Life OS</h1><p class="meta">Des espaces reliés pour organiser, mesurer et avancer.</p></div>${button("legacy", "＋ Capture libre")}</div><section class="life-grid">${O.domains
      .map((d) => {
        const count = state().os.filter(
          (r) => !r.deleted && O.domainFor(r.kind)?.id === d.id,
        ).length;
        return `<article class="life-card"><span class="os-symbol" aria-hidden="true">${e(d.icon)}</span><h2>${e(d.name)}</h2><p>${e(d.description)}</p><div class="os-card-footer"><small>${count} fiche${count > 1 ? "s" : ""}</small>${button("open", "Ouvrir", `data-domain="${d.id}"`)}</div></article>`;
      })
      .join("")}</section>${legacyPanel()}`;
  }
  function legacyPanel(domain) {
    const captures = state().life.filter(
      (r) => !r.deleted && (!domain || r.domain === domain.name),
    );
    const keys =
      domain?.id === "finance"
        ? ["finances"]
        : domain?.id === "documents"
          ? ["documents"]
          : domain?.id === "home"
            ? ["assets"]
            : domain?.id === "health"
              ? ["health", "workouts"]
              : domain?.id === "projects"
                ? ["goals"]
                : domain?.id === "automation"
                  ? ["automations"]
                  : [];
    const labels = {
      finances: "Mouvements financiers",
      documents: "Documents déjà enregistrés",
      assets: "Équipements déjà enregistrés",
      health: "Mesures de santé",
      workouts: "Séances de sport",
      goals: "Objectifs existants",
      automations: "Idées de règles",
    };
    let html = captures.length
      ? `<details class="card os-legacy"><summary>Captures libres conservées (${captures.length})</summary>${ctx.listLife(captures)}</details>`
      : "";
    for (const key of keys) {
      const data = state()[key].filter((r) => !r.deleted);
      html += `<section class="card os-legacy"><div class="section-head"><h2>${labels[key]}</h2><div class="os-actions"><button class="mini" data-create="${ctx.kinds[key]}">＋ Ajouter</button>${key === "finances" ? button("csv", "Importer CSV") : ""}</div></div>${data.length ? data.map((r) => `<div class="os-insight"><button class="text-button" data-edit="${key}" data-id="${e(r.id)}">${e(r.title || r.label || r.kind || r.type)} · ${e(r.date || "")}</button><span>${key === "finances" ? e(euro(Number(r.amount))) : ""}</span></div>`).join("") : noData("Tes données de cet espace apparaîtront ici.")}</section>`;
    }
    return html;
  }
  function dashboard(d) {
    const s = state(),
      today = period,
      month = period.slice(0, 7);
    let k = [],
      body = "";
    const remaining = (kind) => rs(kind).filter((r) => !O.done(r));
    const late = (kind) =>
      remaining(kind).filter((r) => r.due && r.due < today);
    if (d.id === "finance") {
      const tx = s.finances.filter((r) => !r.deleted),
        current = tx.filter((r) => String(r.date || "").startsWith(month));
      const income = O.sum(
          current.filter((r) => Number(r.amount) > 0),
          "amount",
        ),
        expense = -O.sum(
          current.filter((r) => Number(r.amount) < 0),
          "amount",
        );
      const holdings = rs("holding");
      k = [
        metric("Revenus du mois", euro(income)),
        metric("Dépenses du mois", euro(expense)),
        metric("Solde des flux du mois", euro(income - expense)),
        metric(
          "Patrimoine net déclaré",
          euro(
            O.sum(
              holdings.filter((r) => r.assetType === "Actif"),
              "valuation",
            ) -
              O.sum(
                holdings.filter((r) => r.assetType === "Dette"),
                "valuation",
              ),
          ),
          "Valeurs saisies, comptes non ajoutés automatiquement",
        ),
      ];
      body += rs("account")
        .map((r) =>
          line(
            r.title,
            euro(
              num(r, "opening") +
                O.sum(
                  tx.filter((t) => t.accountId === r.id),
                  "amount",
                ),
            ),
            "Solde initial + mouvements liés",
            r.id,
          ),
        )
        .join("");
      body += rs("budget")
        .filter((r) => r.month === month)
        .map((r) => {
          const spent = -O.sum(
            current.filter(
              (t) =>
                Number(t.amount) < 0 &&
                String(t.category || "")
                  .trim()
                  .toLocaleLowerCase("fr") ===
                  String(r.category).trim().toLocaleLowerCase("fr"),
            ),
            "amount",
          );
          return progress(
            r.title,
            num(r, "limit") ? (spent / num(r, "limit")) * 100 : 0,
            `${euro(spent)} / ${euro(num(r, "limit"))} · reste ${euro(num(r, "limit") - spent)}`,
          );
        })
        .join("");
      body += line(
        "Abonnements actifs",
        euro(remaining("subscription").reduce((v, r) => v + O.annual(r), 0)) +
          "/an",
        "Estimation annualisée : mois × 12, semaine × 52 ; ne crée pas de mouvements.",
      );
      const months = Array.from({ length: 6 }, (_, i) => {
        const dt = new Date(period + "T12:00:00");
        dt.setDate(1);
        dt.setMonth(dt.getMonth() - 5 + i);
        return Q.day(dt).slice(0, 7);
      });
      body +=
        `<details><summary>Flux sur six mois</summary>` +
        months
          .map((m) =>
            line(
              m,
              euro(
                O.sum(
                  tx.filter((t) => String(t.date).startsWith(m)),
                  "amount",
                ),
              ),
            ),
          )
          .join("") +
        "</details>";
    } else if (d.id === "projects") {
      k = [
        metric("Projets actifs", remaining("project").length),
        metric("Jalons terminés", rs("milestone").filter(O.done).length),
        metric("Jalons en retard", late("milestone").length),
      ];
      body = rs("project")
        .map((r) => {
          const tasks = s.tasks.filter(
            (t) => !t.deleted && t.osSourceId === r.id,
          );
          return (
            progress(r.title, O.projectProgress(s, r.id)) +
            line(
              "Budget restant",
              euro(num(r, "budget") - num(r, "spent")),
              `${tasks.filter((t) => t.done).length}/${tasks.length} actions terminées · jalons pondérés`,
            )
          );
        })
        .join("");
    } else if (d.id === "learning") {
      k = [
        metric(
          "Étude ce mois",
          format(O.sum(monthRows("study"), "minutes") / 60) + " h",
        ),
        metric(
          "Cartes à revoir",
          remaining("flashcard").filter((r) => !r.due || r.due <= today).length,
        ),
        metric("Parcours actifs", remaining("course").length),
      ];
      body = rs("course")
        .map((r) => {
          const hours =
            O.sum(
              rs("study").filter((x) => x.courseId === r.id),
              "minutes",
            ) / 60;
          return progress(
            r.title,
            num(r, "targetHours") ? (hours / num(r, "targetHours")) * 100 : 0,
            `${format(hours)} / ${format(num(r, "targetHours"))} h · contenu ${num(r, "progress")} %`,
          );
        })
        .join("");
      body += remaining("flashcard")
        .filter((r) => !r.due || r.due <= today)
        .map(
          (r) =>
            `<div class="os-insight"><strong>${e(r.title)}</strong>${button("review", "Réviser", `data-id="${e(r.id)}"`)}</div>`,
        )
        .join("");
    } else if (d.id === "documents") {
      const soon = remaining("document").filter(
        (r) => r.due && r.due >= today && r.due <= O.addDays(today, 30),
      );
      k = [
        metric("Documents", rs("document").length),
        metric("Expirés", late("document").length),
        metric("À renouveler sous 30 jours", soon.length),
      ];
      body = [...late("document"), ...soon, ...late("procedure")]
        .map((r) => line(r.title, dateText(r.due), "Échéance à traiter", r.id))
        .join("");
    } else if (d.id === "home") {
      k = [
        metric(
          "Valeur de l’inventaire",
          euro(O.sum(rs("equipment"), "valuation")),
        ),
        metric("Entretiens en retard", late("maintenance").length),
        metric(
          "Coût des entretiens ouverts",
          euro(O.sum(remaining("maintenance"), "cost")),
        ),
      ];
      body = rs("equipment")
        .filter((r) => r.warranty)
        .map((r) =>
          line(
            r.title,
            dateText(r.warranty),
            r.warranty < today ? "Garantie échue" : "Fin de garantie",
            r.id,
          ),
        )
        .join("");
    } else if (d.id === "nutrition") {
      const meals = rs("meal").filter((r) => r.date === today),
        target = latest("nutritionTarget").find(
          (r) => r.date && r.date <= today,
        );
      k = [
        metric("Énergie du jour", format(O.sum(meals, "calories")) + " kcal"),
        metric("Protéines", format(O.sum(meals, "protein")) + " g"),
        metric("Hydratation", format(O.sum(meals, "water")) + " ml"),
      ];
      body = line(
        "Glucides / lipides",
        `${format(O.sum(meals, "carbs"))} g / ${format(O.sum(meals, "fat"))} g`,
        "Valeurs saisies pour les portions consommées.",
      );
      if (target)
        for (const [key, label] of [
          ["calories", "Énergie"],
          ["protein", "Protéines"],
          ["water", "Eau"],
        ])
          body += progress(
            label,
            num(target, key) ? (O.sum(meals, key) / num(target, key)) * 100 : 0,
            `${format(O.sum(meals, key))} / ${format(num(target, key))}`,
          );
      else
        body += noData(
          "Ajoute tes propres objectifs quotidiens pour comparer tes apports.",
        );
    } else if (d.id === "health") {
      const sleeps = rs("sleep").filter(
          (r) => r.date <= today && r.date >= O.addDays(today, -6),
        ),
        observations = rs("symptom").filter(
          (r) => r.date <= today && r.date >= O.addDays(today, -6),
        );
      k = [
        metric(
          "Sommeil moyen · 7 jours",
          sleeps.length
            ? format(O.sum(sleeps, "hours") / sleeps.length) + " h"
            : "—",
          sleeps.length + " nuits renseignées",
        ),
        metric("Observations · 7 jours", observations.length),
        metric(
          "Rendez-vous à venir",
          remaining("appointment").filter((r) => r.due >= today).length,
        ),
      ];
      body =
        latest("symptom")
          .slice(0, 8)
          .map((r) =>
            line(
              r.title,
              num(r, "severity") + "/10",
              dateText(r.date) + " · " + String(r.context || ""),
              r.id,
            ),
          )
          .join("") +
        '<p class="meta">Ce carnet conserve tes observations et prépare tes rendez-vous. Il ne fournit ni diagnostic ni conseil de traitement.</p>';
    } else if (d.id === "relations") {
      const contacts = rs("contact");
      let count = 0;
      body = contacts
        .map((r) => {
          const last =
            latest("interaction").find(
              (x) => x.contactId === r.id && x.date <= today,
            )?.date || r.date;
          const elapsed = last ? O.daysBetween(String(last), today) : null;
          const needs = elapsed === null || elapsed >= num(r, "cadence");
          if (needs) count++;
          return line(
            r.title,
            needs ? "Reprendre contact" : "À jour",
            last
              ? "Dernier échange " + dateText(last)
              : "Aucun échange enregistré",
            r.id,
          );
        })
        .join("");
      const birthdays = contacts.filter(
        (r) => r.birthday && String(r.birthday).slice(5, 7) === month.slice(5),
      );
      k = [
        metric("Contacts", contacts.length),
        metric("À recontacter", count),
        metric("Anniversaires ce mois", birthdays.length),
      ];
      body += birthdays
        .map((r) =>
          line(
            "Anniversaire · " + r.title,
            String(r.birthday).slice(8) + "/" + String(r.birthday).slice(5, 7),
            "",
            r.id,
          ),
        )
        .join("");
    } else if (d.id === "travel") {
      k = [
        metric("Voyages ouverts", remaining("trip").length),
        metric("Réservations", rs("booking").length),
        metric("Préparatifs restants", remaining("packing").length),
      ];
      body = rs("trip")
        .map((r) => {
          const bookings = rs("booking")
            .filter((b) => b.tripId === r.id)
            .sort(
              (a, b) =>
                String(a.date).localeCompare(String(b.date)) ||
                String(a.time || "").localeCompare(String(b.time || "")),
            );
          return (
            `<h3>${e(r.title)} · ${e(r.destination)}</h3>` +
            line(
              "Budget restant",
              euro(num(r, "budget") - O.sum(bookings, "cost")),
              dateText(r.date) + " → " + dateText(r.end),
            ) +
            bookings
              .map((b) =>
                line(
                  b.title,
                  euro(num(b, "cost")),
                  dateText(b.date) +
                    " " +
                    String(b.time || "") +
                    " · " +
                    String(b.location || ""),
                  b.id,
                ),
              )
              .join("")
          );
        })
        .join("");
    } else if (d.id === "career") {
      k = [
        metric("Candidatures", rs("application").length),
        metric(
          "Entretiens",
          rs("application").filter((r) => r.stage === "Entretien").length,
        ),
        metric(
          "Offres / acceptées",
          rs("application").filter((r) =>
            ["Offre", "Acceptée"].includes(r.stage),
          ).length,
        ),
      ];
      body = [
        "À explorer",
        "Envoyée",
        "Entretien",
        "Offre",
        "Refus",
        "Acceptée",
      ]
        .map((stage) =>
          line(
            stage,
            rs("application").filter((r) => r.stage === stage).length,
          ),
        )
        .join("");
      body += rs("careerSkill")
        .map((r) =>
          progress(
            r.title,
            num(r, "desired")
              ? (num(r, "current") / num(r, "desired")) * 100
              : 0,
            `${num(r, "current")} / ${num(r, "desired")}`,
          ),
        )
        .join("");
    } else if (d.id === "decisions") {
      k = [
        metric("Décisions ouvertes", remaining("decision").length),
        metric("Options comparées", rs("option").length),
        metric("Bilans", rs("decisionReview").length),
      ];
      body = rs("decision")
        .map(
          (r) =>
            `<h3>${e(r.title)}</h3><p class="meta">Poids bénéfice / coût faible / risque faible : ${num(r, "benefitWeight")} / ${num(r, "costWeight")} / ${num(r, "riskWeight")}</p>` +
            O.decisionScores(s, r.id)
              .map((x, i) =>
                line(
                  `${i + 1}. ${x.record.title}`,
                  format(x.score) + "/10",
                  String(x.record.evidence || ""),
                  x.record.id,
                ),
              )
              .join(""),
        )
        .join("");
    } else if (d.id === "journal") {
      const entries = monthRows("journal");
      const days = new Set(rs("journal").map((r) => r.date));
      let streak = 0;
      let cursor = days.has(today) ? today : O.addDays(today, -1);
      while (days.has(cursor)) {
        streak++;
        cursor = O.addDays(cursor, -1);
      }
      k = [
        metric(
          "Jours écrits ce mois",
          new Set(entries.map((r) => r.date)).size,
        ),
        metric("Série actuelle", streak + " j"),
        metric(
          "Humeur moyenne",
          entries.length
            ? format(O.sum(entries, "mood") / entries.length) + "/10"
            : "—",
        ),
      ];
      body = latest("journal")
        .slice(0, 7)
        .map((r) =>
          line(
            r.title,
            num(r, "mood") + "/10",
            dateText(r.date) + " · " + String(r.wins || r.gratitude || ""),
            r.id,
          ),
        )
        .join("");
    } else if (d.id === "automation") {
      const suggestions = O.proposals(s, today);
      k = [
        metric(
          "Règles actives",
          remaining("rule").filter((r) => r.enabled === "Active").length,
        ),
        metric("Actions proposées", suggestions.length),
        metric(
          "Actions déjà créées",
          s.tasks.filter((t) => t.automationToken && !t.deleted).length,
        ),
      ];
      body =
        "<p>Les règles s’exécutent uniquement lorsque tu les lances. Examine les tâches proposées avant de les ajouter ; une même règle ne recrée pas la même échéance.</p>" +
        button("rules-preview", "Prévisualiser les actions", "", "primary");
    } else if (d.id === "assistant") {
      const plan = O.dayPlan(s, today);
      k = [
        metric("Capacité du jour", plan.capacity + " min"),
        metric("Plan proposé", plan.used + " min"),
        metric("Autres tâches éligibles", plan.remaining),
      ];
      body =
        '<p class="meta">Plan calculé localement à partir de tes tâches non terminées, sans échéance ou dues à cette date. Estimation par défaut : 25 minutes. Aucun service d’IA connecté.</p>' +
        plan.tasks
          .map(
            (r) =>
              `<div class="os-insight"><button class="text-button" data-edit="tasks" data-id="${e(r.id)}">${e(r.title)}</button><span>${num(r, "estimate") || 25} min</span></div>`,
          )
          .join("") +
        button("weekly", "Créer une note de bilan");
    } else if (d.id === "digital") {
      const logs = rs("screenTime").filter((r) => r.date === today);
      k = [
        metric("Temps d’écran saisi", O.sum(logs, "minutes") + " min"),
        metric(
          "Services à vérifier",
          rs("service").filter(
            (r) => r.mfa === "À vérifier" || r.mfa === "Désactivée",
          ).length,
        ),
        metric("Revues en retard", late("service").length),
      ];
      body =
        logs
          .map((r) =>
            progress(
              r.title,
              num(r, "limit") ? (num(r, "minutes") / num(r, "limit")) * 100 : 0,
              `${num(r, "minutes")} / ${num(r, "limit")} min`,
            ),
          )
          .join("") +
        '<p class="meta">Les durées sont saisies manuellement. Cet espace ne collecte pas l’activité de tes appareils.</p>';
    } else if (d.id === "security") {
      const risks = remaining("risk").sort(
        (a, b) =>
          num(b, "impact") * num(b, "likelihood") -
          num(a, "impact") * num(a, "likelihood"),
      );
      k = [
        metric("Risques ouverts", risks.length),
        metric(
          "Criticité ≥ 15/25",
          risks.filter((r) => num(r, "impact") * num(r, "likelihood") >= 15)
            .length,
        ),
        metric("Vérifications en retard", late("backupCheck").length),
      ];
      body =
        risks
          .map((r) =>
            line(
              r.title,
              num(r, "impact") * num(r, "likelihood") + "/25",
              String(r.mitigation || "Mesure de réduction à définir"),
              r.id,
            ),
          )
          .join("") +
        '<p class="meta">Registre de suivi uniquement : aucun scan de sécurité. Ne saisis pas de mots de passe, clés privées ou codes de récupération.</p>';
    } else if (d.id === "impact") {
      k = [
        metric("Engagements", rs("impactGoal").length),
        metric("Contributions ce mois", monthRows("contribution").length),
        metric(
          "Engagements atteints",
          rs("impactGoal").filter(
            (r) =>
              O.sum(
                rs("contribution").filter((x) => x.impactGoalId === r.id),
                "quantity",
              ) >= num(r, "targetValue"),
          ).length,
        ),
      ];
      body = rs("impactGoal")
        .map((r) => {
          const value = O.sum(
            rs("contribution").filter((x) => x.impactGoalId === r.id),
            "quantity",
          );
          return progress(
            r.title,
            num(r, "targetValue") ? (value / num(r, "targetValue")) * 100 : 0,
            `${format(value)} / ${format(num(r, "targetValue"))} ${r.unit || ""}`,
          );
        })
        .join("");
    } else if (d.id === "household") {
      k = [
        metric("Membres", rs("member").length),
        metric("Tâches ouvertes", remaining("chore").length),
        metric("Dépenses partagées", euro(O.sum(rs("sharedExpense"), "cost"))),
      ];
      body = O.balances(s)
        .map((r) =>
          line(
            r.title,
            euro(r.cents / 100),
            r.cents > 0
              ? "À recevoir"
              : r.cents < 0
                ? "À rembourser"
                : "Équilibré",
          ),
        )
        .join("");
      body +=
        "<h3>Remboursements proposés</h3>" +
        O.settlements(s)
          .map((r) => line(r.from + " → " + r.to, euro(r.cents / 100)))
          .join("") +
        '<p class="meta">Répartition à parts égales entre les participants de chaque dépense. Les virements ne sont pas exécutés.</p>';
      body += rs("member")
        .map((r) =>
          line(
            "Charge · " + r.title,
            O.sum(
              remaining("chore").filter((x) => x.memberId === r.id),
              "minutes",
            ) + " min",
          ),
        )
        .join("");
    } else if (d.id === "progress") {
      k = [
        metric("Indicateurs", rs("indicator").length),
        metric("Mesures", rs("measurement").length),
        metric(
          "Cibles atteintes",
          rs("indicator").filter(
            (r) => O.indicatorProgress(s, r).progress === 100,
          ).length,
        ),
      ];
      body = rs("indicator")
        .map((r) => {
          const p = O.indicatorProgress(s, r);
          return (
            progress(
              r.title,
              p.progress,
              `${format(p.value)} / ${format(num(r, "targetValue"))} ${r.unit || ""}`,
            ) +
            `<p class="meta">Départ ${format(num(r, "baseline"))} · historique : ${
              p.history
                .slice(-8)
                .map((x) =>
                  e(dateText(x.date) + " : " + format(num(x, "reading"))),
                )
                .join(" → ") || "aucune mesure"
            }</p>`
          );
        })
        .join("");
    } else if (d.id === "balance") {
      const entry = latest("energyDay").find((r) => r.date === today),
        ratings = latest("lifeRating").filter((r) => r.date <= today),
        areas = [...new Set(ratings.map((r) => r.area))];
      const current = areas.map((a) => ratings.find((r) => r.area === a));
      const margin = entry
        ? num(entry, "capacity") -
          num(entry, "obligations") -
          num(entry, "recovery")
        : null;
      k = [
        metric(
          "Marge après engagements et récupération",
          margin === null ? "—" : margin + " min",
        ),
        metric("Domaines évalués", areas.length),
        metric(
          "Satisfaction moyenne",
          current.length
            ? format(O.sum(current, "score") / current.length) + "/10"
            : "—",
        ),
      ];
      body = current
        .map((r) =>
          progress(
            r.area,
            num(r, "score") * 10,
            `${num(r, "score")}/10 · ${dateText(r.date)}`,
          ),
        )
        .join("");
      if (margin !== null && margin < 0)
        body +=
          '<p class="error">La journée dépasse le temps disponible de ' +
          -margin +
          " minutes. Ajuste les engagements dans ton bilan.</p>";
    }
    return `<section class="os-metrics">${k.join("")}</section><section class="card os-summary"><h2>Synthèse</h2>${body || noData("Ajoute tes premières fiches pour obtenir les calculs et les échéances de cet espace.")}</section>`;
  }
  function fieldValue(f, r) {
    const v = r[f.key];
    if (v === undefined || v === "") return "";
    if (f.type === "ref") return refTitle(v);
    if (f.type === "refs")
      return Array.isArray(v) ? v.map(refTitle).join(", ") : "";
    if (f.type === "number") return format(Number(v));
    if (f.type === "date") return dateText(v);
    return String(v);
  }
  function recordCard(r, m) {
    const fields = m.fields.filter(
      (f) => r[f.key] !== undefined && r[f.key] !== "" && f.key !== "answer",
    );
    const overdue = r.due && r.due < Q.day() && !O.done(r);
    const links = fields.filter((f) => f.type === "ref");
    return `<article class="card os-record"><div class="section-head"><h3>${button("edit", r.title, `data-id="${e(r.id)}"`, "text-button")}</h3><span class="tag ${overdue ? "os-late" : ""}">${e(overdue ? "En retard" : r.status)}</span></div><dl>${fields
      .filter((f) => !["textarea", "url", "ref"].includes(f.type))
      .slice(0, 6)
      .map(
        (f) =>
          `<div><dt>${e(f.label)}</dt><dd>${e(fieldValue(f, r))}</dd></div>`,
      )
      .join(
        "",
      )}</dl>${links.map((f) => `<p class="meta">${e(f.label)} : ${lookup(r[f.key]) ? button("edit", refTitle(r[f.key]), `data-id="${e(r[f.key])}"`, "text-button") : e("Référence indisponible")}</p>`).join("")}${r.details ? `<p class="os-excerpt">${e(r.details)}</p>` : ""}<div class="os-actions">${button("edit", "Ouvrir", `data-id="${e(r.id)}"`)}${r.kind === "flashcard" ? button("review", "Réviser", `data-id="${e(r.id)}"`) : ""}${button("task", "Créer une action", `data-id="${e(r.id)}"`)}${m.scheduled ? button("complete", r.kind === "subscription" ? "Avancer l’échéance" : O.done(r) ? "Rouvrir" : "Terminer", `data-id="${e(r.id)}"`) : ""}${button("duplicate", "Dupliquer", `data-id="${e(r.id)}"`)}<button class="danger" data-del="os" data-id="${e(r.id)}" aria-label="Retirer ${e(r.title)}">×</button></div></article>`;
  }
  function filteredRecords() {
    return rs(selectedType)
      .filter((r) => Q.Personal.visible(r))
      .filter(
        (r) =>
          (!filter || r.status === filter) &&
          [r.title, r.details, ...Q.Personal.tags(r)]
            .join(" ")
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .toLowerCase()
            .includes(
              query
                .normalize("NFD")
                .replace(/[\u0300-\u036f]/g, "")
                .toLowerCase(),
            ),
      )
      .sort(
        (a, b) =>
          String(a.due || a.date || "9999").localeCompare(
            String(b.due || b.date || "9999"),
          ) || String(b.createdAt).localeCompare(String(a.createdAt)),
      );
  }
  function recordList() {
    const m = O.getModel(selectedType);
    const records = filteredRecords();
    return records.length
      ? records.map((r) => recordCard(r, m)).join("")
      : noData(
          `Aucune fiche ${m.label.toLowerCase()}${query || filter ? " pour ces filtres" : ""}. Utilise « Ajouter » pour commencer.`,
        );
  }
  function view() {
    const d = O.domains.find((d) => d.id === selected);
    if (!d) return overview();
    if (!d.models.some((m) => m.id === selectedType))
      selectedType = d.models[0].id;
    return `<div class="os-breadcrumb">${button("home", "← Tous les OS")}<span>${e(d.name)}</span></div><div class="page-title"><div><span class="eyebrow">LIFE OS / ${e(d.icon)}</span><h1>${e(d.name)}</h1><p class="meta">${e(d.description)}</p></div><div class="os-header-actions">${button("new", "＋ Ajouter", `data-type="${selectedType}"`, "primary")}<label>Date de référence<input type="date" data-os-period value="${e(period)}"></label></div></div>${dashboard(d)}<section class="os-workspace"><div class="tabs os-tabs" role="tablist" aria-label="Sections ${e(d.name)}">${d.models.map((m) => `<button role="tab" aria-selected="${selectedType === m.id}" class="${selectedType === m.id ? "active" : ""}" data-os="type" data-type="${m.id}">${e(m.label)} <small>${rs(m.id).length}</small></button>`).join("")}</div><div class="os-toolbar"><label>Rechercher<input type="search" data-os-query value="${e(query)}" placeholder="Titre, détails…"></label><label>Statut<select data-os-filter><option value="">Tous</option>${statusOptions.map((x) => `<option ${x === filter ? "selected" : ""}>${e(x)}</option>`).join("")}</select></label><div class="os-actions">${button("export", "Exporter CSV")}</div></div><div class="os-records" id="os-records" role="tabpanel">${recordList()}</div></section>${legacyPanel(d)}`;
  }
  function input(f, r) {
    let v = r[f.key] ?? f.default ?? "";
    if (!r.id && v === "") {
      if (f.type === "date" && f.key === "date") v = Q.day();
      if (f.type === "month") v = Q.day().slice(0, 7);
      if (f.type === "number") v = f.min > 0 ? f.min : 0;
    }
    const attr = `name="${e(f.key)}" ${f.required ? "required" : ""}`;
    let html = "";
    if (f.type === "select")
      html = `<select ${attr}>${f.options.map((x) => `<option ${v === x ? "selected" : ""}>${e(x)}</option>`).join("")}</select>`;
    else if (f.type === "ref")
      html = `<select ${attr}><option value="">Choisir…</option>${state()
        .os.filter((x) => x.kind === f.ref && (!x.deleted || x.id === v))
        .map(
          (x) =>
            `<option value="${e(x.id)}" ${v === x.id ? "selected" : ""}>${e(x.title)}${x.deleted ? " (retiré)" : ""}</option>`,
        )
        .join(
          "",
        )}</select>${rs(f.ref).length ? "" : `<small>Crée d’abord une fiche dans « ${e(O.getModel(f.ref).label)} ».</small>`}`;
    else if (f.type === "refs")
      html = `<div class="os-checks">${
        state()
          .os.filter(
            (x) =>
              x.kind === f.ref &&
              (!x.deleted || (Array.isArray(v) && v.includes(x.id))),
          )
          .map(
            (x) =>
              `<label><input type="checkbox" name="${e(f.key)}" value="${e(x.id)}" ${Array.isArray(v) && v.includes(x.id) ? "checked" : ""}>${e(x.title)}</label>`,
          )
          .join("") || "<small>Ajoute d’abord les membres du foyer.</small>"
      }</div>`;
    else if (f.type === "textarea")
      html = `<textarea ${attr} rows="3">${e(v)}</textarea>`;
    else
      html = `<input ${attr} type="${f.type}" value="${e(v)}" ${f.type === "number" ? `step="any" ${f.min !== undefined ? `min="${f.min}"` : ""} ${f.max !== undefined ? `max="${f.max}"` : ""}` : ""}>`;
    return f.type === "refs"
      ? `<fieldset class="full"><legend>${e(f.label)}</legend>${html}</fieldset>`
      : `<label class="${f.type === "textarea" ? "full" : ""}">${e(f.label)}${html}</label>`;
  }
  function edit(kind, record) {
    const m = O.getModel(kind);
    if (!m) return;
    editingId = record?.id || null;
    editType = kind;
    const r = record || { title: "", status: "En cours" };
    const fields = [
      {
        key: "title",
        label: kind === "flashcard" ? "Question" : "Titre",
        type: "text",
        required: true,
      },
      {
        key: "status",
        label: "Statut",
        type: "select",
        options: statusOptions,
      },
      ...m.fields,
      { key: "details", label: "Notes et contexte", type: "textarea" },
    ];
    const related = record
      ? state().tasks.filter((t) => !t.deleted && t.osSourceId === record.id)
      : [];
    const urls = record
      ? m.fields
          .filter((f) => f.type === "url" && O.safeURL(record[f.key]))
          .map(
            (f) =>
              `<a class="mini" href="${e(O.safeURL(record[f.key]))}" target="_blank" rel="noopener noreferrer">${e(f.label)} ↗</a>`,
          )
          .join("")
      : "";
    ctx.modal(
      `${record ? "Modifier" : "Ajouter"} · ${m.label}`,
      `<form id="os-form" class="form">${fields.map((f) => input(f, r)).join("")}${ctx.commonFields(r)}<div class="full os-actions"><button class="primary" type="submit">Enregistrer</button>${urls}</div></form>${record ? ctx.commonFooter({ key: "os", id: record.id }) : ""}${related.length ? "<h3>Actions liées</h3>" + related.map((t) => `<p><button class="text-button" data-edit="tasks" data-id="${e(t.id)}">${t.done ? "✓ " : ""}${e(t.title)}</button></p>`).join("") : ""}`,
    );
    ctx.markClean();
  }
  function persist() {
    if (!ctx.save()) return false;
    ctx.close();
    ctx.render();
    ctx.toast("Enregistré");
    return true;
  }
  function review(r) {
    ctx.modal(
      "Réviser une carte",
      `<h3>${e(r.title)}</h3><details class="os-answer"><summary>Afficher la réponse</summary><p>${e(r.answer || "Réponse à compléter")}</p></details><p class="meta">Choisis après avoir tenté de retrouver la réponse.</p><div class="os-actions">${[
        ["again", "À revoir"],
        ["hard", "Difficile"],
        ["good", "Acquis"],
      ]
        .map(([q, label]) =>
          button("grade", label, `data-id="${e(r.id)}" data-grade="${q}"`),
        )
        .join("")}</div>`,
    );
  }
  function route(hash) {
    const parts = hash.replace(/^#/, "").split("/");
    if (parts[0] !== "life") return false;
    const domain = O.domains.find((d) => d.id === parts[1]);
    const nextDomain = domain?.id || "";
    const nextType =
      domain?.models.find((m) => m.id === parts[2])?.id ||
      domain?.models[0]?.id ||
      "";
    if (selected !== nextDomain || selectedType !== nextType) {
      query = "";
      filter = "";
    }
    selected = nextDomain;
    selectedType = nextType;
    return true;
  }
  function open(domain) {
    selected =
      O.domains.find((d) => d.id === domain || d.name === domain)?.id || "";
    selectedType = "";
    query = "";
    filter = "";
    state().screen = "life";
    ctx.close();
    ctx.render();
    history.pushState(null, "", "#life" + (selected ? "/" + selected : ""));
  }
  function handleClick(t) {
    const action = t.dataset.os;
    if (!action) return false;
    const r = lookup(t.dataset.id);
    if (action === "open") open(t.dataset.domain);
    else if (action === "home") open("");
    else if (action === "legacy") ctx.openForm("life");
    else if (action === "type") {
      selectedType = t.dataset.type;
      query = "";
      filter = "";
      ctx.render();
      history.pushState(null, "", "#life/" + selected + "/" + selectedType);
    } else if (action === "new") edit(t.dataset.type);
    else if (action === "edit" && r) edit(r.kind, r);
    else if (action === "review" && r) review(r);
    else if (action === "grade" && r) {
      Object.assign(r, O.reviewCard(r, t.dataset.grade));
      persist();
    } else if (action === "complete" && r) {
      Object.assign(r, O.completeRecord(r));
      persist();
    } else if (action === "duplicate" && r) {
      const copy = {
        ...Q.clone(r),
        id: ctx.id(),
        title: r.title + " (copie)",
        createdAt: new Date().toISOString(),
      };
      state().os.unshift(copy);
      persist();
    } else if (action === "task" && r) {
      if (
        state().tasks.some(
          (t) => !t.deleted && !t.done && t.osSourceId === r.id,
        )
      ) {
        ctx.toast("Une action ouverte est déjà liée à cette fiche.");
        return true;
      }
      state().tasks.unshift({
        id: ctx.id(),
        title: r.title,
        due: r.due || "",
        project: O.domainFor(r.kind).name,
        details: r.details || "",
        osSourceId: r.id,
        estimate: 25,
        done: false,
        createdAt: new Date().toISOString(),
      });
      persist();
    } else if (action === "export") {
      const m = O.getModel(selectedType),
        fields = [
          { key: "title", label: "Titre" },
          { key: "status", label: "Statut" },
          ...m.fields,
          { key: "details", label: "Notes" },
        ];
      ctx.download(
        O.csv(
          fields.map((f) => f.label),
          filteredRecords().map((r) => fields.map((f) => fieldValue(f, r))),
        ),
        "quotidien-" + selectedType + "-" + Q.day() + ".csv",
      );
    } else if (action === "rules-preview") {
      pendingRules = O.proposals(state(), period);
      ctx.modal(
        "Actions proposées",
        `<p>${pendingRules.length} tâche(s) à créer. Les actions restent dans Quotidien.</p>${pendingRules.map((r) => line(r.title, r.due)).join("")}${pendingRules.length ? button("rules-apply", "Créer ces tâches", "", "primary") : noData("Aucune nouvelle échéance pour tes règles actives.")}`,
      );
    } else if (action === "rules-apply") {
      const valid = new Set(O.proposals(state(), period).map((r) => r.token));
      for (const p of pendingRules.filter((p) => valid.has(p.token)))
        state().tasks.unshift({
          id: ctx.id(),
          title: p.title,
          due: p.due,
          project: "Automatisations",
          done: false,
          automationToken: p.token,
          osSourceId: p.sourceKey === "os" ? p.sourceId : undefined,
          sourceKey: p.sourceKey,
          sourceId: p.sourceId,
          createdAt: new Date().toISOString(),
        });
      if (persist()) pendingRules = [];
    } else if (action === "weekly") {
      const start = O.addDays(period, -6),
        journals = rs("journal").filter(
          (r) => r.date >= start && r.date <= period,
        ),
        completed = state().tasks.filter(
          (r) =>
            !r.deleted &&
            r.done &&
            String(r.completedAt || "").slice(0, 10) >= start &&
            String(r.completedAt || "").slice(0, 10) <= period,
        ),
        workouts = state().workouts.filter(
          (r) => !r.deleted && r.date >= start && r.date <= period,
        );
      const title = "Bilan du " + start + " au " + period;
      if (state().notes.some((n) => !n.deleted && n.reviewPeriod === period)) {
        ctx.toast("Ce bilan existe déjà dans tes notes.");
        return true;
      }
      state().notes.unshift({
        id: ctx.id(),
        title,
        tags: "bilan, life-os",
        reviewPeriod: period,
        body: `${completed.length} tâches terminées\n${O.sum(workouts, "minutes")} minutes de sport\n${journals.length} entrées de journal\n\nVictoires\n${journals
          .map((r) => String(r.wins || ""))
          .filter(Boolean)
          .join("\n")}\n\nÀ retenir\n${journals
          .map((r) => String(r.lesson || ""))
          .filter(Boolean)
          .join("\n")}\n\nPriorités de la semaine prochaine\n`,
        createdAt: new Date().toISOString(),
      });
      persist();
    } else if (action === "csv") {
      ctx.modal(
        "Importer des mouvements CSV",
        '<p>Colonnes : <code>date;libelle;montant;categorie</code>. Dates AAAA-MM-JJ, dépenses négatives, revenus positifs.</p><label>Fichier CSV<input type="file" accept=".csv,text/csv" data-os-csv></label><div id="csv-preview"></div>',
      );
    } else if (action === "csv-apply") {
      const fingerprint = (r) =>
        JSON.stringify([r.date, r.label, Number(r.amount), r.category || ""]);
      const existing = new Set(state().finances.map(fingerprint));
      for (const r of pendingCSV) {
        const fp = fingerprint(r);
        if (!existing.has(fp)) {
          state().finances.unshift({
            ...r,
            id: ctx.id(),
            createdAt: new Date().toISOString(),
          });
          existing.add(fp);
        }
      }
      if (persist()) pendingCSV = [];
    }
    return true;
  }
  function submit(f) {
    if (f.id !== "os-form") return false;
    if (!f.reportValidity()) return true;
    const m = O.getModel(editType),
      fd = new FormData(f),
      original = editingId ? lookup(editingId) : null;
    const record = {
      id: ctx.id(),
      createdAt: new Date().toISOString(),
      ...original,
      ...Object.fromEntries(fd),
      kind: editType,
      updatedAt: new Date().toISOString(),
    };
    for (const f of m.fields)
      if (f.type === "refs") record[f.key] = fd.getAll(f.key);
    for (const key of Object.keys(record))
      if (typeof record[key] === "string") record[key] = record[key].trim();
    ctx.commonRead(f, record);
    try {
      O.validate(record);
      for (const f of m.fields.filter(
        (f) => f.type === "ref" || f.type === "refs",
      )) {
        const ids = f.type === "refs" ? record[f.key] : [record[f.key]];
        for (const id of ids)
          if (id && !state().os.some((r) => r.id === id && r.kind === f.ref))
            throw new Error(f.label + " : référence introuvable.");
      }
      if (
        record.kind === "decisionReview" &&
        lookup(record.optionId)?.decisionId !== record.decisionId
      )
        throw new Error("L’option doit appartenir à la décision choisie.");
    } catch (err) {
      ctx.error(err.message);
      return true;
    }
    if (original)
      state().os = state().os.map((r) => (r.id === original.id ? record : r));
    else state().os.unshift(record);
    if (persist()) {
      editingId = null;
      editType = "";
    }
    return true;
  }
  function inputEvent(target) {
    if (!target.hasAttribute("data-os-query")) return;
    query = target.value;
    document.getElementById("os-records").innerHTML = recordList();
  }
  function changeEvent(target) {
    if (target.hasAttribute("data-os-filter")) {
      filter = target.value;
      document.getElementById("os-records").innerHTML = recordList();
    }
    if (target.hasAttribute("data-os-period") && Q.validDate(target.value)) {
      period = target.value;
      ctx.render();
    }
    if (target.hasAttribute("data-os-csv")) {
      const file = target.files?.[0];
      if (!file) return;
      if (file.size > 2 * 1024 * 1024) {
        ctx.error("CSV limité à 2 Mo.");
        return;
      }
      const reader = new FileReader();
      reader.onerror = () => ctx.error("Lecture impossible.");
      reader.onload = () => {
        try {
          pendingCSV = O.parseCSV(String(reader.result));
          const existing = new Set(
            state().finances.map((r) =>
              JSON.stringify([
                r.date,
                r.label,
                Number(r.amount),
                r.category || "",
              ]),
            ),
          );
          const seen = new Set(existing);
          let count = 0;
          for (const r of pendingCSV) {
            const token = JSON.stringify([
              r.date,
              r.label,
              r.amount,
              r.category,
            ]);
            if (!seen.has(token)) {
              count++;
              seen.add(token);
            }
          }
          const box = document.getElementById("csv-preview");
          if (box)
            box.innerHTML = `<p>${pendingCSV.length} lignes lues · ${count} nouvelles · ${pendingCSV.length - count} doublons exacts ignorés (y compris éléments retirés).</p>${pendingCSV
              .slice(0, 5)
              .map((r) => line(r.label, euro(r.amount), r.date))
              .join(
                "",
              )}${count ? button("csv-apply", "Importer les nouvelles lignes", "", "primary") : ""}`;
        } catch (err) {
          pendingCSV = [];
          ctx.error(err.message);
        }
      };
      reader.readAsText(file);
    }
  }
  return {
    view,
    open,
    edit,
    route,
    handleClick,
    submit,
    inputEvent,
    changeEvent,
  };
}

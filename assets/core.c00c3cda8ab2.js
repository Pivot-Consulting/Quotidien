"use strict";
/** Pure domain rules and synchronous, fail-closed local persistence. */
var Q;
(function (Q) {
    Q.KEY = "quotidien-rebuild-2";
    Q.BACKUP_KEY = Q.KEY + "-previous";
    Q.CHECKPOINT_KEY = Q.KEY + "-before-restore";
    Q.RELEASE = "2.1.0";
    Q.collections = [
        "tasks",
        "events",
        "notes",
        "habits",
        "routines",
        "goals",
        "workouts",
        "health",
        "life",
        "finances",
        "documents",
        "assets",
        "automations",
    ];
    Q.screens = ["today", "plan", "notes", "tracking", "life", "wave"];
    function clone(value) {
        return JSON.parse(JSON.stringify(value));
    }
    Q.clone = clone;
    function empty() {
        return Object.assign({ version: 2, screen: "today", settings: { theme: "dark", focus: 25 } }, Object.fromEntries(Q.collections.map((key) => [key, []])));
    }
    Q.empty = empty;
    function day(date = new Date()) {
        return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    }
    Q.day = day;
    function object(x) {
        return x !== null && typeof x === "object" && !Array.isArray(x);
    }
    function guard(value) {
        if (!value || typeof value !== "object")
            return;
        for (const key of Object.keys(value)) {
            if (["__proto__", "prototype", "constructor"].includes(key))
                throw new Error("Champ de sauvegarde interdit.");
            guard(value[key]);
        }
    }
    function validDate(value) {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(value))
            return false;
        const date = new Date(value + "T12:00:00");
        return Number.isFinite(date.getTime()) && day(date) === value;
    }
    Q.validDate = validDate;
    function normalize(input) {
        guard(input);
        if (!object(input) ||
            input.version !== 2 ||
            !Q.collections.some((key) => Array.isArray(input[key])))
            throw new Error("Sauvegarde Quotidien 2.x attendue. Les formats V5/V6/V7 nécessitent une migration dédiée.");
        const next = Object.assign(empty(), clone(input));
        for (const key of Q.collections) {
            const value = input[key];
            if (value === undefined) {
                next[key] = [];
                continue;
            }
            if (!Array.isArray(value))
                throw new Error(`La collection ${key} est invalide.`);
            const ids = new Set();
            next[key] = value.map((item) => {
                if (!object(item) ||
                    typeof item.id !== "string" ||
                    !item.id.trim() ||
                    ids.has(item.id))
                    throw new Error(`Identifiant manquant ou dupliqué dans ${key}.`);
                ids.add(item.id);
                const record = clone(item);
                for (const field of [
                    "title",
                    "name",
                    "label",
                    "body",
                    "tags",
                    "details",
                    "project",
                    "category",
                    "area",
                    "type",
                    "kind",
                    "unit",
                    "status",
                    "steps",
                ]) {
                    if (record[field] == null)
                        continue;
                    if (typeof record[field] !== "string")
                        throw new Error(`Champ ${key}.${field} invalide.`);
                }
                for (const field of ["date", "due"]) {
                    if (record[field] == null || record[field] === "")
                        continue;
                    if (typeof record[field] !== "string" || !validDate(record[field]))
                        throw new Error(`Date invalide dans ${key}.`);
                }
                if (record.time &&
                    (typeof record.time !== "string" ||
                        !/^([01]\d|2[0-3]):[0-5]\d$/.test(record.time)))
                    throw new Error("Horaire invalide.");
                for (const field of [
                    "amount",
                    "progress",
                    "minutes",
                    "effort",
                    "target",
                    "value",
                ]) {
                    if (record[field] == null || record[field] === "")
                        continue;
                    if (!["string", "number"].includes(typeof record[field]) ||
                        !Number.isFinite(Number(record[field])))
                        throw new Error(`Nombre invalide dans ${key}.${field}.`);
                    record[field] = Number(record[field]);
                }
                for (const field of ["done", "deleted", "important", "urgent"]) {
                    if (record[field] !== undefined && typeof record[field] !== "boolean")
                        throw new Error(`Champ ${key}.${field} invalide.`);
                }
                if (record.progress !== undefined &&
                    (Number(record.progress) < 0 || Number(record.progress) > 100))
                    throw new Error("Progression attendue entre 0 et 100.");
                if (record.minutes !== undefined && Number(record.minutes) < 0)
                    throw new Error("Durée négative.");
                if (record.target !== undefined && Number(record.target) <= 0)
                    throw new Error("Objectif strictement positif attendu.");
                if (record.effort !== undefined &&
                    (Number(record.effort) < 1 || Number(record.effort) > 10))
                    throw new Error("Effort attendu entre 1 et 10.");
                if (key === "habits" && record.days !== undefined) {
                    if (!object(record.days) ||
                        Object.entries(record.days).some(([date, value]) => !validDate(date) || typeof value !== "boolean"))
                        throw new Error("Historique d’habitude invalide.");
                }
                return record;
            });
        }
        if (input.settings !== undefined && !object(input.settings))
            throw new Error("Réglages invalides.");
        next.settings = Object.assign(empty().settings, input.settings || {});
        if (!["light", "dark"].includes(next.settings.theme))
            next.settings.theme = "dark";
        next.screen = Q.screens.includes(next.screen) ? next.screen : "today";
        return next;
    }
    Q.normalize = normalize;
    function parseBackup(raw) {
        const data = JSON.parse(raw);
        if (object(data) && data.app === "quotidien" && data.format === 1)
            return normalize(data.state);
        return normalize(data);
    }
    Q.parseBackup = parseBackup;
    function backup(state) {
        return JSON.stringify({
            app: "quotidien",
            format: 1,
            exportedAt: new Date().toISOString(),
            release: Q.RELEASE,
            state: normalize(state),
        }, null, 2);
    }
    Q.backup = backup;
    function summary(state) {
        return Q.collections.map((key) => `${key}: ${state[key].length}`).join(" · ");
    }
    Q.summary = summary;
    class Repository {
        constructor(storage) {
            this.storage = storage;
        }
        load() {
            const raw = this.storage.getItem(Q.KEY);
            const next = raw === null ? empty() : normalize(JSON.parse(raw));
            this.expected = raw;
            return next;
        }
        commit(state, checkpoint = false) {
            const next = normalize(state);
            const raw = this.storage.getItem(Q.KEY);
            if (this.expected === undefined)
                throw new Error("Les données existantes doivent être récupérées avant toute modification.");
            if (raw !== this.expected)
                throw new Error("Les données ont changé dans un autre onglet. Exporte ton brouillon puis recharge avant de réessayer.");
            // Both writes are synchronous. A failed backup aborts before changing the primary key.
            // setItem is atomic: quota errors leave the previous primary value intact.
            if (checkpoint)
                this.storage.setItem(Q.CHECKPOINT_KEY, JSON.stringify(this.load()));
            if (raw !== null)
                this.storage.setItem(Q.BACKUP_KEY, raw);
            const serialized = JSON.stringify(next);
            this.storage.setItem(Q.KEY, serialized);
            this.expected = serialized;
            return next;
        }
    }
    Q.Repository = Repository;
    function matches(state, query) {
        const fold = (value) => value
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .toLowerCase();
        const q = fold(query.trim());
        return Q.collections.flatMap((key) => state[key]
            .filter((record) => !record.deleted && fold(JSON.stringify(record)).includes(q))
            .map((record) => ({ key, record })));
    }
    Q.matches = matches;
    function focusMinutes(state) {
        return state.health
            .filter((x) => !x.deleted && String(x.kind).toLowerCase() === "focus")
            .reduce((sum, x) => sum + Number(x.value || 0), 0);
    }
    Q.focusMinutes = focusMinutes;
})(Q || (Q = {}));

/** Transactional local repository. Legacy snapshots are kept intact during migration. */
namespace Q.Durable {
  export const DB = "quotidien-local-v3";
  export const MARKER = "quotidien-idb-migrated";
  export class Repository {
    private db?: IDBDatabase;
    private expected: string | null | undefined;
    private legacy: Q.Repository;
    constructor(
      private storage: Storage,
      private factory?: IDBFactory,
    ) {
      this.legacy = new Q.Repository(storage);
    }
    async open(): Promise<void> {
      if (!this.factory) {
        if (this.storage.getItem(MARKER))
          throw new Error(
            "Le stockage transactionnel est indisponible. Aucune ancienne copie n’a été chargée à sa place.",
          );
        return;
      }
      this.db = await new Promise<IDBDatabase>((resolve, reject) => {
        let blocked = false;
        const r = this.factory!.open(DB, 2);
        r.onupgradeneeded = () => {
          if (!r.result.objectStoreNames.contains("data"))
            r.result.createObjectStore("data");
          if (!r.result.objectStoreNames.contains("drafts"))
            r.result.createObjectStore("drafts");
          if (!r.result.objectStoreNames.contains("files"))
            r.result.createObjectStore("files");
        };
        r.onsuccess = () => {
          if (blocked) r.result.close();
          else resolve(r.result);
        };
        r.onerror = () => reject(r.error);
        r.onblocked = () => {
          blocked = true;
          reject(
            new Error(
              "Ferme les autres onglets QUOTIDIEN pour ouvrir le stockage.",
            ),
          );
        };
      });
      this.db.onversionchange = () => this.db?.close();
      const existing = await this.read("current");
      if (existing !== null) return;
      if (this.storage.getItem(MARKER))
        throw new Error(
          "La base locale est manquante. Conserve et restaure une sauvegarde ; la copie antérieure n’a pas été réimportée silencieusement.",
        );
      const raw = this.storage.getItem(KEY);
      const next = raw === null ? empty() : normalize(JSON.parse(raw));
      // Reserve a durable migration marker before writing. A failure leaves old data untouched.
      this.storage.setItem(MARKER, "1");
      try {
        await this.writeInitial(JSON.stringify(next), raw);
      } catch (e) {
        this.storage.removeItem(MARKER);
        throw e;
      }
    }
    private writeInitial(raw: string, legacy: string | null): Promise<void> {
      return new Promise((resolve, reject) => {
        const tx = this.db!.transaction("data", "readwrite"),
          st = tx.objectStore("data"),
          r = st.get("current");
        r.onsuccess = () => {
          if (r.result === undefined) {
            st.put(raw, "current");
            st.put(legacy, "legacy");
            st.put(raw, "migration");
            for (const key of [BACKUP_KEY, CHECKPOINT_KEY]) {
              const old = this.storage.getItem(key);
              if (old !== null) st.put(old, key);
            }
          }
        };
        tx.oncomplete = () => resolve();
        tx.onabort = () =>
          reject(tx.error || new Error("Migration interrompue."));
      });
    }
    async read(key: string, store = "data"): Promise<string | null> {
      if (!this.db) return this.storage.getItem(key === "current" ? KEY : key);
      return new Promise((resolve, reject) => {
        const r = this.db!.transaction(store).objectStore(store).get(key);
        r.onsuccess = () => resolve(r.result ?? null);
        r.onerror = () => reject(r.error);
      });
    }
    async auxiliary(key: string, value: string | null): Promise<void> {
      if (!this.db) {
        if (value === null) this.storage.removeItem(key);
        else this.storage.setItem(key, value);
        return;
      }
      return new Promise((resolve, reject) => {
        const tx = this.db!.transaction("drafts", "readwrite"),
          st = tx.objectStore("drafts");
        if (value === null) st.delete(key);
        else st.put(value, key);
        tx.oncomplete = () => resolve();
        tx.onabort = () => reject(tx.error);
      });
    }
    async putFile(key: string, value: Blob): Promise<void> {
      if (!this.db)
        throw new Error(
          "Les pièces jointes nécessitent le stockage IndexedDB de ce navigateur.",
        );
      if (!(value instanceof Blob) || value.size > 25 * 1024 * 1024)
        throw new Error("Fichier invalide ou supérieur à 25 Mo.");
      return new Promise((resolve, reject) => {
        const tx = this.db!.transaction("files", "readwrite");
        tx.objectStore("files").put(value, key);
        tx.oncomplete = () => resolve();
        tx.onabort = () =>
          reject(tx.error || new Error("Pièce jointe non enregistrée."));
      });
    }
    async getFile(key: string): Promise<Blob | null> {
      if (!this.db) return null;
      return new Promise((resolve, reject) => {
        const r = this.db!.transaction("files").objectStore("files").get(key);
        r.onsuccess = () => resolve(r.result instanceof Blob ? r.result : null);
        r.onerror = () => reject(r.error);
      });
    }
    async deleteFile(key: string): Promise<void> {
      if (!this.db) return;
      return new Promise((resolve, reject) => {
        const tx = this.db!.transaction("files", "readwrite");
        tx.objectStore("files").delete(key);
        tx.oncomplete = () => resolve();
        tx.onabort = () =>
          reject(tx.error || new Error("Pièce jointe non retirée."));
      });
    }
    async clearFiles(): Promise<void> {
      if (!this.db) return;
      return new Promise((resolve, reject) => {
        const tx = this.db!.transaction("files", "readwrite");
        tx.objectStore("files").clear();
        tx.oncomplete = () => resolve();
        tx.onabort = () =>
          reject(tx.error || new Error("Coffre non réinitialisé."));
      });
    }
    async load(): Promise<State> {
      if (!this.db) return this.legacy.load();
      const legacy = await this.read("legacy");
      if (legacy !== this.storage.getItem(KEY))
        throw new Error(
          "Une ancienne version a modifié les données après migration. Exporte les deux copies avant de les rapprocher.",
        );
      const raw = await this.read("current");
      if (raw === null) throw new Error("Données locales manquantes.");
      const next = normalize(JSON.parse(raw));
      this.expected = raw;
      return next;
    }
    async commit(state: State, checkpoint = false): Promise<State> {
      if (!this.db) return this.legacy.commit(state, checkpoint);
      const next = normalize(state);
      if (this.expected === undefined)
        throw new Error("Charge les données avant de les modifier.");
      if (!checkpoint)
        Personal.stamp(normalize(JSON.parse(this.expected!)), next);
      const serialized = JSON.stringify(next);
      await new Promise<void>((resolve, reject) => {
        const tx = this.db!.transaction("data", "readwrite"),
          st = tx.objectStore("data"),
          r = st.get("current");
        let failure: Error | undefined;
        r.onsuccess = () => {
          if (r.result !== this.expected) {
            failure = new Error(
              "Les données ont changé dans un autre onglet. Exporte ta saisie puis recharge.",
            );
            tx.abort();
            return;
          }
          const old = st.get("legacy");
          old.onsuccess = () => {
            if (old.result !== this.storage.getItem(KEY)) {
              failure = new Error(
                "Une ancienne version a modifié les données. Recharge avant de continuer.",
              );
              tx.abort();
              return;
            }
            st.put(r.result, BACKUP_KEY);
            if (checkpoint) st.put(r.result, CHECKPOINT_KEY);
            st.put(serialized, "current");
          };
        };
        tx.oncomplete = () => resolve();
        tx.onabort = () =>
          reject(failure || tx.error || new Error("Transaction annulée."));
      });
      this.expected = serialized;
      return next;
    }
    close(): void {
      this.db?.close();
    }
    get mode(): string {
      return this.db
        ? "IndexedDB · transactions atomiques"
        : "LocalStorage · compatibilité";
    }
  }
}

/** Calendar projections never turn measurements or transactions into deadlines. */
namespace Q.Planning {
  export type Entry = {
    id: string;
    hit: Personal.Hit;
    start: string;
    end: string;
    time: string;
    label: string;
    deadline: boolean;
  };
  export function entries(s: State, includeDone = false): Entry[] {
    const result: Entry[] = [];
    for (const hit of Personal.all(s)) {
      const r = hit.record;
      if (!Personal.visible(r) || (!includeDone && Personal.completed(r)))
        continue;
      const add = (
        field: string,
        label: string,
        deadline: boolean,
        end?: unknown,
      ) => {
        const start = String(r[field] || "");
        if (!validDate(start)) return;
        result.push({
          id: Personal.token(hit) + ":" + field,
          hit,
          start,
          end:
            validDate(String(end)) && String(end) >= start
              ? String(end)
              : start,
          time: String(r.time || ""),
          label,
          deadline,
        });
      };
      add("due", "Échéance", true);
      if (
        ["events", "workouts"].includes(hit.key) ||
        (hit.key === "os" &&
          ["trip", "booking", "interaction", "study"].includes(String(r.kind)))
      )
        if (r.date !== r.due)
          add(
            "date",
            r.kind === "trip" ? "Voyage" : "Agenda",
            false,
            r.kind === "trip" ? r.end : undefined,
          );
      if (hit.key === "os" && r.kind === "subscription")
        add("cancelBy", "Résiliation", true);
      if (hit.key === "os" && r.kind === "equipment")
        add("warranty", "Fin de garantie", true);
    }
    return result.sort(
      (a, b) =>
        a.start.localeCompare(b.start) ||
        a.time.localeCompare(b.time) ||
        Personal.title(a.hit.record).localeCompare(
          Personal.title(b.hit.record),
          "fr",
        ),
    );
  }
  export function monthDays(month: string): string[] {
    if (!validDate(month + "-01")) throw new Error("Mois invalide.");
    const first = month + "-01";
    const offset = (new Date(first + "T12:00:00").getDay() + 6) % 7;
    return Array.from({ length: 42 }, (_, i) => OS.addDays(first, i - offset));
  }
  export function shiftMonth(month: string, offset: number): string {
    if (!validDate(month + "-01")) throw new Error("Mois invalide.");
    const dt = new Date(month + "-01T12:00:00");
    dt.setMonth(dt.getMonth() + offset);
    return day(dt).slice(0, 7);
  }
  export const onDay = (list: Entry[], date: string): Entry[] =>
    list.filter((x) => x.start <= date && x.end >= date);
}

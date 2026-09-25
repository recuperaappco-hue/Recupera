// Colombian calendar helpers. Pure functions (no server-only imports) so they can be unit tested.

export const iso = (d: Date) => d.toISOString().slice(0, 10);
export const parseISO = (s: string) => new Date(s + "T12:00:00Z");
export const todayISO = () => iso(new Date(new Date().toLocaleString("en-US", { timeZone: "America/Bogota" })));

export function addDays(d: Date, n: number) {
  const x = new Date(d);
  x.setUTCDate(x.getUTCDate() + n);
  return x;
}
export const daysBetween = (a: string, b: string) => Math.round((parseISO(b).getTime() - parseISO(a).getTime()) / 86400000);

function easter(year: number) {
  // Anonymous Gregorian algorithm
  const a = year % 19, b = Math.floor(year / 100), c = year % 100, d = Math.floor(b / 4), e = b % 4;
  const f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31), day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(Date.UTC(year, month - 1, day, 12));
}
/** Move to the following Monday (Ley Emiliani), unless already Monday. */
function emiliani(d: Date) {
  const dow = d.getUTCDay();
  return dow === 1 ? d : addDays(d, (8 - dow) % 7);
}

const cache = new Map<number, Set<string>>();
/** Colombian public holidays for a year (Ley 51 de 1983). */
export function holidays(year: number): Set<string> {
  if (cache.has(year)) return cache.get(year)!;
  const D = (m: number, day: number) => new Date(Date.UTC(year, m - 1, day, 12));
  const e = easter(year);
  const list = [
    D(1, 1), D(5, 1), D(7, 20), D(8, 7), D(12, 8), D(12, 25),                        // fixed
    emiliani(D(1, 6)), emiliani(D(3, 19)), emiliani(D(6, 29)), emiliani(D(8, 15)),
    emiliani(D(10, 12)), emiliani(D(11, 1)), emiliani(D(11, 11)),                      // moved to Monday
    addDays(e, -3), addDays(e, -2),                                                   // Holy Thursday, Good Friday
    emiliani(addDays(e, 39)), emiliani(addDays(e, 60)), emiliani(addDays(e, 68)),     // Ascension, Corpus Christi, Sacred Heart
  ];
  const set = new Set(list.map(iso));
  cache.set(year, set);
  return set;
}

export function isBusinessDay(d: Date) {
  const dow = d.getUTCDay();
  return dow !== 0 && dow !== 6 && !holidays(d.getUTCFullYear()).has(iso(d));
}

export function addBusinessDays(fromISO: string, n: number): string {
  let d = parseISO(fromISO);
  let k = 0;
  while (k < n) {
    d = addDays(d, 1);
    if (isBusinessDay(d)) k++;
  }
  return iso(d);
}

const MES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
export function fmtDate(s?: string | null) {
  if (!s) return "—";
  const d = parseISO(s.slice(0, 10));
  return `${d.getUTCDate()} ${MES[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}
export const cop = (n?: number | null) => "$" + Math.round(Number(n) || 0).toLocaleString("es-CO");

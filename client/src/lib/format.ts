/** Київський час. Деякі старі WebView не знають «Europe/Kyiv» — тоді «Europe/Kiev». */
const TZ = (() => {
  for (const z of ['Europe/Kyiv', 'Europe/Kiev']) {
    try {
      new Intl.DateTimeFormat('uk-UA', { timeZone: z });
      return z;
    } catch {
      /* next */
    }
  }
  return undefined;
})();

const dateTimeFmt = new Intl.DateTimeFormat('uk-UA', {
  timeZone: TZ,
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});
const timeFmt = new Intl.DateTimeFormat('uk-UA', { timeZone: TZ, hour: '2-digit', minute: '2-digit' });
const dayFmt = new Intl.DateTimeFormat('uk-UA', { timeZone: TZ, day: '2-digit', month: '2-digit', year: 'numeric' });
const isoDayFmt = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' });

export const fmtDateTime = (d: string | Date) => dateTimeFmt.format(new Date(d)).replace(',', '');
export const fmtTime = (d: string | Date) => timeFmt.format(new Date(d));
export const fmtDay = (d: string | Date) => dayFmt.format(new Date(d));
/** YYYY-MM-DD за Києвом (для <input type="date">) */
export const isoDay = (d: Date = new Date()) => isoDayFmt.format(d);

export function sameKyivDay(a: string | Date, b: string | Date) {
  return isoDay(new Date(a)) === isoDay(new Date(b));
}

export function plural(n: number, one: string, few: string, many: string) {
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
  return many;
}

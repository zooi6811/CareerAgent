export const COUNTRY_OPTIONS = [
  ['MY', 'Malaysia', 'MYR'], ['SG', 'Singapore', 'SGD'], ['US', 'United States', 'USD'],
  ['GB', 'United Kingdom', 'GBP'], ['CA', 'Canada', 'CAD'], ['AU', 'Australia', 'AUD'],
  ['NZ', 'New Zealand', 'NZD'], ['IN', 'India', 'INR'], ['PH', 'Philippines', 'PHP'],
  ['ID', 'Indonesia', 'IDR'], ['TH', 'Thailand', 'THB'], ['JP', 'Japan', 'JPY'],
  ['DE', 'Germany', 'EUR'], ['FR', 'France', 'EUR'], ['NL', 'Netherlands', 'EUR'],
  ['IE', 'Ireland', 'EUR'], ['ES', 'Spain', 'EUR'], ['BR', 'Brazil', 'BRL'],
  ['MX', 'Mexico', 'MXN'], ['ZA', 'South Africa', 'ZAR'], ['AE', 'United Arab Emirates', 'AED'],
] as const;

export function browserLocaleDefaults() {
  const locale = typeof navigator === 'undefined' ? 'en-US' : navigator.language;
  let timeZone = 'UTC';
  try { timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'; } catch { /* use UTC */ }
  const localeRegion = locale.split('-').at(-1)?.toUpperCase();
  const zoneRegion: Record<string, string> = { 'Asia/Kuala_Lumpur':'MY','Asia/Singapore':'SG','Asia/Kolkata':'IN','Asia/Manila':'PH','Asia/Jakarta':'ID','Asia/Bangkok':'TH','Asia/Tokyo':'JP','Europe/London':'GB','Europe/Berlin':'DE','Europe/Paris':'FR','Australia/Sydney':'AU','Pacific/Auckland':'NZ','America/Toronto':'CA' };
  // Time zone is a better signal for work market than language (many browsers use en-US abroad).
  const region = zoneRegion[timeZone] || (COUNTRY_OPTIONS.some(([code])=>code===localeRegion) ? localeRegion! : 'US');
  const country = COUNTRY_OPTIONS.find(([code]) => code === region)!;
  return { preferredCountry: country[1], salaryCurrency: country[2], timeZone };
}

export function currencyForCountry(name: string): string | undefined {
  return COUNTRY_OPTIONS.find(([, country]) => country.toLowerCase() === name.trim().toLowerCase())?.[2];
}

export function timeZoneForCountry(name: string): string | undefined {
  const code = COUNTRY_OPTIONS.find(([, country]) => country.toLowerCase() === name.trim().toLowerCase())?.[0];
  const defaults: Record<string, string> = {
    MY: 'Asia/Kuala_Lumpur', SG: 'Asia/Singapore', US: 'America/New_York', GB: 'Europe/London',
    CA: 'America/Toronto', AU: 'Australia/Sydney', NZ: 'Pacific/Auckland', IN: 'Asia/Kolkata',
    PH: 'Asia/Manila', ID: 'Asia/Jakarta', TH: 'Asia/Bangkok', JP: 'Asia/Tokyo', DE: 'Europe/Berlin',
    FR: 'Europe/Paris', NL: 'Europe/Amsterdam', IE: 'Europe/Dublin', ES: 'Europe/Madrid',
    BR: 'America/Sao_Paulo', MX: 'America/Mexico_City', ZA: 'Africa/Johannesburg', AE: 'Asia/Dubai',
  };
  return code ? defaults[code] : undefined;
}

export function formatSalaryRange(minK: number, maxK: number, currency = 'USD'): string {
  if (maxK === 0 && minK === 0) return 'Not listed';
  let formatter: Intl.NumberFormat;
  try {
    formatter = new Intl.NumberFormat(undefined, { style: 'currency', currency: /^[A-Z]{3}$/.test(currency) ? currency : 'USD', maximumFractionDigits: 0 });
  } catch { formatter = new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }); }
  const format = (value: number) => `${formatter.format(value * 1000)}`;
  return minK === maxK ? `${format(minK)} / year` : `${format(minK)}–${format(maxK)} / year`;
}

export function formatAnnualSalary(amountK: number, currency = 'USD'): string {
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency: /^[A-Z]{3}$/.test(currency) ? currency : 'USD', maximumFractionDigits: 0 }).format(amountK * 1000);
  } catch {
    return `${currency || 'Currency'} ${(amountK * 1000).toLocaleString()}`;
  }
}

export function salaryCeiling(currency = 'USD'): number {
  if (currency === 'INR' || currency === 'IDR') return 30000;
  if (currency === 'JPY') return 30000;
  if (currency === 'MYR' || currency === 'PHP' || currency === 'THB' || currency === 'ZAR') return 1000;
  return 500;
}

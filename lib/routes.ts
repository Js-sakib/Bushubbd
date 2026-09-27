import type { PopularRoute } from './places'

/** "Cox's Bazar" → "coxs-bazar". Stable, lowercase, and safe in a URL. */
export function citySlug(city: string): string {
  return city
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export function routeSlug(from: string, to: string): string {
  return `${citySlug(from)}-to-${citySlug(to)}`
}

export function routePath(from: string, to: string): string {
  return `/routes/${routeSlug(from, to)}`
}

/** The two cities a route page is about, if both are on the admin's city list. */
export function routeFromSlug(slug: string, cities: string[]): PopularRoute | null {
  for (const from of cities) {
    for (const to of cities) {
      if (from !== to && routeSlug(from, to) === slug) return { from, to }
    }
  }
  return null
}

/**
 * Bangla names for the cities people search for, so a route page also matches searches such
 * as "ঢাকা থেকে সিলেট বাস". A city the admin adds that is not listed here simply shows in English.
 */
const BANGLA_CITY: Record<string, string> = {
  Dhaka: 'ঢাকা',
  Chittagong: 'চট্টগ্রাম',
  Chattogram: 'চট্টগ্রাম',
  Sylhet: 'সিলেট',
  Rajshahi: 'রাজশাহী',
  Khulna: 'খুলনা',
  "Cox's Bazar": 'কক্সবাজার',
  Barishal: 'বরিশাল',
  Barisal: 'বরিশাল',
  Rangpur: 'রংপুর',
  Comilla: 'কুমিল্লা',
  Cumilla: 'কুমিল্লা',
  Mymensingh: 'ময়মনসিংহ',
  Bogura: 'বগুড়া',
  Bogra: 'বগুড়া',
  Jessore: 'যশোর',
  Jashore: 'যশোর',
  Dinajpur: 'দিনাজপুর',
  Feni: 'ফেনী',
  Noakhali: 'নোয়াখালী',
  Chandpur: 'চাঁদপুর',
  Kushtia: 'কুষ্টিয়া',
  Tangail: 'টাঙ্গাইল',
  Pabna: 'পাবনা',
  Saidpur: 'সৈয়দপুর',
  Teknaf: 'টেকনাফ',
  Bandarban: 'বান্দরবান',
  Rangamati: 'রাঙ্গামাটি',
  Sreemangal: 'শ্রীমঙ্গল',
  Srimangal: 'শ্রীমঙ্গল',
  Moulvibazar: 'মৌলভীবাজার',
  Sunamganj: 'সুনামগঞ্জ',
  Kuakata: 'কুয়াকাটা',
  Patuakhali: 'পটুয়াখালী',
  Benapole: 'বেনাপোল',
  Satkhira: 'সাতক্ষীরা',
  Faridpur: 'ফরিদপুর',
  Gopalganj: 'গোপালগঞ্জ',
  Narayanganj: 'নারায়ণগঞ্জ',
  Gazipur: 'গাজীপুর',
  Brahmanbaria: 'ব্রাহ্মণবাড়িয়া',
  Panchagarh: 'পঞ্চগড়',
  Thakurgaon: 'ঠাকুরগাঁও',
  Kurigram: 'কুড়িগ্রাম',
  Naogaon: 'নওগাঁ',
  Sirajganj: 'সিরাজগঞ্জ',
  Jamalpur: 'জামালপুর',
  Kishoreganj: 'কিশোরগঞ্জ',
  Bhola: 'ভোলা',
  Jhenaidah: 'ঝিনাইদহ',
  Natore: 'নাটোর',
  Nilphamari: 'নীলফামারী',
}

export function banglaCity(city: string): string | null {
  return BANGLA_CITY[city] ?? null
}

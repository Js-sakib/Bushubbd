import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'About BusHub — online bus tickets in Bangladesh',
  description:
    'BusHub sells bus tickets online across Bangladesh. No account, live seat availability, and a QR ticket the conductor can verify.',
}

const PROMISES = [
  {
    title: 'No account, ever',
    body:
      'You pick a seat, pay, and the ticket is yours. No sign-up form, no password to forget, no phone number verification before you can even see a fare.',
    accent: 'text-[#f5a524]',
    bg: 'bg-[#f5a524]/[0.14]',
    icon: (
      <>
        <path d="M12 3 4 6v6c0 4.4 3.3 8.3 8 9 4.7-.7 8-4.6 8-9V6z" />
        <path d="m9 12 2 2 4-4" />
      </>
    ),
  },
  {
    title: 'A ticket nobody can fake',
    body:
      'Every ticket carries a QR code. The conductor scans it and our system answers live — valid, already used, or refunded. A Photoshopped screenshot has nothing behind it, so it fails on the spot.',
    accent: 'text-[#2dd4bf]',
    bg: 'bg-[#2dd4bf]/[0.14]',
    icon: (
      <>
        <rect x="3" y="3" width="7" height="7" rx="1.5" />
        <rect x="14" y="3" width="7" height="7" rx="1.5" />
        <rect x="3" y="14" width="7" height="7" rx="1.5" />
        <path d="M14 14h3v3h-3zM20 14v3M17 20h4" />
      </>
    ),
  },
  {
    title: 'The seat count is the real one',
    body:
      'Operators mark their counter sales in their own dashboard, and online bookings lock a seat the moment it is chosen. What you see on the seat map is what is actually free on that bus.',
    accent: 'text-[#f2661d]',
    bg: 'bg-[#f2661d]/[0.16]',
    icon: (
      <>
        <rect x="3" y="4" width="18" height="12.5" rx="3" />
        <path d="M3 11h18" />
        <circle cx="7.5" cy="19" r="1.6" />
        <circle cx="16.5" cy="19" r="1.6" />
      </>
    ),
  },
  {
    title: 'Ten minutes to pay, then the seat goes back',
    body:
      'Your seat is held while you finish payment. If you walk away, it returns to the map automatically instead of sitting dead for the rest of the day.',
    accent: 'text-[#8b5cf6]',
    bg: 'bg-[#8b5cf6]/[0.16]',
    icon: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 2" />
      </>
    ),
  },
]

const STEPS = [
  { n: '1', title: 'Search your route', body: 'Pick where you are going and when. Every bus running that day shows up with its real fare.' },
  { n: '2', title: 'Choose your seat', body: 'Tap the seat you want on the live map and enter the passenger name and phone number.' },
  { n: '3', title: 'Pay and travel', body: 'Pay with bKash or Nagad. Your QR ticket arrives straight away — show it when you board.' },
]

export default function About() {
  return (
    <div className="px-5 pb-6 pt-5">
      <section className="flex flex-col gap-3">
        <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#f5a524]">About us</span>
        <h1 className="text-[34px] font-bold leading-[1.1] sm:text-[42px]">
          Bus tickets,
          <br />
          without the queue.
        </h1>
        <p className="max-w-lg text-sm leading-relaxed text-[#9ba7aa]">
          BusHub is a Bangladeshi ticketing platform. We put the country&apos;s bus operators and their real seat
          availability in one place, so booking a seat takes a minute on your phone instead of a trip to the counter
          or a phone call that nobody answers.
        </p>
      </section>

      <section className="mt-8 flex flex-col gap-3">
        <h2 className="text-[17px] font-bold">What we do differently</h2>
        {PROMISES.map((item) => (
          <div key={item.title} className="flex items-start gap-3.5 glass-lite p-3.5">
            <span className={`flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-xl ${item.bg} ${item.accent}`}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-[19px] w-[19px]">
                {item.icon}
              </svg>
            </span>
            <div className="flex flex-col gap-1">
              <span className="text-sm font-bold">{item.title}</span>
              <span className="text-[12.5px] leading-relaxed text-[#9ba7aa]">{item.body}</span>
            </div>
          </div>
        ))}
      </section>

      <section className="mt-8 flex flex-col gap-3">
        <h2 className="text-[17px] font-bold">How booking works</h2>
        <div className="grid gap-2.5 sm:grid-cols-3">
          {STEPS.map((step) => (
            <div key={step.n} className="flex flex-col gap-2 glass-lite p-3.5">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#f5a524]/[0.14] text-sm font-bold text-[#f5a524]">
                {step.n}
              </span>
              <span className="text-sm font-bold">{step.title}</span>
              <span className="text-[12.5px] leading-relaxed text-[#9ba7aa]">{step.body}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-8 flex flex-col gap-3">
        <h2 className="text-[17px] font-bold">Why we built it</h2>
        <div className="glass-lite p-4">
          <p className="text-[13px] leading-relaxed text-[#b7c1c3]">
            Buying a long-distance bus ticket in Bangladesh usually means going to a counter, calling a number that
            rings out, or trusting a seat map that was last accurate this morning. Passengers turn up to find their
            seat sold twice. Fake tickets get waved through because there is no way to check one at the door.
          </p>
          <p className="mt-3 text-[13px] leading-relaxed text-[#b7c1c3]">
            BusHub exists to fix exactly those three things: availability you can trust, a ticket that proves itself,
            and a booking you can finish from wherever you are standing.
          </p>
        </div>
      </section>

      <section className="mt-8 flex flex-col gap-3">
        <h2 className="text-[17px] font-bold">For bus operators</h2>
        <div className="flex flex-col gap-3.5 rounded-[20px] border border-[#1e4b4f] bg-gradient-to-br from-[#0e3f43]/90 to-[#141a1c]/90 p-4">
          <p className="text-[13px] leading-relaxed text-[#a9bbbc]">
            Listing a bus is free. You get your own dashboard to add trips, mark the seats you sell at your counter,
            and see exactly what BusHub owes you. We take a commission only on the tickets we actually sell for you —
            nothing up front, no monthly fee.
          </p>
          <a href="/company/register" className="glass-btn glass-btn-teal h-12 self-start px-5 text-sm">
            <span className="icon-disc icon-disc-teal h-6 w-6">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" className="h-3 w-3">
                <path d="M5 12h13" />
                <path d="m12.5 5.5 6.5 6.5-6.5 6.5" />
              </svg>
            </span>
            List your buses
          </a>
        </div>
      </section>

      <section className="mt-8 flex flex-col gap-3" id="contact">
        <h2 className="text-[17px] font-bold">Get in touch</h2>
        <div className="flex flex-col gap-3 glass-lite p-4">
          <p className="text-[13px] leading-relaxed text-[#9ba7aa]">
            Question about a booking, a refund, or listing your buses? Write to us and we will come back to you.
          </p>
          <a href="mailto:info@bushubbd.com" className="text-sm font-bold text-[#f5a524] hover:underline">
            info@bushubbd.com
          </a>
          <span className="text-[11.5px] text-[#78868a]">BusHub · Bangladesh</span>
        </div>
      </section>
    </div>
  )
}

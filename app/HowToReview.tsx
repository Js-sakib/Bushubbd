import Link from 'next/link'

const STEPS: { bn: string; en: string; icon: React.ReactNode }[] = [
  {
    bn: 'আপনার টিকেট খুলুন',
    en: 'Open your ticket: from My Tickets, or the link we sent on WhatsApp or email.',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
        <path d="M3 8.5V6.5A1.5 1.5 0 0 1 4.5 5h15A1.5 1.5 0 0 1 21 6.5v2a2.5 2.5 0 0 0 0 5v2a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 15.5v-2a2.5 2.5 0 0 0 0-5z" />
      </svg>
    ),
  },
  {
    bn: 'BusHub ও বাস কোম্পানিকে আলাদা স্টার দিন',
    en: 'Tap stars for BusHub (booking, payment, ticket) and for the bus company (bus, seat, time, staff).',
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5" aria-hidden>
        <path d="M12 2.8l2.8 5.9 6.4.8-4.7 4.4 1.2 6.4L12 17.2l-5.7 3.1 1.2-6.4-4.7-4.4 6.4-.8z" />
      </svg>
    ),
  },
  {
    bn: 'দুই লাইন লিখে পোস্ট করুন',
    en: 'Write a few words if you like, and post. You can change it later from the same ticket.',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
        <path d="M4 20h4L19 9l-4-4L4 16z" />
        <path d="M13.5 6.5l4 4" />
      </svg>
    ),
  },
]

/**
 * How to review BusHub and the bus company: three steps and a way to find the ticket. Shown
 * on the home page under the reviews and on the Reviews page, even before any review exists.
 */
export default function HowToReview({ showAllLink = false }: { showAllLink?: boolean }) {
  return (
    <section className="glass-lite mt-6 flex flex-col gap-4 p-4 sm:p-5" aria-labelledby="how-to-review">
      <div className="flex flex-col">
        <h2 id="how-to-review" className="text-[17px] font-bold">
          How to give a review
        </h2>
        <span className="text-[12.5px] font-semibold text-[#3f3f3f]">কীভাবে মতামত দেবেন</span>
      </div>
      <ol className="flex flex-col gap-3">
        {STEPS.map((s, i) => (
          <li key={i} className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[13px] bg-gradient-to-br from-[#feb249] to-[#f2661d] text-[#1a0d03]">{s.icon}</span>
            <span className="flex min-w-0 flex-col">
              <span className="text-[14px] font-bold">
                {i + 1}. {s.bn}
              </span>
              <span className="text-[12.5px] leading-relaxed text-[#3f3f3f]">{s.en}</span>
            </span>
          </li>
        ))}
      </ol>
      <p className="rounded-xl bg-white/60 px-3 py-2 text-[12px] leading-relaxed text-[#3f3f3f]">
        Only passengers with a real, paid BusHub ticket can post a review, so every review here is from a real trip. Your phone number and ticket number are never shown.
      </p>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Link href="/tickets" className="glass-btn btn-orange h-12 grow text-[14px]">
          Find my ticket · আমার টিকেট
        </Link>
        {showAllLink && (
          <Link href="/reviews" className="glass-btn glass-btn-plain h-12 grow text-[14px]">
            See all reviews →
          </Link>
        )}
      </div>
    </section>
  )
}

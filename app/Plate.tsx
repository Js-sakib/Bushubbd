/** A bus's number plate, styled like the plate itself so it stands out next to the route. */
export default function Plate({ plate, className = '' }: { plate?: string | null; className?: string }) {
  if (!plate) return null
  return (
    <span
      className={`inline-flex shrink-0 items-center whitespace-nowrap rounded-[5px] border border-[#f5a524] bg-[#f6f1ea] px-1.5 py-px font-mono text-[10.5px] font-bold leading-4 tracking-wide text-[#14191b] shadow-[0_0_0_2px_rgba(245,165,36,0.18)] ${className}`}
      title="Number plate"
    >
      {plate}
    </span>
  )
}

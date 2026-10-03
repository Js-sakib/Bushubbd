/** A bus's number plate, styled like the plate itself so it stands out next to the route. */
export default function Plate({ plate, className = '' }: { plate?: string | null; className?: string }) {
  if (!plate) return null
  return (
    <span
      className={`inline-flex shrink-0 items-center whitespace-nowrap rounded-[5px] border border-[#feb249] bg-[#fff8ec] px-1.5 py-px font-mono text-[10.5px] font-bold leading-4 tracking-wide text-[#100c0d] shadow-[0_0_0_2px_rgba(254,178,73,0.18)] ${className}`}
      title="Number plate"
    >
      {plate}
    </span>
  )
}

export function generateSeatLabels(totalSeats: number): string[] {
  return Array.from({ length: totalSeats }, (_, i) => `${Math.floor(i / 4) + 1}${String.fromCharCode(65 + (i % 4))}`)
}

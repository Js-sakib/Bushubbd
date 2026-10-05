import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'My tickets',
  description: 'Lost your BusHub ticket? Find it again with the mobile number or email you booked with, and download it.',
}

export default function TicketsLayout({ children }: { children: React.ReactNode }) {
  return children
}

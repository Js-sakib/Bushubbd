import type { Metadata } from 'next'
import { Toaster } from 'react-hot-toast'
import './globals.css'

export const metadata: Metadata = {
  title: 'BusHub - Book Bus Tickets Online',
  description: 'Fast & secure bus ticket booking in Bangladesh',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-gray-50">
        <nav className="bg-white shadow-sm border-b">
          <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
            <div className="text-2xl font-bold text-blue-600">🚌 BusHub</div>
            <div className="text-sm text-gray-600">24/7 Support</div>
          </div>
        </nav>
        
        <main className="max-w-7xl mx-auto px-4 py-8">
          {children}
        </main>

        <footer className="bg-gray-900 text-white mt-16 py-8 text-center">
          <p>© 2024 BusHub Bangladesh</p>
        </footer>

        <Toaster position="top-center" />
      </body>
    </html>
  )
}

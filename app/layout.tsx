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
            <a href="/" className="text-2xl font-bold text-blue-600">🚌 BusHub</a>
            <div className="flex items-center gap-4 text-sm">
              <a href="/company/register" className="text-gray-600 hover:text-blue-600">For Bus Operators</a>
              <a href="/company/login" className="text-gray-600 hover:text-blue-600">Operator Login</a>
              <span className="text-gray-300">|</span>
              <span className="text-gray-500">24/7 Support</span>
            </div>
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

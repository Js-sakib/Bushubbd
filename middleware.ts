import { NextRequest, NextResponse } from 'next/server'

/**
 * admin.<domain> and partner.<domain> are short addresses for the admin and operator panels.
 * They forward to the panel on the main site, so a login, its cookie and the page layout are
 * always the same ones whichever address was typed.
 */
const PANELS: [subdomain: string, prefix: string][] = [
  ['admin.', '/admin'],
  ['partner.', '/company'],
]

export function middleware(req: NextRequest) {
  // The Host header is the address the visitor typed; nextUrl can hold the server's own name.
  const host = req.headers.get('host') || ''
  const { pathname, search } = req.nextUrl

  for (const [subdomain, prefix] of PANELS) {
    if (!host.startsWith(subdomain)) continue
    const proto = req.headers.get('x-forwarded-proto') || req.nextUrl.protocol.replace(':', '') || 'https'
    const path = pathname === '/' ? prefix : pathname.startsWith(prefix) ? pathname : `${prefix}${pathname}`
    return NextResponse.redirect(`${proto}://www.${host.slice(subdomain.length)}${path}${search}`, 308)
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
}

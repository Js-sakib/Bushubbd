export function adminPath(path: '/admin' | '/admin/login'): string {
  if (typeof window !== 'undefined' && window.location.hostname.startsWith('admin.')) {
    return path === '/admin' ? '/' : path.replace(/^\/admin/, '')
  }
  return path
}

export function companyPath(path: '/company' | '/company/login' | '/company/register'): string {
  if (typeof window !== 'undefined' && window.location.hostname.startsWith('partner.')) {
    return path === '/company' ? '/' : path.replace(/^\/company/, '')
  }
  return path
}

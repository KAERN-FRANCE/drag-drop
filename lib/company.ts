/**
 * Helpers entreprise — version Better Auth + Railway
 * Remplace les anciens appels Supabase par des appels au endpoint /api/me.
 * Compatible avec tous les composants client existants sans changer leur interface.
 */

interface MeResponse {
  user: { id: string; email: string; name: string } | null
  companyId: number | null
  companyName: string | null
  role: string | null
}

// Cache court pour éviter les appels répétés dans la même page
let _meCache: MeResponse | null = null
let _meCacheTs = 0
const CACHE_TTL = 10_000 // 10 secondes

async function fetchMe(): Promise<MeResponse> {
  const now = Date.now()
  if (_meCache && now - _meCacheTs < CACHE_TTL) return _meCache

  try {
    const res = await fetch('/api/me', { credentials: 'include' })
    if (!res.ok) {
      _meCache = { user: null, companyId: null, companyName: null, role: null }
      _meCacheTs = now
      return _meCache
    }
    _meCache = await res.json()
    _meCacheTs = now
    return _meCache!
  } catch {
    return { user: null, companyId: null, companyName: null, role: null }
  }
}

/** Vide le cache (appeler après connexion / déconnexion) */
export function clearMeCache() {
  _meCache = null
  _meCacheTs = 0
}

/** Retourne le company_id de l'utilisateur connecté, ou null */
export async function getUserCompanyId(): Promise<string | null> {
  const me = await fetchMe()
  return me.companyId !== null ? String(me.companyId) : null
}

/** Retourne le rôle de l'utilisateur connecté ('admin' | 'driver' | 'manager' | null) */
export async function getUserRole(): Promise<string | null> {
  const me = await fetchMe()
  return me.role
}

/** Retourne true si l'utilisateur est admin */
export async function isUserAdmin(): Promise<boolean> {
  const role = await getUserRole()
  return role === 'admin'
}

/** Retourne l'utilisateur courant (id, email, name) ou null */
export async function getCurrentUser() {
  const me = await fetchMe()
  return me.user
}

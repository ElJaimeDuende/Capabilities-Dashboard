import { useState } from 'react'

// SHA-256 hash of password "capabilities2026"
// Change by running: python -c "import hashlib; print(hashlib.sha256(b'yourpassword').hexdigest())"
const PASSWORD_HASH = '69b8d4f81f68674bdbf3c0c41769cf764c5ed62d59d304d334b10173f4411236'

async function sha256(msg: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(msg))
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('')
}

interface Props { onSuccess: () => void }

export default function LoginScreen({ onSuccess }: Props) {
  const [pw, setPw] = useState('')
  const [error, setError] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(false)
    const hash = await sha256(pw)
    if (hash === PASSWORD_HASH) {
      sessionStorage.setItem('cap_auth', '1')
      onSuccess()
    } else {
      setError(true)
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F8FAFC]">
      <div className="w-full max-w-sm mx-4">
        <div className="bg-white rounded-2xl shadow-lg p-8">
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-[#1E3A5F] rounded-2xl flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <h1 className="text-xl font-semibold text-[#1E293B]">Capabilities Dashboard</h1>
            <p className="text-sm text-[#64748B] mt-1">Planning · Liderazgo Regional</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-[#1E293B] mb-1.5">Contraseña</label>
              <input
                type="password"
                value={pw}
                onChange={e => { setPw(e.target.value); setError(false) }}
                className={`w-full px-4 py-3 rounded-xl border text-[#1E293B] text-base outline-none transition-colors
                  ${error ? 'border-[#C62828] bg-[#FFEBEE]' : 'border-[#E2E8F0] focus:border-[#1E3A5F]'}`}
                placeholder="Ingresa tu contraseña"
                autoFocus
              />
              {error && <p className="text-[#C62828] text-sm mt-1.5">Contraseña incorrecta</p>}
            </div>
            <button
              type="submit"
              disabled={loading || !pw}
              className="w-full bg-[#1E3A5F] hover:bg-[#2C5282] disabled:opacity-50 text-white font-medium py-3 rounded-xl transition-colors text-base"
            >
              {loading ? 'Verificando...' : 'Ingresar'}
            </button>
          </form>
        </div>
        <p className="text-center text-xs text-[#94A3B8] mt-6">Acceso restringido · ABInBev Planning</p>
      </div>
    </div>
  )
}

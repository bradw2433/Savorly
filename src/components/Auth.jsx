import { useState } from 'react'

const T = {
  white: '#FAFAF8', offWhite: '#F2F0EB', black: '#111110', charcoal: '#2A2A28',
  brass: '#B8935A', brassLight: '#D4AD78', brassDark: '#8B6A3E',
  brassGlow: 'rgba(184,147,90,0.15)', border: 'rgba(184,147,90,0.25)',
  muted: '#7A7A72',
}

const LoadingDots = () => (
  <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
    {[0,1,2].map(i => (
      <div key={i} style={{
        width: 6, height: 6, borderRadius: '50%', background: T.white,
        animation: 'pulse 1.2s infinite', animationDelay: `${i * 0.2}s`,
      }} />
    ))}
  </div>
)

export default function Auth({ onSignIn, onSignUp, onReset }) {
  const [mode, setMode] = useState('signin') // signin | signup | reset
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [showPass, setShowPass] = useState(false)

  const handle = async () => {
    setError(''); setSuccess(''); setLoading(true)
    try {
      if (mode === 'signin') await onSignIn(email, password)
      else if (mode === 'signup') {
        await onSignUp(email, password)
        setSuccess('Account created! Check your email to confirm, then sign in.')
        setMode('signin')
      } else {
        await onReset(email)
        setSuccess('Password reset email sent — check your inbox.')
      }
    } catch (e) {
      setError(e.message || 'Something went wrong')
    }
    setLoading(false)
  }

  const titles = { signin: 'Welcome back', signup: 'Create account', reset: 'Reset password' }
  const buttons = { signin: 'Sign In', signup: 'Create Account', reset: 'Send Reset Email' }

  return (
    <div style={{
      height: '100%', background: T.black, display: 'flex', flexDirection: 'column',
      overflow: 'auto',
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;1,300;1,400&family=Jost:wght@300;400;500;600&display=swap');
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.4} }
        @keyframes fadeUp { from{opacity:0;transform:translateY(16px)} to{opacity:1;transform:translateY(0)} }
        * { box-sizing: border-box; margin: 0; padding: 0; font-family: 'Jost', sans-serif; }
        input { outline: none; }
      `}</style>

      <div style={{ height: 3, background: `linear-gradient(90deg, ${T.brass}, ${T.brassLight}, ${T.brass})` }} />

      <div style={{
        flex: 1, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', padding: '48px 28px',
        animation: 'fadeUp .45s ease both',
      }}>
        {/* Logo */}
        <div style={{
          width: 88, height: 88, borderRadius: 24,
          background: `linear-gradient(135deg, ${T.charcoal}, ${T.black})`,
          border: `1.5px solid ${T.border}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          marginBottom: 28, boxShadow: `0 0 60px ${T.brassGlow}`,
        }}>
          <svg width="44" height="44" viewBox="0 0 100 100">
            <path d="M50 18 C50 18 65 30 68 44 C70 54 65 62 58 66 C62 58 60 50 55 46 C56 52 53 57 50 60 C47 57 44 52 45 46 C40 50 38 58 42 66 C35 62 30 54 32 44 C35 30 50 18 50 18Z" fill={T.brass}/>
            <path d="M50 34 C50 34 58 42 59 50 C60 56 57 61 54 63 C56 58 55 53 52 50 C52.5 54 51 57 50 59 C49 57 47.5 54 48 50 C45 53 44 58 46 63 C43 61 40 56 41 50 C42 42 50 34 50 34Z" fill={T.brassLight} opacity=".85"/>
          </svg>
        </div>

        <h1 style={{
          fontFamily: "'Cormorant Garamond'", fontSize: 40, fontWeight: 300,
          color: T.white, marginBottom: 4,
        }}>Savorly</h1>
        <p style={{
          fontFamily: "'Cormorant Garamond'", fontStyle: 'italic',
          fontSize: 16, color: T.brass, marginBottom: 36,
        }}>Your personal recipe kitchen</p>

        {/* Mode tabs */}
        {mode !== 'reset' && (
          <div style={{
            display: 'flex', background: 'rgba(255,255,255,.06)', borderRadius: 10,
            padding: 4, marginBottom: 28, width: '100%', maxWidth: 340,
          }}>
            {['signin','signup'].map(m => (
              <button key={m} onClick={() => { setMode(m); setError(''); setSuccess('') }} style={{
                flex: 1, padding: '10px', borderRadius: 7, border: 'none',
                background: mode === m ? T.brass : 'transparent',
                color: mode === m ? T.white : T.muted,
                fontSize: 13, fontWeight: 500, letterSpacing: '.04em',
                transition: 'all .2s',
              }}>{m === 'signin' ? 'Sign In' : 'Sign Up'}</button>
            ))}
          </div>
        )}

        {mode === 'reset' && (
          <div style={{ width: '100%', maxWidth: 340, marginBottom: 20 }}>
            <button onClick={() => { setMode('signin'); setError(''); setSuccess('') }} style={{
              background: 'none', border: 'none', color: T.muted, fontSize: 13,
              display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer',
            }}>← Back to sign in</button>
          </div>
        )}

        <div style={{ width: '100%', maxWidth: 340 }}>
          <h2 style={{
            fontFamily: "'Cormorant Garamond'", fontSize: 26, fontWeight: 400,
            color: T.white, marginBottom: 20,
          }}>{titles[mode]}</h2>

          {/* Email */}
          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 12, color: T.muted, letterSpacing: '.06em', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>Email</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handle()}
              placeholder="you@example.com"
              style={{
                width: '100%', padding: '14px 16px',
                background: 'rgba(255,255,255,.06)', border: `1.5px solid ${T.border}`,
                borderRadius: 10, color: T.white, fontSize: 14,
              }}
            />
          </div>

          {/* Password */}
          {mode !== 'reset' && (
            <div style={{ marginBottom: 8, position: 'relative' }}>
              <label style={{ fontSize: 12, color: T.muted, letterSpacing: '.06em', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>Password</label>
              <input
                type={showPass ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handle()}
                placeholder={mode === 'signup' ? 'At least 6 characters' : '••••••••'}
                style={{
                  width: '100%', padding: '14px 44px 14px 16px',
                  background: 'rgba(255,255,255,.06)', border: `1.5px solid ${T.border}`,
                  borderRadius: 10, color: T.white, fontSize: 14,
                }}
              />
              <button onClick={() => setShowPass(!showPass)} style={{
                position: 'absolute', right: 12, bottom: 14,
                background: 'none', border: 'none', color: T.muted, cursor: 'pointer', fontSize: 16,
              }}>{showPass ? '🙈' : '👁'}</button>
            </div>
          )}

          {/* Forgot password link */}
          {mode === 'signin' && (
            <div style={{ textAlign: 'right', marginBottom: 20 }}>
              <button onClick={() => { setMode('reset'); setError(''); setSuccess('') }} style={{
                background: 'none', border: 'none', color: T.muted, fontSize: 12, cursor: 'pointer',
              }}>Forgot password?</button>
            </div>
          )}

          {error && (
            <div style={{
              background: 'rgba(239,154,154,.1)', border: '1px solid rgba(239,154,154,.3)',
              borderRadius: 8, padding: '10px 14px', marginBottom: 14,
              fontSize: 13, color: '#EF9A9A',
            }}>{error}</div>
          )}

          {success && (
            <div style={{
              background: 'rgba(165,214,167,.1)', border: '1px solid rgba(165,214,167,.3)',
              borderRadius: 8, padding: '10px 14px', marginBottom: 14,
              fontSize: 13, color: '#A5D6A7',
            }}>{success}</div>
          )}

          <button
            onClick={handle}
            disabled={loading || !email || (mode !== 'reset' && !password)}
            style={{
              width: '100%', padding: '16px',
              background: `linear-gradient(135deg, ${T.brass}, ${T.brassDark})`,
              border: 'none', borderRadius: 10, color: T.white,
              fontSize: 14, fontWeight: 500, letterSpacing: '.08em', textTransform: 'uppercase',
              cursor: loading ? 'default' : 'pointer',
              opacity: (!email || (mode !== 'reset' && !password)) ? .5 : 1,
              transition: 'all .2s',
            }}
          >
            {loading ? <LoadingDots /> : buttons[mode]}
          </button>
        </div>
      </div>
    </div>
  )
}

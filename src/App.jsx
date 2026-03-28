import { useState, useRef, useCallback, useEffect } from 'react'
import { useAuth } from './hooks/useAuth'
import { useRecipes } from './hooks/useRecipes'
import { usePreferences } from './hooks/usePreferences'
import { callClaude } from './lib/api'
import Auth from './components/Auth'

const fontLink = document.createElement('link')
fontLink.rel = 'stylesheet'
fontLink.href = 'https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;0,600;1,300;1,400&family=Jost:wght@300;400;500;600&display=swap'
document.head.appendChild(fontLink)

const T = {
  white: '#FAF8F0', offWhite: '#F0EBE0', black: '#100E0C', charcoal: '#2E2820',
  brass: '#D4C090', brassLight: '#E4D4A8', brassDark: '#7A6050',
  brassGlow: 'rgba(212,192,144,0.15)', border: 'rgba(212,192,144,0.28)',
  borderLight: 'rgba(212,192,144,0.13)', muted: '#8A7E70',
}

const gs = document.createElement('style')
gs.textContent = `
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  html, body, #root { height: 100%; background: ${T.black}; }
  body { font-family: 'Jost', sans-serif; -webkit-font-smoothing: antialiased; }
  ::-webkit-scrollbar { width: 4px; }
  ::-webkit-scrollbar-thumb { background: ${T.border}; border-radius: 2px; }
  textarea, input { outline: none; font-family: 'Jost', sans-serif; }
  button { cursor: pointer; font-family: 'Jost', sans-serif; }
  @keyframes fadeUp { from{opacity:0;transform:translateY(16px)} to{opacity:1;transform:translateY(0)} }
  @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.4} }
  @keyframes scaleIn { from{opacity:0;transform:scale(.92)} to{opacity:1;transform:scale(1)} }
  @keyframes slideUp { from{opacity:0;transform:translateY(20px)} to{opacity:1;transform:translateY(0)} }
  .fade-up { animation: fadeUp .45s cubic-bezier(.22,.68,0,1.2) both; }
  .scale-in { animation: scaleIn .35s cubic-bezier(.22,.68,0,1.2) both; }
  .btn-brass {
    background: linear-gradient(135deg, ${T.brass}, ${T.brassDark});
    color: ${T.white}; border: none; border-radius: 8px;
    padding: 14px 28px; font-size: 13px; font-weight: 500;
    letter-spacing: .08em; text-transform: uppercase; transition: all .25s;
  }
  .btn-brass:hover { transform: translateY(-1px); box-shadow: 0 8px 24px rgba(212,192,144,.4); }
  .btn-brass:active { transform: translateY(0); }
  .btn-brass:disabled { opacity:.5; transform:none; box-shadow:none; cursor:default; }
  .btn-ghost {
    background: transparent; color: ${T.brass}; border: 1px solid ${T.border};
    border-radius: 8px; padding: 12px 24px; font-size: 13px; font-weight: 500;
    letter-spacing: .06em; text-transform: uppercase; transition: all .2s;
  }
  .btn-ghost:hover { background: ${T.brassGlow}; border-color: ${T.brass}; }
  .card {
    background: ${T.white}; border-radius: 16px; overflow: hidden;
    transition: all .3s cubic-bezier(.22,.68,0,1.2);
  }
  .card:hover { transform: translateY(-3px); box-shadow: 0 20px 50px rgba(0,0,0,.15); }
  .input-field {
    background: ${T.offWhite}; border: 1.5px solid ${T.borderLight};
    border-radius: 10px; padding: 14px 18px; font-size: 14px;
    color: ${T.charcoal}; width: 100%; transition: border .2s;
  }
  .input-field:focus { border-color: ${T.brass}; background: ${T.white}; }
  .input-field::placeholder { color: ${T.muted}; }
  .loading-dots span {
    display:inline-block; width:6px; height:6px; border-radius:50%;
    background:${T.brass}; margin:0 3px; animation: pulse 1.2s infinite;
  }
  .loading-dots span:nth-child(2){ animation-delay:.2s; }
  .loading-dots span:nth-child(3){ animation-delay:.4s; }
  .chat-user {
    background: linear-gradient(135deg, ${T.brass}, ${T.brassDark});
    color: ${T.white}; border-radius: 18px 18px 4px 18px;
    padding: 10px 14px; font-size: 14px; line-height: 1.5;
    max-width: 80%; align-self: flex-end;
    animation: slideUp .25s ease both;
  }
  .chat-ai {
    background: ${T.white}; color: ${T.charcoal};
    border-radius: 18px 18px 18px 4px; border: 1px solid ${T.borderLight};
    padding: 10px 14px; font-size: 14px; line-height: 1.5;
    max-width: 88%; align-self: flex-start;
    animation: slideUp .25s ease both;
  }
`
document.head.appendChild(gs)

const toBase64 = (file) => new Promise((res,rej) => {
  const r = new FileReader(); r.onload = () => res(r.result.split(',')[1]); r.onerror = rej; r.readAsDataURL(file)
})

const parseRecipe = (raw = '') => {
  const lines = raw.split('\n').map(l => l.trim()).filter(Boolean)
  let title='', description='', servings='4', prepTime='', cookTime=''
  let ingredients=[], steps=[], notes='', section=''
  for (const line of lines) {
    const low = line.toLowerCase()
    if (low.startsWith('# ') || (!title && !low.startsWith('##'))) { if (!title) { title = line.replace(/^#+\s*/,''); continue } }
    if (low.includes('ingredient')) { section='ingredients'; continue }
    if (low.includes('instruction')||low.includes('direction')||low.includes('step')||low.includes('method')) { section='steps'; continue }
    if (low.includes('note')) { section='notes'; continue }
    if (low.startsWith('serves')||low.startsWith('servings')) { const m=line.match(/[\d]+(?:\s*[-–]\s*[\d]+)?/); servings=m?m[0].replace(/\s/g,''):'4'; continue }
    if (low.startsWith('prep')) { prepTime=line.replace(/prep\s*time:?\s*/i,''); continue }
    if (low.startsWith('cook')) { cookTime=line.replace(/cook\s*time:?\s*/i,''); continue }
    if (!section && !description && line.length>40) { description=line; continue }
    if (section==='ingredients') { const c=line.replace(/^[-•*]\s*/,''); if(c) ingredients.push(c) }
    else if (section==='steps') { const c=line.replace(/^\d+[.)]\s*/,''); if(c) steps.push(c) }
    else if (section==='notes') { notes+=line+' ' }
  }
  return { title:title||'Recipe', description, servings, prepTime, cookTime, ingredients, steps, notes:notes.trim() }
}

const splitIngredient = (ing) => {
  const m = ing.match(/^([\d\/\s\.\-]+(?:cups?|tbsps?|tsps?|tablespoons?|teaspoons?|oz|ounces?|lbs?|pounds?|g|kg|ml|cloves?|large|medium|small|pinch|handful|bunch|cans?|slices?|pieces?)\.?\s*)/i)
  if (m) return { amount: m[1].trim(), name: ing.slice(m[1].length).trim() }
  return { amount:'', name:ing }
}

const LoadingDots = () => <div className="loading-dots"><span/><span/><span/></div>

const Icon = ({ name, size=20, color='currentColor' }) => {
  const d = {
    search:<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>,
    heart:<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>,
    heartFill:<svg width={size} height={size} viewBox="0 0 24 24" fill={color} stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>,
    camera:<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>,
    star:<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>,
    starFill:<svg width={size} height={size} viewBox="0 0 24 24" fill={color} stroke={color} strokeWidth="1.8"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>,
    plus:<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round"><path d="M12 5v14M5 12h14"/></svg>,
    chef:<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M6 13.87A4 4 0 0 1 7.41 6a5.11 5.11 0 0 1 1.05-1.54 5 5 0 0 1 7.08 0A5.11 5.11 0 0 1 16.59 6 4 4 0 0 1 18 13.87V21H6Z"/><line x1="6" y1="17" x2="18" y2="17"/></svg>,
    grid:<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>,
    back:<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>,
    close:<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>,
    photo:<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>,
    trash:<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>,
    sparkle:<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3L13.5 8.5L19 10L13.5 11.5L12 17L10.5 11.5L5 10L10.5 8.5Z"/><path d="M5 3L5.75 5.25L8 6L5.75 6.75L5 9L4.25 6.75L2 6L4.25 5.25Z"/><path d="M19 17L19.75 19.25L22 20L19.75 20.75L19 23L18.25 20.75L16 20L18.25 19.25Z"/></svg>,
    menu:<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
    clock:<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>,
    users:<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
    fridge:<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="5" y="2" width="14" height="20" rx="2"/><line x1="5" y1="10" x2="19" y2="10"/><line x1="9" y1="6" x2="9" y2="8"/><line x1="9" y1="14" x2="9" y2="16"/></svg>,
    logout:<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>,
    check:<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>,
    chat:<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>,
    send:<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>,
    wand:<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M15 4V2"/><path d="M15 16v-2"/><path d="M8 9h2"/><path d="M20 9h2"/><path d="M17.8 11.8 19 13"/><path d="M15 9h0"/><path d="M17.8 6.2 19 5"/><path d="m3 21 9-9"/><path d="M12.2 6.2 11 5"/></svg>,
    shield:<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>,
    settings:<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>,
  }
  return d[name]||null
}

const Stars = ({value,onChange}) => (
  <div style={{display:'flex',gap:4}}>
    {[1,2,3,4,5].map(n=>(
      <button key={n} onClick={()=>onChange?.(n)} style={{background:'none',border:'none',padding:2}}>
        <Icon name={n<=value?'starFill':'star'} size={18} color={n<=value?T.brass:T.border}/>
      </button>
    ))}
  </div>
)

const BrassDivider = ({label}) => (
  <div style={{display:'flex',alignItems:'center',gap:16,margin:'24px 0'}}>
    <div style={{flex:1,height:1,background:`linear-gradient(90deg,transparent,${T.border})`}}/>
    {label&&<span style={{fontFamily:"'Cormorant Garamond'",fontStyle:'italic',color:T.brass,fontSize:13,letterSpacing:'.08em'}}>{label}</span>}
    <div style={{flex:1,height:1,background:`linear-gradient(90deg,${T.border},transparent)`}}/>
  </div>
)

// ══════════════════════════════════════════════════════════════════════════
// RECIPE CHAT PANEL
// ══════════════════════════════════════════════════════════════════════════
const RecipeChatPanel = ({recipe, onRecipeUpdate, onClose}) => {
  const [messages, setMessages] = useState([
    {role:'ai', text:"I've got your recipe ready! Ask me anything — swap an ingredient, adjust servings, make it spicier, cut cook time, or anything else. What would you like to tweak?"}
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef()
  const inputRef = useRef()

  useEffect(()=>{ bottomRef.current?.scrollIntoView({behavior:'smooth'}) },[messages])

  const quickPrompts = ['Make it spicier 🌶️','Make it vegetarian 🥦','Cut servings in half','Substitute the butter','Add a wine pairing','Simplify the steps']

  const send = async (text) => {
    const msg = text||input.trim()
    if (!msg||loading) return
    setInput('')
    setMessages(prev=>[...prev,{role:'user',text:msg}])
    setLoading(true)
    try {
      const system = `You are a helpful chef assistant. The user wants to modify or ask about this recipe:\n\n${recipe.raw}\n\nIf they request changes (swap ingredient, adjust servings, dietary changes, spice level, technique, etc.), respond with the FULL updated recipe in the EXACT same format — starting with # Title. If they ask a conversational question (wine pairing, storage tips, etc.), answer conversationally without rewriting the recipe. Be warm and concise.`
      const hist = messages.slice(-6).map(m=>({role:m.role==='user'?'user':'assistant',content:m.text}))
      const response = await callClaude([...hist,{role:'user',content:msg}], system)
      const isRecipeUpdate = response.includes('## Ingredients') && /^#\s/m.test(response)
      if (isRecipeUpdate) { onRecipeUpdate(response) }
      setMessages(prev=>[...prev,{role:'ai',text:response,isUpdate:isRecipeUpdate}])
    } catch(e) {
      setMessages(prev=>[...prev,{role:'ai',text:'Sorry, something went wrong. Try again!'}])
    }
    setLoading(false)
  }

  return (
    <div style={{position:'fixed',inset:0,zIndex:200,display:'flex',flexDirection:'column',background:T.white}}>
      <div style={{background:T.charcoal,padding:'18px 20px',display:'flex',alignItems:'center',gap:14,flexShrink:0,borderBottom:`1px solid ${T.border}`}}>
        <button onClick={onClose} style={{background:'none',border:'none',display:'flex',alignItems:'center'}}>
          <Icon name="back" size={20} color={T.white}/>
        </button>
        <div style={{width:36,height:36,borderRadius:10,background:`linear-gradient(135deg,${T.brass},${T.brassDark})`,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
          <Icon name="chat" size={18} color={T.white}/>
        </div>
        <div>
          <div style={{fontFamily:"'Cormorant Garamond'",fontSize:20,fontWeight:500,color:T.white}}>Recipe Chat</div>
          <div style={{fontSize:11,color:T.muted}}>Modify or ask anything about this recipe</div>
        </div>
      </div>

      <div style={{flex:1,overflow:'auto',padding:'16px 14px 8px',display:'flex',flexDirection:'column',gap:12,background:T.offWhite}}>
        {messages.map((m,i)=>(
          <div key={i} style={{display:'flex',justifyContent:m.role==='user'?'flex-end':'flex-start'}}>
            {m.isUpdate ? (
              <div style={{background:T.white,border:`1px solid ${T.border}`,borderRadius:16,padding:'14px 16px',maxWidth:'90%',animation:'slideUp .25s ease both'}}>
                <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:8}}>
                  <Icon name="wand" size={14} color={T.brass}/>
                  <span style={{fontSize:11,fontWeight:600,color:T.brass,letterSpacing:'.08em',textTransform:'uppercase'}}>Recipe Updated ✓</span>
                </div>
                <p style={{fontFamily:"'Cormorant Garamond'",fontStyle:'italic',fontSize:15,color:T.charcoal,lineHeight:1.5}}>
                  {parseRecipe(m.text).title} — tap back to see changes
                </p>
              </div>
            ) : (
              <div className={m.role==='user'?'chat-user':'chat-ai'}>{m.text}</div>
            )}
          </div>
        ))}
        {loading&&(
          <div style={{display:'flex',justifyContent:'flex-start'}}>
            <div className="chat-ai" style={{paddingTop:12,paddingBottom:12}}><LoadingDots/></div>
          </div>
        )}
        <div ref={bottomRef}/>
      </div>

      <div style={{padding:'8px 12px 4px',background:T.white,borderTop:`1px solid ${T.borderLight}`,display:'flex',gap:8,overflowX:'auto',flexShrink:0}}>
        {quickPrompts.map(qp=>(
          <button key={qp} onClick={()=>send(qp)} style={{flexShrink:0,background:T.offWhite,border:`1px solid ${T.borderLight}`,borderRadius:20,padding:'6px 12px',fontSize:12,color:T.charcoal,whiteSpace:'nowrap'}}>
            {qp}
          </button>
        ))}
      </div>

      <div style={{padding:'10px 12px 20px',background:T.white,display:'flex',gap:10,flexShrink:0}}>
        <input ref={inputRef} value={input} onChange={e=>setInput(e.target.value)}
          onKeyDown={e=>e.key==='Enter'&&!e.shiftKey&&send()}
          placeholder="Ask anything or request a change…"
          style={{flex:1,padding:'12px 16px',background:T.offWhite,border:`1.5px solid ${T.borderLight}`,borderRadius:24,fontSize:14,color:T.charcoal,outline:'none'}}
        />
        <button onClick={()=>send()} disabled={!input.trim()||loading} style={{width:44,height:44,borderRadius:'50%',border:'none',flexShrink:0,background:input.trim()?`linear-gradient(135deg,${T.brass},${T.brassDark})`:T.offWhite,display:'flex',alignItems:'center',justifyContent:'center',transition:'all .2s'}}>
          <Icon name="send" size={16} color={input.trim()?T.white:T.muted}/>
        </button>
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════
// POLISHED RECIPE CARD (Favorites list)
// ══════════════════════════════════════════════════════════════════════════
const PolishedRecipeCard = ({recipe, onClick, onUnfavorite}) => {
  const p = parseRecipe(recipe.raw)
  const thumb = recipe.photos?.[0]
  return (
    <div onClick={onClick} style={{background:T.white,borderRadius:20,overflow:'hidden',cursor:'pointer',border:`1px solid ${T.borderLight}`,boxShadow:'0 4px 24px rgba(0,0,0,.07)',transition:'all .3s cubic-bezier(.22,.68,0,1.2)',marginBottom:20}}
      onMouseEnter={e=>{e.currentTarget.style.transform='translateY(-3px)';e.currentTarget.style.boxShadow='0 16px 48px rgba(0,0,0,.12)'}}
      onMouseLeave={e=>{e.currentTarget.style.transform='';e.currentTarget.style.boxShadow='0 4px 24px rgba(0,0,0,.07)'}}>
      <div style={{position:'relative',height:190,overflow:'hidden'}}>
        {thumb ? <img src={thumb} alt="" style={{width:'100%',height:'100%',objectFit:'cover'}}/> :
          <div style={{width:'100%',height:'100%',background:`linear-gradient(135deg,${T.charcoal} 0%,#1e1e1c 50%,${T.brassDark}33 100%)`,display:'flex',alignItems:'center',justifyContent:'center'}}>
            <div style={{opacity:.15}}><Icon name="chef" size={64} color={T.brass}/></div>
          </div>}
        <div style={{position:'absolute',inset:0,background:'linear-gradient(to top,rgba(0,0,0,.82) 0%,transparent 55%)'}}/>
        <button onClick={e=>{e.stopPropagation();onUnfavorite(recipe)}} style={{position:'absolute',top:12,right:12,width:36,height:36,background:T.brass,border:'none',borderRadius:'50%',display:'flex',alignItems:'center',justifyContent:'center',boxShadow:'0 2px 8px rgba(0,0,0,.3)'}}>
          <Icon name="heartFill" size={16} color={T.white}/>
        </button>
        {recipe.rating>0&&(
          <div style={{position:'absolute',top:12,left:12,background:'rgba(0,0,0,.55)',backdropFilter:'blur(4px)',borderRadius:20,padding:'4px 10px',display:'flex',alignItems:'center',gap:4}}>
            <Icon name="starFill" size={11} color={T.brassLight}/>
            <span style={{fontSize:12,color:T.white,fontWeight:500}}>{recipe.rating}.0</span>
          </div>
        )}
        <div style={{position:'absolute',bottom:0,left:0,right:0,padding:'14px 18px'}}>
          <h2 style={{fontFamily:"'Cormorant Garamond'",fontSize:26,fontWeight:400,color:T.white,lineHeight:1.15}}>{p.title}</h2>
          {p.description&&<p style={{fontFamily:"'Cormorant Garamond'",fontStyle:'italic',fontSize:13,color:'rgba(255,255,255,.7)',marginTop:3,lineHeight:1.4}}>{p.description}</p>}
        </div>
      </div>

      <div style={{display:'flex',borderBottom:`1px solid ${T.borderLight}`,background:T.offWhite}}>
        {[p.prepTime&&{l:'Prep',v:p.prepTime}, p.cookTime&&{l:'Cook',v:p.cookTime}, p.servings&&{l:'Serves',v:p.servings}].filter(Boolean).map((m,i,a)=>(
          <div key={i} style={{flex:1,padding:'10px 8px',textAlign:'center',borderRight:i<a.length-1?`1px solid ${T.borderLight}`:'none'}}>
            <div style={{fontSize:9,color:T.muted,letterSpacing:'.1em',textTransform:'uppercase',marginBottom:2}}>{m.l}</div>
            <div style={{fontSize:14,fontWeight:500,color:T.charcoal}}>{m.v}</div>
          </div>
        ))}
      </div>

      <div style={{padding:'14px 18px 18px'}}>
        <div style={{fontSize:10,fontWeight:600,letterSpacing:'.16em',textTransform:'uppercase',color:T.brass,marginBottom:10}}>Ingredients</div>
        <div style={{display:'flex',flexWrap:'wrap',gap:6}}>
          {p.ingredients.slice(0,6).map((ing,i)=>{
            const {name}=splitIngredient(ing)
            return <span key={i} style={{fontSize:12,background:T.offWhite,color:T.charcoal,border:`1px solid ${T.borderLight}`,borderRadius:20,padding:'4px 10px',fontFamily:"'Cormorant Garamond'",fontStyle:'italic'}}>{name}</span>
          })}
          {p.ingredients.length>6&&<span style={{fontSize:12,color:T.brass,padding:'4px 6px',fontStyle:'italic'}}>+{p.ingredients.length-6} more</span>}
        </div>
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════
// POLISHED RECIPE DETAIL (Favorites view)
// ══════════════════════════════════════════════════════════════════════════
const PolishedRecipeDetail = ({recipe, onClose, onUnfavorite, onUpdate}) => {
  const [tab, setTab] = useState('recipe')
  const [photos, setPhotos] = useState(recipe.photos||[])
  const [rating, setRating] = useState(recipe.rating||0)
  const [note, setNote] = useState(recipe.notes||'')
  const [editingNote, setEditingNote] = useState(false)
  const fileRef = useRef()
  const p = parseRecipe(recipe.raw)

  const addPhoto=(e)=>{const file=e.target.files[0];if(!file)return;const r=new FileReader();r.onload=ev=>{const u=[...photos,ev.target.result];setPhotos(u);onUpdate?.({...recipe,photos:u})};r.readAsDataURL(file)}
  const removePhoto=(i)=>{const u=photos.filter((_,idx)=>idx!==i);setPhotos(u);onUpdate?.({...recipe,photos:u})}
  const saveRating=(r)=>{setRating(r);onUpdate?.({...recipe,rating:r})}
  const saveNote=()=>{setEditingNote(false);onUpdate?.({...recipe,notes:note})}

  return (
    <div style={{position:'fixed',inset:0,background:T.white,zIndex:100,overflow:'hidden',display:'flex',flexDirection:'column'}}>
      <div style={{position:'relative',flexShrink:0,minHeight:280,overflow:'hidden'}}>
        {photos[0] ? <img src={photos[0]} alt="" style={{width:'100%',height:280,objectFit:'cover'}}/> :
          <div style={{height:280,background:`linear-gradient(160deg,${T.charcoal} 0%,#1a1a18 60%,${T.brassDark}44 100%)`,display:'flex',alignItems:'center',justifyContent:'center'}}>
            <div style={{opacity:.1}}><Icon name="chef" size={100} color={T.brass}/></div>
          </div>}
        <div style={{position:'absolute',inset:0,background:'linear-gradient(to top,rgba(0,0,0,.9) 0%,rgba(0,0,0,.3) 55%,transparent 100%)'}}/>
        <button onClick={onClose} style={{position:'absolute',top:20,left:20,width:42,height:42,background:'rgba(0,0,0,.55)',backdropFilter:'blur(8px)',border:`1px solid ${T.border}`,borderRadius:'50%',display:'flex',alignItems:'center',justifyContent:'center'}}>
          <Icon name="back" size={18} color={T.white}/>
        </button>
        <button onClick={()=>onUnfavorite(recipe)} style={{position:'absolute',top:20,right:20,width:42,height:42,background:T.brass,border:'none',borderRadius:'50%',display:'flex',alignItems:'center',justifyContent:'center',boxShadow:'0 4px 12px rgba(212,192,144,.5)'}}>
          <Icon name="heartFill" size={18} color={T.white}/>
        </button>
        <div style={{position:'absolute',bottom:0,left:0,right:0,padding:'20px 24px 18px'}}>
          <div style={{fontSize:10,letterSpacing:'.2em',textTransform:'uppercase',color:T.brassLight,marginBottom:6,fontFamily:"'Jost',sans-serif",fontWeight:500}}>✦ Saved Recipe</div>
          <h1 style={{fontFamily:"'Cormorant Garamond'",fontSize:34,fontWeight:400,color:T.white,lineHeight:1.1,marginBottom:6}}>{p.title}</h1>
          {p.description&&<p style={{fontFamily:"'Cormorant Garamond'",fontStyle:'italic',fontSize:15,color:'rgba(255,255,255,.7)',lineHeight:1.4,marginBottom:10}}>{p.description}</p>}
          <Stars value={rating} onChange={saveRating}/>
        </div>
      </div>

      <div style={{display:'flex',background:T.offWhite,borderBottom:`1px solid ${T.borderLight}`,flexShrink:0}}>
        {[p.prepTime&&{l:'Prep',v:p.prepTime}, p.cookTime&&{l:'Cook',v:p.cookTime}, p.servings&&{l:'Serves',v:p.servings}].filter(Boolean).map((m,i,a)=>(
          <div key={i} style={{flex:1,padding:'12px 8px',textAlign:'center',borderRight:i<a.length-1?`1px solid ${T.borderLight}`:'none'}}>
            <div style={{fontSize:9,color:T.muted,letterSpacing:'.12em',textTransform:'uppercase',marginBottom:3}}>{m.l}</div>
            <div style={{fontSize:15,fontWeight:500,color:T.charcoal}}>{m.v}</div>
          </div>
        ))}
      </div>

      <div style={{background:T.white,display:'flex',borderBottom:`1px solid ${T.borderLight}`,flexShrink:0}}>
        {['recipe','photos','notes'].map(t=>(
          <button key={t} onClick={()=>setTab(t)} style={{flex:1,padding:'14px 8px',background:'none',border:'none',borderBottom:tab===t?`2px solid ${T.brass}`:'2px solid transparent',color:tab===t?T.brass:T.muted,fontSize:11,fontWeight:600,letterSpacing:'.12em',textTransform:'uppercase',transition:'all .2s'}}>
            {t==='photos'?`Photos (${photos.length})`:t.charAt(0).toUpperCase()+t.slice(1)}
          </button>
        ))}
      </div>

      <div style={{flex:1,overflow:'auto'}}>
        {tab==='recipe'&&(
          <div style={{padding:'32px 24px 48px',maxWidth:680,margin:'0 auto',fontFamily:"'Cormorant Garamond',serif"}}>
            <div style={{marginBottom:40}}>
              <div style={{fontSize:11,fontFamily:"'Jost',sans-serif",fontWeight:600,letterSpacing:'.18em',textTransform:'uppercase',color:T.brass,marginBottom:14}}>Ingredients</div>
              {p.ingredients.map((ing,i)=>{
                const {amount,name}=splitIngredient(ing)
                return (
                  <div key={i} style={{display:'flex',alignItems:'baseline',gap:12,padding:'9px 0',borderBottom:`1px solid ${T.borderLight}`}}>
                    <span style={{minWidth:90,fontSize:15,fontWeight:600,color:T.charcoal}}>{amount||'—'}</span>
                    <span style={{fontSize:15,color:T.charcoal,fontStyle:'italic'}}>{name}</span>
                  </div>
                )
              })}
            </div>

            <div style={{display:'flex',alignItems:'center',gap:12,margin:'32px 0 28px'}}>
              <div style={{flex:1,height:1,background:`linear-gradient(90deg,transparent,${T.border})`}}/>
              <span style={{color:T.brass,fontSize:18}}>✦</span>
              <div style={{flex:1,height:1,background:`linear-gradient(90deg,${T.border},transparent)`}}/>
            </div>

            <div style={{marginBottom:40}}>
              <div style={{fontSize:11,fontFamily:"'Jost',sans-serif",fontWeight:600,letterSpacing:'.18em',textTransform:'uppercase',color:T.brass,marginBottom:14}}>Method</div>
              {p.steps.map((step,i)=>(
                <div key={i} style={{display:'flex',gap:20,marginBottom:28,alignItems:'flex-start'}}>
                  <div style={{flexShrink:0,width:36,height:36,borderRadius:'50%',background:`linear-gradient(135deg,${T.brass},${T.brassDark})`,display:'flex',alignItems:'center',justifyContent:'center'}}>
                    <span style={{fontFamily:"'Cormorant Garamond'",fontSize:18,fontWeight:500,color:T.white}}>{i+1}</span>
                  </div>
                  <p style={{fontSize:16,lineHeight:1.75,color:T.charcoal,paddingTop:6}}>{step}</p>
                </div>
              ))}
            </div>

            {p.notes&&(
              <div style={{background:`linear-gradient(135deg,${T.brassGlow},rgba(212,192,144,.04))`,border:`1px solid ${T.border}`,borderLeft:`3px solid ${T.brass}`,borderRadius:'0 12px 12px 0',padding:'18px 20px'}}>
                <div style={{fontSize:11,fontFamily:"'Jost',sans-serif",fontWeight:600,letterSpacing:'.18em',textTransform:'uppercase',color:T.brass,marginBottom:8}}>Chef's Notes</div>
                <p style={{fontStyle:'italic',fontSize:16,color:T.charcoal,lineHeight:1.7}}>{p.notes}</p>
              </div>
            )}
          </div>
        )}

        {tab==='photos'&&(
          <div style={{padding:24}}>
            <input ref={fileRef} type="file" accept="image/*" style={{display:'none'}} onChange={addPhoto}/>
            <button className="btn-brass" onClick={()=>fileRef.current.click()} style={{width:'100%',marginBottom:20,display:'flex',alignItems:'center',justifyContent:'center',gap:8}}>
              <Icon name="camera" size={16} color={T.white}/> Add Photo
            </button>
            {photos.length===0&&<div style={{textAlign:'center',padding:'48px 24px',color:T.muted}}><Icon name="photo" size={48} color={T.border}/><p style={{marginTop:12,fontFamily:"'Cormorant Garamond'",fontStyle:'italic',fontSize:18}}>No photos yet</p></div>}
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
              {photos.map((src,i)=>(
                <div key={i} style={{position:'relative',borderRadius:12,overflow:'hidden',aspectRatio:'1'}}>
                  <img src={src} alt="" style={{width:'100%',height:'100%',objectFit:'cover'}}/>
                  <button onClick={()=>removePhoto(i)} style={{position:'absolute',top:8,right:8,width:32,height:32,background:'rgba(0,0,0,.6)',border:'none',borderRadius:'50%',display:'flex',alignItems:'center',justifyContent:'center'}}>
                    <Icon name="trash" size={14} color={T.white}/>
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {tab==='notes'&&(
          <div style={{padding:24}}>
            <p style={{fontSize:13,color:T.muted,marginBottom:16}}>Personal notes, substitutions, tweaks…</p>
            {editingNote ? (
              <div>
                <textarea value={note} onChange={e=>setNote(e.target.value)} rows={8} className="input-field" style={{resize:'none',lineHeight:1.6}} placeholder="Add your notes here…"/>
                <div style={{display:'flex',gap:12,marginTop:12}}><button className="btn-brass" onClick={saveNote}>Save Notes</button><button className="btn-ghost" onClick={()=>setEditingNote(false)}>Cancel</button></div>
              </div>
            ) : (
              <div>
                {note ? <div style={{background:T.offWhite,borderRadius:12,padding:20,borderLeft:`3px solid ${T.brass}`,marginBottom:16}}><p style={{fontFamily:"'Cormorant Garamond'",fontStyle:'italic',fontSize:17,lineHeight:1.7,color:T.charcoal}}>{note}</p></div>
                      : <div style={{textAlign:'center',padding:'40px 24px',color:T.muted}}><Icon name="star" size={40} color={T.border}/><p style={{marginTop:12,fontFamily:"'Cormorant Garamond'",fontStyle:'italic',fontSize:18}}>No notes yet</p></div>}
                <button className="btn-ghost" onClick={()=>setEditingNote(true)} style={{width:'100%'}}>{note?'Edit Notes':'Add Notes'}</button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Standard Recipe Card ───────────────────────────────────────────────────
const RecipeCard = ({recipe, onClick, onFavorite, isFavorited}) => {
  const p = parseRecipe(recipe.raw)
  const thumb = recipe.photos?.[0]
  return (
    <div className="card" onClick={onClick} style={{cursor:'pointer',border:`1px solid ${T.borderLight}`}}>
      <div style={{position:'relative',aspectRatio:'16/9',overflow:'hidden'}}>
        {thumb ? <img src={thumb} alt="" style={{width:'100%',height:'100%',objectFit:'cover'}}/> :
          <div style={{width:'100%',height:'100%',background:`linear-gradient(135deg,${T.charcoal},${T.black})`,display:'flex',alignItems:'center',justifyContent:'center'}}>
            <Icon name="chef" size={36} color={T.brass}/>
          </div>}
        <div style={{position:'absolute',inset:0,background:'linear-gradient(to top,rgba(0,0,0,.6) 0%,transparent 60%)'}}/>
        <button onClick={e=>{e.stopPropagation();onFavorite(recipe)}} style={{position:'absolute',top:10,right:10,width:34,height:34,background:isFavorited?T.brass:'rgba(0,0,0,.45)',border:'none',borderRadius:'50%',display:'flex',alignItems:'center',justifyContent:'center',transition:'all .25s'}}>
          <Icon name={isFavorited?'heartFill':'heart'} size={15} color={T.white}/>
        </button>
        {recipe.rating>0&&(
          <div style={{position:'absolute',bottom:10,right:10,background:'rgba(0,0,0,.55)',borderRadius:20,padding:'3px 9px',display:'flex',alignItems:'center',gap:4}}>
            <Icon name="starFill" size={11} color={T.brassLight}/>
            <span style={{fontSize:12,color:T.white}}>{recipe.rating}</span>
          </div>
        )}
      </div>
      <div style={{padding:'14px 16px 16px'}}>
        <h3 style={{fontFamily:"'Cormorant Garamond'",fontSize:20,fontWeight:500,color:T.charcoal,marginBottom:8,lineHeight:1.2}}>{p.title}</h3>
        <div style={{display:'flex',gap:14,flexWrap:'wrap'}}>
          {p.prepTime&&<span style={{fontSize:11,color:T.muted,display:'flex',alignItems:'center',gap:4}}><Icon name="clock" size={11} color={T.brass}/>Prep {p.prepTime}</span>}
          {p.cookTime&&<span style={{fontSize:11,color:T.muted,display:'flex',alignItems:'center',gap:4}}><Icon name="clock" size={11} color={T.brass}/>Cook {p.cookTime}</span>}
          {p.servings&&<span style={{fontSize:11,color:T.muted,display:'flex',alignItems:'center',gap:4}}><Icon name="users" size={11} color={T.brass}/>Serves {p.servings}</span>}
        </div>
      </div>
    </div>
  )
}

// ── Standard Recipe Detail (Collection) ───────────────────────────────────
const RecipeDetail = ({recipe, onClose, onFavorite, isFavorited, onUpdate}) => {
  const [tab,setTab]=useState('recipe')
  const [photos,setPhotos]=useState(recipe.photos||[])
  const [rating,setRating]=useState(recipe.rating||0)
  const [note,setNote]=useState(recipe.notes||'')
  const [editingNote,setEditingNote]=useState(false)
  const [showChat,setShowChat]=useState(false)
  const [currentRaw,setCurrentRaw]=useState(recipe.raw)
  const fileRef=useRef()
  const p=parseRecipe(currentRaw)
  const addPhoto=(e)=>{const f=e.target.files[0];if(!f)return;const r=new FileReader();r.onload=ev=>{const u=[...photos,ev.target.result];setPhotos(u);onUpdate?.({...recipe,photos:u})};r.readAsDataURL(f)}
  const removePhoto=(i)=>{const u=photos.filter((_,idx)=>idx!==i);setPhotos(u);onUpdate?.({...recipe,photos:u})}
  const saveRating=(r)=>{setRating(r);onUpdate?.({...recipe,rating:r})}
  const saveNote=()=>{setEditingNote(false);onUpdate?.({...recipe,notes:note})}
  const handleRecipeUpdate=(newRaw)=>{ setCurrentRaw(newRaw); onUpdate?.({...recipe,raw:newRaw}) }
  return (
    <div style={{position:'fixed',inset:0,background:T.black,zIndex:100,overflow:'hidden',display:'flex',flexDirection:'column'}}>
      {showChat&&<RecipeChatPanel recipe={{...recipe,raw:currentRaw}} onRecipeUpdate={handleRecipeUpdate} onClose={()=>setShowChat(false)}/>}
      <div style={{position:'relative',minHeight:260,flexShrink:0,overflow:'hidden'}}>
        {photos[0]?<img src={photos[0]} alt="" style={{width:'100%',height:260,objectFit:'cover'}}/>:
          <div style={{height:260,background:`linear-gradient(135deg,${T.charcoal},${T.black})`,display:'flex',alignItems:'center',justifyContent:'center'}}><div style={{opacity:.15}}><Icon name="chef" size={80} color={T.brass}/></div></div>}
        <div style={{position:'absolute',inset:0,background:'linear-gradient(to top,rgba(0,0,0,.85) 0%,rgba(0,0,0,.2) 60%,transparent 100%)'}}/>
        <button onClick={onClose} style={{position:'absolute',top:20,left:20,width:42,height:42,background:'rgba(0,0,0,.5)',border:`1px solid ${T.border}`,borderRadius:'50%',display:'flex',alignItems:'center',justifyContent:'center'}}><Icon name="back" size={18} color={T.white}/></button>
        <button onClick={()=>onFavorite(recipe)} style={{position:'absolute',top:20,right:20,width:42,height:42,background:isFavorited?T.brass:'rgba(0,0,0,.5)',border:`1px solid ${isFavorited?T.brass:T.border}`,borderRadius:'50%',display:'flex',alignItems:'center',justifyContent:'center',transition:'all .3s'}}><Icon name={isFavorited?'heartFill':'heart'} size={18} color={T.white}/></button>
        <div style={{position:'absolute',bottom:20,left:24,right:24}}>
          <h1 style={{fontFamily:"'Cormorant Garamond'",fontSize:32,fontWeight:400,color:T.white,lineHeight:1.15,marginBottom:8}}>{p.title}</h1>
          <div style={{display:'flex',gap:20,alignItems:'center',flexWrap:'wrap'}}>
            <Stars value={rating} onChange={saveRating}/>
            <div style={{display:'flex',gap:16}}>
              {p.prepTime&&<span style={{fontSize:12,color:'rgba(255,255,255,.7)',display:'flex',alignItems:'center',gap:4}}><Icon name="clock" size={13} color={T.brassLight}/>Prep: {p.prepTime}</span>}
              {p.cookTime&&<span style={{fontSize:12,color:'rgba(255,255,255,.7)',display:'flex',alignItems:'center',gap:4}}><Icon name="clock" size={13} color={T.brassLight}/>Cook: {p.cookTime}</span>}
              {p.servings&&<span style={{fontSize:12,color:'rgba(255,255,255,.7)',display:'flex',alignItems:'center',gap:4}}><Icon name="users" size={13} color={T.brassLight}/>Serves {p.servings}</span>}
            </div>
          </div>
        </div>
      </div>
      <div style={{background:T.charcoal,display:'flex',borderBottom:`1px solid ${T.border}`,flexShrink:0}}>
        {['recipe','photos','notes'].map(t=>(
          <button key={t} onClick={()=>setTab(t)} style={{flex:1,padding:'16px 8px',background:'none',border:'none',borderBottom:tab===t?`2px solid ${T.brass}`:'2px solid transparent',color:tab===t?T.brass:T.muted,fontSize:12,fontWeight:500,letterSpacing:'.1em',textTransform:'uppercase',transition:'all .2s'}}>
            {t==='photos'?`Photos (${photos.length})`:t.charAt(0).toUpperCase()+t.slice(1)}
          </button>
        ))}
      </div>
      <div style={{flex:1,overflow:'auto',background:T.white}}>
        {tab==='recipe'&&(
          <div style={{padding:'28px 24px',maxWidth:680,margin:'0 auto'}}>
            {p.description&&<p style={{fontFamily:"'Cormorant Garamond'",fontStyle:'italic',fontSize:18,color:T.muted,lineHeight:1.6,marginBottom:24}}>{p.description}</p>}
            <BrassDivider label="Ingredients"/>
            <div style={{marginBottom:32}}>{p.ingredients.map((ing,i)=>(
              <div key={i} style={{display:'flex',alignItems:'flex-start',gap:12,padding:'10px 0',borderBottom:`1px solid ${T.borderLight}`}}>
                <div style={{width:6,height:6,borderRadius:'50%',background:T.brass,marginTop:7,flexShrink:0}}/>
                <span style={{fontSize:15,color:T.charcoal,lineHeight:1.5}}>{ing}</span>
              </div>
            ))}</div>
            <BrassDivider label="Instructions"/>
            <div style={{marginBottom:32}}>{p.steps.map((step,i)=>(
              <div key={i} style={{display:'flex',gap:16,marginBottom:20,alignItems:'flex-start'}}>
                <div style={{width:32,height:32,borderRadius:'50%',flexShrink:0,background:`linear-gradient(135deg,${T.brass},${T.brassDark})`,display:'flex',alignItems:'center',justifyContent:'center',fontFamily:"'Cormorant Garamond'",fontSize:16,fontWeight:600,color:T.white}}>{i+1}</div>
                <p style={{fontSize:15,color:T.charcoal,lineHeight:1.7,paddingTop:5}}>{step}</p>
              </div>
            ))}</div>
            {p.notes&&<><BrassDivider label="Chef's Notes"/><p style={{fontFamily:"'Cormorant Garamond'",fontStyle:'italic',fontSize:16,color:T.muted,lineHeight:1.7,paddingBottom:24}}>{p.notes}</p></>}

            {/* AI Chat button */}
            <button onClick={()=>setShowChat(true)} style={{width:'100%',marginTop:8,marginBottom:32,padding:'14px',background:T.offWhite,border:`1.5px solid ${T.border}`,borderRadius:10,display:'flex',alignItems:'center',justifyContent:'center',gap:8,fontSize:13,fontWeight:500,color:T.charcoal,letterSpacing:'.04em',transition:'all .2s'}}
              onMouseEnter={e=>{e.currentTarget.style.background=T.brassGlow;e.currentTarget.style.borderColor=T.brass;e.currentTarget.style.color=T.brassDark}}
              onMouseLeave={e=>{e.currentTarget.style.background=T.offWhite;e.currentTarget.style.borderColor=T.border;e.currentTarget.style.color=T.charcoal}}>
              <Icon name="chat" size={16} color={T.brass}/>
              Modify this recipe with AI chat
            </button>
          </div>
        )}
        {tab==='photos'&&(
          <div style={{padding:24}}>
            <input ref={fileRef} type="file" accept="image/*" style={{display:'none'}} onChange={addPhoto}/>
            <button className="btn-brass" onClick={()=>fileRef.current.click()} style={{width:'100%',marginBottom:20,display:'flex',alignItems:'center',justifyContent:'center',gap:8}}><Icon name="camera" size={16} color={T.white}/> Add Photo</button>
            {photos.length===0&&<div style={{textAlign:'center',padding:'48px 24px',color:T.muted}}><Icon name="photo" size={48} color={T.border}/><p style={{marginTop:12,fontFamily:"'Cormorant Garamond'",fontStyle:'italic',fontSize:18}}>No photos yet</p></div>}
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
              {photos.map((src,i)=>(
                <div key={i} style={{position:'relative',borderRadius:12,overflow:'hidden',aspectRatio:'1'}}>
                  <img src={src} alt="" style={{width:'100%',height:'100%',objectFit:'cover'}}/>
                  <button onClick={()=>removePhoto(i)} style={{position:'absolute',top:8,right:8,width:32,height:32,background:'rgba(0,0,0,.6)',border:'none',borderRadius:'50%',display:'flex',alignItems:'center',justifyContent:'center'}}><Icon name="trash" size={14} color={T.white}/></button>
                </div>
              ))}
            </div>
          </div>
        )}
        {tab==='notes'&&(
          <div style={{padding:24}}>
            <p style={{fontSize:13,color:T.muted,marginBottom:16}}>Personal notes, substitutions, tweaks…</p>
            {editingNote?(
              <div>
                <textarea value={note} onChange={e=>setNote(e.target.value)} rows={8} className="input-field" style={{resize:'none',lineHeight:1.6}} placeholder="Add your notes here…"/>
                <div style={{display:'flex',gap:12,marginTop:12}}><button className="btn-brass" onClick={saveNote}>Save Notes</button><button className="btn-ghost" onClick={()=>setEditingNote(false)}>Cancel</button></div>
              </div>
            ):(
              <div>
                {note?<div style={{background:T.offWhite,borderRadius:12,padding:20,borderLeft:`3px solid ${T.brass}`,marginBottom:16}}><p style={{fontFamily:"'Cormorant Garamond'",fontStyle:'italic',fontSize:17,lineHeight:1.7,color:T.charcoal}}>{note}</p></div>
                    :<div style={{textAlign:'center',padding:'40px 24px',color:T.muted}}><Icon name="star" size={40} color={T.border}/><p style={{marginTop:12,fontFamily:"'Cormorant Garamond'",fontStyle:'italic',fontSize:18}}>No notes yet</p></div>}
                <button className="btn-ghost" onClick={()=>setEditingNote(true)} style={{width:'100%'}}>{note?'Edit Notes':'Add Notes'}</button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Discover Tab ───────────────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════
// ALLERGEN SETTINGS
// ══════════════════════════════════════════════════════════════════════════
const ALLERGENS = [
  { id:'gluten',    label:'Gluten',      emoji:'🌾' },
  { id:'dairy',     label:'Dairy',       emoji:'🥛' },
  { id:'eggs',      label:'Eggs',        emoji:'🥚' },
  { id:'peanuts',   label:'Peanuts',     emoji:'🥜' },
  { id:'tree_nuts', label:'Tree Nuts',   emoji:'🌰' },
  { id:'shellfish', label:'Shellfish',   emoji:'🦐' },
  { id:'fish',      label:'Fish',        emoji:'🐟' },
  { id:'soy',       label:'Soy',         emoji:'🫘' },
  { id:'sesame',    label:'Sesame',      emoji:'🌿' },
  { id:'sulfites',  label:'Sulfites',    emoji:'🍷' },
  { id:'mustard',   label:'Mustard',     emoji:'🌭' },
  { id:'celery',    label:'Celery',      emoji:'🥬' },
  { id:'lupin',     label:'Lupin',       emoji:'🌸' },
  { id:'molluscs',  label:'Molluscs',    emoji:'🐚' },
]

const allergenPromptText = (allergens, servings) => {
  let text = ''
  if (servings && servings !== 4) text += `\n\nThis recipe should serve ${servings} people.`
  if (allergens && allergens.length > 0) {
    const labels = allergens.map(id => ALLERGENS.find(a => a.id === id)?.label || id)
    text += `\n\nIMPORTANT: This recipe MUST completely avoid the following allergens: ${labels.join(', ')}. Do not include any ingredients containing these allergens, and do not suggest them as optional additions.`
  }
  return text
}

const PreferencesTab = ({ allergens, onSaveAllergens, defaultServings, onSaveServings }) => {
  const [selectedAllergens, setSelectedAllergens] = useState(allergens || [])
  const [servings, setServings] = useState(defaultServings || 4)
  const [saved, setSaved] = useState(false)

  const toggle = (id) => { setSaved(false); setSelectedAllergens(prev => prev.includes(id) ? prev.filter(a => a !== id) : [...prev, id]) }

  const saveAll = () => {
    onSaveAllergens(selectedAllergens)
    onSaveServings(servings)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const SERVING_OPTIONS = [1, 2, 4, 6, 8, 10, 12]

  return (
    <div style={{height:'100%',overflow:'auto',background:T.white}}>
      <div style={{background:T.charcoal,padding:'32px 24px 24px',borderBottom:`1px solid ${T.border}`}}>
        <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:4}}>
          <Icon name="settings" size={20} color={T.brass}/>
          <h2 style={{fontFamily:"'Cormorant Garamond'",fontSize:28,fontWeight:400,color:T.white}}>Preferences</h2>
        </div>
        <p style={{fontSize:13,color:T.muted}}>Customize how recipes are generated for you</p>
      </div>

      <div style={{padding:24}}>

        {/* Default Servings */}
        <div style={{marginBottom:32}}>
          <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:6}}>
            <Icon name="users" size={16} color={T.brass}/>
            <h3 style={{fontFamily:"'Cormorant Garamond'",fontSize:20,fontWeight:500,color:T.charcoal}}>Cooking For</h3>
          </div>
          <p style={{fontSize:13,color:T.muted,marginBottom:16}}>Recipes will default to this many servings.</p>
          <div style={{display:'flex',gap:10,flexWrap:'wrap'}}>
            {SERVING_OPTIONS.map(n => (
              <button key={n} onClick={()=>{setServings(n);setSaved(false)}} style={{
                width:52,height:52,borderRadius:12,border:`1.5px solid ${servings===n?T.brass:T.borderLight}`,
                background:servings===n?T.brassGlow:T.offWhite,
                fontFamily:"'Cormorant Garamond'",fontSize:20,fontWeight:servings===n?600:400,
                color:servings===n?T.brassDark:T.charcoal,cursor:'pointer',transition:'all .2s',
              }}>
                {n}
              </button>
            ))}
          </div>
          <p style={{fontSize:12,color:T.muted,marginTop:10}}>Currently: <b style={{color:T.charcoal}}>{servings} {servings===1?'person':'people'}</b></p>
        </div>

        <div style={{height:1,background:T.borderLight,marginBottom:28}}/>

        {/* Allergens */}
        <div style={{marginBottom:28}}>
          <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:6}}>
            <Icon name="shield" size={16} color={T.brass}/>
            <h3 style={{fontFamily:"'Cormorant Garamond'",fontSize:20,fontWeight:500,color:T.charcoal}}>Allergen Filters</h3>
          </div>
          <p style={{fontSize:13,color:T.muted,marginBottom:16}}>All generated recipes will automatically avoid these ingredients.</p>

          {selectedAllergens.length > 0 && (
            <div style={{background:T.brassGlow,border:`1px solid ${T.border}`,borderRadius:10,padding:'10px 14px',marginBottom:16,display:'flex',alignItems:'center',gap:8}}>
              <Icon name="shield" size={14} color={T.brass}/>
              <span style={{fontSize:13,color:T.brassDark,fontWeight:500}}>
                Avoiding: {selectedAllergens.map(id=>ALLERGENS.find(a=>a.id===id)?.label).join(', ')}
              </span>
            </div>
          )}

          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
            {ALLERGENS.map(a => {
              const on = selectedAllergens.includes(a.id)
              return (
                <button key={a.id} onClick={()=>toggle(a.id)} style={{
                  display:'flex',alignItems:'center',gap:10,padding:'12px 14px',
                  background:on?T.brassGlow:T.offWhite,
                  border:`1.5px solid ${on?T.brass:T.borderLight}`,
                  borderRadius:12,textAlign:'left',transition:'all .2s',cursor:'pointer',
                }}>
                  <span style={{fontSize:18}}>{a.emoji}</span>
                  <span style={{fontSize:13,fontWeight:on?500:400,color:on?T.brassDark:T.charcoal,flex:1}}>{a.label}</span>
                  {on&&<div style={{width:16,height:16,borderRadius:'50%',background:T.brass,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                    <Icon name="check" size={9} color={T.white}/>
                  </div>}
                </button>
              )
            })}
          </div>
          {selectedAllergens.length>0&&(
            <button onClick={()=>{setSelectedAllergens([]);setSaved(false)}} style={{marginTop:12,background:'none',border:'none',fontSize:13,color:T.muted,cursor:'pointer',textDecoration:'underline'}}>Clear all allergens</button>
          )}
        </div>

        <button className="btn-brass" onClick={saveAll} style={{width:'100%',display:'flex',alignItems:'center',justifyContent:'center',gap:8}}>
          {saved?<><Icon name="check" size={15} color={T.white}/> Saved!</>:'Save Preferences'}
        </button>

      </div>
    </div>
  )
}

const RECIPE_SYS = `You are a professional chef and recipe writer. Format recipes as:
# [Title]
[One sentence description]
Prep Time: X minutes
Cook Time: X minutes
Serves: N
## Ingredients
- [precise amount] [ingredient]
## Instructions
1. [step]
## Notes
[optional tip]
Use cookbook measurements (cups, tbsp, tsp, oz, lbs).`

const ALL_SUGGESTIONS = [
  'Classic Beef Bourguignon','Lemon Herb Roasted Chicken','Creamy Tuscan Pasta',
  'Honey Garlic Salmon','Mushroom Risotto','Thai Green Curry','Shakshuka',
  'Chicken Tikka Masala','Beef Tacos al Pastor','Shrimp Scampi','Butternut Squash Soup',
  'Classic French Onion Soup','Pan-Seared Duck Breast','Lobster Bisque',
  'Homemade Ramen','Lamb Chops with Chimichurri','Baked Halibut with Capers',
  'Moroccan Lamb Tagine','Pork Belly Bao Buns','Saffron Paella','Miso Glazed Cod',
  'Pulled Pork Tacos','Eggplant Parmesan','Pesto Gnocchi','Vietnamese Pho',
]
const getRandomSuggestions = () => {
  const shuffled = [...ALL_SUGGESTIONS].sort(() => Math.random() - 0.5)
  return shuffled.slice(0, 6)
}

const DiscoverTab = ({onAddRecipe, onOpenRecipe, allergens=[], defaultServings=4}) => {
  const [prompt,setPrompt]=useState('')
  const [loading,setLoading]=useState(false)
  const [generated,setGenerated]=useState(null)
  const [saved,setSaved]=useState(false)
  const [error,setError]=useState('')
  const [showChat,setShowChat]=useState(false)
  const [suggestions] = useState(getRandomSuggestions)

  const generate=async(text)=>{
    setLoading(true);setSaved(false);setGenerated(null);setError('');setShowChat(false)
    try {
      const sys = RECIPE_SYS + allergenPromptText(allergens, defaultServings)
      const raw=await callClaude([{role:'user',content:`Create a detailed recipe for: ${text}`}],sys)
      setGenerated({id:Date.now(),raw,photos:[],rating:0,createdAt:new Date().toISOString()})
    } catch(e){setError(e.message||'Could not generate recipe. Please try again.')}
    setLoading(false)
  }

  const handleUpdate=(newRaw)=>{ setGenerated(prev=>({...prev,raw:newRaw,id:Date.now()})); setSaved(false) }

  const saveFav=async()=>{ if(!generated)return; await onFavorite(generated); setSaved(true) }
  const saveCol=async()=>{ if(!generated)return; await onFavorite(generated); setSaved(true) }

  const p = generated ? parseRecipe(generated.raw) : null

  return (
    <div style={{height:'100%',overflow:'auto',background:T.white}}>
      {showChat&&generated&&<RecipeChatPanel recipe={generated} onRecipeUpdate={handleUpdate} onClose={()=>setShowChat(false)}/>}

      <div style={{background:T.charcoal,padding:'32px 24px 24px',borderBottom:`1px solid ${T.border}`}}>
        <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:6}}>
          <Icon name="sparkle" size={20} color={T.brass}/>
          <h2 style={{fontFamily:"'Cormorant Garamond'",fontSize:28,fontWeight:400,color:T.white}}>Discover Recipes</h2>
        </div>
        <p style={{fontSize:13,color:T.muted}}>Ask AI for any recipe you're craving</p>
        {allergens.length>0&&(
          <div style={{display:'flex',alignItems:'center',gap:6,marginTop:10,background:'rgba(212,192,144,.15)',border:`1px solid ${T.border}`,borderRadius:20,padding:'5px 12px',width:'fit-content'}}>
            <Icon name="shield" size={13} color={T.brass}/>
            <span style={{fontSize:11,color:T.brassLight}}>Avoiding: {allergens.map(id=>ALLERGENS.find(a=>a.id===id)?.label).join(', ')}</span>
          </div>
        )}
      </div>

      <div style={{padding:24}}>
        <div style={{position:'relative',marginBottom:16}}>
          <input className="input-field" placeholder="e.g. 'A cozy French onion soup'" value={prompt}
            onChange={e=>setPrompt(e.target.value)}
            onKeyDown={e=>e.key==='Enter'&&prompt.trim()&&generate(prompt.trim())}
            style={{paddingRight:56}}/>
          <button onClick={()=>prompt.trim()&&generate(prompt.trim())} style={{position:'absolute',right:8,top:'50%',transform:'translateY(-50%)',width:36,height:36,border:'none',borderRadius:8,background:`linear-gradient(135deg,${T.brass},${T.brassDark})`,display:'flex',alignItems:'center',justifyContent:'center'}}>
            <Icon name="search" size={16} color={T.white}/>
          </button>
        </div>

        <div style={{display:'flex',gap:8,flexWrap:'wrap',marginBottom:28}}>
          {suggestions.map(s=>(
            <button key={s} onClick={()=>generate(s)} style={{background:T.offWhite,border:`1px solid ${T.borderLight}`,borderRadius:20,padding:'6px 14px',fontSize:12,color:T.charcoal,transition:'all .2s'}}>{s}</button>
          ))}
        </div>

        {loading&&<div style={{background:T.charcoal,borderRadius:16,padding:'36px 24px',textAlign:'center',marginBottom:24}}><LoadingDots/><p style={{fontFamily:"'Cormorant Garamond'",fontStyle:'italic',fontSize:18,color:T.white,marginTop:16}}>Crafting your recipe…</p></div>}
        {error&&<div style={{background:'rgba(239,154,154,.1)',border:'1px solid rgba(239,154,154,.3)',borderRadius:10,padding:'12px 16px',marginBottom:16,fontSize:13,color:'#EF9A9A'}}>{error}</div>}

        {p&&!loading&&(
          <div className="scale-in" style={{background:T.white,borderRadius:16,border:`1px solid ${T.border}`,overflow:'hidden',marginBottom:24,boxShadow:'0 8px 32px rgba(0,0,0,.08)'}}>
            <div onClick={()=>onOpenRecipe(generated)} style={{background:T.charcoal,padding:'20px 24px',cursor:'pointer'}}>
              <h2 style={{fontFamily:"'Cormorant Garamond'",fontSize:26,fontWeight:400,color:T.white,marginBottom:6}}>{p.title}</h2>
              {p.description&&<p style={{fontFamily:"'Cormorant Garamond'",fontStyle:'italic',fontSize:15,color:T.muted}}>{p.description}</p>}
              <div style={{display:'flex',gap:20,marginTop:12}}>
                {p.prepTime&&<span style={{fontSize:12,color:T.brassLight}}><Icon name="clock" size={12} color={T.brass}/> Prep: {p.prepTime}</span>}
                {p.cookTime&&<span style={{fontSize:12,color:T.brassLight}}><Icon name="clock" size={12} color={T.brass}/> Cook: {p.cookTime}</span>}
                {p.servings&&<span style={{fontSize:12,color:T.brassLight}}><Icon name="users" size={12} color={T.brass}/> Serves {p.servings}</span>}
              </div>
            </div>

            <div style={{padding:'20px 24px'}}>
              <BrassDivider label="Ingredients"/>
              {p.ingredients.slice(0,6).map((ing,i)=>(
                <div key={i} style={{display:'flex',gap:10,padding:'7px 0',borderBottom:`1px solid ${T.borderLight}`}}>
                  <div style={{width:5,height:5,borderRadius:'50%',background:T.brass,marginTop:8,flexShrink:0}}/>
                  <span style={{fontSize:14,color:T.charcoal}}>{ing}</span>
                </div>
              ))}
              {p.ingredients.length>6&&<p style={{fontSize:13,color:T.muted,marginTop:8,fontStyle:'italic'}}>+{p.ingredients.length-6} more…</p>}
              <BrassDivider label="Instructions"/>
              {p.steps.slice(0,3).map((step,i)=>(
                <div key={i} style={{display:'flex',gap:12,marginBottom:14}}>
                  <div style={{width:26,height:26,borderRadius:'50%',flexShrink:0,background:`linear-gradient(135deg,${T.brass},${T.brassDark})`,display:'flex',alignItems:'center',justifyContent:'center',fontFamily:"'Cormorant Garamond'",fontSize:14,color:T.white}}>{i+1}</div>
                  <p style={{fontSize:14,color:T.charcoal,lineHeight:1.6,paddingTop:3}}>{step}</p>
                </div>
              ))}
              {p.steps.length>3&&<p style={{fontSize:13,color:T.muted,fontStyle:'italic'}}>+{p.steps.length-3} more steps…</p>}

              {/* View Full button */}
              <button onClick={()=>onOpenRecipe(generated)} style={{width:'100%',marginTop:20,padding:'13px',background:T.offWhite,border:`1.5px solid ${T.border}`,borderRadius:10,display:'flex',alignItems:'center',justifyContent:'center',gap:8,fontSize:13,fontWeight:500,color:T.charcoal,letterSpacing:'.04em',transition:'all .2s'}}
                onMouseEnter={e=>{e.currentTarget.style.background=T.brassGlow;e.currentTarget.style.borderColor=T.brass;e.currentTarget.style.color=T.brassDark}}
                onMouseLeave={e=>{e.currentTarget.style.background=T.offWhite;e.currentTarget.style.borderColor=T.border;e.currentTarget.style.color=T.charcoal}}>
                <Icon name="sparkle" size={15} color={T.brass}/>
                View Full Recipe
              </button>

              {/* Chat button */}
              <button onClick={()=>setShowChat(true)} style={{width:'100%',marginTop:10,padding:'13px',background:T.offWhite,border:`1.5px solid ${T.border}`,borderRadius:10,display:'flex',alignItems:'center',justifyContent:'center',gap:8,fontSize:13,fontWeight:500,color:T.charcoal,letterSpacing:'.04em',transition:'all .2s'}}
                onMouseEnter={e=>{e.currentTarget.style.background=T.brassGlow;e.currentTarget.style.borderColor=T.brass;e.currentTarget.style.color=T.brassDark}}
                onMouseLeave={e=>{e.currentTarget.style.background=T.offWhite;e.currentTarget.style.borderColor=T.border;e.currentTarget.style.color=T.charcoal}}>
                <Icon name="chat" size={16} color={T.brass}/>
                Modify this recipe with AI chat
              </button>

              <div style={{display:'flex',gap:10,marginTop:10}}>
                <button className="btn-brass" onClick={saveCol} disabled={saved} style={{flex:1,display:'flex',alignItems:'center',justifyContent:'center',gap:8}}>
                  {saved?<><Icon name="heartFill" size={15} color={T.white}/> Saved to Favorites!</>:<><Icon name="heart" size={15} color={T.white}/> Save to Favorites</>}
                </button>
              </div>
              {!saved&&<p style={{fontSize:11,color:T.muted,textAlign:'center',marginTop:8}}>Tap the title above to read the full recipe</p>}
            </div>
          </div>
        )}

      </div>
    </div>
  )
}

// ── History Tab ─────────────────────────────────────────────────────────────
const HistoryTab = ({recipes, onOpenRecipe, onFavorite, favorites, onDelete, loading}) => {
  const [search,setSearch]=useState('')
  const sorted = [...recipes].sort((a,b)=>new Date(b.createdAt||0)-new Date(a.createdAt||0))
  const filtered = sorted.filter(r=>parseRecipe(r.raw).title.toLowerCase().includes(search.toLowerCase()))

  const formatDate = (iso) => {
    if (!iso) return ''
    const d = new Date(iso)
    const now = new Date()
    const diff = Math.floor((now - d) / 86400000)
    if (diff === 0) return 'Today'
    if (diff === 1) return 'Yesterday'
    if (diff < 7) return `${diff} days ago`
    return d.toLocaleDateString('en-US', {month:'short', day:'numeric'})
  }

  return (
    <div style={{height:'100%',overflow:'auto',background:T.white}}>
      <div style={{background:T.charcoal,padding:'32px 24px 20px',borderBottom:`1px solid ${T.border}`}}>
        <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:4}}>
          <Icon name="clock" size={20} color={T.brass}/>
          <h2 style={{fontFamily:"'Cormorant Garamond'",fontSize:28,fontWeight:400,color:T.white}}>History</h2>
        </div>
        <p style={{fontSize:13,color:T.muted,marginBottom:14}}>Every recipe you've ever generated</p>
        <div style={{position:'relative'}}>
          <input className="input-field" placeholder="Search history…" value={search} onChange={e=>setSearch(e.target.value)} style={{paddingLeft:44,background:'rgba(255,255,255,.07)',border:`1px solid ${T.border}`,color:T.white}}/>
          <div style={{position:'absolute',left:14,top:'50%',transform:'translateY(-50%)'}}><Icon name="search" size={16} color={T.muted}/></div>
        </div>
      </div>
      <div style={{padding:24}}>
        {loading ? <div style={{textAlign:'center',padding:'60px 24px'}}><LoadingDots/></div>
          : filtered.length===0
            ? <div style={{textAlign:'center',padding:'60px 24px',color:T.muted}}>
                <Icon name="clock" size={56} color={T.border}/>
                <p style={{marginTop:16,fontFamily:"'Cormorant Garamond'",fontStyle:'italic',fontSize:22,color:T.charcoal}}>{search?'No recipes found':'Nothing yet'}</p>
                <p style={{fontSize:14,marginTop:6}}>{search?'Try a different search':'Generate a recipe in Discover'}</p>
              </div>
            : <div style={{display:'flex',flexDirection:'column',gap:12}}>
                {filtered.map(r => {
                  const p = parseRecipe(r.raw)
                  const isFav = favorites.some(f=>f.id===r.id)
                  return (
                    <div key={r.id} onClick={()=>onOpenRecipe(r)} style={{display:'flex',alignItems:'center',gap:14,padding:'14px 16px',background:T.white,border:`1px solid ${T.borderLight}`,borderRadius:14,cursor:'pointer',transition:'all .2s',boxShadow:'0 2px 8px rgba(0,0,0,.04)'}}
                      onMouseEnter={e=>{e.currentTarget.style.borderColor=T.border;e.currentTarget.style.boxShadow='0 4px 16px rgba(0,0,0,.08)'}}
                      onMouseLeave={e=>{e.currentTarget.style.borderColor=T.borderLight;e.currentTarget.style.boxShadow='0 2px 8px rgba(0,0,0,.04)'}}>
                      {/* Color dot / photo thumb */}
                      <div style={{width:52,height:52,borderRadius:12,overflow:'hidden',flexShrink:0,background:`linear-gradient(135deg,${T.charcoal},#1a1a18)`,display:'flex',alignItems:'center',justifyContent:'center'}}>
                        {r.photos?.[0]
                          ? <img src={r.photos[0]} alt="" style={{width:'100%',height:'100%',objectFit:'cover'}}/>
                          : <Icon name="chef" size={22} color={T.brass}/>}
                      </div>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:3}}>
                          <h3 style={{fontFamily:"'Cormorant Garamond'",fontSize:18,fontWeight:500,color:T.charcoal,lineHeight:1.2,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{p.title}</h3>
                          {isFav&&<Icon name="heartFill" size={12} color={T.brass}/>}
                        </div>
                        <div style={{display:'flex',gap:12,alignItems:'center'}}>
                          {p.prepTime&&<span style={{fontSize:11,color:T.muted}}>{p.prepTime} prep</span>}
                          {p.servings&&<span style={{fontSize:11,color:T.muted}}>Serves {p.servings}</span>}
                          <span style={{fontSize:11,color:T.border}}>•</span>
                          <span style={{fontSize:11,color:T.muted}}>{formatDate(r.createdAt)}</span>
                        </div>
                      </div>
                      <div style={{display:'flex',alignItems:'center',gap:8,flexShrink:0}}>
                        <button onClick={e=>{e.stopPropagation();onFavorite(r)}} style={{width:32,height:32,background:isFav?T.brass:T.offWhite,border:`1px solid ${isFav?T.brass:T.borderLight}`,borderRadius:'50%',display:'flex',alignItems:'center',justifyContent:'center',transition:'all .2s'}}>
                          <Icon name={isFav?'heartFill':'heart'} size={14} color={isFav?T.white:T.muted}/>
                        </button>
                        <button onClick={e=>{e.stopPropagation();onDelete(r.id)}} style={{width:32,height:32,background:T.offWhite,border:`1px solid ${T.borderLight}`,borderRadius:'50%',display:'flex',alignItems:'center',justifyContent:'center'}}>
                          <Icon name="trash" size={13} color="#E57373"/>
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
        }
      </div>
    </div>
  )
}

// ── Favorites Tab ──────────────────────────────────────────────────────────
const FavoritesTab = ({favorites, recipes, menus, onOpenRecipe, onFavorite, onCreateMenu, onDeleteMenu, onUpdate}) => {
  const [view,setView]=useState('favorites')
  const [showModal,setShowModal]=useState(false)
  const [menuName,setMenuName]=useState('')
  const [selected,setSelected]=useState([])
  const [viewingMenu,setViewingMenu]=useState(null)
  const [viewingRecipe,setViewingRecipe]=useState(null)

  const createMenu=async()=>{ if(!menuName.trim())return; await onCreateMenu(menuName,selected); setShowModal(false);setMenuName('');setSelected([]) }

  if (viewingRecipe) {
    return <PolishedRecipeDetail recipe={viewingRecipe} onClose={()=>setViewingRecipe(null)} onUnfavorite={(r)=>{onFavorite(r);setViewingRecipe(null)}} onUpdate={(updated)=>{setViewingRecipe(updated);onUpdate(updated)}}/>
  }

  if (viewingMenu) {
    const mr=recipes.filter(r=>viewingMenu.recipe_ids?.includes(r.id))
    return (
      <div style={{height:'100%',overflow:'auto',background:T.white}}>
        <div style={{background:T.charcoal,padding:'32px 24px 24px'}}>
          <button onClick={()=>setViewingMenu(null)} style={{background:'none',border:'none',color:T.brass,display:'flex',alignItems:'center',gap:8,marginBottom:16,fontSize:13,cursor:'pointer'}}><Icon name="back" size={16} color={T.brass}/> Back</button>
          <h2 style={{fontFamily:"'Cormorant Garamond'",fontSize:28,fontWeight:400,color:T.white}}>{viewingMenu.name}</h2>
          <p style={{fontSize:13,color:T.muted,marginTop:4}}>{mr.length} recipes</p>
        </div>
        <div style={{padding:24}}>
          {mr.map(r=><PolishedRecipeCard key={r.id} recipe={r} onClick={()=>setViewingRecipe(r)} onUnfavorite={onFavorite}/>)}
        </div>
      </div>
    )
  }

  return (
    <div style={{height:'100%',overflow:'auto',background:T.white}}>
      <div style={{background:T.charcoal,padding:'32px 24px 0'}}>
        <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:4}}><Icon name="heartFill" size={20} color={T.brass}/><h2 style={{fontFamily:"'Cormorant Garamond'",fontSize:28,fontWeight:400,color:T.white}}>Favorites</h2></div>
        <p style={{fontSize:13,color:T.muted,marginBottom:16}}>Your curated favorites — polished view, menus & notes</p>
        <div style={{display:'flex',borderTop:`1px solid ${T.border}`}}>
          {['favorites','menus'].map(t=>(
            <button key={t} onClick={()=>setView(t)} style={{flex:1,padding:'14px 8px',background:'none',border:'none',borderBottom:view===t?`2px solid ${T.brass}`:'2px solid transparent',color:view===t?T.brass:T.muted,fontSize:12,fontWeight:500,letterSpacing:'.1em',textTransform:'uppercase',transition:'all .2s'}}>{t}</button>
          ))}
        </div>
      </div>

      <div style={{padding:24}}>
        {view==='favorites'&&(
          favorites.length===0
            ?<div style={{textAlign:'center',padding:'48px 24px',color:T.muted}}><Icon name="heart" size={56} color={T.border}/><p style={{marginTop:16,fontFamily:"'Cormorant Garamond'",fontStyle:'italic',fontSize:22,color:T.charcoal}}>No favorites yet</p><p style={{fontSize:14,marginTop:8,lineHeight:1.6,maxWidth:260,margin:'8px auto 0'}}>Go to <b>Collection</b>, open any recipe, and tap the <b>♥</b> to add it here for a polished cookbook view.</p></div>
            :favorites.map(r=><PolishedRecipeCard key={r.id} recipe={r} onClick={()=>setViewingRecipe(r)} onUnfavorite={onFavorite}/>)
        )}

        {view==='menus'&&(
          <>
            <button className="btn-brass" onClick={()=>setShowModal(true)} style={{width:'100%',marginBottom:20,display:'flex',alignItems:'center',justifyContent:'center',gap:8}}><Icon name="menu" size={16} color={T.white}/> Create Menu</button>
            {menus.length===0
              ?<div style={{textAlign:'center',padding:'48px 24px',color:T.muted}}><Icon name="grid" size={48} color={T.border}/><p style={{marginTop:14,fontFamily:"'Cormorant Garamond'",fontStyle:'italic',fontSize:20,color:T.charcoal}}>No menus yet</p></div>
              :<div style={{display:'flex',flexDirection:'column',gap:14}}>
                {menus.map(m=>(
                  <div key={m.id} className="card" style={{border:`1px solid ${T.borderLight}`,cursor:'pointer'}}>
                    <div style={{padding:'18px 20px',display:'flex',alignItems:'center',gap:14}} onClick={()=>setViewingMenu(m)}>
                      <div style={{width:48,height:48,borderRadius:12,background:`linear-gradient(135deg,${T.brass},${T.brassDark})`,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}><Icon name="menu" size={22} color={T.white}/></div>
                      <div style={{flex:1}}><h3 style={{fontFamily:"'Cormorant Garamond'",fontSize:20,fontWeight:500,color:T.charcoal}}>{m.name}</h3><p style={{fontSize:12,color:T.muted,marginTop:2}}>{m.recipe_ids?.length||0} recipes</p></div>
                      <button onClick={e=>{e.stopPropagation();onDeleteMenu(m.id)}} style={{background:'none',border:'none',padding:4}}><Icon name="trash" size={16} color="#E57373"/></button>
                    </div>
                  </div>
                ))}
              </div>
            }
          </>
        )}
      </div>

      {showModal&&(
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.7)',zIndex:200,display:'flex',alignItems:'flex-end'}} onClick={e=>e.target===e.currentTarget&&setShowModal(false)}>
          <div className="scale-in" style={{background:T.white,borderRadius:'20px 20px 0 0',width:'100%',maxHeight:'85vh',overflow:'auto',padding:28}}>
            <h3 style={{fontFamily:"'Cormorant Garamond'",fontSize:24,fontWeight:500,color:T.charcoal,marginBottom:20}}>Create Menu</h3>
            <input className="input-field" placeholder="Menu name (e.g. Sunday Dinner)" value={menuName} onChange={e=>setMenuName(e.target.value)} style={{marginBottom:20}}/>
            <p style={{fontSize:13,color:T.muted,marginBottom:12}}>Select recipes to include:</p>
            <div style={{display:'flex',flexDirection:'column',gap:10,marginBottom:24,maxHeight:'35vh',overflow:'auto'}}>
              {favorites.length===0&&<p style={{fontSize:13,color:T.muted,fontStyle:'italic'}}>Save some recipes to favorites first</p>}
              {favorites.map(r=>{
                const p=parseRecipe(r.raw); const checked=selected.includes(r.id)
                return (
                  <label key={r.id} style={{display:'flex',alignItems:'center',gap:14,padding:'12px 14px',background:checked?T.brassGlow:T.offWhite,border:`1.5px solid ${checked?T.brass:T.borderLight}`,borderRadius:10,cursor:'pointer',transition:'all .2s'}}>
                    <input type="checkbox" checked={checked} onChange={()=>setSelected(prev=>checked?prev.filter(i=>i!==r.id):[...prev,r.id])} style={{accentColor:T.brass,width:16,height:16}}/>
                    <span style={{fontSize:15,color:T.charcoal,fontFamily:"'Cormorant Garamond'"}}>{p.title}</span>
                  </label>
                )
              })}
            </div>
            <div style={{display:'flex',gap:12}}><button className="btn-brass" onClick={createMenu} style={{flex:1}}>Create Menu</button><button className="btn-ghost" onClick={()=>setShowModal(false)}>Cancel</button></div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Pantry Tab ─────────────────────────────────────────────────────────────
const PANTRY_SYS=`You are a professional chef. Look at the provided ingredients and create one delicious recipe. Format as:
# [Recipe Title]
[Description]
Prep Time: X minutes
Cook Time: X minutes
Serves: N
## Ingredients
- [precise measurements]
## Instructions
1. [step]
## Notes
[optional tip]`

const PantryTab = ({onAddRecipe, onOpenRecipe, onFavorite, allergens=[], defaultServings=4}) => {
  const [photos,setPhotos]=useState([])
  const [loading,setLoading]=useState(false)
  const [generated,setGenerated]=useState(null)
  const [ingredients,setIngredients]=useState('')
  const [saved,setSaved]=useState(false)
  const [mode,setMode]=useState('photo')
  const [error,setError]=useState('')
  const [showChat,setShowChat]=useState(false)
  const fileRef=useRef()

  const addPhoto=(e)=>{ Array.from(e.target.files).forEach(file=>{ const r=new FileReader();r.onload=ev=>setPhotos(prev=>[...prev,{src:ev.target.result,file}]);r.readAsDataURL(file) }) }

  const genPhotos=async()=>{
    if(!photos.length)return; setLoading(true);setSaved(false);setGenerated(null);setError('');setShowChat(false)
    try {
      const sys = PANTRY_SYS + allergenPromptText(allergens, defaultServings)
      const b64s=await Promise.all(photos.map(p=>toBase64(p.file)))
      const content=[...b64s.map(b64=>({type:'image',source:{type:'base64',media_type:'image/jpeg',data:b64}})),{type:'text',text:'Look at these photos of my pantry/fridge. List what you see, then create one delicious recipe. Format as a proper cookbook recipe.'}]
      const raw=await callClaude([{role:'user',content}],sys)
      setGenerated({id:Date.now(),raw,photos:[],rating:0,createdAt:new Date().toISOString()})
    } catch(e){setError(e.message||'Could not generate recipe.')}
    setLoading(false)
  }

  const genText=async()=>{
    if(!ingredients.trim())return; setLoading(true);setSaved(false);setGenerated(null);setError('');setShowChat(false)
    try {
      const sys = PANTRY_SYS + allergenPromptText(allergens, defaultServings)
      const raw=await callClaude([{role:'user',content:`I have: ${ingredients}. Create a recipe.`}],sys)
      setGenerated({id:Date.now(),raw,photos:[],rating:0,createdAt:new Date().toISOString()})
    } catch(e){setError(e.message||'Could not generate recipe.')}
    setLoading(false)
  }

  const handleUpdate=(newRaw)=>{ setGenerated(prev=>({...prev,raw:newRaw,id:Date.now()})); setSaved(false) }

  return (
    <div style={{height:'100%',overflow:'auto',background:T.white}}>
      {showChat&&generated&&<RecipeChatPanel recipe={generated} onRecipeUpdate={handleUpdate} onClose={()=>setShowChat(false)}/>}

      <div style={{background:T.charcoal,padding:'32px 24px 24px',borderBottom:`1px solid ${T.border}`}}>
        <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:6}}><Icon name="fridge" size={20} color={T.brass}/><h2 style={{fontFamily:"'Cormorant Garamond'",fontSize:28,fontWeight:400,color:T.white}}>Pantry Scan</h2></div>
        <p style={{fontSize:13,color:T.muted}}>See what's in your kitchen, get a recipe</p>
        <div style={{display:'flex',gap:10,marginTop:16}}>
          {['photo','text'].map(m=>(
            <button key={m} onClick={()=>setMode(m)} style={{padding:'8px 20px',borderRadius:20,border:`1.5px solid ${mode===m?T.brass:T.border}`,background:mode===m?T.brassGlow:'transparent',color:mode===m?T.brass:T.muted,fontSize:12,fontWeight:500,textTransform:'uppercase',transition:'all .2s',cursor:'pointer'}}>
              {m==='photo'?'📷 Photo Scan':'✏️ Type Ingredients'}
            </button>
          ))}
        </div>
      </div>

      <div style={{padding:24}}>
        {mode==='photo'?(
          <>
            <input ref={fileRef} type="file" accept="image/*" multiple style={{display:'none'}} onChange={addPhoto}/>
            {photos.length===0
              ?<div onClick={()=>fileRef.current.click()} style={{border:`2px dashed ${T.border}`,borderRadius:16,padding:'48px 24px',textAlign:'center',cursor:'pointer',marginBottom:20,background:T.offWhite}}>
                <Icon name="camera" size={48} color={T.brass}/>
                <p style={{fontFamily:"'Cormorant Garamond'",fontStyle:'italic',fontSize:20,color:T.charcoal,marginTop:12}}>Take a photo of your pantry or fridge</p>
                <p style={{fontSize:13,color:T.muted,marginTop:6}}>Tap to add photos • Multiple allowed</p>
              </div>
              :<>
                <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:10,marginBottom:16}}>
                  {photos.map((ph,i)=>(
                    <div key={i} style={{position:'relative',aspectRatio:'1',borderRadius:10,overflow:'hidden'}}>
                      <img src={ph.src} alt="" style={{width:'100%',height:'100%',objectFit:'cover'}}/>
                      <button onClick={()=>setPhotos(prev=>prev.filter((_,idx)=>idx!==i))} style={{position:'absolute',top:5,right:5,width:24,height:24,background:'rgba(0,0,0,.6)',border:'none',borderRadius:'50%',display:'flex',alignItems:'center',justifyContent:'center'}}><Icon name="close" size={12} color={T.white}/></button>
                    </div>
                  ))}
                  <div onClick={()=>fileRef.current.click()} style={{aspectRatio:'1',borderRadius:10,border:`2px dashed ${T.border}`,display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',background:T.offWhite}}><Icon name="plus" size={24} color={T.brass}/></div>
                </div>
                <button className="btn-brass" onClick={genPhotos} style={{width:'100%',display:'flex',alignItems:'center',justifyContent:'center',gap:8,marginBottom:12}}><Icon name="sparkle" size={16} color={T.white}/> Generate Recipe from Photos</button>
                <button className="btn-ghost" onClick={()=>setPhotos([])} style={{width:'100%'}}>Clear Photos</button>
              </>
            }
          </>
        ):(
          <>
            <textarea className="input-field" placeholder="List what you have, e.g.: chicken breast, garlic, lemon, thyme…" value={ingredients} onChange={e=>setIngredients(e.target.value)} rows={5} style={{resize:'none',lineHeight:1.6,marginBottom:16}}/>
            <button className="btn-brass" onClick={genText} style={{width:'100%',display:'flex',alignItems:'center',justifyContent:'center',gap:8}}><Icon name="sparkle" size={16} color={T.white}/> Create Recipe</button>
          </>
        )}

        {error&&<div style={{background:'rgba(239,154,154,.1)',border:'1px solid rgba(239,154,154,.3)',borderRadius:10,padding:'12px 16px',marginTop:16,fontSize:13,color:'#EF9A9A'}}>{error}</div>}
        {loading&&<div style={{background:T.charcoal,borderRadius:16,padding:'36px 24px',textAlign:'center',marginTop:24}}><LoadingDots/><p style={{fontFamily:"'Cormorant Garamond'",fontStyle:'italic',fontSize:18,color:T.white,marginTop:16}}>Analyzing your ingredients…</p></div>}

        {generated&&!loading&&(()=>{
          const p=parseRecipe(generated.raw)
          return (
            <div className="scale-in" style={{marginTop:24,background:T.white,borderRadius:16,border:`1px solid ${T.border}`,overflow:'hidden'}}>
              <div style={{background:T.charcoal,padding:'20px 24px'}}>
                <h2 style={{fontFamily:"'Cormorant Garamond'",fontSize:26,fontWeight:400,color:T.white}}>{p.title}</h2>
                {p.description&&<p style={{fontFamily:"'Cormorant Garamond'",fontStyle:'italic',fontSize:14,color:T.muted,marginTop:4}}>{p.description}</p>}
              </div>
              <div style={{padding:'20px 24px'}}>
                <BrassDivider label="Ingredients"/>
                {p.ingredients.slice(0,8).map((ing,i)=>(
                  <div key={i} style={{display:'flex',gap:10,padding:'7px 0',borderBottom:`1px solid ${T.borderLight}`}}>
                    <div style={{width:5,height:5,borderRadius:'50%',background:T.brass,marginTop:8,flexShrink:0}}/>
                    <span style={{fontSize:14,color:T.charcoal}}>{ing}</span>
                  </div>
                ))}

                <button onClick={()=>setShowChat(true)} style={{width:'100%',marginTop:20,padding:'13px',background:T.offWhite,border:`1.5px solid ${T.border}`,borderRadius:10,display:'flex',alignItems:'center',justifyContent:'center',gap:8,fontSize:13,fontWeight:500,color:T.charcoal,transition:'all .2s'}}
                  onMouseEnter={e=>{e.currentTarget.style.background=T.brassGlow;e.currentTarget.style.borderColor=T.brass}}
                  onMouseLeave={e=>{e.currentTarget.style.background=T.offWhite;e.currentTarget.style.borderColor=T.border}}>
                  <Icon name="chat" size={16} color={T.brass}/>
                  Modify this recipe with AI chat
                </button>

                <div style={{display:'flex',gap:10,marginTop:12}}>
                  <button className="btn-brass" onClick={async()=>{await onAddRecipe(generated);setSaved(true)}} disabled={saved} style={{flex:1,display:'flex',alignItems:'center',justifyContent:'center',gap:8}}>
                    {saved?<><Icon name="check" size={15} color={T.white}/> Saved!</>:<><Icon name="plus" size={15} color={T.white}/> Save to My Collection</>}
                  </button>
                </div>
                {!saved&&<p style={{fontSize:11,color:T.muted,textAlign:'center',marginTop:8}}>You can ♥ favorite it from your Library</p>}
              </div>
            </div>
          )
        })()}
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════
// MAIN APP
// ══════════════════════════════════════════════════════════════════════════
export default function App() {
  const {user,loading:authLoading,signIn,signUp,signOut,resetPassword}=useAuth()
  const {recipes,favorites,menus,loading:recipesLoading,addRecipe,updateRecipe,toggleFavorite,deleteRecipe,createMenu,deleteMenu}=useRecipes(user)
  const {allergens,saveAllergens,defaultServings,saveDefaultServings}=usePreferences(user)
  const [activeTab,setActiveTab]=useState('discover')
  const [viewingRecipe,setViewingRecipe]=useState(null)

  const handleUpdate=useCallback(async(updated)=>{ const s=await updateRecipe(updated); if(s&&viewingRecipe?.id===s.id)setViewingRecipe(s) },[updateRecipe,viewingRecipe])
  const handleFavorite=useCallback(async(recipe)=>{ await toggleFavorite(recipe) },[toggleFavorite])

  const shell=(children)=>(
    <div style={{display:'flex',flexDirection:'column',height:'100vh',maxWidth:500,margin:'0 auto',background:T.white,overflow:'hidden',boxShadow:'0 0 80px rgba(0,0,0,.5)'}}>
      {children}
    </div>
  )

  if(authLoading) return shell(<div style={{flex:1,display:'flex',alignItems:'center',justifyContent:'center',background:T.black}}><LoadingDots/></div>)
  if(!user) return shell(<Auth onSignIn={signIn} onSignUp={signUp} onReset={resetPassword}/>)

  const tabs=[
    {id:'discover',icon:'sparkle',label:'Discover'},
    {id:'favorites',icon:'heart',label:'Favorites'},
    {id:'pantry',icon:'fridge',label:'Pantry'},
    {id:'prefs',icon:'settings',label:'Prefs'},
  ]

  return shell(<>
    <div style={{height:3,background:`linear-gradient(90deg,${T.brass},${T.brassDark},${T.brass})`,flexShrink:0}}/>
    <div style={{flex:1,overflow:'hidden',position:'relative'}}>
      {activeTab==='discover'&&<DiscoverTab onAddRecipe={addRecipe} onOpenRecipe={setViewingRecipe} allergens={allergens} defaultServings={defaultServings}/>}
      {activeTab==='favorites'&&<FavoritesTab favorites={favorites} recipes={recipes} menus={menus} onOpenRecipe={setViewingRecipe} onFavorite={handleFavorite} onCreateMenu={createMenu} onDeleteMenu={deleteMenu} onUpdate={handleUpdate}/>}
      {activeTab==='pantry'&&<PantryTab onAddRecipe={addRecipe} onOpenRecipe={setViewingRecipe} onFavorite={handleFavorite} allergens={allergens} defaultServings={defaultServings}/>}
      {activeTab==='prefs'&&<PreferencesTab allergens={allergens} onSaveAllergens={saveAllergens} defaultServings={defaultServings} onSaveServings={saveDefaultServings}/>}
    </div>
    <div style={{background:T.charcoal,borderTop:`1px solid ${T.border}`,display:'flex',flexShrink:0,paddingBottom:'env(safe-area-inset-bottom)',width:'100%'}}>
      {tabs.map(tab=>{
        const isActive=activeTab===tab.id
        return (
          <button key={tab.id} onClick={()=>setActiveTab(tab.id)} style={{flex:1,padding:'12px 4px 10px',background:'none',border:'none',display:'flex',flexDirection:'column',alignItems:'center',gap:4,color:isActive?T.brass:T.muted,transition:'all .2s',position:'relative',cursor:'pointer'}}>
            {isActive&&<div style={{position:'absolute',top:0,left:'50%',transform:'translateX(-50%)',width:32,height:2,borderRadius:'0 0 2px 2px',background:`linear-gradient(90deg,${T.brass},${T.brassLight})`}}/>}
            <div style={{transform:isActive?'scale(1.1)':'scale(1)',transition:'transform .2s'}}>
              <Icon name={isActive&&tab.id==='favorites'?'heartFill':tab.icon} size={22} color={isActive?T.brass:T.muted}/>
            </div>
            <span style={{fontSize:10,fontWeight:500,letterSpacing:'.05em',textTransform:'uppercase'}}>{tab.label}</span>
          </button>
        )
      })}
      <button onClick={signOut} style={{flex:1,padding:'12px 4px 10px',background:'none',border:'none',display:'flex',flexDirection:'column',alignItems:'center',gap:4,color:T.muted,cursor:'pointer'}}>
        <Icon name="logout" size={20} color={T.muted}/>
        <span style={{fontSize:10,fontWeight:500,letterSpacing:'.05em',textTransform:'uppercase'}}>Out</span>
      </button>
    </div>
    {viewingRecipe&&<RecipeDetail recipe={viewingRecipe} onClose={()=>setViewingRecipe(null)} onFavorite={handleFavorite} isFavorited={favorites.some(f=>f.id===viewingRecipe.id)} onUpdate={handleUpdate}/>}
  </>)
}

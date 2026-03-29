import { useState, useEffect, useCallback, createContext, useContext } from "react";
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, ReferenceLine } from "recharts";
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged, updateProfile } from "firebase/auth";
import { doc, setDoc, getDoc, collection, getDocs, query, orderBy, limit } from "firebase/firestore";
import { auth, db } from "./firebase";

// ── CONSTANTS ─────────────────────────────────────────────────────────────────
// v2.1.0 build 202603251729
const MONTHS = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];
const CY = new Date().getFullYear();

const DEFAULT_CATS = [
  { id:"casa",       icon:"🏠", label:"Casa",        color:"#c0392b", items:[{id:"hipoteca",label:"Hipoteca/Alquiler"},{id:"suministros",label:"Suministros"},{id:"telecom",label:"Telecomunicaciones"}]},
  { id:"vida",       icon:"🛒", label:"Vida Diaria",  color:"#e67e22", items:[{id:"compra",label:"Supermercado"},{id:"restaurantes",label:"Restaurantes"}]},
  { id:"transporte", icon:"🚗", label:"Transporte",   color:"#2c3e50", items:[{id:"combustible",label:"Combustible"},{id:"bus",label:"Transporte público"}]},
  { id:"educacion",  icon:"📚", label:"Educación",    color:"#8e44ad", items:[{id:"colegios",label:"Colegios"},{id:"cursos",label:"Cursos"}]},
  { id:"salud",      icon:"❤️", label:"Salud",        color:"#c0392b", items:[{id:"medicos",label:"Médicos/Farmacia"},{id:"gimnasio",label:"Gimnasio"}]},
  { id:"ocio",       icon:"🎭", label:"Ocio",         color:"#7f8c8d", items:[{id:"vacaciones",label:"Vacaciones"},{id:"entret",label:"Entretenimiento"}]},
];
const INC    = [{id:"salarios",label:"Salarios (neto)"},{id:"dividendos",label:"Dividendos/Intereses"},{id:"otros",label:"Otros ingresos"}];
const ATYPES = ["Acciones","ETF","Fondo inversión","Plan pensiones","Inmobiliario","Cuenta corriente","Bono","Otro"];
const LTYPES = ["Hipoteca","Préstamo personal","Tarjeta crédito","Préstamo coche","Otro"];
const ACOLORS= ["#c0392b","#2c3e50","#e67e22","#8e44ad","#27ae60","#2980b9","#f39c12","#7f8c8d"];
const CAT_ICONS = ["🏠","🛒","🚗","📚","❤️","🎭","💊","✈️","🐾","👔","🎮","🍽️","🏋️","🎓","💡"];
const CAT_COLORS = ["#c0392b","#e67e22","#2c3e50","#8e44ad","#27ae60","#2980b9","#f39c12","#7f8c8d","#16a085","#d35400"];

// ── HELPERS ───────────────────────────────────────────────────────────────────
const f   = n => n == null ? "—" : new Intl.NumberFormat("es-ES",{style:"currency",currency:"EUR",minimumFractionDigits:0,maximumFractionDigits:0}).format(n);
const fk  = n => Math.abs(n)>=1000?(n/1000).toFixed(1)+"k":String(Math.round(n));
const gc  = v => v >= 0 ? "#27ae60" : "#c0392b";
const now = () => new Date().toISOString().slice(0,10);
const nid = () => Math.random().toString(36).slice(2,10);

function emptyMonthFromCats(cats) {
  const inc={}, exp={};
  INC.forEach(i => { inc[i.id]={p:0,r:0}; });
  cats.forEach(c => c.items.forEach(it => { exp[it.id]={p:0,r:0}; }));
  return {inc, exp};
}
function emptyYearFromCats(cats) {
  const y={};
  for(let i=0;i<12;i++) y[i]=emptyMonthFromCats(cats);
  return y;
}
function freshApp() {
  return {budgets:{[CY]:emptyYearFromCats(DEFAULT_CATS)}, annuals:{}, assets:[], liabilities:[], valHistory:{}, cats:DEFAULT_CATS};
}

// ── FIREBASE ──────────────────────────────────────────────────────────────────
// ── MASTER USER ──────────────────────────────────────────────────────────────
// Set your Firebase UID here to enable master access
// Get your UID from Firebase Console → Authentication → Users
const MASTER_UID = "uH2MmY0aMgXSjmVG3V2WcnYxOUO2";

async function loadUserData(uid) {
  try { const s=await getDoc(doc(db,"users",uid)); return s.exists()?s.data().appData:null; } catch { return null; }
}
async function saveUserData(uid, appData) {
  try { await setDoc(doc(db,"users",uid),{appData,updatedAt:new Date().toISOString()},{merge:true}); } catch(e){console.error(e);}
}
async function listAllUsers() {
  try {
    const q=query(collection(db,"users"),orderBy("updatedAt","desc"),limit(100));
    const snap=await getDocs(q);
    return snap.docs.map(d=>({uid:d.id,...(d.data().userMeta||{}),updatedAt:d.data().updatedAt}));
  } catch(e){console.error(e);return [];}
}
async function saveUserMeta(uid,meta) {
  try { await setDoc(doc(db,"users",uid),{userMeta:meta},{merge:true}); } catch(e){}
}

// ── THEME — Invertir de 0 a 100 / Renta4 style ───────────────────────────────
const BUILD_TS="1774463537"; const BG="#1a1a2e", CARD="#16213e", BOR="#0f3460", ACC="#c0392b", A2="#e74c3c";
const GRN="#27ae60", RED="#c0392b", YLW="#f39c12", TXT="#ecf0f1", MUT="#95a5a6", SRF="#0f3460";
const ACCENT_LIGHT="#e8d5d5";

const CSS=`
@import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@400;600;700;800;900&family=Open+Sans:wght@400;600&display=swap');
*{box-sizing:border-box;margin:0;padding:0;}
html,body{background:${BG};color:${TXT};font-family:'Open Sans',sans-serif;font-size:14px;overscroll-behavior:none;}
input,select{background:${SRF};border:1.5px solid ${BOR};color:${TXT};border-radius:8px;padding:11px 13px;font-size:14px;outline:none;width:100%;font-family:'Open Sans',sans-serif;}
input:focus,select:focus{border-color:${ACC};}
button{cursor:pointer;border:none;font-family:'Montserrat',sans-serif;font-weight:700;}
::-webkit-scrollbar{width:3px;height:3px;}
::-webkit-scrollbar-thumb{background:${BOR};border-radius:4px;}
@keyframes su{from{opacity:0;transform:translateY(16px);}to{opacity:1;transform:none;}}
.su{animation:su .2s ease;}
.title{font-family:'Montserrat',sans-serif;}
`;

// ── UI ATOMS ──────────────────────────────────────────────────────────────────
function Card({children,style,onClick}){
  return <div onClick={onClick} style={{background:CARD,border:`1px solid ${BOR}`,borderRadius:12,padding:16,...style}}>{children}</div>;
}
function Kpi({label,value,color,sub}){
  return <Card style={{padding:"14px 16px"}}>
    <div className="title" style={{fontSize:9,color:MUT,fontWeight:700,textTransform:"uppercase",letterSpacing:".08em",marginBottom:5}}>{label}</div>
    <div style={{fontSize:21,fontWeight:800,color:color||TXT,fontFamily:"monospace",lineHeight:1}}>{value}</div>
    {sub&&<div style={{fontSize:11,color:MUT,marginTop:4}}>{sub}</div>}
  </Card>;
}
function Pbar({val,max,color,h=6}){
  const w=max>0?Math.min(100,Math.round(val/max*100)):0;
  return <div style={{background:BOR,borderRadius:4,height:h,overflow:"hidden"}}><div style={{width:w+"%",background:color||ACC,height:"100%",borderRadius:4,transition:"width .4s"}}/></div>;
}
function MScroll({month,setMonth,bud,cats}){
  return <div style={{overflowX:"auto",marginLeft:-16,marginRight:-16,paddingLeft:16,marginBottom:14}}>
    <div style={{display:"flex",gap:6,width:"max-content",paddingRight:16}}>
      {MONTHS.map((m,i)=>{
        const has=INC.some(it=>(bud[i]?.inc[it.id]?.r||0)>0)||cats.flatMap(c=>c.items).some(it=>(bud[i]?.exp[it.id]?.r||0)>0);
        return <button key={i} onClick={()=>setMonth(i)} style={{padding:"7px 13px",borderRadius:8,fontSize:13,flexShrink:0,background:month===i?ACC:CARD,color:month===i?"#fff":has?TXT:MUT,border:`1px solid ${month===i?ACC:BOR}`,position:"relative",fontFamily:"Montserrat,sans-serif",fontWeight:600}}>
          {m}{has&&month!==i&&<span style={{position:"absolute",top:3,right:3,width:5,height:5,background:GRN,borderRadius:"50%"}}/>}
        </button>;
      })}
    </div>
  </div>;
}
function TipComp({active,payload,label}){
  if(!active||!payload||!payload.length) return null;
  return <div style={{background:CARD,border:`1px solid ${BOR}`,borderRadius:8,padding:"9px 13px"}}>
    <div className="title" style={{fontSize:12,fontWeight:700,marginBottom:4}}>{label}</div>
    {payload.map((p,i)=><div key={i} style={{fontSize:11,color:p.color||TXT}}>{p.name}: {f(p.value)}</div>)}
  </div>;
}
function BottomSheet({title,sub,onClose,children}){
  return <div style={{position:"fixed",inset:0,background:"#000c",zIndex:200,display:"flex",flexDirection:"column",justifyContent:"flex-end"}}>
    <div style={{background:BG,borderRadius:"20px 20px 0 0",maxHeight:"90vh",display:"flex",flexDirection:"column"}}>
      <div style={{display:"flex",justifyContent:"center",padding:"10px 0 4px"}}>
        <div style={{width:36,height:4,background:BOR,borderRadius:2}}/>
      </div>
      <div style={{padding:"4px 16px 14px",borderBottom:`1px solid ${BOR}`,display:"flex",justifyContent:"space-between",alignItems:"center",flexShrink:0}}>
        <div>
          <div className="title" style={{fontSize:16,fontWeight:800}}>{title}</div>
          {sub&&<div style={{fontSize:11,color:MUT}}>{sub}</div>}
        </div>
        <button onClick={onClose} style={{background:SRF,borderRadius:8,padding:"6px 10px",color:MUT,fontSize:13}}>✕</button>
      </div>
      <div style={{overflowY:"auto",flex:1}}>{children}</div>
    </div>
  </div>;
}

// ── LOGIN ─────────────────────────────────────────────────────────────────────
function Login({onAuth}){
  const [mode,setMode]=useState("login");
  const [name,setName]=useState("");
  const [email,setEmail]=useState("");
  const [pass,setPass]=useState("");
  const [err,setErr]=useState("");
  const [busy,setBusy]=useState(false);

  async function submit(){
    setErr(""); setBusy(true);
    try{
      if(!email||!pass){setErr("Completa todos los campos.");setBusy(false);return;}
      if(mode==="register"){
        if(!name){setErr("Escribe tu nombre.");setBusy(false);return;}
        if(pass.length<6){setErr("Contraseña mínimo 6 caracteres.");setBusy(false);return;}
        const cred=await createUserWithEmailAndPassword(auth,email,pass);
        await updateProfile(cred.user,{displayName:name});
        onAuth(cred.user);
      } else {
        const cred=await signInWithEmailAndPassword(auth,email,pass);
        onAuth(cred.user);
      }
    } catch(e){
      const msgs={"auth/email-already-in-use":"Email ya registrado.","auth/wrong-password":"Contraseña incorrecta.","auth/user-not-found":"No existe cuenta con ese email.","auth/invalid-credential":"Email o contraseña incorrectos.","auth/too-many-requests":"Demasiados intentos. Espera un momento."};
      setErr(msgs[e.code]||"Error: "+e.message);
    }
    setBusy(false);
  }

  return <div style={{minHeight:"100vh",background:BG,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:24}}>
    <style>{CSS}</style>
    {/* Header brand */}
    <div style={{width:"100%",maxWidth:400,marginBottom:32}}>
      <div style={{background:`linear-gradient(135deg,${ACC},#922b21)`,borderRadius:16,padding:"24px 20px",textAlign:"center",marginBottom:8}}>
        <div className="title" style={{fontSize:13,color:"rgba(255,255,255,0.8)",fontWeight:600,letterSpacing:".1em",textTransform:"uppercase",marginBottom:6}}>Invertir de 0 a 100</div>
        <div className="title" style={{fontSize:26,fontWeight:900,color:"#fff",lineHeight:1.1}}>Finanzas<br/>Personales</div>
        <div style={{width:40,height:3,background:"rgba(255,255,255,0.5)",borderRadius:2,margin:"12px auto 0"}}/>
      </div>
      <div style={{textAlign:"center",padding:"8px 0"}}>
        <div style={{fontSize:11,color:MUT,fontWeight:600,letterSpacing:".08em"}}>RENTA4 BANCO · GESTIÓN PATRIMONIAL</div>
      </div>
    </div>

    <div style={{width:"100%",maxWidth:400}}>
      <div style={{display:"flex",background:CARD,borderRadius:10,padding:4,marginBottom:20,border:`1px solid ${BOR}`}}>
        {["login","register"].map(m=>(
          <button key={m} onClick={()=>{setMode(m);setErr("");}} style={{flex:1,padding:"9px 0",borderRadius:8,fontSize:13,background:mode===m?ACC:"transparent",color:mode===m?"#fff":MUT}}>
            {m==="login"?"Entrar":"Registrarse"}
          </button>
        ))}
      </div>
      <div style={{display:"flex",flexDirection:"column",gap:12}}>
        {mode==="register"&&<div><div style={{fontSize:12,color:MUT,fontWeight:600,marginBottom:5}}>Nombre</div><input value={name} onChange={e=>setName(e.target.value)} placeholder="Tu nombre"/></div>}
        <div><div style={{fontSize:12,color:MUT,fontWeight:600,marginBottom:5}}>Email</div><input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="tu@email.com"/></div>
        <div><div style={{fontSize:12,color:MUT,fontWeight:600,marginBottom:5}}>Contraseña</div><input type="password" value={pass} onChange={e=>setPass(e.target.value)} placeholder="••••••••" onKeyDown={e=>e.key==="Enter"&&submit()}/></div>
        {err&&<div style={{background:RED+"22",color:"#e74c3c",borderRadius:8,padding:"10px 14px",fontSize:13}}>{err}</div>}
        <button onClick={submit} disabled={busy} style={{padding:"14px",borderRadius:10,background:`linear-gradient(135deg,${ACC},#922b21)`,color:"#fff",fontSize:14,marginTop:4,opacity:busy?.6:1,letterSpacing:".02em"}}>
          {busy?"Procesando…":mode==="login"?"Entrar →":"Crear cuenta →"}
        </button>
      </div>
      <div style={{textAlign:"center",marginTop:16,fontSize:11,color:MUT}}>Datos guardados de forma segura en la nube</div>
    </div>
  </div>;
}

// ── MASTER VIEW ───────────────────────────────────────────────────────────────
function MasterView({users,loading,viewingUser,onSelectUser,onRefresh}){
  const [search,setSearch]=useState("");
  const filtered=users.filter(u=>{
    if(!search)return true;
    const q=search.toLowerCase();
    return(u.email||"").toLowerCase().includes(q)||(u.name||"").toLowerCase().includes(q);
  });

  return <div className="su">
    {/* Header */}
    <div style={{background:"linear-gradient(135deg,#f39c12,#e67e22)",borderRadius:14,padding:"16px 16px",marginBottom:16,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
      <div>
        <div className="title" style={{fontSize:11,color:"rgba(255,255,255,0.7)",fontWeight:700,textTransform:"uppercase",letterSpacing:".08em"}}>Vista Master</div>
        <div className="title" style={{fontSize:20,fontWeight:900,color:"#fff"}}>{users.length} usuarios</div>
        {viewingUser&&<div style={{fontSize:11,color:"rgba(255,255,255,0.9)",marginTop:4}}>👁 Viendo: {viewingUser.name||viewingUser.email}</div>}
      </div>
      <div style={{display:"flex",gap:8}}>
        {viewingUser&&<button onClick={()=>onSelectUser(null)} style={{padding:"8px 12px",borderRadius:8,background:"rgba(255,255,255,0.2)",color:"#fff",fontSize:12,fontWeight:700,border:"1px solid rgba(255,255,255,0.3)"}}>← Salir</button>}
        <button onClick={onRefresh} disabled={loading} style={{width:36,height:36,borderRadius:8,background:"rgba(255,255,255,0.2)",color:"#fff",fontSize:16,border:"1px solid rgba(255,255,255,0.3)"}}>
          {loading?"⏳":"🔄"}
        </button>
      </div>
    </div>

    {/* Search */}
    <div style={{marginBottom:12,position:"relative"}}>
      <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="🔍 Buscar usuario por email o nombre..."/>
    </div>

    {/* User list */}
    {loading
      ?<Card style={{textAlign:"center",padding:32}}><div style={{fontSize:32,marginBottom:8}}>⏳</div><div style={{color:MUT}}>Cargando usuarios...</div></Card>
      :filtered.length===0
        ?<Card style={{textAlign:"center",padding:32}}><div style={{fontSize:32,marginBottom:8}}>👥</div><div style={{color:MUT}}>No hay usuarios registrados todavía</div></Card>
        :<Card style={{padding:"8px 0"}}>
          {filtered.map((u,i)=>{
            const isViewing=viewingUser?.uid===u.uid;
            const lastLogin=u.lastLogin?new Date(u.lastLogin).toLocaleDateString("es-ES",{day:"2-digit",month:"2-digit",year:"2-digit",hour:"2-digit",minute:"2-digit"}):"—";
            return <div key={u.uid} style={{display:"flex",alignItems:"center",gap:12,padding:"12px 16px",borderBottom:i<filtered.length-1?`1px solid ${BOR}22`:"none",background:isViewing?"#f39c1211":"transparent"}}>
              {/* Avatar */}
              <div style={{width:38,height:38,borderRadius:"50%",background:`linear-gradient(135deg,${ACC},#922b21)`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,flexShrink:0,fontWeight:700,color:"#fff"}}>
                {(u.name||u.email||"?")[0].toUpperCase()}
              </div>
              {/* Info */}
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:13,fontWeight:700,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{u.name||"Sin nombre"}</div>
                <div style={{fontSize:11,color:MUT,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{u.email}</div>
                <div style={{fontSize:10,color:MUT,marginTop:2}}>🕐 {lastLogin}</div>
              </div>
              {/* Action */}
              {isViewing
                ?<div style={{fontSize:11,fontWeight:700,color:"#f39c12",background:"#f39c1222",borderRadius:6,padding:"4px 10px",border:"1px solid #f39c1244",flexShrink:0}}>👁 Viendo</div>
                :<button onClick={()=>onSelectUser(u)} style={{padding:"8px 12px",borderRadius:8,background:`linear-gradient(135deg,${ACC},#922b21)`,color:"#fff",fontSize:11,fontWeight:700,flexShrink:0}}>
                  Ver sesión →
                </button>}
            </div>;
          })}
        </Card>
    }

    <div style={{fontSize:10,color:MUT,textAlign:"center",marginTop:12}}>
      Modo consultivo — solo lectura. Los cambios no se guardan.
    </div>
  </div>;
}


// ── APP ROOT ──────────────────────────────────────────────────────────────────
export default function App(){
  const [fbUser,setFbUser]=useState(undefined);
  const [masterMode,setMasterMode]=useState(false);
  const [viewingUser,setViewingUser]=useState(null); // {uid, email, name}
  const [masterUserList,setMasterUserList]=useState([]);
  const [masterLoadingUsers,setMasterLoadingUsers]=useState(false);
  const [appData,setAppData]=useState(null);
  const [tab,setTab]=useState("home");
  const [headerTool,setHeaderTool]=useState("profile");
  const [initTool,setInitTool]=useState("profile");
  const [year,setYear]=useState(CY);
  const [month,setMonth]=useState(new Date().getMonth());
  const [saving,setSaving]=useState(false);

  useEffect(()=>{
    const unsub=onAuthStateChanged(auth,async user=>{
      setFbUser(user);
      if(user){
        const d=await loadUserData(user.uid);
        setAppData(d||freshApp());
        // Save user meta for master view
        saveUserMeta(user.uid,{email:user.email,name:user.displayName||user.email,lastLogin:new Date().toISOString()});
        // Ask for name if missing
if(!user.displayName){
  setTimeout(()=>{
    const n=prompt("👋 ¡Hola! Para personalizar tu experiencia, ¿cómo te llamas?");
    if(n&&n.trim()){
      updateProfile(user,{displayName:n.trim()}).then(()=>{
        saveUserMeta(user.uid,{email:user.email,name:n.trim(),lastLogin:new Date().toISOString()});
      });
    }
  },1500);
}        
       // Check if master
        console.log("UID login:", user.uid, "MASTER:", MASTER_UID, "match:", user.uid===MASTER_UID);
if(user.uid===MASTER_UID) setMasterMode(true);
      }
      else setAppData(null);
    });
    return unsub;
  },[]);

  const upd=useCallback((fn)=>{
    // Read-only mode when master is viewing another user
    if(viewingUser){return;}
    setAppData(prev=>{
      const next=JSON.parse(JSON.stringify(prev));
      fn(next);
      setSaving(true);
      saveUserData(fbUser.uid,next).finally(()=>setSaving(false));
      return next;
    });
  },[fbUser,viewingUser]);

  async function logout(){await signOut(auth);setFbUser(null);setAppData(null);}

  if(fbUser===undefined) return <div style={{height:"100vh",display:"flex",alignItems:"center",justifyContent:"center",background:BG,flexDirection:"column",gap:12}}><style>{CSS}</style><div style={{fontSize:48}}>📈</div><div className="title" style={{color:ACC,fontSize:14,fontWeight:700}}>Invertir de 0 a 100</div></div>;
  if(!fbUser) return <Login onAuth={setFbUser}/>;
  if(!appData) return <div style={{height:"100vh",display:"flex",alignItems:"center",justifyContent:"center",background:BG}}><style>{CSS}</style><div style={{color:MUT}}>Cargando...</div></div>;

  const cats=appData.cats||DEFAULT_CATS;
  const bud=(appData.budgets&&appData.budgets[year])?appData.budgets[year]:emptyYearFromCats(cats);
  const md=bud[month]||emptyMonthFromCats(cats);
  const iP=INC.reduce((s,i)=>s+(md.inc[i.id]?.p||0),0);
  const iR=INC.reduce((s,i)=>s+(md.inc[i.id]?.r||0),0);
  const eP=cats.flatMap(c=>c.items).reduce((s,i)=>s+(md.exp[i.id]?.p||0),0);
  const eR=cats.flatMap(c=>c.items).reduce((s,i)=>s+(md.exp[i.id]?.r||0),0);

  const TABS=[{id:"home",ico:"🏠"},{id:"budget",ico:"💰"},{id:"balance",ico:"⚖️"},{id:"markets",ico:"🌍"}];

  return <WLProvider uid={fbUser?.uid}><div style={{minHeight:"100vh",background:BG,paddingBottom:80}}>
    <style>{CSS}</style>
    {/* Header */}
    <div style={{background:`linear-gradient(135deg,${CARD},${SRF})`,borderBottom:`1px solid ${BOR}`,padding:"12px 16px",display:"flex",alignItems:"center",justifyContent:"space-between",position:"sticky",top:0,zIndex:40}}>
      <div style={{display:"flex",alignItems:"center",gap:10}}>
        <div style={{width:36,height:36,background:`linear-gradient(135deg,${ACC},#922b21)`,borderRadius:10,display:"flex",alignItems:"center",justifyContent:"center",fontSize:18}}>📈</div>
        <div>
          <div className="title" style={{fontSize:13,fontWeight:900,lineHeight:1,color:TXT}}>Invertir de 0 a 100</div>
          <div style={{fontSize:10,color:ACC,fontWeight:600}}>Hola, {fbUser.displayName||fbUser.email}</div>
        </div>
      </div>
      <div style={{display:"flex",gap:8,alignItems:"center"}}>
        {viewingUser&&<div style={{fontSize:10,color:"#f39c12",background:"#f39c1222",borderRadius:6,padding:"3px 8px",border:"1px solid #f39c1244",fontWeight:700}}>👁 MODO CONSULTA</div>}
        {saving&&!viewingUser&&<div style={{fontSize:10,color:MUT}}>💾</div>}
        <select value={year} onChange={e=>setYear(+e.target.value)} style={{width:82,padding:"6px 8px",fontSize:13}}>{Array.from({length:16},(_,i)=>2025+i).map(y=><option key={y}>{y}</option>)}</select>
        {masterMode&&<button onClick={async()=>{setMasterLoadingUsers(true);const u=await listAllUsers();setMasterUserList(u);setMasterLoadingUsers(false);setTab("master");}} title="Vista Master" style={{width:34,height:34,background:tab==="master"?"#f39c1233":SRF,border:`1px solid ${tab==="master"?"#f39c12":BOR}`,borderRadius:8,fontSize:18,display:"flex",alignItems:"center",justifyContent:"center"}}>👑</button>}
        {viewingUser&&<div style={{fontSize:10,color:"#f39c12",background:"#f39c1222",borderRadius:6,padding:"3px 8px",border:"1px solid #f39c1244"}}>👁 {viewingUser.name||viewingUser.email}</div>}
        <button onClick={()=>{setInitTool("watchlist");setTab("tools");}} title="Watchlist" style={{width:34,height:34,background:(tab==="tools"&&initTool==="watchlist")?ACC+"33":SRF,border:`1px solid ${(tab==="tools"&&initTool==="watchlist")?ACC:BOR}`,borderRadius:8,fontSize:18,display:"flex",alignItems:"center",justifyContent:"center"}}>⭐</button>
        <button onClick={()=>{setInitTool("profile");setTab("tools");}} title="Herramientas" style={{width:34,height:34,background:(tab==="tools"&&initTool!=="watchlist")?ACC+"33":SRF,border:`1px solid ${(tab==="tools"&&initTool!=="watchlist")?ACC:BOR}`,borderRadius:8,fontSize:18,display:"flex",alignItems:"center",justifyContent:"center"}}>🛠️</button>
        <button onClick={logout} title="Cerrar sesión" style={{width:34,height:34,background:SRF,border:`1px solid ${BOR}`,borderRadius:8,fontSize:16,display:"flex",alignItems:"center",justifyContent:"center"}}>🚪</button>
      </div>
    </div>

    <div style={{padding:16}}>
      {tab==="home"   &&<HomeTab   appData={appData} year={year} month={month} setMonth={setMonth} bud={bud} iP={iP} iR={iR} eP={eP} eR={eR} cats={cats}/>}
      {tab==="budget" &&<BudgetTab appData={appData} upd={upd} year={year} setYear={setYear} month={month} setMonth={setMonth} bud={bud} md={md} iP={iP} iR={iR} eP={eP} eR={eR} cats={cats}/>}
      {tab==="balance"&&<BalanceGroupTab appData={appData} upd={upd}/>}
      {tab==="markets"&&<MarketsTab/>}
      {tab==="tools"   &&<ToolsTab initTool={initTool} masterMode={masterMode}/>}
      {tab==="master"  &&masterMode&&<MasterView
        users={masterUserList}
        loading={masterLoadingUsers}
        viewingUser={viewingUser}
        onSelectUser={async(u)=>{
          if(!u){setViewingUser(null);const d=await loadUserData(fbUser.uid);setAppData(d||freshApp());setTab("home");return;}
          const d=await loadUserData(u.uid);
          if(d){setAppData(d);setViewingUser(u);setTab("home");}
          else alert("Este usuario no tiene datos guardados.");
        }}
        onRefresh={async()=>{setMasterLoadingUsers(true);const u=await listAllUsers();setMasterUserList(u);setMasterLoadingUsers(false);}}
      />}
    </div>

    {/* Bottom Nav - 3 tabs */}
    <div style={{position:"fixed",bottom:0,left:0,right:0,background:CARD,borderTop:`2px solid ${ACC}`,display:"flex",zIndex:50}}>
      {TABS.map(t=>(
        <button key={t.id} onClick={()=>setTab(t.id)} style={{flex:1,padding:"14px 0",background:"transparent",color:tab===t.id?ACC:MUT,display:"flex",flexDirection:"column",alignItems:"center",gap:0}}>
          <span style={{fontSize:28,lineHeight:1}}>{t.ico}</span>
          {tab===t.id&&<div style={{width:24,height:2.5,background:ACC,borderRadius:2,marginTop:5}}/>}
        </button>
      ))}
    </div>
  </div></WLProvider>;
}

// ── HOME ──────────────────────────────────────────────────────────────────────
function HomeTab({appData,year,month,setMonth,bud,iP,iR,eP,eR,cats}){
  const sav=iR-eR,savP=iP-eP;
  const ytdI=MONTHS.reduce((s,_,i)=>s+INC.reduce((ss,it)=>ss+(bud[i]?.inc[it.id]?.r||0),0),0);
  const ytdE=MONTHS.reduce((s,_,i)=>s+cats.flatMap(c=>c.items).reduce((ss,it)=>ss+(bud[i]?.exp[it.id]?.r||0),0),0);
  const tA=(appData.assets||[]).filter(a=>a.status==="active").reduce((s,a)=>s+a.cv*a.qty,0);
  const tL=(appData.liabilities||[]).reduce((s,l)=>s+l.amount,0);
  return <div className="su">
    <MScroll month={month} setMonth={setMonth} bud={bud} cats={cats}/>
    {/* Month banner */}
    <div style={{background:`linear-gradient(135deg,${ACC}22,${SRF})`,border:`1px solid ${ACC}44`,borderRadius:12,padding:"12px 16px",marginBottom:14}}>
      <div className="title" style={{fontSize:11,color:ACC,fontWeight:700,textTransform:"uppercase",letterSpacing:".08em"}}>{MONTHS[month]} {year} — Resumen</div>
    </div>
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:16}}>
      <Kpi label="Ingresos" value={f(iR)} color={GRN} sub={"Pres: "+f(iP)}/>
      <Kpi label="Gastos" value={f(eR)} color={RED} sub={"Pres: "+f(eP)}/>
      <Kpi label="Ahorro mes" value={f(sav)} color={gc(sav)} sub={"Obj: "+f(savP)}/>
      <Kpi label="Tasa ahorro" value={iR>0?(sav/iR*100).toFixed(1)+"%":"—"} color={gc(sav)}/>
    </div>
    {eP>0&&<Card style={{marginBottom:16}}>
      <div className="title" style={{fontSize:11,fontWeight:700,color:ACC,marginBottom:12,textTransform:"uppercase",letterSpacing:".06em"}}>Gasto vs Presupuesto</div>
      {cats.map(cat=>{
        const cP=cat.items.reduce((s,i)=>s+(bud[month]?.exp[i.id]?.p||0),0);
        const cR=cat.items.reduce((s,i)=>s+(bud[month]?.exp[i.id]?.r||0),0);
        if(!cP&&!cR) return null;
        return <div key={cat.id} style={{marginBottom:10}}>
          <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
            <span style={{fontSize:12}}>{cat.icon} {cat.label}</span>
            <span style={{fontSize:11,fontFamily:"monospace",color:cR>cP?RED:GRN}}>{f(cR)}/{f(cP)}</span>
          </div>
          <Pbar val={cR} max={cP||1} color={cR>cP?RED:cat.color}/>
        </div>;
      })}
    </Card>}
    <div className="title" style={{fontSize:11,color:ACC,fontWeight:700,textTransform:"uppercase",letterSpacing:".06em",marginBottom:10}}>Resumen Anual {year}</div>
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
      <Kpi label="Ingresos año" value={f(ytdI)} color={GRN}/>
      <Kpi label="Gastos año" value={f(ytdE)} color={RED}/>
      <Kpi label="Ahorro año" value={f(ytdI-ytdE)} color={gc(ytdI-ytdE)}/>
      <Kpi label="Patrimonio neto" value={f(tA-tL)} color={gc(tA-tL)}/>
    </div>
  </div>;
}

// ── BUDGET ────────────────────────────────────────────────────────────────────
function BudgetTab({appData,upd,year,setYear,month,setMonth,bud,md,iP,iR,eP,eR,cats}){
  const [subTab,setSubTab]=useState("presupuesto");
  const [mode,setMode]=useState("real");
  const [open,setOpen]=useState({});
  const [showWiz,setShowWiz]=useState(false);
  const [showCatMgr,setShowCatMgr]=useState(false);

  function setV(mi,sec,id,field,v){
    upd(d=>{
      if(!d.budgets) d.budgets={};
      const cats=d.cats||DEFAULT_CATS;
      if(!d.budgets[year]) d.budgets[year]=emptyYearFromCats(cats);
      if(!d.budgets[year][mi]) d.budgets[year][mi]=emptyMonthFromCats(cats);
      if(!d.budgets[year][mi][sec]) d.budgets[year][mi][sec]={};
      if(!d.budgets[year][mi][sec][id]) d.budgets[year][mi][sec][id]={p:0,r:0};
      d.budgets[year][mi][sec][id][field]=v;
    });
  }

  const sav=iR-eR,savP=iP-eP;
  const hasAnn=!!(appData.annuals&&appData.annuals[year]);

  return <div className="su">
    {/* Sub-tab icons */}
    <div style={{display:"flex",gap:6,marginBottom:14}}>
      {[["presupuesto","💰"],["graficos","📊"],["ahorro","💹"]].map(([v,ico])=>(
        <button key={v} onClick={()=>setSubTab(v)} style={{width:36,height:36,borderRadius:8,background:subTab===v?ACC:"transparent",border:`1.5px solid ${subTab===v?ACC:BOR}`,fontSize:18,display:"flex",alignItems:"center",justifyContent:"center",color:subTab===v?"#fff":MUT}}>
          {ico}
        </button>
      ))}
    </div>

    {subTab==="graficos"&&<ChartsViewGasto bud={bud} cats={cats}/>}
    {subTab==="ahorro"&&<ChartsViewAhorro bud={bud} cats={cats}/>}
    {subTab==="presupuesto"&&<>
    {showWiz&&<AnnualWiz appData={appData} upd={upd} year={year} cats={cats} onClose={()=>setShowWiz(false)}/>}
    {showCatMgr&&<CatManager appData={appData} upd={upd} onClose={()=>setShowCatMgr(false)}/>}

    {/* Year row + icon buttons */}
    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10,gap:8}}>
      <select value={year} onChange={e=>setYear(+e.target.value)} style={{flex:1,padding:"7px 10px",fontSize:13,fontWeight:700,color:TXT,background:SRF,border:`1px solid ${BOR}`,borderRadius:8}}>
        {Array.from({length:16},(_,i)=>2025+i).map(y=><option key={y} value={y}>{y}</option>)}
      </select>
      <button onClick={()=>setShowWiz(true)} title={hasAnn?"Presupuesto anual activo":"Crear presupuesto anual"} style={{width:36,height:36,borderRadius:8,background:hasAnn?GRN+"33":ACC+"22",border:`1.5px solid ${hasAnn?GRN:ACC}66`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,flexShrink:0}}>
        {hasAnn?"✅":"🗓️"}
      </button>
      <button onClick={()=>setShowCatMgr(true)} title="Gestionar categorías y partidas" style={{width:36,height:36,borderRadius:8,background:SRF,border:`1.5px solid ${BOR}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,flexShrink:0}}>
        ⚙️
      </button>
    </div>

    <MScroll month={month} setMonth={setMonth} bud={bud} cats={cats}/>

    <div style={{display:"flex",background:CARD,borderRadius:10,padding:3,marginBottom:14,border:`1px solid ${BOR}`}}>
      {[["real","✏️ Datos reales"],["presupuesto","🎯 Presupuesto"]].map(([m,l])=>(
        <button key={m} onClick={()=>setMode(m)} style={{flex:1,padding:"9px 0",borderRadius:8,fontSize:12,background:mode===m?ACC:"transparent",color:mode===m?"#fff":MUT}}>{l}</button>
      ))}
    </div>

    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:14}}>
      <Kpi label="Ingresos pres." value={f(iP)} color={GRN}/>
      <Kpi label="Ingresos real" value={f(iR)} color={GRN}/>
      <Kpi label="Ahorro pres." value={f(savP)} color={gc(savP)}/>
      <Kpi label="Ahorro real" value={f(sav)} color={gc(sav)} sub={iR>0?(sav/iR*100).toFixed(1)+"% tasa":undefined}/>
    </div>

    {/* Income */}
    <Card style={{marginBottom:12}}>
      <div className="title" style={{fontSize:12,fontWeight:700,color:GRN,marginBottom:12}}>↑ INGRESOS</div>
      {INC.map(item=>{
        const p=md.inc[item.id]?.p||0,r=md.inc[item.id]?.r||0;
        return <div key={item.id} style={{marginBottom:14}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
            <span style={{fontSize:13,fontWeight:600}}>{item.label}</span>
            {(p>0||r>0)&&<span style={{background:gc(r-p)+"22",color:gc(r-p),borderRadius:20,padding:"2px 9px",fontSize:11,fontWeight:700}}>{r-p>=0?"+":""}{f(r-p)}</span>}
          </div>
          <div style={{display:"flex",gap:8}}>
            <div style={{flex:1}}>
              <div style={{fontSize:10,color:MUT,marginBottom:4}}>Presupuesto</div>
              {mode==="presupuesto"?<input type="number" value={p||""} onChange={e=>setV(month,"inc",item.id,"p",parseFloat(e.target.value)||0)} placeholder="0"/>:<div style={{padding:"11px 13px",background:SRF,borderRadius:8,fontSize:14,fontWeight:600,color:MUT,fontFamily:"monospace"}}>{f(p)}</div>}
            </div>
            <div style={{flex:1}}>
              <div style={{fontSize:10,color:MUT,marginBottom:4}}>Real</div>
              {mode==="real"?<input type="number" value={r||""} onChange={e=>setV(month,"inc",item.id,"r",parseFloat(e.target.value)||0)} placeholder="0"/>:<div style={{padding:"11px 13px",background:SRF,borderRadius:8,fontSize:14,fontWeight:700,fontFamily:"monospace"}}>{f(r)}</div>}
            </div>
          </div>
        </div>;
      })}
    </Card>

    {/* Expense categories */}
    {cats.map(cat=>{
      const cP=cat.items.reduce((s,i)=>s+(md.exp[i.id]?.p||0),0);
      const cR=cat.items.reduce((s,i)=>s+(md.exp[i.id]?.r||0),0);
      const dev=cR-cP,isOpen=open[cat.id];
      return <div key={cat.id} style={{background:CARD,border:`1px solid ${BOR}`,borderRadius:12,marginBottom:10,overflow:"hidden"}}>
        <div onClick={()=>setOpen(o=>({...o,[cat.id]:!o[cat.id]}))} style={{padding:"14px 16px",display:"flex",alignItems:"center",gap:12,cursor:"pointer",borderLeft:`3px solid ${cat.color}`}}>
          <span style={{fontSize:22}}>{cat.icon}</span>
          <div style={{flex:1}}>
            <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:5}}>
              <span className="title" style={{fontSize:14,fontWeight:700}}>{cat.label}</span>
              <span style={{background:gc(dev*-1)+"22",color:gc(dev*-1),borderRadius:20,padding:"2px 9px",fontSize:11,fontWeight:700}}>{dev>=0?"+":""}{f(dev)}</span>
            </div>
            <Pbar val={cR} max={cP||1} color={cR>cP?RED:cat.color}/>
            <div style={{display:"flex",justifyContent:"space-between",marginTop:4}}>
              <span style={{fontSize:10,color:MUT,fontFamily:"monospace"}}>Real: {f(cR)}</span>
              <span style={{fontSize:10,color:MUT,fontFamily:"monospace"}}>Pres: {f(cP)}</span>
            </div>
          </div>
          <span style={{color:MUT,fontSize:16,display:"inline-block",transform:isOpen?"rotate(90deg)":"none",transition:"transform .2s"}}>›</span>
        </div>
        {isOpen&&<div style={{padding:"4px 16px 16px",borderTop:`1px solid ${BOR}`}}>
          {cat.items.map(item=>{
            const p=md.exp[item.id]?.p||0,r=md.exp[item.id]?.r||0;
            return <div key={item.id} style={{paddingTop:12}}>
              <div style={{fontSize:12,color:MUT,marginBottom:6}}>{item.label}</div>
              <div style={{display:"flex",gap:8}}>
                <div style={{flex:1}}>
                  <div style={{fontSize:10,color:MUT,marginBottom:4}}>Presupuesto</div>
                  {mode==="presupuesto"?<input type="number" value={p||""} onChange={e=>setV(month,"exp",item.id,"p",parseFloat(e.target.value)||0)} placeholder="0"/>:<div style={{padding:"10px 13px",background:SRF,borderRadius:8,fontSize:14,color:MUT,fontFamily:"monospace"}}>{f(p)}</div>}
                </div>
                <div style={{flex:1}}>
                  <div style={{fontSize:10,color:MUT,marginBottom:4}}>Real</div>
                  {mode==="real"?<input type="number" value={r||""} onChange={e=>setV(month,"exp",item.id,"r",parseFloat(e.target.value)||0)} placeholder="0"/>:<div style={{padding:"10px 13px",background:SRF,borderRadius:8,fontSize:14,fontFamily:"monospace"}}>{f(r)}</div>}
                </div>
              </div>
            </div>;
          })}
        </div>}
      </div>;
    })}
    </>}
  </div>;
}

// ── CATEGORY MANAGER ──────────────────────────────────────────────────────────
function CatManager({appData,upd,onClose}){
  const cats=appData.cats||DEFAULT_CATS;
  const [selected,setSelected]=useState(null); // cat id being edited
  const [newCatLabel,setNewCatLabel]=useState("");
  const [newCatIcon,setNewCatIcon]=useState("🏷️");
  const [newItemLabel,setNewItemLabel]=useState("");
  const [showAddCat,setShowAddCat]=useState(false);

  function addCategory(){
    if(!newCatLabel.trim()) return;
    const newCat={id:nid(),icon:newCatIcon,label:newCatLabel.trim(),color:CAT_COLORS[cats.length%CAT_COLORS.length],items:[]};
    upd(d=>{
      if(!d.cats) d.cats=DEFAULT_CATS;
      d.cats.push(newCat);
    });
    setNewCatLabel(""); setNewCatIcon("🏷️"); setShowAddCat(false);
  }

  function deleteCategory(catId){
    upd(d=>{
      if(!d.cats) d.cats=DEFAULT_CATS;
      d.cats=d.cats.filter(c=>c.id!==catId);
    });
    if(selected===catId) setSelected(null);
  }

  function addItem(catId){
    if(!newItemLabel.trim()) return;
    const itemId=nid();
    upd(d=>{
      if(!d.cats) d.cats=DEFAULT_CATS;
      const cat=d.cats.find(c=>c.id===catId);
      if(cat) cat.items.push({id:itemId,label:newItemLabel.trim()});
    });
    setNewItemLabel("");
  }

  function deleteItem(catId,itemId){
    upd(d=>{
      if(!d.cats) d.cats=DEFAULT_CATS;
      const cat=d.cats.find(c=>c.id===catId);
      if(cat) cat.items=cat.items.filter(i=>i.id!==itemId);
    });
  }

  const selCat=cats.find(c=>c.id===selected);

  return <BottomSheet title="⚙️ Gestionar categorías" sub="Añade, edita o elimina categorías y partidas" onClose={onClose}>
    <div style={{padding:16}}>
      {!selected&&<>
        <div className="title" style={{fontSize:11,color:ACC,fontWeight:700,textTransform:"uppercase",letterSpacing:".06em",marginBottom:10}}>Categorías actuales</div>
        {cats.map(cat=>(
          <div key={cat.id} style={{display:"flex",alignItems:"center",gap:12,padding:"11px 14px",background:SRF,borderRadius:10,marginBottom:8,border:`1px solid ${BOR}`}}>
            <span style={{fontSize:20}}>{cat.icon}</span>
            <div style={{flex:1}}>
              <div className="title" style={{fontSize:13,fontWeight:700}}>{cat.label}</div>
              <div style={{fontSize:11,color:MUT}}>{cat.items.length} partidas</div>
            </div>
            <button onClick={()=>setSelected(cat.id)} style={{padding:"5px 12px",borderRadius:8,background:ACC+"22",color:ACC,fontSize:12}}>Editar</button>
            <button onClick={()=>deleteCategory(cat.id)} style={{padding:"5px 10px",borderRadius:8,background:RED+"22",color:RED,fontSize:12}}>✕</button>
          </div>
        ))}
        {!showAddCat&&<button onClick={()=>setShowAddCat(true)} style={{width:"100%",padding:"12px",borderRadius:10,background:`linear-gradient(135deg,${ACC},#922b21)`,color:"#fff",fontSize:13,marginTop:8}}>+ Nueva categoría</button>}
        {showAddCat&&<div style={{background:SRF,borderRadius:10,padding:14,marginTop:8,border:`1px solid ${BOR}`}}>
          <div className="title" style={{fontSize:13,fontWeight:700,marginBottom:12}}>Nueva categoría</div>
          <div style={{marginBottom:10}}>
            <div style={{fontSize:11,color:MUT,marginBottom:5}}>Icono</div>
            <div style={{display:"flex",flexWrap:"wrap",gap:6,marginBottom:8}}>
              {CAT_ICONS.map(ico=>(
                <button key={ico} onClick={()=>setNewCatIcon(ico)} style={{fontSize:20,padding:"6px 8px",borderRadius:8,background:newCatIcon===ico?ACC+"33":BOR,border:`1px solid ${newCatIcon===ico?ACC:BOR}`}}>{ico}</button>
              ))}
            </div>
            <div style={{fontSize:11,color:MUT,marginBottom:5}}>Nombre</div>
            <input value={newCatLabel} onChange={e=>setNewCatLabel(e.target.value)} placeholder="Ej: Mascotas"/>
          </div>
          <div style={{display:"flex",gap:8}}>
            <button onClick={()=>setShowAddCat(false)} style={{flex:1,padding:"10px",borderRadius:8,background:BOR,color:MUT,fontSize:13}}>Cancelar</button>
            <button onClick={addCategory} style={{flex:2,padding:"10px",borderRadius:8,background:ACC,color:"#fff",fontSize:13}}>Crear categoría</button>
          </div>
        </div>}
      </>}

      {selected&&selCat&&<>
        <button onClick={()=>setSelected(null)} style={{background:"transparent",color:ACC,fontSize:13,marginBottom:14,padding:0}}>← Volver</button>
        <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:16}}>
          <span style={{fontSize:28}}>{selCat.icon}</span>
          <div className="title" style={{fontSize:18,fontWeight:800}}>{selCat.label}</div>
        </div>
        <div className="title" style={{fontSize:11,color:ACC,fontWeight:700,textTransform:"uppercase",letterSpacing:".06em",marginBottom:10}}>Partidas de gasto</div>
        {selCat.items.map(item=>(
          <div key={item.id} style={{display:"flex",alignItems:"center",gap:10,padding:"10px 14px",background:SRF,borderRadius:8,marginBottom:6,border:`1px solid ${BOR}`}}>
            <span style={{flex:1,fontSize:13}}>{item.label}</span>
            <button onClick={()=>deleteItem(selCat.id,item.id)} style={{padding:"4px 10px",borderRadius:6,background:RED+"22",color:RED,fontSize:11}}>✕</button>
          </div>
        ))}
        {selCat.items.length===0&&<div style={{color:MUT,fontSize:13,textAlign:"center",padding:"16px 0"}}>Sin partidas todavía</div>}
        <div style={{marginTop:12}}>
          <div style={{fontSize:11,color:MUT,marginBottom:6}}>Nueva partida de gasto</div>
          <div style={{display:"flex",gap:8}}>
            <input value={newItemLabel} onChange={e=>setNewItemLabel(e.target.value)} placeholder="Ej: Netflix, Gasolinera..." style={{flex:1}} onKeyDown={e=>e.key==="Enter"&&addItem(selCat.id)}/>
            <button onClick={()=>addItem(selCat.id)} style={{padding:"10px 16px",borderRadius:8,background:ACC,color:"#fff",fontSize:13,whiteSpace:"nowrap"}}>+ Añadir</button>
          </div>
        </div>
      </>}
      <div style={{height:16}}/>
    </div>
  </BottomSheet>;
}

// ── ANNUAL WIZARD ─────────────────────────────────────────────────────────────
function AnnualWiz({appData,upd,year,cats,onClose}){
  function initForm(){
    if(appData.annuals&&appData.annuals[year]) return JSON.parse(JSON.stringify(appData.annuals[year]));
    const prev=appData.annuals&&appData.annuals[year-1];
    if(prev){const r=1+((prev.growth||2)/100),inc={},exp={};INC.forEach(i=>{inc[i.id]=Math.round((prev.inc[i.id]||0)*r);});cats.forEach(c=>c.items.forEach(it=>{exp[it.id]=Math.round((prev.exp[it.id]||0)*r);}));return{inc,exp,growth:prev.growth||2};}
    const inc={},exp={};INC.forEach(i=>{inc[i.id]=0;});cats.forEach(c=>c.items.forEach(it=>{exp[it.id]=0;}));return{inc,exp,growth:2};
  }
  const [form,setForm]=useState(initForm);
  const [scope,setScope]=useState("year");
  const [fut,setFut]=useState(3);
  const [step,setStep]=useState(0);
  const totI=INC.reduce((s,i)=>s+(form.inc[i.id]||0),0);
  const totE=cats.flatMap(c=>c.items).reduce((s,i)=>s+(form.exp[i.id]||0),0);

  function apply(){
    upd(d=>{
      if(!d.annuals) d.annuals={};
      if(!d.budgets) d.budgets={};
      d.annuals[year]={...form};
      function dist(tpl){const y={};for(let i=0;i<12;i++){const inc={},exp={};INC.forEach(it=>{inc[it.id]={p:Math.round((tpl.inc[it.id]||0)/12),r:0};});cats.forEach(c=>c.items.forEach(it=>{exp[it.id]={p:Math.round((tpl.exp[it.id]||0)/12),r:0};}));y[i]={inc,exp};}return y;}
      function merge(ex,fr){const y={};for(let i=0;i<12;i++){const e=ex&&ex[i]?ex[i]:emptyMonthFromCats(cats),fi=fr[i],inc={},exp={};INC.forEach(it=>{inc[it.id]={p:fi.inc[it.id].p,r:e.inc[it.id]?.r||0};});cats.forEach(c=>c.items.forEach(it=>{exp[it.id]={p:fi.exp[it.id].p,r:e.exp[it.id]?.r||0};}));y[i]={inc,exp};}return y;}
      d.budgets[year]=merge(d.budgets[year],dist(form));
      if(scope==="multi"){let tpl={...form};for(let y=year+1;y<=year+fut;y++){const r=1+(form.growth/100),ni={},ne={};INC.forEach(i=>{ni[i.id]=Math.round((tpl.inc[i.id]||0)*r);});cats.forEach(c=>c.items.forEach(it=>{ne[it.id]=Math.round((tpl.exp[it.id]||0)*r);}));tpl={inc:ni,exp:ne,growth:form.growth};d.annuals[y]={...tpl};d.budgets[y]=merge(d.budgets[y],dist(tpl));}}
    });
    onClose();
  }
  function projRow(i){let tpl=form;for(let j=0;j<i;j++){const r=1+(form.growth/100),ni={},ne={};INC.forEach(it=>{ni[it.id]=Math.round((tpl.inc[it.id]||0)*r);});cats.forEach(c=>c.items.forEach(it=>{ne[it.id]=Math.round((tpl.exp[it.id]||0)*r);}));tpl={inc:ni,exp:ne,growth:form.growth};}
  const inc=INC.reduce((s,it)=>s+(tpl.inc[it.id]||0),0);const exp=cats.flatMap(c=>c.items).reduce((s,it)=>s+(tpl.exp[it.id]||0),0);return{inc,exp,sav:inc-exp};}

  return <BottomSheet title={`🗓️ Presupuesto anual ${year}`} sub="Importes anuales → distribución mensual automática" onClose={onClose}>
    <div style={{display:"flex",borderBottom:`1px solid ${BOR}`}}>
      {["Ingresos","Gastos","Proyección"].map((s,i)=>(
        <button key={i} onClick={()=>setStep(i)} style={{flex:1,padding:"10px 0",fontSize:12,fontWeight:700,background:"transparent",color:step===i?ACC:MUT,borderBottom:`2px solid ${step===i?ACC:"transparent"}`,marginBottom:-1}}>{i<step?"✓ ":""}{s}</button>
      ))}
    </div>
    <div style={{display:"flex",gap:8,padding:"10px 16px",borderBottom:`1px solid ${BOR}`,overflowX:"auto"}}>
      {[["Ingresos",f(totI),GRN],["Gastos",f(totE),RED],["Ahorro",f(totI-totE),gc(totI-totE)],["/mes",f(Math.round((totI-totE)/12)),gc(totI-totE)]].map(([l,v,c])=>(
        <div key={l} style={{flexShrink:0,background:SRF,borderRadius:8,padding:"8px 12px",minWidth:90}}>
          <div className="title" style={{fontSize:9,color:MUT,fontWeight:700}}>{l}</div>
          <div style={{fontSize:14,fontWeight:800,color:c,fontFamily:"monospace"}}>{v}</div>
        </div>
      ))}
    </div>
    <div style={{padding:"16px 16px 0"}}>
      {step===0&&INC.map(item=>(
        <div key={item.id} style={{marginBottom:14}}>
          <div style={{display:"flex",justifyContent:"space-between",marginBottom:5}}>
            <span style={{fontSize:13,fontWeight:600}}>{item.label}</span>
            <span style={{fontSize:11,color:MUT,fontFamily:"monospace"}}>→ {f(Math.round((form.inc[item.id]||0)/12))}/mes</span>
          </div>
          <input type="number" value={form.inc[item.id]||""} onChange={e=>setForm(fm=>({...fm,inc:{...fm.inc,[item.id]:parseFloat(e.target.value)||0}}))} placeholder="Total anual (€)"/>
        </div>
      ))}
      {step===1&&cats.map(cat=>{
        const ct=cat.items.reduce((s,i)=>s+(form.exp[i.id]||0),0);
        return <div key={cat.id} style={{marginBottom:18}}>
          <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10,paddingLeft:10,borderLeft:`3px solid ${cat.color}`}}>
            <span style={{fontSize:18}}>{cat.icon}</span>
            <span className="title" style={{fontWeight:700,fontSize:13,flex:1}}>{cat.label}</span>
            <span style={{fontSize:11,color:cat.color,fontFamily:"monospace"}}>{f(ct)}</span>
          </div>
          {cat.items.map(item=>(
            <div key={item.id} style={{marginBottom:10,paddingLeft:8}}>
              <div style={{display:"flex",justifyContent:"space-between",marginBottom:5}}>
                <span style={{fontSize:12,color:MUT}}>{item.label}</span>
                <span style={{fontSize:10,color:MUT,fontFamily:"monospace"}}>→ {f(Math.round((form.exp[item.id]||0)/12))}/mes</span>
              </div>
              <input type="number" value={form.exp[item.id]||""} onChange={e=>setForm(fm=>({...fm,exp:{...fm.exp,[item.id]:parseFloat(e.target.value)||0}}))} placeholder="0"/>
            </div>
          ))}
        </div>;
      })}
      {step===2&&<div>
        <div style={{marginBottom:16}}>
          <div className="title" style={{fontSize:13,fontWeight:700,marginBottom:5}}>Incremento anual (%)</div>
          <input type="number" value={form.growth} onChange={e=>setForm(fm=>({...fm,growth:parseFloat(e.target.value)||0}))} step="0.1"/>
          <div style={{fontSize:11,color:MUT,marginTop:6}}>Ej: 2% ≈ inflación.</div>
        </div>
        <div style={{marginBottom:16}}>
          <div className="title" style={{fontSize:13,fontWeight:700,marginBottom:10}}>Aplicar a</div>
          {[["year",`Solo ${year}`],["multi","Este año y siguientes"]].map(([v,l])=>(
            <button key={v} onClick={()=>setScope(v)} style={{width:"100%",padding:"13px 16px",borderRadius:10,marginBottom:8,display:"flex",alignItems:"center",gap:12,background:scope===v?ACC+"20":SRF,border:`1.5px solid ${scope===v?ACC:BOR}`,textAlign:"left"}}>
              <div style={{width:18,height:18,borderRadius:"50%",border:`2px solid ${scope===v?ACC:BOR}`,background:scope===v?ACC:"transparent",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>{scope===v&&<div style={{width:8,height:8,borderRadius:"50%",background:"#fff"}}/>}</div>
              <span className="title" style={{fontSize:13,fontWeight:700,color:scope===v?ACC:TXT}}>{l}</span>
            </button>
          ))}
        </div>
        {scope==="multi"&&<div>
          <div className="title" style={{fontSize:13,fontWeight:700,marginBottom:10}}>Años a proyectar</div>
          <div style={{display:"flex",gap:8,marginBottom:14}}>{[1,2,3,5].map(n=><button key={n} onClick={()=>setFut(n)} style={{flex:1,padding:"10px 0",borderRadius:8,fontSize:13,background:fut===n?ACC:SRF,color:fut===n?"#fff":MUT,border:`1px solid ${fut===n?ACC:BOR}`}}>+{n}</button>)}</div>
          {Array.from({length:fut+1},(_,i)=>{const{inc,exp,sav}=projRow(i);return(
            <div key={i} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"10px 14px",background:i===0?ACC+"18":SRF,borderRadius:8,marginBottom:6}}>
              <span className="title" style={{fontSize:13,fontWeight:i===0?800:600,color:i===0?ACC:TXT}}>{year+i}{i===0?" ★":""}</span>
              <div style={{display:"flex",gap:12}}>
                <div style={{textAlign:"right"}}><div style={{fontSize:9,color:MUT}}>Ingr.</div><div style={{fontSize:12,color:GRN,fontFamily:"monospace"}}>{f(inc)}</div></div>
                <div style={{textAlign:"right"}}><div style={{fontSize:9,color:MUT}}>Gasto</div><div style={{fontSize:12,color:RED,fontFamily:"monospace"}}>{f(exp)}</div></div>
                <div style={{textAlign:"right"}}><div style={{fontSize:9,color:MUT}}>Ahorro</div><div style={{fontSize:12,color:gc(sav),fontFamily:"monospace"}}>{f(sav)}</div></div>
              </div>
            </div>
          );})}
        </div>}
        <div style={{height:16}}/>
      </div>}
    </div>
    <div style={{padding:"12px 16px",borderTop:`1px solid ${BOR}`,display:"flex",gap:8,background:BG}}>
      {step>0?<button onClick={()=>setStep(s=>s-1)} style={{flex:1,padding:"12px 0",borderRadius:10,background:SRF,color:TXT,fontSize:14}}>← Atrás</button>
             :<button onClick={onClose} style={{flex:1,padding:"12px 0",borderRadius:10,background:SRF,color:MUT,fontSize:14}}>Cancelar</button>}
      {step<2?<button onClick={()=>setStep(s=>s+1)} style={{flex:2,padding:"12px 0",borderRadius:10,background:ACC,color:"#fff",fontSize:14}}>Siguiente →</button>
             :<button onClick={apply} style={{flex:2,padding:"12px 0",borderRadius:10,background:GRN,color:"#fff",fontSize:14}}>✓ Aplicar</button>}
    </div>
  </BottomSheet>;
}

// ── CHART SUB-VIEWS (used inside BudgetTab) ─────────────────────────────────
function ChartsViewGasto({bud,cats}){
  const monthly=MONTHS.map((label,i)=>{
    const m=bud[i]||emptyMonthFromCats(cats);
    const iP=INC.reduce((s,it)=>s+(m.inc[it.id]?.p||0),0),iR=INC.reduce((s,it)=>s+(m.inc[it.id]?.r||0),0);
    const eP=cats.flatMap(c=>c.items).reduce((s,it)=>s+(m.exp[it.id]?.p||0),0),eR=cats.flatMap(c=>c.items).reduce((s,it)=>s+(m.exp[it.id]?.r||0),0);
    return{label,iP,iR,eP,eR};
  });
  const catData=cats.map(cat=>({name:cat.icon+" "+cat.label.slice(0,7),p:cat.items.reduce((s,it)=>s+MONTHS.reduce((ss,_,i)=>ss+(bud[i]?.exp[it.id]?.p||0),0),0),r:cat.items.reduce((s,it)=>s+MONTHS.reduce((ss,_,i)=>ss+(bud[i]?.exp[it.id]?.r||0),0),0),color:cat.color})).filter(c=>c.p>0||c.r>0);
  const M={left:-10,right:4,top:4,bottom:0},TS={fill:MUT,fontSize:10};
  return <>
    <Card style={{marginBottom:14}}>
      <div className="title" style={{fontSize:11,fontWeight:700,color:ACC,marginBottom:12}}>INGRESOS VS GASTOS MENSUALES</div>
      <ResponsiveContainer width="100%" height={190}><BarChart data={monthly} barCategoryGap="25%" margin={M}><XAxis dataKey="label" tick={TS} axisLine={false} tickLine={false}/><YAxis tick={{fill:MUT,fontSize:9}} axisLine={false} tickLine={false} tickFormatter={fk}/><Tooltip content={<TipComp/>}/><Bar dataKey="iR" name="Ingresos" fill={GRN} radius={[3,3,0,0]}/><Bar dataKey="eR" name="Gastos" fill={RED} radius={[3,3,0,0]}/></BarChart></ResponsiveContainer>
    </Card>
    <Card style={{marginBottom:14}}>
      <div className="title" style={{fontSize:11,fontWeight:700,color:ACC,marginBottom:12}}>GASTOS POR CATEGORÍA (ANUAL)</div>
      {catData.length===0?<div style={{textAlign:"center",color:MUT,padding:24}}>Sin datos</div>:<>
        <ResponsiveContainer width="100%" height={190}><PieChart><Pie data={catData} dataKey="r" nameKey="name" cx="50%" cy="50%" outerRadius={74} innerRadius={44} paddingAngle={2}>{catData.map((c,i)=><Cell key={i} fill={c.color}/>)}</Pie><Tooltip formatter={v=>f(v)} contentStyle={{background:CARD,border:`1px solid ${BOR}`,borderRadius:8}}/></PieChart></ResponsiveContainer>
        <div style={{display:"flex",flexWrap:"wrap",gap:8,justifyContent:"center",marginTop:6}}>{catData.map(c=><div key={c.name} style={{display:"flex",alignItems:"center",gap:4}}><div style={{width:8,height:8,borderRadius:"50%",background:c.color}}/><span style={{fontSize:10,color:MUT}}>{c.name}</span></div>)}</div>
      </>}
    </Card>
    <Card>
      <div className="title" style={{fontSize:11,fontWeight:700,color:ACC,marginBottom:12}}>PRESUPUESTO VS REAL</div>
      {catData.map(c=>(
        <div key={c.name} style={{marginBottom:10}}>
          <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}><span style={{fontSize:12}}>{c.name}</span><span style={{fontSize:11,fontFamily:"monospace",color:c.r>c.p?RED:GRN}}>{f(c.r)}/{f(c.p)}</span></div>
          <Pbar val={c.r} max={Math.max(c.p,c.r,1)} color={c.r>c.p?RED:c.color} h={8}/>
        </div>
      ))}
    </Card>
  </>;
}

function ChartsViewAhorro({bud,cats}){
  const monthly=MONTHS.map((label,i)=>{
    const m=bud[i]||emptyMonthFromCats(cats);
    const iP=INC.reduce((s,it)=>s+(m.inc[it.id]?.p||0),0),iR=INC.reduce((s,it)=>s+(m.inc[it.id]?.r||0),0);
    const eP=cats.flatMap(c=>c.items).reduce((s,it)=>s+(m.exp[it.id]?.p||0),0),eR=cats.flatMap(c=>c.items).reduce((s,it)=>s+(m.exp[it.id]?.r||0),0);
    return{label,sP:iP-eP,sR:iR-eR};
  });
  const cumSav=monthly.reduce((acc,m,i)=>{const prev=i>0?acc[i-1].cum:0;return[...acc,{label:m.label,mes:m.sR,cum:prev+m.sR}];},[]);
  const M={left:-10,right:4,top:4,bottom:0},TS={fill:MUT,fontSize:10};
  return <>
    <Card style={{marginBottom:14}}>
      <div className="title" style={{fontSize:11,fontWeight:700,color:ACC,marginBottom:12}}>AHORRO MENSUAL</div>
      <ResponsiveContainer width="100%" height={190}><BarChart data={monthly} barCategoryGap="25%" margin={M}><XAxis dataKey="label" tick={TS} axisLine={false} tickLine={false}/><YAxis tick={{fill:MUT,fontSize:9}} axisLine={false} tickLine={false} tickFormatter={fk}/><Tooltip content={<TipComp/>}/><ReferenceLine y={0} stroke={BOR}/><Bar dataKey="sP" name="Obj." fill={ACC} opacity={0.4} radius={[3,3,0,0]}/><Bar dataKey="sR" name="Real" radius={[3,3,0,0]}>{monthly.map((m,i)=><Cell key={i} fill={m.sR>=0?GRN:RED}/>)}</Bar></BarChart></ResponsiveContainer>
    </Card>
    <Card>
      <div className="title" style={{fontSize:11,fontWeight:700,color:ACC,marginBottom:12}}>AHORRO ACUMULADO</div>
      <ResponsiveContainer width="100%" height={190}><LineChart data={cumSav} margin={M}><XAxis dataKey="label" tick={TS} axisLine={false} tickLine={false}/><YAxis tick={{fill:MUT,fontSize:9}} axisLine={false} tickLine={false} tickFormatter={fk}/><Tooltip content={<TipComp/>}/><ReferenceLine y={0} stroke={BOR} strokeDasharray="4 4"/><Line type="monotone" dataKey="cum" name="Acumulado" stroke={ACC} strokeWidth={2.5} dot={{r:3,fill:ACC}}/><Line type="monotone" dataKey="mes" name="Mensual" stroke={GRN} strokeWidth={1.5} strokeDasharray="4 3" dot={false}/></LineChart></ResponsiveContainer>
    </Card>
  </>;
}

// ── CHARTS ────────────────────────────────────────────────────────────────────
function ChartsTab({bud,cats}){
  const [view,setView]=useState("monthly");
  const monthly=MONTHS.map((label,i)=>{
    const m=bud[i]||emptyMonthFromCats(cats);
    const iP=INC.reduce((s,it)=>s+(m.inc[it.id]?.p||0),0),iR=INC.reduce((s,it)=>s+(m.inc[it.id]?.r||0),0);
    const eP=cats.flatMap(c=>c.items).reduce((s,it)=>s+(m.exp[it.id]?.p||0),0),eR=cats.flatMap(c=>c.items).reduce((s,it)=>s+(m.exp[it.id]?.r||0),0);
    return{label,iP,iR,eP,eR,sP:iP-eP,sR:iR-eR};
  });
  const catData=cats.map(cat=>({name:cat.icon+" "+cat.label.slice(0,8),p:cat.items.reduce((s,it)=>s+MONTHS.reduce((ss,_,i)=>ss+(bud[i]?.exp[it.id]?.p||0),0),0),r:cat.items.reduce((s,it)=>s+MONTHS.reduce((ss,_,i)=>ss+(bud[i]?.exp[it.id]?.r||0),0),0),color:cat.color})).filter(c=>c.p>0||c.r>0);
  const cumSav=monthly.reduce((acc,m,i)=>{const prev=i>0?acc[i-1].cum:0;return[...acc,{label:m.label,mes:m.sR,cum:prev+m.sR}];},[]);
  const M={left:-16,right:4,top:4,bottom:0},TS={fill:MUT,fontSize:10};
  return <div className="su">
    <div style={{display:"flex",background:CARD,borderRadius:10,padding:3,marginBottom:16,border:`1px solid ${BOR}`}}>
      {[["monthly","Mensual"],["categories","Categorías"],["savings","Ahorro"]].map(([v,l])=>(
        <button key={v} onClick={()=>setView(v)} style={{flex:1,padding:"9px 0",borderRadius:8,fontSize:11,fontWeight:700,background:view===v?ACC:"transparent",color:view===v?"#fff":MUT}}>{l}</button>
      ))}
    </div>
    {view==="monthly"&&<>
      <Card style={{marginBottom:14}}>
        <div className="title" style={{fontSize:11,fontWeight:700,color:ACC,marginBottom:14}}>INGRESOS VS GASTOS</div>
        <ResponsiveContainer width="100%" height={200}><BarChart data={monthly} barCategoryGap="25%" margin={M}><XAxis dataKey="label" tick={TS} axisLine={false} tickLine={false}/><YAxis tick={{fill:MUT,fontSize:9}} axisLine={false} tickLine={false} tickFormatter={fk}/><Tooltip content={<TipComp/>}/><Bar dataKey="iR" name="Ingresos" fill={GRN} radius={[4,4,0,0]}/><Bar dataKey="eR" name="Gastos" fill={RED} radius={[4,4,0,0]}/></BarChart></ResponsiveContainer>
      </Card>
      <Card>
        <div className="title" style={{fontSize:11,fontWeight:700,color:ACC,marginBottom:14}}>REAL VS PRESUPUESTO</div>
        <ResponsiveContainer width="100%" height={200}><LineChart data={monthly} margin={M}><XAxis dataKey="label" tick={TS} axisLine={false} tickLine={false}/><YAxis tick={{fill:MUT,fontSize:9}} axisLine={false} tickLine={false} tickFormatter={fk}/><Tooltip content={<TipComp/>}/><Line type="monotone" dataKey="iP" name="Ingr.Pres" stroke={GRN} strokeDasharray="5 4" dot={false} strokeWidth={1.5}/><Line type="monotone" dataKey="iR" name="Ingr.Real" stroke={GRN} strokeWidth={2} dot={{r:3}}/><Line type="monotone" dataKey="eP" name="Gasto.Pres" stroke={RED} strokeDasharray="5 4" dot={false} strokeWidth={1.5}/><Line type="monotone" dataKey="eR" name="Gasto.Real" stroke={RED} strokeWidth={2} dot={{r:3}}/></LineChart></ResponsiveContainer>
      </Card>
    </>}
    {view==="categories"&&<>
      <Card style={{marginBottom:14}}>
        <div className="title" style={{fontSize:11,fontWeight:700,color:ACC,marginBottom:14}}>DISTRIBUCIÓN GASTOS ANUALES</div>
        {catData.length===0?<div style={{textAlign:"center",color:MUT,padding:30}}>Sin datos todavía</div>:<>
          <ResponsiveContainer width="100%" height={200}><PieChart><Pie data={catData} dataKey="r" nameKey="name" cx="50%" cy="50%" outerRadius={78} innerRadius={46} paddingAngle={2}>{catData.map((c,i)=><Cell key={i} fill={c.color}/>)}</Pie><Tooltip formatter={v=>f(v)} contentStyle={{background:CARD,border:`1px solid ${BOR}`,borderRadius:8}}/></PieChart></ResponsiveContainer>
          <div style={{display:"flex",flexWrap:"wrap",gap:8,justifyContent:"center",marginTop:8}}>{catData.map(c=><div key={c.name} style={{display:"flex",alignItems:"center",gap:4}}><div style={{width:8,height:8,borderRadius:"50%",background:c.color}}/><span style={{fontSize:10,color:MUT}}>{c.name}</span></div>)}</div>
        </>}
      </Card>
      <Card>
        <div className="title" style={{fontSize:11,fontWeight:700,color:ACC,marginBottom:12}}>PRESUPUESTO VS REAL</div>
        {catData.length===0?<div style={{textAlign:"center",color:MUT,padding:20}}>Sin datos</div>:catData.map(c=>(
          <div key={c.name} style={{marginBottom:12}}>
            <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}><span style={{fontSize:12}}>{c.name}</span><span style={{fontSize:11,fontFamily:"monospace",color:c.r>c.p?RED:GRN}}>{f(c.r)}/{f(c.p)}</span></div>
            <Pbar val={c.r} max={Math.max(c.p,c.r,1)} color={c.r>c.p?RED:c.color} h={8}/>
          </div>
        ))}
      </Card>
    </>}
    {view==="savings"&&<>
      <Card style={{marginBottom:14}}>
        <div className="title" style={{fontSize:11,fontWeight:700,color:ACC,marginBottom:14}}>AHORRO MENSUAL</div>
        <ResponsiveContainer width="100%" height={200}><BarChart data={monthly} barCategoryGap="25%" margin={M}><XAxis dataKey="label" tick={TS} axisLine={false} tickLine={false}/><YAxis tick={{fill:MUT,fontSize:9}} axisLine={false} tickLine={false} tickFormatter={fk}/><Tooltip content={<TipComp/>}/><ReferenceLine y={0} stroke={BOR}/><Bar dataKey="sP" name="Ahorro Pres." fill={ACC} opacity={0.4} radius={[3,3,0,0]}/><Bar dataKey="sR" name="Ahorro Real" radius={[3,3,0,0]}>{monthly.map((m,i)=><Cell key={i} fill={m.sR>=0?GRN:RED}/>)}</Bar></BarChart></ResponsiveContainer>
      </Card>
      <Card>
        <div className="title" style={{fontSize:11,fontWeight:700,color:ACC,marginBottom:14}}>AHORRO ACUMULADO</div>
        <ResponsiveContainer width="100%" height={200}><LineChart data={cumSav} margin={M}><XAxis dataKey="label" tick={TS} axisLine={false} tickLine={false}/><YAxis tick={{fill:MUT,fontSize:9}} axisLine={false} tickLine={false} tickFormatter={fk}/><Tooltip content={<TipComp/>}/><ReferenceLine y={0} stroke={BOR} strokeDasharray="4 4"/><Line type="monotone" dataKey="cum" name="Acumulado" stroke={ACC} strokeWidth={2.5} dot={{r:3,fill:ACC}}/><Line type="monotone" dataKey="mes" name="Mensual" stroke={GRN} strokeWidth={1.5} strokeDasharray="4 3" dot={false}/></LineChart></ResponsiveContainer>
      </Card>
    </>}
  </div>;
}

// ── ASSETS ────────────────────────────────────────────────────────────────────
function AssetsTab({appData,upd}){
  const [sec,setSec]=useState("active");
  const [addType,setAddType]=useState(null);
  const [sellA,setSellA]=useState(null);
  const [valA,setValA]=useState(null);
  const [sellF,setSellF]=useState({qty:"",price:"",date:now()});
  const [valF,setValF]=useState({date:now(),value:""});
  const [aF,setAF]=useState({name:"",type:ATYPES[0],isin:"",qty:"1",buyPrice:"",buyDate:now(),cv:""});
  const [lF,setLF]=useState({name:"",type:LTYPES[0],amount:"",rate:"",startDate:now(),endDate:""});
  const active=(appData.assets||[]).filter(a=>a.status==="active");
  const sold=(appData.assets||[]).filter(a=>a.status==="sold");
  function addAsset(){if(!aF.name||!aF.buyPrice)return;const bp=parseFloat(aF.buyPrice),cv=parseFloat(aF.cv)||bp;upd(d=>{if(!d.assets)d.assets=[];d.assets.push({name:aF.name,type:aF.type,isin:aF.isin,qty:parseFloat(aF.qty)||1,buyPrice:bp,cv,buyDate:aF.buyDate,id:nid(),status:"active"});});setAF({name:"",type:ATYPES[0],isin:"",qty:"1",buyPrice:"",buyDate:now(),cv:""});setAddType(null);}
  function addLiab(){if(!lF.name||!lF.amount)return;upd(d=>{if(!d.liabilities)d.liabilities=[];d.liabilities.push({...lF,id:nid(),amount:parseFloat(lF.amount),rate:parseFloat(lF.rate)||0});});setLF({name:"",type:LTYPES[0],amount:"",rate:"",startDate:now(),endDate:""});setAddType(null);}
  function doSell(){const a=sellA,qty=parseFloat(sellF.qty)||a.qty,price=parseFloat(sellF.price)||a.cv;const cost=a.buyPrice*qty,proceeds=price*qty,gain=proceeds-cost,gp=cost>0?gain/cost:0;const days=a.buyDate?Math.max(1,Math.round((new Date(sellF.date)-new Date(a.buyDate))/86400000)):365;const ann=Math.pow(1+gp,365/days)-1;upd(d=>{const idx=d.assets.findIndex(x=>x.id===a.id);if(idx<0)return;const entry={...d.assets[idx],id:nid(),qty,status:"sold",sellDate:sellF.date,sellPrice:price,cost,proceeds,gain,gp,ann,days};if(qty>=d.assets[idx].qty)Object.assign(d.assets[idx],entry,{id:d.assets[idx].id});else{d.assets[idx].qty-=qty;d.assets.push(entry);}});setSellA(null);}
  function doVal(){if(!valF.value)return;const v=parseFloat(valF.value);upd(d=>{if(!d.valHistory)d.valHistory={};const id=valA.id;if(!d.valHistory[id])d.valHistory[id]=[];d.valHistory[id].push({date:valF.date,value:v});d.valHistory[id].sort((a,b)=>a.date.localeCompare(b.date));const a=d.assets.find(x=>x.id===id);if(a)a.cv=v;});setValA(null);}
  function ret(a){const c=a.buyPrice*a.qty,v=a.cv*a.qty;return{abs:v-c,pct:c>0?(v-c)/c:0};}
  const sT=sold.reduce((acc,a)=>({cost:acc.cost+(a.cost||0),proceeds:acc.proceeds+(a.proceeds||0),gain:acc.gain+(a.gain||0)}),{cost:0,proceeds:0,gain:0});

  return <div className="su">
    <div style={{display:"flex",background:CARD,borderRadius:10,padding:3,marginBottom:14,border:`1px solid ${BOR}`}}>
      {[["active","📈 Cartera"],["sold","✅ Vendidos"],["liabilities","🏦 Pasivos"]].map(([v,l])=>(
        <button key={v} onClick={()=>setSec(v)} style={{flex:1,padding:"9px 4px",borderRadius:8,fontSize:11,fontWeight:700,background:sec===v?ACC:"transparent",color:sec===v?"#fff":MUT}}>{l}</button>
      ))}
    </div>
    {sec==="active"&&<>
      <button onClick={()=>setAddType("asset")} style={{width:"100%",padding:"12px",borderRadius:10,background:`linear-gradient(135deg,${ACC},#922b21)`,color:"#fff",fontSize:14,marginBottom:14}}>+ Añadir activo</button>
      {!active.length&&<div style={{textAlign:"center",color:MUT,padding:40}}>Sin activos en cartera</div>}
      {active.map(a=>{const r=ret(a);return(
        <Card key={a.id} style={{marginBottom:10}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:10}}>
            <div><div className="title" style={{fontSize:15,fontWeight:800}}>{a.name}</div><div style={{display:"flex",gap:6,marginTop:4,flexWrap:"wrap"}}><span style={{background:ACC+"22",color:ACC,borderRadius:20,padding:"2px 9px",fontSize:11,fontWeight:700}}>{a.type}</span>{a.isin&&<span style={{background:MUT+"22",color:MUT,borderRadius:20,padding:"2px 9px",fontSize:11,fontWeight:700}}>{a.isin}</span>}</div></div>
            <div style={{textAlign:"right"}}><div style={{fontSize:20,fontWeight:800,color:gc(r.pct),fontFamily:"monospace"}}>{(r.pct*100).toFixed(1)}%</div><div style={{fontSize:12,color:gc(r.abs),fontFamily:"monospace"}}>{r.abs>=0?"+":""}{f(r.abs)}</div></div>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginBottom:12}}>
            {[["TÍTULOS",a.qty],["COMPRA",f(a.buyPrice)],["ACTUAL",f(a.cv)]].map(([l,v])=>(
              <div key={l} style={{background:SRF,borderRadius:8,padding:"9px 10px"}}><div className="title" style={{fontSize:9,color:MUT,fontWeight:700}}>{l}</div><div style={{fontSize:13,fontWeight:700,fontFamily:"monospace"}}>{v}</div></div>
            ))}
          </div>
          <div style={{display:"flex",gap:8}}>
            <button onClick={()=>{setValA(a);setValF({date:now(),value:""}); }} style={{flex:1,padding:"8px 0",borderRadius:8,background:GRN+"22",color:GRN,fontSize:12}}>📊 Valorar</button>
            <button onClick={()=>{setSellA(a);setSellF({qty:"",price:a.cv,date:now()});}} style={{flex:1,padding:"8px 0",borderRadius:8,background:YLW+"22",color:YLW,fontSize:12}}>💸 Vender</button>
            <button onClick={()=>upd(d=>{d.assets=d.assets.filter(x=>x.id!==a.id);})} style={{flex:1,padding:"8px 0",borderRadius:8,background:RED+"22",color:RED,fontSize:12}}>✕</button>
          </div>
        </Card>
      );})}
    </>}
    {sec==="sold"&&<>
      {sold.length>0&&<div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:14}}>
        <Kpi label="Invertido" value={f(sT.cost)} color={MUT}/><Kpi label="Recibido" value={f(sT.proceeds)}/><Kpi label="Resultado" value={(sT.gain>=0?"+":"")+f(sT.gain)} color={gc(sT.gain)}/><Kpi label="Rentab." value={sT.cost>0?(sT.gain/sT.cost*100).toFixed(1)+"%":"—"} color={gc(sT.gain)}/>
      </div>}
      {!sold.length&&<div style={{textAlign:"center",color:MUT,padding:40}}>Sin ventas registradas</div>}
      {sold.map(a=>(
        <Card key={a.id} style={{marginBottom:10}}>
          <div style={{display:"flex",justifyContent:"space-between",marginBottom:8}}>
            <div><div className="title" style={{fontSize:14,fontWeight:800}}>{a.name}</div><span style={{background:ACC+"22",color:ACC,borderRadius:20,padding:"2px 9px",fontSize:11,fontWeight:700}}>{a.type}</span></div>
            <div style={{textAlign:"right"}}><div style={{fontSize:18,fontWeight:800,color:gc(a.gp||0),fontFamily:"monospace"}}>{((a.gp||0)*100).toFixed(1)}%</div><div style={{fontSize:11,color:MUT}}>{((a.ann||0)*100).toFixed(1)}%/año</div></div>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:6}}>
            {[["Coste",f(a.cost||0),MUT],["Ingreso",f(a.proceeds||0),TXT],["Result.",(a.gain>=0?"+":"")+f(a.gain||0),gc(a.gain||0)],["Compra",a.buyDate?.slice(5)||"—",MUT],["Venta",a.sellDate?.slice(5)||"—",MUT],["Días",(a.days||"?")+"d",MUT]].map(([l,v,c])=>(
              <div key={l} style={{background:SRF,borderRadius:8,padding:"7px 9px"}}><div className="title" style={{fontSize:9,color:MUT,fontWeight:700}}>{l}</div><div style={{fontSize:11,fontWeight:700,color:c,fontFamily:"monospace"}}>{v}</div></div>
            ))}
          </div>
        </Card>
      ))}
    </>}
    {sec==="liabilities"&&<>
      <button onClick={()=>setAddType("liab")} style={{width:"100%",padding:"12px",borderRadius:10,background:RED,color:"#fff",fontSize:14,marginBottom:14}}>+ Añadir pasivo</button>
      {!(appData.liabilities||[]).length&&<div style={{textAlign:"center",color:MUT,padding:40}}>Sin pasivos registrados</div>}
      {(appData.liabilities||[]).map(l=>(
        <Card key={l.id} style={{marginBottom:10}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
            <div><div className="title" style={{fontSize:14,fontWeight:800}}>{l.name}</div><span style={{background:RED+"22",color:RED,borderRadius:20,padding:"2px 9px",fontSize:11,fontWeight:700}}>{l.type}</span></div>
            <div style={{textAlign:"right"}}><div style={{fontSize:18,fontWeight:800,color:RED,fontFamily:"monospace"}}>{f(l.amount)}</div><div style={{fontSize:11,color:MUT}}>{l.rate}% interés</div></div>
          </div>
          {l.endDate&&<div style={{fontSize:11,color:MUT,marginTop:6}}>Vencimiento: {l.endDate}</div>}
          <div style={{display:"flex",justifyContent:"flex-end",marginTop:10}}><button onClick={()=>upd(d=>{d.liabilities=d.liabilities.filter(x=>x.id!==l.id);})} style={{padding:"8px 14px",borderRadius:8,background:RED+"22",color:RED,fontSize:12}}>✕ Eliminar</button></div>
        </Card>
      ))}
    </>}
    {addType==="asset"&&<AddAssetSheet aF={aF} setAF={setAF} onAdd={addAsset} onClose={()=>setAddType(null)}/>}
    {addType==="liab"&&<BottomSheet title="➕ Nuevo Pasivo" onClose={()=>setAddType(null)}>
      <div style={{padding:16,display:"flex",flexDirection:"column",gap:12}}>
        {[["Nombre",<input value={lF.name} onChange={e=>setLF(p=>({...p,name:e.target.value}))} placeholder="Hipoteca banco X"/>],["Tipo",<select value={lF.type} onChange={e=>setLF(p=>({...p,type:e.target.value}))}>{LTYPES.map(t=><option key={t}>{t}</option>)}</select>],["Importe (€)",<input type="number" value={lF.amount} onChange={e=>setLF(p=>({...p,amount:e.target.value}))} placeholder="0"/>],["Tipo interés (%)",<input type="number" value={lF.rate} onChange={e=>setLF(p=>({...p,rate:e.target.value}))} placeholder="0"/>],["Fecha inicio",<input type="date" value={lF.startDate} onChange={e=>setLF(p=>({...p,startDate:e.target.value}))}/>],["Vencimiento",<input type="date" value={lF.endDate} onChange={e=>setLF(p=>({...p,endDate:e.target.value}))}/>]].map(([l,inp])=><div key={l}><div style={{fontSize:11,color:MUT,fontWeight:600,marginBottom:5}}>{l}</div>{inp}</div>)}
        <button onClick={addLiab} style={{padding:"13px",borderRadius:10,background:RED,color:"#fff",fontSize:14,marginTop:4}}>Añadir pasivo</button>
        <div style={{height:8}}/>
      </div>
    </BottomSheet>}
    {sellA&&<BottomSheet title={"💸 Vender: "+sellA.name} sub={"Máx: "+sellA.qty+" · Actual: "+f(sellA.cv)} onClose={()=>setSellA(null)}>
      <div style={{padding:16,display:"flex",flexDirection:"column",gap:12}}>
        {[["Cantidad",<input type="number" value={sellF.qty} onChange={e=>setSellF(p=>({...p,qty:e.target.value}))} placeholder={String(sellA.qty)}/>],["Precio venta (€)",<input type="number" value={sellF.price} onChange={e=>setSellF(p=>({...p,price:e.target.value}))} placeholder={String(sellA.cv)}/>],["Fecha",<input type="date" value={sellF.date} onChange={e=>setSellF(p=>({...p,date:e.target.value}))}/>]].map(([l,inp])=><div key={l}><div style={{fontSize:11,color:MUT,fontWeight:600,marginBottom:5}}>{l}</div>{inp}</div>)}
        {(()=>{const qty=parseFloat(sellF.qty)||sellA.qty,price=parseFloat(sellF.price)||sellA.cv,cost=sellA.buyPrice*qty,proceeds=price*qty,gain=proceeds-cost;const days=sellA.buyDate?Math.max(1,Math.round((new Date(sellF.date)-new Date(sellA.buyDate))/86400000)):365;const ann=(Math.pow(1+(cost>0?gain/cost:0),365/days)-1)*100;return(<div style={{background:SRF,borderRadius:10,padding:14}}><div className="title" style={{fontSize:11,fontWeight:700,color:ACC,marginBottom:10}}>RESULTADO ESTIMADO</div><div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8}}>{[["Coste",f(cost),MUT],["Ingreso",f(proceeds),TXT],["Result.",(gain>=0?"+":"")+f(gain),gc(gain)],["Rentab.",(cost>0?gain/cost*100:0).toFixed(1)+"%",gc(gain)],["Anual.",ann.toFixed(1)+"%",gc(gain)],["Días",days+"d",MUT]].map(([l,v,c])=><div key={l} style={{background:BG,borderRadius:8,padding:"8px 10px"}}><div style={{fontSize:9,color:MUT}}>{l}</div><div style={{fontSize:12,fontWeight:700,color:c,fontFamily:"monospace"}}>{v}</div></div>)}</div></div>);})()}
        <div style={{display:"flex",gap:8}}>
          <button onClick={()=>setSellA(null)} style={{flex:1,padding:"12px",borderRadius:10,background:SRF,color:MUT,fontSize:14}}>Cancelar</button>
          <button onClick={doSell} style={{flex:2,padding:"12px",borderRadius:10,background:YLW,color:"#000",fontSize:14}}>✓ Confirmar</button>
        </div>
        <div style={{height:8}}/>
      </div>
    </BottomSheet>}
    {valA&&<BottomSheet title={"📊 Valorar: "+valA.name} onClose={()=>setValA(null)}>
      <div style={{padding:16,display:"flex",flexDirection:"column",gap:12}}>
        <div><div style={{fontSize:11,color:MUT,fontWeight:600,marginBottom:5}}>Fecha</div><input type="date" value={valF.date} onChange={e=>setValF(p=>({...p,date:e.target.value}))}/></div>
        <div><div style={{fontSize:11,color:MUT,fontWeight:600,marginBottom:5}}>Valor por título (€)</div><input type="number" value={valF.value} onChange={e=>setValF(p=>({...p,value:e.target.value}))} placeholder="0.00"/></div>
        {(appData.valHistory&&appData.valHistory[valA.id]&&appData.valHistory[valA.id].length>0)&&<div style={{background:SRF,borderRadius:10,padding:14}}><div className="title" style={{fontSize:11,fontWeight:700,color:ACC,marginBottom:10}}>HISTÓRICO</div><ResponsiveContainer width="100%" height={130}><LineChart data={appData.valHistory[valA.id].map(h=>({d:h.date.slice(5),v:h.value}))} margin={{left:-16,right:4,top:4,bottom:0}}><XAxis dataKey="d" tick={{fill:MUT,fontSize:9}} axisLine={false} tickLine={false}/><YAxis tick={{fill:MUT,fontSize:9}} axisLine={false} tickLine={false} tickFormatter={fk}/><Tooltip formatter={v=>f(v)} contentStyle={{background:CARD,border:`1px solid ${BOR}`,borderRadius:8}}/><Line type="monotone" dataKey="v" stroke={ACC} strokeWidth={2} dot={{r:3}}/></LineChart></ResponsiveContainer></div>}
        <div style={{display:"flex",gap:8}}>
          <button onClick={()=>setValA(null)} style={{flex:1,padding:"12px",borderRadius:10,background:SRF,color:MUT,fontSize:14}}>Cancelar</button>
          <button onClick={doVal} style={{flex:2,padding:"12px",borderRadius:10,background:GRN,color:"#fff",fontSize:14}}>✓ Registrar</button>
        </div>
        <div style={{height:8}}/>
      </div>
    </BottomSheet>}
  </div>;
}

// ── BALANCE GROUP TAB (Balance + Assets + Wealth) ───────────────────────────
function BalanceGroupTab({appData,upd}){
  const [subTab,setSubTab]=useState("balance");
  return <div className="su">
    {/* Sub-tab icons */}
    <div style={{display:"flex",gap:6,marginBottom:14}}>
      {[["balance","⚖️"],["assets","📈"],["wealth","📉"]].map(([v,ico])=>(
        <button key={v} onClick={()=>setSubTab(v)} style={{width:36,height:36,borderRadius:8,background:subTab===v?ACC:"transparent",border:`1.5px solid ${subTab===v?ACC:BOR}`,fontSize:18,display:"flex",alignItems:"center",justifyContent:"center",color:subTab===v?"#fff":MUT}}>
          {ico}
        </button>
      ))}
    </div>
    {subTab==="balance"&&<BalanceTab appData={appData}/>}
    {subTab==="assets" &&<AssetsTab  appData={appData} upd={upd}/>}
    {subTab==="wealth" &&<WealthTab  appData={appData} upd={upd}/>}
  </div>;
}

// ── BALANCE ───────────────────────────────────────────────────────────────────
function BalanceTab({appData}){
  const active=(appData.assets||[]).filter(a=>a.status==="active");
  const tA=active.reduce((s,a)=>s+a.cv*a.qty,0);
  const tL=(appData.liabilities||[]).reduce((s,l)=>s+l.amount,0);
  const nw=tA-tL;
  const byType=ATYPES.map((t,i)=>({name:t,value:active.filter(a=>a.type===t).reduce((s,a)=>s+a.cv*a.qty,0),color:ACOLORS[i]})).filter(t=>t.value>0);
  return <div className="su">
    <div style={{background:`linear-gradient(135deg,${ACC},#922b21)`,borderRadius:16,padding:"28px 16px",marginBottom:14,textAlign:"center"}}>
      <div className="title" style={{fontSize:11,color:"rgba(255,255,255,0.7)",fontWeight:700,textTransform:"uppercase",letterSpacing:".08em",marginBottom:8}}>PATRIMONIO NETO</div>
      <div style={{fontSize:38,fontWeight:800,color:"#fff",fontFamily:"monospace"}}>{f(nw)}</div>
      <div style={{display:"flex",justifyContent:"center",gap:28,marginTop:14}}>
        <div><div style={{fontSize:10,color:"rgba(255,255,255,0.7)"}}>Activos</div><div style={{fontSize:17,fontWeight:700,color:"#fff",fontFamily:"monospace"}}>{f(tA)}</div></div>
        <div style={{width:1,background:"rgba(255,255,255,0.3)"}}/>
        <div><div style={{fontSize:10,color:"rgba(255,255,255,0.7)"}}>Pasivos</div><div style={{fontSize:17,fontWeight:700,color:"#fff",fontFamily:"monospace"}}>{f(tL)}</div></div>
      </div>
      {(tA+tL)>0&&<><div style={{display:"flex",height:8,borderRadius:8,overflow:"hidden",marginTop:16,gap:1}}><div style={{flex:tA,background:"rgba(255,255,255,0.9)"}}/><div style={{flex:tL,background:"rgba(0,0,0,0.3)"}}/></div><div style={{display:"flex",justifyContent:"space-between",marginTop:5}}><span style={{fontSize:10,color:"rgba(255,255,255,0.8)"}}>Activos {Math.round(tA/(tA+tL)*100)}%</span><span style={{fontSize:10,color:"rgba(255,255,255,0.8)"}}>Pasivos {Math.round(tL/(tA+tL)*100)}%</span></div></>}
    </div>
    {byType.length>0&&<Card style={{marginBottom:14}}>
      <div className="title" style={{fontSize:11,fontWeight:700,color:ACC,marginBottom:12}}>DISTRIBUCIÓN DE ACTIVOS</div>
      <ResponsiveContainer width="100%" height={190}><PieChart><Pie data={byType} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={74} innerRadius={44} paddingAngle={2}>{byType.map((t,i)=><Cell key={i} fill={t.color}/>)}</Pie><Tooltip formatter={v=>f(v)} contentStyle={{background:CARD,border:`1px solid ${BOR}`,borderRadius:8}}/></PieChart></ResponsiveContainer>
      <div style={{display:"flex",flexWrap:"wrap",gap:8,justifyContent:"center",marginTop:6}}>{byType.map(t=><div key={t.name} style={{display:"flex",alignItems:"center",gap:4}}><div style={{width:8,height:8,borderRadius:"50%",background:t.color}}/><span style={{fontSize:10,color:MUT}}>{t.name}</span></div>)}</div>
    </Card>}
    {active.length>0&&<Card style={{marginBottom:14}}>
      <div className="title" style={{fontSize:11,fontWeight:700,color:ACC,marginBottom:10}}>📈 ACTIVOS</div>
      {(()=>{
        const [selAsset,setSelAsset]=useState(null);
        return <>
          {selAsset&&<AssetDetailCard sym={selAsset.sym} name={selAsset.name} onClose={()=>setSelAsset(null)}/>}
          {active.map(a=>{const c=a.buyPrice*a.qty,v=a.cv*a.qty,r=c>0?(v-c)/c:0;return(
            <div key={a.id} onClick={()=>a.isin&&setSelAsset({sym:a.isin,name:a.name})} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"9px 0",borderBottom:`1px solid ${BOR}22`,cursor:a.isin?"pointer":"default"}}>
              <div><div style={{fontSize:13,fontWeight:600}}>{a.name}{a.isin&&<span style={{fontSize:9,color:MUT,marginLeft:4}}>↗</span>}</div><div style={{fontSize:10,color:MUT}}>{a.type} · {a.qty} títulos</div></div>
              <div style={{textAlign:"right"}}><div style={{fontSize:14,fontWeight:700,fontFamily:"monospace"}}>{f(v)}</div><div style={{fontSize:11,color:gc(r)}}>{(r*100).toFixed(1)}%</div></div>
            </div>
          );})}
        </>;
      })()}
      <div style={{display:"flex",justifyContent:"space-between",paddingTop:10,marginTop:4}}><span style={{fontWeight:700}}>Total</span><span style={{fontWeight:800,fontSize:16,color:GRN,fontFamily:"monospace"}}>{f(tA)}</span></div>
    </Card>}
    {(appData.liabilities||[]).length>0&&<Card>
      <div className="title" style={{fontSize:11,fontWeight:700,color:RED,marginBottom:10}}>🏦 PASIVOS</div>
      {(appData.liabilities||[]).map(l=>(
        <div key={l.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"9px 0",borderBottom:`1px solid ${BOR}22`}}>
          <div><div style={{fontSize:13,fontWeight:600}}>{l.name}</div><div style={{fontSize:10,color:MUT}}>{l.type} · {l.rate}%{l.endDate?" · "+l.endDate:""}</div></div>
          <div style={{fontSize:14,fontWeight:700,color:RED,fontFamily:"monospace"}}>{f(l.amount)}</div>
        </div>
      ))}
      <div style={{display:"flex",justifyContent:"space-between",paddingTop:10,marginTop:4}}><span style={{fontWeight:700}}>Total</span><span style={{fontWeight:800,fontSize:16,color:RED,fontFamily:"monospace"}}>{f(tL)}</span></div>
    </Card>}
  </div>;
}

// ── ADD ASSET SHEET (with Yahoo Finance search) ──────────────────────────────
function AddAssetSheet({aF,setAF,onAdd,onClose}){
  const [query,setQuery]=useState("");
  const [results,setResults]=useState([]);
  const [searching,setSearching]=useState(false);
  const [fetchingPrice,setFetchingPrice]=useState(false);
  const [timer,setTimer]=useState(null);
  const [searchMsg,setSearchMsg]=useState("");

  function handleQueryChange(val){
    setQuery(val);
    setAF(p=>({...p,name:val}));
    if(timer) clearTimeout(timer);
    setResults([]); setSearchMsg("");
    if(val.length<2) return;
    const t=setTimeout(()=>doSearch(val),700);
    setTimer(t);
  }

  // Search via Vercel serverless function (proxy to Claude API)
  async function doSearch(q){
    setSearching(true); setSearchMsg("Buscando...");
    try{
      const res=await fetch("/api/search",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({query:q})});
      const data=await res.json();
      if(!res.ok){setSearchMsg("Error. Introduce ticker manualmente (ej: AAPL, SAN.MC)");setSearching(false);return;}
      const r=data.results||[];
      if(r.length>0){setResults(r);setSearchMsg("");setSearching(false);return;}
      setSearchMsg("Sin resultados. Prueba: 'Santander', 'ETF S&P 500', 'AAPL'");
    }catch(e){setSearchMsg("⚠️ Error: "+e.message+". Introduce el ticker directamente (ej: AAPL, SAN.MC)");}
    setSearching(false);
  }

  async function fetchCurrentPrice(ticker){
    if(!ticker) return;
    setFetchingPrice(true);
    try{
      const url=`https://api.allorigins.win/raw?url=${encodeURIComponent("https://query1.finance.yahoo.com/v8/finance/chart/"+encodeURIComponent(ticker)+"?interval=1d&range=1d")}`;
      const res=await fetch(url,{signal:AbortSignal.timeout(6000)});
      if(res.ok){
        const data=await res.json();
        const price=data?.chart?.result?.[0]?.meta?.regularMarketPrice;
        if(price&&price>0){
          setAF(p=>({...p,cv:String(Math.round(price*100)/100),buyPrice:p.buyPrice||String(Math.round(price*100)/100)}));
        }
      }
    }catch(e){}
    setFetchingPrice(false);
  }

  function selectResult(r){
    setAF(p=>({...p,
      name:r.name||r.ticker,
      isin:r.ticker||"",
      type:r.type||p.type
    }));
    setQuery(r.name||r.ticker);
    setResults([]);
    if(r.ticker) fetchCurrentPrice(r.ticker);
  }

  return <BottomSheet title="➕ Nuevo Activo" onClose={onClose}>
    <div style={{padding:16,display:"flex",flexDirection:"column",gap:12}}>
      {/* Smart search powered by Claude */}
      <div>
        <div style={{fontSize:11,color:MUT,fontWeight:600,marginBottom:5}}>🔍 Busca en lenguaje natural</div>
        <div style={{position:"relative"}}>
          <input value={query} onChange={e=>handleQueryChange(e.target.value)} placeholder="Ej: acciones Santander, ETF SP500, fondo Vanguard..." style={{paddingRight:38}}/>
          {searching&&<span style={{position:"absolute",right:10,top:"50%",transform:"translateY(-50%)",fontSize:13}}>⏳</span>}
          {query&&!searching&&<button onClick={()=>{setQuery("");setAF(p=>({...p,name:"",isin:""}));setResults([]);setSearchMsg("");}} style={{position:"absolute",right:8,top:"50%",transform:"translateY(-50%)",background:"transparent",color:MUT,fontSize:16,padding:2}}>✕</button>}
        </div>
        <div style={{fontSize:10,color:MUT,marginTop:4}}>Busca por nombre, ticker, ISIN o descripción natural</div>
        {results.length>0&&<div style={{background:CARD,border:`1px solid ${BOR}`,borderRadius:10,marginTop:6,overflow:"hidden",position:"relative",zIndex:100}}>
          {results.map((r,i)=>(
            <button key={i} onClick={()=>selectResult(r)} style={{width:"100%",padding:"11px 14px",textAlign:"left",background:"transparent",borderBottom:i<results.length-1?`1px solid ${BOR}22`:"none",display:"flex",justifyContent:"space-between",alignItems:"center",gap:8}}>
              <div style={{flex:1,minWidth:0}}>
                <div style={{display:"flex",alignItems:"center",gap:4}}>
                  <div style={{fontSize:13,fontWeight:700,color:TXT,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{r.name}</div>
                  {r.ticker&&<StarButton sym={r.ticker} name={r.name||r.ticker} size={13}/>}
                </div>
                <div style={{fontSize:10,color:MUT}}>{r.ticker}{r.exchange?" · "+r.exchange:""}{r.isin?" · "+r.isin:""}</div>
              </div>
              <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:2,flexShrink:0}}>
                <span style={{background:ACC+"22",color:ACC,borderRadius:20,padding:"1px 8px",fontSize:10,fontWeight:700}}>{r.type}</span>
                {r.currency&&<span style={{fontSize:9,color:MUT}}>{r.currency}</span>}
              </div>
            </button>
          ))}
          <div style={{padding:"6px 14px",fontSize:10,color:MUT,borderTop:`1px solid ${BOR}22`}}>Toca para autocompletar · Precio actual se obtiene automáticamente</div>
        </div>}
        {searchMsg&&<div style={{fontSize:11,color:YLW,marginTop:6,padding:"7px 10px",background:YLW+"11",borderRadius:8}}>{searchMsg}</div>}
      </div>

      {/* Fields */}
      <div><div style={{fontSize:11,color:MUT,fontWeight:600,marginBottom:5}}>Nombre del activo</div>
        <input value={aF.name} onChange={e=>setAF(p=>({...p,name:e.target.value}))} placeholder="Nombre completo"/>
      </div>
      <div><div style={{fontSize:11,color:MUT,fontWeight:600,marginBottom:5}}>Tipo</div>
        <select value={aF.type} onChange={e=>setAF(p=>({...p,type:e.target.value}))}>{ATYPES.map(t=><option key={t}>{t}</option>)}</select>
      </div>
      <div>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:5}}>
          <div style={{fontSize:11,color:MUT,fontWeight:600}}>Ticker / ISIN</div>
          {aF.isin&&<button onClick={()=>fetchCurrentPrice(aF.isin)} disabled={fetchingPrice} style={{fontSize:10,background:ACC+"22",color:ACC,padding:"3px 8px",borderRadius:6,fontWeight:700}}>{fetchingPrice?"⏳ Buscando...":"🔄 Obtener precio"}</button>}
        </div>
        <input value={aF.isin} onChange={e=>setAF(p=>({...p,isin:e.target.value}))} placeholder="AAPL, SAN.MC, ES0128520006..."/>
        <div style={{fontSize:10,color:MUT,marginTop:3}}>Ticker Yahoo Finance para actualizar precios automáticamente</div>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
        <div><div style={{fontSize:11,color:MUT,fontWeight:600,marginBottom:5}}>Nº Títulos</div>
          <input type="number" value={aF.qty} onChange={e=>setAF(p=>({...p,qty:e.target.value}))} placeholder="1"/>
        </div>
        <div><div style={{fontSize:11,color:MUT,fontWeight:600,marginBottom:5}}>Fecha compra</div>
          <input type="date" value={aF.buyDate} onChange={e=>setAF(p=>({...p,buyDate:e.target.value}))}/>
        </div>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
        <div><div style={{fontSize:11,color:MUT,fontWeight:600,marginBottom:5}}>Precio compra (€)</div>
          <input type="number" value={aF.buyPrice} onChange={e=>setAF(p=>({...p,buyPrice:e.target.value}))} placeholder="0.00"/>
        </div>
        <div>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:5}}>
            <div style={{fontSize:11,color:MUT,fontWeight:600}}>Valor actual (€)</div>
            {fetchingPrice&&<span style={{fontSize:10,color:ACC}}>⏳</span>}
          </div>
          <input type="number" value={aF.cv} onChange={e=>setAF(p=>({...p,cv:e.target.value}))} placeholder="= precio compra"/>
        </div>
      </div>
      {aF.cv&&aF.buyPrice&&parseFloat(aF.cv)>0&&parseFloat(aF.buyPrice)>0&&parseFloat(aF.cv)!==parseFloat(aF.buyPrice)&&<div style={{background:gc(parseFloat(aF.cv)-parseFloat(aF.buyPrice))+"22",color:gc(parseFloat(aF.cv)-parseFloat(aF.buyPrice)),borderRadius:8,padding:"8px 12px",fontSize:12,fontWeight:700}}>
        Variación: {((parseFloat(aF.cv)-parseFloat(aF.buyPrice))/parseFloat(aF.buyPrice)*100).toFixed(2)}% desde compra
      </div>}
      <button onClick={onAdd} style={{padding:"13px",borderRadius:10,background:`linear-gradient(135deg,${ACC},#922b21)`,color:"#fff",fontSize:14,marginTop:4}}>Añadir activo</button>
      <div style={{height:8}}/>
    </div>
  </BottomSheet>;
}

// ── WEALTH EVOLUTION TAB ──────────────────────────────────────────────────────
function WealthTab({appData,upd}){
  const [updating,setUpdating]=useState(false);
  const [showSnapForm,setShowSnapForm]=useState(false);
  const [editSnap,setEditSnap]=useState(null); // snapshot being edited
  const [snapF,setSnapF]=useState({date:new Date().toISOString().slice(0,7),assets:"",liabilities:"",invested:"",notes:""});

  const active=(appData.assets||[]).filter(a=>a.status==="active");
  const snapshots=appData.wealthSnapshots||[];

  async function updatePrices(){
    setUpdating(true);
    const toUpdate=active.filter(a=>a.isin);
    let updated=0;
    for(const asset of toUpdate){
      try{
        const sym=asset.isin;
        const url=`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?interval=1d&range=1d`;
        const res=await fetch(url);
        if(!res.ok) continue;
        const data=await res.json();
        const price=data?.chart?.result?.[0]?.meta?.regularMarketPrice;
        if(price&&price>0){
          upd(d=>{
            const a=d.assets.find(x=>x.id===asset.id);
            if(a){a.cv=Math.round(price*100)/100;if(!d.valHistory)d.valHistory={};if(!d.valHistory[a.id])d.valHistory[a.id]=[];d.valHistory[a.id].push({date:new Date().toISOString().slice(0,10),value:price});}
          });
          updated++;
        }
      }catch(e){}
    }
    setUpdating(false);
    alert(`✅ Actualizados ${updated} de ${toUpdate.length} activos con ticker/ISIN`);
  }

  function saveSnapshot(){
    const tA=snapF.assets!==""?parseFloat(snapF.assets):active.reduce((s,a)=>s+a.cv*a.qty,0);
    const tL=snapF.liabilities!==""?parseFloat(snapF.liabilities):(appData.liabilities||[]).reduce((s,l)=>s+l.amount,0);
    const ym=snapF.date.slice(0,7); // YYYY-MM
    const [yr,mo]=ym.split("-");
    const moIdx=parseInt(mo)-1;
    const key=ym;
    const label=MONTHS[moIdx]+" "+yr.slice(2);
    const byType={};
    active.forEach(a=>{if(!byType[a.type])byType[a.type]=0;byType[a.type]+=a.cv*a.qty;});
    upd(d=>{
      if(!d.wealthSnapshots)d.wealthSnapshots=[];
      const idx=d.wealthSnapshots.findIndex(s=>s.key===key);
      const invested=d.assets?d.assets.filter(a=>a.status==="active").reduce((s,a)=>s+a.buyPrice*a.qty,0):0;
      const snap={key,label,assets:tA,liabilities:tL,netWorth:tA-tL,byType,date:snapF.date,notes:snapF.notes,invested:Math.round(snapF.invested!==""?parseFloat(snapF.invested):invested)};
      if(idx>=0)d.wealthSnapshots[idx]=snap;
      else d.wealthSnapshots.push(snap);
      d.wealthSnapshots.sort((a,b)=>a.key.localeCompare(b.key));
    });
    setShowSnapForm(false);
    setEditSnap(null);
    setSnapF({date:new Date().toISOString().slice(0,7),assets:"",liabilities:"",invested:"",notes:""});
  }

  function openEdit(snap){
    setSnapF({date:snap.date||snap.key,assets:String(Math.round(snap.assets)),liabilities:String(Math.round(snap.liabilities)),invested:String(Math.round(snap.invested||0)),notes:snap.notes||""});
    setEditSnap(snap);
    setShowSnapForm(true);
  }

  function deleteSnap(key){
    upd(d=>{d.wealthSnapshots=(d.wealthSnapshots||[]).filter(s=>s.key!==key);});
  }

  // Cost basis = sum of buyPrice*qty for all active assets (what was invested)
  const totalCost=active.reduce((s,a)=>s+a.buyPrice*a.qty,0);
  const totalValue=active.reduce((s,a)=>s+a.cv*a.qty,0);
  const totalGain=totalValue-totalCost;
  const totalRet=totalCost>0?(totalGain/totalCost)*100:0;

  const chartData=snapshots.slice(-24).map(s=>({label:s.label,activos:Math.round(s.assets),pasivos:Math.round(s.liabilities),neto:Math.round(s.netWorth),invertido:Math.round(s.invested||0)}));
  const assetTypes=[...new Set(snapshots.flatMap(s=>Object.keys(s.byType||{})))].filter(Boolean);
  const typeData=snapshots.slice(-24).map(s=>({label:s.label,...Object.fromEntries(assetTypes.map(t=>[t,Math.round(s.byType?.[t]||0)]))}));
  const tColors=["#c0392b","#2c3e50","#e67e22","#8e44ad","#27ae60","#2980b9","#f39c12","#7f8c8d"];
  const tA=active.reduce((s,a)=>s+a.cv*a.qty,0);
  const tL=(appData.liabilities||[]).reduce((s,l)=>s+l.amount,0);

  return <div className="su">
    {/* Action buttons */}
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:14}}>
      <button onClick={updatePrices} disabled={updating} style={{padding:"11px 8px",borderRadius:12,background:`linear-gradient(135deg,${ACC},#922b21)`,color:"#fff",fontSize:12,fontWeight:700,opacity:updating?.6:1}}>
        {updating?"⏳ Actualizando...":"🔄 Actualizar precios"}
      </button>
      <button onClick={()=>{setEditSnap(null);setSnapF({date:new Date().toISOString().slice(0,7),assets:String(Math.round(tA)),liabilities:String(Math.round(tL)),invested:String(Math.round(totalCost)),notes:""});setShowSnapForm(true);}} style={{padding:"11px 8px",borderRadius:12,background:GRN,color:"#fff",fontSize:12,fontWeight:700}}>
        📸 Guardar snapshot
      </button>
    </div>

    {/* Snapshot form */}
    {showSnapForm&&<Card style={{marginBottom:14,border:`1px solid ${GRN}44`}}>
      <div className="title" style={{fontSize:12,fontWeight:700,color:GRN,marginBottom:14}}>{editSnap?"✏️ Editar snapshot":"📸 Nuevo snapshot patrimonial"}</div>
      <div style={{display:"flex",flexDirection:"column",gap:12}}>
        {/* Year + Month selectors */}
        <div>
          <div style={{fontSize:11,color:MUT,marginBottom:6,fontWeight:600}}>Periodo</div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
            <div>
              <div style={{fontSize:10,color:MUT,marginBottom:3}}>Año</div>
              <select value={snapF.date.slice(0,4)} onChange={e=>{const m=snapF.date.slice(5,7)||"01";setSnapF(p=>({...p,date:e.target.value+"-"+m}));}}>
                {Array.from({length:10},(_,i)=>2020+i).map(y=><option key={y} value={y}>{y}</option>)}
              </select>
            </div>
            <div>
              <div style={{fontSize:10,color:MUT,marginBottom:3}}>Mes</div>
              <select value={snapF.date.slice(5,7)} onChange={e=>{const yr=snapF.date.slice(0,4)||"2025";setSnapF(p=>({...p,date:yr+"-"+e.target.value}));}}>
                {MONTHS.map((m,i)=><option key={i} value={String(i+1).padStart(2,"0")}>{m}</option>)}
              </select>
            </div>
          </div>
          <div style={{fontSize:10,color:MUT,marginTop:5,padding:"5px 8px",background:SRF,borderRadius:6}}>
            📅 Periodo seleccionado: <strong style={{color:TXT}}>{MONTHS[parseInt(snapF.date.slice(5,7))-1]} {snapF.date.slice(0,4)}</strong>
            {snapshots.find(s=>s.key===snapF.date)&&<span style={{color:YLW}}> · Ya existe un snapshot — se sobreescribirá</span>}
          </div>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
          <div>
            <div style={{fontSize:11,color:MUT,marginBottom:4}}>Total activos (€)</div>
            <input type="number" value={snapF.assets} onChange={e=>setSnapF(p=>({...p,assets:e.target.value}))} placeholder={String(Math.round(tA))}/>
            <div style={{fontSize:10,color:MUT,marginTop:3}}>Hoy: {f(tA)}</div>
          </div>
          <div>
            <div style={{fontSize:11,color:MUT,marginBottom:4}}>Total pasivos (€)</div>
            <input type="number" value={snapF.liabilities} onChange={e=>setSnapF(p=>({...p,liabilities:e.target.value}))} placeholder={String(Math.round(tL))}/>
            <div style={{fontSize:10,color:MUT,marginTop:3}}>Hoy: {f(tL)}</div>
          </div>
        </div>
        <div>
          <div style={{fontSize:11,color:MUT,marginBottom:4}}>Capital invertido (€) <span style={{fontSize:10,color:MUT}}>· precio compra</span></div>
          <input type="number" value={snapF.invested||""} onChange={e=>setSnapF(p=>({...p,invested:e.target.value}))} placeholder={String(Math.round(totalCost))}/>
          <div style={{fontSize:10,color:MUT,marginTop:3}}>Coste compra actual: {f(totalCost)}</div>
        </div>
        {snapF.assets&&snapF.liabilities&&<div style={{background:gc(parseFloat(snapF.assets||tA)-parseFloat(snapF.liabilities||tL))+"22",color:gc(parseFloat(snapF.assets||tA)-parseFloat(snapF.liabilities||tL)),borderRadius:8,padding:"8px 12px",fontSize:13,fontWeight:700,textAlign:"center"}}>
          Patrimonio neto: {f(parseFloat(snapF.assets||tA)-parseFloat(snapF.liabilities||tL))}
        </div>}
        <div>
          <div style={{fontSize:11,color:MUT,marginBottom:4}}>Notas (opcional)</div>
          <input value={snapF.notes} onChange={e=>setSnapF(p=>({...p,notes:e.target.value}))} placeholder="Ej: Compré piso, subida bolsa..."/>
        </div>
        <div style={{display:"flex",gap:8}}>
          <button onClick={()=>{setShowSnapForm(false);setEditSnap(null);}} style={{flex:1,padding:"10px",borderRadius:10,background:SRF,color:MUT,fontSize:13}}>Cancelar</button>
          <button onClick={saveSnapshot} style={{flex:2,padding:"10px",borderRadius:10,background:GRN,color:"#fff",fontSize:13,fontWeight:700}}>✓ Guardar</button>
        </div>
      </div>
    </Card>}

    {/* Current summary KPIs */}
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:14}}>
      <Kpi label="Activos hoy" value={f(tA)} color={GRN}/>
      <Kpi label="Pasivos hoy" value={f(tL)} color={RED}/>
      <Kpi label="Patrimonio neto" value={f(tA-tL)} color={gc(tA-tL)}/>
      <Kpi label="Snapshots" value={snapshots.length} color={MUT}/>
    </div>

    {snapshots.length===0&&<Card style={{marginBottom:14,textAlign:"center",padding:28}}>
      <div style={{fontSize:32,marginBottom:8}}>📸</div>
      <div className="title" style={{fontSize:14,fontWeight:700,marginBottom:6}}>Sin histórico todavía</div>
      <div style={{fontSize:12,color:MUT,lineHeight:1.6}}>Pulsa <strong style={{color:GRN}}>"Guardar snapshot"</strong> para registrar el valor de tu patrimonio. Puedes introducir la fecha y los importes manualmente, o se rellenarán con los valores actuales de tus activos y pasivos.</div>
    </Card>}

    {/* Current investment rentability KPIs */}
    {active.length>0&&totalCost>0&&<div style={{background:`linear-gradient(135deg,${CARD},${SRF})`,border:`1px solid ${BOR}`,borderRadius:12,padding:16,marginBottom:14}}>
      <div className="title" style={{fontSize:11,fontWeight:700,color:ACC,marginBottom:12,textTransform:"uppercase",letterSpacing:".06em"}}>Rentabilidad actual cartera</div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:12}}>
        <Kpi label="Capital invertido" value={f(totalCost)} color={MUT}/>
        <Kpi label="Valor actual" value={f(totalValue)} color={gc(totalGain)}/>
        <Kpi label="Ganancia/pérdida" value={(totalGain>=0?"+":"")+f(totalGain)} color={gc(totalGain)}/>
        <Kpi label="Rentabilidad" value={(totalRet>=0?"+":"")+totalRet.toFixed(2)+"%" } color={gc(totalGain)}/>
      </div>
      <div style={{marginBottom:6}}>
        <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
          <span style={{fontSize:11,color:MUT}}>Valor vs Inversión</span>
          <span style={{fontSize:11,fontWeight:700,color:gc(totalGain)}}>{(totalRet>=0?"+":"")+totalRet.toFixed(1)}%</span>
        </div>
        <div style={{background:BOR,borderRadius:4,height:8,overflow:"hidden",display:"flex"}}>
          <div style={{width:Math.min(100,totalCost/Math.max(totalValue,totalCost)*100)+"%",background:MUT,height:"100%"}}/>
          {totalGain>0&&<div style={{width:(totalGain/Math.max(totalValue,totalCost)*100)+"%",background:GRN,height:"100%"}}/>}
        </div>
        <div style={{display:"flex",justifyContent:"space-between",marginTop:4}}>
          <span style={{fontSize:9,color:MUT}}>Invertido {Math.round(totalCost/Math.max(totalValue,totalCost)*100)}%</span>
          {totalGain>0&&<span style={{fontSize:9,color:GRN}}>Ganancia {Math.round(totalGain/Math.max(totalValue,totalCost)*100)}%</span>}
          {totalGain<0&&<span style={{fontSize:9,color:RED}}>Pérdida {Math.round(Math.abs(totalGain)/Math.max(totalValue,totalCost)*100)}%</span>}
        </div>
      </div>
    </div>}

    {chartData.length>=2&&<>
      {/* Rentability evolution chart */}
      {chartData.some(d=>d.invertido>0)&&<Card style={{marginBottom:14}}>
        <div className="title" style={{fontSize:11,fontWeight:700,color:ACC,marginBottom:14}}>CAPITAL INVERTIDO VS VALOR ACTIVOS</div>
        <ResponsiveContainer width="100%" height={210}>
          <BarChart data={chartData} barCategoryGap="20%" margin={{left:-10,right:8,top:4,bottom:0}}>
            <XAxis dataKey="label" tick={{fill:MUT,fontSize:10}} axisLine={false} tickLine={false}/>
            <YAxis tick={{fill:MUT,fontSize:9}} axisLine={false} tickLine={false} tickFormatter={fk}/>
            <Tooltip formatter={v=>f(v)} contentStyle={{background:CARD,border:`1px solid ${BOR}`,borderRadius:8}}/>
            <Bar dataKey="invertido" name="Capital invertido" fill={MUT} radius={[3,3,0,0]}/>
            <Bar dataKey="activos" name="Valor activos" fill={GRN} radius={[3,3,0,0]}/>
          </BarChart>
        </ResponsiveContainer>
        <div style={{display:"flex",gap:16,justifyContent:"center",marginTop:8}}>
          <div style={{display:"flex",alignItems:"center",gap:4}}><div style={{width:10,height:10,borderRadius:3,background:MUT}}/><span style={{fontSize:10,color:MUT}}>Capital invertido</span></div>
          <div style={{display:"flex",alignItems:"center",gap:4}}><div style={{width:10,height:10,borderRadius:3,background:GRN}}/><span style={{fontSize:10,color:MUT}}>Valor activos</span></div>
        </div>
      </Card>}

      <Card style={{marginBottom:14}}>
        <div className="title" style={{fontSize:11,fontWeight:700,color:ACC,marginBottom:14}}>EVOLUCIÓN PATRIMONIO NETO</div>
        <ResponsiveContainer width="100%" height={210}>
          <LineChart data={chartData} margin={{left:-10,right:8,top:4,bottom:0}}>
            <XAxis dataKey="label" tick={{fill:MUT,fontSize:10}} axisLine={false} tickLine={false}/>
            <YAxis tick={{fill:MUT,fontSize:9}} axisLine={false} tickLine={false} tickFormatter={fk}/>
            <Tooltip formatter={v=>f(v)} contentStyle={{background:CARD,border:`1px solid ${BOR}`,borderRadius:8}}/>
            <ReferenceLine y={0} stroke={BOR} strokeDasharray="4 4"/>
            <Line type="monotone" dataKey="activos" name="Activos" stroke={GRN} strokeWidth={2} dot={{r:3}}/>
            <Line type="monotone" dataKey="pasivos" name="Pasivos" stroke={RED} strokeWidth={2} dot={{r:3}}/>
            <Line type="monotone" dataKey="neto" name="Patrimonio neto" stroke={ACC} strokeWidth={3} dot={{r:4,fill:ACC}}/>
          </LineChart>
        </ResponsiveContainer>
      </Card>

      {assetTypes.length>0&&typeData.length>=2&&<Card style={{marginBottom:14}}>
        <div className="title" style={{fontSize:11,fontWeight:700,color:ACC,marginBottom:14}}>EVOLUCIÓN POR TIPO DE ACTIVO</div>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={typeData} barCategoryGap="20%" margin={{left:-10,right:8,top:4,bottom:0}}>
            <XAxis dataKey="label" tick={{fill:MUT,fontSize:10}} axisLine={false} tickLine={false}/>
            <YAxis tick={{fill:MUT,fontSize:9}} axisLine={false} tickLine={false} tickFormatter={fk}/>
            <Tooltip formatter={v=>f(v)} contentStyle={{background:CARD,border:`1px solid ${BOR}`,borderRadius:8}}/>
            {assetTypes.map((t,i)=><Bar key={t} dataKey={t} name={t} fill={tColors[i%tColors.length]} stackId="a" radius={i===assetTypes.length-1?[3,3,0,0]:[0,0,0,0]}/>)}
          </BarChart>
        </ResponsiveContainer>
        <div style={{display:"flex",flexWrap:"wrap",gap:8,marginTop:8,justifyContent:"center"}}>
          {assetTypes.map((t,i)=><div key={t} style={{display:"flex",alignItems:"center",gap:4}}><div style={{width:8,height:8,borderRadius:"50%",background:tColors[i%tColors.length]}}/><span style={{fontSize:10,color:MUT}}>{t}</span></div>)}
        </div>
      </Card>}
    </>}

    {/* Snapshot history with edit/delete */}
    {snapshots.length>0&&<Card>
      <div className="title" style={{fontSize:11,fontWeight:700,color:ACC,marginBottom:12}}>HISTÓRICO DE SNAPSHOTS</div>
      {snapshots.slice().reverse().map(s=>(
        <div key={s.key} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"10px 0",borderBottom:`1px solid ${BOR}22`}}>
          <div style={{flex:1}}>
            <div className="title" style={{fontSize:13,fontWeight:700}}>{s.label}</div>
            {s.notes&&<div style={{fontSize:10,color:MUT}}>{s.notes}</div>}
            <div className="title" style={{fontSize:12,color:gc(s.netWorth),marginTop:2}}>Neto: {f(s.netWorth)}</div>
          </div>
          <div style={{textAlign:"right",marginRight:10}}>
            <div style={{fontSize:12,color:GRN,fontFamily:"monospace"}}>{f(s.assets)}</div>
            <div style={{fontSize:11,color:RED,fontFamily:"monospace"}}>-{f(s.liabilities)}</div>
          </div>
          <div style={{display:"flex",gap:6}}>
            <button onClick={()=>openEdit(s)} style={{padding:"5px 9px",borderRadius:7,background:ACC+"22",color:ACC,fontSize:11,fontWeight:700}}>✏️</button>
            <button onClick={()=>deleteSnap(s.key)} style={{padding:"5px 9px",borderRadius:7,background:RED+"22",color:RED,fontSize:11,fontWeight:700}}>✕</button>
          </div>
        </div>
      ))}
    </Card>}
  </div>;
}

// ── TOOLS TAB ─────────────────────────────────────────────────────────────────
// ── WATCHLIST ─────────────────────────────────────────────────────────────────
// Watchlist data stored in localStorage: {lists: [{id,name,symbols:[]}], starred:{sym:listId}}
// ── WATCHLIST CONTEXT (singleton state shared across all components) ──────────
const WL_DEFAULT={lists:[{id:"default",name:"Mi Watchlist",symbols:[]}],starred:{},names:{}};

// ── Firestore helpers for watchlist ──────────────────────────────────────────
async function loadWLFromFirestore(uid){
  try{const s=await getDoc(doc(db,"watchlists",uid));return s.exists()?s.data().wl:null;}catch{return null;}
}
async function saveWLToFirestore(uid,d){
  try{await setDoc(doc(db,"watchlists",uid),{wl:d,updatedAt:new Date().toISOString()},{merge:false});}catch(e){console.error("WL save error:",e);}
}
// localStorage as fast cache
function loadWLCache(){try{const s=localStorage.getItem("fp_watchlist");return s?JSON.parse(s):null;}catch{return null;}}
function saveWLCache(d){try{localStorage.setItem("fp_watchlist",JSON.stringify(d));}catch{}}

// createContext and useContext used below
const WLCtx=createContext(null);

function WLProvider({children,uid}){
  const [data,setData]=useState(()=>loadWLCache()||WL_DEFAULT);
  const [synced,setSynced]=useState(false);

  // On mount: load from Firestore and merge with cache
  useEffect(()=>{
    if(!uid)return;
    loadWLFromFirestore(uid).then(cloud=>{
      if(cloud){
        setData(cloud);
        saveWLCache(cloud);
      } else {
        // First time: push local cache to cloud
        const local=loadWLCache()||WL_DEFAULT;
        saveWLToFirestore(uid,local);
      }
      setSynced(true);
    });
  },[uid]);

  function save(d){
    setData(d);
    saveWLCache(d);
    if(uid) saveWLToFirestore(uid,d);
  }

  function toggleStar(sym,listId="default",name=""){
    setData(prev=>{
      const d=JSON.parse(JSON.stringify(prev));
      const list=d.lists.find(l=>l.id===listId)||d.lists[0];
      if(!list)return prev;
      if(list.symbols.includes(sym)){
        list.symbols=list.symbols.filter(s=>s!==sym);
        delete d.starred[sym];
      }else{
        list.symbols.push(sym);
        d.starred[sym]=listId;
        if(name){if(!d.names)d.names={};d.names[sym]=name;}
      }
      saveWLCache(d);
      if(uid) saveWLToFirestore(uid,d);
      return d;
    });
  }
  function isStarred(sym){return !!data.starred[sym];}
  function getStarredList(sym){return data.starred[sym]||null;}
  function addList(name){
    setData(prev=>{
      const d=JSON.parse(JSON.stringify(prev));
      d.lists.push({id:Math.random().toString(36).slice(2),name,symbols:[]});
      saveWLCache(d);if(uid)saveWLToFirestore(uid,d);return d;
    });
  }
  function removeList(id){
    setData(prev=>{
      const d=JSON.parse(JSON.stringify(prev));
      d.lists=d.lists.filter(l=>l.id!==id);
      Object.keys(d.starred).forEach(sym=>{if(d.starred[sym]===id)delete d.starred[sym];});
      saveWLCache(d);if(uid)saveWLToFirestore(uid,d);return d;
    });
  }
  function addSymbol(sym,listId,name=""){
    setData(prev=>{
      const d=JSON.parse(JSON.stringify(prev));
      const list=d.lists.find(l=>l.id===listId);
      if(list&&!list.symbols.includes(sym)){
        list.symbols.push(sym);d.starred[sym]=listId;
        if(name){if(!d.names)d.names={};d.names[sym]=name;}
      }
      saveWLCache(d);if(uid)saveWLToFirestore(uid,d);return d;
    });
  }
  function removeSymbol(sym,listId){
    setData(prev=>{
      const d=JSON.parse(JSON.stringify(prev));
      const list=d.lists.find(l=>l.id===listId);
      if(list){list.symbols=list.symbols.filter(s=>s!==sym);delete d.starred[sym];}
      saveWLCache(d);if(uid)saveWLToFirestore(uid,d);return d;
    });
  }
  function moveToList(sym,fromListId,toListId){
    setData(prev=>{
      const d=JSON.parse(JSON.stringify(prev));
      const from=d.lists.find(l=>l.id===fromListId);
      const to=d.lists.find(l=>l.id===toListId);
      if(from)from.symbols=from.symbols.filter(s=>s!==sym);
      if(to&&!to.symbols.includes(sym))to.symbols.push(sym);
      d.starred[sym]=toListId;
      saveWLCache(d);if(uid)saveWLToFirestore(uid,d);return d;
    });
  }
  return <WLCtx.Provider value={{data,synced,toggleStar,isStarred,getStarredList,addList,removeList,addSymbol,removeSymbol,moveToList}}>{children}</WLCtx.Provider>;
}
function useWL(){return useContext(WLCtx)||{data:WL_DEFAULT,synced:false,toggleStar:()=>{},isStarred:()=>false,getStarredList:()=>null,addList:()=>{},removeList:()=>{},addSymbol:()=>{},removeSymbol:()=>{},moveToList:()=>{}};}

function StarButton({sym,name="",size=16}){
  const wl=useWL();
  const [starred,setStarred]=useState(()=>wl.isStarred(sym));
  const [showPicker,setShowPicker]=useState(false);
  useEffect(()=>{setStarred(wl.isStarred(sym));},[wl.data,sym]);

  function handleClick(e){
    e.stopPropagation();
    if(starred){
      // Remove from whichever list it's in
      const listId=wl.getStarredList(sym)||"default";
      wl.removeSymbol(sym,listId);
      setStarred(false);
    } else {
      if(wl.data.lists.length===1){
        // Only one list — add directly
        wl.toggleStar(sym,wl.data.lists[0].id,name);
        setStarred(true);
      } else {
        setShowPicker(true);
      }
    }
  }

  return <div style={{position:"relative",display:"inline-block"}}>
    <button onClick={handleClick}
      style={{background:"transparent",border:"none",cursor:"pointer",fontSize:size,lineHeight:1,color:starred?"#f39c12":MUT,padding:0,flexShrink:0}}>
      {starred?"★":"☆"}
    </button>
    {showPicker&&<div style={{position:"absolute",top:"100%",left:0,background:CARD,border:`1px solid ${BOR}`,borderRadius:8,padding:6,zIndex:200,minWidth:140,boxShadow:"0 4px 16px rgba(0,0,0,.4)"}}>
      <div style={{fontSize:9,color:MUT,fontWeight:700,marginBottom:4,padding:"0 4px"}}>GUARDAR EN:</div>
      {wl.data.lists.map(l=>(
        <button key={l.id} onClick={e=>{e.stopPropagation();wl.addSymbol(sym,l.id,name);setStarred(true);setShowPicker(false);}}
          style={{display:"block",width:"100%",padding:"6px 8px",textAlign:"left",background:"transparent",border:"none",color:TXT,fontSize:12,cursor:"pointer",borderRadius:4}}>
          ⭐ {l.name}
        </button>
      ))}
      <button onClick={e=>{e.stopPropagation();setShowPicker(false);}} style={{display:"block",width:"100%",padding:"4px 8px",textAlign:"center",background:"transparent",border:"none",color:MUT,fontSize:11,cursor:"pointer",marginTop:2}}>Cancelar</button>
    </div>}
  </div>;
}

function AssetDetailCard({sym,name,onClose}){
  const [prices,setPrices]=useState([]);
  const [fundamentals,setFundamentals]=useState(null);
  const [techSignals,setTechSignals]=useState(null);
  const [perfData,setPerfData]=useState(null);
  const [range,setRange]=useState("1y");
  const [loading,setLoading]=useState(true);
  const RANGES=[{k:"1mo",l:"1M"},{k:"3mo",l:"3M"},{k:"6mo",l:"6M"},{k:"1y",l:"1A"},{k:"2y",l:"2A"},{k:"5y",l:"5A"},{k:"10y",l:"10A"}];
  const SIG_ADC={"Compra fuerte":{c:"#27ae60",s:"↑↑"},"Compra":{c:"#2ecc71",s:"↑"},"Neutral":{c:"#95a5a6",s:"→"},"Venta":{c:"#e67e22",s:"↓"},"Venta fuerte":{c:"#c0392b",s:"↓↓"}};
  const TECH_FREQS_ADC=[{key:"1d",label:"Diario"},{key:"1w",label:"Semanal"},{key:"1mo",label:"Mensual"}];

  // Load chart when range changes
  useEffect(()=>{
    setLoading(true);
    fetch(`/api/market?symbols=${encodeURIComponent(sym)}&mode=chart&range=${range}`)
      .then(r=>r.ok?r.json():{prices:[]})
      .then(d=>setPrices(d.prices||[]))
      .catch(()=>{})
      .finally(()=>setLoading(false));
  },[sym,range]);

  // Load fundamentals, perf and tech once on mount
  useEffect(()=>{
    // Fundamentals via Claude AI
    fetch("/api/screener",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({symbols:[sym]})})
      .then(r=>r.ok?r.json():{})
      .then(d=>setFundamentals(d[sym]||null))
      .catch(()=>{});
    // Performance
    fetch(`/api/market?symbols=${encodeURIComponent(sym)}&mode=perf_bulk`)
      .then(r=>r.ok?r.json():{})
      .then(d=>setPerfData(d[sym]||null))
      .catch(()=>{});
    // Technical
    fetch("/api/technical",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({sym})})
      .then(r=>r.ok?r.json():null)
      .then(d=>setTechSignals(d?.signals||null))
      .catch(()=>{});
  },[sym]);

  const last=prices[prices.length-1]?.close;
  const first=prices[0]?.close;
  const chartChange=first&&last?((last-first)/first*100):null;
  const fu=fundamentals;

  function fmtB(v){if(v==null)return"—";if(v>=1e12)return(v/1e12).toFixed(1)+"T";if(v>=1e9)return(v/1e9).toFixed(1)+"B";return(v/1e6).toFixed(0)+"M";}
  function fmtP(v,d=1){if(v==null)return"—";return(v>=0?"+":"")+v.toFixed(d)+"%";}

  return <BottomSheet title={name||sym} onClose={onClose}>
    <div style={{padding:"0 16px 80px"}}>

      {/* Price + star */}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
        <div>
          <div style={{fontSize:26,fontWeight:900,fontFamily:"monospace"}}>{last?last.toLocaleString("es-ES",{minimumFractionDigits:2,maximumFractionDigits:2}):"—"}</div>
          {chartChange!=null&&<div style={{fontSize:12,fontWeight:700,color:chartChange>=0?GRN:RED}}>{chartChange>=0?"+":""}{chartChange.toFixed(2)}% ({RANGES.find(r=>r.k===range)?.l})</div>}
        </div>
        <StarButton sym={sym} name={name||sym} size={24}/>
      </div>

      {/* Range selector */}
      <div style={{display:"flex",gap:3,marginBottom:12}}>
        {RANGES.map(({k,l})=>(
          <button key={k} onClick={()=>setRange(k)} style={{flex:1,padding:"5px 0",borderRadius:6,background:range===k?ACC:SRF,border:`1px solid ${range===k?ACC:BOR}`,color:range===k?"#fff":MUT,fontSize:10,fontWeight:700}}>
            {l}
          </button>
        ))}
      </div>

      {/* Chart */}
      <Card style={{marginBottom:14}}>
        {loading?<div style={{textAlign:"center",padding:28,color:MUT}}>⏳ Cargando...</div>:
        prices.length>1?<ResponsiveContainer width="100%" height={200}>
          <LineChart data={prices} margin={{left:-16,right:4,top:4,bottom:0}}>
            <XAxis dataKey="date" tick={{fill:MUT,fontSize:9}} axisLine={false} tickLine={false} tickFormatter={v=>v.slice(5)}/>
            <YAxis tick={{fill:MUT,fontSize:9}} axisLine={false} tickLine={false} tickFormatter={v=>v>1000?v.toLocaleString("es-ES",{maximumFractionDigits:0}):v.toFixed(2)} domain={["auto","auto"]}/>
            <Tooltip formatter={v=>typeof v==="number"?v.toFixed(2):v} contentStyle={{background:CARD,border:`1px solid ${BOR}`,borderRadius:8}} labelFormatter={v=>v}/>
            <Line type="monotone" dataKey="close" stroke={chartChange>=0?GRN:RED} strokeWidth={2} dot={false}/>
          </LineChart>
        </ResponsiveContainer>:<div style={{textAlign:"center",padding:28,color:MUT}}>Sin datos de gráfico</div>}
      </Card>

      {/* Fundamentals */}
      <Card style={{marginBottom:14}}>
        <div className="title" style={{fontSize:11,fontWeight:700,color:ACC,marginBottom:10}}>📊 DATOS FUNDAMENTALES</div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
          {[
            ["Market Cap",fmtB(fu?.marketCap)],
            ["PER",fu?.per?fu.per.toFixed(1):"—"],
            ["Margen EBITDA",fmtP(fu?.ebitdaMargin!=null?fu.ebitdaMargin*100:null)],
            ["ROIC",fmtP(fu?.roic!=null?fu.roic*100:null)],
            ["Crec. Ventas",fmtP(fu?.revenueGrowth!=null?fu.revenueGrowth*100:null)],
            ["Moneda",fu?.currency||"—"],
          ].map(([label,val])=>(
            <div key={label} style={{background:SRF,borderRadius:8,padding:"8px 10px"}}>
              <div style={{fontSize:9,color:MUT}}>{label}</div>
              <div style={{fontSize:13,fontWeight:700,fontFamily:"monospace"}}>{val}</div>
            </div>
          ))}
        </div>
      </Card>

      {/* Performance */}
      <Card style={{marginBottom:14}}>
        <div className="title" style={{fontSize:11,fontWeight:700,color:ACC,marginBottom:10}}>📈 RENDIMIENTO HISTÓRICO</div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8}}>
          {[{key:"1y",label:"1 Año"},{key:"3y",label:"3 Años"},{key:"5y",label:"5 Años"}].map(({key,label})=>{
            const v=perfData?.[key];
            const c=v!=null?(v>=0?GRN:RED):MUT;
            return <div key={key} style={{background:SRF,borderRadius:8,padding:"8px 10px",textAlign:"center"}}>
              <div style={{fontSize:9,color:MUT,marginBottom:4}}>{label}</div>
              <div style={{fontSize:16,fontWeight:800,color:c,fontFamily:"monospace"}}>{v!=null?fmtP(v):loading?"⏳":"—"}</div>
            </div>;
          })}
        </div>
      </Card>

      {/* Technical signals */}
      <Card>
        <div className="title" style={{fontSize:11,fontWeight:700,color:ACC,marginBottom:10}}>📐 ANÁLISIS TÉCNICO</div>
        {loading?<div style={{textAlign:"center",padding:12,color:MUT,fontSize:11}}>⏳ Calculando...</div>:
        techSignals?<>
          <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8}}>
            {TECH_FREQS_ADC.map(({key,label})=>{
              const s=techSignals[key];
              const m=s?SIG_ADC[s.signal]||SIG_ADC["Neutral"]:null;
              return <div key={key} style={{background:m?m.bg||m.c+"18":SRF,borderRadius:8,padding:"10px 6px",textAlign:"center",border:m?`1px solid ${m.c}33`:"none"}}>
                <div style={{fontSize:9,color:MUT,fontWeight:700,marginBottom:4}}>{label}</div>
                {s&&m?<>
                  <div style={{fontSize:18,fontWeight:900,color:m.c,lineHeight:1}}>{m.s}</div>
                  <div style={{fontSize:10,color:m.c,fontWeight:700,marginTop:3}}>{s.signal}</div>
                  <div style={{fontSize:9,color:MUT,marginTop:2}}>▲{s.buyVotes}·▼{s.sellVotes}</div>
                </>:<div style={{fontSize:11,color:MUT}}>—</div>}
              </div>;
            })}
          </div>
          {techSignals["1d"]&&<div style={{marginTop:10,fontSize:10,color:MUT,lineHeight:1.5}}>
            <div style={{fontWeight:700,color:TXT,marginBottom:4}}>Indicadores (diario):</div>
            {Object.entries(techSignals["1d"].indicators||{}).slice(0,6).map(([k,ind])=>{
              const isBuy=ind.signal==="Compra",isSell=ind.signal==="Venta";
              const c=isBuy?GRN:isSell?RED:MUT;
              const labels={rsi:"RSI(14)",macd:"MACD",bollinger:"Bollinger",stochastic:"Estocástico",williams:"Williams %R",roc:"ROC(12)",ema9_21:"EMA 9/21",ema50:"EMA 50",ema200:"EMA 200"};
              return <div key={k} style={{display:"flex",justifyContent:"space-between",padding:"3px 0",borderBottom:`1px solid ${BOR}22`}}>
                <span style={{color:MUT}}>{labels[k]||k}</span>
                <span style={{color:c,fontWeight:700}}>{ind.value} · {ind.signal}</span>
              </div>;
            })}
          </div>}
          <div style={{fontSize:9,color:MUT,marginTop:8,opacity:.7}}>⚠️ Solo orientativo. No es asesoramiento financiero.</div>
        </>:<div style={{textAlign:"center",padding:12,color:MUT,fontSize:11}}>Sin datos técnicos disponibles</div>}
      </Card>
    </div>
  </BottomSheet>;
}

function WatchlistView(){
  const wl=useWL();
  const [selList,setSelList]=useState(()=>wl.data.lists[0]?.id||"default");
  const [mode,setMode]=useState("perf"); // "perf" | "fund" | "tech"
  const [prices,setPrices]=useState({});
  const [perf,setPerf]=useState({});
  const [fund,setFund]=useState({});
  const [tech,setTech]=useState({});
  const [loadingPrices,setLoadingPrices]=useState(false);
  const [loadingFund,setLoadingFund]=useState(false);
  const [loadingTech,setLoadingTech]=useState(false);
  const [selDetailSym,setSelDetailSym]=useState(null);
  const [newListName,setNewListName]=useState("");
  const [addQuery,setAddQuery]=useState("");
  const [addResults,setAddResults]=useState([]);
  const [addSearching,setAddSearching]=useState(false);
  const [addTimer,setAddTimer]=useState(null);
  const [addSym,setAddSym]=useState("");
  const [showAddList,setShowAddList]=useState(false);

  const list=wl.data.lists.find(l=>l.id===selList)||wl.data.lists[0];
  const syms=list?.symbols||[];

  // Load prices + perf
  useEffect(()=>{
    if(!syms.length)return;
    setLoadingPrices(true);
    const s=syms.join(",");
    Promise.all([
      fetch(`/api/market?symbols=${encodeURIComponent(s)}`).then(r=>r.ok?r.json():{}),
      fetch(`/api/market?symbols=${encodeURIComponent(s)}&mode=perf_bulk`).then(r=>r.ok?r.json():{}),
    ]).then(([p,pf])=>{setPrices(p);setPerf(pf);}).catch(()=>{}).finally(()=>setLoadingPrices(false));
  },[selList,syms.join(",")]);

  // Load fundamentals
  async function loadFund(){
    if(!syms.length)return;
    setLoadingFund(true);
    try{
      const res=await fetch("/api/screener",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({symbols:syms})});
      if(res.ok){const d=await res.json();setFund(d);}
    }catch(e){}
    setLoadingFund(false);
  }

  // Load tech signals
  // Map index symbols to tradeable equivalents for technical analysis
  const TECH_SYM_MAP={"^IBEX":"SAN.MC","^GSPC":"SPY","^IXIC":"QQQ","^DJI":"DIA","^GDAXI":"SAP.DE","^FCHI":"MC.PA","^FTSE":"SHEL.L","^N225":"7203.T","^HSI":"0700.HK","^STOXX50E":"ASML.AS"};

  async function loadTech(){
    if(!syms.length)return;
    setLoadingTech(true);
    const results={};
    for(let i=0;i<syms.length;i+=5){
      const batch=syms.slice(i,i+5);
      await Promise.all(batch.map(async sym=>{
        try{
          const techSym=TECH_SYM_MAP[sym]||sym;
          const r=await fetch("/api/technical",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({sym:techSym})});
          if(r.ok){const d=await r.json();results[sym]=d.signals;}
        }catch(e){}
      }));
    }
    setTech(results);
    setLoadingTech(false);
  }

  function switchMode(m){
    setMode(m);
    if(m==="fund"&&!Object.keys(fund).length)loadFund();
    if(m==="tech"&&!Object.keys(tech).length)loadTech();
  }

  // Search
  function handleAddSearch(val){
    setAddQuery(val);
    if(addTimer)clearTimeout(addTimer);
    if(val.length<2){setAddResults([]);return;}
    const t=setTimeout(async()=>{
      setAddSearching(true);
      try{
        const res=await fetch("/api/search",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({query:val})});
        if(res.ok){const d=await res.json();setAddResults(d.results||[]);}
      }catch(e){}
      setAddSearching(false);
    },600);
    setAddTimer(t);
  }

  function addFromSearch(r){
    wl.addSymbol(r.ticker,selList,r.name||r.ticker);
    setAddQuery(""); setAddResults([]);
  }

  function addManual(){
    if(!addSym.trim())return;
    wl.addSymbol(addSym.trim().toUpperCase(),selList);
    setAddSym("");
  }

  const PERF_COLS=[{k:"1d",l:"1D"},{k:"1w",l:"1S"},{k:"1m",l:"1M"},{k:"3m",l:"3M"},{k:"6m",l:"6M"},{k:"1y",l:"1A"},{k:"3y",l:"3A"},{k:"5y",l:"5A"}];
  const TECH_FREQS_WL=[{key:"5m",label:"5m"},{key:"1h",label:"1h"},{key:"1d",label:"1D"},{key:"1w",label:"1S"},{key:"1mo",label:"1M"}];
  const SIG_WL={"Compra fuerte":{c:"#27ae60",bg:"#27ae6022",s:"↑↑"},"Compra":{c:"#2ecc71",bg:"#2ecc7122",s:"↑"},"Neutral":{c:"#95a5a6",bg:"#95a5a622",s:"→"},"Venta":{c:"#e67e22",bg:"#e67e2222",s:"↓"},"Venta fuerte":{c:"#c0392b",bg:"#c0392b22",s:"↓↓"}};

  function fmtP(v){if(v==null)return"—";return(v>=0?"+":"")+v.toFixed(1)+"%";}
  function fmtB(v){if(v==null)return"—";if(v>=1e12)return(v/1e12).toFixed(1)+"T";if(v>=1e9)return(v/1e9).toFixed(1)+"B";return(v/1e6).toFixed(0)+"M";}

  return <div>
    {selDetailSym&&<AssetDetailCard sym={selDetailSym.sym} name={selDetailSym.name} onClose={()=>setSelDetailSym(null)}/>}

    {/* Header */}
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
      <div className="title" style={{fontSize:11,color:ACC,fontWeight:700,textTransform:"uppercase",letterSpacing:".06em"}}>⭐ Watchlists</div>
      <div style={{fontSize:10,color:wl.synced?GRN:MUT}}>{wl.synced?"☁️":"⏳"}</div>
    </div>

    {/* List tabs */}
    <div style={{display:"flex",gap:5,marginBottom:10,overflowX:"auto",paddingBottom:2}}>
      {wl.data.lists.map(l=>(
        <button key={l.id} onClick={()=>setSelList(l.id)} style={{flexShrink:0,padding:"5px 10px",borderRadius:8,background:selList===l.id?ACC:SRF,border:`1px solid ${selList===l.id?ACC:BOR}`,color:selList===l.id?"#fff":TXT,fontSize:11,fontWeight:700}}>
          {l.name} <span style={{fontSize:9,opacity:.7}}>({l.symbols.length})</span>
        </button>
      ))}
      <button onClick={()=>setShowAddList(s=>!s)} style={{flexShrink:0,width:30,height:30,borderRadius:8,background:SRF,border:`1px solid ${BOR}`,color:MUT,fontSize:16}}>+</button>
    </div>

    {showAddList&&<div style={{display:"flex",gap:8,marginBottom:10}}>
      <input value={newListName} onChange={e=>setNewListName(e.target.value)} placeholder="Nombre de la lista..."
        style={{flex:1}} onKeyDown={e=>e.key==="Enter"&&newListName.trim()&&(wl.addList(newListName.trim()),setNewListName(""),setShowAddList(false))}/>
      <button onClick={()=>{if(newListName.trim()){wl.addList(newListName.trim());setNewListName("");setShowAddList(false);}}}
        style={{padding:"8px 14px",borderRadius:8,background:ACC,color:"#fff",fontSize:13,fontWeight:700}}>Crear</button>
    </div>}

    {/* Add asset */}
    <div style={{marginBottom:10,position:"relative"}}>
      <div style={{position:"relative",marginBottom:6}}>
        <input value={addQuery} onChange={e=>handleAddSearch(e.target.value)} placeholder="🔍 Buscar activo para añadir..." style={{paddingRight:36}}/>
        {addSearching&&<span style={{position:"absolute",right:10,top:"50%",transform:"translateY(-50%)",fontSize:12}}>⏳</span>}
      </div>
      {addResults.length>0&&<div style={{background:CARD,border:`1px solid ${BOR}`,borderRadius:10,overflow:"hidden",marginBottom:6,position:"relative",zIndex:50}}>
        {addResults.slice(0,5).map((r,i)=>(
          <button key={i} onClick={()=>addFromSearch(r)} style={{width:"100%",padding:"9px 14px",textAlign:"left",background:"transparent",borderBottom:i<4?`1px solid ${BOR}22`:"none",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <div><div style={{fontSize:12,fontWeight:700}}>{r.name}</div><div style={{fontSize:10,color:MUT}}>{r.ticker}</div></div>
            <span style={{fontSize:10,color:GRN,fontWeight:700}}>+ Añadir</span>
          </button>
        ))}
      </div>}
      <div style={{display:"flex",gap:6}}>
        <input value={addSym} onChange={e=>setAddSym(e.target.value)} placeholder="O ticker directo (AAPL, SAN.MC...)"
          style={{flex:1}} onKeyDown={e=>e.key==="Enter"&&addManual()}/>
        <button onClick={addManual} style={{padding:"8px 12px",borderRadius:8,background:GRN,color:"#fff",fontSize:13,fontWeight:700}}>+</button>
      </div>
    </div>

    {/* Mode toggle */}
    <div style={{display:"flex",background:CARD,borderRadius:9,padding:3,border:`1px solid ${BOR}`,marginBottom:12}}>
      {[["perf","📈 Performance"],["fund","📊 Fundamentales"],["tech","📐 Técnico"]].map(([m,label])=>(
        <button key={m} onClick={()=>switchMode(m)} style={{flex:1,padding:"7px 0",borderRadius:7,fontSize:11,fontWeight:700,background:mode===m?ACC:"transparent",color:mode===m?"#fff":MUT}}>
          {label}
        </button>
      ))}
    </div>

    {!list||!syms.length
      ?<Card style={{textAlign:"center",padding:28}}>
          <div style={{fontSize:32,marginBottom:8}}>⭐</div>
          <div style={{fontSize:13,fontWeight:700,marginBottom:6}}>Watchlist vacía</div>
          <div style={{fontSize:12,color:MUT}}>Busca activos arriba o toca ☆ en cualquier activo</div>
        </Card>

      :<Card style={{overflowX:"auto",padding:"10px 8px"}}>

        {/* ── PERFORMANCE ── */}
        {mode==="perf"&&<>
          {loadingPrices&&<div style={{textAlign:"center",padding:10,color:MUT,fontSize:11}}>⏳ Cargando precios...</div>}
          {/* Header */}
          <div style={{display:"flex",gap:3,padding:"0 0 8px",borderBottom:`1px solid ${BOR}`,marginBottom:6,minWidth:480}}>
            <div style={{width:20}}/>
            <div style={{flex:1,fontSize:9,color:MUT,fontWeight:700}}>ACTIVO</div>
            <div style={{width:60,textAlign:"right",fontSize:9,color:MUT,fontWeight:700}}>PRECIO</div>
            {PERF_COLS.map(({l})=><div key={l} style={{width:34,textAlign:"center",fontSize:9,color:MUT,fontWeight:700,flexShrink:0}}>{l}</div>)}
            <div style={{width:18}}/>
          </div>
          <div style={{minWidth:480}}>
            {syms.map(sym=>{
              const d=prices[sym];
              const pf=perf[sym];
              const name=wl.data.names?.[sym]||d?.name||sym;
              const ch=d&&d.prev?(d.price-d.prev)/d.prev*100:null;
              const priceStr=d?.price?(d.price>1000?d.price.toLocaleString("es-ES",{maximumFractionDigits:0}):d.price.toFixed(2)):"—";
              return <div key={sym} onClick={()=>setSelDetailSym({sym,name})}
                style={{display:"flex",gap:3,padding:"6px 0",borderBottom:`1px solid ${BOR}22`,alignItems:"center",cursor:"pointer"}}>
                <div style={{width:20}} onClick={e=>e.stopPropagation()}><StarButton sym={sym} name={name} size={13}/></div>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontSize:11,fontWeight:700,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{name}</div>
                  <div style={{fontSize:9,color:MUT}}>{sym}</div>
                </div>
                <div style={{width:60,textAlign:"right",flexShrink:0}}>
                  <div style={{fontSize:11,fontWeight:700,fontFamily:"monospace"}}>{priceStr}</div>
                  {ch!=null&&<div style={{fontSize:9,color:ch>=0?GRN:RED,fontWeight:700}}>{ch>=0?"+":""}{ch.toFixed(1)}%</div>}
                </div>
                {PERF_COLS.map(({k})=>(
                  <div key={k} style={{width:34,textAlign:"center",flexShrink:0}}>
                    {pf?.[k]!=null
                      ?<span style={{fontSize:9,fontWeight:700,color:pf[k]>=0?GRN:RED,fontFamily:"monospace"}}>{pf[k]>=0?"+":""}{pf[k].toFixed(1)}%</span>
                      :<span style={{fontSize:9,color:MUT}}>—</span>}
                  </div>
                ))}
                <button onClick={e=>{e.stopPropagation();wl.removeSymbol(sym,selList);}} style={{width:18,background:"transparent",border:"none",color:MUT,fontSize:11,cursor:"pointer",flexShrink:0}}>✕</button>
              </div>;
            })}
          </div>
        </>}

        {/* ── FUNDAMENTALES ── */}
        {mode==="fund"&&<>
          {loadingFund&&<div style={{textAlign:"center",padding:10,color:MUT,fontSize:11}}>⏳ Cargando fundamentales...</div>}
          <div style={{minWidth:460}}>
            {/* Header */}
            <div style={{display:"flex",gap:3,padding:"0 0 8px",borderBottom:`1px solid ${BOR}`,marginBottom:6}}>
              <div style={{width:20}}/>
              <div style={{flex:1,fontSize:9,color:MUT,fontWeight:700}}>ACTIVO</div>
              <div style={{width:42,textAlign:"right",fontSize:9,color:MUT,fontWeight:700}}>PER</div>
              <div style={{width:52,textAlign:"right",fontSize:9,color:MUT,fontWeight:700}}>MKT CAP</div>
              <div style={{width:46,textAlign:"right",fontSize:9,color:MUT,fontWeight:700}}>EBITDA%</div>
              <div style={{width:40,textAlign:"right",fontSize:9,color:MUT,fontWeight:700}}>ROIC%</div>
              <div style={{width:44,textAlign:"right",fontSize:9,color:MUT,fontWeight:700}}>REV%</div>
              <div style={{width:18}}/>
            </div>
            {syms.map(sym=>{
              const f=fund[sym];
              const name=wl.data.names?.[sym]||sym;
              return <div key={sym} onClick={()=>setSelDetailSym({sym,name})}
                style={{display:"flex",gap:3,padding:"6px 0",borderBottom:`1px solid ${BOR}22`,alignItems:"center",cursor:"pointer"}}>
                <div style={{width:20}} onClick={e=>e.stopPropagation()}><StarButton sym={sym} name={name} size={13}/></div>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontSize:11,fontWeight:700,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{name}</div>
                  <div style={{fontSize:9,color:MUT}}>{sym}</div>
                </div>
                <div style={{width:42,textAlign:"right",fontSize:10,fontFamily:"monospace",color:f?.per&&f.per<15?GRN:f?.per&&f.per>30?RED:TXT}}>{f?.per?f.per.toFixed(1):"—"}</div>
                <div style={{width:52,textAlign:"right",fontSize:10,color:MUT}}>{fmtB(f?.marketCap)}</div>
                <div style={{width:46,textAlign:"right",fontSize:10,fontFamily:"monospace",color:f?.ebitdaMargin&&f.ebitdaMargin*100>20?GRN:MUT}}>{fmtP(f?.ebitdaMargin!=null?f.ebitdaMargin*100:null)}</div>
                <div style={{width:40,textAlign:"right",fontSize:10,fontFamily:"monospace",color:f?.roic&&f.roic*100>15?GRN:MUT}}>{fmtP(f?.roic!=null?f.roic*100:null)}</div>
                <div style={{width:44,textAlign:"right",fontSize:10,fontFamily:"monospace",color:f?.revenueGrowth!=null?(f.revenueGrowth>0?GRN:RED):MUT}}>{fmtP(f?.revenueGrowth!=null?f.revenueGrowth*100:null)}</div>
                <button onClick={e=>{e.stopPropagation();wl.removeSymbol(sym,selList);}} style={{width:18,background:"transparent",border:"none",color:MUT,fontSize:11,cursor:"pointer",flexShrink:0}}>✕</button>
              </div>;
            })}
          </div>
          {!Object.keys(fund).length&&!loadingFund&&<div style={{textAlign:"center",padding:16,color:MUT,fontSize:11}}>
            <button onClick={loadFund} style={{padding:"10px 20px",borderRadius:9,background:`linear-gradient(135deg,${ACC},#922b21)`,color:"#fff",fontSize:13,fontWeight:700}}>📊 Cargar fundamentales</button>
          </div>}
        </>}

        {/* ── TÉCNICO ── */}
        {mode==="tech"&&<>
          {loadingTech&&<div style={{textAlign:"center",padding:10,color:MUT,fontSize:11}}>⏳ Calculando señales técnicas...</div>}
          <div style={{minWidth:360}}>
            {/* Header */}
            <div style={{display:"flex",gap:3,padding:"0 0 8px",borderBottom:`1px solid ${BOR}`,marginBottom:6}}>
              <div style={{width:20}}/>
              <div style={{flex:1,fontSize:9,color:MUT,fontWeight:700}}>ACTIVO</div>
              {TECH_FREQS_WL.map(({label})=><div key={label} style={{width:52,textAlign:"center",fontSize:9,color:MUT,fontWeight:700,flexShrink:0}}>{label}</div>)}
              <div style={{width:18}}/>
            </div>
            {syms.map(sym=>{
              const t=tech[sym];
              const name=wl.data.names?.[sym]||sym;
              return <div key={sym} onClick={()=>setSelDetailSym({sym,name})}
                style={{display:"flex",gap:3,padding:"6px 0",borderBottom:`1px solid ${BOR}22`,alignItems:"center",cursor:"pointer"}}>
                <div style={{width:20}} onClick={e=>e.stopPropagation()}><StarButton sym={sym} name={name} size={13}/></div>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontSize:11,fontWeight:700,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{name}</div>
                  <div style={{fontSize:9,color:MUT}}>{sym}</div>
                </div>
                {TECH_FREQS_WL.map(({key})=>{
                  const s=t?.[key];
                  const m=s?SIG_WL[s.signal]:null;
                  return <div key={key} style={{width:52,textAlign:"center",flexShrink:0}}>
                    {loadingTech?<span style={{fontSize:9,color:MUT}}>⏳</span>:
                    s&&m?<span style={{fontSize:9,fontWeight:800,color:m.c,background:m.bg,borderRadius:4,padding:"2px 4px",whiteSpace:"nowrap",display:"block"}}>{m.s} {s.signal.replace(" fuerte","")}</span>:
                    <span style={{fontSize:9,color:MUT}}>—</span>}
                  </div>;
                })}
                <button onClick={e=>{e.stopPropagation();wl.removeSymbol(sym,selList);}} style={{width:18,background:"transparent",border:"none",color:MUT,fontSize:11,cursor:"pointer",flexShrink:0}}>✕</button>
              </div>;
            })}
          </div>
          {!Object.keys(tech).length&&!loadingTech&&<div style={{textAlign:"center",padding:16,color:MUT,fontSize:11}}>
            <button onClick={loadTech} style={{padding:"10px 20px",borderRadius:9,background:`linear-gradient(135deg,${ACC},#922b21)`,color:"#fff",fontSize:13,fontWeight:700}}>📐 Calcular señales técnicas</button>
          </div>}
        </>}
      </Card>
    }

    {wl.data.lists.length>1&&selList!=="default"&&<div style={{textAlign:"right",marginTop:8}}>
      <button onClick={()=>{wl.removeList(selList);setSelList(wl.data.lists[0]?.id||"default");}} style={{fontSize:11,color:RED,background:RED+"18",border:`1px solid ${RED}44`,borderRadius:6,padding:"3px 10px"}}>🗑 Eliminar lista</button>
    </div>}
  </div>;
}

// ── SCREENER HELPERS ──────────────────────────────────────────────────────────
const SIG_C={"Compra fuerte":"#27ae60","Compra":"#2ecc71","Neutral":"#95a5a6","Venta":"#e67e22","Venta fuerte":"#c0392b"};
const TECH_SIGNALS=["Compra fuerte","Compra","Neutral","Venta","Venta fuerte"];
const TECH_FILTER_FREQS=[{key:"5m",label:"5m"},{key:"1h",label:"1h"},{key:"1d",label:"1D"},{key:"1w",label:"1S"},{key:"1mo",label:"1M"}];

function MultiSelect({options,selected,onChange,colorMap}){
  return <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>
    {options.map(opt=>{
      const active=selected.includes(opt);
      const c=colorMap?colorMap[opt]||MUT:ACC;
      return <button key={opt} onClick={()=>onChange(active?selected.filter(x=>x!==opt):[...selected,opt])}
        style={{padding:"3px 8px",borderRadius:5,background:active?c+"33":SRF,border:`1.5px solid ${active?c:BOR}`,color:active?c:MUT,fontSize:10,fontWeight:700}}>
        {opt}
      </button>;
    })}
  </div>;
}

// ── SCREENER ───────────────────────────────────────────────────────────────────
const SCREENER_UNIVERSE=[
  // España
  {sym:"SAN.MC",name:"Santander",sector:"Banca",region:"Europa"},
  {sym:"BBVA.MC",name:"BBVA",sector:"Banca",region:"Europa"},
  {sym:"ITX.MC",name:"Inditex",sector:"Consumo",region:"Europa"},
  {sym:"TEF.MC",name:"Telefónica",sector:"Telecom",region:"Europa"},
  {sym:"REP.MC",name:"Repsol",sector:"Energía",region:"Europa"},
  {sym:"IBE.MC",name:"Iberdrola",sector:"Utilities",region:"Europa"},
  {sym:"ACS.MC",name:"ACS",sector:"Construcción",region:"Europa"},
  {sym:"CABK.MC",name:"CaixaBank",sector:"Banca",region:"Europa"},
  {sym:"FER.MC",name:"Ferrovial",sector:"Construcción",region:"Europa"},
  {sym:"MAP.MC",name:"Mapfre",sector:"Seguros",region:"Europa"},
  {sym:"ANA.MC",name:"Acciona",sector:"Utilities",region:"Europa"},
  {sym:"ELE.MC",name:"Endesa",sector:"Utilities",region:"Europa"},
  {sym:"ENG.MC",name:"Enagás",sector:"Energía",region:"Europa"},
  {sym:"IAG.MC",name:"IAG",sector:"Transporte",region:"Europa"},
  {sym:"CLNX.MC",name:"Cellnex",sector:"Telecom",region:"Europa"},
  // Europa
  {sym:"SAP.DE",name:"SAP",sector:"Tecnología",region:"Europa"},
  {sym:"SIE.DE",name:"Siemens",sector:"Industrial",region:"Europa"},
  {sym:"ASML.AS",name:"ASML",sector:"Semiconductores",region:"Europa"},
  {sym:"ALV.DE",name:"Allianz",sector:"Seguros",region:"Europa"},
  {sym:"MC.PA",name:"LVMH",sector:"Lujo",region:"Europa"},
  {sym:"OR.PA",name:"L'Oreal",sector:"Consumo",region:"Europa"},
  {sym:"TTE.PA",name:"TotalEnergies",sector:"Energía",region:"Europa"},
  {sym:"NOVN.SW",name:"Novartis",sector:"Farmacia",region:"Europa"},
  {sym:"NESN.SW",name:"Nestlé",sector:"Consumo",region:"Europa"},
  {sym:"ROG.SW",name:"Roche",sector:"Farmacia",region:"Europa"},
  {sym:"AZN.L",name:"AstraZeneca",sector:"Farmacia",region:"Europa"},
  {sym:"SHEL.L",name:"Shell",sector:"Energía",region:"Europa"},
  {sym:"HSBA.L",name:"HSBC",sector:"Banca",region:"Europa"},
  {sym:"ULVR.L",name:"Unilever",sector:"Consumo",region:"Europa"},
  {sym:"BP.L",name:"BP",sector:"Energía",region:"Europa"},
  {sym:"MBG.DE",name:"Mercedes-Benz",sector:"Automoción",region:"Europa"},
  {sym:"BMW.DE",name:"BMW",sector:"Automoción",region:"Europa"},
  {sym:"VOW3.DE",name:"Volkswagen",sector:"Automoción",region:"Europa"},
  {sym:"BAS.DE",name:"BASF",sector:"Química",region:"Europa"},
  {sym:"BAYN.DE",name:"Bayer",sector:"Farmacia",region:"Europa"},
  {sym:"ADS.DE",name:"Adidas",sector:"Consumo",region:"Europa"},
  {sym:"DBK.DE",name:"Deutsche Bank",sector:"Banca",region:"Europa"},
  // USA Tech
  {sym:"AAPL",name:"Apple",sector:"Tecnología",region:"EEUU"},
  {sym:"MSFT",name:"Microsoft",sector:"Tecnología",region:"EEUU"},
  {sym:"NVDA",name:"Nvidia",sector:"Semiconductores",region:"EEUU"},
  {sym:"AMZN",name:"Amazon",sector:"Tecnología",region:"EEUU"},
  {sym:"GOOGL",name:"Alphabet",sector:"Tecnología",region:"EEUU"},
  {sym:"META",name:"Meta",sector:"Tecnología",region:"EEUU"},
  {sym:"TSLA",name:"Tesla",sector:"Automoción",region:"EEUU"},
  {sym:"AVGO",name:"Broadcom",sector:"Semiconductores",region:"EEUU"},
  {sym:"ORCL",name:"Oracle",sector:"Tecnología",region:"EEUU"},
  {sym:"CRM",name:"Salesforce",sector:"Tecnología",region:"EEUU"},
  {sym:"ADBE",name:"Adobe",sector:"Tecnología",region:"EEUU"},
  {sym:"AMD",name:"AMD",sector:"Semiconductores",region:"EEUU"},
  {sym:"INTC",name:"Intel",sector:"Semiconductores",region:"EEUU"},
  {sym:"QCOM",name:"Qualcomm",sector:"Semiconductores",region:"EEUU"},
  {sym:"NFLX",name:"Netflix",sector:"Tecnología",region:"EEUU"},
  // USA Finance
  {sym:"JPM",name:"JPMorgan",sector:"Banca",region:"EEUU"},
  {sym:"BAC",name:"Bank of America",sector:"Banca",region:"EEUU"},
  {sym:"GS",name:"Goldman Sachs",sector:"Banca",region:"EEUU"},
  {sym:"MS",name:"Morgan Stanley",sector:"Banca",region:"EEUU"},
  {sym:"V",name:"Visa",sector:"Finanzas",region:"EEUU"},
  {sym:"MA",name:"Mastercard",sector:"Finanzas",region:"EEUU"},
  {sym:"BRK-B",name:"Berkshire",sector:"Holding",region:"EEUU"},
  // USA Health
  {sym:"JNJ",name:"Johnson & Johnson",sector:"Farmacia",region:"EEUU"},
  {sym:"UNH",name:"UnitedHealth",sector:"Salud",region:"EEUU"},
  {sym:"LLY",name:"Eli Lilly",sector:"Farmacia",region:"EEUU"},
  {sym:"ABBV",name:"AbbVie",sector:"Farmacia",region:"EEUU"},
  {sym:"MRK",name:"Merck",sector:"Farmacia",region:"EEUU"},
  {sym:"PFE",name:"Pfizer",sector:"Farmacia",region:"EEUU"},
  {sym:"TMO",name:"Thermo Fisher",sector:"Salud",region:"EEUU"},
  // USA Consumer/Energy
  {sym:"PG",name:"Procter & Gamble",sector:"Consumo",region:"EEUU"},
  {sym:"KO",name:"Coca-Cola",sector:"Consumo",region:"EEUU"},
  {sym:"PEP",name:"PepsiCo",sector:"Consumo",region:"EEUU"},
  {sym:"WMT",name:"Walmart",sector:"Retail",region:"EEUU"},
  {sym:"COST",name:"Costco",sector:"Retail",region:"EEUU"},
  {sym:"HD",name:"Home Depot",sector:"Retail",region:"EEUU"},
  {sym:"MCD",name:"McDonald's",sector:"Consumo",region:"EEUU"},
  {sym:"SBUX",name:"Starbucks",sector:"Consumo",region:"EEUU"},
  {sym:"XOM",name:"ExxonMobil",sector:"Energía",region:"EEUU"},
  {sym:"CVX",name:"Chevron",sector:"Energía",region:"EEUU"},
  // Asia
  {sym:"TSM",name:"TSMC",sector:"Semiconductores",region:"Asia"},
  {sym:"7203.T",name:"Toyota",sector:"Automoción",region:"Asia"},
  {sym:"6758.T",name:"Sony",sector:"Tecnología",region:"Asia"},
  {sym:"9984.T",name:"SoftBank",sector:"Tecnología",region:"Asia"},
  {sym:"0700.HK",name:"Tencent",sector:"Tecnología",region:"Asia"},
  {sym:"BABA",name:"Alibaba",sector:"Tecnología",region:"Asia"},
  {sym:"BIDU",name:"Baidu",sector:"Tecnología",region:"Asia"},
  {sym:"005930.KS",name:"Samsung",sector:"Tecnología",region:"Asia"},
];

// ── ASSET DETAIL CARD ─────────────────────────────────────────────────────────
function ScreenerView(){
  const [aiQuery,setAiQuery]=useState("");
  const [aiSearching,setAiSearching]=useState(false);
  const [results,setResults]=useState([]);
  const [fundamentals,setFundamentals]=useState({});
  const [perfData,setPerfData]=useState({});
  const [techData,setTechData]=useState({});
  const [loadingFund,setLoadingFund]=useState(false);
  const [loadingTech,setLoadingTech]=useState(false);
  const [selectedAsset,setSelectedAsset]=useState(null);
  const [fTechFreq,setFTechFreq]=useState("1d");
  const [fTechSig,setFTechSig]=useState([]);
  const [fPerfPeriod,setFPerfPeriod]=useState("1m");
  const [fPerfMin,setFPerfMin]=useState("");
  const [fPerfMax,setFPerfMax]=useState("");
  const [fMarketCap,setFMarketCap]=useState({min:"",max:""});
  const [fPER,setFPER]=useState({min:"",max:""});
  const [sortBy,setSortBy]=useState("name");
  const [sortDir,setSortDir]=useState("asc");
  const [searchText,setSearchText]=useState("");

  // AI search — returns list of tickers matching description
  async function doAiSearch(q){
    if(!q.trim())return;
    setAiSearching(true);
    try{
      // Use screener mode for larger result set
      const res=await fetch("/api/search",{
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({query:q, mode:"screener"})
      });
      if(!res.ok){setAiSearching(false);return;}
      const d=await res.json();
      const newResults=(d.results||[]).filter(r=>r.ticker&&r.ticker.length>0).map(r=>({sym:r.ticker,name:r.name||r.ticker,type:r.type,exchange:r.exchange}));
      if(newResults.length>0){
        setResults(prev=>{
          const existing=new Set(prev.map(r=>r.sym));
          const toAdd=newResults.filter(r=>!existing.has(r.sym));
          return [...prev,...toAdd];
        });
        // Auto-load fundamentals in batches of 15
        const newSyms=newResults.map(r=>r.sym);
        setLoadingFund(true);
        const batches=[];
        for(let i=0;i<newSyms.length;i+=15)batches.push(newSyms.slice(i,i+15));
        for(const batch of batches){
          fetch("/api/screener",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({symbols:batch})})
            .then(r=>r.ok?r.json():{})
            .then(fd=>setFundamentals(prev=>({...prev,...fd})))
            .catch(()=>{});
        }
        setTimeout(()=>setLoadingFund(false),batches.length*3000);
        // Load perf
        for(let i=0;i<newSyms.length;i+=20){
          const batch=newSyms.slice(i,i+20);
          fetch(`/api/market?symbols=${encodeURIComponent(batch.join(","))}&mode=perf_bulk`)
            .then(r=>r.ok?r.json():{})
            .then(pf=>setPerfData(prev=>({...prev,...pf})))
            .catch(()=>{});
        }
      }
    }catch(e){}
    setAiSearching(false);
  }

  async function loadFundamentals(){
    const syms=results.map(r=>r.sym);
    if(!syms.length)return;
    setLoadingFund(true);
    const allFund={},allPerf={};
    for(let i=0;i<syms.length;i+=15){
      const batch=syms.slice(i,i+15);
      try{
        const[fr,pr]=await Promise.all([
          fetch("/api/screener",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({symbols:batch})}),
          fetch(`/api/market?symbols=${encodeURIComponent(batch.join(","))}&mode=perf_bulk`)
        ]);
        if(fr.ok)Object.assign(allFund,await fr.json());
        if(pr.ok)Object.assign(allPerf,await pr.json());
      }catch(e){}
    }
    setFundamentals(prev=>({...prev,...allFund}));
    setPerfData(prev=>({...prev,...allPerf}));
    setLoadingFund(false);
  }

  async function loadTech(){
    const syms=results.map(r=>r.sym);
    if(!syms.length)return;
    setLoadingTech(true);
    for(let i=0;i<syms.length;i+=5){
      const batch=syms.slice(i,i+5);
      await Promise.all(batch.map(async sym=>{
        try{
          const r=await fetch("/api/technical",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({sym})});
          if(r.ok){const d=await r.json();setTechData(prev=>({...prev,[sym]:d.signals}));}
        }catch(e){}
      }));
    }
    setLoadingTech(false);
  }

  function passesFilter(val,min,max){
    if(min===""&&max==="")return true;
    if(val==null)return false;
    if(min!==""&&val<parseFloat(min))return false;
    if(max!==""&&val>parseFloat(max))return false;
    return true;
  }

  const filtered=results.filter(({sym,name})=>{
    const f=fundamentals[sym],p=perfData[sym],t=techData[sym];
    // Text search always works
    if(searchText){const q=searchText.toLowerCase();if(!name?.toLowerCase().includes(q)&&!sym.toLowerCase().includes(q))return false;}
    // Fundamental filters only apply if fundamentals are loaded
    if(Object.keys(fundamentals).length>0){
      if(!passesFilter(f?.marketCap!=null?f.marketCap/1e9:null,fMarketCap.min,fMarketCap.max))return false;
      if(!passesFilter(f?.per,fPER.min,fPER.max))return false;
    }
    if(fPerfMin!==""||fPerfMax!==""){if(!passesFilter(p?.[fPerfPeriod],fPerfMin,fPerfMax))return false;}
    if(fTechSig.length>0){const ts=t?.[fTechFreq];if(!ts||!fTechSig.includes(ts.signal))return false;}
    return true;
  }).sort((a,b)=>{
    const fa=fundamentals[a.sym],fb=fundamentals[b.sym],pa=perfData[a.sym],pb=perfData[b.sym];
    if(sortBy==="name")return sortDir==="asc"?(a.name||a.sym).localeCompare(b.name||b.sym):(b.name||b.sym).localeCompare(a.name||a.sym);
    let va=0,vb=0;
    if(sortBy==="per"){va=fa?.per||999;vb=fb?.per||999;}
    else if(sortBy==="cap"){va=fa?.marketCap||0;vb=fb?.marketCap||0;}
    else if(sortBy==="perf"){va=pa?.[fPerfPeriod]||0;vb=pb?.[fPerfPeriod]||0;}
    return sortDir==="desc"?vb-va:va-vb;
  });

  function fmtP(v){if(v==null)return"—";return(v>=0?"+":"")+v.toFixed(1)+"%";}
  function fmtB(v){if(v==null)return"—";if(v>=1e12)return(v/1e12).toFixed(1)+"T";if(v>=1e9)return(v/1e9).toFixed(1)+"B";return(v/1e6).toFixed(0)+"M";}

  function SBtn({col,label}){
    const active=sortBy===col;
    return <button onClick={()=>{if(active)setSortDir(d=>d==="desc"?"asc":"desc");else{setSortBy(col);setSortDir(col==="name"?"asc":"desc");}}} style={{background:"transparent",border:"none",color:active?ACC:MUT,fontSize:9,fontWeight:700,cursor:"pointer",padding:0,whiteSpace:"nowrap"}}>
      {label}{active?(sortDir==="desc"?"↓":"↑"):""}
    </button>;
  }
  function FChip({label,active,color,onClick}){
    const c=color||ACC;
    return <button onClick={onClick} style={{padding:"3px 8px",borderRadius:5,background:active?c+"33":SRF,border:`1.5px solid ${active?c:BOR}`,color:active?c:MUT,fontSize:10,fontWeight:700,flexShrink:0,whiteSpace:"nowrap"}}>{label}</button>;
  }

  const PRESET_SEARCHES=[
    {q:"principales acciones S&P 500",label:"🇺🇸 S&P 500"},
    {q:"mejores acciones europeas tecnología",label:"🇪🇺 Tech Europa"},
    {q:"bancos europeos grandes",label:"🏦 Bancos EU"},
    {q:"ETFs indexados mundiales acumulación",label:"📦 ETFs globales"},
    {q:"empresas tecnología semiconductores líderes mundiales",label:"💾 Semiconductores"},
    {q:"empresas farmacéuticas biotecnología USA Europa",label:"💊 Farma/Bio"},
    {q:"energía renovable solar eólica cotizadas",label:"⚡ Renovables"},
    {q:"lujo consumo premium cotizadas Europa USA",label:"👜 Lujo"},
    {q:"bancos españoles IBEX",label:"🇪🇸 IBEX Bancos"},
    {q:"acciones japonesas tecnología industria",label:"🇯🇵 Japón"},
    {q:"empresas chinas tecnología cotizadas Hong Kong USA",label:"🇨🇳 China Tech"},
    {q:"pequeñas empresas crecimiento small cap Europa",label:"📈 Small Cap EU"},
  ];

  return <div>
    {selectedAsset&&<AssetDetailCard sym={selectedAsset.sym} name={selectedAsset.name} onClose={()=>setSelectedAsset(null)}/>}

    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
      <div className="title" style={{fontSize:11,color:ACC,fontWeight:700,textTransform:"uppercase",letterSpacing:".06em"}}>🔎 Screener Global</div>
      <span style={{fontSize:11,color:MUT}}>{results.length} activos</span>
    </div>

    {/* AI search */}
    <Card style={{marginBottom:12}}>
      <div style={{fontSize:11,fontWeight:700,color:TXT,marginBottom:8}}>Describe qué activos quieres analizar:</div>
      <div style={{display:"flex",gap:8,marginBottom:8}}>
        <input value={aiQuery} onChange={e=>setAiQuery(e.target.value)}
          placeholder="Ej: acciones tecnología EEUU, bancos europeos, ETFs SP500..."
          style={{flex:1}}
          onKeyDown={e=>e.key==="Enter"&&doAiSearch(aiQuery)}/>
        <button onClick={()=>doAiSearch(aiQuery)} disabled={aiSearching||aiQuery.length<3}
          style={{padding:"10px 14px",borderRadius:9,background:`linear-gradient(135deg,${ACC},#922b21)`,color:"#fff",fontSize:13,fontWeight:700,flexShrink:0,opacity:aiSearching?.6:1}}>
          {aiSearching?"⏳":"🔍"}
        </button>
      </div>
      {/* Preset chips */}
      <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>
        {PRESET_SEARCHES.map(({q,label})=>(
          <button key={q} onClick={()=>{setAiQuery(q);doAiSearch(q);}}
            style={{padding:"4px 10px",borderRadius:6,background:SRF,border:`1px solid ${BOR}`,color:TXT,fontSize:11,cursor:"pointer",whiteSpace:"nowrap",fontWeight:600}}>
            {label}
          </button>
        ))}
      </div>
      {results.length>0&&<div style={{display:"flex",gap:6,marginTop:8}}>
        <button onClick={loadFundamentals} disabled={loadingFund} style={{flex:1,padding:"8px",borderRadius:8,background:ACC+"22",color:ACC,border:`1px solid ${ACC}44`,fontSize:11,fontWeight:700}}>
          {loadingFund?"⏳ Cargando...":"📊 Cargar fundamentales"}
        </button>
        <button onClick={loadTech} disabled={loadingTech} style={{flex:1,padding:"8px",borderRadius:8,background:SRF,border:`1px solid ${BOR}`,color:MUT,fontSize:11,fontWeight:700}}>
          {loadingTech?"⏳ Señales...":"📐 Señales técnicas"}
        </button>
        <button onClick={()=>{setResults([]);setFundamentals({});setPerfData({});setTechData({});}} style={{padding:"8px 12px",borderRadius:8,background:RED+"18",color:RED,border:`1px solid ${RED}44`,fontSize:11,fontWeight:700}}>
          🗑
        </button>
      </div>}
    </Card>

    {results.length>0&&<>
      {/* Filters */}
      <Card style={{marginBottom:10}}>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6,marginBottom:8}}>
          {[["Market Cap (B€)",fMarketCap,setFMarketCap],["PER",fPER,setFPER]].map(([label,state,setter])=>(
            <div key={label}><div style={{fontSize:9,color:MUT,marginBottom:2}}>{label}</div>
              <div style={{display:"flex",gap:3}}>
                <input type="number" value={state.min} onChange={e=>setter(s=>({...s,min:e.target.value}))} placeholder="Min" style={{flex:1,padding:"4px 6px",fontSize:11}}/>
                <input type="number" value={state.max} onChange={e=>setter(s=>({...s,max:e.target.value}))} placeholder="Max" style={{flex:1,padding:"4px 6px",fontSize:11}}/>
              </div>
            </div>
          ))}
        </div>
        <div style={{display:"flex",gap:4,flexWrap:"wrap",marginBottom:6,alignItems:"center"}}>
          <span style={{fontSize:9,color:MUT}}>Perf:</span>
          {[{key:"1w",label:"1S"},{key:"1m",label:"1M"},{key:"3m",label:"3M"},{key:"1y",label:"1A"}].map(({key,label})=>(
            <FChip key={key} label={label} active={fPerfPeriod===key} onClick={()=>setFPerfPeriod(key)}/>
          ))}
          <input type="number" value={fPerfMin} onChange={e=>setFPerfMin(e.target.value)} placeholder="Mín%" style={{width:46,padding:"3px 5px",fontSize:11}}/>
          <input type="number" value={fPerfMax} onChange={e=>setFPerfMax(e.target.value)} placeholder="Máx%" style={{width:46,padding:"3px 5px",fontSize:11}}/>
        </div>
        {Object.keys(techData).length>0&&<>
          <div style={{display:"flex",gap:4,flexWrap:"wrap",marginBottom:4,alignItems:"center"}}>
            <span style={{fontSize:9,color:MUT}}>Técnico:</span>
            {TECH_FILTER_FREQS.map(({key,label})=><FChip key={key} label={label} active={fTechFreq===key} onClick={()=>setFTechFreq(key)}/>)}
          </div>
          <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>
            {TECH_SIGNALS.map(sig=>{const c=SIG_C[sig]||MUT;return<FChip key={sig} label={sig} active={fTechSig.includes(sig)} color={c} onClick={()=>setFTechSig(s=>s.includes(sig)?s.filter(x=>x!==sig):[...s,sig])}/>;})}</div>
        </>}
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginTop:8}}>
          <div style={{position:"relative",flex:1,marginRight:8}}>
            <input value={searchText} onChange={e=>setSearchText(e.target.value)} placeholder="🔍 Filtrar por nombre..." style={{width:"100%",padding:"4px 8px",fontSize:11}}/>
          </div>
          <span style={{fontSize:11,color:MUT,flexShrink:0}}>{filtered.length}/{results.length}</span>
          <button onClick={()=>{setFMarketCap({min:"",max:""});setFPER({min:"",max:""});setFPerfMin("");setFPerfMax("");setFTechSig([]);setSearchText("");}} style={{fontSize:11,color:MUT,background:"transparent",border:"none",cursor:"pointer",marginLeft:8,flexShrink:0}}>✕</button>
        </div>
      </Card>

      {/* Results */}
      <Card style={{overflowX:"auto",padding:"10px 8px"}}>
        <div style={{minWidth:460}}>
          <div style={{display:"flex",gap:4,padding:"4px 4px 8px",borderBottom:`1px solid ${BOR}`,marginBottom:4}}>
            <div style={{width:18}}/>
            <div style={{flex:1}}><SBtn col="name" label="ACTIVO"/></div>
            <div style={{width:36,textAlign:"right"}}><SBtn col="per" label="PER"/></div>
            <div style={{width:48,textAlign:"right"}}><SBtn col="cap" label="MKT CAP"/></div>
            <div style={{width:44,textAlign:"right"}}><SBtn col="perf" label={fPerfPeriod.toUpperCase()}/></div>
            {Object.keys(techData).length>0&&<div style={{width:56,textAlign:"center",fontSize:9,color:MUT,fontWeight:700}}>{fTechFreq}</div>}
          </div>
          {filtered.length===0&&results.length>0&&<div style={{textAlign:"center",padding:20,color:MUT,fontSize:12}}>Sin resultados con los filtros actuales</div>}
        {filtered.length===0&&results.length===0&&<div style={{textAlign:"center",padding:20,color:MUT,fontSize:12}}>Busca empresas arriba para añadirlas al screener</div>}
          {filtered.slice(0,100).map(({sym,name,type,exchange})=>{
            const f=fundamentals[sym],p=perfData[sym],t=techData[sym]?.[fTechFreq];
            const tc=t?SIG_C[t.signal]||MUT:null;
            const pv=p?.[fPerfPeriod];
            return <div key={sym} style={{display:"flex",gap:4,padding:"5px 4px",borderBottom:`1px solid ${BOR}22`,alignItems:"center",cursor:"pointer"}}
              onClick={()=>setSelectedAsset({sym,name})}>
              <div style={{width:18}} onClick={e=>e.stopPropagation()}><StarButton sym={sym} name={name} size={12}/></div>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:11,fontWeight:700,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{name}</div>
                <div style={{fontSize:8,color:MUT}}>{sym}{exchange?" · "+exchange:""}{type?" · "+type:""}</div>
              </div>
              <div style={{width:36,textAlign:"right",fontSize:10,fontFamily:"monospace",color:f?.per&&f.per<15?GRN:f?.per&&f.per>30?RED:TXT}}>{f?.per?f.per.toFixed(1):"—"}</div>
              <div style={{width:48,textAlign:"right",fontSize:10,color:MUT}}>{fmtB(f?.marketCap)}</div>
              <div style={{width:44,textAlign:"right",fontSize:10,fontFamily:"monospace",color:pv!=null?(pv>=0?GRN:RED):MUT}}>{pv!=null?fmtP(pv):"—"}</div>
              {Object.keys(techData).length>0&&<div style={{width:56,textAlign:"center"}}>{t?<span style={{fontSize:8,fontWeight:700,color:tc,background:tc+"18",borderRadius:3,padding:"1px 3px",whiteSpace:"nowrap"}}>{t.signal.replace(" fuerte","")}</span>:<span style={{fontSize:8,color:MUT}}>—</span>}</div>}
            </div>;
          })}
          {filtered.length>100&&<div style={{textAlign:"center",padding:8,fontSize:11,color:MUT}}>Mostrando 100 de {filtered.length} · Añade filtros para afinar</div>}
        </div>
      </Card>
    </>}

    {results.length===0&&<Card style={{textAlign:"center",padding:32}}>
      <div style={{fontSize:32,marginBottom:12}}>🌍</div>
      <div style={{fontSize:14,fontWeight:700,marginBottom:8}}>Screener Global</div>
      <div style={{fontSize:12,color:MUT,lineHeight:1.8,marginBottom:16}}>Describe en lenguaje natural qué activos quieres analizar.<br/>Claude buscará entre miles de empresas cotizadas.</div>
      <div style={{display:"flex",flexWrap:"wrap",gap:6,justifyContent:"center"}}>
        {PRESET_SEARCHES.map(({q,label})=>(
          <button key={q} onClick={()=>{setAiQuery(q);doAiSearch(q);}}
            style={{padding:"8px 12px",borderRadius:8,background:SRF,border:`1px solid ${BOR}`,color:TXT,fontSize:12,cursor:"pointer",fontWeight:600}}>
            {label}
          </button>
        ))}
      </div>
    </Card>}
  </div>;
}
// ── ANALYSES ──────────────────────────────────────────────────────────────────
async function loadAnalyses(){
  try{
    const{collection,getDocs,query,orderBy}=await import("firebase/firestore");
    const q=query(collection(db,"analyses"),orderBy("createdAt","desc"));
    const snap=await getDocs(q);
    return snap.docs.map(d=>({id:d.id,...d.data()}));
  }catch(e){console.error(e);return[];}
}
async function saveAnalysis(data){
  try{
    const{collection,addDoc}=await import("firebase/firestore");
    await addDoc(collection(db,"analyses"),{...data,createdAt:new Date().toISOString()});
  }catch(e){console.error(e);}
}
async function deleteAnalysis(id){
  try{
    const{doc,deleteDoc}=await import("firebase/firestore");
    await deleteDoc(doc(db,"analyses",id));
  }catch(e){console.error(e);}
}

function AnalysisDetailView({analysis,onClose,isMaster,onDelete}){
  return <BottomSheet title={analysis.title} sub={new Date(analysis.createdAt).toLocaleDateString("es-ES",{day:"2-digit",month:"long",year:"numeric"})} onClose={onClose}>
    <div style={{padding:"0 16px 80px"}}>
      {analysis.category&&<span style={{background:ACC+"22",color:ACC,borderRadius:20,padding:"3px 10px",fontSize:11,fontWeight:700,display:"inline-block",marginBottom:12}}>{analysis.category}</span>}
      {analysis.pdfUrl
        ?<iframe
            src={analysis.pdfUrl.includes("drive.google.com")?`https://docs.google.com/viewer?url=${encodeURIComponent(analysis.pdfUrl)}&embedded=true`:analysis.pdfUrl}
```

Guarda y haz push:
```
git add src\App.js
git commit -m "fix pdf viewer"
git push https://pepovich1980-dev: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@github.com/pepovich1980-dev/finanzaspro.git main
            style={{width:"100%",height:"70vh",border:"none",borderRadius:8,background:SRF}}
            title={analysis.title}
            allow="autoplay"
          />
        :<div style={{fontSize:13,lineHeight:1.8,color:TXT,whiteSpace:"pre-wrap",wordBreak:"break-word"}}>
          {analysis.content}
        </div>
      }
      {isMaster&&<div style={{marginTop:16}}>
        <button onClick={()=>{onDelete(analysis.id);onClose();}} style={{width:"100%",padding:"12px",borderRadius:10,background:RED+"22",color:RED,border:`1px solid ${RED}44`,fontSize:13,fontWeight:700}}>
          🗑 Eliminar análisis
        </button>
      </div>}
    </div>
  </BottomSheet>;
}

function AnalysesView({isMaster}){
  const [analyses,setAnalyses]=useState([]);
  const [loading,setLoading]=useState(true);
  const [selected,setSelected]=useState(null);
  const [showForm,setShowForm]=useState(false);
  const [form,setForm]=useState({title:"",category:"",content:"",type:"text",pdfUrl:""});
  const [saving,setSaving]=useState(false);
  const CATEGORIES=["Renta Variable","Renta Fija","Macro","Sectorial","Divisa","Cripto","Otro"];

  useEffect(()=>{
    loadAnalyses().then(a=>{setAnalyses(a);setLoading(false);});
  },[]);

  async function handleSave(){console.log("form:", form);
    if(!form.title.trim()||!form.content.trim())return;
    setSaving(true);
    await saveAnalysis(form);
    const updated=await loadAnalyses();
    setAnalyses(updated);
    setForm({title:"",category:"",content:""});
    setShowForm(false);
    setSaving(false);
  }

  async function handleDelete(id){
    await deleteAnalysis(id);
    setAnalyses(prev=>prev.filter(a=>a.id!==id));
  }

  return <div>
    {selected&&<AnalysisDetailView analysis={selected} onClose={()=>setSelected(null)} isMaster={isMaster} onDelete={handleDelete}/>}

    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
      <div className="title" style={{fontSize:11,color:ACC,fontWeight:700,textTransform:"uppercase",letterSpacing:".06em"}}>📄 Análisis</div>
      {isMaster&&<button onClick={()=>setShowForm(s=>!s)} style={{padding:"7px 14px",borderRadius:8,background:`linear-gradient(135deg,${ACC},#922b21)`,color:"#fff",fontSize:12,fontWeight:700}}>
        {showForm?"✕ Cancelar":"+ Nuevo análisis"}
      </button>}
    </div>

    {showForm&&isMaster&&<Card style={{marginBottom:14,border:`1px solid ${ACC}44`}}>
  <div className="title" style={{fontSize:12,fontWeight:700,color:ACC,marginBottom:14}}>Nuevo análisis</div>
  <div style={{display:"flex",flexDirection:"column",gap:10}}>
    <div><div style={{fontSize:11,color:MUT,marginBottom:4}}>Título</div>
      <input value={form.title} onChange={e=>setForm(p=>({...p,title:e.target.value}))} placeholder="Ej: Perspectivas Q2 2025"/>
    </div>
    <div><div style={{fontSize:11,color:MUT,marginBottom:4}}>Categoría</div>
      <select value={form.category} onChange={e=>setForm(p=>({...p,category:e.target.value}))}>
        <option value="">Sin categoría</option>
        {CATEGORIES.map(c=><option key={c} value={c}>{c}</option>)}
      </select>
    </div>
    <div><div style={{fontSize:11,color:MUT,marginBottom:4}}>Tipo</div>
      <select value={form.type||"text"} onChange={e=>setForm(p=>({...p,type:e.target.value}))}>
        <option value="text">📝 Texto</option>
        <option value="pdf">📄 PDF (Google Drive)</option>
      </select>
    </div>
    {(!form.type||form.type==="text")&&<div><div style={{fontSize:11,color:MUT,marginBottom:4}}>Contenido</div>
      <textarea value={form.content} onChange={e=>setForm(p=>({...p,content:e.target.value}))} placeholder="Escribe el análisis aquí..." style={{width:"100%",minHeight:200,background:SRF,border:`1.5px solid ${BOR}`,color:TXT,borderRadius:8,padding:"11px 13px",fontSize:13,fontFamily:"Open Sans,sans-serif",lineHeight:1.7,resize:"vertical"}}/>
    </div>}
    {form.type==="pdf"&&<div><div style={{fontSize:11,color:MUT,marginBottom:4}}>URL del PDF (Google Drive)</div>
      <input value={form.pdfUrl||""} onChange={e=>setForm(p=>({...p,pdfUrl:e.target.value}))} placeholder="https://drive.google.com/file/d/ID/preview"/>
      <div style={{fontSize:10,color:MUT,marginTop:4}}>En Drive: compartir → cualquiera con el enlace → pon: drive.google.com/file/d/ID/preview</div>
    </div>}
    <button onClick={handleSave} disabled={saving||!form.title.trim()||((!form.type||form.type==="text")&&!form.content.trim())||(form.type==="pdf"&&!form.pdfUrl?.trim())} style={{padding:"13px",borderRadius:10,background:`linear-gradient(135deg,${ACC},#922b21)`,color:"#fff",fontSize:14,fontWeight:700,opacity:saving?.6:1}}>
      {saving?"Guardando...":"💾 Publicar análisis"}
    </button>
  </div>
</Card>}
  
    {loading?<Card style={{textAlign:"center",padding:32}}><div style={{fontSize:32,marginBottom:8}}>⏳</div><div style={{color:MUT}}>Cargando análisis...</div></Card>:
    analyses.length===0?<Card style={{textAlign:"center",padding:32}}>
      <div style={{fontSize:32,marginBottom:8}}>📄</div>
      <div className="title" style={{fontSize:14,fontWeight:700,marginBottom:6}}>Sin análisis publicados</div>
      <div style={{fontSize:12,color:MUT}}>{isMaster?"Pulsa '+ Nuevo análisis' para publicar el primero":"Próximamente aparecerán análisis aquí"}</div>
    </Card>:
    <div style={{display:"flex",flexDirection:"column",gap:10}}>
      {analyses.map(a=>(
        <Card key={a.id} onClick={()=>setSelected(a)} style={{cursor:"pointer",borderLeft:`3px solid ${ACC}`}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:6}}>
            <div style={{flex:1,minWidth:0}}>
              <div className="title" style={{fontSize:14,fontWeight:800,marginBottom:4}}>{a.title}</div>
              <div style={{fontSize:10,color:MUT}}>{new Date(a.createdAt).toLocaleDateString("es-ES",{day:"2-digit",month:"long",year:"numeric"})}</div>
            </div>
            {a.category&&<span style={{background:ACC+"22",color:ACC,borderRadius:20,padding:"2px 10px",fontSize:11,fontWeight:700,flexShrink:0,marginLeft:8}}>{a.category}</span>}
          </div>
          <div style={{fontSize:12,color:MUT,overflow:"hidden",textOverflow:"ellipsis",display:"-webkit-box",WebkitLineClamp:2,WebkitBoxOrient:"vertical",lineHeight:1.6}}>
            {a.content}
          </div>
          <div style={{fontSize:11,color:ACC,fontWeight:700,marginTop:8}}>Leer más →</div>
        </Card>
      ))}
    </div>}
  </div>;
}
function DatosClienteView(){
  const [form,setForm]=useState(()=>{
    try{const s=localStorage.getItem("fp_client");return s?JSON.parse(s):{nombre:"",edad:"",email:"",telefono:"",ocupacion:"",ingresosMensuales:"",gastosMensuales:"",patrimonioBruto:"",deudas:"",objetivos:"",horizonte:"",notas:""};}
    catch{return{nombre:"",edad:"",email:"",telefono:"",ocupacion:"",ingresosMensuales:"",gastosMensuales:"",patrimonioBruto:"",deudas:"",objetivos:"",horizonte:"",notas:""};}
  });
  const [saved,setSaved]=useState(false);
  function save(){try{localStorage.setItem("fp_client",JSON.stringify(form));setSaved(true);setTimeout(()=>setSaved(false),2000);}catch{}}
  return <div>
    <div className="title" style={{fontSize:11,color:ACC,fontWeight:700,textTransform:"uppercase",letterSpacing:".06em",marginBottom:14}}>👤 Datos del cliente</div>
    {[["Nombre","nombre","text"],["Edad","edad","number"],["Email","email","email"],["Teléfono","telefono","tel"],["Ocupación","ocupacion","text"]].map(([l,k,t])=>(
      <div key={k} style={{marginBottom:10}}><div style={{fontSize:11,color:MUT,marginBottom:4}}>{l}</div>
        <input type={t} value={form[k]} onChange={e=>setForm(p=>({...p,[k]:e.target.value}))} placeholder={l}/></div>
    ))}
    <Card style={{marginBottom:12}}>
      <div className="title" style={{fontSize:10,color:MUT,fontWeight:700,marginBottom:10}}>SITUACIÓN FINANCIERA</div>
      {[["Ingresos mensuales (€)","ingresosMensuales"],["Gastos mensuales (€)","gastosMensuales"],["Patrimonio bruto (€)","patrimonioBruto"],["Deudas (€)","deudas"]].map(([l,k])=>(
        <div key={k} style={{marginBottom:10}}><div style={{fontSize:11,color:MUT,marginBottom:4}}>{l}</div>
          <input type="number" value={form[k]} onChange={e=>setForm(p=>({...p,[k]:e.target.value}))} placeholder="0"/></div>
      ))}
    </Card>
    <div style={{marginBottom:10}}><div style={{fontSize:11,color:MUT,marginBottom:4}}>Objetivos financieros</div>
      <input value={form.objetivos} onChange={e=>setForm(p=>({...p,objetivos:e.target.value}))} placeholder="Jubilación, vivienda, estudios..."/></div>
    <div style={{marginBottom:14}}><div style={{fontSize:11,color:MUT,marginBottom:4}}>Notas</div>
      <input value={form.notas} onChange={e=>setForm(p=>({...p,notas:e.target.value}))} placeholder="Cualquier información relevante..."/></div>
    <button onClick={save} style={{width:"100%",padding:"13px",borderRadius:12,background:saved?GRN:`linear-gradient(135deg,${ACC},#922b21)`,color:"#fff",fontSize:14,fontWeight:700}}>
      {saved?"✓ Guardado":"💾 Guardar datos"}
    </button>
    <div style={{fontSize:10,color:MUT,textAlign:"center",marginTop:6}}>Guardado localmente en este dispositivo</div>
  </div>;
}

// ── TOOLS TAB ─────────────────────────────────────────────────────────────────
function ToolsTab({initTool="profile",masterMode=false}){
  const [tool,setTool]=useState(initTool);
  useEffect(()=>{setTool(initTool);},[initTool]);

  const QUESTIONS=[
    {q:"¿Cuál es tu horizonte de inversión?",opts:["Menos de 1 año","1 a 3 años","3 a 5 años","Más de 5 años"],pts:[0,1,2,3]},
    {q:"¿Cómo reaccionarías si tu inversión cae un 20%?",opts:["Vendo todo inmediatamente","Me preocupa mucho","Lo acepto si es temporal","Es una oportunidad de comprar más"],pts:[0,1,2,3]},
    {q:"¿Cuál es tu objetivo principal?",opts:["Preservar el capital","Ingresos regulares","Crecimiento moderado","Máximo crecimiento"],pts:[0,1,2,3]},
    {q:"¿Tienes experiencia invirtiendo?",opts:["Ninguna","Fondos y depósitos","Acciones y ETFs","Derivados y productos complejos"],pts:[0,1,2,3]},
    {q:"¿Qué parte de tus ahorros puedes invertir?",opts:["Menos del 10%","10% - 25%","25% - 50%","Más del 50%"],pts:[0,1,2,3]},
    {q:"¿Necesitas liquidez en los próximos 2 años?",opts:["Sí, todo lo invertido","Sí, más de la mitad","Solo una pequeña parte","No necesito liquidez"],pts:[0,1,2,3]},
  ];
  const PROFILES=[
    {name:"Conservador",range:[0,6],color:"#2980b9",ico:"🛡️",desc:"Prioriza la seguridad del capital.",alloc:{renta_fija:70,monetario:20,renta_variable:10}},
    {name:"Moderado",range:[7,11],color:"#27ae60",ico:"⚖️",desc:"Equilibrio entre seguridad y crecimiento.",alloc:{renta_fija:40,monetario:10,renta_variable:50}},
    {name:"Dinámico",range:[12,15],color:"#e67e22",ico:"🚀",desc:"Acepta volatilidad a cambio de mayor rentabilidad.",alloc:{renta_fija:20,monetario:5,renta_variable:75}},
    {name:"Agresivo",range:[16,18],color:"#c0392b",ico:"🔥",desc:"Máximo potencial de crecimiento.",alloc:{renta_fija:5,monetario:0,renta_variable:95}},
  ];
  const [answers,setAnswers]=useState({});
  const [showResult,setShowResult]=useState(false);
  const total=Object.values(answers).reduce((s,v)=>s+v,0);
  const profile=PROFILES.find(p=>total>=p.range[0]&&total<=p.range[1])||PROFILES[0];
  const completed=Object.keys(answers).length===QUESTIONS.length;

  const [capital,setCapital]=useState("10000");
  const [rate,setRate]=useState("7");
  const [years,setYears]=useState("20");
  const [monthly,setMonthly]=useState("0");
  const YEAR_OPTIONS=[5,10,15,20,25,30,50,100];
  const calcData=[];
  let acc=parseFloat(capital)||0;
  const r=((parseFloat(rate)||0)/100)/12;
  const m=parseFloat(monthly)||0;
  const yrs=Math.min(parseInt(years)||20,100);
  for(let y=0;y<=yrs;y++){
    calcData.push({year:y,valor:Math.round(acc),aportado:Math.round(parseFloat(capital||0)+m*12*y),rentabilidad:Math.round(acc-(parseFloat(capital||0)+m*12*y))});
    for(let mo=0;mo<12;mo++){acc=acc*(1+r)+m;}
  }
  const final=calcData[calcData.length-1]?.valor||0;
  const totalAportado=calcData[calcData.length-1]?.aportado||0;
  const rentabilidad=final-totalAportado;

  return <div className="su">
    <div style={{display:"flex",gap:5,marginBottom:16,flexWrap:"wrap"}}>
    {[["datos","👤"],["profile","🧠"],["calculator","📐"],["screener","🔎"],["watchlist","⭐"],["analyses","📄"]].map(([v,ico])=>(      
        <button key={v} onClick={()=>setTool(v)} style={{width:40,height:40,borderRadius:9,background:tool===v?ACC:"transparent",border:`1.5px solid ${tool===v?ACC:BOR}`,fontSize:20,display:"flex",alignItems:"center",justifyContent:"center",color:tool===v?"#fff":MUT}}>
          {ico}
        </button>
      ))}
    </div>

    {tool==="datos"&&<DatosClienteView/>}
    {tool==="screener"&&<ScreenerView/>}
    {tool==="watchlist"&&<WatchlistView/>}
    {tool==="analyses"&&<AnalysesView isMaster={masterMode}/>}
```

Guarda y haz push:
```
git add src\App.js
    {tool==="profile"&&<>
      {!showResult&&<>
        <div className="title" style={{fontSize:11,color:ACC,fontWeight:700,textTransform:"uppercase",letterSpacing:".06em",marginBottom:14}}>Test de perfil inversor</div>
        {QUESTIONS.map((q,qi)=>(
          <Card key={qi} style={{marginBottom:10}}>
            <div style={{fontSize:13,fontWeight:700,marginBottom:12,lineHeight:1.4}}>{qi+1}. {q.q}</div>
            {q.opts.map((opt,oi)=>(
              <button key={oi} onClick={()=>setAnswers(a=>({...a,[qi]:q.pts[oi]}))} style={{width:"100%",padding:"10px 14px",borderRadius:8,marginBottom:6,textAlign:"left",fontSize:12,background:answers[qi]===q.pts[oi]?ACC+"33":SRF,border:`1.5px solid ${answers[qi]===q.pts[oi]?ACC:BOR}`,color:answers[qi]===q.pts[oi]?TXT:MUT,fontWeight:answers[qi]===q.pts[oi]?700:400}}>
                {answers[qi]===q.pts[oi]&&"✓ "}{opt}
              </button>
            ))}
          </Card>
        ))}
        <button onClick={()=>setShowResult(true)} disabled={!completed} style={{width:"100%",padding:"14px",borderRadius:12,background:completed?`linear-gradient(135deg,${ACC},#922b21)`:"#333",color:"#fff",fontSize:14,fontWeight:700,marginTop:4,opacity:completed?1:.5}}>
          {completed?"Ver mi perfil inversor →":"Responde todas las preguntas"}
        </button>
      </>}
      {showResult&&<>
        <div style={{background:`linear-gradient(135deg,${profile.color},${profile.color}88)`,borderRadius:16,padding:"24px 20px",textAlign:"center",marginBottom:16}}>
          <div style={{fontSize:48,marginBottom:8}}>{profile.ico}</div>
          <div className="title" style={{fontSize:28,fontWeight:900,color:"#fff"}}>{profile.name}</div>
          <div style={{fontSize:13,color:"rgba(255,255,255,0.85)",marginTop:8,lineHeight:1.5}}>{profile.desc}</div>
          <div style={{fontSize:11,color:"rgba(255,255,255,0.6)",marginTop:6}}>Puntuación: {total}/18</div>
        </div>
        <Card style={{marginBottom:14}}>
          <div className="title" style={{fontSize:11,fontWeight:700,color:ACC,marginBottom:14}}>DISTRIBUCIÓN RECOMENDADA</div>
          {Object.entries(profile.alloc).map(([k,v])=>{
            const labels={renta_fija:"Renta Fija",monetario:"Monetario/Liquidez",renta_variable:"Renta Variable"};
            const colors={renta_fija:"#2980b9",monetario:"#27ae60",renta_variable:"#c0392b"};
            return <div key={k} style={{marginBottom:12}}>
              <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}><span style={{fontSize:13}}>{labels[k]}</span><span className="title" style={{fontSize:14,fontWeight:800,color:colors[k]}}>{v}%</span></div>
              <Pbar val={v} max={100} color={colors[k]} h={10}/>
            </div>;
          })}
        </Card>
        <button onClick={()=>{setShowResult(false);setAnswers({});}} style={{width:"100%",padding:"12px",borderRadius:10,background:SRF,color:MUT,fontSize:13,fontWeight:700,border:`1px solid ${BOR}`}}>🔄 Repetir test</button>
      </>}
    </>}

    {tool==="calculator"&&<>
      <div className="title" style={{fontSize:11,color:ACC,fontWeight:700,textTransform:"uppercase",letterSpacing:".06em",marginBottom:14}}>Calculadora de interés compuesto</div>
      <Card style={{marginBottom:14}}>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:4}}>
          {[["Capital inicial (€)",capital,setCapital],["Rent. anual (%)",rate,setRate],["Aportación mensual (€)",monthly,setMonthly]].map(([label,val,setter])=>(
            <div key={label}>
              <div style={{fontSize:11,color:MUT,marginBottom:4}}>{label}</div>
              <input type="number" value={val} onChange={e=>setter(e.target.value)} placeholder="0"/>
            </div>
          ))}
          <div>
            <div style={{fontSize:11,color:MUT,marginBottom:4}}>Años</div>
            <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>
              {YEAR_OPTIONS.map(y=>(
                <button key={y} onClick={()=>setYears(String(y))} style={{padding:"4px 8px",borderRadius:6,background:parseInt(years)===y?ACC:SRF,border:`1px solid ${parseInt(years)===y?ACC:BOR}`,color:parseInt(years)===y?"#fff":MUT,fontSize:11,fontWeight:700}}>
                  {y}
                </button>
              ))}
            </div>
          </div>
        </div>
      </Card>

      {/* Results summary */}
      <div style={{background:`linear-gradient(135deg,${ACC},#922b21)`,borderRadius:16,padding:"18px 16px",marginBottom:14,textAlign:"center"}}>
        <div style={{fontSize:10,color:"rgba(255,255,255,0.7)",textTransform:"uppercase",letterSpacing:".08em",marginBottom:4}}>Capital final tras {years} años</div>
        <div className="title" style={{fontSize:32,fontWeight:900,color:"#fff",fontFamily:"monospace"}}>{f(final)}</div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginTop:12}}>
          <div style={{background:"rgba(0,0,0,0.2)",borderRadius:8,padding:"8px 6px"}}>
            <div style={{fontSize:9,color:"rgba(255,255,255,0.6)"}}>Capital inicial</div>
            <div style={{fontSize:13,fontWeight:700,color:"#fff",fontFamily:"monospace"}}>{f(parseFloat(capital)||0)}</div>
          </div>
          <div style={{background:"rgba(0,0,0,0.2)",borderRadius:8,padding:"8px 6px"}}>
            <div style={{fontSize:9,color:"rgba(255,255,255,0.6)"}}>Total aportado</div>
            <div style={{fontSize:13,fontWeight:700,color:"#fff",fontFamily:"monospace"}}>{f(totalAportado)}</div>
          </div>
          <div style={{background:"rgba(0,0,0,0.2)",borderRadius:8,padding:"8px 6px"}}>
            <div style={{fontSize:9,color:"rgba(255,255,255,0.6)"}}>Rentabilidad</div>
            <div style={{fontSize:13,fontWeight:700,color:"#27ae60",fontFamily:"monospace"}}>{f(rentabilidad)}</div>
          </div>
        </div>
      </div>

      {/* Line chart */}
      <Card style={{marginBottom:14}}>
        <div className="title" style={{fontSize:11,fontWeight:700,color:ACC,marginBottom:4}}>EVOLUCIÓN DEL CAPITAL</div>
        <div style={{display:"flex",gap:12,marginBottom:10,fontSize:10}}>
          <div style={{display:"flex",alignItems:"center",gap:4}}><div style={{width:12,height:3,background:ACC,borderRadius:2}}/><span style={{color:MUT}}>Capital total</span></div>
          <div style={{display:"flex",alignItems:"center",gap:4}}><div style={{width:12,height:3,background:BOR,borderRadius:2,borderTop:`2px dashed ${MUT}`}}/><span style={{color:MUT}}>Capital aportado</span></div>
        </div>
        <ResponsiveContainer width="100%" height={240}>
          <LineChart data={calcData} margin={{left:-10,right:4,top:4,bottom:0}}
            onClick={d=>{}}>
            <XAxis dataKey="year" tick={{fill:MUT,fontSize:10}} axisLine={false} tickLine={false} tickFormatter={v=>"Año "+v} interval={Math.max(1,Math.floor(yrs/6))}/>
            <YAxis tick={{fill:MUT,fontSize:9}} axisLine={false} tickLine={false} tickFormatter={fk} domain={["auto","auto"]}/>
            <Tooltip
              contentStyle={{background:CARD,border:`1px solid ${BOR}`,borderRadius:8,fontSize:11}}
              formatter={(value,name)=>[f(value),name]}
              labelFormatter={v=>`Año ${v}`}
            />
            <ReferenceLine y={0} stroke={BOR} strokeDasharray="4 4"/>
            {/* Filled area under curve */}
            <Line type="monotone" dataKey="aportado" name="Capital aportado" stroke={MUT} strokeWidth={1.5} strokeDasharray="5 3" dot={false} activeDot={{r:4,fill:MUT}}/>
            <Line type="monotone" dataKey="valor" name="Capital total" stroke={ACC} strokeWidth={2.5} dot={false} activeDot={{r:5,fill:ACC,stroke:"#fff",strokeWidth:2}}/>
          </LineChart>
        </ResponsiveContainer>
      </Card>

      {/* Annual table - key milestones */}
      <Card>
        <div className="title" style={{fontSize:11,fontWeight:700,color:ACC,marginBottom:10}}>HITOS CLAVE</div>
        {[5,10,15,20,25,30,40,50,yrs].filter((v,i,a)=>v<=yrs&&a.indexOf(v)===i).map(yr=>{
          const d=calcData[yr];
          if(!d)return null;
          const mult=d.aportado>0?d.valor/d.aportado:0;
          return <div key={yr} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"7px 0",borderBottom:`1px solid ${BOR}22`}}>
            <span style={{fontSize:12,fontWeight:700,color:MUT}}>Año {yr}</span>
            <div style={{display:"flex",gap:12,textAlign:"right"}}>
              <div><div style={{fontSize:9,color:MUT}}>Aportado</div><div style={{fontSize:11,fontFamily:"monospace",color:MUT}}>{f(d.aportado)}</div></div>
              <div><div style={{fontSize:9,color:MUT}}>Valor</div><div style={{fontSize:11,fontFamily:"monospace",color:ACC,fontWeight:700}}>{f(d.valor)}</div></div>
              <div><div style={{fontSize:9,color:MUT}}>×</div><div style={{fontSize:11,fontFamily:"monospace",color:GRN,fontWeight:700}}>{mult.toFixed(1)}x</div></div>
            </div>
          </div>;
        })}
      </Card>
    </>}
  </div>;
}

// ── MARKETS TAB ────────────────────────────────────────────────────────────────
const FUTURES_MAP={"^IBEX":"IBE.MC","^GDAXI":"FDAX=F","^FCHI":"FCE=F","^FTSE":"Z=F","^GSPC":"ES=F","^IXIC":"NQ=F","^DJI":"YM=F","^N225":"NK=F"};
const INDEX_MEMBERS_MAP={
  "^IBEX":["SAN.MC","BBVA.MC","ITX.MC","TEF.MC","REP.MC","IBE.MC","ACS.MC","CABK.MC","FER.MC","MAP.MC","ANA.MC","ELE.MC","ENG.MC","IAG.MC","SAB.MC"],
  "^GDAXI":["SAP.DE","SIE.DE","ALV.DE","DTE.DE","MRK.DE","BAYN.DE","BAS.DE","DBK.DE","BMW.DE","VOW3.DE","ADS.DE","MBG.DE","EOAN.DE","RWE.DE","HEN3.DE"],
  "^FCHI":["MC.PA","OR.PA","TTE.PA","SAN.PA","BNP.PA","AIR.PA","RI.PA","KER.PA","DSY.PA","ACA.PA","DG.PA"],
  "^FTSE":["SHEL.L","AZN.L","HSBA.L","ULVR.L","BP.L","RIO.L","GSK.L","BATS.L","REL.L","NG.L","LSEG.L","VOD.L","LLOY.L"],
  "^GSPC":["AAPL","MSFT","NVDA","AMZN","GOOGL","META","TSLA","AVGO","JPM","LLY","V","XOM","UNH","MA","JNJ","PG","COST","HD","MRK"],
  "^IXIC":["AAPL","MSFT","NVDA","AMZN","META","TSLA","GOOGL","AVGO","NFLX","ADBE","CSCO","AMD","INTC","INTU","TXN","QCOM","AMGN"],
  "^DJI":["AAPL","MSFT","UNH","GS","HD","MCD","AMGN","V","CAT","BA","AXP","TRV","JPM","IBM","JNJ","CRM","MRK","DIS","NKE"],
  "^N225":["7203.T","6758.T","9984.T","6861.T","8306.T","4063.T","9432.T","7267.T","9983.T"],
  "^HSI":["0700.HK","0939.HK","1299.HK","0005.HK","3690.HK","0941.HK","1398.HK","2318.HK","0388.HK"],
  "^STOXX50E":["ASML.AS","MC.PA","SAP.DE","ALV.DE","SIE.DE","TTE.PA","DTE.DE","MRK.DE","BNP.PA","BAYN.DE"],
};
const ALL_ASSETS=[
  {sym:"^IBEX",    name:"IBEX 35",       flag:"🇪🇸",group:"🇪🇺 Europa",  hasMembers:true},
  {sym:"^GDAXI",   name:"DAX 40",         flag:"🇩🇪",group:"🇪🇺 Europa",  hasMembers:true},
  {sym:"^FCHI",    name:"CAC 40",         flag:"🇫🇷",group:"🇪🇺 Europa",  hasMembers:true},
  {sym:"^FTSE",    name:"FTSE 100",       flag:"🇬🇧",group:"🇪🇺 Europa",  hasMembers:true},
  {sym:"^STOXX50E",name:"Euro Stoxx 50",  flag:"🇪🇺",group:"🇪🇺 Europa",  hasMembers:true},
  {sym:"^AEX",     name:"AEX",            flag:"🇳🇱",group:"🇪🇺 Europa",  hasMembers:false},
  {sym:"^GSPC",    name:"S&P 500",        flag:"🇺🇸",group:"🇺🇸 EEUU",    hasMembers:true},
  {sym:"^IXIC",    name:"Nasdaq 100",     flag:"🇺🇸",group:"🇺🇸 EEUU",    hasMembers:true},
  {sym:"^DJI",     name:"Dow Jones",      flag:"🇺🇸",group:"🇺🇸 EEUU",    hasMembers:true},
  {sym:"^RUT",     name:"Russell 2000",   flag:"🇺🇸",group:"🇺🇸 EEUU",    hasMembers:false},
  {sym:"^N225",    name:"Nikkei 225",     flag:"🇯🇵",group:"🌏 Asia",     hasMembers:true},
  {sym:"^HSI",     name:"Hang Seng",      flag:"🇭🇰",group:"🌏 Asia",     hasMembers:true},
  {sym:"000001.SS",name:"Shanghai",       flag:"🇨🇳",group:"🌏 Asia",     hasMembers:false},
  {sym:"GC=F",     name:"Oro",            flag:"🥇",group:"🛢️ Materias", hasMembers:false},
  {sym:"SI=F",     name:"Plata",          flag:"⚪",group:"🛢️ Materias", hasMembers:false},
  {sym:"CL=F",     name:"Petróleo WTI",   flag:"🛢️",group:"🛢️ Materias", hasMembers:false},
  {sym:"BZ=F",     name:"Petróleo Brent", flag:"🛢️",group:"🛢️ Materias", hasMembers:false},
  {sym:"NG=F",     name:"Gas Natural",    flag:"🔥",group:"🛢️ Materias", hasMembers:false},
  {sym:"HG=F",     name:"Cobre",          flag:"🟤",group:"🛢️ Materias", hasMembers:false},
  {sym:"EURUSD=X", name:"EUR/USD",        flag:"💶",group:"💱 Divisas",  hasMembers:false},
  {sym:"EURGBP=X", name:"EUR/GBP",        flag:"💷",group:"💱 Divisas",  hasMembers:false},
  {sym:"EURJPY=X", name:"EUR/JPY",        flag:"💴",group:"💱 Divisas",  hasMembers:false},
  {sym:"EURCHF=X", name:"EUR/CHF",        flag:"🇨🇭",group:"💱 Divisas",  hasMembers:false},
  {sym:"BTC-USD",  name:"Bitcoin",        flag:"₿", group:"🪙 Cripto",   hasMembers:false},
  {sym:"ETH-USD",  name:"Ethereum",       flag:"Ξ", group:"🪙 Cripto",   hasMembers:false},
  {sym:"SOL-USD",  name:"Solana",         flag:"◎", group:"🪙 Cripto",   hasMembers:false},
  {sym:"BNB-USD",  name:"BNB",            flag:"🟡",group:"🪙 Cripto",   hasMembers:false},
  {sym:"XRP-USD",  name:"XRP",            flag:"✕", group:"🪙 Cripto",   hasMembers:false},
  {sym:"AVAX-USD", name:"Avalanche",      flag:"🔺",group:"🪙 Cripto",   hasMembers:false},
  {sym:"DOGE-USD", name:"Dogecoin",       flag:"🐕",group:"🪙 Cripto",   hasMembers:false},
  {sym:"^TNX",     name:"Bono EEUU 10Y",  flag:"🇺🇸",group:"📄 Renta Fija",hasMembers:false},
  {sym:"^TYX",     name:"Bono EEUU 30Y",  flag:"🇺🇸",group:"📄 Renta Fija",hasMembers:false},
  {sym:"^FVX",     name:"Bono EEUU 5Y",   flag:"🇺🇸",group:"📄 Renta Fija",hasMembers:false},
  {sym:"^IRX",     name:"T-Bill 3M",       flag:"🇺🇸",group:"📄 Renta Fija",hasMembers:false},
  {sym:"DE10YB=RR",name:"Bono Alemania 10Y",flag:"🇩🇪",group:"📄 Renta Fija",hasMembers:false},
  {sym:"ES10YB=RR",name:"Bono España 10Y", flag:"🇪🇸",group:"📄 Renta Fija",hasMembers:false},
  {sym:"IT10YB=RR",name:"Bono Italia 10Y", flag:"🇮🇹",group:"📄 Renta Fija",hasMembers:false},
  {sym:"FR10YB=RR",name:"Bono Francia 10Y",flag:"🇫🇷",group:"📄 Renta Fija",hasMembers:false},
];
const PERF_PERIODS=[
  {key:"1d",label:"1D"},{key:"1w",label:"1S"},{key:"1m",label:"1M"},
  {key:"3m",label:"3M"},{key:"6m",label:"6M"},{key:"ytd",label:"YTD"},
  {key:"1y",label:"1A"},{key:"3y",label:"3A"},{key:"5y",label:"5A"},{key:"10y",label:"10A"},
];
const TECH_FREQS=[{key:"5m",label:"5m"},{key:"1h",label:"1h"},{key:"1d",label:"1D"},{key:"1w",label:"1S"},{key:"1mo",label:"1M"}];
const SIG={"Compra fuerte":{c:"#27ae60",bg:"#27ae6018",s:"↑↑"},"Compra":{c:"#2ecc71",bg:"#2ecc7118",s:"↑"},"Neutral":{c:"#95a5a6",bg:"#95a5a618",s:"→"},"Venta":{c:"#e67e22",bg:"#e67e2218",s:"↓"},"Venta fuerte":{c:"#c0392b",bg:"#c0392b18",s:"↓↓"}};
const IND_LABEL={rsi:"RSI(14)",macd:"MACD",bollinger:"Bollinger",stochastic:"Estocástico",williams:"Williams %R",roc:"ROC(12)",ema9_21:"EMA 9/21",ema50:"EMA 50",ema200:"EMA 200"};

function PerfBadge({val}){
  if(val==null)return <span style={{fontSize:9,color:MUT,display:"block",textAlign:"center"}}>—</span>;
  const c=val>=0?GRN:RED;
  return <span style={{fontSize:9,fontWeight:700,color:c,background:c+"18",borderRadius:3,padding:"1px 3px",fontFamily:"monospace",whiteSpace:"nowrap",display:"block",textAlign:"center"}}>{val>=0?"+":""}{val.toFixed(1)}%</span>;
}
function ScoreBar({score}){
  const cols=["#c0392b","#e67e22","#95a5a6","#2ecc71","#27ae60"];
  return <div style={{display:"flex",gap:1,marginTop:2}}>{[1,2,3,4,5].map(i=><div key={i} style={{flex:1,height:3,borderRadius:1,background:i<=(score||3)?cols[(score||3)-1]:BOR}}/>)}</div>;
}
function fmtMktPrice(sym,price,prev){
  if(!price)return{p:"—",ch:"—",pct:null};
  const ch=price-(prev||price),pct=(prev&&prev>0)?(ch/prev)*100:0;
  let p;
  const isCrypto=sym.includes("-USD");
  const isForex=sym.includes("=X")&&!isCrypto;
  if(isForex)p=price.toFixed(4);
  else if(isCrypto&&price>1000)p=price.toLocaleString("es-ES",{maximumFractionDigits:0});
  else if(isCrypto&&price>1)p=price.toFixed(2);
  else if(isCrypto)p=price.toFixed(6);
  else if(price>10000)p=price.toLocaleString("es-ES",{maximumFractionDigits:0});
  else if(price>100)p=price.toLocaleString("es-ES",{minimumFractionDigits:2,maximumFractionDigits:2});
  else if(price<1)p=price.toFixed(4);
  else p=price.toFixed(2);
  return{p,ch:(ch>=0?"+":"")+ch.toFixed(2),pct};
}

function MembersDrawer({sym,onClose}){
  const [prices,setPrices]=useState({});
  const [perf,setPerf]=useState({});
  const [loading,setLoading]=useState(true);
  const [memberDetail,setMemberDetail]=useState(null);
  const members=INDEX_MEMBERS_MAP[sym]||[];
  useEffect(()=>{
    if(!members.length){setLoading(false);return;}
    const syms=members.join(",");
    Promise.all([
      fetch(`/api/market?symbols=${encodeURIComponent(syms)}`).then(r=>r.ok?r.json():{}),
      fetch(`/api/market?symbols=${encodeURIComponent(syms)}&mode=perf_bulk`).then(r=>r.ok?r.json():{}),
    ]).then(([p,pf])=>{setPrices(p);setPerf(pf);}).catch(()=>{}).finally(()=>setLoading(false));
  },[sym]);
  return <BottomSheet title={`📋 ${sym}`} onClose={onClose}>
    {memberDetail&&<AssetDetailCard sym={memberDetail.sym} name={memberDetail.name} onClose={()=>setMemberDetail(null)}/>}
    <div style={{padding:"0 16px 80px"}}>
      {loading?<div style={{textAlign:"center",padding:32,color:MUT}}>⏳ Cargando...</div>:
      !members.length?<div style={{textAlign:"center",padding:24,color:MUT}}>Sin datos disponibles</div>:
      <>
        <div style={{display:"flex",gap:4,padding:"6px 0",borderBottom:`1px solid ${BOR}`,marginBottom:4}}>
          <div style={{flex:1,fontSize:9,color:MUT,fontWeight:700}}>ACTIVO</div>
          <div style={{width:55,textAlign:"right",fontSize:9,color:MUT,fontWeight:700}}>PRECIO</div>
          {PERF_PERIODS.map(({label})=><div key={label} style={{width:32,textAlign:"center",fontSize:8,color:MUT,fontWeight:700,flexShrink:0}}>{label}</div>)}
        </div>
        {members.map(msym=>{
          const d=prices[msym],pf=perf[msym];
          const{p,pct}=fmtMktPrice(msym,d?.price,d?.prev);
          return <div key={msym} onClick={()=>setMemberDetail({sym:msym,name:msym.replace(/\.(MC|DE|PA|L|AS)$/,"")})} style={{display:"flex",alignItems:"center",gap:4,padding:"5px 0",borderBottom:`1px solid ${BOR}22`,cursor:"pointer"}}>
            <div style={{flex:1,fontSize:11,fontWeight:700,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{msym.replace(/\.(MC|DE|PA|L|AS)$/,"")}</div>
            <div style={{width:55,textAlign:"right"}}>
              <div style={{fontSize:10,fontFamily:"monospace"}}>{p}</div>
              {pct!=null&&<div style={{fontSize:8,color:pct>=0?GRN:RED,fontWeight:700}}>{pct>=0?"+":""}{pct.toFixed(1)}%</div>}
            </div>
            {PERF_PERIODS.map(({key})=><div key={key} style={{width:32,textAlign:"center",flexShrink:0}}><PerfBadge val={pf?.[key]}/></div>)}
          </div>;
        })}
      </>}
    </div>
  </BottomSheet>;
}

function AssetRow({item,priceData,perfData,perfLoading,mode,isFirstInGroup,showPerfHeader}){
  const [techData,setTechData]=useState(null);
  const [loadingTech,setLoadingTech]=useState(false);
  const [selFreq,setSelFreq]=useState("1d");
  const [showMembers,setShowMembers]=useState(false);
  const [showDetail,setShowDetail]=useState(false);
  const d=priceData;
  const{p,ch,pct}=fmtMktPrice(item.sym,d?.price,d?.prev);

  useEffect(()=>{
    if(mode==="tech"&&!techData&&!loadingTech){
      setLoadingTech(true);
      const delay=Math.floor(Math.random()*1500);
      const tid=setTimeout(()=>{
        fetch("/api/technical",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({sym:item.sym})})
          .then(r=>r.ok?r.json():null).then(data=>{if(data)setTechData(data.signals);})
          .catch(()=>{}).finally(()=>setLoadingTech(false));
      },delay);
      return()=>clearTimeout(tid);
    }
  },[mode]);

  const freqData=techData?.[selFreq];
  const sigM=freqData?SIG[freqData.signal]||SIG["Neutral"]:null;

  return <>
    {showMembers&&<MembersDrawer sym={item.sym} onClose={()=>setShowMembers(false)}/>}
    {showDetail&&<AssetDetailCard sym={item.sym} name={item.name} onClose={()=>setShowDetail(false)}/>}
    {isFirstInGroup&&<div style={{padding:"10px 0 4px",marginTop:4}}>
      <span style={{fontSize:10,fontWeight:800,color:MUT,textTransform:"uppercase",letterSpacing:".08em"}}>{item.group}</span>
    </div>}
    <div style={{paddingBottom:10,marginBottom:2,borderBottom:`1px solid ${BOR}22`}}>
      <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:6,cursor:"pointer"}} onClick={()=>setShowDetail(true)}>
        <span style={{fontSize:16,lineHeight:1,flexShrink:0}}>{item.flag}</span>
        <div style={{flex:1,minWidth:0}}>
          <div style={{display:"flex",alignItems:"center",gap:4}}>
            <span style={{fontSize:12,fontWeight:800,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{item.name}</span>
            <div onClick={e=>e.stopPropagation()}><StarButton sym={item.sym} name={item.name} size={12}/></div>
            {item.hasMembers&&<button onClick={e=>{e.stopPropagation();setShowMembers(true);}} style={{fontSize:10,color:MUT,background:SRF,border:`1px solid ${BOR}`,borderRadius:4,padding:"0 4px",lineHeight:"16px",flexShrink:0}}>📋</button>}
          </div>
          <div style={{fontSize:9,color:MUT}}>{item.sym}</div>
        </div>
        <div style={{textAlign:"right",flexShrink:0}}>
          <div style={{fontSize:14,fontWeight:800,fontFamily:"monospace",color:d?TXT:MUT}}>{p}</div>
          {d&&pct!=null&&<div style={{fontSize:10,color:pct>=0?GRN:RED,fontWeight:700}}>{pct>=0?"+":""}{pct.toFixed(2)}%</div>}
        </div>
      </div>

      {mode==="perf"&&<>
        {perfLoading?<div style={{fontSize:9,color:MUT}}>⏳</div>:
        perfData?<>
          {/* 2 rows of 5 badges each - fits perfectly on mobile */}
          <div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:2,marginBottom:2}}>
            {PERF_PERIODS.slice(0,5).map(({key})=><div key={key} style={{textAlign:"center"}}><PerfBadge val={perfData[key]}/></div>)}
          </div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:2}}>
            {PERF_PERIODS.slice(5,10).map(({key})=><div key={key} style={{textAlign:"center"}}><PerfBadge val={perfData[key]}/></div>)}
          </div>
        </>:<div style={{fontSize:9,color:MUT}}>Sin datos</div>}
      </>}

      {mode==="tech"&&<>
        {loadingTech?<div style={{fontSize:9,color:MUT,padding:"4px 0"}}>⏳ Calculando...</div>:
        techData?<>
          <div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:3,marginBottom:5}}>
            {TECH_FREQS.map(({key,label})=>{
              const fd=techData[key];
              const m=fd?SIG[fd.signal]||SIG["Neutral"]:null;
              const sel=selFreq===key;
              return <button key={key} onClick={()=>setSelFreq(key)} style={{padding:"5px 2px",borderRadius:6,background:sel?(m?m.bg:"#ffffff18"):BOR,border:`1.5px solid ${sel?(m?m.c:ACC):"transparent"}`,cursor:"pointer",textAlign:"center"}}>
                <div style={{fontSize:8,color:MUT,fontWeight:700}}>{label}</div>
                {fd&&m?<><div style={{fontSize:12,fontWeight:900,color:m.c,lineHeight:1.1}}>{m.s}</div><div style={{fontSize:7,color:m.c,fontWeight:700}}>{fd.signal.replace(" fuerte","")}</div><ScoreBar score={fd.score}/></>:<div style={{fontSize:8,color:MUT}}>—</div>}
              </button>;
            })}
          </div>
          {freqData&&<>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"3px 8px",background:sigM?sigM.bg:SRF,borderRadius:6,marginBottom:3,border:`1px solid ${sigM?sigM.c+"33":BOR}`}}>
              <span style={{fontSize:11,fontWeight:800,color:sigM?.c||TXT}}>{sigM?.s} {freqData.signal}</span>
              <span style={{fontSize:9,color:MUT}}>▲{freqData.buyVotes}·{freqData.neutralVotes}·▼{freqData.sellVotes}</span>
            </div>
            <div style={{display:"flex",flexDirection:"column",gap:2}}>
              {Object.entries(freqData.indicators||{}).map(([k,ind])=>{
                const isBuy=ind.signal==="Compra",isSell=ind.signal==="Venta";
                const c=isBuy?GRN:isSell?RED:MUT;
                return <div key={k} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"2px 6px",background:c+"0d",borderRadius:4}}>
                  <span style={{fontSize:9,color:MUT,flex:1}}>{IND_LABEL[k]||k}</span>
                  <span style={{fontSize:8,color:MUT,fontFamily:"monospace",marginRight:4}}>{ind.value}</span>
                  <span style={{fontSize:9,fontWeight:700,color:c}}>{ind.signal}</span>
                </div>;
              })}
            </div>
          </>}
        </>:<div style={{fontSize:9,color:MUT}}>Sin datos técnicos</div>}
      </>}
    </div>
  </>;
}

function MarketsTab(){
  const [mode,setMode]=useState("perf");
  const [filter,setFilter]=useState("all");
  const [prices,setPrices]=useState({});
  const [allPerf,setAllPerf]=useState({});
  const [loadingPrices,setLoadingPrices]=useState(false);
  const [loadingPerf,setLoadingPerf]=useState(false);
  const [lastUpdate,setLastUpdate]=useState(null);

  const FILTERS=[{key:"all",label:"Todo"},{key:"europa",label:"🇪🇺"},{key:"eeuu",label:"🇺🇸"},{key:"asia",label:"🌏"},{key:"mat",label:"🛢️"},{key:"div",label:"💱"},{key:"cripto",label:"🪙"},{key:"rf",label:"📄"}];

  const filtered=filter==="all"?ALL_ASSETS:ALL_ASSETS.filter(a=>{
    if(filter==="europa")return a.group.includes("Europa");
    if(filter==="eeuu")return a.group.includes("EEUU");
    if(filter==="asia")return a.group.includes("Asia");
    if(filter==="mat")return a.group.includes("Materias");
    if(filter==="div")return a.group.includes("Divisas");
    if(filter==="cripto")return a.group.includes("Cripto");
    if(filter==="rf")return a.group.includes("Renta");
    return true;
  });

  async function loadAll(){
    const syms=ALL_ASSETS.map(a=>a.sym).join(",");
    setLoadingPrices(true);setLoadingPerf(true);
    try{
      const[pr,pe]=await Promise.all([
        fetch(`/api/market?symbols=${encodeURIComponent(syms)}`),
        fetch(`/api/market?symbols=${encodeURIComponent(syms)}&mode=perf_bulk`)
      ]);
      if(pr.ok){const d=await pr.json();setPrices(d);}
      if(pe.ok){const d=await pe.json();setAllPerf(d);}
      setLastUpdate(new Date().toLocaleTimeString("es-ES",{hour:"2-digit",minute:"2-digit"}));
    }catch(e){}
    setLoadingPrices(false);setLoadingPerf(false);
  }

  useEffect(()=>{loadAll();},[]);

  let lastGroup="";
  return <div className="su">
    <div style={{display:"flex",gap:4,marginBottom:10,overflowX:"auto",paddingBottom:2}}>
      {FILTERS.map(({key,label})=>(
        <button key={key} onClick={()=>setFilter(key)} style={{flexShrink:0,padding:"5px 10px",borderRadius:8,background:filter===key?ACC:"transparent",border:`1.5px solid ${filter===key?ACC:BOR}`,color:filter===key?"#fff":MUT,fontSize:11,fontWeight:700}}>
          {label}
        </button>
      ))}
    </div>
    <div style={{display:"flex",gap:8,marginBottom:12,alignItems:"center"}}>
      <div style={{display:"flex",background:CARD,borderRadius:8,padding:3,border:`1px solid ${BOR}`,flex:1}}>
        <button onClick={()=>setMode("perf")} style={{flex:1,padding:"7px 0",borderRadius:6,fontSize:12,fontWeight:700,background:mode==="perf"?ACC:"transparent",color:mode==="perf"?"#fff":MUT}}>📈 Performance</button>
        <button onClick={()=>setMode("tech")} style={{flex:1,padding:"7px 0",borderRadius:6,fontSize:12,fontWeight:700,background:mode==="tech"?ACC:"transparent",color:mode==="tech"?"#fff":MUT}}>📐 Técnico</button>
      </div>
      <div style={{display:"flex",gap:6,alignItems:"center"}}>
        {lastUpdate&&<span style={{fontSize:9,color:MUT}}>🕐{lastUpdate}</span>}
        <button onClick={loadAll} disabled={loadingPrices||loadingPerf} style={{width:32,height:32,borderRadius:8,background:ACC+"22",color:ACC,fontSize:14,border:`1px solid ${ACC}44`,display:"flex",alignItems:"center",justifyContent:"center"}}>
          {loadingPrices||loadingPerf?"⏳":"🔄"}
        </button>
      </div>
    </div>
    {loadingPrices&&!Object.keys(prices).length
      ?<Card><div style={{textAlign:"center",padding:32,color:MUT}}>⏳ Cargando datos...</div></Card>
      :<Card style={{padding:"12px 14px"}}>
        {filtered.map((item)=>{
          const isFirstInGroup=item.group!==lastGroup;
          if(isFirstInGroup)lastGroup=item.group;
          return <AssetRow
            key={item.sym+mode}
            item={item}
            priceData={prices[item.sym]}
            perfData={allPerf[item.sym]}
            perfLoading={loadingPerf&&!allPerf[item.sym]}
            mode={mode}
            isFirstInGroup={isFirstInGroup}
            showPerfHeader={mode==="perf"&&isFirstInGroup}
          />;
        })}
      </Card>
    }
    <div style={{fontSize:9,color:MUT,textAlign:"center",marginTop:8}}>Datos Yahoo Finance · No son asesoramiento financiero</div>
  </div>;
}

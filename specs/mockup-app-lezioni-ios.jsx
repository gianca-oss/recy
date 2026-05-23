import React, { useState, useEffect, useRef } from "react";
import {
  Mic, Pause, Play, Square, Bookmark, Search, ChevronLeft, ChevronRight,
  Download, Sparkles, Cloud, CheckCircle2, Circle, MoreHorizontal,
  Volume2, Upload, FileAudio
} from "lucide-react";

// ---- Finto dataset -------------------------------------------------------
const LESSONS = [
  { id:1, title:"Diritto Costituzionale", subtitle:"La separazione dei poteri",
    subject:"Diritto", date:"Oggi", time:"09:14", duration:"1:48:12", sync:"summarized", source:"recording" },
  { id:2, title:"Analisi Matematica II", subtitle:"Integrali multipli",
    subject:"Matematica", date:"Ieri", time:"11:30", duration:"1:12:40", sync:"transcribed", source:"recording" },
  { id:3, title:"Storia Contemporanea", subtitle:"Il dopoguerra europeo (importata)",
    subject:"Storia", date:"Mar 20", time:"14:00", duration:"0:54:03", sync:"transcribed", source:"import" },
  { id:4, title:"Registrazione", subtitle:"Senza titolo",
    subject:null, date:"Mar 19", time:"16:45", duration:"0:08:21", sync:"local_only", source:"recording" },
];

const SUBJECT_COLOR = {
  Diritto:"#6B7280", Matematica:"#52525B", Storia:"#71717A", default:"#9CA3AF",
};
const SYNC_META = {
  local_only:  { label:"Sul dispositivo", Icon:Circle,       tone:"#9CA3AF" },
  uploaded:    { label:"Caricata",         Icon:Cloud,        tone:"#6B7280" },
  transcribed: { label:"Trascritta",       Icon:CheckCircle2, tone:"#3F3F46" },
  summarized:  { label:"Con riassunto",    Icon:Sparkles,     tone:"#18181B" },
};

const TRANSCRIPT = [
  { t:"00:00", spk:"Prof.", text:"Buongiorno a tutti. Oggi affrontiamo uno dei principi cardine dello Stato di diritto: la separazione dei poteri." },
  { t:"00:14", spk:"Prof.", text:"La teoria viene formalizzata da Montesquieu, ma le sue radici affondano già nel pensiero di Locke.", mark:true },
  { t:"00:31", spk:"Prof.", text:"Distinguiamo tre funzioni: legislativa, esecutiva e giudiziaria. Ciascuna affidata a organi distinti." },
  { t:"00:48", spk:"Studente", text:"Professore, questa separazione è mai assoluta nella pratica?" },
  { t:"00:53", spk:"Prof.", text:"Ottima domanda. No, parliamo più correttamente di un sistema di pesi e contrappesi." },
  { t:"01:10", spk:"Prof.", text:"Pensate al potere di veto, o al controllo di costituzionalità: punti di contatto, non muri.", mark:true },
];

// SF-like system font stack
const SF = `-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", "Helvetica Neue", Helvetica, Arial, sans-serif`;

const C = {
  bg:"#F4F4F5",        // neutro grigio chiaro
  card:"#FFFFFF",
  sep:"#E4E4E7",
  label:"#18181B",     // quasi nero
  secondary:"#71717A",
  tertiary:"#C4C4C8",
  blue:"#27272A",      // "accento" = grafite (manteniamo il nome per non rcompromettere i riferimenti)
  blueDim:"#F0F0F1",   // evidenziazione neutra
};

export default function App() {
  const [screen, setScreen] = useState("home");
  const [active, setActive] = useState(LESSONS[0]);

  return (
    <div style={{ minHeight:"100vh", background:"#d8d8dd", display:"flex",
      alignItems:"center", justifyContent:"center", padding:"32px 16px", fontFamily:SF }}>
      <style>{`
        * { box-sizing:border-box; -webkit-tap-highlight-color:transparent; }
        .ph::-webkit-scrollbar { width:0; }
        @keyframes pulseDot { 0%,100%{opacity:1;} 50%{opacity:.3;} }
        @keyframes bar { 0%,100%{transform:scaleY(.25);} 50%{transform:scaleY(1);} }
        @keyframes fade { from{opacity:0; transform:translateY(8px);} to{opacity:1; transform:none;} }
        .fade { animation:fade .45s cubic-bezier(.2,.7,.3,1) both; }
        .tap { transition:transform .1s ease, background .15s ease; cursor:pointer; }
        .tap:active { transform:scale(.985); opacity:.85; }
        .row:active { background:#EAEAEF; }
      `}</style>

      <div style={{ width:340, height:710, background:C.bg, borderRadius:44,
        border:"1px solid #cfcfd4", boxShadow:"0 30px 70px rgba(0,0,0,.35), inset 0 0 0 8px #1a1a1c",
        overflow:"hidden", position:"relative", display:"flex", flexDirection:"column" }}>

        {/* Dynamic Island */}
        <div style={{ position:"absolute", top:9, left:"50%", transform:"translateX(-50%)",
          width:104, height:29, background:"#000", borderRadius:18, zIndex:40 }} />

        {screen==="home" && <Home onRecord={()=>setScreen("record")}
          onImport={()=>setScreen("import")}
          onOpen={(l)=>{setActive(l); setScreen("detail");}} />}
        {screen==="record" && <Record onBack={()=>setScreen("home")} />}
        {screen==="import" && <Import onBack={()=>setScreen("home")} />}
        {screen==="detail" && <Detail lesson={active} onBack={()=>setScreen("home")} />}
      </div>
    </div>
  );
}

// ---- Home (Lista raggruppata stile iOS) ----------------------------------
function Home({ onRecord, onImport, onOpen }) {
  return (
    <div className="ph" style={{ flex:1, overflowY:"auto", color:C.label }}>
      {/* large title */}
      <div style={{ padding:"48px 18px 6px", display:"flex", alignItems:"center",
        justifyContent:"space-between" }}>
        <h1 style={{ fontSize:28, fontWeight:700, letterSpacing:"-.022em", margin:0 }}>Lezioni</h1>
        <button className="tap" onClick={onImport} title="Importa file audio/video"
          style={{ width:40, height:40, borderRadius:11, border:`1px solid ${C.sep}`,
          background:C.card, color:C.blue, display:"flex", alignItems:"center",
          justifyContent:"center", cursor:"pointer", boxShadow:"0 2px 8px rgba(0,0,0,.06)" }}>
          <Upload size={20} />
        </button>
      </div>

      {/* search */}
      <div style={{ padding:"4px 14px 12px" }}>
        <div style={{ display:"flex", alignItems:"center", gap:6, background:"#E8E8EB",
          borderRadius:10, padding:"7px 10px" }}>
          <Search size={15} color={C.secondary} />
          <span style={{ color:C.secondary, fontSize:15 }}>Cerca</span>
        </div>
      </div>

      {/* grouped list */}
      <div style={{ padding:"0 14px 110px" }}>
        <div style={{ fontSize:12, color:C.secondary, textTransform:"uppercase",
          letterSpacing:".03em", padding:"2px 6px 6px", fontWeight:500 }}>Recenti</div>
        <div className="fade" style={{ background:C.card, borderRadius:13, overflow:"hidden" }}>
          {LESSONS.map((l, i) => {
            const s = SYNC_META[l.sync];
            const col = SUBJECT_COLOR[l.subject] || SUBJECT_COLOR.default;
            return (
              <div key={l.id} className="row tap" onClick={()=>onOpen(l)}
                style={{ display:"flex", alignItems:"center", gap:11, padding:"9px 12px",
                borderBottom: i<LESSONS.length-1 ? `0.5px solid ${C.sep}` : "none" }}>
                {/* icon tile */}
                <div style={{ width:36, height:36, borderRadius:9, flexShrink:0,
                  background:`${col}1a`, display:"flex", alignItems:"center", justifyContent:"center" }}>
                  {l.source === "import"
                    ? <FileAudio size={17} color={col} />
                    : <Mic size={17} color={col} />}
                </div>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:15, fontWeight:600, letterSpacing:"-.01em",
                    whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{l.title}</div>
                  <div style={{ fontSize:13, color:C.secondary, marginTop:0,
                    whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{l.subtitle}</div>
                  <div style={{ display:"flex", alignItems:"center", gap:5, marginTop:3,
                    fontSize:11.5, color:s.tone }}>
                    <s.Icon size={11} /> <span style={{ color:C.secondary }}>{l.duration} · {l.date}</span>
                  </div>
                </div>
                <ChevronRight size={16} color={C.tertiary} style={{ flexShrink:0 }} />
              </div>
            );
          })}
        </div>
      </div>

      {/* floating record button */}
      <div style={{ position:"absolute", bottom:0, left:0, right:0, padding:"22px 18px 26px",
        background:"linear-gradient(to top, rgba(244,244,245,.96) 60%, rgba(244,244,245,0))" }}>
        <button className="tap" onClick={onRecord} style={{ width:"100%", border:"none",
          background:C.blue, color:"#fff", fontFamily:SF, fontWeight:600, fontSize:16,
          padding:"13px 0", borderRadius:13, display:"flex", alignItems:"center",
          justifyContent:"center", gap:8, cursor:"pointer", boxShadow:"0 6px 18px rgba(0,0,0,.22)" }}>
          <Mic size={18} /> Nuova registrazione
        </button>
      </div>
    </div>
  );
}

// ---- Record --------------------------------------------------------------
function Record({ onBack }) {
  const [paused, setPaused] = useState(false);
  const [secs, setSecs] = useState(2178);
  const [marks, setMarks] = useState(2);
  const [confirmStop, setConfirmStop] = useState(false);
  const tick = useRef();

  useEffect(() => {
    if (!paused) tick.current = setInterval(()=>setSecs(s=>s+1), 1000);
    return ()=>clearInterval(tick.current);
  }, [paused]);

  const hh=String(Math.floor(secs/3600)).padStart(2,"0");
  const mm=String(Math.floor((secs%3600)/60)).padStart(2,"0");
  const ss=String(secs%60).padStart(2,"0");

  return (
    <div style={{ flex:1, color:C.label, display:"flex", flexDirection:"column", background:C.bg,
      position:"relative" }}>
      <div style={{ padding:"48px 14px 0", display:"flex", alignItems:"center" }}>
        <button className="tap" onClick={onBack} style={{ background:"none", border:"none",
          color:C.blue, display:"flex", alignItems:"center", gap:1, fontSize:16, cursor:"pointer",
          fontFamily:SF }}><ChevronLeft size={20} /> Lezioni</button>
        <span style={{ marginLeft:"auto", display:"flex", alignItems:"center", gap:6, fontSize:13,
          fontWeight:500, color: paused ? C.secondary : "#FF3B30" }}>
          <span style={{ width:7, height:7, borderRadius:"50%",
            background: paused ? C.secondary : "#FF3B30",
            animation: paused ? "none" : "pulseDot 1.3s ease-in-out infinite" }} />
          {paused ? "In pausa" : "Registrazione"}
        </span>
      </div>

      <div style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center",
        justifyContent:"center", gap:26, padding:"0 20px" }}>
        <div style={{ textAlign:"center" }}>
          <div style={{ color:C.secondary, fontSize:14, marginBottom:8 }}>Diritto Costituzionale</div>
          <div style={{ fontSize:54, fontWeight:300, letterSpacing:"-.03em",
            fontVariantNumeric:"tabular-nums", lineHeight:1 }}>
            {hh}:{mm}<span style={{ color:C.tertiary }}>:{ss}</span>
          </div>
        </div>

        {/* waveform */}
        <div style={{ display:"flex", alignItems:"center", gap:3, height:52 }}>
          {Array.from({ length:27 }).map((_, i) => (
            <span key={i} style={{ width:3, height: `${24 + Math.abs(13-i)*4.5}%`, borderRadius:2,
              background: C.blue, transformOrigin:"center",
              animation: paused ? "none" : `bar ${0.7+(i%4)*0.2}s ease-in-out ${i*0.03}s infinite`,
              opacity: paused ? .25 : .9 }} />
          ))}
        </div>

        <div style={{ display:"flex", alignItems:"center", gap:6, color:C.secondary, fontSize:13 }}>
          <Bookmark size={12} fill={C.blue} color={C.blue} /> {marks} segnalibri
        </div>
      </div>

      <div style={{ padding:"0 26px 40px", display:"flex", alignItems:"flex-start",
        justifyContent:"space-between" }}>
        <Ctrl onClick={()=>setMarks(m=>m+1)} label="Segna">
          <button style={btnSm(C.card, C.blue, C.sep)}><Bookmark size={20} /></button>
        </Ctrl>

        <Ctrl label={paused ? "Riprendi" : "Pausa"}>
          <button onClick={()=>setPaused(p=>!p)} style={{ width:74, height:74,
            borderRadius:"50%", border:"4px solid #fff", background: paused ? C.blue : "#FF3B30",
            display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer",
            boxShadow:"0 6px 22px rgba(0,0,0,.18)" }}>
            {paused ? <Play size={30} fill="#fff" color="#fff" /> : <Pause size={28} fill="#fff" color="#fff" />}
          </button>
        </Ctrl>

        <Ctrl onClick={()=>setConfirmStop(true)} label="Termina">
          <button style={btnSm(C.card, "#FF3B30", C.sep)}><Square size={18} fill="#FF3B30" /></button>
        </Ctrl>
      </div>

      {/* Conferma stop (action sheet stile iOS) */}
      {confirmStop && (
        <div style={{ position:"absolute", inset:0, zIndex:50, display:"flex", flexDirection:"column",
          justifyContent:"flex-end", background:"rgba(0,0,0,.32)", padding:10 }}
          onClick={()=>setConfirmStop(false)}>
          <div className="fade" onClick={(e)=>e.stopPropagation()}
            style={{ background:"rgba(249,249,250,.96)", backdropFilter:"blur(20px)", borderRadius:16,
            overflow:"hidden", marginBottom:8 }}>
            <div style={{ padding:"16px", textAlign:"center", borderBottom:`0.5px solid ${C.sep}` }}>
              <div style={{ fontSize:13, color:C.secondary, lineHeight:1.4 }}>
                Terminare la registrazione?<br/>L'audio verrà salvato e inviato alla trascrizione.
              </div>
            </div>
            <button className="row tap" onClick={onBack} style={{ width:"100%", border:"none",
              background:"transparent", padding:"15px", fontSize:18, fontWeight:600, color:"#FF3B30",
              cursor:"pointer", fontFamily:SF }}>Termina e salva</button>
          </div>
          <button className="tap" onClick={()=>setConfirmStop(false)} style={{ width:"100%",
            border:"none", background:"rgba(249,249,250,.96)", backdropFilter:"blur(20px)",
            borderRadius:16, padding:"15px", fontSize:18, fontWeight:600, color:C.blue,
            cursor:"pointer", fontFamily:SF }}>Continua a registrare</button>
        </div>
      )}
    </div>
  );
}

// ---- Import --------------------------------------------------------------
function Import({ onBack }) {
  const [picked, setPicked] = useState(false);
  const [title, setTitle] = useState("Lezione importata");
  const [subject, setSubject] = useState("");

  return (
    <div className="ph" style={{ flex:1, overflowY:"auto", color:C.label }}>
      <div style={{ padding:"48px 14px 8px", display:"flex", alignItems:"center" }}>
        <button className="tap" onClick={onBack} style={{ background:"none", border:"none",
          color:C.blue, display:"flex", alignItems:"center", gap:1, fontSize:16, cursor:"pointer",
          fontFamily:SF }}><ChevronLeft size={20} /> Lezioni</button>
      </div>

      <div style={{ padding:"4px 18px 0" }}>
        <h1 style={{ fontSize:26, fontWeight:700, letterSpacing:"-.022em", margin:"0 0 4px" }}>Importa</h1>
        <p style={{ fontSize:14.5, color:C.secondary, margin:"0 0 18px", lineHeight:1.4 }}>
          Aggiungi un file audio o video già registrato. Verrà trascritto come una normale lezione.
        </p>

        {!picked ? (
          <>
            {/* zona di selezione file */}
            <button className="tap" onClick={()=>setPicked(true)} style={{ width:"100%",
              border:`1.5px dashed ${C.tertiary}`, background:C.card, borderRadius:14,
              padding:"30px 16px", display:"flex", flexDirection:"column", alignItems:"center",
              gap:10, cursor:"pointer", fontFamily:SF }}>
              <div style={{ width:52, height:52, borderRadius:14, background:C.bg,
                display:"flex", alignItems:"center", justifyContent:"center" }}>
                <Upload size={24} color={C.label} />
              </div>
              <span style={{ fontSize:16, fontWeight:600, color:C.label }}>Scegli un file</span>
              <span style={{ fontSize:13, color:C.secondary }}>da File, iCloud o altre app</span>
            </button>

            <div style={{ fontSize:12, color:C.secondary, textTransform:"uppercase",
              letterSpacing:".03em", padding:"22px 6px 8px", fontWeight:500 }}>Oppure condividi verso l'app</div>
            <div style={{ background:C.card, borderRadius:13, padding:"13px 14px",
              display:"flex", alignItems:"center", gap:11 }}>
              <FileAudio size={19} color={C.secondary} />
              <span style={{ fontSize:14, color:C.secondary, lineHeight:1.35 }}>
                Da Memo Vocali, WhatsApp, Mail… usa "Condividi" e scegli questa app.
              </span>
            </div>
            <div style={{ fontSize:12, color:C.tertiary, textAlign:"center", marginTop:16 }}>
              Formati: m4a, mp3, wav, opus, flac… e video (mp4, mov)
            </div>
          </>
        ) : (
          /* dopo la selezione: form titolo + materia, come "Salva lezione" */
          <div className="fade">
            <div style={{ background:C.card, borderRadius:13, padding:"13px 14px",
              display:"flex", alignItems:"center", gap:11, marginBottom:18 }}>
              <div style={{ width:40, height:40, borderRadius:10, background:C.bg,
                display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                <FileAudio size={19} color={C.label} />
              </div>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontSize:15, fontWeight:600 }}>lezione_storia_20mar.m4a</div>
                <div style={{ fontSize:13, color:C.secondary }}>54:03 · 48 MB</div>
              </div>
              <CheckCircle2 size={20} color={C.label} />
            </div>

            <Field label="Titolo">
              <input value={title} onChange={(e)=>setTitle(e.target.value)} style={inp()} />
            </Field>
            <Field label="Materia">
              <input value={subject} onChange={(e)=>setSubject(e.target.value)}
                placeholder="es. Storia" style={inp()} />
            </Field>

            <button className="tap" onClick={onBack} style={{ width:"100%", border:"none",
              background:C.blue, color:"#fff", fontFamily:SF, fontWeight:600, fontSize:16,
              padding:"14px 0", borderRadius:13, marginTop:8, cursor:"pointer" }}>
              Importa e trascrivi
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div style={{ marginBottom:14 }}>
      <div style={{ fontSize:12.5, color:C.secondary, fontWeight:500, marginBottom:6,
        paddingLeft:2 }}>{label}</div>
      {children}
    </div>
  );
}
function inp() {
  return { width:"100%", border:`1px solid ${C.sep}`, background:C.card, borderRadius:11,
    padding:"12px 13px", fontSize:16, fontFamily:SF, color:C.label, outline:"none" };
}

// ---- Detail --------------------------------------------------------------
function Detail({ lesson, onBack }) {
  const [tab, setTab] = useState("clean");
  const [playing, setPlaying] = useState(null);
  const col = SUBJECT_COLOR[lesson.subject] || SUBJECT_COLOR.default;

  return (
    <div className="ph" style={{ flex:1, overflowY:"auto", color:C.label }}>
      {/* nav bar */}
      <div style={{ padding:"44px 14px 8px", position:"sticky", top:0, zIndex:10,
        background:"rgba(242,242,247,.82)", backdropFilter:"blur(20px)",
        WebkitBackdropFilter:"blur(20px)", borderBottom:`0.5px solid ${C.sep}` }}>
        <div style={{ display:"flex", alignItems:"center" }}>
          <button className="tap" onClick={onBack} style={{ background:"none", border:"none",
            color:C.blue, display:"flex", alignItems:"center", gap:1, fontSize:16, cursor:"pointer",
            fontFamily:SF }}><ChevronLeft size={20} /> Lezioni</button>
          <button className="tap" style={{ marginLeft:"auto", background:"none", border:"none",
            color:C.blue, cursor:"pointer", display:"flex" }}><MoreHorizontal size={20} /></button>
        </div>
      </div>

      {/* header card */}
      <div style={{ padding:"12px 14px 0" }}>
        <div className="fade" style={{ background:C.card, borderRadius:15, padding:"15px 15px 14px" }}>
          <span style={{ display:"inline-block", fontSize:12, fontWeight:600, color:col,
            background:`${col}1a`, borderRadius:6, padding:"3px 8px", marginBottom:9 }}>
            {lesson.subject || "Senza materia"}
          </span>
          <h1 style={{ fontSize:21, fontWeight:700, letterSpacing:"-.02em", margin:"0 0 2px",
            lineHeight:1.18 }}>{lesson.title}</h1>
          <div style={{ fontSize:15, color:C.secondary }}>{lesson.subtitle}</div>
          <div style={{ fontSize:13, color:C.tertiary, marginTop:7 }}>
            {lesson.date} · {lesson.time} · {lesson.duration}
          </div>

          {/* segmented actions */}
          <div style={{ display:"flex", gap:7, marginTop:13 }}>
            <Action icon={<Volume2 size={15} />} label="Audio" />
            <Action icon={<Download size={15} />} label="Esporta" />
            <Action icon={<Sparkles size={15} />} label="Riassumi" primary />
          </div>
        </div>
      </div>

      {/* segmented control */}
      <div style={{ padding:"14px 14px 4px" }}>
        <div style={{ display:"flex", background:"#E8E8EB", borderRadius:9, padding:2 }}>
          {[["verbatim","Grezza"],["clean","Pulita"],["summary","Riassunto"]].map(([k,lab])=>(
            <button key={k} className="tap" onClick={()=>setTab(k)} style={{ flex:1, padding:"6px 0",
              borderRadius:7, border:"none", cursor:"pointer", fontFamily:SF, fontSize:13.5,
              fontWeight: tab===k?600:500, color: tab===k?C.label:C.secondary,
              background: tab===k?"#fff":"transparent",
              boxShadow: tab===k?"0 1px 4px rgba(0,0,0,.12)":"none" }}>{lab}</button>
          ))}
        </div>
      </div>

      {/* content */}
      <div style={{ padding:"10px 14px 44px" }}>
        {tab==="summary" ? (
          <div className="fade" style={{ background:C.card, borderRadius:16, padding:"18px" }}>
            <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:12 }}>
              <Sparkles size={17} color="#FF9500" />
              <span style={{ fontSize:16, fontWeight:600 }}>Riassunto</span>
            </div>
            <p style={{ margin:"0 0 16px", fontSize:16, lineHeight:1.55 }}>
              La lezione introduce il principio di separazione dei poteri, formalizzato da Montesquieu
              sulle basi del pensiero di Locke, e ne discute l'applicazione concreta.
            </p>
            <div style={{ fontSize:12.5, color:C.secondary, textTransform:"uppercase",
              letterSpacing:".04em", fontWeight:600, marginBottom:10 }}>Punti chiave</div>
            {["Tre funzioni: legislativa, esecutiva, giudiziaria",
              "Sistema di pesi e contrappesi, non separazione assoluta",
              "Esempi: potere di veto, controllo di costituzionalità"].map((p,i)=>(
              <div key={i} style={{ display:"flex", gap:10, marginBottom:10, fontSize:15.5, lineHeight:1.45 }}>
                <span style={{ color:C.blue, fontWeight:700 }}>·</span>{p}
              </div>
            ))}
          </div>
        ) : (
          <div className="fade" style={{ background:C.card, borderRadius:16, overflow:"hidden" }}>
            {tab==="verbatim" && (
              <div style={{ fontSize:12.5, color:C.secondary, padding:"13px 16px 0", fontStyle:"italic" }}>
                Versione fedele da Scribe — con esitazioni e ripetizioni.
              </div>
            )}
            {TRANSCRIPT.map((seg,i)=>(
              <div key={i} className="row tap" onClick={()=>setPlaying(playing===i?null:i)}
                style={{ display:"flex", gap:12, padding:"13px 16px",
                borderBottom: i<TRANSCRIPT.length-1?`0.5px solid ${C.sep}`:"none",
                background: playing===i?C.blueDim:"transparent" }}>
                <div style={{ flexShrink:0, width:44 }}>
                  <span style={{ fontSize:12.5, color:C.blue, fontWeight:600,
                    fontVariantNumeric:"tabular-nums", display:"flex", alignItems:"center", gap:3 }}>
                    {playing===i && <Volume2 size={11} />}{seg.t}
                  </span>
                </div>
                <div style={{ flex:1 }}>
                  <span style={{ fontSize:12.5, fontWeight:600,
                    color: seg.spk==="Prof."?C.secondary:col }}>{seg.spk}</span>
                  <p style={{ margin:"2px 0 0", fontSize:15.5, lineHeight:1.5,
                    color: tab==="verbatim" && i===1 ? C.secondary : C.label }}>
                    {tab==="verbatim" && i===1
                      ? "La teoria, ecco, come… come sapete, viene formalizzata da Montesquieu, ma le radici affondano già, diciamo, nel pensiero di Locke."
                      : seg.text}
                    {seg.mark && <Bookmark size={12} fill={C.blue} color={C.blue}
                      style={{ marginLeft:6, verticalAlign:"middle" }} />}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
        {tab!=="summary" && (
          <div style={{ textAlign:"center", color:C.secondary, fontSize:13, marginTop:14,
            display:"flex", alignItems:"center", justifyContent:"center", gap:6 }}>
            <Play size={11} /> Tocca una frase per riascoltare da quel punto
          </div>
        )}
      </div>
    </div>
  );
}

function Action({ icon, label, primary }) {
  return (
    <button className="tap" style={{ flex:1, display:"flex", flexDirection:"column",
      alignItems:"center", gap:5, padding:"11px 0", borderRadius:11, cursor:"pointer", fontFamily:SF,
      border:"none", background: primary ? C.blue : C.bg,
      color: primary ? "#fff" : C.blue, fontSize:12.5, fontWeight:500 }}>
      {icon}{label}
    </button>
  );
}

// piccolo wrapper: pulsante tondo + etichetta sotto
function Ctrl({ children, label, onClick }) {
  return (
    <div className="tap" onClick={onClick} style={{ display:"flex", flexDirection:"column",
      alignItems:"center", gap:7, cursor:"pointer" }}>
      {children}
      <span style={{ fontSize:11.5, color:C.secondary, fontWeight:500 }}>{label}</span>
    </div>
  );
}

function btnSm(bg, fg, border) {
  return { width:52, height:52, borderRadius:"50%", background:bg, border:`0.5px solid ${border}`,
    color:fg, display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer",
    boxShadow:"0 2px 8px rgba(0,0,0,.06)" };
}

import React, { useState } from "react";
import {
  Mic, Search, Upload, Download, Sparkles, Volume2, Bookmark, FileAudio,
  CheckCircle2, Cloud, Play
} from "lucide-react";

const SF = `-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", "Helvetica Neue", Helvetica, Arial, sans-serif`;

const C = {
  bg:"#F4F4F5", card:"#FFFFFF", sep:"#E4E4E7", label:"#18181B",
  secondary:"#71717A", tertiary:"#C4C4C8", accent:"#27272A", accentDim:"#F0F0F1",
  sidebar:"#FAFAFA",
};

const SUBJECTS = [
  { name:"Tutte", count:12 },
  { name:"Diritto", count:5 },
  { name:"Matematica", count:4 },
  { name:"Storia", count:3 },
];

const LESSONS = [
  { id:1, title:"Diritto Costituzionale", subtitle:"La separazione dei poteri",
    subject:"Diritto", date:"Oggi · 09:14", duration:"1:48:12", sync:"summarized", source:"recording" },
  { id:2, title:"Analisi Matematica II", subtitle:"Integrali multipli",
    subject:"Matematica", date:"Ieri · 11:30", duration:"1:12:40", sync:"transcribed", source:"recording" },
  { id:3, title:"Storia Contemporanea", subtitle:"Il dopoguerra europeo",
    subject:"Storia", date:"20 mar · 14:00", duration:"0:54:03", sync:"transcribed", source:"import" },
  { id:4, title:"Diritto Privato", subtitle:"Obbligazioni e contratti",
    subject:"Diritto", date:"18 mar · 09:00", duration:"1:31:22", sync:"summarized", source:"recording" },
  { id:5, title:"Registrazione", subtitle:"Senza titolo",
    subject:null, date:"17 mar · 16:45", duration:"0:08:21", sync:"uploaded", source:"recording" },
];

const SYNC = {
  uploaded:    { label:"Caricata",      Icon:Cloud,        tone:"#71717A" },
  transcribed: { label:"Trascritta",    Icon:CheckCircle2, tone:"#3F3F46" },
  summarized:  { label:"Con riassunto", Icon:Sparkles,     tone:"#18181B" },
};

const TRANSCRIPT = [
  { t:"00:00", spk:"Prof.", text:"Buongiorno a tutti. Oggi affrontiamo uno dei principi cardine dello Stato di diritto: la separazione dei poteri." },
  { t:"00:14", spk:"Prof.", text:"La teoria viene formalizzata da Montesquieu, ma le sue radici affondano già nel pensiero di Locke.", mark:true },
  { t:"00:31", spk:"Prof.", text:"Distinguiamo tre funzioni: legislativa, esecutiva e giudiziaria. Ciascuna affidata a organi distinti." },
  { t:"00:48", spk:"Studente", text:"Professore, questa separazione è mai assoluta nella pratica?" },
  { t:"00:53", spk:"Prof.", text:"Ottima domanda. No, parliamo più correttamente di un sistema di pesi e contrappesi." },
  { t:"01:10", spk:"Prof.", text:"Pensate al potere di veto, o al controllo di costituzionalità: punti di contatto, non muri.", mark:true },
  { t:"01:28", spk:"Prof.", text:"Nei sistemi parlamentari il rapporto tra governo e parlamento sfuma ulteriormente questa distinzione." },
];

export default function App() {
  const [active, setActive] = useState(LESSONS[0]);
  const [subj, setSubj] = useState("Tutte");
  const [tab, setTab] = useState("clean");
  const [playing, setPlaying] = useState(null);
  const [dragging, setDragging] = useState(false);

  const list = subj === "Tutte" ? LESSONS : LESSONS.filter(l => l.subject === subj);

  return (
    <div style={{ minHeight:"100vh", background:"#cfcfd4", display:"flex",
      alignItems:"center", justifyContent:"center", padding:"24px", fontFamily:SF }}>
      <style>{`
        * { box-sizing:border-box; }
        .tap { cursor:pointer; transition:background .15s ease; }
        .lrow:hover { background:#F4F4F5; }
        .srow:hover { background:#F0F0F1; }
        .seg:hover { background:#FAFAFA; }
        ::-webkit-scrollbar { width:10px; height:10px; }
        ::-webkit-scrollbar-thumb { background:#d4d4d8; border-radius:6px; border:3px solid #fff; }
      `}</style>

      {/* finestra desktop */}
      <div style={{ width:1100, height:720, background:C.bg, borderRadius:14,
        boxShadow:"0 40px 100px rgba(0,0,0,.4)", overflow:"hidden", display:"flex",
        flexDirection:"column", border:`1px solid ${C.sep}` }}>

        {/* title bar macOS */}
        <div style={{ height:38, background:"#ECECEE", borderBottom:`1px solid ${C.sep}`,
          display:"flex", alignItems:"center", padding:"0 14px", gap:8, flexShrink:0 }}>
          <span style={{ width:12, height:12, borderRadius:"50%", background:"#FF5F57" }} />
          <span style={{ width:12, height:12, borderRadius:"50%", background:"#FEBC2E" }} />
          <span style={{ width:12, height:12, borderRadius:"50%", background:"#28C840" }} />
          <span style={{ marginLeft:14, fontSize:13, color:C.secondary, fontWeight:500 }}>
            Lezioni — la mia raccolta
          </span>
        </div>

        <div style={{ flex:1, display:"flex", minHeight:0 }}>
          {/* SIDEBAR */}
          <div style={{ width:220, background:C.sidebar, borderRight:`1px solid ${C.sep}`,
            display:"flex", flexDirection:"column", flexShrink:0 }}>
            <div style={{ padding:"18px 16px 12px" }}>
              <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                <div style={{ width:26, height:26, borderRadius:7, background:C.accent,
                  display:"flex", alignItems:"center", justifyContent:"center" }}>
                  <Mic size={14} color="#fff" />
                </div>
                <span style={{ fontSize:16, fontWeight:700, letterSpacing:"-.01em" }}>Lezioni</span>
              </div>
            </div>

            <div style={{ padding:"4px 10px" }}>
              {SUBJECTS.map(s => (
                <div key={s.name} className="srow tap" onClick={()=>setSubj(s.name)}
                  style={{ display:"flex", alignItems:"center", justifyContent:"space-between",
                  padding:"7px 10px", borderRadius:7, marginBottom:1,
                  background: subj===s.name ? C.accentDim : "transparent" }}>
                  <span style={{ fontSize:13.5, fontWeight: subj===s.name?600:500,
                    color: subj===s.name?C.label:C.secondary }}>{s.name}</span>
                  <span style={{ fontSize:12, color:C.tertiary }}>{s.count}</span>
                </div>
              ))}
            </div>

            <div style={{ marginTop:"auto", padding:14 }}>
              <div style={{ fontSize:11.5, color:C.tertiary, lineHeight:1.5 }}>
                3,2h usate questo mese
              </div>
            </div>
          </div>

          {/* COLONNA LISTA */}
          <div style={{ width:340, borderRight:`1px solid ${C.sep}`, background:C.card,
            display:"flex", flexDirection:"column", flexShrink:0 }}>
            {/* toolbar lista */}
            <div style={{ padding:"14px 14px 10px", borderBottom:`1px solid ${C.sep}` }}>
              <div style={{ display:"flex", gap:8, marginBottom:10 }}>
                <div style={{ flex:1, display:"flex", alignItems:"center", gap:7,
                  background:"#EFEFF1", borderRadius:8, padding:"7px 10px" }}>
                  <Search size={15} color={C.secondary} />
                  <span style={{ fontSize:13.5, color:C.secondary }}>Cerca nelle lezioni…</span>
                </div>
                <button className="tap" title="Registra (microfono o audio del computer)"
                  style={{ width:34, borderRadius:8, border:"none", background:C.accent,
                  color:"#fff", display:"flex", alignItems:"center", justifyContent:"center" }}>
                  <Mic size={16} />
                </button>
                <button className="tap" title="Importa file"
                  style={{ width:34, borderRadius:8, border:`1px solid ${C.sep}`, background:C.card,
                  color:C.accent, display:"flex", alignItems:"center", justifyContent:"center" }}>
                  <Upload size={16} />
                </button>
              </div>
              <div style={{ fontSize:11.5, color:C.secondary, fontWeight:600,
                textTransform:"uppercase", letterSpacing:".03em" }}>{subj} · {list.length}</div>
            </div>

            {/* lista scroll */}
            <div style={{ flex:1, overflowY:"auto" }}>
              {list.map(l => {
                const s = SYNC[l.sync];
                const isActive = active.id === l.id;
                return (
                  <div key={l.id} className="lrow tap" onClick={()=>{setActive(l); setTab("clean"); setPlaying(null);}}
                    style={{ display:"flex", gap:11, padding:"12px 14px",
                    borderBottom:`1px solid ${C.sep}`,
                    background: isActive ? C.accentDim : "transparent",
                    borderLeft: isActive ? `3px solid ${C.accent}` : "3px solid transparent" }}>
                    <div style={{ width:34, height:34, borderRadius:8, flexShrink:0, background:C.bg,
                      display:"flex", alignItems:"center", justifyContent:"center" }}>
                      {l.source==="import" ? <FileAudio size={16} color={C.secondary} />
                        : <Mic size={16} color={C.secondary} />}
                    </div>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontSize:14, fontWeight:600, whiteSpace:"nowrap",
                        overflow:"hidden", textOverflow:"ellipsis" }}>{l.title}</div>
                      <div style={{ fontSize:12.5, color:C.secondary, whiteSpace:"nowrap",
                        overflow:"hidden", textOverflow:"ellipsis" }}>{l.subtitle}</div>
                      <div style={{ display:"flex", alignItems:"center", gap:5, marginTop:4,
                        fontSize:11.5, color:C.secondary }}>
                        {s && <s.Icon size={11} color={s.tone} />}
                        {l.duration} · {l.date}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* PANNELLO LETTURA */}
          <div style={{ flex:1, display:"flex", flexDirection:"column", minWidth:0,
            position:"relative" }}
            onDragOver={(e)=>{e.preventDefault(); setDragging(true);}}
            onDragLeave={()=>setDragging(false)}
            onDrop={(e)=>{e.preventDefault(); setDragging(false);}}>

            {/* header lezione */}
            <div style={{ padding:"20px 26px 16px", borderBottom:`1px solid ${C.sep}` }}>
              <div style={{ fontSize:12.5, fontWeight:600, color:C.secondary, marginBottom:6 }}>
                {active.subject || "Senza materia"} · {active.duration}
              </div>
              <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", gap:16 }}>
                <div>
                  <h1 style={{ fontSize:22, fontWeight:700, letterSpacing:"-.02em", margin:"0 0 3px" }}>
                    {active.title}
                  </h1>
                  <div style={{ fontSize:14, color:C.secondary }}>{active.subtitle} · {active.date}</div>
                </div>
                <div style={{ display:"flex", gap:8, flexShrink:0 }}>
                  <WebBtn icon={<Volume2 size={15} />} label="Audio" />
                  <WebBtn icon={<Download size={15} />} label="Esporta" />
                  <WebBtn icon={<Sparkles size={15} />} label="Riassumi" primary />
                </div>
              </div>

              {/* tab versioni */}
              <div style={{ display:"flex", gap:3, marginTop:16, background:"#EFEFF1",
                borderRadius:8, padding:2, width:"fit-content" }}>
                {[["verbatim","Grezza"],["clean","Pulita"],["summary","Riassunto"]].map(([k,lab])=>(
                  <button key={k} className="tap" onClick={()=>setTab(k)}
                    style={{ padding:"6px 18px", borderRadius:6, border:"none", fontFamily:SF,
                    fontSize:13, fontWeight: tab===k?600:500,
                    color: tab===k?C.label:C.secondary,
                    background: tab===k?"#fff":"transparent",
                    boxShadow: tab===k?"0 1px 3px rgba(0,0,0,.12)":"none" }}>{lab}</button>
                ))}
              </div>
            </div>

            {/* corpo scroll */}
            <div style={{ flex:1, overflowY:"auto", padding:"22px 26px 40px" }}>
              {tab==="summary" ? (
                <div style={{ maxWidth:680 }}>
                  <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:14 }}>
                    <Sparkles size={17} color={C.label} />
                    <span style={{ fontSize:16, fontWeight:600 }}>Riassunto</span>
                  </div>
                  <p style={{ fontSize:16, lineHeight:1.65, margin:"0 0 18px", color:C.label }}>
                    La lezione introduce il principio di separazione dei poteri, formalizzato da
                    Montesquieu sulle basi del pensiero di Locke, e ne discute l'applicazione concreta
                    nei sistemi costituzionali moderni.
                  </p>
                  <div style={{ fontSize:12.5, color:C.secondary, textTransform:"uppercase",
                    letterSpacing:".04em", fontWeight:600, marginBottom:12 }}>Punti chiave</div>
                  {["Tre funzioni distinte: legislativa, esecutiva, giudiziaria",
                    "Sistema di pesi e contrappesi, non separazione assoluta",
                    "Esempi concreti: potere di veto, controllo di costituzionalità",
                    "Nei sistemi parlamentari la distinzione è più sfumata"].map((p,i)=>(
                    <div key={i} style={{ display:"flex", gap:11, marginBottom:11, fontSize:15.5,
                      lineHeight:1.5 }}>
                      <span style={{ color:C.accent, fontWeight:700 }}>·</span>{p}
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ maxWidth:760 }}>
                  {tab==="verbatim" && (
                    <div style={{ fontSize:13, color:C.secondary, fontStyle:"italic", marginBottom:16 }}>
                      Versione fedele da Scribe — con esitazioni e ripetizioni.
                    </div>
                  )}
                  {TRANSCRIPT.map((seg,i)=>(
                    <div key={i} className="seg tap" onClick={()=>setPlaying(playing===i?null:i)}
                      style={{ display:"flex", gap:16, padding:"10px 12px", borderRadius:8,
                      marginBottom:2, background: playing===i ? C.accentDim : "transparent",
                      borderLeft: seg.mark ? `2px solid ${C.accent}` : "2px solid transparent" }}>
                      <div style={{ flexShrink:0, width:52, paddingTop:2 }}>
                        <span style={{ fontSize:12.5, color:C.accent, fontWeight:600,
                          fontVariantNumeric:"tabular-nums", display:"flex", alignItems:"center", gap:4 }}>
                          {playing===i && <Volume2 size={11} />}{seg.t}
                        </span>
                      </div>
                      <div style={{ flex:1 }}>
                        <span style={{ fontSize:12.5, fontWeight:600,
                          color: seg.spk==="Prof."?C.secondary:C.accent }}>{seg.spk}</span>
                        <p style={{ margin:"2px 0 0", fontSize:15.5, lineHeight:1.6,
                          color: tab==="verbatim" && i===1 ? C.secondary : C.label }}>
                          {tab==="verbatim" && i===1
                            ? "La teoria, ecco, come… come sapete, viene formalizzata da Montesquieu, ma le radici affondano già, diciamo, nel pensiero di Locke."
                            : seg.text}
                          {seg.mark && <Bookmark size={12} fill={C.accent} color={C.accent}
                            style={{ marginLeft:6, verticalAlign:"middle" }} />}
                        </p>
                      </div>
                    </div>
                  ))}
                  <div style={{ fontSize:13, color:C.secondary, marginTop:18,
                    display:"flex", alignItems:"center", gap:6 }}>
                    <Play size={11} /> Clic su una frase per riascoltare l'audio da quel punto
                  </div>
                </div>
              )}
            </div>

            {/* overlay drag & drop import */}
            {dragging && (
              <div style={{ position:"absolute", inset:12, border:`2px dashed ${C.accent}`,
                borderRadius:14, background:"rgba(244,244,245,.92)", display:"flex",
                flexDirection:"column", alignItems:"center", justifyContent:"center", gap:12, zIndex:5 }}>
                <Upload size={40} color={C.accent} />
                <div style={{ fontSize:18, fontWeight:600 }}>Rilascia per importare</div>
                <div style={{ fontSize:14, color:C.secondary }}>audio o video — verrà trascritto</div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function WebBtn({ icon, label, primary }) {
  return (
    <button className="tap" style={{ display:"flex", alignItems:"center", gap:6,
      padding:"8px 14px", borderRadius:9, fontFamily:SF, fontSize:13, fontWeight:500,
      border: primary ? "none" : `1px solid ${C.sep}`,
      background: primary ? C.accent : C.card, color: primary ? "#fff" : C.label }}>
      {icon}{label}
    </button>
  );
}

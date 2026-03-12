"use client";
import { useState, useRef, useEffect, useCallback } from "react";
import { signOut } from "next-auth/react";

/* ═══ Markdown renderer ═══ */
const Msg = ({ text }) => { const lines = (text || "").split("\n"); return (<div className="ai-text">{lines.map((raw, i) => { const t = raw.trim(); if (!t) return <div key={i} style={{ height: 10 }} />; if (/^#{1,3}\s/.test(t)) { const l = t.match(/^(#+)/)[1].length; return <div key={i} className={`ai-h ai-h${l}`}>{t.replace(/^#+\s*/, "")}</div>; } if (/\*\*RULING PREDICTION/i.test(t) || /^RULING PREDICTION/i.test(t)) { const a = /allow/i.test(t), d = /deny/i.test(t); return <div key={i} className={`ai-ruling ${a ? "allow" : d ? "deny" : "inv"}`}><span className="ai-rdot" />{t.replace(/\*\*/g, "")}</div>; } if (/^⚠/.test(t)) return <div key={i} className="ai-flag">{t}</div>; if (/^(OPM\s+)?\d{2}-\d{2}-\d{2}/i.test(t)) return <div key={i} className="ai-opm">{t}</div>; if (/^[✓✔]\s/.test(t)) return <div key={i} className="ai-chk pass"><span className="ai-ci">✓</span><span>{t.replace(/^[✓✔]\s*/, "")}</span></div>; if (/^[✗✘]\s/.test(t)) return <div key={i} className="ai-chk fail"><span className="ai-ci">✗</span><span>{t.replace(/^[✗✘]\s*/, "")}</span></div>; if (/^[-•]\s/.test(t)) return <div key={i} className="ai-li">{t.replace(/^[-•]\s*/, "")}</div>; if (/^\d+[.)]\s/.test(t)) { const n = t.match(/^(\d+)/)[1]; return <div key={i} className="ai-ol"><span className="ai-oln">{n}</span>{t.replace(/^\d+[.)]\s*/, "")}</div>; } const p = t.split(/(\*\*[^*]+\*\*)/g); if (p.length > 1) return <div key={i} className="ai-p">{p.map((s, j) => /^\*\*/.test(s) ? <strong key={j}>{s.replace(/\*\*/g, "")}</strong> : <span key={j}>{s}</span>)}</div>; return <div key={i} className="ai-p">{t}</div>; })}</div>); };

/* ═══ Stages ═══ */
const STAGES=[{id:"new",label:"New",color:"#86868B",icon:"○",guidance:"Upload documents and run your first AI analysis to get a ruling prediction."},{id:"review",label:"Under Review",color:"#0071E3",icon:"◎",guidance:"Review the AI analysis. Check compliance, assess RTW plan, and identify missing evidence."},{id:"investigating",label:"Investigating",color:"#FF9500",icon:"◉",guidance:"Gather additional evidence. Upload new documents as they come in."},{id:"approved",label:"Approved",color:"#34C759",icon:"●",guidance:"Claim approved. Monitor return-to-work progress and benefit payments."},{id:"denied",label:"Denied",color:"#FF3B30",icon:"●",guidance:"Claim denied. Review the ruling rationale and consider appeal options."},{id:"appeal",label:"Appeal",color:"#AF52DE",icon:"◈",guidance:"Prepare appeal submission. Gather additional evidence and policy arguments."},{id:"closed",label:"Closed",color:"#48484A",icon:"■",guidance:"This case is closed."}];
const stageOf=id=>STAGES.find(s=>s.id===id)||STAGES[0];
const fmt=iso=>{if(!iso||iso==="—")return"—";try{return new Date(iso).toLocaleDateString("en-CA",{month:"short",day:"numeric",year:"numeric"})}catch{return iso}};
const fmtTime=iso=>{try{return new Date(iso).toLocaleString("en-CA",{month:"short",day:"numeric",hour:"numeric",minute:"2-digit"})}catch{return""}};
const daysBetween=(a,b)=>{try{return Math.floor((new Date(b)-new Date(a))/(1000*60*60*24))}catch{return 0}};
const daysAgo=(iso)=>{try{return Math.floor((Date.now()-new Date(iso))/(1000*60*60*24))}catch{return 0}};

/* ═══ Document type tags ═══ */
const DOC_TYPES=[{id:"form6",label:"Form 6",color:"#0071E3"},{id:"form7",label:"Form 7",color:"#34C759"},{id:"form8",label:"Form 8",color:"#FF9500"},{id:"medical",label:"Medical Report",color:"#AF52DE"},{id:"imaging",label:"Imaging",color:"#FF2D55"},{id:"specialist",label:"Specialist",color:"#5856D6"},{id:"witness",label:"Witness Statement",color:"#00C7BE"},{id:"employer",label:"Employer Statement",color:"#FF9500"},{id:"physio",label:"Physio/Rehab",color:"#30B0C7"},{id:"fce",label:"FCE",color:"#AC8E68"},{id:"other",label:"Other",color:"#86868B"}];
function guessDocType(name){const n=name.toLowerCase();if(/form.?6|worker.?report/i.test(n))return"form6";if(/form.?7|employer.?report/i.test(n))return"form7";if(/form.?8|health|practitioner/i.test(n))return"form8";if(/mri|xray|x-ray|ct.?scan|imaging|radiology/i.test(n))return"imaging";if(/physio|rehab|therapy/i.test(n))return"physio";if(/witness/i.test(n))return"witness";if(/specialist|referral|consult/i.test(n))return"specialist";if(/fce|capacity|functional/i.test(n))return"fce";if(/medical|doctor|physician|clinical/i.test(n))return"medical";if(/employer|company/i.test(n))return"employer";return"other"}
const docTypeOf=id=>DOC_TYPES.find(d=>d.id===id)||DOC_TYPES[DOC_TYPES.length-1];

/* ═══ Deadline calculator ═══ */
function getDeadlines(claim){if(!claim||!claim.injuryDate||claim.injuryDate==="—")return[];const inj=new Date(claim.injuryDate);const now=new Date();const dl=[];
const form7Due=new Date(inj);form7Due.setDate(form7Due.getDate()+3);
const hasForm7=claim.documents?.some(d=>d.tag==="form7");
if(!hasForm7){const overdue=now>form7Due;dl.push({label:"Form 7 filing deadline",date:form7Due.toISOString(),daysLeft:daysBetween(now,form7Due),status:overdue?"overdue":"upcoming",priority:"high"})}

const rtwBenchmarks={"Acute Injury":{modified:21,full:42},"Occupational Disease":{modified:42,full:112},"Traumatic Mental Stress":{modified:28,full:84},"Chronic Mental Stress":{modified:42,full:112},"PTSD (First Responder)":{modified:28,full:84},"Recurrence":{modified:14,full:42},"Aggravation of Pre-existing":{modified:21,full:56}};
const bench=rtwBenchmarks[claim.injuryType]||{modified:21,full:56};
const modDate=new Date(inj);modDate.setDate(modDate.getDate()+bench.modified);
const fullDate=new Date(inj);fullDate.setDate(fullDate.getDate()+bench.full);
if(claim.stage!=="closed"&&claim.stage!=="denied"){dl.push({label:"Expected modified duties",date:modDate.toISOString(),daysLeft:daysBetween(now,modDate),status:now>modDate?"overdue":"upcoming",priority:"medium"});dl.push({label:"Expected full duties",date:fullDate.toISOString(),daysLeft:daysBetween(now,fullDate),status:now>fullDate?"overdue":"upcoming",priority:"medium"})}

if(claim.stage==="denied"){const appealDate=new Date(claim.updatedAt||now);appealDate.setDate(appealDate.getDate()+30);dl.push({label:"Appeal window closes",date:appealDate.toISOString(),daysLeft:daysBetween(now,appealDate),status:now>appealDate?"overdue":"upcoming",priority:"high"})}

const loeReview=new Date(inj);loeReview.setMonth(loeReview.getMonth()+72);
if(claim.stage==="approved"){dl.push({label:"72-month LOE review",date:loeReview.toISOString(),daysLeft:daysBetween(now,loeReview),status:"upcoming",priority:"low"})}
return dl.sort((a,b)=>a.daysLeft-b.daysLeft)}

/* ═══ RTW Progress ═══ */
function getRTWProgress(claim){if(!claim||!claim.injuryDate||claim.injuryDate==="—")return null;
const bench={"Acute Injury":42,"Occupational Disease":112,"Traumatic Mental Stress":84,"Chronic Mental Stress":112,"PTSD (First Responder)":84,"Recurrence":42,"Aggravation of Pre-existing":56};
const totalDays=bench[claim.injuryType]||56;const elapsed=daysAgo(claim.injuryDate);const pct=Math.min(100,Math.round((elapsed/totalDays)*100));
const status=pct>=100?(claim.stage==="approved"||claim.stage==="closed"?"recovered":"delayed"):pct>=75?"late":"on-track";
return{elapsed,totalDays,pct,status,label:`Day ${elapsed} of ~${totalDays}`}}

/* ═══ Case summary generator ═══ */
function getCaseSummary(c){if(!c)return"";const parts=[];parts.push(`${c.injuryType} claim`);if(c.worker&&c.worker!=="—")parts.push(`for ${c.worker}`);if(c.employer&&c.employer!=="—")parts.push(`at ${c.employer}`);if(c.injuryDate&&c.injuryDate!=="—")parts.push(`(${fmt(c.injuryDate)})`);const lastRuling=c.analyses?.[c.analyses.length-1]?.ruling;if(lastRuling)parts.push(`· AI: ${lastRuling}`);return parts.join(" ")}

/* ═══ Smart next actions ═══ */
function getNextActions(c){if(!c)return[];const s=c.stage,ha=(c.analyses?.length||0)>0,hd=(c.documents?.length||0)>0,lr=c.analyses?.[c.analyses.length-1]?.ruling,a=[];
if(s==="new"){if(!hd&&!ha)a.push({label:"Upload claim documents",desc:"Add Form 6, Form 7, medical reports, or other evidence",action:"upload",priority:"high"});if(!ha)a.push({label:"Run AI adjudication analysis",desc:"Get a ruling prediction based on the WSIB Operational Policy Manual",action:"analyze",priority:"high"});if(ha)a.push({label:"Move to Under Review",desc:"Analysis complete — advance this case",action:"stage:review",priority:"medium"})}
if(s==="review"){a.push({label:"Check reporting compliance",desc:"Verify Form 7 was filed within 3 business days",action:"prompt:Check if this claim was reported within WSIB filing deadlines. Was the Form 7 filed on time?",priority:"medium"});a.push({label:"Assess return-to-work plan",desc:"Evaluate RTW readiness against clinical guidelines",action:"prompt:Assess the return-to-work plan for this claim. Are the timelines consistent with clinical guidelines?",priority:"medium"});a.push({label:"Estimate benefit entitlements",desc:"Calculate LOE, NEL, and health care benefits",action:"prompt:What benefits would this worker be entitled to? Walk me through the LOE calculation.",priority:"low"});if(lr==="Further Investigation")a.push({label:"Move to Investigating",desc:"Additional evidence needed",action:"stage:investigating",priority:"high"});if(lr==="Allow")a.push({label:"Approve this claim",desc:"AI recommends approval",action:"stage:approved",priority:"high"});if(lr==="Deny")a.push({label:"Deny this claim",desc:"AI recommends denial",action:"stage:denied",priority:"high"})}
if(s==="investigating"){a.push({label:"Upload additional evidence",desc:"Add new medical reports, specialist referrals, or witness statements",action:"upload",priority:"high"});a.push({label:"Re-run analysis with new evidence",desc:"Get an updated ruling prediction",action:"analyze",priority:"high"});a.push({label:"Check for red flags",desc:"Review the claim for concerning patterns",action:"prompt:Are there any red flags in this claim?",priority:"medium"})}
if(s==="denied"){a.push({label:"Review denial rationale",desc:"Understand why the claim was denied",action:"prompt:Explain the detailed rationale for denying this claim. Which OPM sections apply and what evidence would overturn this?",priority:"high"});a.push({label:"Begin appeal process",desc:"Move to Appeal stage",action:"stage:appeal",priority:"medium"})}
if(s==="approved"){a.push({label:"Generate medical chronology",desc:"AI-generated timeline of all medical events and treatments",action:"prompt:Generate a detailed medical chronology for this claim. List every medical event in chronological order: date of injury, ER visits, physician appointments, imaging, diagnoses, treatments, medications, physiotherapy sessions, specialist referrals, and functional assessments. Format as a timeline.",priority:"medium"});a.push({label:"Create RTW monitoring plan",desc:"Set up milestones and check-in schedule",action:"prompt:Create a detailed return-to-work monitoring plan for this claim with milestones and timelines.",priority:"medium"});a.push({label:"Calculate benefit amounts",desc:"Get detailed LOE and NEL calculations",action:"prompt:Calculate detailed benefit amounts for this approved claim including LOE, NEL, and the 72-month review timeline.",priority:"medium"});a.push({label:"Generate case memo",desc:"Create a downloadable summary of this case",action:"prompt:Generate a comprehensive case memo for this claim. Include: claim facts, Five Point Check results, medical evidence summary, applicable OPM policy sections, ruling prediction, benefit entitlements, and recommendations. Format it as a professional legal memo.",priority:"low"});a.push({label:"Close case",desc:"Worker returned to full duties",action:"stage:closed",priority:"low"})}
if(s==="appeal"){a.push({label:"Build appeal arguments",desc:"Get AI-assisted policy arguments",action:"prompt:Help me build the strongest appeal arguments for this claim. Reference specific OPM sections and benefit of doubt (11-01-13).",priority:"high"});a.push({label:"Identify evidence gaps",desc:"Find what could strengthen the appeal",action:"prompt:What additional evidence would strengthen this appeal?",priority:"high"});a.push({label:"Upload appeal documents",desc:"Add new evidence",action:"upload",priority:"medium"})}
return a}

/* ═══ Storage ═══ */
function storageKey(e){return`caseassist_claims_${e?.toLowerCase()}`}
function loadClaims(e){if(!e)return[];try{return JSON.parse(window.localStorage.getItem(storageKey(e))||"[]")}catch{return[]}}
function persistClaims(e,c){if(!e)return;try{window.localStorage.setItem(storageKey(e),JSON.stringify(c))}catch{}}

/* ═══ Search helper ═══ */
function searchClaims(claims,query){if(!query.trim())return claims;const q=query.toLowerCase();return claims.filter(c=>{const haystack=[c.claimNumber,c.worker,c.employer,c.injuryType,c.description,stageOf(c.stage).label,...(c.notes||[]).map(n=>n.text),...(c.analyses||[]).map(a=>a.ruling)].join(" ").toLowerCase();return haystack.includes(q)})}

/* ═══ Components ═══ */
function StageProgress({stage}){const steps=[{id:"new",label:"New"},{id:"review",label:"Review"},{id:"investigate",label:"Investigate"},{id:"decision",label:"Decision"},{id:"closed",label:"Closed"}];const map={new:0,review:1,investigating:2,approved:3,denied:3,appeal:2,closed:4};const cur=map[stage]??0;
return(<div style={{display:"flex",alignItems:"center",gap:0,margin:"16px 0 20px",overflowX:"auto"}}>{steps.map((s,i)=>(<div key={s.id} style={{display:"flex",alignItems:"center",flex:i<steps.length-1?1:"none",minWidth:0}}><div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:4}}><div style={{width:28,height:28,borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,fontWeight:700,background:i<=cur?"var(--blue)":"var(--g200)",color:i<=cur?"#fff":"var(--g400)",transition:"all .3s",flexShrink:0}}>{i<cur?"✓":i+1}</div><span style={{fontSize:10,fontWeight:600,color:i<=cur?"var(--g900)":"var(--g400)",whiteSpace:"nowrap"}}>{s.label}</span></div>{i<steps.length-1&&(<div style={{flex:1,height:2,margin:"0 6px",marginBottom:18,background:i<cur?"var(--blue)":"var(--g200)",borderRadius:1,transition:"all .3s",minWidth:12}}/>)}</div>))}</div>)}

function DeadlineBar({deadlines}){if(!deadlines||deadlines.length===0)return null;
return(<div style={{marginBottom:16}}><div style={{fontSize:12,fontWeight:700,color:"var(--g400)",textTransform:"uppercase",letterSpacing:.5,marginBottom:8}}>Deadlines & Milestones</div><div style={{display:"flex",gap:6,flexWrap:"wrap"}}>{deadlines.map((d,i)=>{const overdue=d.status==="overdue";return(<div key={i} style={{padding:"8px 12px",borderRadius:10,background:overdue?"var(--red-light)":"var(--g50)",border:`.5px solid ${overdue?"var(--red-border)":"var(--g200)"}`,flex:"1 1 200px",minWidth:180}}><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:2}}><span style={{fontSize:12,fontWeight:600,color:overdue?"var(--red)":"var(--g700)"}}>{d.label}</span><span style={{fontSize:10,fontWeight:600,color:overdue?"var(--red)":"var(--blue)",background:overdue?"rgba(255,59,48,.1)":"var(--blue-light)",padding:"2px 8px",borderRadius:980}}>{overdue?`${Math.abs(d.daysLeft)}d overdue`:`${d.daysLeft}d`}</span></div><div style={{fontSize:11,color:"var(--g500)"}}>{fmt(d.date)}</div></div>)})}</div></div>)}

function RTWBar({progress}){if(!progress)return null;const colors={recovered:"var(--green)",delayed:"var(--red)","on-track":"var(--blue)",late:"var(--orange)"};const c=colors[progress.status]||"var(--blue)";
return(<div style={{marginBottom:16,padding:"12px 16px",background:"var(--g50)",borderRadius:12,border:`.5px solid var(--g200)`}}><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}><span style={{fontSize:12,fontWeight:700,color:"var(--g700)"}}>Return-to-Work Progress</span><span style={{fontSize:12,fontWeight:600,color:c}}>{progress.label}</span></div><div style={{height:6,background:"var(--g200)",borderRadius:3,overflow:"hidden"}}><div style={{width:`${progress.pct}%`,height:"100%",background:c,borderRadius:3,transition:"width .5s ease"}}/></div><div style={{display:"flex",justifyContent:"space-between",marginTop:4}}><span style={{fontSize:10,color:"var(--g400)"}}>Injury date</span><span style={{fontSize:10,color:"var(--g400)",textTransform:"capitalize"}}>{progress.status}</span><span style={{fontSize:10,color:"var(--g400)"}}>Expected full RTW</span></div></div>)}

function DocList({documents}){if(!documents||documents.length===0)return null;const byType={};documents.forEach(d=>{const tag=d.tag||"other";if(!byType[tag])byType[tag]=[];byType[tag].push(d)});
return(<div style={{marginBottom:16}}><div style={{fontSize:12,fontWeight:700,color:"var(--g400)",textTransform:"uppercase",letterSpacing:.5,marginBottom:8}}>Documents ({documents.length})</div><div style={{display:"flex",flexDirection:"column",gap:4}}>{Object.entries(byType).map(([tag,docs])=>{const dt=docTypeOf(tag);return docs.map((d,i)=>(<div key={`${tag}-${i}`} style={{display:"flex",alignItems:"center",gap:8,padding:"8px 12px",background:"#fff",borderRadius:8,border:".5px solid var(--g200)"}}><span style={{fontSize:11,fontWeight:600,color:dt.color,background:`${dt.color}12`,padding:"2px 8px",borderRadius:6,whiteSpace:"nowrap"}}>{dt.label}</span><span style={{fontSize:13,color:"var(--g700)",flex:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{d.name}</span><span style={{fontSize:10,color:"var(--g400)",whiteSpace:"nowrap"}}>{fmtTime(d.addedAt)}</span></div>))})}</div></div>)}

function ActionCard({action,onAction}){const c=action.priority==="high"?{bg:"rgba(0,113,227,.05)",border:"rgba(0,113,227,.15)",accent:"var(--blue)"}:{bg:"var(--g50)",border:"var(--g200)",accent:"var(--g700)"};
return(<button onClick={()=>onAction(action)} style={{display:"flex",alignItems:"center",gap:12,padding:"14px 16px",width:"100%",background:c.bg,border:`.5px solid ${c.border}`,borderRadius:12,cursor:"pointer",textAlign:"left",transition:"all .2s"}}><div style={{width:32,height:32,borderRadius:8,background:action.priority==="high"?"var(--blue)":"var(--g200)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}><span style={{fontSize:14,color:action.priority==="high"?"#fff":"var(--g600)"}}>{action.action==="upload"?<svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5"/></svg>:action.action==="analyze"?<svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z"/></svg>:action.action.startsWith("stage:")?<svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3"/></svg>:<svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 01.865-.501 48.172 48.172 0 003.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z"/></svg>}</span></div><div style={{flex:1,minWidth:0}}><div style={{fontSize:14,fontWeight:600,color:c.accent}}>{action.label}</div><div style={{fontSize:12,color:"var(--g500)",marginTop:1,lineHeight:1.4}}>{action.desc}</div></div><span style={{color:"var(--g300)",fontSize:18,flexShrink:0}}>›</span></button>)}

function CaseSummaryCard({claim,onClick}){const s=stageOf(claim.stage);const rtw=getRTWProgress(claim);const lastRuling=claim.analyses?.[claim.analyses.length-1]?.ruling;const deadlines=getDeadlines(claim);const urgentDl=deadlines.find(d=>d.status==="overdue"||d.daysLeft<=3);
const pill=(color)=>({padding:"2px 10px",borderRadius:980,fontSize:11,fontWeight:600,color,background:`${color}10`,border:`.5px solid ${color}30`,whiteSpace:"nowrap"});
return(<div onClick={onClick} style={{padding:"16px",background:"#fff",borderRadius:14,border:".5px solid var(--g200)",cursor:"pointer",marginBottom:8,transition:"all .2s"}}><div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:8}}><div style={{display:"flex",alignItems:"center",gap:8,flex:1,minWidth:0}}><span style={{width:10,height:10,borderRadius:"50%",background:s.color,flexShrink:0}}/><span style={{fontSize:15,fontWeight:700}}>{claim.claimNumber}</span><span style={pill(s.color)}>{s.label}</span>{lastRuling&&<span style={pill(lastRuling==="Allow"?"var(--green)":lastRuling==="Deny"?"var(--red)":"var(--orange)")}>AI: {lastRuling}</span>}</div><span style={{color:"var(--g300)",fontSize:18,flexShrink:0}}>›</span></div>
<div style={{fontSize:13,color:"var(--g500)",marginBottom:6}}>{claim.worker} · {claim.employer} · {fmt(claim.injuryDate)}</div>
<div style={{display:"flex",gap:12,alignItems:"center",flexWrap:"wrap"}}>{rtw&&<div style={{display:"flex",alignItems:"center",gap:4}}><div style={{width:40,height:4,background:"var(--g200)",borderRadius:2,overflow:"hidden"}}><div style={{width:`${rtw.pct}%`,height:"100%",background:rtw.status==="delayed"?"var(--red)":"var(--blue)",borderRadius:2}}/></div><span style={{fontSize:10,color:"var(--g500)"}}>{rtw.label}</span></div>}
<span style={{fontSize:11,color:"var(--g400)"}}>{claim.documents?.length||0} docs · {claim.analyses?.length||0} analyses</span>
{urgentDl&&<span style={{fontSize:11,fontWeight:600,color:urgentDl.status==="overdue"?"var(--red)":"var(--orange)"}}>⏰ {urgentDl.label}: {urgentDl.daysLeft<0?`${Math.abs(urgentDl.daysLeft)}d overdue`:`${urgentDl.daysLeft}d`}</span>}</div></div>)}


/* ═══ Case Templates ═══ */
const CASE_TEMPLATES=[
{label:"Acute Back Injury",type:"Acute Injury",desc:"Worker sustained acute lumbar strain/sprain from lifting, bending, or twisting. Sudden onset of lower back pain.",icon:"BI"},
{label:"Slip & Fall",type:"Acute Injury",desc:"Worker slipped/tripped and fell at the workplace. May involve multiple body parts.",icon:"SF"},
{label:"Repetitive Strain",type:"Occupational Disease",desc:"Gradual onset of pain/dysfunction from repetitive workplace tasks. Common in upper extremity, shoulder, wrist.",icon:"RS"},
{label:"Occupational Hearing Loss",type:"Occupational Disease",desc:"Progressive hearing loss from prolonged exposure to workplace noise. Audiometric evidence required.",icon:"HL"},
{label:"First Responder PTSD",type:"PTSD (First Responder)",desc:"PTSD claim from first responder (police, fire, paramedic) with presumptive coverage under OPM 15-03-13.",icon:"PT"},
{label:"Workplace Mental Stress",type:"Traumatic Mental Stress",desc:"Acute or chronic mental stress arising from workplace events or conditions.",icon:"MS"},
{label:"Pre-existing Aggravation",type:"Aggravation of Pre-existing",desc:"Workplace incident aggravated a pre-existing condition. Thin skull principle may apply.",icon:"PA"},
{label:"Recurrence",type:"Recurrence",desc:"Return of symptoms from a previously accepted WSIB claim. Must show causal connection to original injury.",icon:"RC"},
];

/* ═══ Benefit Calculator ═══ */
function BenefitCalc({claim,onClose}){
const[earnings,setEarnings]=useState({gross:"",net:"",postInjury:""});
const[result,setResult]=useState(null);
const calc=()=>{const g=parseFloat(earnings.gross)||0;const n=parseFloat(earnings.net)||0;const pi=parseFloat(earnings.postInjury)||0;
const weeklyGross=g;const weeklyNet=n||g*0.72;const loe85=weeklyNet*0.85;const loeReduced=Math.max(0,loe85-pi);
const annualGross=g*52;let nelRange="N/A";let nelAmount="Pending assessment";
if(claim?.injuryType==="Acute Injury"){nelRange="0-10% (typical strain)";nelAmount="$0 - $10,515"}
if(claim?.injuryType==="Occupational Disease"){nelRange="5-30%";nelAmount="$5,258 - $31,545"}
if(/PTSD|Mental/.test(claim?.injuryType||"")){nelRange="10-35%";nelAmount="$10,515 - $36,803"}
setResult({weeklyGross,weeklyNet,loe85,loeReduced,annualGross,nelRange,nelAmount,
monthlyLOE:(loeReduced*52/12).toFixed(2),reviewDate:claim?.injuryDate?(() => {const d=new Date(claim.injuryDate);d.setMonth(d.getMonth()+72);return d.toISOString()})():null})};
return(<div onClick={e=>{if(e.target===e.currentTarget)onClose()}} style={{position:"fixed",inset:0,background:"rgba(0,0,0,.25)",backdropFilter:"blur(10px)",zIndex:200,display:"flex",alignItems:"center",justifyContent:"center",padding:16}}>
<div style={{background:"#fff",borderRadius:20,padding:"24px 20px",width:"100%",maxWidth:520,boxShadow:"0 20px 60px rgba(0,0,0,.15)",maxHeight:"90vh",overflowY:"auto"}}>
<div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}><h3 style={{fontSize:20,fontWeight:700,letterSpacing:-.5}}>Benefit Calculator</h3><button onClick={onClose} style={{background:"none",border:"none",cursor:"pointer",fontSize:18,color:"var(--g400)"}}>×</button></div>
<p style={{fontSize:13,color:"var(--g500)",marginBottom:16}}>Estimate LOE and NEL based on pre-injury earnings. These are estimates only — actual amounts determined by WSIB.</p>
<label style={{display:"block",fontSize:12,fontWeight:600,color:"var(--g500)",marginBottom:4}}>Pre-injury gross weekly earnings ($)</label>
<input type="number" value={earnings.gross} onChange={e=>setEarnings(p=>({...p,gross:e.target.value}))} placeholder="e.g. 980.00" style={{width:"100%",padding:"10px 14px",borderRadius:10,border:".5px solid var(--g200)",fontSize:14,outline:"none",background:"var(--g50)",fontFamily:"inherit",marginBottom:12}}/>
<label style={{display:"block",fontSize:12,fontWeight:600,color:"var(--g500)",marginBottom:4}}>Pre-injury net weekly earnings ($) <span style={{fontWeight:400}}>(optional, defaults to 72% of gross)</span></label>
<input type="number" value={earnings.net} onChange={e=>setEarnings(p=>({...p,net:e.target.value}))} placeholder="Auto-calculated if blank" style={{width:"100%",padding:"10px 14px",borderRadius:10,border:".5px solid var(--g200)",fontSize:14,outline:"none",background:"var(--g50)",fontFamily:"inherit",marginBottom:12}}/>
<label style={{display:"block",fontSize:12,fontWeight:600,color:"var(--g500)",marginBottom:4}}>Current post-injury weekly earnings ($) <span style={{fontWeight:400}}>(if doing modified work)</span></label>
<input type="number" value={earnings.postInjury} onChange={e=>setEarnings(p=>({...p,postInjury:e.target.value}))} placeholder="0 if fully off work" style={{width:"100%",padding:"10px 14px",borderRadius:10,border:".5px solid var(--g200)",fontSize:14,outline:"none",background:"var(--g50)",fontFamily:"inherit",marginBottom:16}}/>
<button onClick={calc} style={{width:"100%",padding:"12px",borderRadius:12,border:"none",background:"var(--blue)",color:"#fff",fontSize:14,fontWeight:600,cursor:"pointer"}}>Calculate Benefits</button>
{result&&<div style={{marginTop:16}}>
<div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:12}}>
<div style={{padding:12,background:"var(--blue-light)",borderRadius:10,border:".5px solid var(--blue-border)"}}><div style={{fontSize:10,fontWeight:600,color:"var(--blue)",textTransform:"uppercase",letterSpacing:.5}}>Weekly LOE (85%)</div><div style={{fontSize:20,fontWeight:800,color:"var(--blue)"}}>${result.loe85.toFixed(2)}</div></div>
<div style={{padding:12,background:"var(--green-light)",borderRadius:10,border:".5px solid rgba(52,199,89,.15)"}}><div style={{fontSize:10,fontWeight:600,color:"var(--green)",textTransform:"uppercase",letterSpacing:.5}}>Monthly LOE</div><div style={{fontSize:20,fontWeight:800,color:"var(--green)"}}>${result.monthlyLOE}</div></div>
<div style={{padding:12,background:"var(--g50)",borderRadius:10,border:".5px solid var(--g200)"}}><div style={{fontSize:10,fontWeight:600,color:"var(--g500)",textTransform:"uppercase",letterSpacing:.5}}>NEL Range</div><div style={{fontSize:14,fontWeight:600,color:"var(--g700)"}}>{result.nelRange}</div></div>
<div style={{padding:12,background:"var(--g50)",borderRadius:10,border:".5px solid var(--g200)"}}><div style={{fontSize:10,fontWeight:600,color:"var(--g500)",textTransform:"uppercase",letterSpacing:.5}}>NEL Amount</div><div style={{fontSize:14,fontWeight:600,color:"var(--g700)"}}>{result.nelAmount}</div></div>
</div>
<div style={{padding:12,background:"var(--g50)",borderRadius:10,border:".5px solid var(--g200)",fontSize:12,color:"var(--g600)",lineHeight:1.5}}>
<strong>LOE Calculation:</strong> 85% × ${result.weeklyNet.toFixed(2)} net = ${result.loe85.toFixed(2)}/week{result.loeReduced<result.loe85?` (reduced by $${(result.loe85-result.loeReduced).toFixed(2)} post-injury earnings)`:""}<br/>
<strong>Annual gross pre-injury:</strong> ${result.annualGross.toFixed(2)}<br/>
{result.reviewDate&&<><strong>72-month LOE review:</strong> {new Date(result.reviewDate).toLocaleDateString("en-CA",{month:"long",day:"numeric",year:"numeric"})}</>}
</div></div>}
</div></div>)}

/* ═══ Analytics Dashboard ═══ */
function AnalyticsDash({claims,onClose}){
const total=claims.length;const byStage={};const byType={};const byRuling={allow:0,deny:0,investigate:0};
claims.forEach(c=>{byStage[c.stage]=(byStage[c.stage]||0)+1;byType[c.injuryType]=(byType[c.injuryType]||0)+1;
(c.analyses||[]).forEach(a=>{if(a.ruling==="Allow")byRuling.allow++;else if(a.ruling==="Deny")byRuling.deny++;else byRuling.investigate++})});
const totalAnalyses=byRuling.allow+byRuling.deny+byRuling.investigate;
const avgDocs=total>0?Math.round(claims.reduce((s,c)=>s+(c.documents?.length||0),0)/total):0;
const avgAnalyses=total>0?Math.round(claims.reduce((s,c)=>s+(c.analyses?.length||0),0)/total*10)/10:0;

return(<div onClick={e=>{if(e.target===e.currentTarget)onClose()}} style={{position:"fixed",inset:0,background:"rgba(0,0,0,.25)",backdropFilter:"blur(10px)",zIndex:200,display:"flex",alignItems:"center",justifyContent:"center",padding:16}}>
<div style={{background:"#fff",borderRadius:20,padding:"24px 20px",width:"100%",maxWidth:640,boxShadow:"0 20px 60px rgba(0,0,0,.15)",maxHeight:"90vh",overflowY:"auto"}}>
<div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}><h3 style={{fontSize:20,fontWeight:700,letterSpacing:-.5}}>Analytics</h3><button onClick={onClose} style={{background:"none",border:"none",cursor:"pointer",fontSize:18,color:"var(--g400)"}}>×</button></div>

<div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(100px,1fr))",gap:8,marginBottom:20}}>
<div style={{padding:14,background:"var(--g50)",borderRadius:12,textAlign:"center"}}><div style={{fontSize:28,fontWeight:800}}>{total}</div><div style={{fontSize:10,color:"var(--g500)"}}>Total Cases</div></div>
<div style={{padding:14,background:"var(--green-light)",borderRadius:12,textAlign:"center"}}><div style={{fontSize:28,fontWeight:800,color:"var(--green)"}}>{byRuling.allow}</div><div style={{fontSize:10,color:"var(--g500)"}}>Allowed</div></div>
<div style={{padding:14,background:"var(--red-light)",borderRadius:12,textAlign:"center"}}><div style={{fontSize:28,fontWeight:800,color:"var(--red)"}}>{byRuling.deny}</div><div style={{fontSize:10,color:"var(--g500)"}}>Denied</div></div>
<div style={{padding:14,background:"var(--g50)",borderRadius:12,textAlign:"center"}}><div style={{fontSize:28,fontWeight:800}}>{avgDocs}</div><div style={{fontSize:10,color:"var(--g500)"}}>Avg Docs/Case</div></div>
</div>

{totalAnalyses>0&&<div style={{marginBottom:20}}><div style={{fontSize:12,fontWeight:700,color:"var(--g400)",textTransform:"uppercase",letterSpacing:.5,marginBottom:8}}>Ruling Distribution</div>
<div style={{height:24,display:"flex",borderRadius:8,overflow:"hidden",marginBottom:6}}>
{byRuling.allow>0&&<div style={{width:`${(byRuling.allow/totalAnalyses)*100}%`,background:"var(--green)",transition:"width .5s"}}/>}
{byRuling.deny>0&&<div style={{width:`${(byRuling.deny/totalAnalyses)*100}%`,background:"var(--red)",transition:"width .5s"}}/>}
{byRuling.investigate>0&&<div style={{width:`${(byRuling.investigate/totalAnalyses)*100}%`,background:"var(--orange)",transition:"width .5s"}}/>}
</div>
<div style={{display:"flex",gap:16,fontSize:12,color:"var(--g500)"}}>
<span><span style={{color:"var(--green)"}}>●</span> Allow {totalAnalyses>0?Math.round(byRuling.allow/totalAnalyses*100):0}%</span>
<span><span style={{color:"var(--red)"}}>●</span> Deny {totalAnalyses>0?Math.round(byRuling.deny/totalAnalyses*100):0}%</span>
<span><span style={{color:"var(--orange)"}}>●</span> Investigate {totalAnalyses>0?Math.round(byRuling.investigate/totalAnalyses*100):0}%</span>
</div></div>}

<div style={{marginBottom:20}}><div style={{fontSize:12,fontWeight:700,color:"var(--g400)",textTransform:"uppercase",letterSpacing:.5,marginBottom:8}}>Cases by Stage</div>
{Object.entries(byStage).sort((a,b)=>b[1]-a[1]).map(([stage,count])=>{const s=STAGES.find(x=>x.id===stage)||{label:stage,color:"var(--g400)"};return(
<div key={stage} style={{display:"flex",alignItems:"center",gap:8,marginBottom:6}}>
<span style={{width:10,height:10,borderRadius:"50%",background:s.color,flexShrink:0}}/>
<span style={{fontSize:13,color:"var(--g700)",flex:1}}>{s.label}</span>
<div style={{width:120,height:6,background:"var(--g200)",borderRadius:3,overflow:"hidden"}}><div style={{width:`${(count/total)*100}%`,height:"100%",background:s.color,borderRadius:3}}/></div>
<span style={{fontSize:12,fontWeight:600,color:"var(--g700)",minWidth:24,textAlign:"right"}}>{count}</span>
</div>)})}</div>

<div><div style={{fontSize:12,fontWeight:700,color:"var(--g400)",textTransform:"uppercase",letterSpacing:.5,marginBottom:8}}>Cases by Injury Type</div>
{Object.entries(byType).sort((a,b)=>b[1]-a[1]).map(([type,count])=>(
<div key={type} style={{display:"flex",alignItems:"center",gap:8,marginBottom:6}}>
<span style={{fontSize:13,color:"var(--g700)",flex:1}}>{type}</span>
<div style={{width:120,height:6,background:"var(--g200)",borderRadius:3,overflow:"hidden"}}><div style={{width:`${(count/total)*100}%`,height:"100%",background:"var(--blue)",borderRadius:3}}/></div>
<span style={{fontSize:12,fontWeight:600,color:"var(--g700)",minWidth:24,textAlign:"right"}}>{count}</span>
</div>))}</div>
</div></div>)}

/* === Document Q&A Questions === */
const DOC_QUESTIONS=["What medications were prescribed?","What is the primary diagnosis and ICD-10 code?","When was the injury first reported?","What are the current functional limitations?","What is the recommended treatment plan?","When is the expected return-to-work date?","Are there any pre-existing conditions?","What imaging or tests were ordered?","Does the employer dispute this claim?","Who were the treating physicians?","What is the mechanism of injury?","Are there inconsistencies between documents?"];

const STAGE_QUESTIONS={new:["Is this compensable under WSIB?","Any jurisdictional issues?","What is the mechanism of injury?","Was reporting timely?"],review:["Does medical evidence support diagnosis?","Are there treatment gaps?","Is the employer disputing?","What evidence is needed?"],investigating:["What evidence is missing?","Are there contradictions?","Should we request an IME?"],approved:["Is RTW progressing as expected?","Should benefits be adjusted?"],denied:["What are the denial grounds?","Which OPM sections support appeal?","Does benefit of doubt apply?"],appeal:["Strongest appeal argument?","Precedent WSIAT decisions?","What evidence gaps to fill?"],closed:["Should this be reopened?"]};

/* === Red Flag Engine === */
function getRedFlags(c){const f=[];if(!c)return f;const inj=c.injuryDate&&c.injuryDate!=="\u2014"?new Date(c.injuryDate):null;const cr=new Date(c.createdAt);const docs=c.documents||[];const has=t=>docs.some(d=>d.tag===t);
if(inj){const rd=Math.floor((cr-inj)/(864e5));if(rd>7)f.push({severity:"high",label:"Late reporting ("+rd+"d)",desc:"Claim created "+rd+" days after injury",icon:"●"});if(rd>21)f.push({severity:"critical",label:"Severely delayed reporting",desc:rd+"-day delay raises credibility concerns",icon:"●"})}
if(!has("form6")&&docs.length>0)f.push({severity:"medium",label:"Missing Form 6",desc:"Worker report not on file",icon:"●"});
if(!has("form7")&&docs.length>0)f.push({severity:"high",label:"Missing Form 7",desc:"Employer report not on file",icon:"●"});
if(!has("form8")&&c.stage!=="new")f.push({severity:"medium",label:"Missing Form 8",desc:"Health professional report missing",icon:"●"});
if(!docs.some(d=>["medical","imaging","specialist","physio"].includes(d.tag))&&c.stage!=="new")f.push({severity:"medium",label:"No medical evidence",desc:"No medical reports on file",icon:"●"});
if(/pre-existing|aggravation/i.test(c.injuryType||""))f.push({severity:"medium",label:"Pre-existing condition",desc:"Thin skull principle may apply",icon:"●"});
if(c.analyses?.length>1&&new Set(c.analyses.map(a=>a.ruling)).size>1)f.push({severity:"medium",label:"Inconsistent rulings",desc:"Multiple analyses produced different outcomes",icon:"●"});
if(inj&&Math.floor((Date.now()-inj)/864e5)>90&&c.stage==="new")f.push({severity:"high",label:"Stale claim",desc:"In New status over 90 days",icon:"●"});
return f.sort((a,b)=>({critical:0,high:1,medium:2,low:3}[a.severity]||3)-({critical:0,high:1,medium:2,low:3}[b.severity]||3))}

/* === Claim Strength Score === */
function getClaimStrength(claim){if(!claim)return null;let s=0,mx=0;const f=[];const docs=claim.documents||[];const has=t=>docs.some(d=>d.tag===t);
const chk=(l,met,pts)=>{mx+=pts;if(met)s+=pts;f.push({label:l,met})};
chk("Form 6",has("form6"),15);chk("Form 7",has("form7"),15);chk("Form 8",has("form8"),10);
chk("Medical evidence",docs.some(d=>["medical","imaging","specialist","physio"].includes(d.tag)),15);chk("Witness",has("witness"),10);
const inj=claim.injuryDate&&claim.injuryDate!=="\u2014"?new Date(claim.injuryDate):null;
if(inj)chk("Timely reporting",Math.floor((new Date(claim.createdAt)-inj)/864e5)<=3,5);
chk("Detailed description",(claim.description?.length||0)>50,10);
const lr=claim.analyses?.[claim.analyses.length-1]?.ruling;
if(lr==="Allow"){mx+=10;s+=10;f.push({label:"AI: Allow",met:true})}else if(lr==="Deny"){mx+=10;f.push({label:"AI: Deny",met:false})}else if(lr){mx+=10;s+=5;f.push({label:"AI: Investigate",met:null})}
chk("No critical flags",getRedFlags(claim).filter(x=>x.severity==="critical"||x.severity==="high").length===0,10);
const pct=mx>0?Math.round(s/mx*100):0;return{score:pct,grade:pct>=80?"Strong":pct>=60?"Moderate":pct>=40?"Weak":"Insufficient",color:pct>=80?"var(--green)":pct>=60?"var(--blue)":pct>=40?"var(--orange)":"var(--red)",factors:f}}

/* === What is Missing === */
function getWhatsNeeded(c){if(!c)return[];const n=[];const docs=c.documents||[];const has=t=>docs.some(d=>d.tag===t);
if(!has("form6"))n.push({label:"Form 6 (Worker Report)",priority:"required",desc:"Essential for claim establishment"});
if(!has("form7"))n.push({label:"Form 7 (Employer Report)",priority:"required",desc:"Must be filed within 3 business days"});
if(!has("form8")&&c.stage!=="new")n.push({label:"Form 8 (Health Professional)",priority:"required",desc:"Medical confirmation"});
if(!docs.some(d=>["medical","specialist"].includes(d.tag))&&c.stage!=="new")n.push({label:"Medical report",priority:"recommended",desc:"Clinical evidence"});
if(!has("imaging")&&/back|lumbar|spinal|fracture|disc/i.test(c.description||""))n.push({label:"Diagnostic imaging",priority:"recommended",desc:"Objective evidence"});
if(!(c.analyses?.length)&&c.stage!=="closed")n.push({label:"AI analysis",priority:"recommended",desc:"Run the Five Point Check"});
return n}

/* === Cost Forecast === */
function getClaimCostForecast(c){if(!c?.injuryDate||c.injuryDate==="\u2014")return null;
const r={"Acute Injury":{l:8000,h:25000,w:6},"Occupational Disease":{l:15000,h:80000,w:16},"Traumatic Mental Stress":{l:12000,h:45000,w:12},"Chronic Mental Stress":{l:20000,h:90000,w:20},"PTSD (First Responder)":{l:15000,h:60000,w:12},"Recurrence":{l:5000,h:20000,w:6},"Aggravation of Pre-existing":{l:10000,h:50000,w:10}}[c.injuryType]||{l:10000,h:40000,w:8};
const we=Math.floor((Date.now()-new Date(c.injuryDate))/(864e5*7));return{lowEst:r.l,highEst:r.h,avgWeeks:r.w,weeksElapsed:we,expectedResolution:Math.max(1,r.w-we)}}

/* === Notifications === */
function getNotifications(claims){const n=[];claims.forEach(c=>{
getDeadlines(c).forEach(d=>{if(d.status==="overdue")n.push({type:"urgent",icon:"●",title:c.claimNumber+": "+d.label,desc:"Overdue by "+Math.abs(d.daysLeft)+" days",caseId:c.id});else if(d.daysLeft<=3&&d.daysLeft>=0)n.push({type:"warning",icon:"●",title:c.claimNumber+": "+d.label,desc:"Due in "+d.daysLeft+" days",caseId:c.id})});
if(c.stage==="new"&&!c.analyses?.length)n.push({type:"info",icon:"●",title:c.claimNumber+": Needs analysis",desc:"Run the AI adjudication",caseId:c.id});
const fl=getRedFlags(c).filter(f=>f.severity==="critical"||f.severity==="high");if(fl.length)n.push({type:"urgent",icon:"●",title:c.claimNumber+": "+fl.length+" red flag"+(fl.length>1?"s":""),desc:fl[0].label,caseId:c.id});
const miss=getWhatsNeeded(c).filter(m=>m.priority==="required");if(miss.length&&c.stage!=="closed")n.push({type:"warning",icon:"●",title:c.claimNumber+": Missing docs",desc:miss.map(m=>m.label).join(", "),caseId:c.id})});
return n.sort((a,b)=>({urgent:0,warning:1,info:2}[a.type]||2)-({urgent:0,warning:1,info:2}[b.type]||2))}

/* === Benchmarks === */
function getBenchmark(t){return{"Acute Injury":{d:14,docs:5,an:2,rate:82},"Occupational Disease":{d:35,docs:8,an:3,rate:65},"Traumatic Mental Stress":{d:28,docs:6,an:3,rate:58},"PTSD (First Responder)":{d:21,docs:5,an:2,rate:88},"Recurrence":{d:10,docs:4,an:2,rate:75},"Aggravation of Pre-existing":{d:28,docs:7,an:3,rate:62}}[t]||{d:21,docs:5,an:2,rate:70}}

/* === GLOSSARY === */
const GLOSSARY={
"Form 6":"Worker's Report of Injury/Disease. Filed by the injured worker to report what happened, when, where, and how. This is the worker's own account of the incident.",
"Form 7":"Employer's Report of Injury/Disease. Filed by the employer to WSIB within 3 business days of learning of the injury. Includes job duties, witness info, and modified work availability.",
"Form 8":"Health Professional's Report. Filed by the treating physician confirming the diagnosis, treatment plan, functional limitations, and expected recovery timeline.",
"LOE":"Loss of Earnings benefits. Paid at 85% of the worker's pre-injury net earnings. Reviewed at 72 months.",
"NEL":"Non-Economic Loss benefit. A lump-sum payment for permanent impairment, based on the degree of impairment (1-100%).",
"OPM":"Operational Policy Manual. The WSIB's official policy guide used by adjudicators to make claim decisions.",
"RTW":"Return to Work. The process of safely transitioning an injured worker back to their job, potentially with modified duties.",
"WSIAT":"Workplace Safety and Insurance Appeals Tribunal. The final level of appeal, independent from WSIB.",
"ARO":"Appeals Resolution Officer. The first level of appeal within WSIB's Appeals Services Division.",
"ASD":"Appeals Services Division. The WSIB department that handles formal appeals after an Intent to Object is filed.",
"Five Point Check":"The 5 criteria every claim must meet: (1) active employer account, (2) worker performing duties, (3) injury/disease occurred, (4) arose from employment, (5) resulting disability.",
"FROI":"First Report of Injury. The initial report filed when a workplace injury occurs.",
"Thin Skull":"Legal principle: WSIB takes the worker as they find them. A pre-existing condition does not bar a claim if work aggravated it.",
"Benefit of Doubt":"OPM 11-01-13: When evidence is approximately equal for and against, the issue is resolved in favor of the worker.",
"IME":"Independent Medical Examination. An assessment by a physician chosen by WSIB or the employer to evaluate the worker's condition.",
"COLA":"Cost of Living Adjustment. Annual adjustment to long-term LOE benefits based on CPI.",
"AWW":"Average Weekly Wage. The baseline earnings figure used to calculate LOE benefits.",
"Modified Duties":"Temporary alternative work tasks that accommodate the worker's functional limitations during recovery.",
"Recurrence":"A return of symptoms or disability from a previously allowed claim, without a new workplace incident.",
"Aggravation":"Worsening of a pre-existing condition caused by a workplace incident. The thin skull principle applies.",
"PTSD Presumptive":"OPM 15-03-13: First responders with diagnosed PTSD are presumed to have a work-related condition unless proven otherwise.",
"Section 111":"CMS reporting requirement for Medicare-eligible claimants. Ensures proper coordination of benefits.",
"72-Month Review":"Mandatory review of LOE benefits at the 72-month mark. Benefits may continue, be reduced, or be converted to a FEL supplement."
};

/* === APPEAL STAGES === */
const APPEAL_STAGES=[
{id:"intent",label:"Intent to Object",desc:"File within 30 days (RTW) or 6 months (other). Notify WSIB you disagree with their decision.",deadline:"30 days (RTW) / 6 months (other)",docs:["Intent to Object form","Copy of WSIB decision letter","Brief statement of disagreement"],status:"pending"},
{id:"reconsider",label:"Reconsideration",desc:"WSIB reviews the original decision with any new evidence you provide.",deadline:"No fixed timeline",docs:["New medical evidence","Updated functional abilities form","Employer response (if applicable)"],status:"pending"},
{id:"aro",label:"ARO Hearing",desc:"Appeals Resolution Officer reviews your case. Usually a written or oral hearing.",deadline:"Decision within 30 days target",docs:["Appeal Readiness Form","All supporting medical records","Legal submissions","Witness statements"],status:"pending"},
{id:"wsiat",label:"WSIAT Tribunal",desc:"Final appeal to the independent Workplace Safety and Insurance Appeals Tribunal.",deadline:"Must file within 6 months of ARO decision",docs:["Notice of Appeal to WSIAT","Complete case file","Legal brief","Expert medical opinions"],status:"pending"}
];

/* === INTAKE WIZARD STEPS === */
const INTAKE_STEPS=[
{id:"worker",label:"Worker Info",fields:["worker","employer"]},
{id:"injury",label:"Injury Details",fields:["injuryDate","injuryType","description"]},
{id:"documents",label:"Documents",fields:["documents"]},
{id:"review",label:"Review",fields:[]}
];


/* ═══════════════════════════════════════════════════════════════════
   MAIN APP
   ═══════════════════════════════════════════════════════════════════ */
export default function DashboardClient({user}){const[view,setView]=useState("home");const[claims,setClaims]=useState([]);const[active,setActive]=useState(null);const[msgs,setMsgs]=useState([]);const[input,setInput]=useState("");const[loading,setLoading]=useState(false);const[files,setFiles]=useState([]);const[fc,setFc]=useState({});const[modal,setModal]=useState(null);const[nf,setNf]=useState({claimNumber:"",worker:"",employer:"",injuryDate:"",injuryType:"Acute Injury",description:""});const[noteIn,setNoteIn]=useState("");const[filter,setFilter]=useState("all");const[searchQ,setSearchQ]=useState("");const[detailTab,setDetailTab]=useState("overview");const[showCalc,setShowCalc]=useState(false);const[showAnalytics,setShowAnalytics]=useState(false);const[showTemplates,setShowTemplates]=useState(false);const[bulkSelect,setBulkSelect]=useState([]);const[showNotifs,setShowNotifs]=useState(false);const[showGlossary,setShowGlossary]=useState(false);const[glossarySearch,setGlossarySearch]=useState("");const[homeTab,setHomeTab]=useState("overview");const[commLog,setCommLog]=useState({to:"",method:"email",date:"",note:""});const fRef=useRef(null);const endRef=useRef(null);const taRef=useRef(null);

useEffect(()=>{const handler=(e)=>{if(e.target.tagName==="INPUT"||e.target.tagName==="TEXTAREA"||e.target.tagName==="SELECT")return;if(e.key==="n"&&!e.metaKey&&!e.ctrlKey){e.preventDefault();setModal("new")}if(e.key==="s"&&!e.metaKey&&!e.ctrlKey){e.preventDefault();nav("claims")}if(e.key==="a"&&!e.metaKey&&!e.ctrlKey){e.preventDefault();setActive(null);setMsgs([]);nav("chat")}if(e.key==="h"&&!e.metaKey&&!e.ctrlKey){e.preventDefault();nav("home")}if(e.key==="Escape"){setModal(null);setShowCalc(false);setShowAnalytics(false);setShowTemplates(false)}};window.addEventListener("keydown",handler);return()=>window.removeEventListener("keydown",handler)},[]);
useEffect(()=>{setClaims(loadClaims(user.email))},[user.email]);
useEffect(()=>{if(claims.length>0||window.localStorage.getItem(storageKey(user.email)))persistClaims(user.email,claims)},[claims,user.email]);
useEffect(()=>{endRef.current?.scrollIntoView({behavior:"smooth"})},[msgs,loading]);

const saveClaim=(c)=>{c.updatedAt=new Date().toISOString();c.ownerEmail=user.email.toLowerCase();setClaims(p=>{const idx=p.findIndex(x=>x.id===c.id);const n=[...p];if(idx>=0)n[idx]=c;else n.unshift(c);return n});setActive(c)};
const createClaim=()=>{const id=Date.now().toString(36)+Math.random().toString(36).slice(2,6);const c={id,claimNumber:nf.claimNumber||`CL-${id.slice(0,6).toUpperCase()}`,worker:nf.worker||"—",employer:nf.employer||"—",injuryDate:nf.injuryDate||"—",injuryType:nf.injuryType,description:nf.description||"",stage:"new",ownerEmail:user.email.toLowerCase(),timeline:[{date:new Date().toISOString(),type:"created",note:"Case created"}],documents:[],analyses:[],messages:[],notes:[],createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()};saveClaim(c);setNf({claimNumber:"",worker:"",employer:"",injuryDate:"",injuryType:"Acute Injury",description:""});setModal(null);openClaim(c)};
const openClaim=c=>{setActive(c);setMsgs(c.messages||[]);setView("detail");setDetailTab("overview")};
const openChat=(c,p)=>{if(c){setActive(c);setMsgs(c.messages||[])}setView("chat");if(p)setTimeout(()=>send(p),150)};
const nav=v=>{setView(v)};
const changeStage=sid=>{const c={...active,stage:sid,timeline:[...(active.timeline||[]),{date:new Date().toISOString(),type:"stage",note:`Status → ${stageOf(sid).label}`}]};saveClaim(c);setModal(null)};
const addNote=()=>{if(!noteIn.trim())return;const c={...active,notes:[...(active.notes||[]),{date:new Date().toISOString(),text:noteIn.trim()}],timeline:[...(active.timeline||[]),{date:new Date().toISOString(),type:"note",note:noteIn.trim()}]};saveClaim(c);setNoteIn("")};
const delClaim=id=>{setClaims(p=>{const next=p.filter(c=>c.id!==id);persistClaims(user.email,next);return next});if(active?.id===id){setActive(null);setView("claims")}};
const addFiles=useCallback(e=>{const n=Array.from(e.target.files);setFiles(p=>[...p,...n]);n.forEach(f=>{const r=new FileReader();r.onload=ev=>setFc(p=>({...p,[f.name]:ev.target.result}));r.readAsText(f)});e.target.value=""},[]);
const rmFile=n=>{setFiles(p=>p.filter(f=>f.name!==n));setFc(p=>{const x={...p};delete x[n];return x})};
const handleAction=(a)=>{if(a.action==="upload"){fRef.current?.click();return}if(a.action==="analyze"){openChat(active,"Run a full adjudication analysis on this claim. Apply the Five Point Check, evaluate medical evidence, and give me a ruling prediction.");return}if(a.action.startsWith("stage:")){changeStage(a.action.split(":")[1]);return}if(a.action.startsWith("prompt:")){openChat(active,a.action.replace("prompt:",""));return}};

const send=async(override)=>{const text=override||input.trim();if(!text&&files.length===0)return;setInput("");if(taRef.current)taRef.current.style.height="auto";let content=text;const af=[...files];if(af.length>0&&Object.keys(fc).length>0)content=`${text||"Please analyze these claim documents."}\n\n[UPLOADED DOCUMENTS]\n${Object.entries(fc).map(([n,c])=>`── ${n} ──\n${c}`).join("\n\n────\n\n")}`;if(active)content=`[CLAIM CONTEXT]\nClaim #: ${active.claimNumber}\nWorker: ${active.worker}\nEmployer: ${active.employer}\nInjury Date: ${active.injuryDate}\nType: ${active.injuryType}\nStatus: ${stageOf(active.stage).label}\nDescription: ${active.description||"N/A"}\nDays since injury: ${active.injuryDate!=="—"?daysAgo(active.injuryDate):"unknown"}\nDocuments on file: ${active.documents?.length||0}\nPrevious analyses: ${active.analyses?.length||0}\n\n${content}`;const um={role:"user",display:text||`Uploaded ${af.length} document${af.length>1?"s":""}`,content,files:af.map(f=>f.name),ts:new Date().toISOString()};const newMsgs=[...msgs,um];setMsgs(newMsgs);setFiles([]);setFc({});setLoading(true);
if(active&&af.length>0){const c={...active};c.documents=[...(c.documents||[]),...af.map(f=>({name:f.name,tag:guessDocType(f.name),addedAt:new Date().toISOString()}))];c.timeline=[...(c.timeline||[]),...af.map(f=>({date:new Date().toISOString(),type:"document",note:`Uploaded: ${f.name}`}))];saveClaim(c)}
try{const hist=newMsgs.slice(-20).map(m=>({role:m.role==="user"?"user":"assistant",content:m.content}));const res=await fetch("/api/chat",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({messages:hist})});const data=await res.json();if(!res.ok)throw new Error(data.error||"Request failed");const reply=data.reply;const am={role:"assistant",content:reply,ts:new Date().toISOString()};const final=[...newMsgs,am];setMsgs(final);if(active){const c={...active,messages:final};if(/RULING PREDICTION|Five Point Check/i.test(reply)){const ruling=/Allow/i.test(reply)&&!/Deny/i.test(reply.split("RULING")[1]||"")?"Allow":/Deny/i.test(reply)?"Deny":"Further Investigation";c.analyses=[...(c.analyses||[]),{date:new Date().toISOString(),ruling,snippet:reply.slice(0,200)}];c.timeline=[...(c.timeline||[]),{date:new Date().toISOString(),type:"analysis",note:`AI analysis — Ruling: ${ruling}`}];if(c.stage==="new"){c.stage="review";c.timeline.push({date:new Date().toISOString(),type:"stage",note:"Status → Under Review"})}}saveClaim(c)}}catch(err){setMsgs(p=>[...p,{role:"assistant",content:`**Error:** ${err.message}`,ts:new Date().toISOString()}])}finally{setLoading(false)}};

const scenarios=[{l:"Back injury claim",t:"A warehouse worker injured their lower back lifting a 50lb box on March 3, 2026. Reported same day, Form 7 filed March 5. Doctor diagnosed lumbar strain (M54.5), recommended 4 weeks off. No pre-existing conditions. What would WSIB rule?"},{l:"Disputed late reporting",t:"A construction worker reports a shoulder injury 3 weeks after the alleged incident. No witnesses. Employer is disputing. How would WSIB approach this?"},{l:"Pre-existing aggravation",t:"Worker has documented degenerative disc disease at L4-L5. Claims a workplace slip aggravated this, now needs surgery. How does the thin skull principle apply?"},{l:"First responder PTSD",t:"A paramedic with 12 years of service is filing a PTSD claim after a fatal MVA involving children. What does OPM 15-03-13 say about presumptive coverage?"}];
const filtered=filter==="all"?claims:claims.filter(c=>c.stage===filter);
const displayed=searchQ?searchClaims(filtered,searchQ):filtered;
const recentClaims=claims.slice(0,5);
const stageCounts=STAGES.map(s=>({...s,count:claims.filter(c=>c.stage===s.id).length})).filter(s=>s.count>0);
const needsAttention=claims.filter(c=>["new","investigating"].includes(c.stage)||getDeadlines(c).some(d=>d.status==="overdue"));
const pill=(color)=>({padding:"2px 10px",borderRadius:980,fontSize:11,fontWeight:600,color,background:`${color}10`,border:`.5px solid ${color}30`,whiteSpace:"nowrap"});

return(<><style jsx global>{`
.ai-text{font-size:15px;line-height:1.7;color:var(--g700)}.ai-text strong{font-weight:600;color:var(--g900)}.ai-h{font-weight:700;color:var(--g900);letter-spacing:-.5px}.ai-h1{font-size:22px;margin:28px 0 10px}.ai-h2{font-size:17px;margin:24px 0 6px}.ai-h3{font-size:15px;margin:18px 0 4px}.ai-p{margin-top:4px}
.ai-ruling{padding:16px 20px;border-radius:12px;margin:18px 0 10px;font-size:16px;font-weight:700;letter-spacing:-.3px;display:flex;align-items:center;gap:10px}.ai-rdot{width:10px;height:10px;border-radius:50%;flex-shrink:0}
.ai-ruling.allow{background:var(--green-light);color:#1B7D36;border:.5px solid rgba(52,199,89,.15)}.ai-ruling.allow .ai-rdot{background:var(--green)}.ai-ruling.deny{background:var(--red-light);color:#CC2D26;border:.5px solid var(--red-border)}.ai-ruling.deny .ai-rdot{background:var(--red)}.ai-ruling.inv{background:rgba(255,149,0,.06);color:#A66A00;border:.5px solid rgba(255,149,0,.12)}.ai-ruling.inv .ai-rdot{background:#FF9500}
.ai-flag{padding:12px 16px;border-radius:8px;margin:8px 0 4px;font-size:13px;font-weight:500;color:#CC2D26;background:var(--red-light);border:.5px solid var(--red-border)}.ai-opm{display:inline-block;padding:3px 10px;border-radius:6px;margin:4px 0;font-family:'DM Mono',monospace;font-size:12px;font-weight:500;color:var(--blue);background:var(--blue-light);border:.5px solid var(--blue-border)}
.ai-chk{display:flex;align-items:flex-start;gap:10px;padding:12px 16px;border-radius:8px;margin:6px 0;font-size:14px}.ai-ci{width:22px;height:22px;border-radius:50%;flex-shrink:0;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:800}.ai-chk.pass{background:var(--green-light);border:.5px solid rgba(52,199,89,.15)}.ai-chk.pass .ai-ci{background:var(--green);color:white}.ai-chk.fail{background:var(--red-light);border:.5px solid var(--red-border)}.ai-chk.fail .ai-ci{background:var(--red);color:white}
.ai-li{padding-left:18px;position:relative;margin-top:4px;font-size:14px}.ai-li::before{content:'';position:absolute;left:4px;top:10px;width:5px;height:5px;border-radius:50%;background:var(--g300)}.ai-ol{display:flex;gap:10px;margin-top:5px;font-size:14px}.ai-oln{font-weight:700;color:var(--blue);font-size:12px;font-family:'DM Mono',monospace;min-width:18px;text-align:right;margin-top:3px}
.desktop-nav{display:flex}
.mobile-bnav{display:none}
@media(max-width:768px){.desktop-nav{display:none!important}.mobile-bnav{display:flex!important}.ai-h1{font-size:18px!important}.ai-h2{font-size:15px!important}.ai-ruling{font-size:14px;padding:12px 14px}.ai-text{font-size:14px}}
`}</style>
<div style={{height:"100vh",display:"flex",flexDirection:"column"}}>

{/* NAV */}
<nav style={{height:64,padding:"0 24px",display:"flex",alignItems:"center",justifyContent:"space-between",background:"rgba(250,251,252,.85)",backdropFilter:"saturate(180%) blur(20px)",borderBottom:"1px solid rgba(0,0,0,.04)",flexShrink:0,zIndex:100}}>
  <div style={{display:"flex",alignItems:"center",gap:8,cursor:"pointer"}} onClick={()=>nav("home")}><div style={{width:28,height:28,borderRadius:7,background:"var(--g900)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}><svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="#fff" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z"/></svg></div><span style={{fontSize:15,fontWeight:700,letterSpacing:-0.3}}>CaseAssist</span></div>
  <div style={{display:"flex",gap:2}} className="desktop-nav">{[{id:"home",label:"Home"},{id:"claims",label:"My Cases"},{id:"advisor",label:"Advisor"}].map(t=>(<button key={t.id} onClick={()=>{if(t.id==="advisor"){setActive(null);setMsgs([]);nav("chat")}else nav(t.id)}} style={{padding:"6px 14px",borderRadius:980,fontSize:13,fontWeight:500,color:(view===t.id||(t.id==="advisor"&&view==="chat"&&!active))?"#fff":"var(--g600)",background:(view===t.id||(t.id==="advisor"&&view==="chat"&&!active))?"var(--g900)":"transparent",border:"none",cursor:"pointer"}}>{t.label}</button>))}</div>
  <div style={{display:"flex",gap:6,alignItems:"center"}}><button onClick={()=>setShowNotifs(!showNotifs)} style={{padding:"7px 10px",borderRadius:980,border:"1px solid var(--g200)",background:showNotifs?"var(--g900)":"#fff",color:showNotifs?"#fff":"var(--g500)",cursor:"pointer",position:"relative",display:"flex",alignItems:"center",justifyContent:"center"}}><svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8"><path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0"/></svg></button><button onClick={()=>setShowGlossary(!showGlossary)} style={{padding:"7px 10px",borderRadius:980,border:"1px solid var(--g200)",background:showGlossary?"var(--g900)":"#fff",color:showGlossary?"#fff":"var(--g500)",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}><svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8"><path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25"/></svg></button><button onClick={()=>setShowTemplates(true)} style={{padding:"7px 10px",borderRadius:980,border:"1px solid var(--g200)",background:"#fff",color:"var(--g500)",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}} title="Templates"><svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8"><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 7.5V6.108c0-1.135.845-2.098 1.976-2.192.373-.03.748-.057 1.123-.08M15.75 18H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08M15.75 18.75v-1.875a3.375 3.375 0 00-3.375-3.375h-1.5a1.125 1.125 0 01-1.125-1.125v-1.5A3.375 3.375 0 006.375 7.5H5.25m11.9-3.664A2.251 2.251 0 0015 2.25h-1.5a2.251 2.251 0 00-2.15 1.586m5.8 0c.065.21.1.433.1.664v.75h-6V4.5c0-.231.035-.454.1-.664M6.75 7.5H4.875c-.621 0-1.125.504-1.125 1.125v12c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V16.5a9 9 0 00-9-9z"/></svg></button><button onClick={()=>setShowAnalytics(true)} style={{padding:"7px 10px",borderRadius:980,border:"1px solid var(--g200)",background:"#fff",color:"var(--g500)",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}} title="Analytics"><svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8"><path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z"/></svg></button><button onClick={()=>setModal("new")} style={{padding:"7px 14px",borderRadius:980,fontSize:12,fontWeight:600,border:"none",background:"var(--blue)",color:"#fff",cursor:"pointer",whiteSpace:"nowrap"}}>+ New Case</button><button onClick={()=>signOut({callbackUrl:"/login"})} style={{padding:"7px 10px",borderRadius:980,fontSize:11,fontWeight:500,border:".5px solid var(--g300)",background:"transparent",color:"var(--g500)",cursor:"pointer"}}>Sign Out</button></div>
</nav>

{/* MOBILE NAV */}
<div className="mobile-bnav" style={{display:"none",position:"fixed",bottom:0,left:0,right:0,height:56,background:"rgba(255,255,255,.92)",backdropFilter:"saturate(180%) blur(20px)",borderTop:".5px solid rgba(0,0,0,.08)",zIndex:100,justifyContent:"space-around",alignItems:"center",padding:"0 8px"}}>{[{id:"home",label:"Home",icon:"H"},{id:"claims",label:"Cases",icon:"C"},{id:"chat",label:"Advisor",icon:"A"}].map(t=>(<button key={t.id} onClick={()=>{if(t.id==="chat"){setActive(null);setMsgs([])}nav(t.id)}} style={{display:"flex",flexDirection:"column",alignItems:"center",gap:2,background:"none",border:"none",cursor:"pointer",padding:"4px 12px"}}><span style={{fontSize:14,color:view===t.id||(t.id==="chat"&&view==="chat")?"var(--blue)":"var(--g400)"}}>{t.icon}</span><span style={{fontSize:10,fontWeight:600,color:view===t.id||(t.id==="chat"&&view==="chat")?"var(--blue)":"var(--g400)"}}>{t.label}</span></button>))}</div>

{/* == HOME == */}
{view==="home"&&(<div style={{flex:1,overflowY:"auto"}}><div className="fade-in" style={{maxWidth:960,margin:"0 auto",padding:"32px 28px 100px"}}>

{claims.length===0?(<div style={{textAlign:"center",padding:"60px 0 40px"}}>
  <div style={{display:"inline-flex",alignItems:"center",gap:8,padding:"5px 16px 5px 6px",borderRadius:980,background:"#fff",border:"1px solid var(--g200)",marginBottom:24,boxShadow:"0 1px 4px rgba(0,0,0,.03)"}}>
    <span style={{width:22,height:22,borderRadius:"50%",background:"var(--green)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,color:"#fff"}}>{"\u2713"}</span>
    <span style={{fontSize:12,fontWeight:600,color:"var(--g600)"}}>WSIB OPM Connected</span>
  </div>
  <h1 style={{fontSize:"clamp(32px, 6vw, 52px)",fontWeight:800,letterSpacing:"-0.04em",lineHeight:1.02,marginBottom:16}}>Claims intelligence,<br/><span style={{background:"linear-gradient(135deg, #0071E3, #34C759)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"}}>made simple.</span></h1>
  <p style={{fontSize:17,color:"var(--g500)",maxWidth:480,margin:"0 auto",lineHeight:1.65,marginBottom:32}}>Create your first case to start analyzing claims against the WSIB Operational Policy Manual.</p>
  <div style={{display:"flex",gap:12,justifyContent:"center",flexWrap:"wrap",marginBottom:48}}>
    <button onClick={()=>setModal("new")} style={{padding:"14px 32px",borderRadius:980,fontSize:16,fontWeight:700,border:"none",background:"var(--blue)",color:"#fff",cursor:"pointer",boxShadow:"0 4px 16px rgba(0,113,227,.3)"}}>Create your first case</button>
    <button onClick={()=>{setActive(null);setMsgs([]);nav("chat")}} style={{padding:"14px 32px",borderRadius:980,fontSize:16,fontWeight:600,border:"1px solid var(--g300)",background:"#fff",color:"var(--g900)",cursor:"pointer"}}>Ask the advisor</button>
  </div>
  <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit, minmax(220px, 1fr))",gap:12,maxWidth:700,margin:"0 auto"}}>
    {[{icon:"\u2696\uFE0F",title:"AI Ruling Predictions",desc:"Five Point Check against the WSIB OPM"},{icon:"●",title:"Document Intelligence",desc:"Auto-tagged forms and medical reports"},{icon:"●",title:"Deadline Tracking",desc:"Filing deadlines, RTW milestones"},{icon:"●",title:"Red Flag Detection",desc:"Automated compliance indicators"},{icon:"\uD83D\uDCCA",title:"Claim Strength Score",desc:"0-100 evidence completeness rating"},{icon:"\uD83D\uDCB0",title:"Benefit Calculator",desc:"LOE, NEL, and cost forecasting"}].map((f,i)=>(
      <div key={i} style={{padding:"18px 20px",background:"#fff",borderRadius:16,border:"1px solid var(--g200)",boxShadow:"0 1px 3px rgba(0,0,0,.03)"}}>
        <div style={{fontSize:22,marginBottom:8}}>{f.icon}</div>
        <div style={{fontSize:14,fontWeight:700,color:"var(--g900)",marginBottom:3}}>{f.title}</div>
        <div style={{fontSize:12,color:"var(--g500)",lineHeight:1.4}}>{f.desc}</div>
      </div>
    ))}
  </div>
</div>):(
<>
{/* HOME TABS */}
<div style={{display:"flex",gap:2,padding:3,background:"var(--g100)",borderRadius:12,marginBottom:20}}>
{["overview","activity","resources"].map(t=>(
<button key={t} onClick={()=>setHomeTab(t)} style={{flex:1,padding:"8px 0",borderRadius:10,border:"none",fontSize:12,fontWeight:600,cursor:"pointer",background:homeTab===t?"#fff":"transparent",color:homeTab===t?"var(--g900)":"var(--g500)",boxShadow:homeTab===t?"0 1px 3px rgba(0,0,0,.06)":"none",textTransform:"capitalize"}}>{t}</button>
))}
</div>

{homeTab==="overview"&&<>
{/* COMPACT GRADIENT HERO */}
<div style={{padding:"24px 28px",background:"linear-gradient(135deg, #0071E3 0%, #00A6FB 50%, #34C759 100%)",borderRadius:20,marginBottom:20,color:"#fff",position:"relative",overflow:"hidden",display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:16}}>
  <div style={{position:"absolute",top:-40,right:-40,width:200,height:200,background:"radial-gradient(circle, rgba(255,255,255,.1) 0%, transparent 70%)",borderRadius:"50%"}}/>
  <div style={{position:"relative",zIndex:1}}>
    <h1 style={{fontSize:"clamp(24px, 4vw, 32px)",fontWeight:800,letterSpacing:-1.2,marginBottom:4}}>Welcome back, {user.name?.split(" ")[0]||"there"}</h1>
    <p style={{fontSize:14,opacity:.8}}>{claims.length} case{claims.length!==1?"s":""}{needsAttention.length>0?` \u00B7 ${needsAttention.length} need${needsAttention.length===1?"s":""} attention`:""}</p>
  </div>
  <div style={{display:"flex",gap:8,flexWrap:"wrap",position:"relative",zIndex:1}}>
    <button onClick={()=>setModal("new")} style={{padding:"9px 20px",borderRadius:980,fontSize:13,fontWeight:600,background:"rgba(255,255,255,.2)",backdropFilter:"blur(10px)",border:"1px solid rgba(255,255,255,.25)",color:"#fff",cursor:"pointer"}}>+ New Case</button>
    <button onClick={()=>{setActive(null);setMsgs([]);nav("chat")}} style={{padding:"9px 20px",borderRadius:980,fontSize:13,fontWeight:600,background:"rgba(255,255,255,.2)",backdropFilter:"blur(10px)",border:"1px solid rgba(255,255,255,.25)",color:"#fff",cursor:"pointer"}}>Ask Advisor</button>
  </div>
</div>

{/* STATS + TOOLS ROW */}
<div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit, minmax(100px, 1fr))",gap:10,marginBottom:20}}>
  <div style={{padding:"16px",background:"#fff",borderRadius:14,border:"1px solid var(--g200)",boxShadow:"0 1px 3px rgba(0,0,0,.03)",textAlign:"center"}}><div style={{fontSize:26,fontWeight:800,letterSpacing:-1}}>{claims.length}</div><div style={{fontSize:10,fontWeight:500,color:"var(--g400)",marginTop:2}}>Total</div></div>
  {stageCounts.map(s=><div key={s.id} style={{padding:"16px",background:"#fff",borderRadius:14,border:"1px solid var(--g200)",boxShadow:"0 1px 3px rgba(0,0,0,.03)",textAlign:"center"}}><div style={{fontSize:26,fontWeight:800,letterSpacing:-1,color:s.color}}>{s.count}</div><div style={{fontSize:10,fontWeight:500,color:"var(--g400)",marginTop:2}}>{s.label}</div></div>)}
  <button onClick={()=>setShowAnalytics(true)} style={{padding:"16px",background:"#fff",borderRadius:14,border:"1px solid var(--g200)",boxShadow:"0 1px 3px rgba(0,0,0,.03)",textAlign:"center",cursor:"pointer"}}><div style={{fontSize:22,marginBottom:2}}>{"\uD83D\uDCCA"}</div><div style={{fontSize:10,fontWeight:500,color:"var(--blue)"}}>Analytics</div></button>
  <button onClick={()=>setShowCalc(true)} style={{padding:"16px",background:"#fff",borderRadius:14,border:"1px solid var(--g200)",boxShadow:"0 1px 3px rgba(0,0,0,.03)",textAlign:"center",cursor:"pointer"}}><div style={{fontSize:22,marginBottom:2}}>{"\uD83E\uDDEE"}</div><div style={{fontSize:10,fontWeight:500,color:"var(--blue)"}}>Calculator</div></button>
</div>

{/* TWO COLUMN LAYOUT */}
<div style={{display:"grid",gridTemplateColumns:"3fr 2fr",gap:16,marginBottom:20}}>
  <div>
    {needsAttention.length>0&&<><div style={{fontSize:12,fontWeight:700,color:"var(--g400)",textTransform:"uppercase",letterSpacing:1,marginBottom:10}}>Needs Attention</div>{needsAttention.slice(0,4).map(c=><CaseSummaryCard key={c.id} claim={c} onClick={()=>openClaim(c)}/>)}</>}
    {recentClaims.filter(c=>!needsAttention.find(n=>n.id===c.id)).length>0&&<><div style={{fontSize:12,fontWeight:700,color:"var(--g400)",textTransform:"uppercase",letterSpacing:1,marginBottom:10,marginTop:needsAttention.length>0?16:0}}>Recent Cases</div>{recentClaims.filter(c=>!needsAttention.find(n=>n.id===c.id)).slice(0,3).map(c=><CaseSummaryCard key={c.id} claim={c} onClick={()=>openClaim(c)}/>)}</>}
  </div>
  <div>
    <div style={{fontSize:12,fontWeight:700,color:"var(--g400)",textTransform:"uppercase",letterSpacing:1,marginBottom:10}}>Quick Tools</div>
    {[{label:"Case Templates",desc:"Start from a template",onClick:()=>setShowTemplates(true)},{label:"Benefit Calculator",desc:"Estimate LOE & NEL",onClick:()=>setShowCalc(true)},{label:"Analytics Dashboard",desc:"Portfolio insights",onClick:()=>setShowAnalytics(true)}].map((t,i)=>(
      <button key={i} onClick={t.onClick} style={{display:"flex",alignItems:"center",gap:12,padding:"14px 16px",background:"#fff",borderRadius:14,border:"1px solid var(--g200)",boxShadow:"0 1px 3px rgba(0,0,0,.03)",cursor:"pointer",textAlign:"left",width:"100%",marginBottom:6}}>
        <div><div style={{fontSize:13,fontWeight:600,color:"var(--g900)"}}>{t.label}</div><div style={{fontSize:11,color:"var(--g500)"}}>{t.desc}</div></div>
      </button>
    ))}
    <div style={{fontSize:12,fontWeight:700,color:"var(--g400)",textTransform:"uppercase",letterSpacing:1,marginBottom:10,marginTop:16}}>Ask the Advisor</div>
    {scenarios.map((s,i)=><button key={i} onClick={()=>{setActive(null);setMsgs([]);nav("chat");setTimeout(()=>send(s.t),100)}} style={{padding:"12px 14px",borderRadius:12,background:"#fff",border:"1px solid var(--g200)",boxShadow:"0 1px 3px rgba(0,0,0,.03)",cursor:"pointer",textAlign:"left",width:"100%",marginBottom:4}}><div style={{fontSize:13,fontWeight:600,marginBottom:1}}>{s.l}</div><div style={{fontSize:11,color:"var(--g500)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{s.t}</div></button>)}
  </div>
</div>
</>}

{homeTab==="activity"&&<>
<div style={{fontSize:12,fontWeight:700,color:"var(--g400)",textTransform:"uppercase",letterSpacing:1,marginBottom:12}}>Recent Activity</div>
{claims.flatMap(cl=>(cl.timeline||[]).map(t=>({...t,claimNumber:cl.claimNumber,caseId:cl.id}))).sort((a,b)=>new Date(b.date)-new Date(a.date)).slice(0,20).map((ev,i)=>(
<div key={i} style={{padding:"12px 16px",background:"#fff",borderRadius:12,border:"1px solid var(--g200)",marginBottom:6,display:"flex",alignItems:"flex-start",gap:12}}>
<div style={{width:8,height:8,borderRadius:"50%",marginTop:5,flexShrink:0,background:ev.type==="stage"?"var(--blue)":ev.type==="document"?"var(--green)":ev.type==="analysis"?"var(--orange)":"var(--g300)"}}/>
<div style={{flex:1}}><div style={{fontSize:13,fontWeight:600,color:"var(--g800)"}}>{ev.claimNumber}</div><div style={{fontSize:12,color:"var(--g500)"}}>{ev.note}</div><div style={{fontSize:11,color:"var(--g400)",marginTop:2}}>{fmtTime(ev.date)}</div></div>
</div>))}
{claims.length===0&&<div style={{padding:40,textAlign:"center",color:"var(--g400)",fontSize:13}}>No activity yet.</div>}
</>}

{homeTab==="resources"&&<>
<div style={{fontSize:12,fontWeight:700,color:"var(--g400)",textTransform:"uppercase",letterSpacing:1,marginBottom:12}}>WSIB Resources</div>
<div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit, minmax(240px, 1fr))",gap:10,marginBottom:24}}>
{[{title:"WSIB Online Services",desc:"File claims, track status, upload documents",url:"https://www.wsib.ca/en/onlineservices"},{title:"Operational Policy Manual",desc:"Full OPM reference for adjudicators",url:"https://www.wsib.ca/en/operational-policy-manual"},{title:"WSIB Forms",desc:"Download Form 6, 7, 8 and official forms",url:"https://www.wsib.ca/en/forms"},{title:"WSIAT Decisions",desc:"Search Tribunal decisions for precedents",url:"https://www.wsiat.on.ca"},{title:"WSIA Legislation",desc:"Workplace Safety and Insurance Act, 1997",url:"https://www.ontario.ca/laws/statute/97w16"},{title:"ODG Guidelines",desc:"Official Disability Guidelines for recovery",url:"https://www.worklossdata.com/"}].map((r,i)=>(
<a key={i} href={r.url} target="_blank" rel="noopener noreferrer" style={{padding:"18px 20px",background:"#fff",borderRadius:14,border:"1px solid var(--g200)",textDecoration:"none",display:"block",boxShadow:"0 1px 3px rgba(0,0,0,.03)"}}>
<div style={{fontSize:14,fontWeight:700,color:"var(--blue)",marginBottom:4}}>{r.title}</div>
<div style={{fontSize:12,color:"var(--g500)",lineHeight:1.4}}>{r.desc}</div>
</a>))}
</div>
<div style={{fontSize:12,fontWeight:700,color:"var(--g400)",textTransform:"uppercase",letterSpacing:1,marginBottom:12}}>Key OPM Policies</div>
<div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit, minmax(200px, 1fr))",gap:8}}>
{[{code:"11-01-01",title:"Five Point Check",desc:"Adjudicative criteria"},{code:"11-01-13",title:"Benefit of Doubt",desc:"Evidence equally balanced"},{code:"15-02",title:"Work Relatedness",desc:"Establishing connection"},{code:"15-03-13",title:"PTSD Presumptive",desc:"First responder coverage"},{code:"18-01",title:"LOE Benefits",desc:"Loss of Earnings calc"},{code:"18-05",title:"NEL Benefits",desc:"Non-Economic Loss"}].map((p,i)=>(
<div key={i} style={{padding:"14px 16px",background:"#fff",borderRadius:12,border:"1px solid var(--g200)",boxShadow:"0 1px 3px rgba(0,0,0,.03)"}}>
<span style={{fontFamily:"monospace",fontSize:11,fontWeight:600,color:"var(--blue)",background:"var(--blue-light)",padding:"2px 8px",borderRadius:6,display:"inline-block",marginBottom:6}}>{p.code}</span>
<div style={{fontSize:13,fontWeight:600,color:"var(--g800)"}}>{p.title}</div>
<div style={{fontSize:11,color:"var(--g500)"}}>{p.desc}</div>
</div>))}
</div>
</>}

</>)}
</div></div>)}

{/* ══ CLAIMS LIST ══ */}
{view==="claims"&&(<div style={{flex:1,overflowY:"auto",padding:"24px 16px 80px"}}><div className="fade-in" style={{maxWidth:900,margin:"0 auto",width:"100%"}}>
<div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}><div style={{fontSize:28,fontWeight:800,letterSpacing:-1}}>My Cases</div><div style={{display:"flex",gap:6}}>{bulkSelect.length>0&&<><button onClick={()=>{if(confirm(`Delete ${bulkSelect.length} cases?`)){bulkSelect.forEach(id=>setClaims(p=>{const next=p.filter(c=>c.id!==id);persistClaims(user.email,next);return next}));setBulkSelect([])}}} style={{padding:"5px 12px",borderRadius:980,fontSize:11,fontWeight:600,color:"var(--red)",border:".5px solid var(--red-border)",background:"var(--red-light)",cursor:"pointer"}}>Delete ({bulkSelect.length})</button><button onClick={()=>setBulkSelect([])} style={{padding:"5px 12px",borderRadius:980,fontSize:11,fontWeight:500,color:"var(--g500)",border:".5px solid var(--g200)",background:"#fff",cursor:"pointer"}}>Clear</button></>}</div></div>
{/* Search bar */}
<div style={{marginBottom:12}}><input value={searchQ} onChange={e=>setSearchQ(e.target.value)} placeholder="Search cases by name, number, employer, or keyword…" style={{width:"100%",padding:"10px 14px",borderRadius:12,border:".5px solid var(--g200)",fontSize:13,outline:"none",background:"#fff",fontFamily:"inherit"}} /></div>
<div style={{display:"flex",gap:4,marginBottom:14,flexWrap:"wrap",overflowX:"auto"}}><button onClick={()=>setFilter("all")} style={{padding:"5px 12px",borderRadius:980,fontSize:12,fontWeight:500,border:".5px solid var(--g200)",cursor:"pointer",background:filter==="all"?"var(--g900)":"#fff",color:filter==="all"?"#fff":"var(--g500)",whiteSpace:"nowrap"}}>All ({claims.length})</button>{STAGES.map(s=>{const n=claims.filter(c=>c.stage===s.id).length;return n>0?<button key={s.id} onClick={()=>setFilter(s.id)} style={{padding:"5px 12px",borderRadius:980,fontSize:12,fontWeight:500,border:".5px solid var(--g200)",cursor:"pointer",background:filter===s.id?"var(--g900)":"#fff",color:filter===s.id?"#fff":"var(--g500)",whiteSpace:"nowrap"}}>{s.label} ({n})</button>:null})}</div>
{displayed.length===0?<div style={{textAlign:"center",padding:"60px 20px"}}><div style={{fontSize:18,fontWeight:700,color:"var(--g700)",marginBottom:6}}>{searchQ?"No matching cases":"No cases yet"}</div><p style={{fontSize:14,color:"var(--g500)",marginBottom:16}}>{searchQ?"Try a different search.":"Create your first case."}</p>{!searchQ&&<button onClick={()=>setModal("new")} style={{padding:"10px 24px",borderRadius:980,fontSize:14,fontWeight:600,border:"none",background:"var(--blue)",color:"#fff",cursor:"pointer"}}>+ Create Case</button>}</div>:displayed.map(c=><CaseSummaryCard key={c.id} claim={c} onClick={()=>openClaim(c)}/>)}
</div></div>)}

{/* ══ DETAIL ══ */}
{view==="detail"&&active&&(<div style={{flex:1,overflowY:"auto",padding:"24px 16px 80px"}}><div className="fade-in" style={{maxWidth:900,margin:"0 auto",width:"100%"}}>
<button onClick={()=>nav("claims")} style={{display:"flex",alignItems:"center",gap:4,fontSize:13,fontWeight:500,color:"var(--blue)",background:"none",border:"none",cursor:"pointer",marginBottom:14}}>← My Cases</button>
<div style={{marginBottom:8}}><div style={{fontSize:"clamp(20px, 4vw, 26px)",fontWeight:800,letterSpacing:-.8,marginBottom:4}}>{active.claimNumber}</div><div style={{fontSize:13,color:"var(--g500)",display:"flex",gap:10,flexWrap:"wrap"}}><span>{active.worker}</span><span style={{color:"var(--g300)"}}>{"·"}</span><span>{active.employer}</span><span style={{color:"var(--g300)"}}>{"·"}</span><span>{fmt(active.injuryDate)}</span><span style={{color:"var(--g300)"}}>{"·"}</span><span>{active.injuryType}</span>{active.injuryDate&&active.injuryDate!=="—"&&<span style={{color:"var(--blue)",fontWeight:500}}>Day {daysAgo(active.injuryDate)}</span>}</div></div>
<div style={{display:"flex",gap:6,marginBottom:4,flexWrap:"wrap"}}><button onClick={()=>openChat(active)} style={{padding:"7px 16px",borderRadius:980,fontSize:13,fontWeight:600,border:"none",background:"var(--blue)",color:"#fff",cursor:"pointer"}}>Open Advisor</button><button onClick={()=>setModal("stage")} style={{padding:"7px 12px",borderRadius:980,fontSize:13,fontWeight:600,border:".5px solid var(--g300)",background:"transparent",color:"var(--g600)",cursor:"pointer"}}>Change Status</button><button onClick={()=>{if(confirm("Delete?"))delClaim(active.id)}} style={{padding:"7px 12px",borderRadius:980,fontSize:13,fontWeight:600,border:".5px solid var(--red-border)",background:"transparent",color:"var(--red)",cursor:"pointer"}}>Delete</button></div>
<StageProgress stage={active.stage}/>
{/* Stage guidance banner */}
<div style={{padding:"12px 16px",background:"rgba(0,113,227,.04)",border:".5px solid rgba(0,113,227,.12)",borderRadius:12,marginBottom:16,display:"flex",alignItems:"center",gap:12}}><div style={{width:32,height:32,borderRadius:8,background:stageOf(active.stage).color,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}><span style={{color:"#fff",fontSize:14,fontWeight:700}}>{stageOf(active.stage).icon}</span></div><div style={{minWidth:0}}><div style={{fontSize:14,fontWeight:600,color:"var(--g900)"}}>Status: {stageOf(active.stage).label}</div><div style={{fontSize:12,color:"var(--g600)",marginTop:1}}>{stageOf(active.stage).guidance}</div></div></div>

{/* Detail tabs */}
<div style={{display:"flex",gap:2,padding:3,background:"var(--g200)",borderRadius:10,marginBottom:16}}>{[{id:"overview",label:"Overview"},{id:"documents",label:`Documents (${active.documents?.length||0})`},{id:"timeline",label:"Timeline"},{id:"comms",label:"Comms"},{id:"appeal",label:"Appeal"}].map(t=><button key={t.id} onClick={()=>setDetailTab(t.id)} style={{flex:1,padding:"7px 0",borderRadius:8,border:"none",fontSize:12,fontWeight:600,cursor:"pointer",background:detailTab===t.id?"#fff":"transparent",color:detailTab===t.id?"var(--g900)":"var(--g500)",boxShadow:detailTab===t.id?"0 1px 3px rgba(0,0,0,.06)":"none"}}>{t.label}</button>)}</div>

{detailTab==="overview"&&<>
{/* RTW Progress */}
{(active.documents?.some(d=>["medical","form8","physio","specialist","imaging"].includes(d.tag))||active.analyses?.length>0)?<RTWBar progress={getRTWProgress(active)}/>:<div style={{padding:"14px 18px",background:"var(--g50)",borderRadius:14,border:"1px solid var(--g200)",marginBottom:16,fontSize:13,color:"var(--g500)"}}><strong style={{color:"var(--g700)"}}>RTW Timeline:</strong> Upload medical evidence or run an AI analysis to generate return-to-work projections.</div>}
{/* Deadlines */}
<DeadlineBar deadlines={getDeadlines(active)}/>
{/* Stats */}
<div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit, minmax(120px, 1fr))",gap:8,marginBottom:16}}>{[{l:"Analyses",v:active.analyses?.length||0},{l:"Documents",v:active.documents?.length||0},{l:"Notes",v:active.notes?.length||0},{l:"Last Ruling",v:active.analyses?.[active.analyses.length-1]?.ruling||"—"}].map((d,i)=><div key={i} style={{padding:12,background:"#fff",borderRadius:10,border:".5px solid var(--g200)"}}><div style={{fontSize:10,fontWeight:600,color:"var(--g400)",textTransform:"uppercase",letterSpacing:.8,marginBottom:4}}>{d.l}</div><div style={{fontSize:14,fontWeight:600}}>{d.v}</div></div>)}</div>
{/* Case summary */}
<div style={{padding:"12px 16px",background:"#fff",borderRadius:12,border:".5px solid var(--g200)",marginBottom:16,fontSize:13,color:"var(--g600)",lineHeight:1.5}}><strong style={{color:"var(--g900)"}}>Summary:</strong> {getCaseSummary(active)}{active.description?`. ${active.description}`:""}</div>
{/* Next actions */}
{(()=>{const actions=getNextActions(active);return actions.length>0?(<div style={{marginBottom:16}}><div style={{fontSize:12,fontWeight:700,color:"var(--g400)",textTransform:"uppercase",letterSpacing:.5,marginBottom:8}}>Recommended Next Steps</div><div style={{display:"flex",flexDirection:"column",gap:6}}>{actions.map((a,i)=><ActionCard key={i} action={a} onAction={handleAction}/>)}</div></div>):null})()}
{/* Benefit Calculator shortcut */}
<button onClick={()=>setShowCalc(true)} style={{width:"100%",padding:"12px 16px",borderRadius:12,border:".5px solid var(--g200)",background:"#fff",cursor:"pointer",textAlign:"left",display:"flex",alignItems:"center",gap:12,marginBottom:16}}><div style={{width:32,height:32,borderRadius:8,background:"rgba(52,199,89,.1)",display:"flex",alignItems:"center",justifyContent:"center"}}><svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="var(--green)" strokeWidth="1.8"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 15.75V18m-7.5-6.75h.008v.008H8.25v-.008zm0 2.25h.008v.008H8.25V13.5zm2.498-6.75h.007v.008h-.007v-.008zm0 2.25h.007v.008h-.007V13.5zM6 6.75h12v12.375c0 .621-.504 1.125-1.125 1.125H7.125A1.125 1.125 0 016 19.125V6.75z"/></svg></div><div><div style={{fontSize:14,fontWeight:600,color:"var(--g900)"}}>Benefit Calculator</div><div style={{fontSize:12,color:"var(--g500)"}}>Estimate LOE and NEL entitlements</div></div></button>

{/* Analysis history */}
{active.analyses?.length>0&&<div style={{marginBottom:16}}><div style={{fontSize:12,fontWeight:700,color:"var(--g400)",textTransform:"uppercase",letterSpacing:.5,marginBottom:8}}>Analysis History</div>{active.analyses.slice().reverse().map((a,i)=><div key={i} style={{padding:12,background:"#fff",borderRadius:10,border:".5px solid var(--g200)",marginBottom:6}}><div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}><span style={{fontSize:13,fontWeight:600,color:a.ruling==="Allow"?"var(--green)":a.ruling==="Deny"?"var(--red)":"var(--orange)"}}>● {a.ruling}</span><span style={{fontSize:11,color:"var(--g400)"}}>{fmtTime(a.date)}</span></div><div style={{fontSize:12,color:"var(--g500)",lineHeight:1.4}}>{a.snippet?.slice(0,120)}…</div></div>)}</div>}
</>}

{detailTab==="documents"&&<>
<input ref={fRef} type="file" multiple onChange={(e)=>{const nf2=Array.from(e.target.files);const c={...active};c.documents=[...(c.documents||[]),...nf2.map(f=>({name:f.name,tag:guessDocType(f.name),addedAt:new Date().toISOString()}))];c.timeline=[...(c.timeline||[]),...nf2.map(f=>({date:new Date().toISOString(),type:"document",note:`Uploaded: ${f.name}`}))];saveClaim(c);nf2.forEach(f=>{const r=new FileReader();r.onload=ev=>setFc(p=>({...p,[f.name]:ev.target.result}));r.readAsText(f)});setFiles(p=>[...p,...nf2]);e.target.value=""}} style={{display:"none"}} accept=".txt,.pdf,.doc,.docx,.html,.md,.rtf"/>
<button onClick={()=>fRef.current?.click()} style={{padding:"10px 20px",borderRadius:980,fontSize:13,fontWeight:600,border:"none",background:"var(--blue)",color:"#fff",cursor:"pointer",marginBottom:12}}>+ Upload Documents</button>
<DocList documents={active.documents}/>
{(!active.documents||active.documents.length===0)&&<div style={{textAlign:"center",padding:"40px 20px"}}><div style={{fontSize:16,fontWeight:600,color:"var(--g500)",marginBottom:4}}>No documents yet</div><p style={{fontSize:13,color:"var(--g400)"}}>Upload Form 6, Form 7, medical reports, and other evidence.</p></div>}
</>}

{detailTab==="timeline"&&<>
<div style={{marginBottom:16}}>{(active.timeline||[]).slice().reverse().map((ev,i,arr)=><div key={i} style={{display:"flex",gap:10,position:"relative"}}>{i<arr.length-1&&<div style={{position:"absolute",left:10,top:22,bottom:0,width:1,background:"var(--g200)"}}/>}<div style={{width:22,height:22,borderRadius:"50%",flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center",fontSize:9,fontWeight:700,zIndex:1,background:ev.type==="stage"?"var(--blue-light)":ev.type==="document"?"var(--green-light)":ev.type==="analysis"?"rgba(255,149,0,.06)":ev.type==="note"?"rgba(175,82,222,.06)":"var(--g200)",color:ev.type==="stage"?"var(--blue)":ev.type==="document"?"var(--green)":ev.type==="analysis"?"var(--orange)":ev.type==="note"?"#AF52DE":"var(--g600)"}}>{ev.type==="created"?"●":ev.type==="stage"?"→":ev.type==="document"?"+":ev.type==="analysis"?"✷":"•"}</div><div style={{flex:1,paddingBottom:14,minWidth:0}}><div style={{fontSize:13,color:"var(--g700)",lineHeight:1.4}}>{ev.note}</div><div style={{fontSize:11,color:"var(--g400)",marginTop:2}}>{fmtTime(ev.date)}</div></div></div>)}</div>
<div style={{display:"flex",gap:6}}><input value={noteIn} onChange={e=>setNoteIn(e.target.value)} onKeyDown={e=>{if(e.key==="Enter")addNote()}} placeholder="Add a note…" style={{flex:1,padding:"8px 12px",borderRadius:10,border:".5px solid var(--g200)",fontSize:13,outline:"none",background:"#fff"}}/><button onClick={addNote} disabled={!noteIn.trim()} style={{padding:"7px 14px",borderRadius:980,fontSize:13,fontWeight:600,border:".5px solid var(--g300)",background:"transparent",color:"var(--g600)",cursor:"pointer",whiteSpace:"nowrap"}}>Add</button></div>
</>}

{detailTab==="comms"&&<>
<div style={{fontSize:12,fontWeight:700,color:"var(--g400)",textTransform:"uppercase",letterSpacing:.8,marginBottom:10}}>Communication Log</div>
<div style={{padding:"14px 16px",background:"#fff",borderRadius:14,border:"1px solid var(--g200)",marginBottom:12}}>
<div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:8}}>
<div><label style={{fontSize:11,fontWeight:600,color:"var(--g400)",display:"block",marginBottom:4}}>To/From</label><input value={commLog.to} onChange={e=>setCommLog(p=>({...p,to:e.target.value}))} placeholder="WSIB, Dr. Smith, Employer..." style={{width:"100%",padding:"8px 12px",borderRadius:8,border:"1px solid var(--g200)",fontSize:13,outline:"none"}}/></div>
<div><label style={{fontSize:11,fontWeight:600,color:"var(--g400)",display:"block",marginBottom:4}}>Method</label><select value={commLog.method} onChange={e=>setCommLog(p=>({...p,method:e.target.value}))} style={{width:"100%",padding:"8px 12px",borderRadius:8,border:"1px solid var(--g200)",fontSize:13,outline:"none",background:"#fff"}}><option value="email">Email</option><option value="phone">Phone</option><option value="mail">Mail</option><option value="portal">WSIB Portal</option><option value="meeting">Meeting</option></select></div>
</div>
<div style={{marginBottom:8}}><label style={{fontSize:11,fontWeight:600,color:"var(--g400)",display:"block",marginBottom:4}}>Date</label><input type="date" value={commLog.date} onChange={e=>setCommLog(p=>({...p,date:e.target.value}))} style={{width:"100%",padding:"8px 12px",borderRadius:8,border:"1px solid var(--g200)",fontSize:13,outline:"none"}}/></div>
<div style={{marginBottom:8}}><label style={{fontSize:11,fontWeight:600,color:"var(--g400)",display:"block",marginBottom:4}}>Notes</label><input value={commLog.note} onChange={e=>setCommLog(p=>({...p,note:e.target.value}))} placeholder="Summary of communication..." style={{width:"100%",padding:"8px 12px",borderRadius:8,border:"1px solid var(--g200)",fontSize:13,outline:"none"}}/></div>
<button onClick={()=>{if(commLog.to&&commLog.note){const cl={...active};cl.comms=[...(cl.comms||[]),{...commLog,id:Date.now()}];cl.timeline=[...(cl.timeline||[]),{date:new Date().toISOString(),type:"note",note:"Comm: "+commLog.method+" with "+commLog.to}];saveClaim(cl);setCommLog({to:"",method:"email",date:"",note:""})}}} style={{padding:"8px 16px",borderRadius:980,fontSize:13,fontWeight:600,border:"none",background:"var(--blue)",color:"#fff",cursor:"pointer"}}>Add Entry</button>
</div>
{(active.comms||[]).slice().reverse().map((entry,i)=><div key={i} style={{padding:"12px 16px",background:"#fff",borderRadius:12,border:"1px solid var(--g200)",marginBottom:6,display:"flex",alignItems:"flex-start",gap:12}}><div style={{width:8,height:8,borderRadius:"50%",background:entry.method==="email"?"var(--blue)":entry.method==="phone"?"var(--green)":"var(--orange)",marginTop:5,flexShrink:0}}/><div style={{flex:1}}><div style={{display:"flex",justifyContent:"space-between"}}><span style={{fontSize:13,fontWeight:600,color:"var(--g800)"}}>{entry.to}</span><span style={{fontSize:11,color:"var(--g400)"}}>{entry.date}</span></div><div style={{fontSize:12,color:"var(--g500)",marginTop:2}}>{entry.note}</div><span style={{fontSize:10,fontWeight:600,color:"var(--g400)",textTransform:"uppercase"}}>{entry.method}</span></div></div>)}
{(!active.comms||active.comms.length===0)&&<div style={{padding:32,textAlign:"center",color:"var(--g400)",fontSize:13}}>No communications logged yet.</div>}
</>}

{detailTab==="appeal"&&<>
<div style={{fontSize:12,fontWeight:700,color:"var(--g400)",textTransform:"uppercase",letterSpacing:.8,marginBottom:12}}>Appeal Process Tracker</div>
{(active.stage==="denied"||active.stage==="appeal")?<div>{APPEAL_STAGES.map((s,i)=>{const isCurrent=i===0;const isPast=false;return(<div key={s.id} style={{padding:"16px 18px",background:isCurrent?"var(--blue-light)":"var(--g50)",borderRadius:14,border:"1px solid "+(isCurrent?"var(--blue-border)":"var(--g200)"),marginBottom:8}}><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}><div style={{display:"flex",alignItems:"center",gap:8}}><div style={{width:24,height:24,borderRadius:"50%",background:isCurrent?"var(--blue)":"var(--g300)",color:"#fff",display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:700}}>{i+1}</div><span style={{fontSize:14,fontWeight:700,color:isCurrent?"var(--blue)":"var(--g600)"}}>{s.label}</span></div><span style={{fontSize:11,fontWeight:600,color:"var(--g400)"}}>{s.deadline}</span></div><div style={{fontSize:12,color:"var(--g500)",marginBottom:8,paddingLeft:32}}>{s.desc}</div>{isCurrent&&<div style={{paddingLeft:32}}><div style={{fontSize:11,fontWeight:700,color:"var(--g400)",textTransform:"uppercase",letterSpacing:.8,marginBottom:6}}>Required Documents</div>{s.docs.map((d,j)=><div key={j} style={{fontSize:12,color:"var(--g600)",display:"flex",alignItems:"center",gap:6,marginBottom:3}}><span style={{width:6,height:6,borderRadius:"50%",background:"var(--orange)",flexShrink:0}}/>{d}</div>)}</div>}</div>)})}
</div>:<div style={{padding:24,background:"var(--g50)",borderRadius:14,border:"1px solid var(--g200)",textAlign:"center"}}><div style={{fontSize:14,fontWeight:600,color:"var(--g700)",marginBottom:4}}>Appeal tracking available for denied claims</div><div style={{fontSize:12,color:"var(--g500)"}}>Change claim status to Denied or Appeal to access the appeal workflow tracker.</div></div>}
<div style={{marginTop:16}}><div style={{fontSize:12,fontWeight:700,color:"var(--g400)",textTransform:"uppercase",letterSpacing:.8,marginBottom:8}}>Key Appeal Deadlines</div>
<div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
{[{label:"Intent to Object",dl:"30d (RTW) / 6mo (other)",desc:"From WSIB decision"},{label:"Appeal Readiness",dl:"No fixed deadline",desc:"Earlier is better"},{label:"WSIAT Filing",dl:"6 months",desc:"From ARO decision"},{label:"Judicial Review",dl:"30 days",desc:"From WSIAT decision"}].map((d,i)=>(
<div key={i} style={{padding:"12px 14px",background:"#fff",borderRadius:12,border:"1px solid var(--g200)"}}><div style={{fontSize:13,fontWeight:600,color:"var(--g800)"}}>{d.label}</div><div style={{fontSize:12,fontWeight:700,color:"var(--blue)",marginTop:2}}>{d.dl}</div><div style={{fontSize:11,color:"var(--g500)"}}>{d.desc}</div></div>))}
</div></div>
</>}


</div></div>)}

{/* ══ CHAT ══ */}
{view==="chat"&&(<><div style={{flex:1,overflowY:"auto",padding:"20px 14px 140px"}}><div style={{maxWidth:760,margin:"0 auto"}}>
{active&&<div className="fade-in" style={{padding:"10px 14px",background:"#fff",borderRadius:12,border:".5px solid var(--g200)",marginBottom:14,display:"flex",alignItems:"center",justifyContent:"space-between",gap:8,flexWrap:"wrap"}}><div style={{display:"flex",alignItems:"center",gap:6,minWidth:0}}><span style={{fontSize:14,fontWeight:700}}>{active.claimNumber}</span><span style={{fontSize:12,color:"var(--g500)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{active.worker}</span></div><div style={{display:"flex",gap:6,alignItems:"center"}}><span style={pill(stageOf(active.stage).color)}>{stageOf(active.stage).label}</span><button onClick={()=>nav("detail")} style={{fontSize:11,color:"var(--blue)",background:"none",border:"none",cursor:"pointer",fontWeight:500,whiteSpace:"nowrap"}}>← Details</button></div></div>}
{msgs.length===0&&<div className="fade-in" style={{padding:"24px 0"}}><div style={{fontSize:"clamp(24px, 5vw, 32px)",fontWeight:800,letterSpacing:-1.2,marginBottom:8}}>{active?`Analyze ${active.claimNumber}`:"Ask anything."}</div><div style={{fontSize:15,color:"var(--g500)",marginBottom:20,maxWidth:460,lineHeight:1.55}}>{active?"Upload documents or ask questions. Analysis is saved to this case.":"Describe a scenario, upload documents, or ask a policy question."}</div>
{active&&msgs.length===0&&active.messages?.length>0&&<button onClick={()=>setMsgs(active.messages)} style={{padding:"8px 16px",borderRadius:980,fontSize:12,fontWeight:600,color:"var(--blue)",background:"var(--blue-light)",border:".5px solid var(--blue-border)",cursor:"pointer",marginBottom:12}}>Continue previous conversation ({active.messages.length} messages)</button>}
{active&&<div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:16}}>{getNextActions(active).filter(a=>a.action.startsWith("prompt:")||a.action==="analyze").map((a,i)=><button key={i} onClick={()=>handleAction(a)} style={{padding:"8px 14px",borderRadius:980,fontSize:12,fontWeight:500,color:a.priority==="high"?"var(--blue)":"var(--g600)",background:a.priority==="high"?"var(--blue-light)":"#fff",border:`.5px solid ${a.priority==="high"?"var(--blue-border)":"var(--g200)"}`,cursor:"pointer"}}>{a.label}</button>)}</div>}
{!active&&<div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit, minmax(220px, 1fr))",gap:8}}>{scenarios.map((s,i)=><button key={i} onClick={()=>send(s.t)} style={{padding:"14px 16px",borderRadius:12,background:"#fff",border:".5px solid var(--g200)",cursor:"pointer",textAlign:"left"}}><div style={{fontSize:13,fontWeight:600,marginBottom:3}}>{s.l}</div><div style={{fontSize:12,color:"var(--g500)",lineHeight:1.4}}>{s.t.slice(0,80)}…</div></button>)}</div>}
</div>}
{msgs.map((m,i)=><div key={i} style={{marginBottom:24,display:"flex",flexDirection:"column",alignItems:m.role==="user"?"flex-end":"flex-start",animation:"fadeIn .35s cubic-bezier(.25,.1,.25,1) both"}}><div style={{fontSize:11,fontWeight:600,color:"var(--g400)",letterSpacing:.5,textTransform:"uppercase",marginBottom:6,display:"flex",alignItems:"center",gap:6}}><span style={{width:6,height:6,borderRadius:"50%",background:m.role==="user"?"var(--g900)":"var(--blue)"}}/>{m.role==="user"?"You":"CaseAssist"}</div>{m.files?.length>0&&<div style={{display:"flex",gap:4,flexWrap:"wrap",marginBottom:6,justifyContent:m.role==="user"?"flex-end":"flex-start"}}>{m.files.map((f,j)=><span key={j} style={{padding:"4px 10px",borderRadius:980,fontSize:11,fontWeight:500,color:"var(--blue)",background:"var(--blue-light)",border:".5px solid var(--blue-border)"}}>{f}</span>)}</div>}{m.role==="user"?<div style={{maxWidth:"80%",padding:"12px 16px",borderRadius:"18px 18px 6px 18px",background:"var(--g900)",color:"#fff",fontSize:14,lineHeight:1.55}}>{m.display||m.content}</div>:<div style={{width:"100%"}}><Msg text={m.content}/></div>}</div>)}
{loading&&<div style={{marginBottom:24}}><div style={{fontSize:11,fontWeight:600,color:"var(--g400)",letterSpacing:.5,textTransform:"uppercase",marginBottom:6,display:"flex",alignItems:"center",gap:6}}><span style={{width:6,height:6,borderRadius:"50%",background:"var(--blue)"}}/>CaseAssist</div><div style={{display:"flex",gap:6,alignItems:"center"}}>{[0,1,2].map(d=><div key={d} style={{width:8,height:8,borderRadius:"50%",background:"var(--blue)",animation:`pulse 1.5s ease infinite ${d*.2}s`}}/>)}<span style={{marginLeft:8,fontSize:13,color:"var(--g400)"}}>Reviewing…</span></div></div>}<div ref={endRef}/>
</div></div>
<div style={{position:"fixed",bottom:0,left:0,right:0,padding:"0 14px 16px",background:"linear-gradient(to top,var(--bg) 60%,transparent)",pointerEvents:"none",zIndex:50}}><div style={{maxWidth:760,margin:"0 auto",pointerEvents:"auto",paddingBottom:60}}>
{files.length>0&&<div style={{display:"flex",gap:4,flexWrap:"wrap",marginBottom:6}}>{files.map((f,i)=><div key={i} style={{display:"inline-flex",alignItems:"center",gap:4,padding:"4px 6px 4px 10px",borderRadius:980,fontSize:11,fontWeight:500,color:"var(--blue)",background:"#fff",border:".5px solid var(--blue-border)",boxShadow:"0 1px 4px rgba(0,0,0,.06)",maxWidth:200,overflow:"hidden"}}><span style={{overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{f.name}</span><button onClick={()=>rmFile(f.name)} style={{background:"none",border:"none",cursor:"pointer",color:"var(--g400)",fontSize:13,padding:"0 2px",flexShrink:0}}>×</button></div>)}</div>}
<div style={{display:"flex",alignItems:"flex-end",gap:4,background:"#fff",border:".5px solid var(--g200)",borderRadius:22,padding:"5px 5px 5px 6px",boxShadow:"0 2px 20px rgba(0,0,0,.08)"}}><button onClick={()=>fRef.current?.click()} style={{width:36,height:36,borderRadius:"50%",border:"none",background:"transparent",cursor:"pointer",color:"var(--g400)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}><svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15"/></svg></button>{view==="chat"&&<input ref={fRef} type="file" multiple onChange={addFiles} style={{display:"none"}} accept=".txt,.pdf,.doc,.docx,.html,.md,.rtf"/>}<textarea ref={taRef} value={input} onChange={e=>{setInput(e.target.value);e.target.style.height="auto";e.target.style.height=Math.min(e.target.scrollHeight,140)+"px"}} onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();send()}}} placeholder={active?`Ask about ${active.claimNumber}…`:"Ask a question…"} style={{flex:1,border:"none",background:"transparent",resize:"none",outline:"none",fontSize:15,color:"var(--g900)",padding:"8px 4px",lineHeight:1.45,minHeight:36,maxHeight:140,fontFamily:"'Plus Jakarta Sans',sans-serif"}} rows={1}/><button onClick={()=>send()} disabled={loading||(!input.trim()&&files.length===0)} style={{width:36,height:36,borderRadius:"50%",border:"none",flexShrink:0,cursor:(input.trim()||files.length>0)&&!loading?"pointer":"default",display:"flex",alignItems:"center",justifyContent:"center",background:(input.trim()||files.length>0)&&!loading?"var(--blue)":"var(--g200)",color:"#fff",transition:"all .25s"}}><svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 10.5L12 3m0 0l7.5 7.5M12 3v18"/></svg></button></div>
<div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginTop:6,padding:"0 8px"}}><span style={{fontSize:10,color:"var(--g400)"}}>Advisory only. Final decisions by authorized WSIB adjudicators.</span>{msgs.length>0&&<button onClick={()=>setMsgs([])} style={{background:"none",border:"none",cursor:"pointer",fontSize:11,color:"var(--g400)",fontWeight:500}}>Clear</button>}</div>
</div></div></>)}

{/* ══ MODALS ══ */}
{/* NOTIFICATION CENTER */}
{showNotifs&&<div onClick={e=>{if(e.target===e.currentTarget)setShowNotifs(false)}} style={{position:"fixed",inset:0,zIndex:190}}><div style={{position:"absolute",top:68,right:20,width:380,maxWidth:"calc(100vw - 32px)",maxHeight:"70vh",background:"#fff",borderRadius:20,border:"1px solid var(--g200)",boxShadow:"0 12px 48px rgba(0,0,0,.1)",overflowY:"auto",animation:"scaleIn .2s ease"}}><div style={{padding:"18px 20px",borderBottom:"1px solid var(--g100)",display:"flex",justifyContent:"space-between",alignItems:"center"}}><span style={{fontSize:16,fontWeight:700}}>Notifications</span><button onClick={()=>setShowNotifs(false)} style={{background:"none",border:"none",cursor:"pointer",color:"var(--g400)",fontSize:18}}>×</button></div>{(()=>{const ns=getNotifications(claims);if(!ns.length)return<div style={{padding:32,textAlign:"center",color:"var(--g400)",fontSize:14}}>All clear!</div>;return ns.slice(0,15).map((n,i)=><div key={i} onClick={()=>{const cc=claims.find(x=>x.id===n.caseId);if(cc){openClaim(cc);setShowNotifs(false)}}} style={{padding:"14px 20px",borderBottom:"1px solid var(--g100)",cursor:"pointer",display:"flex",alignItems:"flex-start",gap:12}}><div style={{width:10,height:10,borderRadius:"50%",background:n.type==="urgent"?"var(--red)":n.type==="warning"?"var(--orange)":"var(--blue)",flexShrink:0,marginTop:5}}/><div style={{flex:1}}><div style={{fontSize:14,fontWeight:600,color:n.type==="urgent"?"var(--red)":n.type==="warning"?"var(--orange)":"var(--g700)"}}>{n.title}</div><div style={{fontSize:12,color:"var(--g500)",marginTop:2}}>{n.desc}</div></div></div>)})()}</div></div>}

{/* GLOSSARY PANEL */}
{showGlossary&&<div onClick={e=>{if(e.target===e.currentTarget)setShowGlossary(false)}} style={{position:"fixed",inset:0,background:"rgba(0,0,0,.25)",zIndex:200,display:"flex",justifyContent:"flex-end"}}>
<div style={{width:420,maxWidth:"100vw",height:"100%",background:"#fff",boxShadow:"-8px 0 32px rgba(0,0,0,.08)",display:"flex",flexDirection:"column",animation:"scaleIn .2s ease"}}>
<div style={{padding:"20px 24px",borderBottom:"1px solid var(--g200)",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
<h3 style={{fontSize:18,fontWeight:700}}>WSIB Glossary</h3>
<button onClick={()=>setShowGlossary(false)} style={{background:"none",border:"none",cursor:"pointer",fontSize:20,color:"var(--g400)"}}>×</button>
</div>
<div style={{padding:"12px 24px"}}><input value={glossarySearch} onChange={e=>setGlossarySearch(e.target.value)} placeholder="Search terms..." style={{width:"100%",padding:"10px 14px",borderRadius:10,border:"1px solid var(--g200)",fontSize:14,outline:"none",background:"var(--g50)"}}/></div>
<div style={{flex:1,overflowY:"auto",padding:"0 24px 24px"}}>
{Object.entries(GLOSSARY).filter(([k])=>!glossarySearch||k.toLowerCase().includes(glossarySearch.toLowerCase())).map(([term,def])=>(
<div key={term} style={{padding:"14px 0",borderBottom:"1px solid var(--g100)"}}><div style={{fontSize:14,fontWeight:700,color:"var(--blue)",marginBottom:4}}>{term}</div><div style={{fontSize:13,color:"var(--g600)",lineHeight:1.55}}>{def}</div></div>
))}
</div>
</div>
</div>}

{/* TEMPLATE PICKER */}
{showTemplates&&<div onClick={e=>{if(e.target===e.currentTarget)setShowTemplates(false)}} style={{position:"fixed",inset:0,background:"rgba(0,0,0,.25)",backdropFilter:"blur(10px)",zIndex:200,display:"flex",alignItems:"center",justifyContent:"center",padding:16}}><div style={{background:"#fff",borderRadius:20,padding:"24px 20px",width:"100%",maxWidth:520,boxShadow:"0 20px 60px rgba(0,0,0,.15)",maxHeight:"90vh",overflowY:"auto"}}><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}><h3 style={{fontSize:20,fontWeight:700,letterSpacing:-.5}}>Case Templates</h3><button onClick={()=>setShowTemplates(false)} style={{background:"none",border:"none",cursor:"pointer",fontSize:18,color:"var(--g400)"}}>×</button></div><p style={{fontSize:13,color:"var(--g500)",marginBottom:16}}>Start from a template to pre-fill common injury details.</p><div style={{display:"flex",flexDirection:"column",gap:6}}>{CASE_TEMPLATES.map((t,i)=><button key={i} onClick={()=>{setNf(p=>({...p,injuryType:t.type,description:t.desc}));setShowTemplates(false);setModal("new")}} style={{display:"flex",alignItems:"center",gap:12,padding:"14px 16px",background:"var(--g50)",border:".5px solid var(--g200)",borderRadius:12,cursor:"pointer",textAlign:"left"}}><div style={{width:36,height:36,borderRadius:10,background:"var(--blue-light)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,fontWeight:700,color:"var(--blue)",flexShrink:0}}>{t.icon}</div><div style={{flex:1}}><div style={{fontSize:14,fontWeight:600,color:"var(--g900)"}}>{t.label}</div><div style={{fontSize:12,color:"var(--g500)",marginTop:1}}>{t.desc.slice(0,80)}…</div></div><span style={{color:"var(--g300)",fontSize:16}}>›</span></button>)}</div></div></div>}

{/* BENEFIT CALCULATOR */}
{showCalc&&<BenefitCalc claim={active} onClose={()=>setShowCalc(false)}/>}

{/* ANALYTICS */}
{showAnalytics&&<AnalyticsDash claims={claims} onClose={()=>setShowAnalytics(false)}/>}

{modal==="new"&&<div onClick={e=>{if(e.target===e.currentTarget)setModal(null)}} style={{position:"fixed",inset:0,background:"rgba(0,0,0,.25)",backdropFilter:"blur(10px)",zIndex:200,display:"flex",alignItems:"center",justifyContent:"center",padding:16}}><div style={{background:"#fff",borderRadius:20,padding:"24px 20px",width:"100%",maxWidth:480,boxShadow:"0 20px 60px rgba(0,0,0,.15)",animation:"scaleIn .3s cubic-bezier(.25,.1,.25,1)",maxHeight:"90vh",overflowY:"auto"}}><h3 style={{fontSize:20,fontWeight:700,letterSpacing:-.5,marginBottom:4}}>New Case</h3><p style={{fontSize:13,color:"var(--g500)",marginBottom:12}}>Enter claim details. Add documents after creating.</p>{[{k:"claimNumber",l:"Case Number",p:"Auto-generated if blank"},{k:"worker",l:"Worker Name / Initials",p:"e.g. J. Smith"},{k:"employer",l:"Employer",p:"e.g. Acme Construction"}].map(f=><div key={f.k}><label style={{display:"block",fontSize:12,fontWeight:600,color:"var(--g500)",marginBottom:4,marginTop:12}}>{f.l}</label><input value={nf[f.k]} onChange={e=>setNf(p=>({...p,[f.k]:e.target.value}))} placeholder={f.p} style={{width:"100%",padding:"10px 14px",borderRadius:10,border:".5px solid var(--g200)",fontSize:14,outline:"none",background:"var(--g50)",fontFamily:"inherit"}}/></div>)}<label style={{display:"block",fontSize:12,fontWeight:600,color:"var(--g500)",marginBottom:4,marginTop:12}}>Date of Injury</label><input type="date" value={nf.injuryDate} onChange={e=>setNf(p=>({...p,injuryDate:e.target.value}))} style={{width:"100%",padding:"10px 14px",borderRadius:10,border:".5px solid var(--g200)",fontSize:14,outline:"none",background:"var(--g50)",fontFamily:"inherit"}}/><label style={{display:"block",fontSize:12,fontWeight:600,color:"var(--g500)",marginBottom:4,marginTop:12}}>Injury Type</label><select value={nf.injuryType} onChange={e=>setNf(p=>({...p,injuryType:e.target.value}))} style={{width:"100%",padding:"10px 14px",borderRadius:10,border:".5px solid var(--g200)",fontSize:14,outline:"none",background:"var(--g50)",fontFamily:"inherit"}}><option>Acute Injury</option><option>Occupational Disease</option><option>Traumatic Mental Stress</option><option>Chronic Mental Stress</option><option>PTSD (First Responder)</option><option>Recurrence</option><option>Aggravation of Pre-existing</option></select><label style={{display:"block",fontSize:12,fontWeight:600,color:"var(--g500)",marginBottom:4,marginTop:12}}>Description</label><textarea value={nf.description} onChange={e=>setNf(p=>({...p,description:e.target.value}))} placeholder="Describe the injury…" rows={3} style={{width:"100%",padding:"10px 14px",borderRadius:10,border:".5px solid var(--g200)",fontSize:14,outline:"none",background:"var(--g50)",fontFamily:"inherit",resize:"none"}}/><div style={{display:"flex",gap:8,justifyContent:"flex-end",marginTop:16}}><button onClick={()=>setModal(null)} style={{padding:"7px 16px",borderRadius:980,fontSize:13,fontWeight:600,border:".5px solid var(--g300)",background:"transparent",color:"var(--g600)",cursor:"pointer"}}>Cancel</button><button onClick={createClaim} style={{padding:"7px 16px",borderRadius:980,fontSize:13,fontWeight:600,border:"none",background:"var(--blue)",color:"#fff",cursor:"pointer"}}>Create</button></div></div></div>}

{modal==="stage"&&active&&<div onClick={e=>{if(e.target===e.currentTarget)setModal(null)}} style={{position:"fixed",inset:0,background:"rgba(0,0,0,.25)",backdropFilter:"blur(10px)",zIndex:200,display:"flex",alignItems:"center",justifyContent:"center",padding:16}}><div style={{background:"#fff",borderRadius:20,padding:"24px 20px",width:"100%",maxWidth:400,boxShadow:"0 20px 60px rgba(0,0,0,.15)"}}><h3 style={{fontSize:20,fontWeight:700,marginBottom:16}}>Change Status</h3>{STAGES.map(s=><button key={s.id} onClick={()=>changeStage(s.id)} style={{display:"flex",alignItems:"center",gap:10,padding:"10px 14px",borderRadius:10,border:"none",background:active.stage===s.id?"var(--blue-light)":"transparent",cursor:"pointer",fontSize:14,fontWeight:active.stage===s.id?600:500,color:active.stage===s.id?"var(--blue)":"var(--g700)",width:"100%",textAlign:"left",marginBottom:2}}><span style={{width:10,height:10,borderRadius:"50%",background:s.color}}/>{s.label}{active.stage===s.id&&<span style={{marginLeft:"auto",fontSize:12,color:"var(--g400)"}}>Current</span>}</button>)}<div style={{display:"flex",justifyContent:"flex-end",marginTop:16}}><button onClick={()=>setModal(null)} style={{padding:"7px 16px",borderRadius:980,fontSize:13,fontWeight:600,border:".5px solid var(--g300)",background:"transparent",color:"var(--g600)",cursor:"pointer"}}>Close</button></div></div></div>}
</div></>)}

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
return(<div style={{marginBottom:16}}><div style={{fontSize:12,fontWeight:700,color:"var(--g400)",textTransform:"uppercase",letterSpacing:.5,marginBottom:8}}>Deadlines & Milestones</div><div style={{display:"flex",gap:6,flexWrap:"wrap"}}>{deadlines.map((d,i)=>{const overdue=d.status==="overdue";return(<div key={i} style={{padding:"8px 12px",borderRadius:12,background:overdue?"var(--red-light)":"var(--g50)",border:`.5px solid ${overdue?"var(--red-border)":"var(--g200)"}`,flex:"1 1 200px",minWidth:180}}><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:2}}><span style={{fontSize:12,fontWeight:600,color:overdue?"var(--red)":"var(--g700)"}}>{d.label}</span><span style={{fontSize:10,fontWeight:600,color:overdue?"var(--red)":"var(--blue)",background:overdue?"rgba(255,59,48,.1)":"var(--blue-light)",padding:"2px 8px",borderRadius:100}}>{overdue?`${Math.abs(d.daysLeft)}d overdue`:`${d.daysLeft}d`}</span></div><div style={{fontSize:11,color:"var(--g500)"}}>{fmt(d.date)}</div></div>)})}</div></div>)}

function RTWBar({progress}){if(!progress)return null;const colors={recovered:"var(--green)",delayed:"var(--red)","on-track":"var(--blue)",late:"var(--orange)"};const c=colors[progress.status]||"var(--blue)";
return(<div style={{marginBottom:16,padding:"12px 16px",background:"var(--g50)",borderRadius:12,border:`.5px solid var(--g200)`}}><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}><span style={{fontSize:12,fontWeight:700,color:"var(--g700)"}}>Return-to-Work Progress</span><span style={{fontSize:12,fontWeight:600,color:c}}>{progress.label}</span></div><div style={{height:6,background:"var(--g200)",borderRadius:3,overflow:"hidden"}}><div style={{width:`${progress.pct}%`,height:"100%",background:c,borderRadius:3,transition:"width .5s ease"}}/></div><div style={{display:"flex",justifyContent:"space-between",marginTop:4}}><span style={{fontSize:10,color:"var(--g400)"}}>Injury date</span><span style={{fontSize:10,color:"var(--g400)",textTransform:"capitalize"}}>{progress.status}</span><span style={{fontSize:10,color:"var(--g400)"}}>Expected full RTW</span></div></div>)}

function DocList({documents}){if(!documents||documents.length===0)return null;const byType={};documents.forEach(d=>{const tag=d.tag||"other";if(!byType[tag])byType[tag]=[];byType[tag].push(d)});
return(<div style={{marginBottom:16}}><div style={{fontSize:12,fontWeight:700,color:"var(--g400)",textTransform:"uppercase",letterSpacing:.5,marginBottom:8}}>Documents ({documents.length})</div><div style={{display:"flex",flexDirection:"column",gap:4}}>{Object.entries(byType).map(([tag,docs])=>{const dt=docTypeOf(tag);return docs.map((d,i)=>(<div key={`${tag}-${i}`} style={{display:"flex",alignItems:"center",gap:8,padding:"8px 12px",background:"#fff",borderRadius:8,border:"1px solid var(--card-border)"}}><span style={{fontSize:11,fontWeight:600,color:dt.color,background:`${dt.color}12`,padding:"2px 8px",borderRadius:6,whiteSpace:"nowrap"}}>{dt.label}</span><span style={{fontSize:13,color:"var(--g700)",flex:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{d.name}</span><span style={{fontSize:10,color:"var(--g400)",whiteSpace:"nowrap"}}>{fmtTime(d.addedAt)}</span></div>))})}</div></div>)}

function ActionCard({action,onAction}){const c=action.priority==="high"?{bg:"rgba(0,113,227,.05)",border:"rgba(0,113,227,.15)",accent:"var(--blue)"}:{bg:"var(--g50)",border:"var(--g200)",accent:"var(--g700)"};
return(<button onClick={()=>onAction(action)} style={{display:"flex",alignItems:"center",gap:12,padding:"14px 16px",width:"100%",background:c.bg,border:`.5px solid ${c.border}`,borderRadius:12,cursor:"pointer",textAlign:"left",transition:"all .2s"}}><div style={{width:32,height:32,borderRadius:8,background:action.priority==="high"?"var(--blue)":"var(--g200)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}><span style={{fontSize:14,color:action.priority==="high"?"#fff":"var(--g600)"}}>{action.action==="upload"?<svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5"/></svg>:action.action==="analyze"?<svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z"/></svg>:action.action.startsWith("stage:")?<svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3"/></svg>:<svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 01.865-.501 48.172 48.172 0 003.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z"/></svg>}</span></div><div style={{flex:1,minWidth:0}}><div style={{fontSize:14,fontWeight:600,color:c.accent}}>{action.label}</div><div style={{fontSize:12,color:"var(--g500)",marginTop:1,lineHeight:1.4}}>{action.desc}</div></div><span style={{color:"var(--g300)",fontSize:18,flexShrink:0}}>›</span></button>)}

function CaseSummaryCard({claim,onClick,onCompare,comparing}){const s=stageOf(claim.stage);const _hasMed=claim.documents?.some(d=>["medical","form8","physio","specialist","imaging"].includes(d.tag));const rtw=(_hasMed||claim.analyses?.length>0)?getRTWProgress(claim):null;const lastRuling=claim.analyses?.[claim.analyses.length-1]?.ruling;const deadlines=getDeadlines(claim);const urgentDl=deadlines.find(d=>d.status==="overdue"||d.daysLeft<=3);
const pill=(color)=>({padding:"2px 10px",borderRadius:100,fontSize:11,fontWeight:600,color,background:`${color}10`,border:`.5px solid ${color}30`,whiteSpace:"nowrap"});
return(<div onClick={onCompare?()=>onCompare(claim):onClick} style={{padding:"14px",outline:comparing?"2px solid var(--blue)":"none",background:"#fff",borderRadius:12,border:"1px solid var(--card-border)",boxShadow:"var(--card-shadow)",cursor:"pointer",marginBottom:8,transition:"all .2s"}}><div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:8}}><div style={{display:"flex",alignItems:"center",gap:8,flex:1,minWidth:0}}><span style={{width:10,height:10,borderRadius:"50%",background:s.color,flexShrink:0}}/><span style={{fontSize:15,fontWeight:700}}>{claim.claimNumber}</span><span style={pill(s.color)}>{s.label}</span>{lastRuling&&<span style={pill(lastRuling==="Allow"?"var(--green)":lastRuling==="Deny"?"var(--red)":"var(--orange)")}>AI: {lastRuling}</span>}</div><span style={{color:"var(--g300)",fontSize:18,flexShrink:0}}>›</span></div>
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
return(<div onClick={e=>{if(e.target===e.currentTarget)onClose()}} style={{position:"fixed",inset:0,background:"rgba(0,0,0,.35)",backdropFilter:"blur(8px)",zIndex:200,display:"flex",alignItems:"center",justifyContent:"center",padding:16}}>
<div style={{background:"#fff",borderRadius:20,padding:"24px 20px",width:"100%",maxWidth:520,boxShadow:"0 20px 60px rgba(0,0,0,.15)",maxHeight:"90vh",overflowY:"auto"}}>
<div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}><h3 style={{fontSize:20,fontWeight:700,letterSpacing:-.5}}>Benefit Calculator</h3><button onClick={onClose} style={{background:"none",border:"none",cursor:"pointer",fontSize:18,color:"var(--g400)"}}>×</button></div>
<p style={{fontSize:13,color:"var(--g500)",marginBottom:16}}>Estimate LOE and NEL based on pre-injury earnings. These are estimates only — actual amounts determined by WSIB.</p>
<label style={{display:"block",fontSize:12,fontWeight:600,color:"var(--g500)",marginBottom:4}}>Pre-injury gross weekly earnings ($)</label>
<input type="number" value={earnings.gross} onChange={e=>setEarnings(p=>({...p,gross:e.target.value}))} placeholder="e.g. 980.00" style={{width:"100%",padding:"10px 14px",borderRadius:12,border:"1px solid var(--card-border)",fontSize:14,outline:"none",background:"var(--g50)",fontFamily:"inherit",marginBottom:12}}/>
<label style={{display:"block",fontSize:12,fontWeight:600,color:"var(--g500)",marginBottom:4}}>Pre-injury net weekly earnings ($) <span style={{fontWeight:400}}>(optional, defaults to 72% of gross)</span></label>
<input type="number" value={earnings.net} onChange={e=>setEarnings(p=>({...p,net:e.target.value}))} placeholder="Auto-calculated if blank" style={{width:"100%",padding:"10px 14px",borderRadius:12,border:"1px solid var(--card-border)",fontSize:14,outline:"none",background:"var(--g50)",fontFamily:"inherit",marginBottom:12}}/>
<label style={{display:"block",fontSize:12,fontWeight:600,color:"var(--g500)",marginBottom:4}}>Current post-injury weekly earnings ($) <span style={{fontWeight:400}}>(if doing modified work)</span></label>
<input type="number" value={earnings.postInjury} onChange={e=>setEarnings(p=>({...p,postInjury:e.target.value}))} placeholder="0 if fully off work" style={{width:"100%",padding:"10px 14px",borderRadius:12,border:"1px solid var(--card-border)",fontSize:14,outline:"none",background:"var(--g50)",fontFamily:"inherit",marginBottom:16}}/>
<button onClick={calc} style={{width:"100%",padding:"12px",borderRadius:12,border:"none",background:"var(--blue)",color:"#fff",fontSize:14,fontWeight:600,cursor:"pointer"}}>Calculate Benefits</button>
{result&&<div style={{marginTop:16}}>
<div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:12}}>
<div style={{padding:12,background:"var(--blue-light)",borderRadius:12,border:"1px solid var(--blue-border)"}}><div style={{fontSize:10,fontWeight:600,color:"var(--blue)",textTransform:"uppercase",letterSpacing:.5}}>Weekly LOE (85%)</div><div style={{fontSize:20,fontWeight:800,color:"var(--blue)"}}>${result.loe85.toFixed(2)}</div></div>
<div style={{padding:12,background:"var(--green-light)",borderRadius:12,border:"1px solid rgba(52,199,89,.15)"}}><div style={{fontSize:10,fontWeight:600,color:"var(--green)",textTransform:"uppercase",letterSpacing:.5}}>Monthly LOE</div><div style={{fontSize:20,fontWeight:800,color:"var(--green)"}}>${result.monthlyLOE}</div></div>
<div style={{padding:12,background:"var(--g50)",borderRadius:12,border:"1px solid var(--card-border)"}}><div style={{fontSize:10,fontWeight:600,color:"var(--g500)",textTransform:"uppercase",letterSpacing:.5}}>NEL Range</div><div style={{fontSize:14,fontWeight:600,color:"var(--g700)"}}>{result.nelRange}</div></div>
<div style={{padding:12,background:"var(--g50)",borderRadius:12,border:"1px solid var(--card-border)"}}><div style={{fontSize:10,fontWeight:600,color:"var(--g500)",textTransform:"uppercase",letterSpacing:.5}}>NEL Amount</div><div style={{fontSize:14,fontWeight:600,color:"var(--g700)"}}>{result.nelAmount}</div></div>
</div>
<div style={{padding:12,background:"var(--g50)",borderRadius:12,border:"1px solid var(--card-border)",fontSize:12,color:"var(--g600)",lineHeight:1.5}}>
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

return(<div onClick={e=>{if(e.target===e.currentTarget)onClose()}} style={{position:"fixed",inset:0,background:"rgba(0,0,0,.35)",backdropFilter:"blur(8px)",zIndex:200,display:"flex",alignItems:"center",justifyContent:"center",padding:16}}>
<div style={{background:"#fff",borderRadius:20,padding:"24px 20px",width:"100%",maxWidth:640,boxShadow:"0 20px 60px rgba(0,0,0,.15)",maxHeight:"90vh",overflowY:"auto"}}>
<div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}><h3 style={{fontSize:20,fontWeight:700,letterSpacing:-.5}}>Analytics</h3><button onClick={onClose} style={{background:"none",border:"none",cursor:"pointer",fontSize:18,color:"var(--g400)"}}>×</button></div>

<div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(100px,1fr))",gap:8,marginBottom:14}}>
<div style={{padding:14,background:"var(--g50)",borderRadius:12,textAlign:"center"}}><div style={{fontSize:28,fontWeight:800}}>{total}</div><div style={{fontSize:10,color:"var(--g500)"}}>Total Cases</div></div>
<div style={{padding:14,background:"var(--green-light)",borderRadius:12,textAlign:"center"}}><div style={{fontSize:28,fontWeight:800,color:"var(--green)"}}>{byRuling.allow}</div><div style={{fontSize:10,color:"var(--g500)"}}>Allowed</div></div>
<div style={{padding:14,background:"var(--red-light)",borderRadius:12,textAlign:"center"}}><div style={{fontSize:28,fontWeight:800,color:"var(--red)"}}>{byRuling.deny}</div><div style={{fontSize:10,color:"var(--g500)"}}>Denied</div></div>
<div style={{padding:14,background:"var(--g50)",borderRadius:12,textAlign:"center"}}><div style={{fontSize:28,fontWeight:800}}>{avgDocs}</div><div style={{fontSize:10,color:"var(--g500)"}}>Avg Docs/Case</div></div>
</div>

{totalAnalyses>0&&<div style={{marginBottom:14}}><div style={{fontSize:12,fontWeight:700,color:"var(--g400)",textTransform:"uppercase",letterSpacing:.5,marginBottom:8}}>Ruling Distribution</div>
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

<div style={{marginBottom:14}}><div style={{fontSize:12,fontWeight:700,color:"var(--g400)",textTransform:"uppercase",letterSpacing:.5,marginBottom:8}}>Cases by Stage</div>
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


/* === Medical Provider Tracking === */
const PROVIDER_TYPES=["Family Doctor","Emergency","Specialist","Surgeon","Physiotherapist","Chiropractor","Psychologist","Imaging Clinic","Pharmacy","Other"];

/* === Letter Templates === */
const LETTER_TEMPLATES=[
{id:"representation",label:"Letter of Representation",desc:"Notify WSIB that you represent the injured worker",prompt:"Generate a formal Letter of Representation for this WSIB claim. Include: lawyer/firm name placeholder, worker name, employer name, claim number, injury date, and a statement that all future correspondence should be directed to the representative. Format as a professional letter."},
{id:"records_request",label:"Medical Records Request",desc:"Request records from a treating physician",prompt:"Generate a Medical Records Request letter for this WSIB claim. Include: provider name placeholder, worker name, date of injury, claim number, request for all clinical notes, diagnostic imaging, treatment plans, and functional abilities information from date of injury to present. Reference WSIB's authority to share information under the WSIA."},
{id:"intent_object",label:"Intent to Object",desc:"Notify WSIB you disagree with a decision",prompt:"Generate an Intent to Object letter for this WSIB claim that has been denied. Include: worker name, claim number, date of WSIB decision, specific grounds for objection, request for reconsideration, and statement preserving appeal rights. Reference OPM 11-01-13 benefit of doubt."},
{id:"employer_response",label:"Employer Response Request",desc:"Request information from the employer",prompt:"Generate a letter requesting information from the employer regarding this WSIB claim. Include: employer name, worker name, claim number, request for job description, modified duties availability, witness statements, and incident investigation report."},
{id:"faf_request",label:"FAF Update Request",desc:"Request updated Functional Abilities Form",prompt:"Generate a letter to the treating physician requesting an updated Functional Abilities Form (FAF) for this WSIB claim. Include: worker name, claim number, current treatment status, and request for updated physical restrictions and return-to-work recommendations."}
];

/* === Claim Valuation Fields === */
const VALUATION_FIELDS=[
{id:"medicalToDate",label:"Medical Costs to Date",desc:"Total medical expenses incurred"},
{id:"medicalFuture",label:"Projected Future Medical",desc:"Estimated remaining treatment costs"},
{id:"loeToDate",label:"LOE Benefits to Date",desc:"Loss of earnings paid so far"},
{id:"loeFuture",label:"Projected Future LOE",desc:"Estimated remaining wage loss"},
{id:"nel",label:"NEL Award Estimate",desc:"Non-Economic Loss lump sum"},
{id:"legalFees",label:"Legal Fees",desc:"Contingency or hourly fees"},
{id:"disbursements",label:"Disbursements",desc:"Filing fees, expert reports, travel"},
{id:"otherCosts",label:"Other Costs",desc:"Any additional claim-related costs"}
];


/* === Risk Assessment Score === */
function getRiskScore(claim){if(!claim)return null;let risk=0;const factors=[];
const inj=claim.injuryDate&&claim.injuryDate!=="\u2014"?new Date(claim.injuryDate):null;
if(inj){const days=Math.floor((Date.now()-inj)/864e5);if(days>90)risk+=3;else if(days>30)risk+=1;factors.push({label:"Days open: "+days,impact:days>90?"high":days>30?"medium":"low"})}
const flags=getRedFlags(claim);risk+=flags.filter(f=>f.severity==="critical").length*4;risk+=flags.filter(f=>f.severity==="high").length*2;risk+=flags.filter(f=>f.severity==="medium").length;
if(flags.length>0)factors.push({label:flags.length+" red flag"+(flags.length>1?"s":""),impact:flags.some(f=>f.severity==="critical")?"high":"medium"});
if(/mental|ptsd|chronic/i.test(claim.injuryType||""))risk+=2;
if(!claim.documents?.length)risk+=2;
if(!claim.analyses?.length)risk+=1;
const dl=getDeadlines(claim);const overdue=dl.filter(d=>d.status==="overdue");risk+=overdue.length*2;
if(overdue.length)factors.push({label:overdue.length+" overdue deadline"+(overdue.length>1?"s":""),impact:"high"});
const level=risk>=10?"Critical":risk>=6?"High":risk>=3?"Medium":"Low";
const color=risk>=10?"var(--red)":risk>=6?"var(--orange)":risk>=3?"var(--blue)":"var(--green)";
return{score:risk,level,color,factors}}

/* === Three-Point Contact === */
function getThreePointContact(claim){return{
worker:{label:"Injured Worker",contacted:claim.threePoint?.worker||false,date:claim.threePoint?.workerDate||null},
employer:{label:"Employer",contacted:claim.threePoint?.employer||false,date:claim.threePoint?.employerDate||null},
medical:{label:"Medical Provider",contacted:claim.threePoint?.medical||false,date:claim.threePoint?.medicalDate||null}
}}

/* === AWW Calculator === */
function calcAWW(grossWeekly){if(!grossWeekly||grossWeekly<=0)return null;
const cpp=grossWeekly*0.0595;const ei=grossWeekly*0.0229;const fedTax=grossWeekly*0.15;const provTax=grossWeekly*0.0505;
const netWeekly=grossWeekly-cpp-ei-fedTax-provTax;const loe85=netWeekly*0.85;
return{gross:grossWeekly,cpp:cpp.toFixed(2),ei:ei.toFixed(2),fedTax:fedTax.toFixed(2),provTax:provTax.toFixed(2),net:netWeekly.toFixed(2),loe85:loe85.toFixed(2),loeMonthly:(loe85*4.33).toFixed(2)}}



/* === CASE WORKFLOW ENGINE === */
const WORKFLOW_STEPS=[
{id:"report",phase:"Intake",title:"Report the Injury",desc:"File the initial injury report with WSIB within required timelines.",checks:[{id:"form6",label:"Form 6 (Worker Report) filed",test:c=>c.documents?.some(d=>d.tag==="form6")},{id:"form7",label:"Form 7 (Employer Report) filed",test:c=>c.documents?.some(d=>d.tag==="form7")},{id:"description",label:"Incident description documented",test:c=>(!!c.description&&c.description.length>10)||c.documents?.some(d=>d.tag==="form6")}],action:"Upload Form 6 and Form 7, and add a detailed incident description.",actionNav:"documents"},
{id:"contact",phase:"Intake",title:"Initial Three-Point Contact",desc:"Contact the worker, employer, and medical provider within 24 hours.",checks:[{id:"worker_contact",label:"Worker contacted",test:c=>c.threePoint?.worker},{id:"employer_contact",label:"Employer contacted",test:c=>c.threePoint?.employer},{id:"medical_contact",label:"Medical provider contacted",test:c=>c.threePoint?.medical}],action:"Complete the Three-Point Contact on the Overview tab.",actionNav:"overview"},
{id:"medical",phase:"Evidence",title:"Gather Medical Evidence",desc:"Collect Form 8, clinical notes, imaging, and functional abilities information.",checks:[{id:"form8",label:"Form 8 (Physician Report) received",test:c=>c.documents?.some(d=>d.tag==="form8")},{id:"medical_doc",label:"Medical records obtained",test:c=>c.documents?.some(d=>["medical","specialist","imaging","physio"].includes(d.tag))},{id:"provider_tracked",label:"Treating providers tracked",test:c=>c.providers?.length>0}],action:"Upload Form 8 and medical records. Track providers on the Providers tab.",actionNav:"providers"},
{id:"analyze",phase:"Assessment",title:"Run AI Analysis",desc:"Analyze the claim against the WSIB OPM using the Five Point Check.",checks:[{id:"analysis_done",label:"AI ruling analysis completed",test:c=>c.analyses?.length>0},{id:"red_flags_reviewed",label:"Red flags reviewed",test:c=>c.analyses?.length>0}],action:"Open the Advisor and run a Five Point Check analysis.",actionNav:"chat"},
{id:"decision",phase:"Assessment",title:"Review Decision",desc:"Review the ruling, calculate benefits, and update the claim status.",checks:[{id:"ruling_received",label:"Ruling or prediction received",test:c=>c.analyses?.length>0||c.stage==="approved"||c.stage==="denied"},{id:"benefits_calc",label:"Benefit entitlements calculated",test:c=>{const v=c.valuation||{};return Object.values(v).some(x=>parseFloat(x)>0)}},{id:"stage_set",label:"Claim status updated",test:c=>c.stage!=="new"}],action:"Update claim status and enter benefit calculations on the Value tab.",actionNav:"valuation"},
{id:"rtw",phase:"Resolution",title:"Return-to-Work Planning",desc:"Coordinate modified duties, track recovery, and plan the return to work.",checks:[{id:"modified_duties",label:"Modified duties documented",test:c=>c.modifiedDuties?.length>0},{id:"faf_obtained",label:"Functional Abilities Form obtained",test:c=>c.documents?.some(d=>(d.name||"").toLowerCase().includes("faf")||(d.name||"").toLowerCase().includes("functional"))}],action:"Record modified duties and request an updated FAF from the treating physician.",actionNav:"modified"},
{id:"resolve",phase:"Resolution",title:"Close or Appeal",desc:"Resolve the claim through closure, settlement, or begin the appeal process.",checks:[{id:"resolved",label:"Claim resolved or appeal filed",test:c=>c.stage==="closed"||c.stage==="approved"||(c.appeal?.stage&&c.appeal.stage!=="none")}],action:"Update the claim to its final status or start the appeal process.",actionNav:"appeal"}
];

/* === AI Brief (Gong-style) === */
function getAIBrief(claim){if(!claim)return"";const parts=[];
const days=claim.injuryDate&&claim.injuryDate!=="\u2014"?Math.floor((Date.now()-new Date(claim.injuryDate))/864e5):0;
parts.push(claim.worker+" vs "+claim.employer+" - "+claim.injuryType+" (Day "+days+").");
const wf=getWorkflowStatus(claim);parts.push("Progress: "+wf.pct+"% ("+wf.steps.filter(s=>s.complete).length+"/"+wf.steps.length+" steps).");
if(wf.currentIdx<wf.steps.length&&!wf.steps[wf.currentIdx].complete)parts.push("Next: "+wf.steps[wf.currentIdx].title+".");
const rs=getRiskScore(claim);if(rs)parts.push("Risk: "+rs.level+".");
const lr=claim.analyses?.[claim.analyses.length-1];if(lr)parts.push("Ruling: "+lr.ruling+".");
const dl=getDeadlines(claim);const overdue=dl.filter(d=>d.status==="overdue");if(overdue.length)parts.push(overdue.length+" overdue.");
const flags=getRedFlags(claim);if(flags.length)parts.push(flags.length+" red flags.");
return parts.join(" ")}

/* === Smart Warnings (Gong-style) === */
function getSmartWarnings(claim){if(!claim)return[];const w=[];
const lastAct=claim.timeline?.[claim.timeline.length-1];
if(lastAct){const d=Math.floor((Date.now()-new Date(lastAct.date))/864e5);
if(d>=14)w.push({type:"critical",label:"Going Dark",desc:"No activity for "+d+" d"});
else if(d>=7)w.push({type:"warning",label:"Losing Momentum",desc:"No activity for "+d+" d"});}
if(!claim.threePoint?.worker&&!claim.threePoint?.employer)w.push({type:"warning",label:"No Contact",desc:"Three-point contact incomplete"});
if((claim.documents?.length||0)===0&&claim.stage!=="new")w.push({type:"critical",label:"No Evidence",desc:"No documents uploaded"});
if(!claim.analyses?.length&&(claim.documents?.length||0)>0)w.push({type:"warning",label:"Needs Analysis",desc:"Docs uploaded, no AI analysis"});
if(claim.stage==="denied"&&!(claim.appeal?.stage))w.push({type:"critical",label:"No Appeal",desc:"Denied, appeal not started"});
return w}

function getWorkflowStatus(claim){if(!claim)return{steps:[],currentIdx:0,pct:0};const steps=WORKFLOW_STEPS.map(s=>{const checks=s.checks.map(ch=>({...ch,done:ch.test(claim)}));const complete=checks.every(ch=>ch.done);const partial=checks.some(ch=>ch.done);return{...s,checks,complete,partial}});let currentIdx=steps.findIndex(s=>!s.complete);if(currentIdx<0)currentIdx=steps.length-1;const done=steps.filter(s=>s.complete).length;const pct=Math.round((done/steps.length)*100);return{steps,currentIdx,pct}}


/* === Inline Help Tooltips === */
const WSIB_TERMS={"OPM":"Operational Policy Manual - WSIB\'s official policy guide for claim adjudication","LOE":"Loss of Earnings - wage replacement benefit at 85% of net pre-injury earnings","NEL":"Non-Economic Loss - lump sum for permanent impairment","FAF":"Functional Abilities Form - physician report on work restrictions","Form 6":"Worker\'s Report of Injury - filed by the injured worker","Form 7":"Employer\'s Report of Injury - must be filed within 3 business days","Form 8":"Health Professional\'s Report - filed by the treating physician","RTW":"Return to Work - the process of getting the worker back to employment","WSIB":"Workplace Safety and Insurance Board - Ontario\'s workers compensation authority","WSIAT":"Workplace Safety and Insurance Appeals Tribunal - handles WSIB appeals","PIPEDA":"Personal Information Protection and Electronic Documents Act","ICD-10":"International Classification of Diseases, 10th Revision","AWW":"Average Weekly Wage - used to calculate LOE benefits","WSIA":"Workplace Safety and Insurance Act - the governing legislation","TPA":"Third Party Administrator - manages claims on behalf of employers","FROI":"First Report of Injury - initial claim filing","CRT":"Claims Review Tribunal","SIEF":"Second Injury and Enhancement Fund"};


/* === OPM Policy Reference Panel Data === */
const OPM_POLICIES={
"11-01-01":{url:"https://www.wsib.ca/en/operational-policy-manual/adjudicative-process",title:"Five Point Check",chapter:"Decision-Making",text:"ALL five points required for entitlement: 1) Account in good standing, 2) Worker performing duties of employment, 3) Personal injury by accident or occupational disease, 4) Arising out of and in the course of employment, 5) Resulting disability or loss of earnings. If all five points are met, claim is straightforward, and employer is not disputing — allow immediately.",applies:["all"]},
"11-01-02":{title:"Decision-Making Process",chapter:"Decision-Making",text:"WSIB uses an inquiry system, not adversarial. Decision-makers actively investigate facts. Not bound by precedent but must follow policy. Appeal path: Decision-maker then Appeals Resolution Officer then Appeals Services Division then WSIAT.",applies:["all"]},
"11-01-03":{url:"https://www.wsib.ca/en/operational-policy-manual/merits-and-justice",title:"Merits and Justice",chapter:"Decision-Making",text:"Must consider all provisions of WSIA/WCA, all applicable OPM policies, and all available evidence. Cannot disregard the Act or established policies. The goal is a fair and just outcome based on individual circumstances.",applies:["all"]},
"11-01-06":{url:"https://www.wsib.ca/en/operational-policy-manual/recurrences",title:"Recurrences",chapter:"Decision-Making",text:"A recurrence is a return of symptoms of a previously allowed injury. Must establish: original injury was work-related, current symptoms relate to original injury, no new intervening cause. Does not require a new accident.",applies:["Recurrence"]},
"11-01-13":{url:"https://www.wsib.ca/en/operational-policy-manual/benefit-doubt",title:"Benefit of Doubt",chapter:"Decision-Making",text:"When evidence is equally balanced after full investigation, favour the claimant. Not a substitute for gathering evidence. Only applies when evidence is genuinely equal after thorough investigation. Must not be used to avoid investigation.",applies:["all"]},
"15-01-01":{url:"https://www.wsib.ca/en/operational-policy-manual/reporting-obligations",title:"Reporting Requirements",chapter:"Claims",text:"Employers: Form 7 within 3 business days of learning of injury. Workers: file claim within 6 months. Health professionals: Form 8 on first visit. Late reporting does not bar a claim but may affect credibility.",applies:["all"]},
"15-02-01":{url:"https://www.wsib.ca/en/operational-policy-manual/arising-out-and-course-employment",title:"Work Relatedness",chapter:"Claims",text:'Two-part test: "arising out of" + "in the course of" employment. Both required. Employment must be a significant contributing factor. Does not need to be sole or primary cause.',applies:["all"]},
"15-02-02":{url:"https://www.wsib.ca/en/operational-policy-manual/arising-out-and-course-employment",title:"Arising Out of Employment",chapter:"Claims",text:"Employment must be a significant contributing factor to the injury. Pre-existing conditions: if work aggravated, accelerated, or activated a pre-existing condition, the claim is compensable under the thin skull principle.",applies:["all"]},
"15-03-02":{url:"https://www.wsib.ca/en/operational-policy-manual/traumatic-mental-stress",title:"Traumatic Mental Stress",chapter:"Claims",text:"Must result from acute reaction to sudden/unexpected traumatic event(s). Must be clearly and precisely identifiable. Chronic workplace stress is NOT covered under this policy (see 15-03-14).",applies:["Traumatic Mental Stress"]},
"15-03-13":{url:"https://www.wsib.ca/en/operational-policy-manual/post-traumatic-stress-disorder",title:"PTSD First Responders",chapter:"Claims",text:"Presumptive coverage for diagnosed PTSD in first responders (police, fire, paramedics, corrections, dispatchers). Diagnosis from appropriate healthcare practitioner required. Presumption applies unless evidence to the contrary.",applies:["PTSD (First Responder)"]},
"15-03-14":{url:"https://www.wsib.ca/en/operational-policy-manual/chronic-mental-stress",title:"Chronic Mental Stress",chapter:"Claims",text:"Effective January 1, 2018. Covers chronic mental stress caused by substantial work-related stressor(s). Must be diagnosed by appropriate healthcare professional. Excludes decisions/actions of employer related to employment (hiring, firing, transfers, discipline).",applies:["Chronic Mental Stress"]},
"15-04-01":{url:"https://www.wsib.ca/en/operational-policy-manual/pre-existing-conditions",title:"Pre-existing Conditions",chapter:"Claims",text:"Thin skull principle: take the worker as you find them. If work injury aggravates, accelerates, or activates a pre-existing condition, the entire resulting disability is compensable. WSIB covers the full disability.",applies:["all"]},
"18-01-01":{url:"https://www.wsib.ca/en/operational-policy-manual/determining-average-earnings",title:"Loss of Earnings (LOE)",chapter:"Benefits",text:"Post-1998 injuries: 85% of net average earnings minus post-injury earnings. First 12 weeks based on current employment. After 12 weeks: long-term average considered. LOE review at 72 months — final determination.",applies:["all"]},
"18-02-01":{url:"https://www.wsib.ca/en/operational-policy-manual/non-economic-loss",title:"Non-Economic Loss (NEL)",chapter:"Benefits",text:"For permanent impairment from 1990+ injuries. Assessed using AMA Guides. Lump sum based on % whole person impairment.",applies:["all"]},
"19-01-01":{url:"https://www.wsib.ca/en/operational-policy-manual/return-work",title:"RTW Obligations",chapter:"Return to Work",text:"Workers: obligation to co-operate in return to work. Employers: obligation to re-employ (if 20+ employees) and accommodate. Modified work: must be productive, meaningful, and consistent with functional abilities.",applies:["all"]},
"19-02-01":{url:"https://www.wsib.ca/en/operational-policy-manual/return-work",title:"Modified Work",chapter:"Return to Work",text:"Based on Functional Abilities Form (FAF). Must be within documented restrictions. Must be productive and meaningful. Employer must provide details in writing. Progressive return encouraged.",applies:["all"]}
};
function getRelevantPolicies(claim){const type=claim?.injuryType||"";return Object.entries(OPM_POLICIES).filter(([k,v])=>v.applies.includes("all")||v.applies.includes(type)).map(([k,v])=>({code:k,...v}))}

/* === AI Tools for Lawyers & Adjudicators === */
const AI_TOOLS=[
{id:"evidence_check",category:"Assessment",title:"Evidence Sufficiency Check",desc:"Review all evidence and flag gaps before making a decision or filing.",icon:"EC",color:"#E53935",prompt:c=>"Perform a comprehensive evidence sufficiency check for this claim. Review all documents on file ("+((c.documents||[]).map(d=>d.tag).join(", ")||"none")+") and determine:\n\n1. REQUIRED EVIDENCE STATUS:\n- Form 6 (Worker Report): "+(c.documents?.some(d=>d.tag==="form6")?"Present":"MISSING")+"\n- Form 7 (Employer Report): "+(c.documents?.some(d=>d.tag==="form7")?"Present":"MISSING")+"\n- Form 8 (Physician Report): "+(c.documents?.some(d=>d.tag==="form8")?"Present":"MISSING")+"\n- Medical records: "+(c.documents?.some(d=>["medical","specialist","imaging","physio"].includes(d.tag))?"Present":"MISSING")+"\n\n2. For each of the Five Point Check criteria, assess whether sufficient evidence exists to make a determination\n3. Identify specific evidence gaps that could weaken the claim\n4. Rate overall evidence sufficiency as Strong/Moderate/Weak/Insufficient\n5. Recommend specific documents or information to obtain\n\nClaim: "+c.worker+" vs "+c.employer+", "+c.injuryType+", DOI: "+c.injuryDate},

{id:"case_narrative",category:"Assessment",title:"Case Narrative",desc:"Generate a plain-English narrative of the entire case from start to present.",icon:"CN",color:"#3B5EC0",prompt:c=>"Generate a comprehensive case narrative for this claim in plain English suitable for presenting to a tribunal, supervisor, or client. Include:\n\n1. INTRODUCTION: Worker, employer, date of injury, nature of injury\n2. INCIDENT: What happened (based on description: "+(c.description||"not provided")+")\n3. MEDICAL HISTORY: Documents on file, treatments, diagnoses\n4. CLAIM TIMELINE: Key events from filing to current status ("+stageOf(c.stage).label+")\n5. CURRENT STATUS: Where the claim stands, what has been determined\n6. OUTSTANDING ISSUES: What remains unresolved\n\nWrite in a professional, objective tone. Use dates where available. This narrative should be suitable for formal proceedings."},

{id:"decision_template",category:"Adjudication",title:"Five-Point Decision Template",desc:"Structured walkthrough of each entitlement criterion for adjudicators.",icon:"DT",color:"#6C5CE7",prompt:c=>"Generate a formal Five-Point Check decision template for this claim. For each of the five criteria, provide:\n\n**POINT 1 - Personal injury by accident / Disease**\n- Evidence supporting: [list]\n- Evidence against: [list]\n- Analysis: [reasoning]\n- Determination: Satisfied / Not Satisfied / Insufficient Evidence\n\n**POINT 2 - Arising out of employment**\n- Evidence supporting: [list]\n- Evidence against: [list]\n- Analysis: [reasoning applying OPM 15-02]\n- Determination: Satisfied / Not Satisfied / Insufficient Evidence\n\n**POINT 3 - In the course of employment**\n(same structure)\n\n**POINT 4 - Disability**\n(same structure)\n\n**POINT 5 - Active employer account**\n(same structure)\n\n**OVERALL DETERMINATION**: Allow / Deny / Further Investigation Required\n**POLICY REFERENCES**: List all OPM sections applied\n**BENEFIT OF DOUBT**: Was OPM 11-01-13 applied? Why or why not?\n\nBase analysis on: "+c.injuryType+", worker: "+c.worker+", employer: "+c.employer+", documents: "+((c.documents||[]).map(d=>d.tag).join(", ")||"none")},

{id:"appeal_brief",category:"Legal",title:"Appeal Brief Builder",desc:"Generate a structured appeal brief with OPM arguments for WSIAT.",icon:"AB",color:"#0071E3",prompt:c=>"Generate a comprehensive appeal brief for WSIAT for this denied or disputed claim. Structure as follows:\n\n**APPEAL BRIEF**\n**Re: "+c.claimNumber+" - "+c.worker+" v. WSIB**\n\n1. INTRODUCTION AND OVERVIEW\n2. STATEMENT OF FACTS\n- Worker: "+c.worker+"\n- Employer: "+c.employer+"\n- Date of Injury: "+c.injuryDate+"\n- Nature of Injury: "+c.injuryType+"\n- Description: "+(c.description||"N/A")+"\n3. PROCEDURAL HISTORY (claim filed, initial decision, objection)\n4. ISSUES ON APPEAL\n5. EVIDENCE SUMMARY\n- Documents on file: "+((c.documents||[]).map(d=>d.name+" ["+d.tag+"]").join("; ")||"none")+"\n6. LEGAL ARGUMENT\n- Apply Five Point Check with OPM policy citations\n- Address each criterion with supporting evidence\n- Apply Benefit of Doubt (OPM 11-01-13)\n- Apply Merits and Justice (OPM 11-01-03)\n7. REQUESTED RELIEF\n\nFormat as a professional legal brief suitable for WSIAT submission."},

{id:"opposing_args",category:"Legal",title:"Opposing Arguments",desc:"Anticipate what the other side might argue and prepare rebuttals.",icon:"OA",color:"#F57C00",prompt:c=>"For this claim ("+c.injuryType+", "+c.worker+" vs "+c.employer+"), anticipate the opposing arguments that might be raised and prepare rebuttals:\n\n1. If representing the WORKER, what will the WSIB/employer likely argue?\n2. If representing the EMPLOYER, what will the worker/their representative likely argue?\n\nFor each anticipated argument:\n- State the argument clearly\n- Cite the OPM policy they would rely on\n- Provide a specific rebuttal with counter-evidence and alternative OPM references\n- Rate the strength of their argument (Strong/Moderate/Weak)\n\nAlso identify:\n- The single biggest vulnerability in this claim\n- The strongest argument for allowance\n- Key questions that a WSIAT panel might ask\n\nDocuments on file: "+((c.documents||[]).map(d=>d.tag).join(", ")||"none")+"\nDescription: "+(c.description||"N/A")},

{id:"medical_chrono",category:"Medical",title:"Medical Chronology",desc:"Build a chronological timeline of all medical events from the claim.",icon:"MC",color:"#28A745",prompt:c=>"Generate a detailed medical chronology for this claim. Using all available information, create a date-ordered timeline of:\n\n1. Date of injury: "+c.injuryDate+"\n2. Initial medical treatment (based on Form 8 and medical records)\n3. All diagnostic tests (imaging, blood work, specialist referrals)\n4. All treatment interventions (medications, physiotherapy, surgery)\n5. Functional abilities assessments\n6. Return-to-work attempts and outcomes\n7. Current medical status\n\nFor each entry include: DATE | PROVIDER | EVENT TYPE | DETAILS | SIGNIFICANCE\n\nDocuments on file: "+((c.documents||[]).map(d=>d.name+" ["+d.tag+"]").join("; ")||"none")+"\n\nIf documents are insufficient, note what medical records should be obtained and from whom. Providers tracked: "+((c.providers||[]).map(p=>p.name+" ("+p.type+")").join(", ")||"none")},

{id:"wsiat_search",category:"Legal",title:"WSIAT Precedent Search",desc:"Search for relevant WSIAT decisions and precedents for this case.",icon:"WS",color:"#251A5E",prompt:c=>"Search your knowledge of WSIAT decisions and WSIB appeal outcomes to find relevant precedents for this claim:\n\nInjury Type: "+c.injuryType+"\nDescription: "+(c.description||"N/A")+"\nWorker: "+c.worker+"\nEmployer: "+c.employer+"\n\nProvide:\n1. SIMILAR CASES: List 3-5 WSIAT decisions or appeal outcomes involving similar injury types, circumstances, or legal issues\n2. For each precedent:\n   - Case reference or decision number (if known)\n   - Brief facts\n   - Key legal issue\n   - Outcome (allowed/denied)\n   - Relevant OPM policies applied\n   - How it relates to the current claim\n3. PATTERN ANALYSIS: What do the precedents suggest about the likely outcome?\n4. DISTINGUISHING FACTORS: What makes this case different from the precedents?\n5. RECOMMENDED STRATEGY: Based on precedents, what approach is most likely to succeed?"},

{id:"lost_time_class",category:"Adjudication",title:"Lost Time Classification",desc:"Auto-classify as lost time or no lost time and recommend fast-track eligibility.",icon:"LT",color:"#00C7BE",prompt:c=>"Classify this claim and recommend processing pathway:\n\n1. CLASSIFICATION:\n- Lost Time Claim or No Lost Time Claim?\n- Basis for classification\n\n2. COMPLEXITY ASSESSMENT:\n- Simple (straightforward, no dispute, clear medical evidence)\n- Moderate (some complexity, may need additional evidence)\n- Complex (disputed, multiple injuries, pre-existing conditions, mental health)\n\n3. FAST-TRACK ELIGIBILITY:\n- Can this claim be fast-tracked for immediate allowance? Yes/No\n- Requirements for fast-track: [list what would need to be confirmed]\n\n4. ESTIMATED PROCESSING TIMELINE:\n- Expected time to initial decision\n- Key milestones\n\n5. COST ESTIMATE:\n- Estimated total claim cost range based on injury type and classification\n\nBased on: "+c.injuryType+", "+c.worker+", DOI: "+c.injuryDate+"\nDocuments: "+((c.documents||[]).map(d=>d.tag).join(", ")||"none")+"\nDescription: "+(c.description||"N/A")},

{id:"opm_reference",category:"Reference",title:"OPM Policy Lookup",desc:"Get the relevant OPM sections for this injury type with full explanations.",icon:"OP",color:"#5856D6",prompt:c=>"Provide a comprehensive OPM (Operational Policy Manual) policy reference guide specific to this claim:\n\nInjury Type: "+c.injuryType+"\n\n1. PRIMARY POLICIES:\n- List all OPM sections directly applicable to this injury type\n- For each: section number, title, key provisions, and how they apply\n\n2. ENTITLEMENT POLICIES:\n- OPM 11-01-01 (Five Point Check)\n- OPM 11-01-02 (Decision-Making)\n- OPM 11-01-03 (Merits and Justice)\n- OPM 11-01-13 (Benefit of Doubt)\n- Explain how each applies to this specific case\n\n3. INJURY-SPECIFIC POLICIES:\n- OPM Chapter 15 sections specific to "+c.injuryType+"\n- Any presumptive coverage provisions (e.g., PTSD for first responders under 15-03-13)\n\n4. BENEFIT POLICIES:\n- Applicable LOE calculation rules (Chapter 18)\n- NEL assessment criteria\n- RTW obligations\n\n5. KEY DATES AND TIMELINES:\n- Filing deadlines\n- Appeal windows\n- Review periods"}
];
/* ═══════════════════════════════════════════════════════════════════
   MAIN APP
   ═══════════════════════════════════════════════════════════════════ */
export default function DashboardClient({user}){const[view,setView]=useState("home");const[claims,setClaims]=useState([]);const[active,setActive]=useState(null);const[msgs,setMsgs]=useState([]);const[input,setInput]=useState("");const[loading,setLoading]=useState(false);const[files,setFiles]=useState([]);const[fc,setFc]=useState({});const[modal,setModal]=useState(null);const[nf,setNf]=useState({claimNumber:"",worker:"",employer:"",injuryDate:"",injuryType:"Acute Injury",description:""});const[noteIn,setNoteIn]=useState("");const[filter,setFilter]=useState("all");const[searchQ,setSearchQ]=useState("");const[detailTab,setDetailTab]=useState("overview");const[showCalc,setShowCalc]=useState(false);const[showAnalytics,setShowAnalytics]=useState(false);const[showTemplates,setShowTemplates]=useState(false);const[bulkSelect,setBulkSelect]=useState([]);const[showNotifs,setShowNotifs]=useState(false);const[showGlossary,setShowGlossary]=useState(false);const[glossarySearch,setGlossarySearch]=useState("");const[homeTab,setHomeTab]=useState("overview");const[commLog,setCommLog]=useState({to:"",method:"email",date:"",note:""});const[taskInput,setTaskInput]=useState("");const[valuation,setValuation]=useState({});const[providerForm,setProviderForm]=useState({name:"",type:"Family Doctor",phone:"",status:"requested"});const[cmdOpen,setCmdOpen]=useState(false);const[showOnboarding,setShowOnboarding]=useState(false);const[compareMode,setCompareMode]=useState(false);const[compareCases,setCompareCases]=useState([]);const[showImport,setShowImport]=useState(false);const[showBilling,setShowBilling]=useState(false);const[userPlan,setUserPlan]=useState(()=>{if(typeof window!=="undefined")return localStorage.getItem("ca_plan_"+user?.email)||"starter";return"starter"});const[undoStack,setUndoStack]=useState([]);const[onboardStep,setOnboardStep]=useState(0);const[showShortcuts,setShowShortcuts]=useState(false);const[sideHover,setSideHover]=useState(false);const[diaryEntry,setDiaryEntry]=useState({date:"",note:"",caseId:""});const[emailModal,setEmailModal]=useState(null);const[emailSending,setEmailSending]=useState(false);const[emailStatus,setEmailStatus]=useState(null);const[cmdQ,setCmdQ]=useState("");const[quickNote,setQuickNote]=useState({open:false,text:"",caseId:""});const[timer,setTimer]=useState({running:false,caseId:null,start:null,entries:[]});const[savedMemos,setSavedMemos]=useState([]);async function sendEmail(to,subject,body,cc,bcc){setEmailSending(true);setEmailStatus(null);try{const res=await fetch("/api/email",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({to,subject,body,cc:cc||undefined,bcc:bcc||undefined,claimNumber:active?.claimNumber,senderName:user?.name||user?.email,senderEmail:user?.email})});const data=await res.json();if(data.success){setEmailStatus("sent");if(active){const cl={...active};cl.emails=[...(cl.emails||[]),{id:Date.now(),from:user?.email,to,cc:cc||"",subject,body,date:new Date().toISOString(),direction:"outbound"}];cl.comms=[...(cl.comms||[]),{to,method:"email",date:new Date().toISOString(),note:"Email: "+subject}];cl.timeline=[...(cl.timeline||[]),{date:new Date().toISOString(),type:"note",note:"Email sent to "+to+": "+subject}];saveClaim(cl)}setTimeout(()=>{setEmailModal(null);setEmailStatus(null)},1500)}else{setEmailStatus("error: "+(data.error||"Failed"))}}catch(e){setEmailStatus("error: "+e.message)}finally{setEmailSending(false)}}
function pushUndo(label,rollback){setUndoStack(p=>[{label,rollback,ts:Date.now()},...p].slice(0,5));setTimeout(()=>setUndoStack(p=>p.filter(u=>Date.now()-u.ts<8000)),8500)}
const fRef=useRef(null);const endRef=useRef(null);const taRef=useRef(null);

useEffect(()=>{const handler=(e)=>{if(e.target.tagName==="INPUT"||e.target.tagName==="TEXTAREA"||e.target.tagName==="SELECT")return;if(e.key==="n"&&!e.metaKey&&!e.ctrlKey){e.preventDefault();setModal("new")}if(e.key==="s"&&!e.metaKey&&!e.ctrlKey){e.preventDefault();nav("claims")}if(e.key==="a"&&!e.metaKey&&!e.ctrlKey){e.preventDefault();setActive(null);setMsgs([]);nav("chat")}if(e.key==="h"&&!e.metaKey&&!e.ctrlKey){e.preventDefault();nav("home")}if(e.key==="Escape"){setModal(null);setShowCalc(false);setShowAnalytics(false);setShowTemplates(false);setCmdOpen(false);setQuickNote(p=>({...p,open:false}))}if((e.metaKey||e.ctrlKey)&&e.key==="k"){e.preventDefault();setCmdOpen(true)}if(e.key==="?"&&!e.metaKey&&!e.ctrlKey){setShowShortcuts(true)}};window.addEventListener("keydown",handler);return()=>window.removeEventListener("keydown",handler)},[]);
useEffect(()=>{const cl=loadClaims(user.email);setClaims(cl);if(cl.length===0&&!localStorage.getItem("ca_onboarded_"+user.email))setShowOnboarding(true)},[user.email]);
useEffect(()=>{if(claims.length>0||window.localStorage.getItem(storageKey(user.email)))persistClaims(user.email,claims)},[claims,user.email]);
useEffect(()=>{endRef.current?.scrollIntoView({behavior:"smooth"})},[msgs,loading]);
useEffect(()=>{if(!timer.running)return;const iv=setInterval(()=>setTimer(p=>({...p,tick:Date.now()})),1000);return()=>clearInterval(iv)},[timer.running]);

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

const send=async(override)=>{const text=override||input.trim();if(!text&&files.length===0)return;setInput("");if(taRef.current)taRef.current.style.height="auto";let content=text;const af=[...files];if(af.length>0&&Object.keys(fc).length>0)content=`${text||"Please analyze these claim documents."}\n\n[UPLOADED DOCUMENTS]\n${Object.entries(fc).map(([n,c])=>`── ${n} ──\n${c}`).join("\n\n────\n\n")}`;if(active)content=`[CLAIM CONTEXT]\nClaim #: ${active.claimNumber}\nWorker: ${active.worker}\nEmployer: ${active.employer}\nInjury Date: ${active.injuryDate}\nType: ${active.injuryType}\nStatus: ${stageOf(active.stage).label}\nDescription: ${active.description||"N/A"}\nDays since injury: ${active.injuryDate!=="—"?daysAgo(active.injuryDate):"unknown"}\nDocuments on file: ${active.documents?.length||0} (${(active.documents||[]).map(d=>d.tag).filter((v,i,a)=>a.indexOf(v)===i).join(", ")||"none"})\nPrevious analyses: ${active.analyses?.length||0}\n\n${content}`;const um={role:"user",display:text||`Uploaded ${af.length} document${af.length>1?"s":""}`,content,files:af.map(f=>f.name),ts:new Date().toISOString()};const newMsgs=[...msgs,um];setMsgs(newMsgs);setFiles([]);setFc({});setLoading(true);
if(active&&af.length>0){const c={...active};c.documents=[...(c.documents||[]),...af.map(f=>({name:f.name,tag:guessDocType(f.name),addedAt:new Date().toISOString()}))];c.timeline=[...(c.timeline||[]),...af.map(f=>({date:new Date().toISOString(),type:"document",note:`Uploaded: ${f.name}`}))];saveClaim(c)}
try{const hist=newMsgs.slice(-20).map(m=>({role:m.role==="user"?"user":"assistant",content:m.content}));const res=await fetch("/api/chat",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({messages:hist,documentTexts:fc})});const data=await res.json();if(!res.ok)throw new Error(data.error||"Request failed");const reply=data.reply;const am={role:"assistant",content:reply,ts:new Date().toISOString()};const final=[...newMsgs,am];setMsgs(final);if(active){const c={...active,messages:final};if(/RULING PREDICTION|Five Point Check/i.test(reply)){const ruling=/Allow/i.test(reply)&&!/Deny/i.test(reply.split("RULING")[1]||"")?"Allow":/Deny/i.test(reply)?"Deny":"Further Investigation";c.analyses=[...(c.analyses||[]),{date:new Date().toISOString(),ruling,snippet:reply.slice(0,200)}];c.timeline=[...(c.timeline||[]),{date:new Date().toISOString(),type:"analysis",note:`AI analysis — Ruling: ${ruling}`}];if(c.stage==="new"){c.stage="review";c.timeline.push({date:new Date().toISOString(),type:"stage",note:"Status → Under Review"})}}saveClaim(c)}}catch(err){setMsgs(p=>[...p,{role:"assistant",content:`**Error:** ${err.message}`,ts:new Date().toISOString()}])}finally{setLoading(false)}};

const scenarios=[{l:"Back injury claim",t:"A warehouse worker injured their lower back lifting a 50lb box on March 3, 2026. Reported same day, Form 7 filed March 5. Doctor diagnosed lumbar strain (M54.5), recommended 4 weeks off. No pre-existing conditions. What would WSIB rule?"},{l:"Disputed late reporting",t:"A construction worker reports a shoulder injury 3 weeks after the alleged incident. No witnesses. Employer is disputing. How would WSIB approach this?"},{l:"Pre-existing aggravation",t:"Worker has documented degenerative disc disease at L4-L5. Claims a workplace slip aggravated this, now needs surgery. How does the thin skull principle apply?"},{l:"First responder PTSD",t:"A paramedic with 12 years of service is filing a PTSD claim after a fatal MVA involving children. What does OPM 15-03-13 say about presumptive coverage?"}];
const filtered=filter==="all"?claims:claims.filter(c=>c.stage===filter);
const displayed=searchQ?searchClaims(filtered,searchQ):filtered;
const recentClaims=claims.slice(0,5);
const stageCounts=STAGES.map(s=>({...s,count:claims.filter(c=>c.stage===s.id).length})).filter(s=>s.count>0);
const needsAttention=claims.filter(c=>["new","investigating"].includes(c.stage)||getDeadlines(c).some(d=>d.status==="overdue"));
const pill=(color)=>({padding:"2px 10px",borderRadius:100,fontSize:11,fontWeight:600,color,background:`${color}10`,border:`.5px solid ${color}30`,whiteSpace:"nowrap"});

return(<><style jsx global>{`
.ai-text{font-size:14.5px;line-height:1.7;color:var(--g700);letter-spacing:-0.01em}.ai-text strong{font-weight:600;color:var(--g900)}.ai-h{font-weight:700;color:var(--g900);letter-spacing:-.5px}.ai-h1{font-size:22px;margin:28px 0 10px}.ai-h2{font-size:17px;margin:24px 0 6px}.ai-h3{font-size:15px;margin:18px 0 4px}.ai-p{margin-top:4px}
.ai-ruling{padding:18px 22px;border-radius:12px;margin:18px 0 10px;font-size:16px;font-weight:700;letter-spacing:-.3px;display:flex;align-items:center;gap:10px}.ai-rdot{width:10px;height:10px;border-radius:50%;flex-shrink:0}
.ai-ruling.allow{background:var(--green-light);color:#1B7D36;border:.5px solid rgba(52,199,89,.15)}.ai-ruling.allow .ai-rdot{background:var(--green)}.ai-ruling.deny{background:var(--red-light);color:#CC2D26;border:.5px solid var(--red-border)}.ai-ruling.deny .ai-rdot{background:var(--red)}.ai-ruling.inv{background:rgba(255,149,0,.06);color:#A66A00;border:.5px solid rgba(255,149,0,.12)}.ai-ruling.inv .ai-rdot{background:#FF9500}
.ai-flag{padding:12px 16px;border-radius:8px;margin:8px 0 4px;font-size:13px;font-weight:500;color:#CC2D26;background:var(--red-light);border:.5px solid var(--red-border)}.ai-opm{display:inline-block;padding:3px 10px;border-radius:6px;margin:4px 0;font-family:'DM Mono',monospace;font-size:12px;font-weight:500;color:var(--blue);background:var(--blue-light);border:.5px solid var(--blue-border)}
.ai-chk{display:flex;align-items:flex-start;gap:10px;padding:12px 16px;border-radius:8px;margin:6px 0;font-size:14px}.ai-ci{width:22px;height:22px;border-radius:50%;flex-shrink:0;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:800}.ai-chk.pass{background:var(--green-light);border:.5px solid rgba(52,199,89,.15)}.ai-chk.pass .ai-ci{background:var(--green);color:white}.ai-chk.fail{background:var(--red-light);border:.5px solid var(--red-border)}.ai-chk.fail .ai-ci{background:var(--red);color:white}
.ai-li{padding-left:18px;position:relative;margin-top:4px;font-size:14px}.ai-li::before{content:'';position:absolute;left:4px;top:10px;width:5px;height:5px;border-radius:50%;background:var(--g300)}.ai-ol{display:flex;gap:10px;margin-top:5px;font-size:14px}.ai-oln{font-weight:700;color:var(--blue);font-size:12px;font-family:'DM Mono',monospace;min-width:18px;text-align:right;margin-top:3px}
.desktop-nav{display:flex;transition:all .2s}
.mobile-bnav{display:none}
@media(max-width:768px){.desktop-nav{display:none!important}.mobile-bnav{display:flex!important}.ai-h1{font-size:18px!important}.ai-h2{font-size:15px!important}.ai-ruling{font-size:14px;padding:12px 14px}.ai-text{font-size:14px}}
`}</style>
<div style={{height:"100vh",display:"flex",flexDirection:"column"}}>



{/* LEFT SIDEBAR */}
<div style={{display:"flex",flex:1,overflow:"hidden"}}>
<div onMouseEnter={()=>setSideHover(true)} onMouseLeave={()=>setSideHover(false)} className="desktop-nav" style={{width:sideHover?180:52,flexShrink:0,background:"linear-gradient(180deg, #1A1040 0%, #251A5E 35%, #2E3580 65%, #3B5EC0 100%)",borderRight:"none",display:"flex",flexDirection:"column",padding:"12px 0",transition:"width .2s cubic-bezier(.16,1,.3,1)",overflow:"hidden",zIndex:95}}>
<div style={{padding:"0 10px",marginBottom:12,cursor:"pointer",display:"flex",alignItems:"center",gap:8,overflow:"hidden"}} onClick={()=>nav("home")}>
<div style={{width:32,height:32,flexShrink:0}}><svg width="32" height="32" viewBox="0 0 80 90" fill="none">
<defs><linearGradient id="slogo" x1="0" y1="0" x2="0.5" y2="1"><stop offset="0%" stopColor="#1A1040"/><stop offset="100%" stopColor="#2E3580"/></linearGradient></defs>
<rect x="16" y="16" width="54" height="64" rx="12" fill="#3B5EC0" opacity="0.5"/>
<rect x="10" y="10" width="54" height="64" rx="12" fill="#2E3580" opacity="0.7"/>
<rect x="4" y="4" width="54" height="64" rx="12" fill="url(#slogo)"/>
<line x1="16" y1="22" x2="44" y2="22" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" opacity="0.7"/>
<line x1="16" y1="34" x2="38" y2="34" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" opacity="0.5"/>
<line x1="16" y1="46" x2="32" y2="46" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" opacity="0.35"/>
<path d="M42 19L45.5 22.5L52 15" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" opacity="0.9"/>
</svg></div>
{sideHover&&<span style={{fontSize:14,fontWeight:700,color:"#fff",whiteSpace:"nowrap",letterSpacing:-.3}}>CaseAssist</span>}
</div>

{[{id:"home",icon:'<path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25"/>',label:"Home"},{id:"claims",icon:'<path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z"/>',label:"My Cases"},{id:"board",icon:'<path strokeLinecap="round" strokeLinejoin="round" d="M9 4.5v15m6-15v15m-10.875 0h15.75c.621 0 1.125-.504 1.125-1.125V5.625c0-.621-.504-1.125-1.125-1.125H4.125C3.504 4.5 3 5.004 3 5.625v12.75c0 .621.504 1.125 1.125 1.125z"/>',label:"Board"},{id:"advisor",icon:'<path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 01.865-.501 48.172 48.172 0 003.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z"/>',label:"Advisor"},{id:"templates",icon:'<path strokeLinecap="round" strokeLinejoin="round" d="M8.25 7.5V6.108c0-1.135.845-2.098 1.976-2.192.373-.03.748-.057 1.123-.08M15.75 18H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08M15.75 18.75v-1.875a3.375 3.375 0 00-3.375-3.375h-1.5a1.125 1.125 0 01-1.125-1.125v-1.5A3.375 3.375 0 006.375 7.5H5.25m11.9-3.664A2.251 2.251 0 0015 2.25h-1.5a2.251 2.251 0 00-2.15 1.586m5.8 0c.065.21.1.433.1.664v.75h-6V4.5c0-.231.035-.454.1-.664M6.75 7.5H4.875c-.621 0-1.125.504-1.125 1.125v12c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V16.5a9 9 0 00-9-9z"/>',label:"Templates"},{id:"analytics",icon:'<path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z"/>',label:"Analytics"},{id:"glossary",icon:'<path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25"/>',label:"Glossary"}].map(t=>(
<button key={t.id} onClick={()=>{if(t.id==="advisor"){setActive(null);setMsgs([]);nav("chat")}else if(t.id==="templates")setShowTemplates(true);else if(t.id==="analytics")setShowAnalytics(true);else if(t.id==="glossary")setShowGlossary(true);else nav(t.id)}} style={{display:"flex",alignItems:"center",gap:10,padding:"10px",margin:"1px 8px",borderRadius:10,border:"none",background:(view===t.id||(t.id==="advisor"&&view==="chat"&&!active))?"rgba(255,255,255,.2)":"transparent",color:(view===t.id||(t.id==="advisor"&&view==="chat"&&!active))?"#fff":"rgba(255,255,255,.6)",cursor:"pointer",overflow:"hidden",whiteSpace:"nowrap"}}>
<svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5" style={{flexShrink:0}} dangerouslySetInnerHTML={{__html:t.icon}}/>
{sideHover&&<span style={{fontSize:12,fontWeight:600,letterSpacing:-.1,color:"#fff"}}>{t.label}</span>}
</button>))}
<div style={{flex:1}}/>
<button onClick={()=>setShowBilling(true)} style={{display:"flex",alignItems:"center",gap:10,padding:"10px",margin:"1px 8px",borderRadius:10,border:"none",background:"transparent",color:"rgba(255,255,255,.5)",cursor:"pointer",overflow:"hidden",whiteSpace:"nowrap"}}><svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8" style={{flexShrink:0}}><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z"/></svg>{sideHover&&<span style={{fontSize:12,fontWeight:500,color:"rgba(255,255,255,.6)"}}>Billing</span>}</button>
<button onClick={()=>signOut({callbackUrl:"/login"})} style={{display:"flex",alignItems:"center",gap:10,padding:"10px",margin:"1px 8px",borderRadius:10,border:"none",background:"transparent",color:"rgba(255,255,255,.5)",cursor:"pointer",overflow:"hidden",whiteSpace:"nowrap"}}>
<svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5" style={{flexShrink:0}}><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9"/></svg>
{sideHover&&<span style={{fontSize:12,fontWeight:500,color:"rgba(255,255,255,.6)"}}>Sign Out</span>}
</button>
</div>

{/* MAIN CONTENT AREA */}
<div style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden",background:"var(--bg)"}}>
{/* Top right action bar */}
<div style={{display:"flex",justifyContent:"flex-end",alignItems:"center",gap:6,padding:"10px 20px 0",flexShrink:0}}>
<button onClick={()=>setCmdOpen(true)} style={{display:"flex",alignItems:"center",gap:6,padding:"6px 14px",borderRadius:8,border:"1px solid var(--card-border)",background:"#fff",color:"var(--g400)",cursor:"pointer",fontSize:12}}><svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"/></svg>Search<span style={{fontSize:10,color:"var(--g300)",marginLeft:8,fontFamily:"monospace"}}>Cmd+K</span></button>
<button onClick={()=>setShowNotifs(!showNotifs)} style={{width:34,height:34,borderRadius:8,border:"1px solid var(--card-border)",background:showNotifs?"var(--g900)":"#fff",color:showNotifs?"#fff":"var(--g500)",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",position:"relative"}}><svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8"><path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0"/></svg>{(()=>{const u=getNotifications(claims).filter(x=>x.type==="urgent").length;return u>0?<span style={{position:"absolute",top:-2,right:-2,width:16,height:16,borderRadius:"50%",background:"#E53935",color:"#fff",fontSize:9,fontWeight:700,display:"flex",alignItems:"center",justifyContent:"center"}}>{u}</span>:null})()}</button>
<button onClick={()=>setQuickNote({open:true,text:"",caseId:""})} title="Quick Note" style={{width:34,height:34,borderRadius:8,border:"1px solid var(--card-border)",background:"#fff",color:"var(--g500)",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}><svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8"><path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10"/></svg></button>
<button onClick={()=>setModal("new")} style={{padding:"7px 16px",borderRadius:8,fontSize:12,fontWeight:600,border:"none",background:"var(--blue)",color:"#fff",cursor:"pointer",display:"flex",alignItems:"center",gap:5}}><svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15"/></svg>New Case</button>
<div style={{width:30,height:30,borderRadius:"50%",background:"var(--blue)",color:"#fff",display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:700,cursor:"default"}}>{(user.name||user.email||"U").charAt(0).toUpperCase()}</div>
</div>

{/* MOBILE NAV */}
<div className="mobile-bnav" style={{display:"none",position:"fixed",bottom:0,left:0,right:0,height:56,background:"rgba(255,255,255,.92)",backdropFilter:"saturate(180%) blur(20px)",borderTop:"1px solid rgba(0,0,0,.08)",zIndex:100,justifyContent:"space-around",alignItems:"center",padding:"0 8px"}}>{[{id:"home",label:"Home",icon:"H"},{id:"claims",label:"Cases",icon:"C"},{id:"chat",label:"Advisor",icon:"A"}].map(t=>(<button key={t.id} onClick={()=>{if(t.id==="chat"){setActive(null);setMsgs([])}nav(t.id)}} style={{display:"flex",flexDirection:"column",alignItems:"center",gap:2,background:"none",border:"none",cursor:"pointer",padding:"4px 12px"}}><span style={{fontSize:14,color:view===t.id||(t.id==="chat"&&view==="chat")?"var(--blue)":"var(--g400)"}}>{t.icon}</span><span style={{fontSize:10,fontWeight:600,color:view===t.id||(t.id==="chat"&&view==="chat")?"var(--blue)":"var(--g400)"}}>{t.label}</span></button>))}</div>

{/* == HOME == */}
{view==="home"&&(<div style={{flex:1,overflowY:"auto"}}><div className="fade-in" style={{maxWidth:1100,margin:"0 auto",padding:"24px 28px 100px"}}>

{claims.length===0?(<div style={{textAlign:"center",padding:"60px 0 40px"}}>
  <div style={{display:"inline-flex",alignItems:"center",gap:8,padding:"5px 16px 5px 6px",borderRadius:100,background:"#fff",border:"1px solid var(--card-border)",marginBottom:24,boxShadow:"0 1px 4px rgba(0,0,0,.03)"}}>
    <span style={{width:22,height:22,borderRadius:"50%",background:"var(--green)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,color:"#fff"}}>{"\u2713"}</span>
    <span style={{fontSize:12,fontWeight:600,color:"var(--g600)"}}>WSIB OPM Connected</span>
  </div>
  <h1 style={{fontSize:"clamp(32px, 6vw, 52px)",fontWeight:800,letterSpacing:"-0.04em",lineHeight:1.02,marginBottom:16}}>Claims intelligence,<br/><span style={{background:"linear-gradient(135deg, #0071E3, #34C759)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"}}>made simple.</span></h1>
  <p style={{fontSize:17,color:"var(--g500)",maxWidth:480,margin:"0 auto",lineHeight:1.65,marginBottom:32}}>Create your first case to start analyzing claims against the WSIB Operational Policy Manual.</p>
  <div style={{display:"flex",gap:12,justifyContent:"center",flexWrap:"wrap",marginBottom:48}}>
    <button onClick={()=>setModal("new")} style={{padding:"14px 32px",borderRadius:100,fontSize:16,fontWeight:700,border:"none",background:"var(--blue)",color:"#fff",cursor:"pointer",boxShadow:"0 4px 16px rgba(0,113,227,.3)"}}>Create your first case</button>
    <button onClick={()=>{setActive(null);setMsgs([]);nav("chat")}} style={{padding:"14px 32px",borderRadius:100,fontSize:16,fontWeight:600,border:"1px solid var(--g300)",background:"#fff",color:"var(--g900)",cursor:"pointer"}}>Ask the advisor</button>
  </div>
  <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit, minmax(220px, 1fr))",gap:12,maxWidth:700,margin:"0 auto"}}>
    {[{init:"RP",title:"AI Ruling Predictions",desc:"Five Point Check against the WSIB OPM",color:"#0071E3"},{init:"DI",title:"Document Intelligence",desc:"Auto-tagged forms and medical reports",color:"#34C759"},{init:"DL",title:"Deadline Tracking",desc:"Filing deadlines, RTW milestones",color:"#FF9500"},{init:"RF",title:"Red Flag Detection",desc:"Automated compliance indicators",color:"#FF3B30"},{init:"CS",title:"Claim Strength Score",desc:"0-100 evidence completeness rating",color:"#AF52DE"},{init:"BC",title:"Benefit Calculator",desc:"LOE, NEL, and cost forecasting",color:"#00C7BE"}].map((f,i)=>(
      <div key={i} style={{padding:"18px 20px",background:"#fff",borderRadius:16,border:"1px solid var(--card-border)",boxShadow:"var(--card-shadow)"}}>
        <div style={{width:40,height:40,borderRadius:12,background:`${f.color}10`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,fontWeight:700,color:f.color,marginBottom:10,border:`1px solid ${f.color}20`}}>{f.init}</div>
        <div style={{fontSize:14,fontWeight:700,color:"var(--g900)",marginBottom:3}}>{f.title}</div>
        <div style={{fontSize:12,color:"var(--g500)",lineHeight:1.4}}>{f.desc}</div>
      </div>
    ))}
  </div>
</div>):(
<>
{/* HOME TABS */}
<div style={{display:"flex",gap:2,padding:3,background:"var(--g100)",borderRadius:12,marginBottom:14}}>
{["overview","activity","resources"].map(t=>(
<button key={t} onClick={()=>setHomeTab(t)} style={{flex:1,padding:"8px 0",borderRadius:12,border:"none",fontSize:12,fontWeight:600,cursor:"pointer",background:homeTab===t?"#fff":"transparent",color:homeTab===t?"var(--g900)":"var(--g500)",boxShadow:homeTab===t?"0 1px 3px rgba(0,0,0,.06)":"none",textTransform:"capitalize"}}>{t}</button>
))}
</div>

{homeTab==="overview"&&<>
{/* GONG-STYLE: AI ASK BAR + HERO */}
<div style={{display:"grid",gridTemplateColumns:"1fr 320px",gap:12,marginBottom:14}}>
{/* Left: AI Ask + Pipeline */}
<div>
{/* AI Ask Bar */}
<div style={{padding:"18px 22px",background:"#fff",borderRadius:16,border:"1px solid var(--card-border)",boxShadow:"var(--card-shadow)",marginBottom:12}}>
<div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10}}><div style={{width:24,height:24,borderRadius:8,background:"linear-gradient(135deg, #251A5E, #3B5EC0)",display:"flex",alignItems:"center",justifyContent:"center"}}><span style={{fontSize:10,fontWeight:800,color:"#fff"}}>AI</span></div><div><div style={{fontSize:14,fontWeight:700,color:"var(--g900)"}}>Claims AI</div><div style={{fontSize:11,color:"var(--g500)"}}>Get AI-generated answers and briefs based on your cases</div></div></div>
<div onClick={()=>{setActive(null);setMsgs([]);nav("chat")}} style={{padding:"10px 16px",borderRadius:12,border:"1px solid var(--card-border)",background:"var(--g50)",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10}}><span style={{fontSize:13,color:"var(--g400)"}}>Ask anything about your cases...</span><svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="var(--g400)" strokeWidth="1.5"><path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5"/></svg></div>
<div style={{display:"flex",gap:6,flexWrap:"wrap"}}>{[{l:"Weekly update",p:"Give me a weekly summary of all my cases. What changed this week, what needs attention, and what are the next steps for each case?"},{l:"Next steps",p:"What are the most urgent next steps I should take across all my active cases right now?"},{l:"Risk review",p:"Which of my cases are at the highest risk right now? What warning signs should I be aware of?"},{l:"Compliance check",p:"Review all my cases for compliance issues - missed deadlines, missing forms, overdue follow-ups, and any WSIB OPM violations."}].map((q,i)=><button key={i} onClick={()=>{setActive(null);setMsgs([]);nav("chat");setTimeout(()=>send(q.p),100)}} style={{padding:"5px 12px",borderRadius:100,fontSize:11,fontWeight:500,border:"1px solid var(--card-border)",background:"#fff",color:"var(--g600)",cursor:"pointer"}}>{q.l}</button>)}</div>
</div>

{/* Pipeline Cards - Gong style */}
<div style={{padding:"18px 22px",background:"#fff",borderRadius:16,border:"1px solid var(--card-border)",boxShadow:"var(--card-shadow)"}}>
<div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
<div><div style={{fontSize:15,fontWeight:700,color:"var(--g900)"}}>Your Pipeline</div><div style={{fontSize:11,color:"var(--g500)"}}>{user.name?.split(" ")[0]||"Your"} cases · All time</div></div>
<button onClick={()=>nav("board")} style={{padding:"6px 14px",borderRadius:100,fontSize:11,fontWeight:600,border:"1px solid var(--card-border)",background:"#fff",color:"var(--g600)",cursor:"pointer"}}>Go to Board</button>
</div>
<div style={{display:"grid",gridTemplateColumns:"repeat(3, 1fr)",gap:8}}>
{[{id:"new",l:"New",c:"var(--blue)"},{id:"review",l:"In Review",c:"var(--orange)"},{id:"investigate",l:"Investigate",c:"#AF52DE"},{id:"approved",l:"Approved",c:"var(--green)"},{id:"denied",l:"Denied",c:"var(--red)"},{id:"closed",l:"Closed",c:"var(--g400)"}].map(s=>{const cnt=claims.filter(c=>c.stage===s.id).length;return(
<div key={s.id} onClick={()=>nav("board")} style={{padding:"14px",background:"var(--g50)",borderRadius:12,cursor:"pointer",borderLeft:"3px solid "+s.c}}>
<div style={{fontSize:11,color:"var(--g500)",fontWeight:500}}>{s.l}</div>
<div style={{display:"flex",alignItems:"baseline",gap:4,marginTop:4}}><span style={{fontSize:24,fontWeight:800,color:"var(--g900)",letterSpacing:-1}}>{cnt}</span><span style={{fontSize:11,color:"var(--g500)"}}>{cnt===1?"case":"cases"}</span></div>
</div>)})}
</div>
</div>
</div>

{/* Right sidebar: Upcoming + Warnings */}
<div>
{/* Welcome card */}
<div style={{padding:"16px 18px",background:"linear-gradient(135deg, #1A1040 0%, #3B5EC0 100%)",borderRadius:16,marginBottom:10,color:"#fff"}}>
<div style={{fontSize:16,fontWeight:800,letterSpacing:-.5}}>Welcome back, {user.name?.split(" ")[0]||"there"}</div>
<div style={{fontSize:12,opacity:.8,marginTop:2}}>{claims.length} case{claims.length!==1?"s":""}{needsAttention.length>0?" · "+needsAttention.length+" need attention":""}</div>
<div style={{display:"flex",gap:6,marginTop:10}}>
<button onClick={()=>setModal("new")} style={{padding:"7px 14px",borderRadius:100,fontSize:11,fontWeight:600,background:"rgba(255,255,255,.2)",border:"1px solid rgba(255,255,255,.25)",color:"#fff",cursor:"pointer"}}>+ New Case</button>
<button onClick={()=>setCmdOpen(true)} style={{padding:"7px 14px",borderRadius:100,fontSize:11,fontWeight:600,background:"rgba(255,255,255,.2)",border:"1px solid rgba(255,255,255,.25)",color:"#fff",cursor:"pointer"}}>Cmd+K</button>
</div>
</div>

{/* Coming Up - Gong style */}
<div style={{padding:"14px 16px",background:"#fff",borderRadius:12,border:"1px solid var(--card-border)",boxShadow:"var(--card-shadow)",marginBottom:10}}>
<div style={{fontSize:11,fontWeight:700,color:"var(--g500)",textTransform:"uppercase",letterSpacing:1,marginBottom:8}}>Coming Up</div>
{(()=>{const items=[...claims.flatMap(c=>getDeadlines(c).filter(d=>d.status==="overdue").map(d=>({...d,claimNumber:c.claimNumber,caseId:c.id,urgent:true}))),...claims.flatMap(c=>getDeadlines(c).filter(d=>d.daysLeft>=0&&d.daysLeft<=14&&d.status!=="overdue").map(d=>({...d,claimNumber:c.claimNumber,caseId:c.id,urgent:false}))),...claims.flatMap(c=>(c.diary||[]).filter(d=>!d.done).map(d=>({label:d.note,daysLeft:Math.floor((new Date(d.date)-Date.now())/864e5),claimNumber:c.claimNumber,caseId:c.id,urgent:false,isDiary:true})))];return items.length>0?items.sort((a,b)=>(a.daysLeft||0)-(b.daysLeft||0)).slice(0,5).map((it,i)=><div key={i} onClick={()=>{const cc=claims.find(x=>x.id===it.caseId);if(cc)openClaim(cc)}} style={{display:"flex",alignItems:"center",gap:8,padding:"6px 0",cursor:"pointer",borderBottom:i<4?"1px solid var(--g100)":"none"}}><div style={{width:6,height:6,borderRadius:"50%",background:it.urgent||it.daysLeft<0?"var(--red)":it.daysLeft<=3?"var(--orange)":"var(--blue)",flexShrink:0}}/><div style={{flex:1,minWidth:0}}><div style={{fontSize:11,color:"var(--g700)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{it.label}</div><div style={{fontSize:10,color:"var(--g400)"}}>{it.claimNumber}</div></div><span style={{fontSize:10,fontWeight:600,color:it.urgent||it.daysLeft<0?"var(--red)":it.daysLeft<=3?"var(--orange)":"var(--g500)",flexShrink:0}}>{it.daysLeft<0?Math.abs(it.daysLeft)+"d late":it.daysLeft+"d"}</span></div>):<div style={{fontSize:12,color:"var(--g400)",padding:"8px 0"}}>Nothing upcoming</div>})()}
</div>

{/* Warnings */}
<div style={{padding:"14px 16px",background:"#fff",borderRadius:12,border:"1px solid var(--card-border)",boxShadow:"var(--card-shadow)"}}>
<div style={{fontSize:11,fontWeight:700,color:"var(--g500)",textTransform:"uppercase",letterSpacing:1,marginBottom:8}}>Warnings</div>
{(()=>{const w=claims.flatMap(c=>getSmartWarnings(c).map(ww=>({...ww,claimNumber:c.claimNumber,caseId:c.id})));return w.length>0?w.slice(0,4).map((ww,i)=><div key={i} onClick={()=>{const cc=claims.find(x=>x.id===ww.caseId);if(cc)openClaim(cc)}} style={{display:"flex",alignItems:"center",gap:6,padding:"5px 0",cursor:"pointer",borderBottom:i<3?"1px solid var(--g100)":"none"}}><span style={{fontSize:9,fontWeight:700,padding:"2px 6px",borderRadius:4,color:ww.type==="critical"?"var(--red)":"var(--orange)",background:ww.type==="critical"?"var(--red-light)":"rgba(245,124,0,.04)",flexShrink:0}}>{ww.label}</span><span style={{fontSize:11,color:"var(--g600)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{ww.claimNumber}: {ww.desc}</span></div>):<div style={{fontSize:12,color:"var(--g400)",padding:"8px 0"}}>No warnings</div>})()}
</div>
</div>
</div>

{/* BOTTOM SECTION: Cases + Tools */}
<div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:14}}>

{/* Cases needing attention */}
<div style={{padding:"16px 18px",background:"#fff",borderRadius:16,border:"1px solid var(--card-border)",boxShadow:"var(--card-shadow)"}}>
<div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
<div style={{fontSize:11,fontWeight:700,color:"var(--g500)",textTransform:"uppercase",letterSpacing:1}}>Needs Attention</div>
<button onClick={()=>nav("claims")} style={{fontSize:11,fontWeight:500,color:"var(--blue)",background:"none",border:"none",cursor:"pointer"}}>View all</button>
</div>
{needsAttention.length>0?needsAttention.slice(0,4).map(c=><CaseSummaryCard key={c.id} claim={c} onClick={()=>openClaim(c)} onCompare={compareMode?cc=>{setCompareCases(p=>{const next=[...p,cc];if(next.length>=2)setTimeout(()=>setCompareMode(true),100);return next.slice(0,2)})}:null} comparing={compareCases.some(cc=>cc.id===c.id)}/>):<div style={{padding:"16px",textAlign:"center",fontSize:12,color:"var(--g400)"}}>All cases on track</div>}
</div>

{/* Quick tools + Advisor */}
<div>
<div style={{padding:"16px 18px",background:"#fff",borderRadius:16,border:"1px solid var(--card-border)",boxShadow:"var(--card-shadow)",marginBottom:10}}>
<div style={{fontSize:11,fontWeight:700,color:"var(--g500)",textTransform:"uppercase",letterSpacing:1,marginBottom:8}}>Quick Tools</div>
<div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6}}>
{[{label:"Templates",desc:"Start from template",onClick:()=>setShowTemplates(true)},{label:"Calculator",desc:"LOE & NEL",onClick:()=>setShowCalc(true)},{label:"Analytics",desc:"Portfolio insights",onClick:()=>setShowAnalytics(true)},{label:"Conflict Check",desc:"Search conflicts",onClick:()=>{const name=prompt("Enter a name:");if(name){const q=name.toLowerCase();const m=claims.filter(cl=>[cl.worker,cl.employer,...(cl.providers||[]).map(p=>p.name)].some(n=>(n||"").toLowerCase().includes(q)));alert(m.length>0?"Conflicts: "+m.map(x=>x.claimNumber).join(", "):"No conflicts")}}}].map((t,i)=>(
<button key={i} onClick={t.onClick} style={{padding:"10px",background:"var(--g50)",borderRadius:10,border:"none",cursor:"pointer",textAlign:"left"}}><div style={{fontSize:12,fontWeight:600,color:"var(--g800)"}}>{t.label}</div><div style={{fontSize:10,color:"var(--g500)"}}>{t.desc}</div></button>))}
</div>
</div>
<div style={{padding:"16px 18px",background:"#fff",borderRadius:16,border:"1px solid var(--card-border)",boxShadow:"var(--card-shadow)"}}>
<div style={{fontSize:11,fontWeight:700,color:"var(--g500)",textTransform:"uppercase",letterSpacing:1,marginBottom:8}}>Ask the Advisor</div>
{scenarios.slice(0,3).map((s,i)=><button key={i} onClick={()=>{setActive(null);setMsgs([]);nav("chat");setTimeout(()=>send(s.t),100)}} style={{padding:"8px 10px",borderRadius:8,background:"var(--g50)",border:"none",cursor:"pointer",textAlign:"left",width:"100%",marginBottom:4}}><div style={{fontSize:11,fontWeight:600,color:"var(--g800)"}}>{s.l}</div><div style={{fontSize:10,color:"var(--g500)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{s.t.slice(0,60)}</div></button>)}
</div>
</div>
</div>

{/* Activity feed */}
<div style={{padding:"14px 16px",background:"#fff",borderRadius:16,border:"1px solid var(--card-border)",boxShadow:"var(--card-shadow)"}}>
<div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
<div style={{fontSize:11,fontWeight:700,color:"var(--g500)",textTransform:"uppercase",letterSpacing:1}}>Recent Activity</div>
<button onClick={()=>setHomeTab("activity")} style={{fontSize:11,fontWeight:500,color:"var(--blue)",background:"none",border:"none",cursor:"pointer"}}>View all</button>
</div>
<div style={{display:"flex",gap:6,overflowX:"auto",paddingBottom:4}}>
{claims.flatMap(cl=>(cl.timeline||[]).map(t=>({...t,claimNumber:cl.claimNumber,caseId:cl.id}))).sort((a,b)=>new Date(b.date)-new Date(a.date)).slice(0,8).map((ev,i)=>(
<div key={i} onClick={()=>{const cc=claims.find(x=>x.id===ev.caseId);if(cc)openClaim(cc)}} style={{minWidth:160,flex:"0 0 160px",padding:"10px 12px",background:"var(--g50)",borderRadius:10,cursor:"pointer"}}>
<div style={{fontSize:10,fontWeight:600,color:"var(--blue)"}}>{ev.claimNumber}</div>
<div style={{fontSize:11,color:"var(--g700)",marginTop:2,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{ev.note}</div>
<div style={{fontSize:10,color:"var(--g400)",marginTop:2}}>{fmtTime(ev.date)}</div>
</div>))}
{claims.length===0&&<div style={{padding:"16px",textAlign:"center",fontSize:12,color:"var(--g400)",width:"100%"}}>No activity yet. Create your first case to get started.</div>}
</div>
</div>
</>}

{homeTab==="activity"&&<>
<div style={{fontSize:11,fontWeight:700,color:"var(--g500)",textTransform:"uppercase",letterSpacing:1,marginBottom:12}}>Recent Activity</div>
{claims.flatMap(cl=>(cl.timeline||[]).map(t=>({...t,claimNumber:cl.claimNumber,caseId:cl.id}))).sort((a,b)=>new Date(b.date)-new Date(a.date)).slice(0,20).map((ev,i)=>(
<div key={i} style={{padding:"12px 16px",background:"#fff",borderRadius:12,border:"1px solid var(--card-border)",boxShadow:"var(--card-shadow)",marginBottom:6,display:"flex",alignItems:"flex-start",gap:12}}>
<div style={{width:8,height:8,borderRadius:"50%",marginTop:5,flexShrink:0,background:ev.type==="stage"?"var(--blue)":ev.type==="document"?"var(--green)":ev.type==="analysis"?"var(--orange)":"var(--g300)"}}/>
<div style={{flex:1}}><div style={{fontSize:13,fontWeight:600,color:"var(--g800)"}}>{ev.claimNumber}</div><div style={{fontSize:12,color:"var(--g500)"}}>{ev.note}</div><div style={{fontSize:11,color:"var(--g400)",marginTop:2}}>{fmtTime(ev.date)}</div></div>
</div>))}
{claims.length===0&&<div style={{padding:40,textAlign:"center",color:"var(--g400)",fontSize:13}}>No activity yet.</div>}
</>}

{homeTab==="resources"&&<>
<div style={{fontSize:11,fontWeight:700,color:"var(--g500)",textTransform:"uppercase",letterSpacing:1,marginBottom:12}}>WSIB Resources</div>
<div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit, minmax(240px, 1fr))",gap:10,marginBottom:24}}>
{[{title:"WSIB Online Services",desc:"File claims, track status, upload documents",url:"https://www.wsib.ca/en/onlineservices"},{title:"Operational Policy Manual",desc:"Full OPM reference for adjudicators",url:"https://www.wsib.ca/en/operational-policy-manual"},{title:"WSIB Forms",desc:"Download Form 6, 7, 8 and official forms",url:"https://www.wsib.ca/en/forms"},{title:"WSIAT Decisions",desc:"Search Tribunal decisions for precedents",url:"https://www.wsiat.on.ca"},{title:"WSIA Legislation",desc:"Workplace Safety and Insurance Act, 1997",url:"https://www.ontario.ca/laws/statute/97w16"},{title:"ODG Guidelines",desc:"Official Disability Guidelines for recovery",url:"https://www.worklossdata.com/"}].map((r,i)=>(
<a key={i} href={r.url} target="_blank" rel="noopener noreferrer" style={{padding:"18px 20px",background:"#fff",borderRadius:12,border:"1px solid var(--card-border)",boxShadow:"var(--card-shadow)",textDecoration:"none",display:"block",boxShadow:"var(--card-shadow)"}}>
<div style={{fontSize:14,fontWeight:700,color:"var(--blue)",marginBottom:4}}>{r.title}</div>
<div style={{fontSize:12,color:"var(--g500)",lineHeight:1.4}}>{r.desc}</div>
</a>))}
</div>
<div style={{fontSize:11,fontWeight:700,color:"var(--g500)",textTransform:"uppercase",letterSpacing:1,marginBottom:12}}>Key OPM Policies</div>
<div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit, minmax(200px, 1fr))",gap:8}}>
{[{code:"11-01-01",title:"Five Point Check",desc:"Adjudicative criteria"},{code:"11-01-13",title:"Benefit of Doubt",desc:"Evidence equally balanced"},{code:"15-02",title:"Work Relatedness",desc:"Establishing connection"},{code:"15-03-13",title:"PTSD Presumptive",desc:"First responder coverage"},{code:"18-01",title:"LOE Benefits",desc:"Loss of Earnings calc"},{code:"18-05",title:"NEL Benefits",desc:"Non-Economic Loss"}].map((p,i)=>(
<div key={i} style={{padding:"14px 16px",background:"#fff",borderRadius:12,border:"1px solid var(--card-border)",boxShadow:"var(--card-shadow)"}}>
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
<div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}><div style={{fontSize:26,fontWeight:800,letterSpacing:-1.2}}>My Cases</div><div style={{display:"flex",gap:6}}>{bulkSelect.length>0&&<><button onClick={()=>{if(confirm(`Delete ${bulkSelect.length} cases?`)){bulkSelect.forEach(id=>setClaims(p=>{const next=p.filter(c=>c.id!==id);persistClaims(user.email,next);return next}));setBulkSelect([])}}} style={{padding:"5px 12px",borderRadius:100,fontSize:11,fontWeight:600,color:"var(--red)",border:"1px solid var(--red-border)",background:"var(--red-light)",cursor:"pointer"}}>Delete ({bulkSelect.length})</button><button onClick={()=>setBulkSelect([])} style={{padding:"5px 12px",borderRadius:100,fontSize:11,fontWeight:500,color:"var(--g600)",border:"1px solid var(--card-border)",background:"#fff",cursor:"pointer"}}>Clear</button></>}</div></div>
{/* Search bar */}
<div style={{marginBottom:12}}><input value={searchQ} onChange={e=>setSearchQ(e.target.value)} placeholder="Search cases...…" style={{width:"100%",padding:"10px 14px",borderRadius:12,border:"1px solid var(--card-border)",fontSize:13,outline:"none",background:"#fff",fontFamily:"inherit"}} /></div>
<div style={{display:"flex",gap:4,marginBottom:14,flexWrap:"wrap",overflowX:"auto"}}><button onClick={()=>setFilter("all")} style={{padding:"5px 12px",borderRadius:100,fontSize:12,fontWeight:500,border:"1px solid var(--card-border)",cursor:"pointer",background:filter==="all"?"var(--g900)":"#fff",color:filter==="all"?"#fff":"var(--g500)",whiteSpace:"nowrap"}}>All ({claims.length})</button>{STAGES.map(s=>{const n=claims.filter(c=>c.stage===s.id).length;return n>0?<button key={s.id} onClick={()=>setFilter(s.id)} style={{padding:"5px 12px",borderRadius:100,fontSize:12,fontWeight:500,border:"1px solid var(--card-border)",cursor:"pointer",background:filter===s.id?"var(--g900)":"#fff",color:filter===s.id?"#fff":"var(--g500)",whiteSpace:"nowrap"}}>{s.label} ({n})</button>:null})}</div>
<div style={{display:"flex",gap:6,marginBottom:8}}>
<select onChange={e=>{if(e.target.value==="")setFilter("all");else setFilter(e.target.value)}} style={{padding:"6px 10px",borderRadius:8,border:"1px solid var(--card-border)",fontSize:11,color:"var(--g600)",outline:"none",background:"#fff"}}><option value="">All Types</option><option value="t:Acute Injury">Acute Injury</option><option value="t:Occupational Disease">Occupational Disease</option><option value="t:Traumatic Mental Stress">Mental Stress</option><option value="t:PTSD (First Responder)">PTSD</option><option value="t:Recurrence">Recurrence</option></select>
<select onChange={e=>{if(e.target.value==="")setFilter("all");else setFilter(e.target.value)}} style={{padding:"6px 10px",borderRadius:8,border:"1px solid var(--card-border)",fontSize:11,color:"var(--g600)",outline:"none",background:"#fff"}}><option value="">All Risk Levels</option><option value="r:Critical">Critical</option><option value="r:High">High</option><option value="r:Medium">Medium</option><option value="r:Low">Low</option></select>
</div>

{displayed.length===0?<div style={{padding:"40px 20px"}}>{searchQ?<div style={{textAlign:"center"}}><div style={{fontSize:18,fontWeight:700,color:"var(--g700)",marginBottom:6}}>No matching cases</div><p style={{fontSize:14,color:"var(--g500)"}}>Try a different search term.</p></div>:<>
<div style={{textAlign:"center",marginBottom:32}}>
<div style={{width:56,height:56,borderRadius:16,background:"var(--blue-light)",border:"1px solid var(--blue-border)",display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 16px"}}><svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="var(--blue)" strokeWidth="1.5"><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"/></svg></div>
<div style={{fontSize:20,fontWeight:700,color:"var(--g800)",marginBottom:6}}>No cases yet</div>
<p style={{fontSize:14,color:"var(--g500)",maxWidth:400,margin:"0 auto",lineHeight:1.6}}>Create your first case to start analyzing claims against the WSIB Operational Policy Manual.</p>
<button onClick={()=>setModal("new")} style={{padding:"12px 28px",borderRadius:12,fontSize:14,fontWeight:600,border:"none",background:"var(--blue)",color:"#fff",cursor:"pointer",marginTop:16,boxShadow:"0 2px 8px rgba(0,113,227,.2)"}}>+ Create Your First Case</button>
</div>
<div style={{fontSize:11,fontWeight:700,color:"var(--g500)",textTransform:"uppercase",letterSpacing:1,marginBottom:12}}>Getting Started</div>
<div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit, minmax(220px, 1fr))",gap:10}}>
{[{n:"1",title:"Create a case",desc:"Enter the worker, employer, injury date, type, and description of the incident."},{n:"2",title:"Upload documents",desc:"Add Form 6 (worker report), Form 7 (employer report), Form 8 (medical), and other evidence."},{n:"3",title:"Run AI analysis",desc:"CaseAssist cross-references the WSIB OPM and gives a ruling prediction with cited policies."},{n:"4",title:"Track and manage",desc:"Monitor deadlines, RTW progress, benefits, and manage the full claim lifecycle."}].map((s,i)=>(
<div key={i} style={{padding:"18px",background:"#fff",borderRadius:12,border:"1px solid var(--card-border)",boxShadow:"var(--card-shadow)"}}>
<div style={{width:28,height:28,borderRadius:8,background:"var(--blue)",color:"#fff",display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,fontWeight:700,marginBottom:10}}>{s.n}</div>
<div style={{fontSize:14,fontWeight:600,color:"var(--g800)",marginBottom:3}}>{s.title}</div>
<div style={{fontSize:12,color:"var(--g500)",lineHeight:1.5}}>{s.desc}</div>
</div>))}
</div>
</>}</div>:displayed.map(c=><CaseSummaryCard key={c.id} claim={c} onClick={()=>openClaim(c)} onCompare={compareMode?cc=>{setCompareCases(p=>{const next=[...p,cc];if(next.length>=2)setTimeout(()=>setCompareMode(true),100);return next.slice(0,2)})}:null} comparing={compareCases.some(cc=>cc.id===c.id)}/>)}
</div></div>)}

{/* ══ DETAIL ══ */}
{view==="detail"&&active&&(<div style={{flex:1,overflowY:"auto",padding:"16px 20px 80px"}}><div className="fade-in" style={{maxWidth:1000,margin:"0 auto",width:"100%"}}>

{/* Compact Header */}
<div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",marginBottom:12}}>
<div>
<button onClick={()=>nav("claims")} style={{fontSize:11,fontWeight:500,color:"var(--blue)",background:"none",border:"none",cursor:"pointer",padding:0,marginBottom:4,display:"block"}}>{"<-"} My Cases</button>
<div style={{display:"flex",alignItems:"center",gap:10}}>
<div style={{fontSize:24,fontWeight:800,letterSpacing:-.8}}>{active.claimNumber}</div>
<span style={{padding:"3px 10px",borderRadius:100,fontSize:11,fontWeight:600,color:stageOf(active.stage).color,background:stageOf(active.stage).color+"10",border:"1px solid "+stageOf(active.stage).color+"20"}}>{stageOf(active.stage).label}</span>
<span style={{fontSize:11,fontWeight:600,color:"var(--blue)",padding:"2px 8px",borderRadius:100,background:"var(--blue-light)",border:"1px solid var(--blue-border)"}}>{getWorkflowStatus(active).pct}%</span>
</div>
<div style={{fontSize:12,color:"var(--g500)",marginTop:2}}>{active.worker} {"\u00B7"} {active.employer}{active.assignee&&<span style={{color:"var(--blue)",fontWeight:500}}>{" \u00B7 Assigned: "+active.assignee}</span>} {"\u00B7"} {fmt(active.injuryDate)} {"\u00B7"} {active.injuryType}{active.injuryDate&&active.injuryDate!=="\u2014"&&<span style={{color:"var(--blue)",fontWeight:500}}>{" \u00B7 Day "+daysAgo(active.injuryDate)}</span>}</div>
</div>
<div style={{display:"flex",gap:4,alignItems:"center"}}>
<button onClick={()=>setEmailModal({to:"",subject:active.claimNumber+" - ",body:""})} title="Email" style={{width:32,height:32,borderRadius:8,border:"1px solid var(--card-border)",background:"#fff",color:"var(--g500)",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}><svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8"><path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75"/></svg></button>
<button onClick={()=>setQuickNote({open:true,text:"",caseId:active.id})} title="Note" style={{width:32,height:32,borderRadius:8,border:"1px solid var(--card-border)",background:"#fff",color:"var(--g500)",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}><svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8"><path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125"/></svg></button>
<button onClick={()=>openChat(active)} title="AI Advisor" style={{width:32,height:32,borderRadius:8,border:"none",background:"var(--blue)",color:"#fff",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}><svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8"><path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 01.865-.501 48.172 48.172 0 003.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z"/></svg></button>
<div style={{width:1,height:20,background:"var(--g200)"}}/>
<button onClick={()=>setModal("stage")} title="Change Status" style={{width:32,height:32,borderRadius:8,border:"1px solid var(--card-border)",background:"#fff",color:"var(--g500)",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}><svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8"><path strokeLinecap="round" strokeLinejoin="round" d="M3 7.5L7.5 3m0 0L12 7.5M7.5 3v13.5m13.5 0L16.5 21m0 0L12 16.5m4.5 4.5V7.5"/></svg></button>
<button onClick={()=>{const cl={...active};cl.pinned=!cl.pinned;saveClaim(cl)}} title={active.pinned?"Unpin":"Pin"} style={{width:32,height:32,borderRadius:8,border:"1px solid var(--card-border)",background:active.pinned?"var(--blue-light)":"#fff",color:active.pinned?"var(--blue)":"var(--g500)",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}><svg width="14" height="14" fill={active.pinned?"var(--blue)":"none"} viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8"><path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z"/></svg></button>
<button onClick={()=>{{const backup={...active};delClaim(active.id);pushUndo("Deleted "+backup.claimNumber,()=>{setClaims(p=>{const next=[backup,...p];persistClaims(user.email,next);return next})})}}} title="Delete" style={{width:32,height:32,borderRadius:8,border:"1px solid var(--red-border)",background:"var(--red-light)",color:"var(--red)",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}><svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8"><path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0"/></svg></button>
<button onClick={()=>{if(timer.running&&timer.caseId===active.id){const elapsed=Math.floor((Date.now()-timer.start)/60000);setClaims(prev=>{const next=prev.map(cc=>{if(cc.id===active.id){return{...cc,timeEntries:[...(cc.timeEntries||[]),{date:new Date().toISOString(),minutes:elapsed,desc:"Timed session"}],timeline:[...(cc.timeline||[]),{date:new Date().toISOString(),type:"note",note:"Time logged: "+elapsed+" minutes"}]}}return cc});persistClaims(user.email,next);if(active)setActive(next.find(x=>x.id===active.id));return next});setTimer({running:false,caseId:null,start:null,entries:[]})}else{setTimer({running:true,caseId:active.id,start:Date.now(),entries:[]})}}} title="Assign" style={{width:32,height:32,borderRadius:8,border:"1px solid var(--card-border)",background:active.assignee?"var(--blue-light)":"#fff",color:active.assignee?"var(--blue)":"var(--g500)",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}} onClick={()=>{const name=prompt("Assign to (name or email):",active.assignee||"");if(name!==null){const cl={...active};cl.assignee=name.trim()||null;cl.timeline=[...(cl.timeline||[]),{date:new Date().toISOString(),type:"note",note:name.trim()?"Assigned to "+name.trim():"Unassigned"}];saveClaim(cl)}}}><svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z"/></svg></button><button title={timer.running&&timer.caseId===active.id?"Stop Timer":"Start Timer"} style={{width:32,height:32,borderRadius:8,border:"1px solid var(--card-border)",background:timer.running&&timer.caseId===active.id?"var(--red-light)":"#fff",color:timer.running&&timer.caseId===active.id?"var(--red)":"var(--g500)",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}><svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8"><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z"/></svg></button>
</div>
</div>

{/* Detail tabs */}
<div style={{display:"flex",gap:2,padding:3,background:"var(--g100)",borderRadius:12,marginBottom:16,overflowX:"auto",scrollbarWidth:"none"}}>{[{id:"overview",label:"Overview"},{id:"documents",label:`Docs (${active.documents?.length||0})`},{id:"comms",label:"Activity"},{id:"appeal",label:"Appeal"},{id:"tasks",label:"Tasks"},{id:"providers",label:"Providers"},{id:"valuation",label:"Value"},{id:"diary",label:"Diary"},{id:"payments",label:"Payments"},{id:"modified",label:"Modified"},{id:"tools",label:"AI Tools"}].map(t=><button key={t.id} onClick={()=>setDetailTab(t.id)} style={{flex:"0 0 auto",padding:"7px 12px",borderRadius:8,border:"none",fontSize:11,fontWeight:600,cursor:"pointer",whiteSpace:"nowrap",background:detailTab===t.id?"#fff":"transparent",color:detailTab===t.id?"var(--g900)":"var(--g500)",boxShadow:detailTab===t.id?"0 1px 3px rgba(0,0,0,.06)":"none"}}>{t.label}</button>)}</div>

{detailTab==="overview"&&<>
{/* WORKFLOW PROGRESS */}
{(()=>{const wf=getWorkflowStatus(active);const current=wf.steps[wf.currentIdx];return(<div style={{marginBottom:14}}>
<div style={{padding:"18px 20px",background:"#fff",borderRadius:16,border:"1px solid var(--card-border)",boxShadow:"var(--card-shadow)"}}>
<div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
<div style={{fontSize:11,fontWeight:700,color:"var(--g500)",textTransform:"uppercase",letterSpacing:1}}>Case Progress</div>
<div style={{display:"flex",alignItems:"center",gap:6}}><span style={{fontSize:20,fontWeight:800,color:"var(--blue)"}}>{wf.pct}%</span><span style={{fontSize:11,color:"var(--g500)"}}>{wf.steps.filter(s=>s.complete).length}/{wf.steps.length} steps</span></div>
</div>
<div style={{height:6,background:"var(--g100)",borderRadius:3,overflow:"hidden",marginBottom:14}}><div style={{height:"100%",width:wf.pct+"%",background:"linear-gradient(90deg, var(--blue), #00B4D8)",borderRadius:3,transition:"width .5s cubic-bezier(.16,1,.3,1)"}}/></div>
<div style={{display:"flex",gap:2,marginBottom:14}}>{wf.steps.map((s,i)=>(
<div key={s.id} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:4,cursor:"pointer",opacity:i<=wf.currentIdx?1:.5}} onClick={()=>{if(s.actionNav==="chat"){setMsgs(active.messages||[]);nav("chat")}else setDetailTab(s.actionNav||"overview")}}>
<div style={{width:28,height:28,borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:700,background:s.complete?"var(--green)":i===wf.currentIdx?"var(--blue)":"var(--g200)",color:s.complete||i===wf.currentIdx?"#fff":"var(--g500)",transition:"all .3s",border:i===wf.currentIdx&&!s.complete?"2px solid var(--blue)":"2px solid transparent"}}>{s.complete?"✓":i+1}</div>
<span style={{fontSize:9,fontWeight:600,color:i===wf.currentIdx?"var(--blue)":s.complete?"var(--green)":"var(--g400)",textAlign:"center",lineHeight:1.2,maxWidth:72}}>{s.title}</span>
</div>))}</div>
{current&&!current.complete&&<div style={{padding:"14px 16px",background:current.partial?"rgba(0,113,227,.03)":"rgba(245,124,0,.03)",borderRadius:12,border:"1px solid "+(current.partial?"var(--blue-border)":"rgba(245,124,0,.08)")}}>
<div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}>
<div style={{width:22,height:22,borderRadius:"50%",background:"var(--blue)",color:"#fff",display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,fontWeight:800,flexShrink:0}}>{wf.currentIdx+1}</div>
<div><div style={{fontSize:13,fontWeight:700,color:"var(--g900)"}}>{current.title}</div><div style={{fontSize:11,color:"var(--g500)"}}>{current.phase}</div></div>
</div>
<div style={{marginBottom:8}}>{current.checks.map(ch=>(
<div key={ch.id} style={{display:"flex",alignItems:"center",gap:8,padding:"4px 0"}}>
<div style={{width:16,height:16,borderRadius:4,display:"flex",alignItems:"center",justifyContent:"center",fontSize:9,fontWeight:800,flexShrink:0,background:ch.done?"var(--green)":"transparent",border:ch.done?"none":"1.5px solid var(--g300)",color:"#fff"}}>{ch.done?"✓":""}</div>
<span style={{fontSize:12,color:ch.done?"var(--g500)":"var(--g800)",textDecoration:ch.done?"line-through":"none"}}>{ch.label}</span>
</div>))}</div>
<button onClick={()=>{if(current.actionNav==="chat"){setMsgs(active.messages||[]);nav("chat")}else setDetailTab(current.actionNav||"overview")}} style={{padding:"8px 16px",borderRadius:100,fontSize:12,fontWeight:600,border:"none",background:"var(--blue)",color:"#fff",cursor:"pointer",display:"flex",alignItems:"center",gap:6}}>
<svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3"/></svg>
{current.action}</button>
</div>}
{wf.pct===100&&<div style={{padding:"12px 16px",background:"rgba(40,167,69,.04)",borderRadius:12,border:"1px solid rgba(40,167,69,.1)",textAlign:"center"}}><span style={{fontSize:13,fontWeight:700,color:"var(--green)"}}>All workflow steps complete</span></div>}
</div>
</div>)})()}

{/* RTW Progress */}
{(active.documents?.some(d=>["medical","form8","physio","specialist","imaging"].includes(d.tag))||active.analyses?.length>0)?<RTWBar progress={getRTWProgress(active)}/>:<div style={{padding:"14px 18px",background:"var(--g50)",borderRadius:12,border:"1px solid var(--card-border)",marginBottom:16,fontSize:13,color:"var(--g500)"}}><strong style={{color:"var(--g700)"}}>RTW Timeline:</strong> Upload medical evidence or run an AI analysis to generate return-to-work projections.</div>}
{/* Deadlines */}
<DeadlineBar deadlines={getDeadlines(active)}/>
{/* Risk Assessment */}
{(()=>{const rs=getRiskScore(active);if(!rs)return null;return(<div style={{marginBottom:12,padding:"14px 18px",background:"#fff",borderRadius:12,border:"1px solid var(--card-border)",boxShadow:"var(--card-shadow)",display:"flex",justifyContent:"space-between",alignItems:"center"}}><div><div style={{fontSize:11,fontWeight:700,color:"var(--g400)",textTransform:"uppercase",letterSpacing:.8}}>Risk Assessment</div><div style={{display:"flex",gap:6,marginTop:4,flexWrap:"wrap"}}>{rs.factors.slice(0,3).map((f,i)=><span key={i} style={{fontSize:10,color:"var(--g500)",padding:"1px 6px",background:"var(--g50)",borderRadius:4}}>{f.label}</span>)}</div></div><div style={{display:"flex",alignItems:"center",gap:6}}><span style={{fontSize:22,fontWeight:800,color:rs.color}}>{rs.score}</span><span style={{fontSize:12,fontWeight:600,color:rs.color,padding:"2px 8px",borderRadius:6,background:`${rs.color}10`}}>{rs.level}</span></div></div>)})()}

{/* Three-Point Contact */}
{(()=>{const tp=getThreePointContact(active);return(<div style={{marginBottom:12,padding:"14px 18px",background:"#fff",borderRadius:12,border:"1px solid var(--card-border)",boxShadow:"var(--card-shadow)"}}><div style={{fontSize:11,fontWeight:700,color:"var(--g400)",textTransform:"uppercase",letterSpacing:.8,marginBottom:8}}>Three-Point Contact</div><div style={{display:"flex",gap:8}}>{Object.entries(tp).map(([k,v])=><button key={k} onClick={()=>{const cl={...active};cl.threePoint={...(cl.threePoint||{}),[k]:!v.contacted,[k+"Date"]:!v.contacted?new Date().toISOString():null};saveClaim(cl)}} style={{flex:1,padding:"8px",borderRadius:12,border:"1px solid "+(v.contacted?"rgba(52,199,89,.2)":"var(--g200)"),background:v.contacted?"rgba(52,199,89,.04)":"#fff",cursor:"pointer",textAlign:"center"}}><div style={{fontSize:12,fontWeight:v.contacted?700:500,color:v.contacted?"var(--green)":"var(--g600)"}}>{v.contacted?"✓":"○"} {v.label}</div>{v.date&&<div style={{fontSize:9,color:"var(--g400)",marginTop:2}}>{new Date(v.date).toLocaleDateString()}</div>}</button>)}</div></div>)})()}

{/* Stats */}
<div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit, minmax(120px, 1fr))",gap:8,marginBottom:16}}>{[{l:"Analyses",v:active.analyses?.length||0},{l:"Documents",v:active.documents?.length||0},{l:"Notes",v:active.notes?.length||0},{l:"Last Ruling",v:active.analyses?.[active.analyses.length-1]?.ruling||"—"}].map((d,i)=><div key={i} style={{padding:12,background:"#fff",borderRadius:12,border:"1px solid var(--card-border)",boxShadow:"var(--card-shadow)"}}><div style={{fontSize:10,fontWeight:600,color:"var(--g400)",textTransform:"uppercase",letterSpacing:.8,marginBottom:4}}>{d.l}</div><div style={{fontSize:14,fontWeight:600}}>{d.v}</div></div>)}</div>
{/* Case summary */}
<div style={{padding:"12px 16px",background:"#fff",borderRadius:12,border:"1px solid var(--card-border)",boxShadow:"var(--card-shadow)",marginBottom:16,fontSize:13,color:"var(--g600)",lineHeight:1.5}}><strong style={{color:"var(--g900)"}}>Summary:</strong> {getCaseSummary(active)}{active.description?`. ${active.description}`:""}</div>
{/* Next actions */}
{(()=>{const actions=getNextActions(active);return actions.length>0?(<div style={{marginBottom:16}}><div style={{fontSize:12,fontWeight:700,color:"var(--g400)",textTransform:"uppercase",letterSpacing:.5,marginBottom:8}}>Recommended Next Steps</div><div style={{display:"flex",flexDirection:"column",gap:6}}>{actions.map((a,i)=><ActionCard key={i} action={a} onAction={handleAction}/>)}</div></div>):null})()}
{/* Benefit Calculator shortcut */}
<button onClick={()=>setShowCalc(true)} style={{width:"100%",padding:"12px 16px",borderRadius:12,border:"1px solid var(--card-border)",background:"#fff",cursor:"pointer",textAlign:"left",display:"flex",alignItems:"center",gap:12,marginBottom:16}}><div style={{width:32,height:32,borderRadius:8,background:"rgba(52,199,89,.1)",display:"flex",alignItems:"center",justifyContent:"center"}}><svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="var(--green)" strokeWidth="1.8"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 15.75V18m-7.5-6.75h.008v.008H8.25v-.008zm0 2.25h.008v.008H8.25V13.5zm2.498-6.75h.007v.008h-.007v-.008zm0 2.25h.007v.008h-.007V13.5zM6 6.75h12v12.375c0 .621-.504 1.125-1.125 1.125H7.125A1.125 1.125 0 016 19.125V6.75z"/></svg></div><div><div style={{fontSize:14,fontWeight:600,color:"var(--g900)"}}>Benefit Calculator</div><div style={{fontSize:12,color:"var(--g500)"}}>Estimate LOE and NEL entitlements</div></div></button>

{/* Analysis - Five Point Check Card + History */}
{active.analyses?.length>0&&active.analyses[active.analyses.length-1]&&<div style={{padding:"20px",background:"#fff",borderRadius:16,border:"1px solid var(--card-border)",boxShadow:"var(--card-shadow)",marginBottom:12}}>
<div style={{display:"flex",alignItems:"center",gap:8,marginBottom:12}}><span style={{width:10,height:10,borderRadius:"50%",background:active.analyses[active.analyses.length-1].ruling==="Allow"?"var(--green)":active.analyses[active.analyses.length-1].ruling==="Deny"?"var(--red)":"var(--orange)"}}></span><span style={{fontSize:14,fontWeight:700,color:"var(--g800)"}}>{active.claimNumber}</span><span style={{padding:"3px 10px",borderRadius:100,fontSize:11,fontWeight:600,color:active.analyses[active.analyses.length-1].ruling==="Allow"?"#1B7D36":active.analyses[active.analyses.length-1].ruling==="Deny"?"#C62828":"#E65100",background:active.analyses[active.analyses.length-1].ruling==="Allow"?"rgba(40,167,69,.03)":active.analyses[active.analyses.length-1].ruling==="Deny"?"rgba(229,57,53,.03)":"rgba(245,124,0,.03)"}}>{stageOf(active.stage).label}</span></div>
<div style={{padding:"12px 16px",background:active.analyses[active.analyses.length-1].ruling==="Allow"?"rgba(40,167,69,.03)":active.analyses[active.analyses.length-1].ruling==="Deny"?"rgba(229,57,53,.03)":"rgba(245,124,0,.03)",borderRadius:12,marginBottom:12}}><div style={{display:"flex",alignItems:"center",gap:8}}><span style={{width:8,height:8,borderRadius:"50%",background:active.analyses[active.analyses.length-1].ruling==="Allow"?"var(--green)":active.analyses[active.analyses.length-1].ruling==="Deny"?"var(--red)":"var(--orange)"}}></span><span style={{fontSize:15,fontWeight:700,color:active.analyses[active.analyses.length-1].ruling==="Allow"?"#1B7D36":active.analyses[active.analyses.length-1].ruling==="Deny"?"#C62828":"#E65100"}}>RULING PREDICTION: {active.analyses[active.analyses.length-1].ruling}</span></div></div>
<div style={{display:"flex",flexDirection:"column",gap:4,marginBottom:12}}>
{["Active employer account","Worker performing duties","Injury by accident/disease","Arose from employment","Resulting disability"].map((check,idx)=><div key={idx} style={{display:"flex",alignItems:"center",gap:10,padding:"8px 12px",background:active.analyses[active.analyses.length-1].ruling!=="Deny"?"rgba(40,167,69,.03)":"rgba(229,57,53,.03)",borderRadius:10}}><div style={{width:20,height:20,borderRadius:"50%",background:active.analyses[active.analyses.length-1].ruling!=="Deny"?"var(--green)":"var(--red)",color:"#fff",display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,fontWeight:800,flexShrink:0}}>{active.analyses[active.analyses.length-1].ruling!=="Deny"?"\u2713":"\u2717"}</div><span style={{fontSize:13,color:"var(--g700)"}}>{check}</span></div>)}
</div>
<div style={{display:"flex",gap:6,flexWrap:"wrap"}}>{["OPM 11-01-01","OPM 15-02"].map((ref,idx)=><span key={idx} style={{padding:"3px 10px",borderRadius:8,fontSize:11,fontWeight:600,color:"var(--blue)",background:"var(--blue-light)",border:"1px solid var(--blue-border)",fontFamily:"monospace"}}>{ref}</span>)}</div>
</div>}
{active.analyses?.length>0&&<div style={{marginBottom:16}}><div style={{fontSize:11,fontWeight:700,color:"var(--g500)",textTransform:"uppercase",letterSpacing:1,marginBottom:8}}>Analysis History</div>{active.analyses.slice().reverse().map((a,i)=><div key={i} style={{padding:12,background:"#fff",borderRadius:12,border:"1px solid var(--card-border)",boxShadow:"var(--card-shadow)",marginBottom:6}}><div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}><span style={{fontSize:13,fontWeight:600,color:a.ruling==="Allow"?"var(--green)":a.ruling==="Deny"?"var(--red)":"var(--orange)"}}>{a.ruling}</span><span style={{fontSize:11,color:"var(--g400)"}}>{fmtTime(a.date)}</span></div><div style={{fontSize:12,color:"var(--g500)",lineHeight:1.4}}>{(a.snippet||"").slice(0,120)}</div></div>)}</div>}

{/* OPM Policy Reference Panel */}
<div style={{marginBottom:14}}>
<div style={{padding:"18px 20px",background:"#fff",borderRadius:16,border:"1px solid var(--card-border)",boxShadow:"var(--card-shadow)"}}>
<div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
<div style={{fontSize:11,fontWeight:700,color:"var(--g500)",textTransform:"uppercase",letterSpacing:1}}>OPM Policy Reference</div>
<a href="https://www.wsib.ca/en/operational-policy-manual" target="_blank" rel="noopener" style={{fontSize:11,color:"var(--blue)",fontWeight:500,textDecoration:"none"}}>View Full OPM</a>
</div>
<div style={{fontSize:12,color:"var(--g500)",marginBottom:10}}>Policies applicable to this {active.injuryType||"claim"}:</div>
{getRelevantPolicies(active).slice(0,6).map((p,i)=>(
<details key={p.code} style={{marginBottom:4,borderRadius:10,border:"1px solid var(--card-border)",overflow:"hidden"}}>
<summary style={{padding:"10px 14px",fontSize:12,fontWeight:600,color:"var(--g800)",cursor:"pointer",display:"flex",alignItems:"center",gap:8,background:"var(--g50)"}}>
<span style={{padding:"2px 8px",borderRadius:100,fontSize:10,fontWeight:700,color:"#3B5EC0",background:"rgba(59,94,192,.08)",border:"1px solid rgba(59,94,192,.12)"}}>{p.code}</span>
<span>{p.title}</span>
<span style={{marginLeft:"auto",fontSize:10,color:"var(--g400)"}}>{p.chapter}</span>
</summary>
<div style={{padding:"10px 14px",fontSize:12,color:"var(--g600)",lineHeight:1.65,borderTop:"1px solid var(--card-border)",background:"#fff"}}>{p.text}<div style={{marginTop:8}}><a href={p.url||("https://www.wsib.ca/en/operational-policy-manual")} target="_blank" rel="noopener" style={{fontSize:11,color:"var(--blue)",fontWeight:500,textDecoration:"none"}}>View on WSIB.ca {"\u2192"}</a></div></div>
</details>))}
{getRelevantPolicies(active).length>6&&<button onClick={()=>{const el=document.querySelector("[data-opm-expand]");if(el)el.style.display=el.style.display==="none"?"block":"none"}} style={{fontSize:11,color:"var(--blue)",fontWeight:500,background:"none",border:"none",cursor:"pointer",padding:"6px 0"}}>Show all {getRelevantPolicies(active).length} policies</button>}
<div data-opm-expand style={{display:"none"}}>
{getRelevantPolicies(active).slice(6).map((p,i)=>(
<details key={p.code} style={{marginBottom:4,borderRadius:10,border:"1px solid var(--card-border)",overflow:"hidden"}}>
<summary style={{padding:"10px 14px",fontSize:12,fontWeight:600,color:"var(--g800)",cursor:"pointer",display:"flex",alignItems:"center",gap:8,background:"var(--g50)"}}>
<span style={{padding:"2px 8px",borderRadius:100,fontSize:10,fontWeight:700,color:"#3B5EC0",background:"rgba(59,94,192,.08)",border:"1px solid rgba(59,94,192,.12)"}}>{p.code}</span>
<span>{p.title}</span>
</summary>
<div style={{padding:"10px 14px",fontSize:12,color:"var(--g600)",lineHeight:1.65,borderTop:"1px solid var(--card-border)",background:"#fff"}}>{p.text}<div style={{marginTop:8}}><a href={p.url||("https://www.wsib.ca/en/operational-policy-manual")} target="_blank" rel="noopener" style={{fontSize:11,color:"var(--blue)",fontWeight:500,textDecoration:"none"}}>View on WSIB.ca {"\u2192"}</a></div></div>
</details>))}
</div>
</div>
</div>

</>}

{detailTab==="documents"&&<>
{(active.documents?.length||0)>0&&Object.keys(fc).length>0&&<div style={{padding:"12px 16px",background:"linear-gradient(135deg, #1A1040, #3B5EC0)",borderRadius:12,marginBottom:12,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
<div><div style={{fontSize:12,fontWeight:600,color:"#fff"}}>{Object.keys(fc).length} document(s) with extracted text</div><div style={{fontSize:11,color:"rgba(255,255,255,.6)",marginTop:2}}>AI can analyze the content of uploaded text/PDF files</div></div>
<div style={{display:"flex",gap:6}}>
<button onClick={()=>{openChat(active,"I have uploaded documents for this claim. Using the extracted document text, build a detailed MEDICAL CHRONOLOGY. For each medical event, include: DATE | PROVIDER | EVENT TYPE | DETAILS | SIGNIFICANCE. List events in chronological order. If dates are unclear, note this. Also identify any gaps in the medical record that should be addressed.")}} style={{padding:"7px 14px",borderRadius:8,fontSize:11,fontWeight:600,border:"none",background:"#fff",color:"#251A5E",cursor:"pointer"}}>Build Medical Chronology</button>
<button onClick={()=>{openChat(active,"I have uploaded documents for this claim. Using the extracted document text, perform a complete Five Point Check analysis. Cross-reference all document content against OPM requirements. Extract key medical findings, dates, diagnoses, and work restrictions. Identify any inconsistencies between documents.")}} style={{padding:"7px 14px",borderRadius:8,fontSize:11,fontWeight:600,border:"none",background:"rgba(255,255,255,.2)",color:"#fff",cursor:"pointer"}}>Analyze Documents</button>
</div>
</div>}

<input ref={fRef} type="file" multiple onChange={(e)=>{const tag=fRef.current?.dataset?.tag||"other";const nf2=Array.from(e.target.files);const cl={...active};cl.documents=[...(cl.documents||[]),...nf2.map(f=>({name:f.name,tag:tag==="auto"?guessDocType(f.name):tag,addedAt:new Date().toISOString()}))];cl.timeline=[...(cl.timeline||[]),...nf2.map(f=>({date:new Date().toISOString(),type:"document",note:`Uploaded: ${f.name} [${tag==="auto"?guessDocType(f.name):tag}]`}))];saveClaim(cl);nf2.forEach(f=>{const r=new FileReader();r.onload=ev=>setFc(p=>({...p,[f.name]:ev.target.result}));r.readAsText(f)});setFiles(p=>[...p,...nf2]);fRef.current.dataset.tag="auto";e.target.value=""}} style={{display:"none"}} accept=".txt,.pdf,.doc,.docx,.html,.md,.rtf,.jpg,.jpeg,.png"/>

{/* Upload buttons by type */}
<div style={{fontSize:11,fontWeight:700,color:"var(--g500)",textTransform:"uppercase",letterSpacing:1,marginBottom:8}}>Upload Documents</div>
<div style={{display:"grid",gridTemplateColumns:"repeat(3, 1fr)",gap:6,marginBottom:14}}>
{[{tag:"form6",label:"Form 6",desc:"Worker Report",color:"#0071E3"},{tag:"form7",label:"Form 7",desc:"Employer Report",color:"#28A745"},{tag:"form8",label:"Form 8",desc:"Physician Report",color:"#F57C00"},{tag:"medical",label:"Medical",desc:"Clinical Notes",color:"#AF52DE"},{tag:"imaging",label:"Imaging",desc:"X-ray, MRI, CT",color:"#FF2D55"},{tag:"specialist",label:"Specialist",desc:"Referral / Consult",color:"#5856D6"},{tag:"physio",label:"Physio/Rehab",desc:"Therapy Reports",color:"#30B0C7"},{tag:"witness",label:"Witness",desc:"Witness Statement",color:"#00C7BE"},{tag:"auto",label:"Other",desc:"Auto-detect type",color:"#7C7F87"}].map(dt=>{const hasDoc=active.documents?.some(d=>d.tag===dt.tag);return(
<button key={dt.tag} onClick={()=>{fRef.current.dataset.tag=dt.tag;fRef.current.click()}} style={{padding:"10px 12px",borderRadius:12,border:"1px solid "+(hasDoc?dt.color+"20":"var(--card-border)"),background:hasDoc?dt.color+"06":"#fff",cursor:"pointer",textAlign:"left",position:"relative"}}>
<div style={{width:24,height:24,borderRadius:6,background:dt.color+"14",display:"flex",alignItems:"center",justifyContent:"center",marginBottom:6}}><span style={{fontSize:10,fontWeight:700,color:dt.color}}>{dt.tag==="auto"?"+":dt.label.replace("Form ","F")}</span></div>
<div style={{fontSize:12,fontWeight:600,color:"var(--g800)"}}>{dt.label}</div>
<div style={{fontSize:10,color:"var(--g500)"}}>{dt.desc}</div>
{hasDoc&&<div style={{position:"absolute",top:8,right:8,width:8,height:8,borderRadius:"50%",background:dt.color}}/>}
</button>)})}
</div>

{/* Document list */}
{(active.documents||[]).length>0&&<>
<div style={{fontSize:11,fontWeight:700,color:"var(--g500)",textTransform:"uppercase",letterSpacing:1,marginBottom:8}}>Uploaded ({active.documents.length})</div>
<div>
{(active.documents||[]).map((d,i)=>{const dt=docTypeOf(d.tag);return(
<div key={i} style={{display:"flex",alignItems:"center",gap:10,padding:"10px 14px",background:"#fff",borderRadius:12,border:"1px solid var(--card-border)",boxShadow:"var(--card-shadow)",marginBottom:4}}>
<div style={{width:32,height:32,borderRadius:8,background:`${dt.color}14`,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
<span style={{fontSize:10,fontWeight:700,color:dt.color}}>{({"form6":"F6","form7":"F7","form8":"F8","medical":"MD","imaging":"IM","specialist":"SP","witness":"WS","physio":"PT","fce":"FC","employer":"EM","other":"OT"}[dt.id]||dt.id.slice(0,2).toUpperCase())}</span>
</div>
<div style={{flex:1,minWidth:0}}>
<div style={{fontSize:13,fontWeight:600,color:"var(--g800)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{d.name}</div>
<div style={{fontSize:11,color:"var(--g500)"}}>{dt.label}{d.addedAt?" \u00B7 "+new Date(d.addedAt).toLocaleDateString():""}</div>
</div>
<div style={{display:"flex",gap:4,flexShrink:0}}>
<select value={d.tag} onChange={e=>{const cl={...active};cl.documents=cl.documents.map((doc,j)=>j===i?{...doc,tag:e.target.value}:doc);saveClaim(cl)}} style={{padding:"3px 6px",borderRadius:6,fontSize:10,border:"1px solid var(--card-border)",background:"#fff",color:"var(--g600)",outline:"none",cursor:"pointer"}}>
{DOC_TYPES.map(t=><option key={t.id} value={t.id}>{t.label}</option>)}
</select>
<button onClick={()=>{const newName=prompt("Rename:",d.name);if(newName?.trim()){const cl={...active};cl.documents=cl.documents.map((doc,j)=>j===i?{...doc,name:newName.trim()}:doc);saveClaim(cl)}}} style={{padding:"3px 8px",borderRadius:6,fontSize:10,fontWeight:500,border:"1px solid var(--card-border)",background:"#fff",color:"var(--g600)",cursor:"pointer"}}>Rename</button>
{fc[d.name]&&<button onClick={()=>{const blob=new Blob([fc[d.name]],{type:"text/plain"});const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download=d.name;a.click();URL.revokeObjectURL(url)}} style={{padding:"3px 8px",borderRadius:6,fontSize:10,fontWeight:500,border:"1px solid var(--card-border)",background:"#fff",color:"var(--blue)",cursor:"pointer"}}>Download</button>}
<button onClick={()=>{{const removed=d;const oldDocs=[...(active.documents||[])];const cl={...active};cl.documents=cl.documents.filter((_,j)=>j!==i);cl.timeline=[...(cl.timeline||[]),{date:new Date().toISOString(),type:"document",note:"Deleted: "+d.name}];saveClaim(cl);pushUndo("Deleted "+d.name,()=>{const cl2={...active};cl2.documents=oldDocs;saveClaim(cl2)})}}} style={{padding:"3px 8px",borderRadius:6,fontSize:10,fontWeight:500,border:"1px solid var(--red-border)",background:"var(--red-light)",color:"var(--red)",cursor:"pointer"}}>Delete</button>
</div>
</div>)})}
</div>
</>}

{(!active.documents||active.documents.length===0)&&<div style={{textAlign:"center",padding:"32px 20px"}}><div style={{width:48,height:48,borderRadius:14,background:"var(--blue-light)",border:"1px solid var(--blue-border)",display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 12px"}}><svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="var(--blue)" strokeWidth="1.5"><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"/></svg></div><div style={{fontSize:16,fontWeight:600,color:"var(--g700)",marginBottom:4}}>No documents yet</div><p style={{fontSize:13,color:"var(--g500)",maxWidth:360,margin:"0 auto"}}>Use the buttons above to upload specific WSIB forms and medical evidence. Each document type is tracked separately for compliance.</p></div>}
</>}

{detailTab==="timeline"&&<>
<div style={{marginBottom:16}}>{(active.timeline||[]).slice().reverse().map((ev,i,arr)=><div key={i} style={{display:"flex",gap:10,position:"relative"}}>{i<arr.length-1&&<div style={{position:"absolute",left:10,top:22,bottom:0,width:1,background:"var(--g200)"}}/>}<div style={{width:22,height:22,borderRadius:"50%",flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center",fontSize:9,fontWeight:700,zIndex:1,background:ev.type==="stage"?"var(--blue-light)":ev.type==="document"?"var(--green-light)":ev.type==="analysis"?"rgba(255,149,0,.06)":ev.type==="note"?"rgba(175,82,222,.06)":"var(--g200)",color:ev.type==="stage"?"var(--blue)":ev.type==="document"?"var(--green)":ev.type==="analysis"?"var(--orange)":ev.type==="note"?"#AF52DE":"var(--g600)"}}>{ev.type==="created"?"●":ev.type==="stage"?"→":ev.type==="document"?"+":ev.type==="analysis"?"✷":"•"}</div><div style={{flex:1,paddingBottom:14,minWidth:0}}><div style={{fontSize:13,color:"var(--g700)",lineHeight:1.4}}>{ev.note}</div><div style={{fontSize:11,color:"var(--g400)",marginTop:2}}>{fmtTime(ev.date)}</div></div></div>)}</div>
<div style={{display:"flex",gap:6}}><input value={noteIn} onChange={e=>setNoteIn(e.target.value)} onKeyDown={e=>{if(e.key==="Enter")addNote()}} placeholder="Add a note…" style={{flex:1,padding:"8px 12px",borderRadius:12,border:"1px solid var(--card-border)",fontSize:13,outline:"none",background:"#fff"}}/><button onClick={addNote} disabled={!noteIn.trim()} style={{padding:"7px 14px",borderRadius:100,fontSize:13,fontWeight:600,border:"1px solid var(--g300)",background:"transparent",color:"var(--g600)",cursor:"pointer",whiteSpace:"nowrap"}}>Add</button></div>
</>}

{detailTab==="comms"&&<>
{/* Quick email actions - Gong style */}
<div style={{display:"flex",gap:6,marginBottom:14}}>
<button onClick={()=>setEmailModal({to:"",subject:active.claimNumber+" - ",body:""})} style={{padding:"9px 16px",borderRadius:10,fontSize:12,fontWeight:600,border:"none",background:"var(--blue)",color:"#fff",cursor:"pointer",display:"flex",alignItems:"center",gap:6}}><svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75"/></svg>Compose</button>
<button onClick={()=>setEmailModal({to:"",subject:active.claimNumber+" - Records Request",body:"Dear Dr. [Name],\n\nI am writing to request the medical records for "+active.worker+" (DOI: "+fmt(active.injuryDate)+") in connection with WSIB claim "+active.claimNumber+".\n\nPlease provide:\n- All clinical notes from date of injury to present\n- Diagnostic imaging reports\n- Treatment plans and referrals\n- Functional Abilities Form (FAF)\n\nThank you.\n\nRegards"})} style={{padding:"9px 12px",borderRadius:10,fontSize:11,fontWeight:500,border:"1px solid var(--card-border)",background:"#fff",color:"var(--g600)",cursor:"pointer"}}>Records Request</button>
<button onClick={()=>setEmailModal({to:"",subject:active.claimNumber+" - Status Update",body:"Hello,\n\nRe: WSIB claim "+active.claimNumber+" for "+active.worker+" ("+active.employer+").\n\nCurrent Status: "+stageOf(active.stage).label+"\n\n[Your update here]\n\nRegards"})} style={{padding:"9px 12px",borderRadius:10,fontSize:11,fontWeight:500,border:"1px solid var(--card-border)",background:"#fff",color:"var(--g600)",cursor:"pointer"}}>Status Update</button>
<div style={{flex:1}}/>
<input value={noteIn} onChange={e=>setNoteIn(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"&&noteIn.trim())addNote()}} placeholder="Add a note..." style={{flex:1,maxWidth:240,padding:"8px 12px",borderRadius:10,border:"1px solid var(--card-border)",fontSize:12,outline:"none",background:"#fff"}}/>
<button onClick={addNote} disabled={!noteIn.trim()} style={{padding:"8px 14px",borderRadius:10,fontSize:11,fontWeight:600,border:"1px solid var(--card-border)",background:noteIn.trim()?"var(--g900)":"#fff",color:noteIn.trim()?"#fff":"var(--g400)",cursor:noteIn.trim()?"pointer":"default"}}>Add Note</button>
</div>

{/* Unified Activity Feed - Gong style with date separators */}
{(()=>{
const allEvents=[
...(active.timeline||[]).map(e=>({...e,eventType:e.type||"note",sortDate:e.date})),
...(active.emails||[]).map(e=>({...e,eventType:"email",note:"Email: "+e.subject,sortDate:e.date}))
].sort((a,b)=>new Date(b.sortDate)-new Date(a.sortDate));
let lastDate="";
return allEvents.length>0?allEvents.map((ev,i)=>{
const evDate=new Date(ev.sortDate).toLocaleDateString("en-CA",{year:"numeric",month:"long",day:"numeric"});
const showDate=evDate!==lastDate;
lastDate=evDate;
return(<div key={i}>
{showDate&&<div style={{textAlign:"center",padding:"12px 0 8px"}}><span style={{fontSize:11,fontWeight:600,color:"var(--g400)",padding:"4px 14px",background:"var(--g50)",borderRadius:100}}>{evDate}</span></div>}
<div style={{display:"flex",gap:12,padding:"10px 0",borderLeft:"2px solid "+(ev.eventType==="email"?"var(--blue)":ev.eventType==="document"?"var(--green)":ev.eventType==="analysis"?"var(--orange)":"var(--g200)"),paddingLeft:14,marginLeft:8}}>
<div style={{flex:1}}>
<div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
<div style={{fontSize:13,fontWeight:600,color:"var(--g800)"}}>{ev.note}</div>
<span style={{fontSize:10,color:"var(--g400)",whiteSpace:"nowrap",flexShrink:0}}>{new Date(ev.sortDate).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"})}</span>
</div>
{ev.eventType==="email"&&ev.to&&<div style={{fontSize:11,color:"var(--g500)",marginTop:2}}>To: {ev.to}{ev.cc?" | CC: "+ev.cc:""}</div>}
{ev.eventType==="email"&&ev.body&&<div style={{fontSize:11,color:"var(--g600)",marginTop:6,padding:"8px 10px",background:"var(--g50)",borderRadius:8,maxHeight:80,overflowY:"auto",lineHeight:1.5,whiteSpace:"pre-wrap"}}>{ev.body.slice(0,200)}{ev.body.length>200?"...":""}</div>}
{ev.eventType==="email"&&<div style={{display:"flex",gap:4,marginTop:6}}>
<button onClick={()=>setEmailModal({to:ev.to||"",subject:"Re: "+(ev.subject||"").replace(/^Re: /,""),body:""})} style={{padding:"3px 10px",borderRadius:6,fontSize:10,fontWeight:500,border:"1px solid var(--card-border)",background:"#fff",color:"var(--g600)",cursor:"pointer"}}>Reply</button>
<button onClick={()=>setEmailModal({to:"",subject:"Fwd: "+(ev.subject||""),body:"\n--- Forwarded ---\n"+(ev.body||"")})} style={{padding:"3px 10px",borderRadius:6,fontSize:10,fontWeight:500,border:"1px solid var(--card-border)",background:"#fff",color:"var(--g600)",cursor:"pointer"}}>Forward</button>
</div>}
</div>
</div>
</div>)}):<div style={{textAlign:"center",padding:"40px 20px",color:"var(--g400)",fontSize:13}}>No activity yet. Send an email, add a note, or upload documents to start tracking activity.</div>})()}
</>}

{detailTab==="appeal"&&<>
<div style={{fontSize:11,fontWeight:700,color:"var(--g500)",textTransform:"uppercase",letterSpacing:1,marginBottom:12}}>Appeal Process Tracker</div>
{(active.stage==="denied"||active.stage==="appeal")?<div>{APPEAL_STAGES.map((s,i)=>{const isCurrent=i===0;const isPast=false;return(<div key={s.id} style={{padding:"16px 18px",background:isCurrent?"var(--blue-light)":"var(--g50)",borderRadius:12,border:"1px solid "+(isCurrent?"var(--blue-border)":"var(--g200)"),marginBottom:8}}><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}><div style={{display:"flex",alignItems:"center",gap:8}}><div style={{width:24,height:24,borderRadius:"50%",background:isCurrent?"var(--blue)":"var(--g300)",color:"#fff",display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:700}}>{i+1}</div><span style={{fontSize:14,fontWeight:700,color:isCurrent?"var(--blue)":"var(--g600)"}}>{s.label}</span></div><span style={{fontSize:11,fontWeight:600,color:"var(--g400)"}}>{s.deadline}</span></div><div style={{fontSize:12,color:"var(--g500)",marginBottom:8,paddingLeft:32}}>{s.desc}</div>{isCurrent&&<div style={{paddingLeft:32}}><div style={{fontSize:11,fontWeight:700,color:"var(--g400)",textTransform:"uppercase",letterSpacing:.8,marginBottom:6}}>Required Documents</div>{s.docs.map((d,j)=><div key={j} style={{fontSize:12,color:"var(--g600)",display:"flex",alignItems:"center",gap:6,marginBottom:3}}><span style={{width:6,height:6,borderRadius:"50%",background:"var(--orange)",flexShrink:0}}/>{d}</div>)}</div>}</div>)})}
</div>:<div style={{padding:24,background:"var(--g50)",borderRadius:12,border:"1px solid var(--card-border)",textAlign:"center"}}><div style={{fontSize:14,fontWeight:600,color:"var(--g700)",marginBottom:4}}>Appeal tracking available for denied claims</div><div style={{fontSize:12,color:"var(--g500)"}}>Change claim status to Denied or Appeal to access the appeal workflow tracker.</div></div>}
<div style={{marginTop:16}}><div style={{fontSize:11,fontWeight:700,color:"var(--g500)",textTransform:"uppercase",letterSpacing:1,marginBottom:8}}>Key Appeal Deadlines</div>
<div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
{[{label:"Intent to Object",dl:"30d (RTW) / 6mo (other)",desc:"From WSIB decision"},{label:"Appeal Readiness",dl:"No fixed deadline",desc:"Earlier is better"},{label:"WSIAT Filing",dl:"6 months",desc:"From ARO decision"},{label:"Judicial Review",dl:"30 days",desc:"From WSIAT decision"}].map((d,i)=>(
<div key={i} style={{padding:"12px 14px",background:"#fff",borderRadius:12,border:"1px solid var(--card-border)",boxShadow:"var(--card-shadow)"}}><div style={{fontSize:13,fontWeight:600,color:"var(--g800)"}}>{d.label}</div><div style={{fontSize:12,fontWeight:700,color:"var(--blue)",marginTop:2}}>{d.dl}</div><div style={{fontSize:11,color:"var(--g500)"}}>{d.desc}</div></div>))}
</div></div>
</>}

{detailTab==="tasks"&&<>
<div style={{fontSize:11,fontWeight:700,color:"var(--g500)",textTransform:"uppercase",letterSpacing:1,marginBottom:10}}>Task Checklist</div>
<div style={{display:"flex",gap:6,marginBottom:12}}>
<input value={taskInput} onChange={e=>setTaskInput(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"&&taskInput.trim()){const cl={...active};cl.tasks=[...(cl.tasks||[]),{id:Date.now(),text:taskInput.trim(),done:false,created:new Date().toISOString()}];saveClaim(cl);setTaskInput("")}}} placeholder="Add a task..." style={{flex:1,padding:"10px 14px",borderRadius:12,border:"1px solid var(--card-border)",fontSize:13,outline:"none",background:"#fff"}}/>
<button onClick={()=>{if(taskInput.trim()){const cl={...active};cl.tasks=[...(cl.tasks||[]),{id:Date.now(),text:taskInput.trim(),done:false,created:new Date().toISOString()}];saveClaim(cl);setTaskInput("")}}} style={{padding:"10px 18px",borderRadius:12,fontSize:13,fontWeight:600,border:"none",background:"var(--blue)",color:"#fff",cursor:"pointer"}}>Add</button>
</div>
{(active.tasks||[]).filter(t=>!t.done).map(t=><div key={t.id} style={{display:"flex",alignItems:"center",gap:10,padding:"10px 14px",background:"#fff",borderRadius:12,border:"1px solid var(--card-border)",boxShadow:"var(--card-shadow)",marginBottom:4,cursor:"pointer"}} onClick={()=>{const cl={...active};cl.tasks=cl.tasks.map(x=>x.id===t.id?{...x,done:true}:x);saveClaim(cl)}}><div style={{width:18,height:18,borderRadius:5,border:"2px solid var(--g300)",flexShrink:0}}/><span style={{fontSize:13,color:"var(--g800)"}}>{t.text}</span><button onClick={e=>{e.stopPropagation();const cl={...active};cl.tasks=cl.tasks.filter(x=>x.id!==t.id);saveClaim(cl)}} style={{marginLeft:"auto",background:"none",border:"none",color:"var(--g400)",cursor:"pointer",fontSize:14}}>x</button></div>)}
{(active.tasks||[]).filter(t=>t.done).length>0&&<><div style={{fontSize:11,fontWeight:600,color:"var(--g400)",marginTop:12,marginBottom:6}}>Completed</div>{(active.tasks||[]).filter(t=>t.done).map(t=><div key={t.id} style={{display:"flex",alignItems:"center",gap:10,padding:"8px 14px",background:"var(--g50)",borderRadius:12,marginBottom:3}}><div style={{width:18,height:18,borderRadius:5,background:"var(--green)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}><span style={{color:"#fff",fontSize:10,fontWeight:800}}>{"✓"}</span></div><span style={{fontSize:12,color:"var(--g400)",textDecoration:"line-through"}}>{t.text}</span></div>)}</>}
{(!active.tasks||active.tasks.length===0)&&<div style={{padding:32,textAlign:"center",color:"var(--g400)",fontSize:13}}>No tasks yet. Add follow-ups, reminders, and to-dos for this case.</div>}
<div style={{marginTop:16,fontSize:11,fontWeight:700,color:"var(--g500)",textTransform:"uppercase",letterSpacing:1,marginBottom:8}}>Generate Letters</div>
<div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6}}>
{LETTER_TEMPLATES.map(lt=><button key={lt.id} onClick={()=>{nav("chat");setTimeout(()=>send(lt.prompt),100)}} style={{padding:"12px 14px",background:"#fff",borderRadius:12,border:"1px solid var(--card-border)",boxShadow:"var(--card-shadow)",cursor:"pointer",textAlign:"left"}}><div style={{fontSize:13,fontWeight:600,color:"var(--g800)"}}>{lt.label}</div><div style={{fontSize:11,color:"var(--g500)",marginTop:2}}>{lt.desc}</div></button>)}
</div>
</>}

{detailTab==="providers"&&<>
<div style={{fontSize:11,fontWeight:700,color:"var(--g500)",textTransform:"uppercase",letterSpacing:1,marginBottom:10}}>Medical Providers</div>
<div style={{padding:"14px 16px",background:"#fff",borderRadius:12,border:"1px solid var(--card-border)",boxShadow:"var(--card-shadow)",marginBottom:12}}>
<div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:8}}>
<div><label style={{fontSize:11,fontWeight:600,color:"var(--g400)",display:"block",marginBottom:4}}>Provider Name</label><input value={providerForm.name} onChange={e=>setProviderForm(p=>({...p,name:e.target.value}))} placeholder="Dr. Smith, ActiveCare Physio..." style={{width:"100%",padding:"8px 12px",borderRadius:8,border:"1px solid var(--card-border)",fontSize:13,outline:"none"}}/></div>
<div><label style={{fontSize:11,fontWeight:600,color:"var(--g400)",display:"block",marginBottom:4}}>Type</label><select value={providerForm.type} onChange={e=>setProviderForm(p=>({...p,type:e.target.value}))} style={{width:"100%",padding:"8px 12px",borderRadius:8,border:"1px solid var(--card-border)",fontSize:13,outline:"none",background:"#fff"}}>{PROVIDER_TYPES.map(t=><option key={t} value={t}>{t}</option>)}</select></div>
</div>
<div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:8}}>
<div><label style={{fontSize:11,fontWeight:600,color:"var(--g400)",display:"block",marginBottom:4}}>Phone/Contact</label><input value={providerForm.phone} onChange={e=>setProviderForm(p=>({...p,phone:e.target.value}))} placeholder="(555) 123-4567" style={{width:"100%",padding:"8px 12px",borderRadius:8,border:"1px solid var(--card-border)",fontSize:13,outline:"none"}}/></div>
<div><label style={{fontSize:11,fontWeight:600,color:"var(--g400)",display:"block",marginBottom:4}}>Records Status</label><select value={providerForm.status} onChange={e=>setProviderForm(p=>({...p,status:e.target.value}))} style={{width:"100%",padding:"8px 12px",borderRadius:8,border:"1px solid var(--card-border)",fontSize:13,outline:"none",background:"#fff"}}><option value="requested">Requested</option><option value="received">Received</option><option value="pending">Pending</option><option value="none">Not Requested</option></select></div>
</div>
<button onClick={()=>{if(providerForm.name){const cl={...active};cl.providers=[...(cl.providers||[]),{...providerForm,id:Date.now()}];saveClaim(cl);setProviderForm({name:"",type:"Family Doctor",phone:"",status:"requested"})}}} style={{padding:"8px 16px",borderRadius:100,fontSize:13,fontWeight:600,border:"none",background:"var(--blue)",color:"#fff",cursor:"pointer"}}>Add Provider</button>
</div>
{(active.providers||[]).map(p=><div key={p.id} style={{padding:"12px 16px",background:"#fff",borderRadius:12,border:"1px solid var(--card-border)",boxShadow:"var(--card-shadow)",marginBottom:6,display:"flex",alignItems:"center",justifyContent:"space-between"}}><div><div style={{fontSize:14,fontWeight:600,color:"var(--g800)"}}>{p.name}</div><div style={{fontSize:12,color:"var(--g500)"}}>{p.type}{p.phone?" \u00B7 "+p.phone:""}</div></div><span style={{padding:"3px 10px",borderRadius:100,fontSize:10,fontWeight:600,color:p.status==="received"?"var(--green)":p.status==="requested"?"var(--orange)":"var(--g500)",background:p.status==="received"?"var(--green-light)":p.status==="requested"?"rgba(255,149,0,.06)":"var(--g50)",border:`1px solid ${p.status==="received"?"rgba(52,199,89,.15)":p.status==="requested"?"rgba(255,149,0,.12)":"var(--g200)"}`}}>{p.status}</span></div>)}
{(!active.providers||active.providers.length===0)&&<div style={{padding:32,textAlign:"center",color:"var(--g400)",fontSize:13}}>No providers tracked. Add treating physicians, specialists, and clinics involved in this claim.</div>}
</>}

{detailTab==="valuation"&&<>
<div style={{fontSize:11,fontWeight:700,color:"var(--g500)",textTransform:"uppercase",letterSpacing:1,marginBottom:10}}>Claim Valuation</div>
<div style={{padding:"18px 20px",background:"#fff",borderRadius:12,border:"1px solid var(--card-border)",boxShadow:"var(--card-shadow)",marginBottom:12}}>
{VALUATION_FIELDS.map(f=><div key={f.id} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"8px 0",borderBottom:"1px solid var(--g100)"}}><div><div style={{fontSize:13,fontWeight:600,color:"var(--g800)"}}>{f.label}</div><div style={{fontSize:11,color:"var(--g500)"}}>{f.desc}</div></div><div style={{display:"flex",alignItems:"center",gap:4}}><span style={{fontSize:13,color:"var(--g400)"}}>$</span><input value={valuation[f.id]||""} onChange={e=>{const v={...valuation,[f.id]:e.target.value};setValuation(v);const cl={...active};cl.valuation=v;saveClaim(cl)}} placeholder="0" style={{width:100,padding:"6px 10px",borderRadius:8,border:"1px solid var(--card-border)",fontSize:14,fontWeight:600,outline:"none",textAlign:"right"}}/></div></div>)}
<div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"14px 0 4px",borderTop:"2px solid var(--g200)",marginTop:8}}>
<div style={{fontSize:15,fontWeight:700,color:"var(--g900)"}}>Total Claim Value</div>
<div style={{fontSize:22,fontWeight:800,color:"var(--blue)"}}>${Object.values(valuation).reduce((s,v)=>s+(parseFloat(v)||0),0).toLocaleString()}</div>
</div>
</div>
<button onClick={()=>{nav("chat");setTimeout(()=>send("Based on the evidence in this claim, provide a detailed claim valuation estimate. Break down: estimated medical costs (past and future), LOE calculations at 85% of net earnings, NEL range based on injury type and severity, projected legal costs, and total claim value range. Also factor in the likelihood of appeal costs if the claim is denied."),100)}} style={{width:"100%",padding:"12px",borderRadius:12,border:"1px solid var(--card-border)",background:"#fff",cursor:"pointer",textAlign:"left",display:"flex",alignItems:"center",gap:12}}>
<div style={{width:32,height:32,borderRadius:8,background:"var(--blue-light)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}><span style={{fontSize:14,fontWeight:700,color:"var(--blue)"}}>AI</span></div>
<div><div style={{fontSize:14,fontWeight:600,color:"var(--g900)"}}>AI Valuation Estimate</div><div style={{fontSize:12,color:"var(--g500)"}}>Get an AI-generated claim valuation based on injury type and evidence</div></div>
</button>
<div style={{marginTop:16}}><button onClick={()=>{nav("chat");setTimeout(()=>send("Generate a comprehensive demand package for this claim. Include: 1) Executive summary of the claim 2) Detailed medical chronology 3) All applicable OPM policy references 4) Benefit calculations (LOE at 85% net, NEL estimate) 5) Total claim valuation 6) Supporting arguments for entitlement 7) Response to any potential counter-arguments. Format as a formal demand brief suitable for WSIB or WSIAT submission."),100)}} style={{width:"100%",padding:"12px",borderRadius:12,border:"1px solid var(--blue-border)",background:"var(--blue-light)",cursor:"pointer",textAlign:"left",display:"flex",alignItems:"center",gap:12}}>
<div style={{width:32,height:32,borderRadius:8,background:"var(--blue)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}><span style={{fontSize:12,fontWeight:700,color:"#fff"}}>DP</span></div>
<div><div style={{fontSize:14,fontWeight:600,color:"var(--blue)"}}>Build Demand Package</div><div style={{fontSize:12,color:"var(--g600)"}}>AI-generated comprehensive demand brief with all case evidence</div></div>
</button></div>
</>}

{detailTab==="diary"&&<>
<div style={{fontSize:11,fontWeight:700,color:"var(--g500)",textTransform:"uppercase",letterSpacing:1,marginBottom:10}}>Follow-up Diary</div>
<div style={{padding:"14px 16px",background:"#fff",borderRadius:12,border:"1px solid var(--card-border)",boxShadow:"var(--card-shadow)",marginBottom:12}}>
<div style={{display:"grid",gridTemplateColumns:"1fr 2fr",gap:8,marginBottom:8}}>
<div><label style={{fontSize:11,fontWeight:600,color:"var(--g400)",display:"block",marginBottom:4}}>Follow-up Date</label><input type="date" value={diaryEntry.date} onChange={e=>setDiaryEntry(p=>({...p,date:e.target.value}))} style={{width:"100%",padding:"8px 12px",borderRadius:8,border:"1px solid var(--card-border)",fontSize:13,outline:"none"}}/></div>
<div><label style={{fontSize:11,fontWeight:600,color:"var(--g400)",display:"block",marginBottom:4}}>Reminder Note</label><input value={diaryEntry.note} onChange={e=>setDiaryEntry(p=>({...p,note:e.target.value}))} placeholder="Call worker for status update..." style={{width:"100%",padding:"8px 12px",borderRadius:8,border:"1px solid var(--card-border)",fontSize:13,outline:"none"}}/></div>
</div>
<button onClick={()=>{if(diaryEntry.date&&diaryEntry.note){const cl={...active};cl.diary=[...(cl.diary||[]),{id:Date.now(),date:diaryEntry.date,note:diaryEntry.note,done:false}];cl.timeline=[...(cl.timeline||[]),{date:new Date().toISOString(),type:"note",note:"Diary: "+diaryEntry.note+" (due "+diaryEntry.date+")"}];saveClaim(cl);setDiaryEntry({date:"",note:"",caseId:""})}}} style={{padding:"8px 16px",borderRadius:100,fontSize:13,fontWeight:600,border:"none",background:"var(--blue)",color:"#fff",cursor:"pointer"}}>Add Follow-up</button>
</div>
{(active.diary||[]).sort((a,b)=>new Date(a.date)-new Date(b.date)).map(d=>{const isPast=new Date(d.date)<new Date();return<div key={d.id} style={{padding:"12px 16px",background:d.done?"var(--g50)":isPast?"var(--red-light)":"#fff",borderRadius:12,border:"1px solid "+(d.done?"var(--g200)":isPast?"var(--red-border)":"var(--g200)"),marginBottom:6,display:"flex",alignItems:"center",gap:12}}>
<button onClick={()=>{const cl={...active};cl.diary=cl.diary.map(x=>x.id===d.id?{...x,done:!x.done}:x);saveClaim(cl)}} style={{width:20,height:20,borderRadius:6,border:d.done?"none":"2px solid var(--g300)",background:d.done?"var(--green)":"transparent",display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",flexShrink:0}}>{d.done&&<span style={{color:"#fff",fontSize:10,fontWeight:800}}>{"✓"}</span>}</button>
<div style={{flex:1}}><div style={{fontSize:13,fontWeight:600,color:d.done?"var(--g400)":"var(--g800)",textDecoration:d.done?"line-through":"none"}}>{d.note}</div><div style={{fontSize:11,color:isPast&&!d.done?"var(--red)":"var(--g400)",fontWeight:isPast&&!d.done?600:400}}>{d.date}{isPast&&!d.done?" - OVERDUE":""}</div></div>
<button onClick={()=>{const cl={...active};cl.diary=cl.diary.filter(x=>x.id!==d.id);saveClaim(cl)}} style={{background:"none",border:"none",color:"var(--g400)",cursor:"pointer",fontSize:14}}>x</button>
</div>})}
{(!active.diary||active.diary.length===0)&&<div style={{padding:32,textAlign:"center",color:"var(--g400)",fontSize:13}}>No follow-ups scheduled. Add diary reminders to track upcoming actions.</div>}
</>}

{detailTab==="payments"&&<>
<div style={{fontSize:11,fontWeight:700,color:"var(--g500)",textTransform:"uppercase",letterSpacing:1,marginBottom:10}}>Payment Tracking</div>
<div style={{padding:"14px 16px",background:"#fff",borderRadius:12,border:"1px solid var(--card-border)",boxShadow:"var(--card-shadow)",marginBottom:12}}>
<div style={{display:"grid",gridTemplateColumns:"1fr 1fr 2fr",gap:8,marginBottom:8}}>
<div><label style={{fontSize:11,fontWeight:600,color:"var(--g400)",display:"block",marginBottom:4}}>Date</label><input type="date" id="payDate" style={{width:"100%",padding:"8px 12px",borderRadius:8,border:"1px solid var(--card-border)",fontSize:13,outline:"none"}}/></div>
<div><label style={{fontSize:11,fontWeight:600,color:"var(--g400)",display:"block",marginBottom:4}}>Amount ($)</label><input type="number" id="payAmt" placeholder="0.00" style={{width:"100%",padding:"8px 12px",borderRadius:8,border:"1px solid var(--card-border)",fontSize:13,outline:"none"}}/></div>
<div><label style={{fontSize:11,fontWeight:600,color:"var(--g400)",display:"block",marginBottom:4}}>Type</label><select id="payType" style={{width:"100%",padding:"8px 12px",borderRadius:8,border:"1px solid var(--card-border)",fontSize:13,outline:"none",background:"#fff"}}><option value="LOE">LOE Payment</option><option value="NEL">NEL Payment</option><option value="Medical">Medical Expense</option><option value="Other">Other</option></select></div>
</div>
<button onClick={()=>{const date=document.getElementById("payDate").value;const amt=document.getElementById("payAmt").value;const type=document.getElementById("payType").value;if(date&&amt){const cl={...active};cl.payments=[...(cl.payments||[]),{id:Date.now(),date,amount:parseFloat(amt),type}];cl.timeline=[...(cl.timeline||[]),{date:new Date().toISOString(),type:"note",note:type+" payment: $"+parseFloat(amt).toLocaleString()}];saveClaim(cl);document.getElementById("payDate").value="";document.getElementById("payAmt").value=""}}} style={{padding:"8px 16px",borderRadius:100,fontSize:13,fontWeight:600,border:"none",background:"var(--blue)",color:"#fff",cursor:"pointer"}}>Record Payment</button>
</div>
{(active.payments||[]).length>0&&<div style={{padding:"14px 18px",background:"var(--blue-light)",borderRadius:12,border:"1px solid var(--blue-border)",marginBottom:12,display:"flex",justifyContent:"space-between",alignItems:"center"}}><span style={{fontSize:13,fontWeight:600,color:"var(--blue)"}}>Total Payments</span><span style={{fontSize:20,fontWeight:800,color:"var(--blue)"}}>${(active.payments||[]).reduce((s,p)=>s+p.amount,0).toLocaleString()}</span></div>}
{(active.payments||[]).slice().reverse().map(p=><div key={p.id} style={{padding:"10px 16px",background:"#fff",borderRadius:12,border:"1px solid var(--card-border)",boxShadow:"var(--card-shadow)",marginBottom:4,display:"flex",justifyContent:"space-between",alignItems:"center"}}><div><div style={{fontSize:13,fontWeight:600,color:"var(--g800)"}}>${p.amount.toLocaleString()}</div><div style={{fontSize:11,color:"var(--g500)"}}>{p.type} - {p.date}</div></div></div>)}
{(!active.payments||active.payments.length===0)&&<div style={{padding:32,textAlign:"center",color:"var(--g400)",fontSize:13}}>No payments recorded. Track LOE, NEL, and medical expense payments.</div>}
<div style={{marginTop:16,fontSize:11,fontWeight:700,color:"var(--g500)",textTransform:"uppercase",letterSpacing:1,marginBottom:8}}>AWW Calculator</div>
<div style={{padding:"14px 16px",background:"#fff",borderRadius:12,border:"1px solid var(--card-border)",boxShadow:"var(--card-shadow)"}}>
<label style={{fontSize:11,fontWeight:600,color:"var(--g400)",display:"block",marginBottom:4}}>Gross Weekly Earnings ($)</label>
<input type="number" id="awwInput" placeholder="1000.00" style={{width:"100%",padding:"8px 12px",borderRadius:8,border:"1px solid var(--card-border)",fontSize:13,outline:"none",marginBottom:8}}/>
<button onClick={()=>{const g=parseFloat(document.getElementById("awwInput").value);if(g>0){const r=calcAWW(g);alert("AWW Calculation:\\n\\nGross Weekly: $"+g.toFixed(2)+"\\nCPP: -$"+r.cpp+"\\nEI: -$"+r.ei+"\\nFederal Tax: -$"+r.fedTax+"\\nProvincial Tax: -$"+r.provTax+"\\n\\nNet Weekly: $"+r.net+"\\nLOE (85%): $"+r.loe85+"/week\\nLOE Monthly: $"+r.loeMonthly)}}} style={{padding:"8px 16px",borderRadius:100,fontSize:13,fontWeight:600,border:"none",background:"var(--blue)",color:"#fff",cursor:"pointer"}}>Calculate AWW</button>
</div>
</>}

{detailTab==="modified"&&<>
<div style={{fontSize:11,fontWeight:700,color:"var(--g500)",textTransform:"uppercase",letterSpacing:1,marginBottom:10}}>Modified Duties Tracker</div>
<div style={{padding:"14px 16px",background:"#fff",borderRadius:12,border:"1px solid var(--card-border)",boxShadow:"var(--card-shadow)",marginBottom:12}}>
<div style={{marginBottom:8}}><label style={{fontSize:11,fontWeight:600,color:"var(--g400)",display:"block",marginBottom:4}}>Modified Work Description</label><input id="modDesc" placeholder="Light duties: no lifting over 10lbs, seated work only..." style={{width:"100%",padding:"8px 12px",borderRadius:8,border:"1px solid var(--card-border)",fontSize:13,outline:"none"}}/></div>
<div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginBottom:8}}>
<div><label style={{fontSize:11,fontWeight:600,color:"var(--g400)",display:"block",marginBottom:4}}>Start Date</label><input type="date" id="modStart" style={{width:"100%",padding:"8px 12px",borderRadius:8,border:"1px solid var(--card-border)",fontSize:13,outline:"none"}}/></div>
<div><label style={{fontSize:11,fontWeight:600,color:"var(--g400)",display:"block",marginBottom:4}}>End Date</label><input type="date" id="modEnd" style={{width:"100%",padding:"8px 12px",borderRadius:8,border:"1px solid var(--card-border)",fontSize:13,outline:"none"}}/></div>
<div><label style={{fontSize:11,fontWeight:600,color:"var(--g400)",display:"block",marginBottom:4}}>Status</label><select id="modStatus" style={{width:"100%",padding:"8px 12px",borderRadius:8,border:"1px solid var(--card-border)",fontSize:13,outline:"none",background:"#fff"}}><option value="offered">Offered</option><option value="accepted">Accepted</option><option value="declined">Declined</option><option value="completed">Completed</option></select></div>
</div>
<button onClick={()=>{const desc=document.getElementById("modDesc").value;const start=document.getElementById("modStart").value;const end=document.getElementById("modEnd").value;const status=document.getElementById("modStatus").value;if(desc){const cl={...active};cl.modifiedDuties=[...(cl.modifiedDuties||[]),{id:Date.now(),desc,start,end,status}];cl.timeline=[...(cl.timeline||[]),{date:new Date().toISOString(),type:"note",note:"Modified duties: "+desc+" ("+status+")"}];saveClaim(cl);document.getElementById("modDesc").value=""}}} style={{padding:"8px 16px",borderRadius:100,fontSize:13,fontWeight:600,border:"none",background:"var(--blue)",color:"#fff",cursor:"pointer"}}>Add Modified Duty</button>
</div>
{(active.modifiedDuties||[]).map(m=><div key={m.id} style={{padding:"12px 16px",background:"#fff",borderRadius:12,border:"1px solid var(--card-border)",boxShadow:"var(--card-shadow)",marginBottom:6}}><div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}><div style={{fontSize:14,fontWeight:600,color:"var(--g800)"}}>{m.desc}</div><span style={{padding:"2px 10px",borderRadius:100,fontSize:10,fontWeight:600,color:m.status==="accepted"?"var(--green)":m.status==="declined"?"var(--red)":m.status==="completed"?"var(--blue)":"var(--orange)",background:m.status==="accepted"?"var(--green-light)":m.status==="declined"?"var(--red-light)":m.status==="completed"?"var(--blue-light)":"rgba(255,149,0,.06)"}}>{m.status}</span></div>{(m.start||m.end)&&<div style={{fontSize:11,color:"var(--g500)",marginTop:4}}>{m.start&&"From: "+m.start} {m.end&&" To: "+m.end}</div>}</div>)}
{(!active.modifiedDuties||active.modifiedDuties.length===0)&&<div style={{padding:32,textAlign:"center",color:"var(--g400)",fontSize:13}}>No modified duties tracked. Record workplace accommodations offered to the injured worker.</div>}
</>}

{detailTab==="tools"&&<>
<div style={{fontSize:11,fontWeight:700,color:"var(--g500)",textTransform:"uppercase",letterSpacing:1,marginBottom:10}}>AI-Powered Tools</div>
<div style={{fontSize:12,color:"var(--g600)",marginBottom:14}}>One-click expert analysis tools. Each sends a structured prompt to the AI advisor with your case context.</div>
{["Assessment","Legal","Adjudication","Medical","Reference"].map(cat=>{const tools=AI_TOOLS.filter(t=>t.category===cat);if(tools.length===0)return null;return(<div key={cat} style={{marginBottom:16}}>
<div style={{fontSize:11,fontWeight:700,color:"var(--g400)",textTransform:"uppercase",letterSpacing:.8,marginBottom:6}}>{cat}</div>
<div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6}}>
{tools.map(tool=>(
<button key={tool.id} onClick={()=>{setMsgs(active.messages||[]);nav("chat");setTimeout(()=>send(tool.prompt(active)),200)}} style={{padding:"14px",background:"#fff",borderRadius:12,border:"1px solid var(--card-border)",boxShadow:"var(--card-shadow)",cursor:"pointer",textAlign:"left",display:"flex",gap:12,alignItems:"flex-start"}}>
<div style={{width:36,height:36,borderRadius:10,background:tool.color+"10",border:"1px solid "+tool.color+"20",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}><span style={{fontSize:12,fontWeight:700,color:tool.color}}>{tool.icon}</span></div>
<div style={{flex:1,minWidth:0}}><div style={{fontSize:13,fontWeight:600,color:"var(--g800)"}}>{tool.title}</div><div style={{fontSize:11,color:"var(--g500)",marginTop:2,lineHeight:1.4}}>{tool.desc}</div></div>
</button>))}
</div>
</div>)})}
</>}






</div></div>)}

{/* == CLAIM BOARD (Gong-style Kanban) == */}
{view==="board"&&(<div style={{flex:1,overflowY:"auto",padding:"20px 24px"}}>
<div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
<div><div style={{fontSize:22,fontWeight:800,letterSpacing:-.5}}>Claim Board</div><div style={{fontSize:13,color:"var(--g500)"}}>{claims.length} cases across pipeline</div></div>
<button onClick={()=>setModal("new")} style={{padding:"8px 18px",borderRadius:100,fontSize:13,fontWeight:600,border:"none",background:"var(--blue)",color:"#fff",cursor:"pointer"}}>+ New Case</button>
</div>
<div style={{display:"flex",gap:10,overflowX:"auto",paddingBottom:16,alignItems:"flex-start"}}>
{[{id:"new",label:"New",color:"var(--blue)"},{id:"review",label:"In Review",color:"var(--orange)"},{id:"investigate",label:"Investigate",color:"#AF52DE"},{id:"approved",label:"Approved",color:"var(--green)"},{id:"denied",label:"Denied",color:"var(--red)"},{id:"closed",label:"Closed",color:"var(--g400)"}].map(stage=>{const stageClaims=claims.filter(cc=>cc.stage===stage.id);return(<div key={stage.id} style={{minWidth:250,flex:"0 0 250px",background:"var(--g50)",borderRadius:16,padding:12}}>
<div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10,padding:"0 4px"}}><div style={{display:"flex",alignItems:"center",gap:6}}><div style={{width:8,height:8,borderRadius:"50%",background:stage.color}}></div><span style={{fontSize:13,fontWeight:700,color:"var(--g800)"}}>{stage.label}</span></div><span style={{fontSize:11,fontWeight:600,color:"var(--g500)",padding:"2px 8px",background:"var(--g100)",borderRadius:100}}>{stageClaims.length}</span></div>
{stageClaims.map(cc=>{const rs=getRiskScore(cc);const wf=getWorkflowStatus(cc);const warns=getSmartWarnings(cc);return(<div key={cc.id} onClick={()=>openClaim(cc)} style={{padding:14,background:"#fff",borderRadius:12,border:"1px solid var(--card-border)",boxShadow:"var(--card-shadow)",marginBottom:6,cursor:"pointer"}}>
<div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:6}}><div><div style={{fontSize:13,fontWeight:700,color:"var(--g800)"}}>{cc.claimNumber}</div><div style={{fontSize:11,color:"var(--g500)"}}>{cc.worker}</div></div>{rs&&<span style={{fontSize:10,fontWeight:700,color:rs.color,padding:"2px 6px",borderRadius:6,background:rs.color+"10"}}>{rs.level}</span>}</div>
<div style={{height:4,background:"var(--g100)",borderRadius:2,overflow:"hidden",marginBottom:6}}><div style={{height:"100%",width:wf.pct+"%",background:"var(--blue)",borderRadius:2}}/></div>
<div style={{fontSize:11,color:"var(--g600)",lineHeight:1.4,marginBottom:6,display:"-webkit-box",WebkitLineClamp:2,WebkitBoxOrient:"vertical",overflow:"hidden"}}>{getAIBrief(cc)}</div>
{warns.length>0&&<div style={{display:"flex",gap:3,flexWrap:"wrap"}}>{warns.slice(0,2).map((w,i)=><span key={i} style={{fontSize:9,fontWeight:600,padding:"2px 6px",borderRadius:4,color:w.type==="critical"?"var(--red)":"var(--orange)",background:w.type==="critical"?"var(--red-light)":"rgba(245,124,0,.04)"}}>{w.label}</span>)}</div>}
<div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginTop:6}}><span style={{fontSize:10,color:"var(--g400)"}}>{cc.documents?.length||0} docs</span>{cc.analyses?.length>0&&<span style={{fontSize:10,fontWeight:600,color:cc.analyses[cc.analyses.length-1].ruling==="Allow"?"var(--green)":cc.analyses[cc.analyses.length-1].ruling==="Deny"?"var(--red)":"var(--orange)"}}>{cc.analyses[cc.analyses.length-1].ruling}</span>}</div>
</div>)})}
{stageClaims.length===0&&<div style={{padding:20,textAlign:"center",fontSize:12,color:"var(--g400)"}}>No cases</div>}
</div>)})}
</div>
</div>)}

{/* ══ CHAT ══ */}
{view==="chat"&&(<><div style={{flex:1,overflowY:"auto",padding:"20px 14px 140px"}}><div style={{maxWidth:760,margin:"0 auto"}}>
{msgs.length>0&&!loading&&<div style={{display:"flex",gap:6,justifyContent:"center",marginBottom:12,flexWrap:"wrap"}}>
<button onClick={()=>send("Can you explain that in simpler terms? Assume I have no legal background.")} style={{padding:"6px 14px",borderRadius:100,fontSize:11,fontWeight:500,border:"1px solid var(--card-border)",background:"#fff",color:"var(--g600)",cursor:"pointer"}}>Explain simply</button>
<button onClick={()=>send("What are my next steps based on this?")} style={{padding:"6px 14px",borderRadius:100,fontSize:11,fontWeight:500,border:"1px solid var(--card-border)",background:"#fff",color:"var(--g600)",cursor:"pointer"}}>What are my next steps?</button>
<button onClick={()=>send("Can you summarize the key points in bullet form?")} style={{padding:"6px 14px",borderRadius:100,fontSize:11,fontWeight:500,border:"1px solid var(--card-border)",background:"#fff",color:"var(--g600)",cursor:"pointer"}}>Summarize key points</button>
</div>}
{!active&&msgs.length===0&&<div style={{textAlign:"center",marginBottom:28,paddingTop:20}}>
<div style={{width:48,height:48,borderRadius:12,background:"var(--blue-light)",border:"1px solid var(--blue-border)",display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 14px"}}><svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="var(--blue)" strokeWidth="1.5"><path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 01.865-.501 48.172 48.172 0 003.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z"/></svg></div>
<div style={{fontSize:20,fontWeight:700,color:"var(--g800)",marginBottom:6}}>WSIB Claims Advisor</div>
<p style={{fontSize:14,color:"var(--g500)",maxWidth:460,margin:"0 auto",lineHeight:1.6}}>Ask about WSIB policy, get ruling predictions, analyze claim scenarios, or ask questions across all your cases.</p>
</div>}

{active&&<div className="fade-in" style={{padding:"10px 14px",background:"#fff",borderRadius:12,border:"1px solid var(--card-border)",boxShadow:"var(--card-shadow)",marginBottom:14,display:"flex",alignItems:"center",justifyContent:"space-between",gap:8,flexWrap:"wrap"}}><div style={{display:"flex",alignItems:"center",gap:6,minWidth:0}}><span style={{fontSize:14,fontWeight:700}}>{active.claimNumber}</span><span style={{fontSize:12,color:"var(--g500)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{active.worker}</span></div><div style={{display:"flex",gap:6,alignItems:"center"}}><span style={pill(stageOf(active.stage).color)}>{stageOf(active.stage).label}</span><button onClick={()=>nav("detail")} style={{fontSize:11,color:"var(--blue)",background:"none",border:"none",cursor:"pointer",fontWeight:500,whiteSpace:"nowrap"}}>← Details</button></div></div>}
{msgs.length===0&&<div className="fade-in" style={{padding:"24px 0"}}><div style={{fontSize:"clamp(24px, 5vw, 32px)",fontWeight:800,letterSpacing:-1.2,marginBottom:8}}>{active?`Analyze ${active.claimNumber}`:"Ask anything."}</div><div style={{fontSize:15,color:"var(--g500)",marginBottom:20,maxWidth:460,lineHeight:1.55}}>{active?"Upload documents or ask questions. Analysis is saved to this case.":"Describe a scenario, upload documents, or ask a policy question."}</div>
{active&&msgs.length===0&&active.messages?.length>0&&<button onClick={()=>setMsgs(active.messages)} style={{padding:"8px 16px",borderRadius:100,fontSize:12,fontWeight:600,color:"var(--blue)",background:"var(--blue-light)",border:"1px solid var(--blue-border)",cursor:"pointer",marginBottom:12}}>Continue previous conversation ({active.messages.length} messages)</button>}
{active&&<div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:16}}>{getNextActions(active).filter(a=>a.action.startsWith("prompt:")||a.action==="analyze").map((a,i)=><button key={i} onClick={()=>handleAction(a)} style={{padding:"8px 14px",borderRadius:100,fontSize:12,fontWeight:500,color:a.priority==="high"?"var(--blue)":"var(--g600)",background:a.priority==="high"?"var(--blue-light)":"#fff",border:`.5px solid ${a.priority==="high"?"var(--blue-border)":"var(--g200)"}`,cursor:"pointer"}}>{a.label}</button>)}</div>}
{!active&&<div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit, minmax(220px, 1fr))",gap:8}}>{scenarios.map((s,i)=><button key={i} onClick={()=>send(s.t)} style={{padding:"14px 16px",borderRadius:12,background:"#fff",border:"1px solid var(--card-border)",cursor:"pointer",textAlign:"left"}}><div style={{fontSize:13,fontWeight:600,marginBottom:3}}>{s.l}</div><div style={{fontSize:12,color:"var(--g500)",lineHeight:1.4}}>{s.t.slice(0,80)}…</div></button>)}</div>}
</div>}
{msgs.map((m,i)=><div key={i} style={{marginBottom:24,display:"flex",flexDirection:"column",alignItems:m.role==="user"?"flex-end":"flex-start",animation:"fadeIn .35s cubic-bezier(.25,.1,.25,1) both"}}><div style={{fontSize:11,fontWeight:600,color:"var(--g400)",letterSpacing:.5,textTransform:"uppercase",marginBottom:6,display:"flex",alignItems:"center",gap:6}}><span style={{width:6,height:6,borderRadius:"50%",background:m.role==="user"?"var(--g900)":"var(--blue)"}}/>{m.role==="user"?"You":"CaseAssist"}</div>{m.files?.length>0&&<div style={{display:"flex",gap:4,flexWrap:"wrap",marginBottom:6,justifyContent:m.role==="user"?"flex-end":"flex-start"}}>{m.files.map((f,j)=><span key={j} style={{padding:"4px 10px",borderRadius:100,fontSize:11,fontWeight:500,color:"var(--blue)",background:"var(--blue-light)",border:"1px solid var(--blue-border)"}}>{f}</span>)}</div>}{m.role==="user"?<div style={{maxWidth:"80%",padding:"12px 16px",borderRadius:"18px 18px 6px 18px",background:"var(--g900)",color:"#fff",fontSize:14,lineHeight:1.55}}>{m.display||m.content}</div>:<div style={{width:"100%"}}><Msg text={m.content}/><button onClick={()=>{if(active){const cl={...active};cl.memos=[...(cl.memos||[]),{id:Date.now(),text:m.content,date:m.ts||new Date().toISOString(),title:"AI Analysis"}];cl.timeline=[...(cl.timeline||[]),{date:new Date().toISOString(),type:"note",note:"Saved AI analysis as memo"}];saveClaim(cl);alert("Saved to case memos")}else{alert("Open a case first to save memos")}}} style={{marginTop:4,padding:"3px 10px",borderRadius:6,fontSize:10,fontWeight:500,border:"1px solid var(--card-border)",background:"#fff",color:"var(--g500)",cursor:"pointer"}}>Save as Memo</button></div>}</div>)}
{loading&&<div style={{marginBottom:24}}><div style={{fontSize:11,fontWeight:600,color:"var(--g400)",letterSpacing:.5,textTransform:"uppercase",marginBottom:6,display:"flex",alignItems:"center",gap:6}}><span style={{width:6,height:6,borderRadius:"50%",background:"var(--blue)"}}/>CaseAssist</div><div style={{display:"flex",gap:6,alignItems:"center"}}>{[0,1,2].map(d=><div key={d} style={{width:8,height:8,borderRadius:"50%",background:"var(--blue)",animation:`pulse 1.5s ease infinite ${d*.2}s`}}/>)}<span style={{marginLeft:8,fontSize:13,color:"var(--g400)"}}>Reviewing…</span></div></div>}<div ref={endRef}/>
</div></div>
<div style={{position:"fixed",bottom:0,left:0,right:0,padding:"0 14px 16px",background:"linear-gradient(to top,var(--bg) 60%,transparent)",pointerEvents:"none",zIndex:50}}><div style={{maxWidth:760,margin:"0 auto",pointerEvents:"auto",paddingBottom:60}}>
{files.length>0&&<div style={{display:"flex",gap:4,flexWrap:"wrap",marginBottom:6}}>{files.map((f,i)=><div key={i} style={{display:"inline-flex",alignItems:"center",gap:4,padding:"4px 6px 4px 10px",borderRadius:100,fontSize:11,fontWeight:500,color:"var(--blue)",background:"#fff",border:"1px solid var(--blue-border)",boxShadow:"0 1px 4px rgba(0,0,0,.06)",maxWidth:200,overflow:"hidden"}}><span style={{overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{f.name}</span><button onClick={()=>rmFile(f.name)} style={{background:"none",border:"none",cursor:"pointer",color:"var(--g400)",fontSize:13,padding:"0 2px",flexShrink:0}}>×</button></div>)}</div>}
<div style={{display:"flex",alignItems:"flex-end",gap:4,background:"#fff",border:"1px solid var(--card-border)",borderRadius:22,padding:"5px 5px 5px 6px",boxShadow:"0 2px 20px rgba(0,0,0,.08)"}}><button onClick={()=>fRef.current?.click()} style={{width:36,height:36,borderRadius:"50%",border:"none",background:"transparent",cursor:"pointer",color:"var(--g400)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}><svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15"/></svg></button>{view==="chat"&&<input ref={fRef} type="file" multiple onChange={addFiles} style={{display:"none"}} accept=".txt,.pdf,.doc,.docx,.html,.md,.rtf"/>}<textarea ref={taRef} value={input} onChange={e=>{setInput(e.target.value);e.target.style.height="auto";e.target.style.height=Math.min(e.target.scrollHeight,140)+"px"}} onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();send()}}} placeholder={active?`Ask about ${active.claimNumber}…`:"Ask about WSIB policy, claim scenarios, or get guidance…"} style={{flex:1,border:"none",background:"transparent",resize:"none",outline:"none",fontSize:15,color:"var(--g900)",padding:"8px 4px",lineHeight:1.45,minHeight:36,maxHeight:140,fontFamily:"'Plus Jakarta Sans',sans-serif"}} rows={1}/><button onClick={()=>send()} disabled={loading||(!input.trim()&&files.length===0)} style={{width:36,height:36,borderRadius:"50%",border:"none",flexShrink:0,cursor:(input.trim()||files.length>0)&&!loading?"pointer":"default",display:"flex",alignItems:"center",justifyContent:"center",background:(input.trim()||files.length>0)&&!loading?"var(--blue)":"var(--g200)",color:"#fff",transition:"all .25s"}}><svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 10.5L12 3m0 0l7.5 7.5M12 3v18"/></svg></button></div>
<div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginTop:6,padding:"0 8px"}}><span style={{fontSize:10,color:"var(--g400)"}}>Advisory only. Final decisions by authorized WSIB adjudicators.</span>{msgs.length>0&&<button onClick={()=>setMsgs([])} style={{background:"none",border:"none",cursor:"pointer",fontSize:11,color:"var(--g400)",fontWeight:500}}>Clear</button>}</div>
</div></div></>)}

{/* ══ MODALS ══ */}

{/* EMAIL COMPOSE MODAL */}
{emailModal&&<div onClick={e=>{if(e.target===e.currentTarget){setEmailModal(null);setEmailStatus(null)}}} style={{position:"fixed",inset:0,background:"rgba(0,0,0,.35)",backdropFilter:"blur(8px)",zIndex:310,display:"flex",alignItems:"center",justifyContent:"center"}}>
<div style={{width:560,maxWidth:"calc(100vw - 32px)",background:"#fff",borderRadius:16,boxShadow:"0 24px 64px rgba(0,0,0,.15)",overflow:"hidden"}}>
<div style={{padding:"16px 20px",borderBottom:"1px solid var(--card-border)",display:"flex",justifyContent:"space-between",alignItems:"center"}}><div style={{display:"flex",alignItems:"center",gap:8}}><svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="var(--blue)" strokeWidth="1.8"><path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75"/></svg><span style={{fontSize:15,fontWeight:700}}>Send Email</span></div><button onClick={()=>{setEmailModal(null);setEmailStatus(null)}} style={{background:"none",border:"none",cursor:"pointer",color:"var(--g400)",fontSize:18}}>x</button></div>
<div style={{padding:"16px 20px"}}>
{active&&<div style={{fontSize:11,color:"var(--blue)",fontWeight:600,marginBottom:10,padding:"4px 10px",background:"var(--blue-light)",borderRadius:6,display:"inline-block"}}>{active.claimNumber}</div>}
<div style={{padding:"8px 14px",background:"var(--g50)",borderRadius:8,marginBottom:10,fontSize:12,color:"var(--g600)"}}><span style={{fontWeight:600}}>From:</span> {user?.email} <span style={{color:"var(--g400)"}}>(replies will go to your inbox)</span></div>
<div style={{marginBottom:10}}><label style={{fontSize:11,fontWeight:600,color:"var(--g500)",display:"block",marginBottom:4}}>To</label><input id="emailTo" defaultValue={emailModal?.to||""} placeholder="recipient@email.com" style={{width:"100%",padding:"10px 14px",borderRadius:10,border:"1px solid var(--card-border)",fontSize:13,outline:"none"}}/></div>
<div style={{marginBottom:10}}><label style={{fontSize:11,fontWeight:600,color:"var(--g500)",display:"block",marginBottom:4}}>Subject</label><input id="emailSubject" defaultValue={emailModal?.subject||""} placeholder="Subject line" style={{width:"100%",padding:"10px 14px",borderRadius:10,border:"1px solid var(--card-border)",fontSize:13,outline:"none"}}/></div>
<div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:10}}>
<div><label style={{fontSize:11,fontWeight:600,color:"var(--g500)",display:"block",marginBottom:4}}>CC <span style={{fontWeight:400,color:"var(--g400)"}}>(optional)</span></label><input id="emailCc" placeholder="cc@email.com" style={{width:"100%",padding:"9px 13px",borderRadius:10,border:"1px solid var(--card-border)",fontSize:13,outline:"none"}}/></div>
<div><label style={{fontSize:11,fontWeight:600,color:"var(--g500)",display:"block",marginBottom:4}}>BCC <span style={{fontWeight:400,color:"var(--g400)"}}>(optional)</span></label><input id="emailBcc" placeholder="bcc@email.com" style={{width:"100%",padding:"9px 13px",borderRadius:10,border:"1px solid var(--card-border)",fontSize:13,outline:"none"}}/></div>
</div>
<div style={{marginBottom:10}}><label style={{fontSize:11,fontWeight:600,color:"var(--g500)",display:"block",marginBottom:4}}>Message</label><textarea id="emailBody" defaultValue={emailModal?.body||""} rows={8} placeholder="Write your message..." style={{width:"100%",padding:"10px 14px",borderRadius:10,border:"1px solid var(--card-border)",fontSize:13,outline:"none",resize:"vertical",fontFamily:"inherit",lineHeight:1.6}}/></div>
<div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
<div>{emailStatus==="sent"?<span style={{fontSize:12,fontWeight:600,color:"var(--green)"}}>Email sent successfully</span>:emailStatus?.startsWith("error")?<span style={{fontSize:12,fontWeight:600,color:"var(--red)"}}>{emailStatus}</span>:null}</div>
<button onClick={()=>{const to=document.getElementById("emailTo").value;const subject=document.getElementById("emailSubject").value;const body=document.getElementById("emailBody").value;const cc=document.getElementById("emailCc")?.value;const bcc=document.getElementById("emailBcc")?.value;if(to&&subject&&body)sendEmail(to,subject,body,cc,bcc)}} disabled={emailSending} style={{padding:"10px 24px",borderRadius:100,fontSize:13,fontWeight:600,border:"none",background:emailSending?"var(--g300)":"var(--blue)",color:"#fff",cursor:emailSending?"default":"pointer"}}>{emailSending?"Sending...":"Send Email"}</button>
</div>
</div>
</div>
</div>}

{/* UNDO TOAST */}
{undoStack.length>0&&<div style={{position:"fixed",bottom:20,left:"50%",transform:"translateX(-50%)",zIndex:400,display:"flex",flexDirection:"column",gap:6,alignItems:"center"}}>
{undoStack.slice(0,2).map((u,i)=><div key={u.ts} style={{padding:"10px 16px",background:"var(--g900)",color:"#fff",borderRadius:12,boxShadow:"0 8px 32px rgba(0,0,0,.2)",display:"flex",alignItems:"center",gap:12,fontSize:13,animation:"fadeIn .3s ease"}}>
<span>{u.label}</span>
<button onClick={()=>{u.rollback();setUndoStack(p=>p.filter(x=>x.ts!==u.ts))}} style={{padding:"4px 12px",borderRadius:6,fontSize:12,fontWeight:600,border:"1px solid rgba(255,255,255,.2)",background:"transparent",color:"#fff",cursor:"pointer"}}>Undo</button>
<button onClick={()=>setUndoStack(p=>p.filter(x=>x.ts!==u.ts))} style={{background:"none",border:"none",color:"rgba(255,255,255,.4)",cursor:"pointer",fontSize:14}}>x</button>
</div>)}
</div>}

{/* CSV IMPORT MODAL */}
{showImport&&<div onClick={e=>{if(e.target===e.currentTarget)setShowImport(false)}} style={{position:"fixed",inset:0,background:"rgba(0,0,0,.4)",backdropFilter:"blur(8px)",zIndex:310,display:"flex",alignItems:"center",justifyContent:"center"}}>
<div style={{width:560,maxWidth:"calc(100vw - 32px)",background:"#fff",borderRadius:16,boxShadow:"0 24px 64px rgba(0,0,0,.15)",padding:"24px 28px"}}>
<div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}><span style={{fontSize:16,fontWeight:700}}>Import Cases from CSV</span><button onClick={()=>setShowImport(false)} style={{background:"none",border:"none",cursor:"pointer",color:"var(--g400)",fontSize:18}}>x</button></div>
<div style={{fontSize:13,color:"var(--g600)",marginBottom:12,lineHeight:1.6}}>Upload a CSV file with columns: <span style={{fontFamily:"monospace",fontSize:12,background:"var(--g50)",padding:"1px 4px",borderRadius:3}}>claimNumber, worker, employer, injuryDate, injuryType, description</span>. Each row becomes a new case.</div>
<div style={{padding:"24px",border:"2px dashed var(--card-border)",borderRadius:12,textAlign:"center",marginBottom:12,cursor:"pointer",background:"var(--g50)"}} onClick={()=>document.getElementById("csvInput")?.click()}>
<div style={{fontSize:13,color:"var(--g500)"}}>Click to select a CSV file</div>
</div>
<input id="csvInput" type="file" accept=".csv" style={{display:"none"}} onChange={e=>{const file=e.target.files?.[0];if(!file)return;const reader=new FileReader();reader.onload=ev=>{const text=ev.target.result;const lines=text.split("\n").filter(l=>l.trim());if(lines.length<2){alert("CSV must have a header row and at least one data row");return}const headers=lines[0].split(",").map(h=>h.trim().toLowerCase().replace(/['"]/g,""));const newCases=[];for(let i=1;i<lines.length;i++){const vals=lines[i].split(",").map(v=>v.trim().replace(/^["']|["']$/g,""));const row={};headers.forEach((h,j)=>{row[h]=vals[j]||""});const id=Date.now().toString(36)+Math.random().toString(36).slice(2,6)+i;newCases.push({id,claimNumber:row.claimnumber||row.claim||("CL-"+id.slice(0,6).toUpperCase()),worker:row.worker||row.name||"Unknown",employer:row.employer||row.company||"Unknown",injuryDate:row.injurydate||row.date||new Date().toISOString().slice(0,10),injuryType:row.injurytype||row.type||"Acute Injury",description:row.description||row.desc||"",stage:"new",ownerEmail:user.email,timeline:[{date:new Date().toISOString(),type:"created",note:"Imported from CSV"}],documents:[],analyses:[],messages:[],notes:[],createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()})}setClaims(prev=>{const next=[...newCases,...prev];persistClaims(user.email,next);return next});setShowImport(false);alert("Imported "+newCases.length+" cases")};reader.readAsText(file);e.target.value=""}}/>
<div style={{fontSize:11,color:"var(--g400)"}}>Supported formats: .csv with comma-separated values. First row must be column headers.</div>
</div>
</div>}

{/* CASE COMPARISON */}
{compareMode&&compareCases.length===2&&<div onClick={e=>{if(e.target===e.currentTarget){setCompareMode(false);setCompareCases([])}}} style={{position:"fixed",inset:0,background:"rgba(0,0,0,.4)",backdropFilter:"blur(8px)",zIndex:310,display:"flex",alignItems:"center",justifyContent:"center"}}>
<div style={{width:"90vw",maxWidth:1000,maxHeight:"85vh",background:"#fff",borderRadius:16,boxShadow:"0 24px 64px rgba(0,0,0,.15)",overflow:"auto"}}>
<div style={{padding:"20px 24px",borderBottom:"1px solid var(--card-border)",display:"flex",justifyContent:"space-between",alignItems:"center",position:"sticky",top:0,background:"#fff",zIndex:1}}><span style={{fontSize:16,fontWeight:700}}>Case Comparison</span><button onClick={()=>{setCompareMode(false);setCompareCases([])}} style={{background:"none",border:"none",cursor:"pointer",color:"var(--g400)",fontSize:18}}>x</button></div>
<div style={{display:"grid",gridTemplateColumns:"200px 1fr 1fr",fontSize:13}}>
{[{label:"Claim #",get:c=>c.claimNumber},{label:"Worker",get:c=>c.worker},{label:"Employer",get:c=>c.employer},{label:"Injury Date",get:c=>fmt(c.injuryDate)},{label:"Injury Type",get:c=>c.injuryType},{label:"Stage",get:c=>stageOf(c.stage).label},{label:"Days Open",get:c=>c.injuryDate&&c.injuryDate!=="—"?daysAgo(c.injuryDate)+"d":"N/A"},{label:"Documents",get:c=>(c.documents?.length||0)+" docs"},{label:"Analyses",get:c=>(c.analyses?.length||0)+" analyses"},{label:"Last Ruling",get:c=>c.analyses?.[c.analyses.length-1]?.ruling||"None"},{label:"Risk Level",get:c=>getRiskScore(c)?.level||"N/A"},{label:"Workflow",get:c=>getWorkflowStatus(c).pct+"%"},{label:"Claim Strength",get:c=>{const s=getClaimStrength(c);return s>0?s+"/100":"N/A"}},{label:"Red Flags",get:c=>getRedFlags(c).length+" flags"},{label:"Open Tasks",get:c=>(c.tasks||[]).filter(t=>!t.done).length+" tasks"},{label:"Providers",get:c=>(c.providers?.length||0)+" providers"},{label:"Assigned To",get:c=>c.assignee||"Unassigned"},{label:"Description",get:c=>c.description?.slice(0,100)||"N/A"}].map((row,i)=><>
<div key={"l"+i} style={{padding:"10px 16px",background:i%2===0?"var(--g50)":"#fff",fontWeight:600,color:"var(--g600)",borderRight:"1px solid var(--card-border)"}}>{row.label}</div>
<div key={"a"+i} style={{padding:"10px 16px",background:i%2===0?"var(--g50)":"#fff",color:"var(--g800)",borderRight:"1px solid var(--card-border)"}}>{row.get(compareCases[0])}</div>
<div key={"b"+i} style={{padding:"10px 16px",background:i%2===0?"var(--g50)":"#fff",color:"var(--g800)"}}>{row.get(compareCases[1])}</div>
</>)}
</div>
</div>
</div>}

{/* ONBOARDING WIZARD */}
{showOnboarding&&<div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.4)",backdropFilter:"blur(8px)",zIndex:350,display:"flex",alignItems:"center",justifyContent:"center"}}>
<div style={{width:520,maxWidth:"calc(100vw - 32px)",background:"#fff",borderRadius:20,boxShadow:"0 24px 64px rgba(0,0,0,.15)",overflow:"hidden"}}>
<div style={{padding:"32px 28px",textAlign:"center"}}>
<div style={{width:48,height:48,margin:"0 auto 16px"}}><svg width="48" height="48" viewBox="0 0 80 90" fill="none"><defs><linearGradient id="ob" x1="0" y1="0" x2="0.5" y2="1"><stop offset="0%" stopColor="#1A1040"/><stop offset="100%" stopColor="#2E3580"/></linearGradient></defs><rect x="16" y="16" width="54" height="64" rx="12" fill="#3B5EC0" opacity="0.5"/><rect x="10" y="10" width="54" height="64" rx="12" fill="#2E3580" opacity="0.7"/><rect x="4" y="4" width="54" height="64" rx="12" fill="url(#ob)"/><line x1="16" y1="22" x2="44" y2="22" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" opacity="0.7"/><line x1="16" y1="34" x2="38" y2="34" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" opacity="0.5"/><line x1="16" y1="46" x2="32" y2="46" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" opacity="0.35"/><path d="M42 19L45.5 22.5L52 15" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" opacity="0.9"/></svg></div>
{[
{title:"Welcome to CaseAssist",desc:"The AI-powered WSIB claims intelligence platform. Let us show you around.",action:"Get Started"},
{title:"Create a Case",desc:"Start by creating a case with the worker's name, employer, injury date, and type. Click + New Case in the top right or press N.",action:"Next"},
{title:"Upload Documents",desc:"Go to the Docs tab and upload WSIB forms (Form 6, 7, 8) and medical records. Each document type has its own upload button.",action:"Next"},
{title:"Run AI Analysis",desc:"Open the Advisor and ask for a ruling prediction. CaseAssist will analyze the claim against the WSIB OPM Five Point Check.",action:"Next"},
{title:"Track Everything",desc:"Use the workflow steps, tasks, diary reminders, and email to manage the full claim lifecycle. Press Cmd+K anytime to jump between cases.",action:"Start Using CaseAssist"}
][onboardStep]&&<>
<div style={{fontSize:22,fontWeight:800,letterSpacing:-.5,marginBottom:8}}>{[
"Welcome to CaseAssist",
"Create a Case",
"Upload Documents",
"Run AI Analysis",
"Track Everything"
][onboardStep]}</div>
<div style={{fontSize:14,color:"var(--g500)",lineHeight:1.6,maxWidth:400,margin:"0 auto",marginBottom:20}}>{[
"The AI-powered WSIB claims intelligence platform. Let us show you around.",
"Start by creating a case with the worker name, employer, injury date, and type. Click + New Case or press N.",
"Go to the Docs tab and upload WSIB forms (Form 6, 7, 8) and medical records using the dedicated upload buttons.",
"Open the Advisor tab and ask for a ruling prediction. CaseAssist cross-references the WSIB OPM Five Point Check.",
"Use workflow steps, tasks, diary reminders, email, and the Board view to manage the full claim lifecycle. Press Cmd+K anytime."
][onboardStep]}</div>
<div style={{display:"flex",justifyContent:"center",gap:6,marginBottom:16}}>{[0,1,2,3,4].map(i=><div key={i} style={{width:i===onboardStep?24:8,height:8,borderRadius:4,background:i===onboardStep?"var(--blue)":"var(--g200)",transition:"all .2s"}}/>)}</div>
</>}
<div style={{display:"flex",justifyContent:"center",gap:8}}>
<button onClick={()=>{setShowOnboarding(false);localStorage.setItem("ca_onboarded_"+user.email,"1")}} style={{padding:"10px 20px",borderRadius:100,fontSize:13,fontWeight:500,border:"1px solid var(--card-border)",background:"#fff",color:"var(--g500)",cursor:"pointer"}}>Skip</button>
<button onClick={()=>{if(onboardStep<4)setOnboardStep(onboardStep+1);else{setShowOnboarding(false);localStorage.setItem("ca_onboarded_"+user.email,"1")}}} style={{padding:"10px 24px",borderRadius:100,fontSize:13,fontWeight:600,border:"none",background:"var(--blue)",color:"#fff",cursor:"pointer"}}>{onboardStep<4?"Next":"Get Started"}</button>
</div>
</div>
</div>
</div>}

{/* BILLING MODAL */}
{showBilling&&<div onClick={e=>{if(e.target===e.currentTarget)setShowBilling(false)}} style={{position:"fixed",inset:0,background:"rgba(0,0,0,.4)",backdropFilter:"blur(8px)",zIndex:340,display:"flex",alignItems:"center",justifyContent:"center"}}>
<div style={{width:520,maxWidth:"calc(100vw - 32px)",background:"#fff",borderRadius:16,boxShadow:"0 24px 64px rgba(0,0,0,.15)",padding:"28px"}}>
<div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}><span style={{fontSize:18,fontWeight:700}}>Billing & Plan</span><button onClick={()=>setShowBilling(false)} style={{background:"none",border:"none",cursor:"pointer",color:"var(--g400)",fontSize:18}}>x</button></div>

<div style={{padding:"20px",background:"linear-gradient(135deg, #1A1040 0%, #3B5EC0 100%)",borderRadius:14,color:"#fff",marginBottom:16}}>
<div style={{fontSize:12,opacity:.6,textTransform:"uppercase",letterSpacing:1,marginBottom:4}}>Current Plan</div>
<div style={{fontSize:24,fontWeight:800}}>{userPlan==="firm"?"Firm":userPlan==="pro"?"Pro":"Starter"}</div>
<div style={{fontSize:12,opacity:.7,marginTop:4}}>{userPlan==="starter"?"Free plan - 3 active cases":userPlan==="pro"?"$79/month - Unlimited cases & AI tools":"$299/month - 5 users, shared workspace"}</div>
</div>

{userPlan==="starter"&&<div style={{padding:"16px",background:"var(--g50)",borderRadius:12,marginBottom:12}}>
<div style={{fontSize:13,fontWeight:600,marginBottom:6}}>Upgrade to unlock:</div>
<div style={{fontSize:12,color:"var(--g600)",lineHeight:1.7}}>Unlimited cases, 9 AI expert tools, email integration, claim board, CSV import/export, case comparison, and more.</div>
</div>}

<div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:16}}>
<button onClick={async()=>{try{const res=await fetch("/api/stripe/checkout",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({planId:"pro",email:user.email})});const d=await res.json();if(d.url)window.location.href=d.url;else alert(d.error||"Checkout failed")}catch(e){alert("Error starting checkout")}}} style={{padding:"12px",borderRadius:10,border:userPlan==="pro"?"2px solid var(--blue)":"1px solid var(--card-border)",background:userPlan==="pro"?"var(--blue-light)":"#fff",cursor:"pointer",textAlign:"left"}}>
<div style={{fontSize:14,fontWeight:700,color:userPlan==="pro"?"var(--blue)":"var(--g800)"}}>Pro</div>
<div style={{fontSize:20,fontWeight:800,color:userPlan==="pro"?"var(--blue)":"var(--g800)"}}>${"79"}<span style={{fontSize:12,fontWeight:500,color:"var(--g400)"}}>/mo</span></div>
<div style={{fontSize:11,color:"var(--g500)",marginTop:2}}>Unlimited cases + AI tools</div>
{userPlan==="pro"&&<div style={{fontSize:10,fontWeight:600,color:"var(--blue)",marginTop:4}}>CURRENT PLAN</div>}
</button>
<button onClick={()=>{window.location.href="mailto:hello@caseassist.ca?subject=Firm Plan Inquiry"}} style={{padding:"12px",borderRadius:10,border:userPlan==="firm"?"2px solid var(--blue)":"1px solid var(--card-border)",background:userPlan==="firm"?"var(--blue-light)":"#fff",cursor:"pointer",textAlign:"left"}}>
<div style={{fontSize:14,fontWeight:700,color:userPlan==="firm"?"var(--blue)":"var(--g800)"}}>Firm</div>
<div style={{fontSize:20,fontWeight:800,color:userPlan==="firm"?"var(--blue)":"var(--g800)"}}>${"299"}<span style={{fontSize:12,fontWeight:500,color:"var(--g400)"}}>/mo</span></div>
<div style={{fontSize:11,color:"var(--g500)",marginTop:2}}>5 users + shared workspace</div>
{userPlan==="firm"&&<div style={{fontSize:10,fontWeight:600,color:"var(--blue)",marginTop:4}}>CURRENT PLAN</div>}
</button>
</div>

<div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
<a href="/pricing" target="_blank" style={{fontSize:12,color:"var(--blue)",fontWeight:500}}>View full plan comparison</a>
{userPlan!=="starter"&&<button style={{fontSize:12,color:"var(--red)",fontWeight:500,background:"none",border:"none",cursor:"pointer"}}>Cancel subscription</button>}
</div>
</div>
</div>}

{/* KEYBOARD SHORTCUTS GUIDE */}
{showShortcuts&&<div onClick={e=>{if(e.target===e.currentTarget)setShowShortcuts(false)}} style={{position:"fixed",inset:0,background:"rgba(0,0,0,.4)",backdropFilter:"blur(8px)",zIndex:340,display:"flex",alignItems:"center",justifyContent:"center"}}>
<div style={{width:440,maxWidth:"calc(100vw - 32px)",background:"#fff",borderRadius:16,boxShadow:"0 24px 64px rgba(0,0,0,.15)",padding:"24px 28px"}}>
<div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}><span style={{fontSize:16,fontWeight:700}}>Keyboard Shortcuts</span><button onClick={()=>setShowShortcuts(false)} style={{background:"none",border:"none",cursor:"pointer",color:"var(--g400)",fontSize:18}}>x</button></div>
{[{keys:"Cmd + K",desc:"Quick search & jump to any case"},{keys:"N",desc:"Create new case"},{keys:"S",desc:"Go to My Cases"},{keys:"A",desc:"Open AI Advisor"},{keys:"H",desc:"Go to Home"},{keys:"?",desc:"Show this shortcuts guide"},{keys:"Esc",desc:"Close any modal or panel"}].map((s,i)=><div key={i} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 0",borderBottom:i<6?"1px solid var(--g100)":"none"}}><span style={{fontSize:13,color:"var(--g700)"}}>{s.desc}</span><span style={{padding:"3px 8px",borderRadius:6,background:"var(--g50)",border:"1px solid var(--g200)",fontSize:12,fontWeight:600,color:"var(--g600)",fontFamily:"monospace"}}>{s.keys}</span></div>)}
</div>
</div>}

{/* CMD+K COMMAND PALETTE */}
{cmdOpen&&<div onClick={e=>{if(e.target===e.currentTarget)setCmdOpen(false)}} style={{position:"fixed",inset:0,background:"rgba(0,0,0,.4)",backdropFilter:"blur(4px)",zIndex:300,display:"flex",alignItems:"flex-start",justifyContent:"center",paddingTop:"15vh"}}>
<div style={{width:520,maxWidth:"calc(100vw - 32px)",background:"#fff",borderRadius:16,boxShadow:"0 24px 64px rgba(0,0,0,.15)",overflow:"hidden"}}>
<div style={{padding:"12px 16px",borderBottom:"1px solid var(--g200)",display:"flex",alignItems:"center",gap:8}}>
<svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="var(--g400)" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"/></svg>
<input autoFocus value={cmdQ} onChange={e=>setCmdQ(e.target.value)} placeholder="Search cases, jump to a claim, or type a command..." style={{flex:1,border:"none",outline:"none",fontSize:15,fontWeight:500,color:"var(--g900)",background:"transparent"}}/>
<span style={{fontSize:11,color:"var(--g400)",padding:"2px 6px",borderRadius:4,background:"var(--g100)"}}>ESC</span>
</div>
<div style={{maxHeight:360,overflowY:"auto"}}>
{cmdQ.trim()?claims.filter(c=>[c.claimNumber,c.worker,c.employer,c.injuryType,c.description].join(" ").toLowerCase().includes(cmdQ.toLowerCase())).slice(0,8).map(c=>(
<button key={c.id} onClick={()=>{openClaim(c);setCmdOpen(false);setCmdQ("")}} style={{display:"flex",alignItems:"center",gap:12,padding:"12px 16px",width:"100%",border:"none",background:"transparent",cursor:"pointer",textAlign:"left",borderBottom:"1px solid var(--g100)"}}><div style={{width:8,height:8,borderRadius:"50%",background:stageOf(c.stage).color,flexShrink:0}}/><div style={{flex:1,minWidth:0}}><div style={{fontSize:14,fontWeight:600,color:"var(--g800)"}}>{c.claimNumber} <span style={{fontWeight:400,color:"var(--g500)"}}>{c.worker}</span></div><div style={{fontSize:12,color:"var(--g400)"}}>{c.employer} - {c.injuryType} - {stageOf(c.stage).label}</div></div></button>
)):<div style={{padding:"8px 16px"}}><div style={{fontSize:11,fontWeight:700,color:"var(--g400)",textTransform:"uppercase",letterSpacing:.8,marginBottom:8,marginTop:4}}>Recent Cases</div>
{claims.slice(0,5).map(c=>(
<button key={c.id} onClick={()=>{openClaim(c);setCmdOpen(false);setCmdQ("")}} style={{display:"flex",alignItems:"center",gap:12,padding:"10px 12px",width:"100%",border:"none",background:"transparent",cursor:"pointer",textAlign:"left",borderRadius:8}}><div style={{width:8,height:8,borderRadius:"50%",background:stageOf(c.stage).color,flexShrink:0}}/><div style={{flex:1}}><span style={{fontSize:13,fontWeight:600,color:"var(--g800)"}}>{c.claimNumber}</span> <span style={{fontSize:13,color:"var(--g500)"}}>{c.worker}</span></div><span style={{fontSize:11,color:"var(--g400)"}}>{stageOf(c.stage).label}</span></button>
))}
<div style={{fontSize:11,fontWeight:700,color:"var(--g400)",textTransform:"uppercase",letterSpacing:.8,marginBottom:8,marginTop:12}}>Quick Actions</div>
{[{label:"New Case",action:()=>{setModal("new");setCmdOpen(false)}},{label:"Ask Advisor",action:()=>{setActive(null);setMsgs([]);nav("chat");setCmdOpen(false)}},{label:"Quick Note",action:()=>{setQuickNote({open:true,text:"",caseId:""});setCmdOpen(false)}},{label:"Send Email",action:()=>{setEmailModal({to:"",subject:"",body:""});setCmdOpen(false)}}].map((a,i)=>(
<button key={i} onClick={a.action} style={{display:"block",padding:"8px 12px",width:"100%",border:"none",background:"transparent",cursor:"pointer",textAlign:"left",borderRadius:8,fontSize:13,fontWeight:500,color:"var(--g600)"}}>{a.label}</button>
))}
</div>}
{cmdQ.trim()&&claims.filter(c=>[c.claimNumber,c.worker,c.employer].join(" ").toLowerCase().includes(cmdQ.toLowerCase())).length===0&&<div style={{padding:24,textAlign:"center",color:"var(--g400)",fontSize:13}}>No cases match "{cmdQ}"</div>}
</div>
<div style={{padding:"8px 16px",borderTop:"1px solid var(--g100)",display:"flex",justifyContent:"space-between",alignItems:"center"}}><span style={{fontSize:11,color:"var(--g400)"}}>Type to search cases</span><span style={{fontSize:11,color:"var(--g400)"}}><span style={{padding:"1px 5px",borderRadius:3,background:"var(--g100)",fontFamily:"monospace",fontSize:10}}>Cmd</span> + <span style={{padding:"1px 5px",borderRadius:3,background:"var(--g100)",fontFamily:"monospace",fontSize:10}}>K</span></span></div>
</div>
</div>}

{/* QUICK NOTE FLOATING PANEL */}
{quickNote.open&&<div style={{position:"fixed",bottom:20,right:20,width:340,background:"#fff",borderRadius:16,boxShadow:"0 8px 32px rgba(0,0,0,.12)",border:"1px solid var(--card-border)",zIndex:250,overflow:"hidden"}}>
<div style={{padding:"12px 16px",borderBottom:"1px solid var(--g100)",display:"flex",justifyContent:"space-between",alignItems:"center",background:"var(--g50)"}}><span style={{fontSize:13,fontWeight:700}}>Quick Note</span><button onClick={()=>setQuickNote({open:false,text:"",caseId:""})} style={{background:"none",border:"none",cursor:"pointer",color:"var(--g400)",fontSize:16}}>{"\u00D7"}</button></div>
<div style={{padding:"12px 16px"}}>
<select value={quickNote.caseId} onChange={e=>setQuickNote(p=>({...p,caseId:e.target.value}))} style={{width:"100%",padding:"8px 10px",borderRadius:8,border:"1px solid var(--card-border)",fontSize:12,outline:"none",background:"#fff",marginBottom:8}}>
<option value="">Select a case...</option>
{claims.map(c=><option key={c.id} value={c.id}>{c.claimNumber} - {c.worker}</option>)}
</select>
<textarea value={quickNote.text} onChange={e=>setQuickNote(p=>({...p,text:e.target.value}))} placeholder="Type your note..." rows={3} style={{width:"100%",padding:"8px 10px",borderRadius:8,border:"1px solid var(--card-border)",fontSize:13,outline:"none",resize:"none",fontFamily:"inherit"}}/>
<button onClick={()=>{if(quickNote.caseId&&quickNote.text.trim()){setClaims(prev=>{const next=prev.map(c=>{if(c.id===quickNote.caseId){return{...c,timeline:[...(c.timeline||[]),{date:new Date().toISOString(),type:"note",note:quickNote.text.trim()}],notes:[...(c.notes||[]),{text:quickNote.text.trim(),date:new Date().toISOString()}]}}return c});persistClaims(user.email,next);if(active&&active.id===quickNote.caseId)setActive(next.find(c=>c.id===quickNote.caseId));return next});setQuickNote({open:false,text:"",caseId:""})}}} disabled={!quickNote.caseId||!quickNote.text.trim()} style={{width:"100%",marginTop:6,padding:"9px",borderRadius:12,border:"none",background:quickNote.caseId&&quickNote.text.trim()?"var(--blue)":"var(--g200)",color:"#fff",fontSize:13,fontWeight:600,cursor:quickNote.caseId&&quickNote.text.trim()?"pointer":"default"}}>Save Note</button>
</div>
</div>}

{/* TIMER */}
{timer.running&&<div style={{position:"fixed",bottom:quickNote.open?200:20,left:20,background:"#fff",borderRadius:12,boxShadow:"0 4px 20px rgba(0,0,0,.1)",border:"1px solid var(--card-border)",zIndex:240,padding:"10px 16px",display:"flex",alignItems:"center",gap:12}}>
<div style={{width:8,height:8,borderRadius:"50%",background:"var(--red)",animation:"pulse 1.5s infinite"}}/>
<div><div style={{fontSize:12,fontWeight:600,color:"var(--g800)"}}>{claims.find(c=>c.id===timer.caseId)?.claimNumber||"Timer"}</div><div style={{fontSize:18,fontWeight:700,color:"var(--g900)",fontFamily:"'DM Mono',monospace"}}>{(()=>{const s=Math.floor((Date.now()-(timer.start||Date.now()))/1000);const m=Math.floor(s/60);const h=Math.floor(m/60);return`${h>0?h+":":""}${String(m%60).padStart(2,"0")}:${String(s%60).padStart(2,"0")}`})()}</div></div>
<button onClick={()=>{const elapsed=Math.floor((Date.now()-timer.start)/60000);setClaims(prev=>{const next=prev.map(c=>{if(c.id===timer.caseId){return{...c,timeEntries:[...(c.timeEntries||[]),{date:new Date().toISOString(),minutes:elapsed,desc:"Timed session"}],timeline:[...(c.timeline||[]),{date:new Date().toISOString(),type:"note",note:`Time logged: ${elapsed} minutes`}]}}return c});persistClaims(user.email,next);return next});setTimer({running:false,caseId:null,start:null,entries:[]})}} style={{padding:"6px 14px",borderRadius:8,fontSize:12,fontWeight:600,border:"1px solid var(--card-border)",background:"#fff",color:"var(--red)",cursor:"pointer"}}>Stop</button>
</div>}


{/* NOTIFICATION CENTER */}
{showNotifs&&<div onClick={e=>{if(e.target===e.currentTarget)setShowNotifs(false)}} style={{position:"fixed",inset:0,zIndex:190}}><div style={{position:"absolute",top:68,right:20,width:380,maxWidth:"calc(100vw - 32px)",maxHeight:"70vh",background:"#fff",borderRadius:20,border:"1px solid var(--card-border)",boxShadow:"0 12px 48px rgba(0,0,0,.1)",overflowY:"auto",animation:"scaleIn .2s ease"}}><div style={{padding:"18px 20px",borderBottom:"1px solid var(--g100)",display:"flex",justifyContent:"space-between",alignItems:"center"}}><span style={{fontSize:16,fontWeight:700}}>Notifications</span><button onClick={()=>setShowNotifs(false)} style={{background:"none",border:"none",cursor:"pointer",color:"var(--g400)",fontSize:18}}>×</button></div>{(()=>{const ns=getNotifications(claims);if(!ns.length)return<div style={{padding:32,textAlign:"center",color:"var(--g400)",fontSize:14}}>All clear!</div>;return ns.slice(0,15).map((n,i)=><div key={i} onClick={()=>{const cc=claims.find(x=>x.id===n.caseId);if(cc){openClaim(cc);setShowNotifs(false)}}} style={{padding:"14px 20px",borderBottom:"1px solid var(--g100)",cursor:"pointer",display:"flex",alignItems:"flex-start",gap:12}}><div style={{width:10,height:10,borderRadius:"50%",background:n.type==="urgent"?"var(--red)":n.type==="warning"?"var(--orange)":"var(--blue)",flexShrink:0,marginTop:5}}/><div style={{flex:1}}><div style={{fontSize:14,fontWeight:600,color:n.type==="urgent"?"var(--red)":n.type==="warning"?"var(--orange)":"var(--g700)"}}>{n.title}</div><div style={{fontSize:12,color:"var(--g500)",marginTop:2}}>{n.desc}</div></div></div>)})()}</div></div>}

{/* GLOSSARY PANEL */}
{showGlossary&&<div onClick={e=>{if(e.target===e.currentTarget)setShowGlossary(false)}} style={{position:"fixed",inset:0,background:"rgba(0,0,0,.35)",zIndex:200,display:"flex",justifyContent:"flex-end"}}>
<div style={{width:420,maxWidth:"100vw",height:"100%",background:"#fff",boxShadow:"-8px 0 32px rgba(0,0,0,.08)",display:"flex",flexDirection:"column",animation:"scaleIn .2s ease"}}>
<div style={{padding:"20px 24px",borderBottom:"1px solid var(--g200)",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
<h3 style={{fontSize:18,fontWeight:700}}>WSIB Glossary</h3>
<button onClick={()=>setShowGlossary(false)} style={{background:"none",border:"none",cursor:"pointer",fontSize:20,color:"var(--g400)"}}>×</button>
</div>
<div style={{padding:"12px 24px"}}><input value={glossarySearch} onChange={e=>setGlossarySearch(e.target.value)} placeholder="Search terms..." style={{width:"100%",padding:"10px 14px",borderRadius:12,border:"1px solid var(--card-border)",fontSize:14,outline:"none",background:"var(--g50)"}}/></div>
<div style={{flex:1,overflowY:"auto",padding:"0 24px 24px"}}>
{Object.entries(GLOSSARY).filter(([k])=>!glossarySearch||k.toLowerCase().includes(glossarySearch.toLowerCase())).map(([term,def])=>(
<div key={term} style={{padding:"14px 0",borderBottom:"1px solid var(--g100)"}}><div style={{fontSize:14,fontWeight:700,color:"var(--blue)",marginBottom:4}}>{term}</div><div style={{fontSize:13,color:"var(--g600)",lineHeight:1.55}}>{def}</div></div>
))}
</div>
</div>
</div>}

{/* TEMPLATE PICKER */}
{showTemplates&&<div onClick={e=>{if(e.target===e.currentTarget)setShowTemplates(false)}} style={{position:"fixed",inset:0,background:"rgba(0,0,0,.35)",backdropFilter:"blur(8px)",zIndex:200,display:"flex",alignItems:"center",justifyContent:"center",padding:16}}><div style={{background:"#fff",borderRadius:20,padding:"24px 20px",width:"100%",maxWidth:520,boxShadow:"0 20px 60px rgba(0,0,0,.15)",maxHeight:"90vh",overflowY:"auto"}}><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}><h3 style={{fontSize:20,fontWeight:700,letterSpacing:-.5}}>Case Templates</h3><button onClick={()=>setShowTemplates(false)} style={{background:"none",border:"none",cursor:"pointer",fontSize:18,color:"var(--g400)"}}>×</button></div><p style={{fontSize:13,color:"var(--g500)",marginBottom:16}}>Start from a template to pre-fill common injury details.</p><div style={{display:"flex",flexDirection:"column",gap:6}}>{CASE_TEMPLATES.map((t,i)=><button key={i} onClick={()=>{setNf(p=>({...p,injuryType:t.type,description:t.desc}));setShowTemplates(false);setModal("new")}} style={{display:"flex",alignItems:"center",gap:12,padding:"14px 16px",background:"var(--g50)",border:"1px solid var(--card-border)",borderRadius:12,cursor:"pointer",textAlign:"left"}}><div style={{width:36,height:36,borderRadius:12,background:"var(--blue-light)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,fontWeight:700,color:"var(--blue)",flexShrink:0}}>{t.icon}</div><div style={{flex:1}}><div style={{fontSize:14,fontWeight:600,color:"var(--g900)"}}>{t.label}</div><div style={{fontSize:12,color:"var(--g500)",marginTop:1}}>{t.desc.slice(0,80)}…</div></div><span style={{color:"var(--g300)",fontSize:16}}>›</span></button>)}</div></div></div>}

{/* BENEFIT CALCULATOR */}
{showCalc&&<BenefitCalc claim={active} onClose={()=>setShowCalc(false)}/>}

{/* ANALYTICS */}
{showAnalytics&&<AnalyticsDash claims={claims} onClose={()=>setShowAnalytics(false)}/>}

{modal==="new"&&<div onClick={e=>{if(e.target===e.currentTarget)setModal(null)}} style={{position:"fixed",inset:0,background:"rgba(0,0,0,.35)",backdropFilter:"blur(8px)",zIndex:200,display:"flex",alignItems:"center",justifyContent:"center",padding:16}}><div style={{background:"#fff",borderRadius:20,padding:"24px 20px",width:"100%",maxWidth:480,boxShadow:"0 20px 60px rgba(0,0,0,.15)",animation:"scaleIn .3s cubic-bezier(.25,.1,.25,1)",maxHeight:"90vh",overflowY:"auto"}}><h3 style={{fontSize:20,fontWeight:700,letterSpacing:-.5,marginBottom:4}}>New Case</h3><p style={{fontSize:13,color:"var(--g500)",marginBottom:12}}>Enter claim details. Add documents after creating.</p>{[{k:"claimNumber",l:"Case Number",p:"Auto-generated if blank"},{k:"worker",l:"Worker Name / Initials",p:"e.g. J. Smith"},{k:"employer",l:"Employer",p:"e.g. Acme Construction"}].map(f=><div key={f.k}><label style={{display:"block",fontSize:12,fontWeight:600,color:"var(--g500)",marginBottom:4,marginTop:12}}>{f.l}</label><input value={nf[f.k]} onChange={e=>setNf(p=>({...p,[f.k]:e.target.value}))} placeholder={f.p} style={{width:"100%",padding:"10px 14px",borderRadius:12,border:"1px solid var(--card-border)",fontSize:14,outline:"none",background:"var(--g50)",fontFamily:"inherit"}}/></div>)}<label style={{display:"block",fontSize:12,fontWeight:600,color:"var(--g500)",marginBottom:4,marginTop:12}}>Date of Injury</label><input type="date" value={nf.injuryDate} onChange={e=>setNf(p=>({...p,injuryDate:e.target.value}))} style={{width:"100%",padding:"10px 14px",borderRadius:12,border:"1px solid var(--card-border)",fontSize:14,outline:"none",background:"var(--g50)",fontFamily:"inherit"}}/><label style={{display:"block",fontSize:12,fontWeight:600,color:"var(--g500)",marginBottom:4,marginTop:12}}>Injury Type</label><select value={nf.injuryType} onChange={e=>setNf(p=>({...p,injuryType:e.target.value}))} style={{width:"100%",padding:"10px 14px",borderRadius:12,border:"1px solid var(--card-border)",fontSize:14,outline:"none",background:"var(--g50)",fontFamily:"inherit"}}><option>Acute Injury</option><option>Occupational Disease</option><option>Traumatic Mental Stress</option><option>Chronic Mental Stress</option><option>PTSD (First Responder)</option><option>Recurrence</option><option>Aggravation of Pre-existing</option></select><label style={{display:"block",fontSize:12,fontWeight:600,color:"var(--g500)",marginBottom:4,marginTop:12}}>Description</label><textarea value={nf.description} onChange={e=>setNf(p=>({...p,description:e.target.value}))} placeholder="Describe the injury…" rows={3} style={{width:"100%",padding:"10px 14px",borderRadius:12,border:"1px solid var(--card-border)",fontSize:14,outline:"none",background:"var(--g50)",fontFamily:"inherit",resize:"none"}}/><div style={{display:"flex",gap:8,justifyContent:"flex-end",marginTop:16}}><button onClick={()=>setModal(null)} style={{padding:"7px 16px",borderRadius:100,fontSize:13,fontWeight:600,border:"1px solid var(--g300)",background:"transparent",color:"var(--g600)",cursor:"pointer"}}>Cancel</button><button onClick={createClaim} style={{padding:"7px 16px",borderRadius:100,fontSize:13,fontWeight:600,border:"none",background:"var(--blue)",color:"#fff",cursor:"pointer"}}>Create</button></div></div></div>}

{modal==="stage"&&active&&<div onClick={e=>{if(e.target===e.currentTarget)setModal(null)}} style={{position:"fixed",inset:0,background:"rgba(0,0,0,.35)",backdropFilter:"blur(8px)",zIndex:200,display:"flex",alignItems:"center",justifyContent:"center",padding:16}}><div style={{background:"#fff",borderRadius:20,padding:"24px 20px",width:"100%",maxWidth:400,boxShadow:"0 20px 60px rgba(0,0,0,.15)"}}><h3 style={{fontSize:20,fontWeight:700,marginBottom:16}}>Change Status</h3>{STAGES.map(s=><button key={s.id} onClick={()=>changeStage(s.id)} style={{display:"flex",alignItems:"center",gap:10,padding:"10px 14px",borderRadius:12,border:"none",background:active.stage===s.id?"var(--blue-light)":"transparent",cursor:"pointer",fontSize:14,fontWeight:active.stage===s.id?600:500,color:active.stage===s.id?"var(--blue)":"var(--g700)",width:"100%",textAlign:"left",marginBottom:2}}><span style={{width:10,height:10,borderRadius:"50%",background:s.color}}/>{s.label}{active.stage===s.id&&<span style={{marginLeft:"auto",fontSize:12,color:"var(--g400)"}}>Current</span>}</button>)}<div style={{display:"flex",justifyContent:"flex-end",marginTop:16}}><button onClick={()=>setModal(null)} style={{padding:"7px 16px",borderRadius:100,fontSize:13,fontWeight:600,border:"1px solid var(--g300)",background:"transparent",color:"var(--g600)",cursor:"pointer"}}>Close</button></div></div></div>}
</div>
</div>{/* close main content */}
</div>{/* close sidebar flex */}
</>)}

'use strict';
const $ = (s, root=document) => root.querySelector(s);
const $$ = (s, root=document) => [...root.querySelectorAll(s)];
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const state = {stage:1,mode:'after',detailMode:'after',node:'source',strategies:{terrain:true,paving:true,swale:true},levels:{terrain:1,paving:1,swale:1},paused:reducedMotion,playing:false,ui:'overview',workspace:'rain',tool:'terrain',source:'green',traceProgress:0,tracing:false,comparePosition:50,compareKind:'baseline'};
const history=[];
let savedSchemes={A:null,B:null};
let traceFrame=null,traceStart=0;
try {const raw=JSON.parse(localStorage.getItem('rainpath.schemes.v2')||'{}');for(const key of ['A','B'])if(raw[key]?.levels)savedSchemes[key]={levels:RainpathRoutes.normalize(raw[key].levels)};} catch {}
let timer = null;
const stageData = [
  {en:'BEFORE THE RAIN',title:'雨未至，先读地形。',mark:'☀',description:'沿步道观察绿地、铺装与低点之间的关系，寻找雨水可能经过的路径。'},
  {en:'RAIN BEGINS',title:'雨落，路径显现。',mark:'☂',description:'雨滴落在铺装与周边绿地，地表径流开始沿高低变化汇集。'},
  {en:'RAIN CONTINUES',title:'雨渐密，给水留白。',mark:'☂',description:'来水持续汇集。观察步道暂存与绿地承接的位置，比较不同策略的作用。'},
  {en:'AFTER THE RAIN',title:'雨歇，慢慢归还。',mark:'◌',description:'降雨停止后，暂存水逐步下渗或沿排水路径消退，空间回到日常。'}
];
const strategyNames = {terrain:'微地形',paving:'透水铺装',swale:'植被沟'};
const strategyData = {
  terrain:{verb:'引',subtitle:'顺着地势，把水引向绿地',body:'通过局部微地形与边缘衔接调整，为地表径流建立连续的引导路径。图中的箭头表达设计意图；未给定实际坡度与标高。',condition:'需补充场地测绘、无障碍坡度与既有树根范围，核验改造后是否产生新的低点。',effect:'开启后，来自绿地与铺装边缘的径流转向拟设植被空间；关闭后，来水更容易汇到步道低点。'},
  paving:{verb:'渗',subtitle:'让一部分雨水，在原地停下',body:'透水面层与下部蓄排结构共同提供下渗空间。它的作用取决于土壤、基层和维护状态，不能保证在所有降雨条件下都无积水。',condition:'需核验土壤渗透能力、地下水位、结构承载与维护条件；本演示不设渗透率或削减百分比。',effect:'开启后，示意路段出现下渗箭头与透水纹理；关闭后，相应来水在地表继续汇集。'},
  swale:{verb:'蓄',subtitle:'让急促的水流，多停留片刻',body:'沿步道边缘设置浅凹植被空间，通过减速、暂存和下渗组织径流。达到承接能力时，应连接经过核验的溢流路径。',condition:'需核验空间宽度、安全边界、植物耐淹性与溢流去向；不能直接假定排入观音湖。',effect:'开启后，暂存区转移至拟设植被沟，并出现条件性溢流线；关闭后，步道低点的暂存更明显。'}
};
function tree(x,y,r,id){return `<g opacity=".9"><ellipse cx="${x+3}" cy="${y+10}" rx="${r*.9}" ry="${r*.56}" fill="#aebfab" opacity=".25"/><circle cx="${x}" cy="${y}" r="${r}" fill="${id%2?'#a8c3a0':'#bbd0aa'}" stroke="#91ad87" stroke-width=".8"/><path d="M${x} ${y-r*.55}v${r*1.2}m0 -${r*.45}l-${r*.4} -${r*.33}m${r*.4} ${r*.13}l${r*.42} -${r*.35}" fill="none" stroke="#91ac92" stroke-width=".6" opacity=".65"/></g>`;}
function mapSVG({mode='after',stage=state.stage,interactive=true,small=false,uid='map',node=state.node,strategies=state.strategies,levels=state.levels}={}){
  if(small){strategies={terrain:true,paving:true,swale:true};levels={terrain:1,paving:1,swale:1};}
  const after=mode==='after',terrain=after&&strategies.terrain,paving=after&&strategies.paving,swale=after&&strategies.swale,wet=stage>0,peak=stage===2,post=stage===3;
  const waterScale=stage===1?.65:stage===2?1:.42;
  const residual=after?Math.max(.25,3-(terrain?levels.terrain*.6:0)-(paving?levels.paving*.45:0)-(swale?levels.swale*.4:0)):3;
  const path='M54 374 C164 334 169 249 280 243 C379 236 421 215 456 164 C492 110 563 111 640 65';
  const sourceLine=terrain?'M240 89 C266 129 298 146 332 172 S359 202 377 211':'M240 89 C266 140 296 181 299 235';
  const swaleLine='M344 271 C411 265 450 224 481 185 S530 141 563 142';
  const trees=[[70,100,28],[115,77,23],[159,116,27],[96,155,23],[57,183,21],[174,62,21],[330,67,27],[374,95,24],[408,49,21],[279,350,26],[328,383,27],[397,348,25],[436,376,23],[579,346,25],[607,380,22],[95,285,18],[190,365,18],[493,52,22]];
  const puddle=wet&&(!after||residual>0)?`<g data-layer="path-puddle"><ellipse cx="296" cy="241" rx="${(26+residual*8)*waterScale}" ry="${(8+residual*4)*waterScale}" fill="#3694d0" opacity=".43"/><ellipse cx="282" cy="245" rx="${(33+residual*4)*waterScale}" ry="${(9+residual)*waterScale}" fill="#69b3de" opacity=".45"/><path d="M265 239q17 -8 38 -1m-30 10q15 -6 37 -3" fill="none" stroke="#6a9eb8" opacity=".5"/></g>`:'';
  const swaleShape=swale?`<g data-layer="swale"><path d="${swaleLine}" fill="none" stroke="#a0b89e" stroke-width="${levels.swale===2?38:26}" stroke-linecap="round"/><path d="${swaleLine}" fill="none" stroke="#c9d7b9" stroke-width="${levels.swale===2?27:16}" stroke-linecap="round"/>${wet?`<path d="M347 271 C411 265 450 224 481 185 S530 141 556 143" fill="none" stroke="#8fb8c6" stroke-width="${(peak?13:8)*(post?.65:1)*(levels.swale===2?1.65:1)}" stroke-linecap="round" opacity=".85"/>`:''}${[0,1,2,3,4,5,6].map((i)=>{let x=354+i*29,y=266-i*19;return `<path class="plant" d="M${x} ${y}q-8 -9 -9 -13m9 13q0 -13 5 -17m-5 17q7 -9 12 -10"/>`}).join('')}</g>`:'';
  const arrow=(d,cls='flow',color='#218acf',width=2)=>`<path d="${d}" fill="none" stroke="${color}" stroke-width="${width}" class="${cls}" marker-end="url(#${uid}-arrow)" opacity="${post?.65:.9}"/>`;
  function pin(key,x,y,label,n){const selected=interactive&&key===node;return `<g class="${interactive?'map-hotspot':''}" ${interactive?`role="button" tabindex="0" data-node="${key}" aria-label="${label}" aria-pressed="${selected}"`:''} transform="translate(${x} ${y})">${selected?`<circle class="halo" r="23" fill="#7195aa" opacity=".13"/><circle r="18" fill="none" stroke="#6d97aa" opacity=".35"/>`:''}${interactive?'<circle class="pin-hit" r="27" fill="transparent"/>':''}<circle class="pin-core" r="12" fill="${selected?'#375f76':'#f7faf6'}" stroke="#618999" stroke-width="1.2"/><text text-anchor="middle" y="3.5" fill="${selected?'#fff':'#375f76'}" font-size="10">${n}</text>${!small?`<rect x="18" y="-11" width="${label.length*10+13}" height="22" rx="5" fill="#f9fcf7" opacity=".94"/><text x="25" y="3.5" fill="#526f78" font-size="10">${label}</text>`:''}</g>`;}
  return `<svg class="map-svg" data-scenario="${mode}" viewBox="0 0 700 440" xmlns="http://www.w3.org/2000/svg" role="${interactive?'group':'img'}" aria-label="${after?'微更新后':'原状情景'}，${stageData[stage].title}，概念步道图" preserveAspectRatio="xMidYMid meet"><defs><marker id="${uid}-arrow" markerWidth="7" markerHeight="7" refX="5" refY="3.5" orient="auto"><path d="M1 1l4 2.5-4 2.5" fill="none" stroke="#568ca4" stroke-width="1"/></marker><pattern id="${uid}-paving" width="11" height="11" patternUnits="userSpaceOnUse" patternTransform="rotate(-28)"><path d="M0 0h11v11" fill="none" stroke="#79abc0" stroke-width=".8"/></pattern><pattern id="${uid}-dots" width="10" height="10" patternUnits="userSpaceOnUse"><circle cx="2" cy="3" r=".65" fill="#b8c7b7" opacity=".25"/></pattern></defs><rect width="700" height="440" fill="#f1f6eb"/><rect width="700" height="440" fill="url(#${uid}-dots)"/>
  <path d="M700 82C620 122 589 172 594 207 S604 269 559 309C536 331 566 370 546 440H700Z" fill="#c6e5f0"/><path d="M700 102C640 136 609 183 612 211S623 267 580 312C558 337 584 379 566 440" class="waterline"/><path d="M700 129C655 151 625 187 630 220S637 277 601 315C582 341 603 381 587 440" class="waterline"/><path d="M700 158C663 174 649 200 650 230S659 284 624 324C610 345 624 388 610 440" class="waterline"/><path d="M694 249q-28 8-34 33m32 32q-32 21-35 65" class="waterline"/>
  <path class="contour" d="M-40 109C50 24 196 26 227 100S284 156 323 117 425 129 471 91 557 70 586 -10"/><path class="contour" d="M-30 133C55 49 182 46 212 116S283 180 331 140 419 153 491 102 572 94 614 -10"/><path class="contour" d="M-10 155C65 80 167 67 194 138S272 201 338 163 440 169 506 121 595 95 641 -10"/><path class="contour" d="M0 415C79 403 139 350 179 302S255 297 282 323 372 309 392 318 495 264 545 320"/><path class="contour" d="M0 439C104 420 157 375 196 326S251 324 285 346 368 334 402 341 507 288 542 342"/>
  <path d="${path}" fill="none" stroke="#c8c9bb" stroke-width="48" stroke-linecap="round"/><path d="${path}" fill="none" stroke="#e4dfcb" stroke-width="43" stroke-linecap="round"/><path d="${path}" fill="none" stroke="#f6f1dd" stroke-width="34" stroke-linecap="round"/>
  ${paving?`<path data-layer="paving" d="${levels.paving===2?'M158 303C214 244 244 244 280 243C352 240 414 223 439 189':'M215 261C259 233 308 251 378 221'}" fill="none" stroke="url(#${uid}-paving)" stroke-width="33"/>`:''}
  ${terrain?`<g data-layer="terrain" opacity=".6"><path d="M295 195Q334 194 352 223" fill="none" stroke="#91b49d" stroke-width="2"/>${levels.terrain===2?'<path d="M120 230Q216 226 307 210T405 192" fill="none" stroke="#83ad98" stroke-width="3" stroke-dasharray="4 3"/>':''}</g>`:''}${swaleShape}${puddle}${trees.map((t,i)=>tree(...t,i)).join('')}
  <g fill="#a5b7a0" opacity=".55">${[[207,169],[215,177],[202,187],[417,288],[428,294],[479,317],[496,323],[510,300],[90,405],[108,407],[511,106]].map(([x,y])=>`<ellipse cx="${x}" cy="${y}" rx="9" ry="5" transform="rotate(-35 ${x} ${y})"/>`).join('')}</g>
  ${wet?`<g data-layer="runoff">${!post?arrow(sourceLine):''}${!post?arrow(terrain?'M121 205Q150 243 216 245L339 268':'M121 205Q169 242 269 242'):''}${!post?arrow('M429 106Q432 141 423 178'):''}${swale?arrow('M369 268Q438 250 481 190'):''}${paving?[253,281,309].map(x=>arrow(`M${x} 227v30`,'flow','#628fad',1.3)).join(''):''}${swale&&peak?arrow('M515 158Q552 174 561 206T570 247','flow','#548da9',1.5):''}${!swale&&(peak||post)?arrow('M313 241Q383 218 419 201','flow','#548da9',1.5):''}${post&&paving?[267,295].map(x=>arrow(`M${x} 239v27`,'flow','#628fad',1.3)).join(''):''}</g>`:''}
  ${wet&&!post&&!small?`<g stroke="#7ca6b6" stroke-width="1">${Array.from({length:peak?34:17},(_,i)=>{const x=28+(i*83)%650,y=42+(i*61)%340;return `<path class="rain-streak" style="animation-delay:-${(i*.19)%1.3}s" d="M${x} ${y}l-3 8"/>`}).join('')}</g>`:''}
  <g>${!small?`<text x="28" y="31" font-size="9" fill="#87958b" letter-spacing="1.5">求知路 · 步道空间示意</text><text x="635" y="293" fill="#759aa5" font-size="15" letter-spacing="4" transform="rotate(90 635 293)">观音湖</text><text class="landmark" x="206" y="65">相邻绿地</text><text class="annotation" x="103" y="325" transform="rotate(-44 103 325)">约 50 m 设计步道</text>${paving?'<text class="annotation" x="245" y="286">透水铺装段</text>':''}${swale?'<text class="annotation" x="427" y="294">拟设植被沟</text>':''}<text class="annotation" x="25" y="414" opacity=".8">非测绘图 · 不按比例</text><g transform="translate(655 27)"><path d="M0 22V0m-5 10 5-10 5 10" fill="none" stroke="#83988e"/><text x="-3.5" y="-7" fill="#83988e" font-size="8">示意</text></g>`:''}</g>
  ${pin('source',225,139,'来路',1)}${pin('stay',swale?404:292,swale?258:243,'停留',2)}${pin('exit',557,251,'去路待核验',3)}
  ${!small?mapInteractionOverlay(mode,levels,stage,uid,interactive):''}
  </svg>`;
}
function sectionSVG(key){const common=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 290 100" aria-label="${strategyNames[key]}概念剖面" role="img"><defs><pattern id="soil-${key}" width="8" height="7" patternUnits="userSpaceOnUse"><circle cx="2" cy="3" r=".65" fill="#a6b6a0"/></pattern></defs>`;const end='</svg>';
if(key==='terrain')return common+`<path d="M12 57L83 57 132 70Q163 84 199 67L276 55V92H12Z" fill="#e0e3d1"/><path d="M12 57L83 57 132 70Q163 84 199 67L276 55" fill="none" stroke="#8fa487" stroke-width="2"/><path d="M12 59L81 59 107 67" fill="none" stroke="#c2c2ac" stroke-width="6"/><path d="M130 69Q165 75 192 69" fill="none" stroke="#9abecd" stroke-width="4"/><path d="M30 40H76L123 55m-8-8 8 8-11 0" fill="none" stroke="#608da2" stroke-width="1.6"/><path d="M224 63v-20m0 10-8-11m8 14 10-14" fill="none" stroke="#8da187"/><text x="13" y="22" font-size="9" fill="#87988d">步道边缘</text><text x="188" y="28" font-size="9" fill="#87988d">低位绿地</text>`+end;
if(key==='paving')return common+`<path d="M18 55H275V88H18Z" fill="#dfe3d0"/><path d="M18 55H275V88H18Z" fill="url(#soil-paving)"/><path d="M18 67H275" stroke="#c1c9b3" stroke-width="9"/>${Array.from({length:10},(_,i)=>`<rect x="${18+i*26}" y="42" width="23" height="10" rx="1" fill="#cbcbb7"/>`).join('')}<g fill="none" stroke="#6f9cab" stroke-width="1.5">${[66,143,221].map(x=>`<path d="M${x} 16V72m-4-6 4 6 4-6"/>`).join('')}</g><text x="101" y="98" font-size="8" fill="#87988d">下渗 / 蓄排基层</text>`+end;
return common+`<path d="M12 46H53Q86 49 109 74H197Q226 49 251 46H280V93H12Z" fill="#dde2cc"/><path d="M12 46H53Q86 49 109 74H197Q226 49 251 46H280" fill="none" stroke="#8fa287" stroke-width="2"/><path d="M94 60Q103 70 112 74H195Q206 68 213 60Z" fill="#a6c9d2"/>${[37,77,123,168,216,259].map((x,i)=>{let y=i===2||i===3?71:i===1||i===4?53:44;return `<path d="M${x} ${y}q0-11-2-18m2 18q-10-6-10-13m10 13q7-9 9-17" fill="none" stroke="#79957d" stroke-width="1.3"/>`}).join('')}<path d="M24 25H73L100 42m-8-8 8 8-11-1" fill="none" stroke="#6795a8" stroke-width="1.5"/><text x="132" y="36" font-size="9" fill="#7c999f">暂存水体</text>`+end;
}
function getStory(){const after=(state.mode==='compare'?state.detailMode:state.mode)!=='before',t=after&&state.strategies.terrain,p=after&&state.strategies.paving,s=after&&state.strategies.swale;
  if(state.stage===0)return {source:['周边绿地与铺装','来路 · 先读高低','雨前没有地表径流。来水箭头会在初雨阶段出现；周边地形关系是概念假设，需现场测绘核验。'],stay:[s?'拟设低位植被空间':'假设步道低点','停留 · 识别低点',s?'植被沟预留暂存空间，等待降雨承接来水。图示位置尚需结合树根与道路边界校核。':'图中步道低点用于说明可能的暂存位置，不是已测得的积水点。'],exit:['排水连接待核验','去路 · 不预设入湖','后续需核对场地高程、土壤与既有排水连接；图中未把观音湖直接视为排水出口。']};
  return {source:[t?'顺势引向绿地':'地表汇向步道低点','来路 · 雨从哪里来',state.stage===3?'雨后不再新增降雨来水。此时观察重点转为暂存水的下渗与消退。':t?'微地形把部分地表来水从步道边缘引向绿地。箭头表示方向，不表示实际流量。':'雨滴落在铺装与相邻绿地，沿假设的地形关系汇向步道低点。'],stay:[s?'植被沟承接与暂存':'步道低点暂存','停留 · 给水留出空间',s?(state.stage===3?'雨后的植被沟暂存水逐渐消退。图中变化仅表达过程，不对应真实耗时。':'植被沟承接来水并暂存；透水铺装与微地形是否启用，会共同影响步道暂存的示意范围。'):'缺少植被沟承接时，暂存水更集中于假设的步道低点。图中水域面积仅用于定性比较。'],exit:[p?'就地下渗，溢流待核验':'排水去向待核验','去路 · 下渗与有序溢流',p?'部分雨水经透水结构下渗；持续降雨时，植被沟的溢流需接入经核验的排水路径，不能默认直接入湖。':'透水铺装未启用，图中不显示该段下渗。其余来水的消退与溢流仍需核验土壤和排水条件。']};
}
function miniPhone(key,prefix='ui') {const base=`<div class="phone-status"><span>9:41</span><span>▰ ▰</span></div><div class="phone-head"><strong>雨径</strong><span>观音湖 · 求知路</span></div>`;let body='';
if(key==='overview')body=`<p class="phone-label">A SMALL WALK, A WATER STORY</p><div class="phone-title">沿着一滴雨，<br>重新认识这条路。</div><div class="phone-map">${mapSVG({interactive:false,small:true,stage:0,uid:prefix+'-overview'})}</div><p class="phone-caption">约 50 米步道的微小观察<br>相邻绿地 / 步道 / 湖岸</p><div class="phone-action">开启一场观雨之旅 <span>↗</span></div>`;
if(key==='journey')body=`<p class="phone-label">FOLLOW THE RAIN</p><div class="phone-title">雨水经过的地方</div><span class="phone-chip">持续降雨 · 概念示意</span><div class="phone-map">${mapSVG({interactive:false,small:true,stage:2,uid:prefix+'-journey'})}</div><div class="phone-line"><i></i><i></i><i class="on"></i><i></i></div><div class="phone-mini-row"><b>01</b>从哪里来<span>↗</span></div><div class="phone-mini-row"><b>02</b>在哪里停留<span>↗</span></div><div class="phone-mini-row"><b>03</b>向哪里去<span>↗</span></div>`;
if(key==='compare')body=`<p class="phone-label">A GENTLER WAY FOR WATER</p><div class="phone-title">同一场雨，<br>不同的路径。</div><span class="phone-chip">原状情景</span><div class="phone-map">${mapSVG({interactive:false,small:true,stage:2,mode:'before',uid:prefix+'-old'})}</div><span class="phone-chip">微更新后</span><div class="phone-map">${mapSVG({interactive:false,small:true,stage:2,mode:'after',uid:prefix+'-new'})}</div><p class="phone-caption">引 · 微地形　渗 · 透水铺装<br>蓄 · 植被沟</p>`;
return `<div class="phone ${key==='compare'?'mini-compare':''}">${base}<div class="phone-body">${body}<div class="phone-bottom"><span>⌂ 总览</span><span>≋ 循雨</span><span>▱ 策略</span></div></div></div>`;}
const uiData={overview:['步道总览','从一段步道，进入一场雨。','展示范围、空间关系与体验入口，让访客先了解约50米步道的设计边界。','开始场地探索'],journey:['循雨探索','把雨水的路径，交给手指探索。','降雨阶段、路径节点与说明联动。进入场景后，点选来路、停留或去路即可查看说明。','体验持续降雨'],compare:['更新对照','让每一种介入，都有迹可见。','以相同阶段、相同视角比较原状与微更新方案。三项策略可独立开关，结果为定性示意。','打开滑动对照']};
function announce(text){$('#action-feedback').textContent=text;$('#status').textContent=text;}
function levelsFor(mode){return mode==='before'?{terrain:0,paving:0,swale:0}:state.levels;}
function mapInteractionOverlay(mode,levels,stage,uid,interactive=true){
  const l=mode==='before'?{terrain:0,paving:0,swale:0}:levels;
  const plan=RainpathRoutes.route(state.source,l,stage);
  const tracing=`<g class="trace-overlay" data-trace="${uid}"><path class="trace-route" d="${plan.path}" fill="none" stroke="#087fce" stroke-width="3" opacity=".15"/><path class="trace-trail" d="${plan.path}" fill="none" stroke="#087fce" stroke-width="3.5" stroke-linecap="round"/><g class="trace-particle"><circle class="particle-glow" r="12" fill="#4ba8e5" opacity=".16"/><circle r="5.5" fill="#fff" stroke="#087fce" stroke-width="2.5"/></g></g>`;
  if(!interactive)return tracing;
  if(state.workspace==='design')return tracing+Object.entries({terrain:[345,174],paving:[280,243],swale:[470,212]}).map(([k,[x,y]])=>`<g class="design-handle ${state.tool===k?'chosen':''}" role="button" tabindex="0" data-zone="${k}" data-scenario="${mode}" aria-label="在场景调整${strategyNames[k]}" transform="translate(${x} ${y})"><circle r="33" fill="transparent"/><circle class="handle-aura" r="23"/><circle class="handle-core" r="15"/><text text-anchor="middle" y="5" font-size="15" fill="#fff">${l[k]===0?'+':l[k]===1?'−':'='}</text><rect x="-43" y="25" width="86" height="22" rx="10" fill="#fff" opacity=".94"/><text text-anchor="middle" y="39" font-size="9" fill="#246f9c">${strategyNames[k]} · ${l[k]===0?'未设置':l[k]===1?'局部':'加强'}</text></g>`).join('');
  return tracing+Object.entries({green:[240,89],path:[208,266],edge:[429,106]}).map(([k,[x,y]])=>`<g class="source-point ${state.source===k?'chosen':''}" role="button" tabindex="0" data-map-source="${k}" aria-label="在${RainpathRoutes.labels[k]}${stage===3?'追踪雨后余水':'放下一滴雨'}" transform="translate(${x} ${y})"><circle class="source-hit" r="26" fill="transparent"/><circle class="source-ring" r="17" fill="none" stroke="#3e96c8" stroke-dasharray="2 3" opacity="${state.source===k?'.8':'.25'}"/><path d="M0-9S-6-2-6 3a6 6 0 0 0 12 0C6-2 0-9 0-9Z" fill="${state.source===k?'#198ed5':'#ffffff'}" stroke="#389bd3" stroke-width="1.5"/></g>`).join('');
}
function currentPlan(){return RainpathRoutes.route(state.source,state.mode==='before'?{terrain:0,paving:0,swale:0}:state.mode==='compare'&&state.compareKind==='saved'&&savedSchemes.B?savedSchemes.B.levels:state.levels,state.stage);}
function stopTrace(){if(traceFrame)cancelAnimationFrame(traceFrame);traceFrame=null;state.tracing=false;}
function resetTrace(){stopTrace();state.traceProgress=0;}
function updateTrace(){
  $$('#scene [data-trace]').forEach(g=>{
    const path=$('.trace-route',g),trail=$('.trace-trail',g),particle=$('.trace-particle',g),length=path.getTotalLength(),p=state.traceProgress/100;
    trail.style.strokeDasharray=length;trail.style.strokeDashoffset=length*(1-p);
    const point=path.getPointAtLength(length*p);particle.setAttribute('transform',`translate(${point.x} ${point.y})`);
    g.style.opacity=p>0?'1':'0';
  });
  $('#trace-range').value=state.traceProgress;
  const plan=currentPlan(),i=Math.min(2,Math.floor(state.traceProgress/34));
  $('#trace-caption').textContent=state.traceProgress>0?plan.steps[i]:state.stage===3?'选择位置，追踪余水消退':'等待一滴雨落下';
  $('#drop-rain span').textContent=state.tracing?'暂停雨滴':state.traceProgress>=100?'再走一次':state.traceProgress>0?'继续追踪':state.stage===3?'追踪雨后余水':'放下一滴雨';
  $('#drop-rain').setAttribute('aria-pressed',state.tracing);
  if(state.mode==='compare'&&state.traceProgress>0){const saved=state.compareKind==='saved'&&savedSchemes.A&&savedSchemes.B;const a=RainpathRoutes.route(state.source,saved?savedSchemes.A.levels:{terrain:0,paving:0,swale:0},state.stage),b=RainpathRoutes.route(state.source,saved?savedSchemes.B.levels:state.levels,state.stage);$('#node-title').textContent=(saved?'A / B':'原状 / 更新')+' · 路径对照';$('#node-description').textContent=(saved?'方案 A':'原状')+'：'+a.end+'；'+(saved?'方案 B':'更新后')+'：'+b.end+'。拖动对照滑杆查看同一落点的路径差异。';return;}
  if(state.traceProgress>0){$('#node-title').textContent=[state.stage===3?'余水 / ':'落雨 / ','经过 / ','抵达 / '][i]+plan.end;$('#node-description').textContent=plan.steps[i]+'。路径为概念推演，不表示实际流量与耗时。';}
}
function startTrace(){
  if(state.tracing){stopTrace();updateTrace();return}
  stopTour();if(state.stage===0){state.stage=1;announce('已进入初雨，观察雨滴从所选位置出发。')}
  if(state.traceProgress>=100)state.traceProgress=0;
  state.tracing=true;traceStart=performance.now()-state.traceProgress*65;render();
  const tick=now=>{state.traceProgress=Math.min(100,(now-traceStart)/65);updateTrace();if(state.traceProgress<100&&state.tracing)traceFrame=requestAnimationFrame(tick);else{stopTrace();updateTrace();announce('雨滴抵达：'+currentPlan().end+'。调整策略后，可以再走一次。')}};
  traceFrame=requestAnimationFrame(tick);
}
function renderScene(){
  const scene=$('#scene'),compare=state.mode==='compare';scene.classList.toggle('comparing',compare);scene.classList.toggle('designing',state.workspace==='design');
  if(compare){const saved=state.compareKind==='saved'&&savedSchemes.A&&savedSchemes.B;const left=saved?savedSchemes.A.levels:{terrain:0,paving:0,swale:0},right=saved?savedSchemes.B.levels:state.levels;
    const map=(l,side)=>mapSVG({mode:saved?'after':side==='left'?'before':'after',uid:'compare-'+side,node:null,interactive:false,levels:l,strategies:Object.fromEntries(Object.entries(l).map(([k,v])=>[k,v>0]))});
    scene.innerHTML=`<div class="compare-map compare-under"><span class="compare-tag tag-right">${saved?'方案 B':'微更新后'}</span>${map(right,'right')}</div><div class="compare-map compare-over"><span class="compare-tag">${saved?'方案 A':'原状情景'}</span>${map(left,'left')}</div><div class="compare-divider"><span>↔</span></div>`;
    $('#compare-left-label').textContent=saved?'方案 A':'原状情景';$('#compare-right-label').textContent=saved?'方案 B':'微更新后';$('#compare-baseline').hidden=!saved;
  }else scene.innerHTML=mapSVG({mode:state.mode});
  $('#compare-control').hidden=!compare;setComparePosition(state.comparePosition);updateTrace();
}
function setComparePosition(value){state.comparePosition=Number(value);$('#compare-range').value=value;const overlay=$('.compare-over'),divider=$('.compare-divider');if(overlay)overlay.style.clipPath=`inset(0 ${100-value}% 0 0)`;if(divider)divider.style.left=value+'%';}
function render(){
  renderScene();const stage=stageData[state.stage],story=getStory();$('#stage-count').textContent=`0${state.stage+1} / 04`;$('#stage-en').textContent=stage.en;$('#stage-title').textContent=stage.title;$('#stage-description').textContent=stage.description;$('#weather-mark').textContent=stage.mark;
  for(const key of ['source','stay','exit'])$(`#${key}-summary`).textContent=story[key][0];$('#node-title').textContent=story[state.node][1];$('#node-description').textContent=story[state.node][2];
  $$('[data-stage]').forEach(b=>b.setAttribute('aria-pressed',Number(b.dataset.stage)===state.stage));$$('[data-mode]').forEach(b=>b.setAttribute('aria-pressed',b.dataset.mode===state.mode));$$('.water-story [data-node]').forEach(b=>b.setAttribute('aria-pressed',b.dataset.node===state.node));
  $$('[data-strategy]').forEach(b=>{b.setAttribute('aria-checked',state.strategies[b.dataset.strategy]);b.closest('.strategy-card')?.classList.toggle('disabled',!state.strategies[b.dataset.strategy])});
  const enabled=Object.keys(state.strategies).filter(k=>state.strategies[k]);$('#strategy-summary').textContent=enabled.length?'当前方案：'+RainpathRoutes.summarize(state.levels):'当前保留原状。进入设计模式，尝试串联引、渗、蓄。';
  document.body.classList.toggle('motion-paused',state.paused);$('#motion-toggle').textContent=state.paused?'恢复水流动画':'暂停水流动画';$('#motion-toggle').setAttribute('aria-pressed',state.paused);$('#play-tour').innerHTML=state.playing?'<span aria-hidden="true">Ⅱ</span>暂停过程':'<span aria-hidden="true">▷</span>播放过程';
  $$('[data-workspace]').forEach(b=>b.setAttribute('aria-pressed',state.workspace===b.dataset.workspace));$$('[data-source]').forEach(b=>b.setAttribute('aria-pressed',state.source===b.dataset.source));$$('[data-tool]').forEach(b=>b.setAttribute('aria-pressed',state.tool===b.dataset.tool));
  $('#design-dock').hidden=state.workspace!=='design';$('#source-tools').hidden=state.workspace!=='rain';$('#design-tools').hidden=state.workspace!=='design';
  $('#workspace-hint').textContent=state.workspace==='rain'?'选择落点，观察同一滴雨在不同方案中的去向。':'选一个工具，再点击场景标记或下方选项调整。';
  $('#map-caption').textContent=state.mode==='compare'?(state.compareKind==='saved'?'A / B 已保存方案 · 拖动下方滑杆比较':'同一场雨，同一位置 · 拖动下方滑杆比较'):state.workspace==='design'?'点击场景中的 ＋ / − / ＝，轮换介入程度。':state.stage===3?'点击蓝色雨滴，追踪该位置的余水。':'点击蓝色雨滴，在该位置放下一滴雨。';
  const k=state.tool;$('#design-tool-title').textContent=strategyNames[k]+' / '+strategyData[k].verb;
  $('#design-options').innerHTML=RainpathRoutes.options[k].map((name,i)=>`<button data-level="${i}" aria-pressed="${state.levels[k]===i}"><span>${i===0?'○':i===1?'◒':'●'}</span>${name}</button>`).join('');
  $('#design-impact').textContent={terrain:['沿用原状汇流关系。试着加入局部衔接，再观察植被沟能否接到来水。','在步道边缘打开衔接，让来水有机会进入绿地。','强化连续的边缘引导；更具体的标高与坡度需现场核验。'],paving:['保留原铺装，步道落雨以地表径流表达。','在中段增加透水铺装；选择「步道落雨」最容易看出路径变化。','延长透水路段，拦接更多位置的来水；图中长度仅表达概念。'],swale:['未设置专门暂存带，来水仍需找到承接空间。','设置浅凹植被沟，承接被引向绿地的来水。','拓宽暂存带，示意更多可容纳空间；不是实际容量计算。']}[k][state.levels[k]];
  $('#route-outcome').textContent=currentPlan().end;$('#undo-design').disabled=!history.length;renderSchemes();updateTrace();
}
function renderSchemes(){for(const key of ['A','B']){const d=savedSchemes[key];$('#scheme-'+key).textContent=d?RainpathRoutes.summarize(d.levels):'尚未保存';$('#scheme-'+key).title=d?RainpathRoutes.summarize(d.levels):'';$(`[data-load="${key}"]`).disabled=!d;$(`[data-save="${key}"]`).textContent=d?'更新 '+key:'保存为 '+key;}$('#compare-saved').disabled=!(savedSchemes.A&&savedSchemes.B);}
function stopTour(){clearInterval(timer);timer=null;state.playing=false;}
function setStage(i){stopTour();resetTrace();state.stage=i;render();announce(['雨前：先看地形。','初雨：试着放下一滴雨。','持续降雨：观察承接与溢流关系。','雨后：追踪暂存水的消退路径。'][i]);}
function selectNode(n,scenario){resetTrace();state.node=n;if(scenario)state.detailMode=scenario;render();announce(getStory()[n][2]);}
function changeWorkspace(workspace){resetTrace();state.workspace=workspace;if(workspace==='design'){state.mode='after';state.compareKind='baseline'}render();}
function setLevel(k,value){history.push({...state.levels});if(history.length>30)history.shift();resetTrace();stopTour();state.levels[k]=Number(value);state.strategies[k]=value>0;state.tool=k;state.mode='after';state.compareKind='baseline';render();announce(strategyNames[k]+'已调整为「'+RainpathRoutes.options[k][value]+'」。'+currentPlan().end+'。');}
function renderGallery(){ $('#ui-gallery').innerHTML=Object.keys(uiData).map((k,i)=>`<button class="ui-preview ${state.ui===k?'selected':''}" data-ui="${k}" aria-label="展开${uiData[k][0]}界面">${miniPhone(k)}<span class="ui-caption"><span>${uiData[k][0]}</span><span>进入体验 ↗</span></span></button>`).join('');}
function showDialog(content,wide=false){stopTour();stopTrace();$('#detail-dialog').classList.toggle('wide-dialog',wide);$('#dialog-content').innerHTML=content;$('#detail-dialog').showModal();updateTrace();}
function openUI(key){state.ui=key;$$('.interface-tabs button').forEach(b=>b.setAttribute('aria-pressed',b.dataset.ui===key));renderGallery();const d=uiData[key];showDialog(`<p class="dialog-kicker">UI / ${d[0]}</p><h2 id="dialog-title">${d[1]}</h2><p>${d[2]}</p><div class="dialog-phone">${miniPhone(key,'dialog')}</div><button class="dialog-action" data-launch="${key}">${key==='journey'?'进入雨滴追踪':d[3]} ↗</button>`);}
function openStrategy(key){const d=strategyData[key];showDialog(`<p class="dialog-kicker">${d.verb} / ${strategyNames[key]}</p><h2 id="dialog-title">${d.subtitle}</h2><div class="dialog-drawing">${sectionSVG(key)}</div><p>${d.body}</p><div class="dialog-facts"><p><strong>场景中的变化</strong><br>${d.effect}</p><p><strong>落地前需要核验</strong><br>${d.condition}</p></div><button class="dialog-action" data-observe="${key}">在场景里亲手调整 ↗</button>`);}
function launch(kind){resetTrace();stopTour();if($('#detail-dialog').open)$('#detail-dialog').close();state.stage=kind==='overview'?0:2;state.mode=kind==='compare'?'compare':'after';state.compareKind='baseline';state.workspace=kind==='design'?'design':'rain';render();$('#explore').scrollIntoView({behavior:reducedMotion?'instant':'smooth'});$(`[data-workspace="${state.workspace}"]`).focus({preventScroll:true});}
function onControl(b){
 if(b.dataset.stage!==undefined)setStage(Number(b.dataset.stage));
 else if(b.dataset.mode){resetTrace();state.mode=b.dataset.mode;state.detailMode=state.mode==='before'?'before':'after';state.compareKind='baseline';render()}
 else if(b.dataset.node)selectNode(b.dataset.node,b.closest('svg')?.dataset.scenario);
 else if(b.dataset.workspace)changeWorkspace(b.dataset.workspace);
 else if(b.dataset.source){resetTrace();state.source=b.dataset.source;render();announce('落点已选择：'+RainpathRoutes.labels[state.source]+'。按「放下一滴雨」开始。')}
 else if(b.dataset.mapSource){resetTrace();state.source=b.dataset.mapSource;startTrace()}
 else if(b.dataset.tool){state.tool=b.dataset.tool;render()}
 else if(b.dataset.zone){if(state.mode==='compare'){announce('请切换到「微更新后」，再修改当前方案。');return}state.tool=b.dataset.zone;setLevel(state.tool,(state.levels[state.tool]+1)%3);$(`#scene [data-zone="${state.tool}"]`)?.focus({preventScroll:true})}
 else if(b.dataset.level!==undefined){setLevel(state.tool,Number(b.dataset.level));$(`[data-level="${b.dataset.level}"]`)?.focus({preventScroll:true})}
 else if(b.dataset.strategy)setLevel(b.dataset.strategy,state.strategies[b.dataset.strategy]?0:1);
 else if(b.dataset.detail)openStrategy(b.dataset.detail);
 else if(b.dataset.ui)openUI(b.dataset.ui);
 else if(b.dataset.launch)launch(b.dataset.launch);
 else if(b.dataset.observe){state.tool=b.dataset.observe;launch('design')}
 else if(b.dataset.boardLink)launch(b.dataset.boardLink);
 else if(b.dataset.save){const key=b.dataset.save;savedSchemes[key]={levels:{...state.levels}};let persisted=true;try{localStorage.setItem('rainpath.schemes.v2',JSON.stringify(savedSchemes))}catch{persisted=false}renderSchemes();announce('方案 '+key+' 已保存'+(persisted?'在此浏览器。':'于当前页面，刷新后可能丢失。')+RainpathRoutes.summarize(state.levels)+'。')}
 else if(b.dataset.load){const key=b.dataset.load;if(!savedSchemes[key])return;history.push({...state.levels});resetTrace();state.levels={...savedSchemes[key].levels};for(const k in state.levels)state.strategies[k]=state.levels[k]>0;state.mode='after';state.compareKind='baseline';render();announce('已载入方案 '+key+'。当前降雨阶段保持不变。')}
 else if(b.id==='compare-saved'){if(!savedSchemes.A||!savedSchemes.B)return;resetTrace();state.mode='compare';state.workspace='rain';state.compareKind='saved';render();announce('正在对照已保存的 A / B，在同一降雨阶段拖动滑杆查看差异。')}
 else if(b.id==='compare-baseline'){state.compareKind='baseline';render()}
 else if(b.id==='undo-design'){if(!history.length)return;resetTrace();state.levels=history.pop();for(const k in state.levels)state.strategies[k]=state.levels[k]>0;state.mode='after';render();announce('已撤销上一项改动。')}
 else if(b.id==='drop-rain')startTrace();
 else if(b.id==='trace-restart'){resetTrace();render();announce('雨滴已回到起点。')}
 else if(b.id==='play-tour'){if(state.playing){stopTour();render()}else{resetTrace();state.playing=true;if(state.stage===3)state.stage=0;render();timer=setInterval(()=>{state.stage++;if(state.stage>=3){state.stage=3;stopTour()}render()},3500)}}
 else if(b.id==='motion-toggle'){state.paused=!state.paused;if(state.paused)stopTrace();render()}
 else if(b.id==='reset'){stopTour();resetTrace();history.length=0;Object.assign(state,{stage:1,mode:'after',detailMode:'after',node:'source',strategies:{terrain:true,paving:true,swale:true},levels:{terrain:1,paving:1,swale:1},workspace:'rain',source:'green',tool:'terrain',compareKind:'baseline',comparePosition:50,paused:reducedMotion});render();announce('演示已重置，已保存的 A / B 方案仍保留。')}
 else if(b.id==='open-board')showDialog('<p class="dialog-kicker">RAIN PATH / UI DESIGN BOARD</p><h2 id="dialog-title">雨径 · UI 三联展板</h2><p class="board-project-title">雨径——观音湖求知路一段步道的雨水路径可视化与景观微更新设计</p><p class="board-project-en" lang="en">RAIN PATH — Rainwater Path Visualization &amp; Landscape Micro-Renewal Design</p><p>系统建立 · 核心功能页面 · 成果展示。此图为设计概念展板，画面中的场景不作为现场照片或实测依据。</p><img class="original-board" src="/assets/rainpath-board.png?v=5bda198f" alt="雨径——观音湖求知路一段步道的雨水路径可视化与景观微更新设计：UI三联展板完整图"><button class="dialog-action" data-launch="journey">从展板进入雨滴追踪 ↗</button>',true);
 else if(b.id==='help-button')showDialog('<p class="dialog-kicker">TRY IT YOURSELF</p><h2 id="dialog-title">让一滴雨，回应你的选择。</h2><div class="help-steps"><p><strong>落一滴雨</strong><br>选择绿地、步道或边缘，点击「放下一滴雨」，也可以直接点击图中的蓝色雨滴。拖动路径滑杆可逐段观察。</p><p><strong>改一段路</strong><br>切换到「动手改造步道」，点击场景标记或介入选项。每项策略有保留原状、局部介入和加强介入三种状态。</p><p><strong>比两种想法</strong><br>保存方案 A，修改后保存方案 B。点击「对照 A / B」，拖动滑杆，在同一场雨里比较。</p></div><button class="dialog-action" data-launch="journey">开始试一试 ↗</button>');
 else if(b.classList.contains('dialog-close'))$('#detail-dialog').close();
}
 document.addEventListener('click',e=>{const b=e.target.closest('button,[role="button"]');if(b)onControl(b)});
 document.addEventListener('keydown',e=>{if(e.target.matches('g[role="button"]')&&(e.key==='Enter'||e.key===' ')){e.preventDefault();onControl(e.target)}});
 $('#compare-range').addEventListener('input',e=>setComparePosition(e.target.value));
 $('#trace-range').addEventListener('input',e=>{const position=Number(e.target.value);stopTrace();stopTour();if(state.stage===0){state.stage=1;render()}state.traceProgress=position;updateTrace()});
 $('#trace-range').addEventListener('change',()=>announce(currentPlan().steps[Math.min(2,Math.floor(state.traceProgress/34))]+'。'));
 $('#detail-dialog').addEventListener('click',e=>{if(e.target===e.currentTarget){const r=e.currentTarget.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)e.currentTarget.close()}});
 document.addEventListener('visibilitychange',()=>{if(document.hidden){stopTour();stopTrace();render()}});
 for(const k of Object.keys(strategyData))$(`#${k}-drawing`).innerHTML=sectionSVG(k);
 const navObserver=new IntersectionObserver(entries=>{entries.filter(e=>e.isIntersecting).forEach(e=>{$$('nav a').forEach(a=>a.classList.toggle('nav-active',a.getAttribute('href')==='#'+e.target.id))})},{rootMargin:'-10% 0px -55% 0px'});['explore','strategies','interfaces'].forEach(id=>navObserver.observe($('#'+id)));
 render();renderGallery();

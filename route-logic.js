'use strict';
// Qualitative narrative routes, deliberately not a hydraulic model.
const RainpathRoutes = (() => {
  const labels = {green:'相邻绿地',path:'步道铺装',edge:'步道边缘'};
  const options = {
    terrain:['保留原状','局部衔接','连续引导'],
    paving:['保留原状','局部透水','延长透水段'],
    swale:['保留原状','浅凹植被沟','拓宽暂存带']
  };
  function normalize(levels){return Object.fromEntries(Object.keys(options).map(k=>[k,Math.max(0,Math.min(2,Number(levels?.[k])||0))]));}
  function route(source,levels,stage){
    const l=normalize(levels),origin=labels[source]||labels.green;
    const start={green:'M240 89 C260 126 276 150 290 180',path:'M208 266 Q230 249 260 244',edge:'M429 106 Q432 141 423 178'}[source]||'M240 89 C260 126 276 150 290 180';
    if(stage===0)return {path:start,steps:[origin+' · 雨尚未落下','雨前观察地形与材质','选择初雨或持续降雨，再释放雨滴'],end:'等待降雨',kind:'dry'};
    if(stage===3){
      if(source==='path'&&l.paving>0)return {path:'M270 241 Q286 242 287 252 L287 281',steps:['雨已停 · 追踪铺装上的余水','余水穿过透水面层','进入蓄排结构，真实消退速度待核验'],end:'铺装余水下渗',kind:'infiltrate'};
      if(l.terrain>0&&l.swale>0)return {path:'M405 256 Q454 236 479 192 Q513 154 547 147 L547 180',steps:['雨已停 · 植被沟仍有暂存水','余水沿暂存空间缓慢移动','暂存水下渗或经核验的排水连接消退'],end:'植被沟余水消退',kind:'swale'};
      return {path:'M282 244 C304 252 319 241 302 233 C277 222 266 244 288 251',steps:['雨已停 · 步道低点仍有余水','缺少连续消退路径，余水暂留','需核验原有排水与土壤条件，不能保证消退时间'],end:'低点余水待消退',kind:'pond'};
    }
    if(source==='path'&&l.paving>0)return {path:start+' Q280 238 287 246 L287 273',steps:[origin+' · 接触铺装表面','透水面层承接部分来水','穿过面层，进入下部蓄排结构'],end:'铺装就地下渗',kind:'infiltrate'};
    if(l.terrain>0&&l.swale>0)return {path:start+(l.terrain===2?' Q324 200 360 246 Q380 277 414 255':' Q339 199 373 246 Q388 272 414 255')+' C454 234 469 199 492 179 Q526 146 550 146'+(stage===2?' Q561 165 558 206 Q558 231 571 247':''),steps:[origin+' · 形成地表来水',(l.terrain===2?'连续边缘引导':'局部边缘衔接')+'，'+(l.swale===2?'拓宽的暂存带':'浅凹植被沟')+'承接',stage===2?'继续来水时，溢流连接仍需现场核验':'暂存后缓慢下渗，具体条件待核验'],end:stage===2?'绿地承接 / 溢流待核验':'绿地暂存与下渗',kind:'swale'};
    if(l.terrain>0)return {path:start+' Q321 215 356 258 Q369 281 390 280',steps:[origin+' · 形成地表来水','边缘衔接把来水引向绿地','缺少植被沟，承接与溢流关系尚未闭合'],end:'已引向绿地 / 缺少承接',kind:'green'};
    if(l.paving===2)return {path:start+' Q330 210 309 233 L306 267',steps:[origin+' · 形成地表来水','延长的透水段拦接部分来水','在铺装处下渗，其余来水仍需组织'],end:'部分被透水段承接',kind:'infiltrate'};
    return {path:start+' Q310 214 296 241 C269 253 266 230 294 232 C318 235 318 253 293 250',steps:[origin+' · 汇向步道低点','未形成连续引导，来水在低点停留',l.swale?'植被沟已设置，但此来水路径尚未接入':'缺少连续的引、渗、蓄路径，暂存仍集中于步道'],end:l.swale?'沟已设置 / 来水连接不足':'步道低点暂存',kind:'pond'};
  }
  function summarize(l){l=normalize(l);return Object.keys(options).map(k=>options[k][l[k]]).join(' · ');}
  return {labels,options,normalize,route,summarize};
})();

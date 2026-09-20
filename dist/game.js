'use strict';
const $ = id => document.getElementById(id);
const arena = $('arena'), canvas = $('effects'), ctx = canvas.getContext('2d');
const paddles = [$('left-paddle'), $('right-paddle')];
const scoreEls = [$('score-left'), $('score-right')];
const state = {status:'ready',mode:'solo',computer:1,recorded:false,level:'normal',score:[0,0],y:[.5,.5],ball:{x:.5,y:.5,vx:0,vy:0},rally:0,elapsed:0,countdown:0,next:1,width:1000,height:430,pw:88,ph:108,px:60,sound:false,trail:[],particles:[],target:null};
const keys = new Set(), pointers = new Map();
let lastTime = 0, audioContext;
let portrait = false;
const desktopPointer=window.matchMedia('(any-pointer: fine)');
const windowPortrait=window.matchMedia('(orientation: portrait)');
const orientationButtons=[...document.querySelectorAll('[data-orientation]')];
let courtPreference='auto';
try{const saved=localStorage.getItem('tariff-bash.orientation');if(['auto','portrait','landscape'].includes(saved))courtPreference=saved;}catch{}
function effectivePortrait(){return desktopPointer.matches&&courtPreference!=='auto'?courtPreference==='portrait':windowPortrait.matches;}
function fitDesktopCourt(nextPortrait){
  const root=document.documentElement;
  root.classList.toggle('desktop-court',desktopPointer.matches);
  root.dataset.court=nextPortrait?'portrait':'landscape';
  orientationButtons.forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.orientation===courtPreference)));
  if(!desktopPointer.matches)return;
  const shell=$('game-shell'),game=$('game'),style=getComputedStyle(shell);
  const availableWidth=Math.max(1,shell.clientWidth-parseFloat(style.paddingLeft)-parseFloat(style.paddingRight));
  const viewportHeight=document.documentElement.clientHeight||window.innerHeight;
  const width=Math.floor(Math.min(availableWidth,nextPortrait?Math.max(300,(viewportHeight-300)*.68):availableWidth));
  root.style.setProperty('--court-width',width+'px');
  // Use document coordinates so scrolling never changes the chosen court size.
  const top=arena.getBoundingClientRect().top+window.scrollY;
  const controls=game.querySelector('.control-bar').getBoundingClientRect().height;
  const availableHeight=viewportHeight-top-controls-18;
  const height=Math.round(Math.max(nextPortrait?320:220,Math.min(availableHeight,nextPortrait?width*1.6:width/1.55)));
  root.style.setProperty('--court-height',height+'px');
  root.dataset.compactCourt=String(height<300);
}
const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const clamp = (v,a,b) => Math.max(a,Math.min(b,v));
const names=['Carney','Trump'];
const humanSide=()=>1-state.computer;
const victoryDances=[
  {src:'assets/carney-victory-body-transparent.png',head:'assets/carney.png',character:'carney',ratio:1,ready:false,label:'Mark Carney danse en cartoon, bras levés et index pointés vers le ciel.'},
  {src:'assets/trump-victory-body-v2.png',rows:4,head:'assets/trump.png',character:'trump',ratio:1,ready:false,label:'Donald Trump danse en cartoon, en balançant les épaules et en alternant les mouvements de poings.'}
];
let danceWinner=null;
function stopVictoryDance(){
  window.TariffPerfectVictory?.stop();
  danceWinner=null;$('overlay').classList.remove('celebrating');$('victory-stage').hidden=true;$('victory-sprite').classList.remove('is-dancing');
}
function fitVictoryDance(){
  if(danceWinner===null||$('victory-stage').hidden)return;
  const stage=$('victory-stage'),sprite=$('victory-sprite'),ratio=victoryDances[danceWinner].ratio;
  const width=Math.min(stage.clientWidth,stage.clientHeight*ratio);
  sprite.style.width=width+'px';sprite.style.height=(width/ratio)+'px';
}
function showVictoryDance(side){
  if(state.status!=='over')return;danceWinner=side;
  const dance=victoryDances[side];if(!dance.ready)return;
  const sprite=$('victory-sprite');sprite.classList.remove('is-dancing');
  // Reuse the exact game portrait; only the illustrated body comes from the sheet.
  $('victory-head').src=dance.head;sprite.dataset.character=dance.character;sprite.style.backgroundImage='url("'+dance.src+'")';sprite.style.aspectRatio=String(dance.ratio);sprite.setAttribute('aria-label',dance.label);
  $('victory-stage').hidden=false;$('overlay').classList.add('celebrating');fitVictoryDance();void sprite.offsetWidth;sprite.classList.add('is-dancing');
}
function preloadVictoryDances(){
  victoryDances.forEach((dance,side)=>{
    const image=new Image();image.fetchPriority='low';
    image.onload=()=>{dance.ready=true;dance.ratio=(image.naturalWidth/4)/(image.naturalHeight/(dance.rows||2));if(state.status==='over'&&danceWinner===side)showVictoryDance(side);};
    image.onerror=()=>{dance.ready=false;};image.src=dance.src;
  });
}

const POINT_MESSAGE_SECONDS=2, READY_SECONDS=1.5;
const tariffLines={
  trump:['+25% TARIFF!','RETALIATORY TARIFF!','BORDER TAX!','TAX THE BALL!','CUSTOMS FEES!','+50% TARIFF!','IMPORT THIS!','MAKE TARIFFS GREAT AGAIN!'],
  carney:['TARIFF REJECTED!','TAX-FREE POINT!','RETURN TO SENDER!','SORRY, NO DUTY!','MAPLE SYRUP > TARIFFS!','100% TARIFF REFUND!','FREE TRADE, NICE SHOT!','TAX THIS, EH!'],
  victory:['NO TAX ON VICTORY!','DUTY-FREE CHAMPION!','FREE TRADE WINS!','MAPLE POWER. ZERO FEES!','TARIFFS CANCELLED, EH!']
};
const tariffState={last:{trump:-1,carney:-1,victory:-1}};
function pickTariffLine(kind){
  const lines=tariffLines[kind],last=tariffState.last[kind];
  const index=last<0?Math.floor(Math.random()*lines.length):(last+1+Math.floor(Math.random()*(lines.length-1)))%lines.length;
  tariffState.last[kind]=index;return lines[index];
}
function pointAnnouncement(side){
  const announcement=$('announcement');announcement.replaceChildren();
  const label=document.createElement('span');label.className='point-label';label.textContent=side===0?'POINT CARNEY':'POINT TRUMP';announcement.append(label);
  const reply=document.createElement('strong');reply.className=side===0?'tax-reply':'tax-reply trump-tax';reply.textContent=pickTariffLine(side===0?'carney':'trump');announcement.append(reply);
}

const portraitFiles=['carney','trump'].map(name=>[0,1,2,3].map(stage=>'assets/'+name+(stage?'-damage-strong-'+stage:'')+'.png'));
const availablePortraits=new Set(portraitFiles.map(files=>files[0]));
const faceLayers=[[],[]];
function damageAppearance(points){
  // The first conceded point shows a complete bruised portrait immediately.
  const progress=[0,1,1.5,2,2.25,2.5,2.75,3][Math.round(clamp(points,0,7))],lower=Math.floor(progress);
  return{lower,upper:Math.min(3,lower+1),mix:progress-lower};
}
function setupDamagePortraits(){
  for(let side=0;side<2;side++){
    const name=side===0?'carney':'trump';
    for(const id of [name+'-face',name+'-avatar']){
      const base=$(id),layer=document.createElement('img');layer.className='damage-layer';layer.alt='';layer.setAttribute('aria-hidden','true');layer.style.opacity='0';layer.src=portraitFiles[side][0];base.parentElement.append(layer);faceLayers[side].push({base,layer});
    }
  }
  // Decode all variants early. A slow or missing asset never interrupts the match.
  const loads=portraitFiles.flatMap(files=>files.slice(1)).map(src=>new Promise(resolve=>{
    const img=new Image();img.onload=()=>{availablePortraits.add(src);updateDamagePortraits();resolve()};img.onerror=()=>resolve();img.src=src;
  }));
  Promise.all(loads).then(updateDamagePortraits);
  updateDamagePortraits();
}
function updateDamagePortraits(){
  for(let side=0;side<2;side++){
    // Damage follows points conceded, independently of human/computer assignment.
    const conceded=state.score[1-side],appearance=damageAppearance(conceded),files=portraitFiles[side];
    let lower=appearance.lower;while(lower>0&&!availablePortraits.has(files[lower]))lower--;
    const upper=availablePortraits.has(files[appearance.upper])?appearance.upper:lower;
    for(const {base,layer} of faceLayers[side]){
      const baseFile=files[lower],upperFile=files[upper];
      if(base.getAttribute('src')!==baseFile)base.src=baseFile;
      if(layer.getAttribute('src')!==upperFile)layer.src=upperFile;
      layer.style.transition=conceded===0?'none':'';
      layer.style.opacity=String(conceded===0||upper===lower?0:appearance.mix);
    }
    const description=conceded===0?'visage intact':conceded<=2?'œil au beurre noir et saignement de nez':conceded<=4?'yeux tuméfiés, bleus et égratignures':'œil gonflé, larges ecchymoses et saignement de nez';
    $(side===0?'carney-face':'trump-face').alt='Tête de '+(side===0?'Mark Carney':'Donald Trump')+' — '+description+' ('+conceded+' point'+(conceded>1?'s':'')+' encaissé'+(conceded>1?'s':'')+').';
  }
}

const historyKey='tariff-bash.matches.v1';
// Retain existing scores when upgrading from the original game name.
const legacyHistoryKey='head-to-head.matches.v1';
let historyAvailable=true,matchHistory=[];
function validMatch(m){return m&&Array.isArray(m.score)&&m.score.length===2&&m.score.every(n=>Number.isInteger(n)&&n>=0&&n<=7)&&Math.max(...m.score)===7&&Math.min(...m.score)<7&&['solo','duo'].includes(m.mode)&&[0,1].includes(m.computer)&&['easy','normal','hard'].includes(m.level)&&typeof m.date==='string'&&Number.isFinite(Date.parse(m.date));}
function loadHistory(){
  try{const saved=JSON.parse(localStorage.getItem(historyKey)||localStorage.getItem(legacyHistoryKey)||'[]');matchHistory=Array.isArray(saved)?saved.filter(validMatch).slice(0,10):[];}
  catch{matchHistory=[];}
  try{localStorage.setItem(historyKey,JSON.stringify(matchHistory));}catch{historyAvailable=false;}
  renderHistory();
}
function renderHistory(){
  const list=$('hall-list');list.replaceChildren();
  const levels={easy:'Détente',normal:'Classique',hard:'Intense'};
  matchHistory.forEach((match,index)=>{
    const winner=match.score[0]===7?0:1;
    const row=document.createElement('li');row.className='hall-row '+(winner===0?'carney-win':'trump-win');
    const rank=document.createElement('span');rank.className='hall-rank';rank.textContent=String(index+1).padStart(2,'0');
    const info=document.createElement('div');info.className='hall-info';
    const title=document.createElement('strong');title.textContent=names[winner]+' remporte le duel';
    const detail=document.createElement('span');detail.textContent=match.mode==='duo'?'À deux · Carney contre Trump':'Solo · Vous : '+names[1-match.computer]+' · '+levels[match.level];
    info.append(title,detail);
    const score=document.createElement('div');score.className='hall-score';score.setAttribute('aria-label','Carney '+match.score[0]+', Trump '+match.score[1]);
    for(let i=0;i<2;i++){const player=document.createElement('span');const label=document.createElement('small');label.textContent=names[i];const value=document.createElement('b');value.textContent=match.score[i];player.append(label,value);score.append(player);}
    const date=document.createElement('time');date.dateTime=match.date;date.textContent=new Intl.DateTimeFormat('fr-CA',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'}).format(new Date(match.date));
    row.append(rank,info,score,date);list.append(row);
  });
  $('hall-empty').hidden=matchHistory.length>0;$('hall-count').textContent=matchHistory.length+' / 10';
  $('hall-note').textContent=historyAvailable?'Résultats conservés sur ce navigateur · Du plus récent au plus ancien.':'Sauvegarde indisponible : les résultats restent visibles jusqu’à la fermeture de cette page.';
}
function recordMatch(){
  if(state.recorded)return;state.recorded=true;
  matchHistory.unshift({score:[...state.score],mode:state.mode,computer:state.computer,level:state.level,date:new Date().toISOString()});matchHistory=matchHistory.slice(0,10);
  try{localStorage.setItem(historyKey,JSON.stringify(matchHistory));historyAvailable=true;}catch{historyAvailable=false;}
  renderHistory();$('hall-update').textContent='Résultat ajouté au Hall of Fame : Carney '+state.score[0]+', Trump '+state.score[1]+'.';
}
function updateRoles(){
  $('left-role').textContent=state.mode==='duo'?'JOUEUR 1':state.computer===0?'ORDINATEUR':'VOUS';
  $('right-role').textContent=state.mode==='duo'?'JOUEUR 2':state.computer===1?'ORDINATEUR':'VOUS';
}

function resize(){
  const nextPortrait=effectivePortrait();
  if(nextPortrait!==portrait){keys.clear();pointers.clear();state.target=null;if(['playing','serving'].includes(state.status))pause();}
  fitDesktopCourt(nextPortrait);
  const rect=arena.getBoundingClientRect();
  portrait=nextPortrait;
  arena.classList.toggle('portrait',portrait);
  // Keep physics in court coordinates: Carney at the start, Trump at the end.
  // Portrait maps Carney to the bottom without rotating either portrait image.
  state.width=portrait?rect.height:rect.width;state.height=portrait?rect.width:rect.height;
  const dpr=Math.min(devicePixelRatio||1,2);canvas.width=Math.round(rect.width*dpr);canvas.height=Math.round(rect.height*dpr);
  state.ph=Math.min(portrait?78:rect.height<300?74:rect.width<600?82:110,state.height*.25);
  state.pw=state.ph*(portrait?1.22:.82);state.px=state.pw/2+(state.width<600?8:26);
  paddles.forEach(p=>{p.style.width=(portrait?state.ph:state.pw)+'px';p.style.height=(portrait?state.pw:state.ph)+'px'});
  state.y=state.y.map(y=>clamp(y,state.ph/2/state.height,1-state.ph/2/state.height));
  state.trail=[];state.particles=[];
  updateInstructions();fitVictoryDance();draw();
}
function updateInstructions(){
  const direction=portrait?'de gauche à droite':'de haut en bas';
  const camps=portrait?'Carney en bas · Trump en haut':'Carney à gauche · Trump à droite';
  const inputHint=desktopPointer.matches?(portrait?'← → ou A / D · Souris':'↑ ↓ ou W / S · Souris'):'Glissez '+direction;
  $('instructions').innerHTML='<span class="instruction-label">'+(portrait?'PORTRAIT':'PAYSAGE')+'</span><span>'+
    (state.mode==='solo'?'Vous : '+names[humanSide()]+' · '+inputHint:(desktopPointer.matches?(portrait?'A / D et ← →':'W / S et ↑ ↓'):'Un doigt par camp')+' · '+camps)+'</span>';
  arena.setAttribute('aria-label','Terrain de Pong. '+camps+'. Glissez '+direction+'. '+
    (portrait?'Clavier : A et D pour Carney, flèches gauche et droite pour Trump.':'Clavier : W et S pour Carney, flèches haut et bas pour Trump.')+' En solo, les flèches contrôlent '+names[humanSide()]+'. Espace pour la pause.');
  $('start-tip').textContent=portrait?'Glissez de gauche à droite':'Glissez de haut en bas';
}

function tone(freq,duration=.07,type='sine',vol=.055){
  if(!state.sound)return;
  try{audioContext ||= new (window.AudioContext||window.webkitAudioContext)();if(audioContext.state==='suspended')audioContext.resume();const o=audioContext.createOscillator(),g=audioContext.createGain();o.type=type;o.frequency.setValueAtTime(freq,audioContext.currentTime);g.gain.setValueAtTime(vol,audioContext.currentTime);g.gain.exponentialRampToValueAtTime(.001,audioContext.currentTime+duration);o.connect(g);g.connect(audioContext.destination);o.start();o.stop(audioContext.currentTime+duration)}catch{}
}
function updateScore(){scoreEls.forEach((e,i)=>e.textContent=state.score[i]);updateDamagePortraits();}
function showPanel(kicker,title,copy,button){stopVictoryDance();$('panel-kicker').textContent=kicker;$('panel-title').innerHTML=title;$('panel-copy').textContent=copy;$('play').innerHTML=button+' <span aria-hidden="true">↗</span>';$('overlay').hidden=false;updateInstructions();}
function controls(){const running=['playing','serving','paused'].includes(state.status);$('computer').disabled=running||state.mode==='duo';$('computer-choice').hidden=state.mode==='duo'||running;$('pause').disabled=!running;$('pause').innerHTML=state.status==='paused'?'<span aria-hidden="true">▷</span> Reprendre':'<span aria-hidden="true">Ⅱ</span> Pause';$('solo').disabled=running;$('duo').disabled=running;$('difficulty').disabled=running||state.mode==='duo';$('rally-counter').hidden=state.rally<2;$('match-state').textContent=state.status==='paused'?'PAUSE':state.status==='over'?'TERMINÉ':'7 POINTS';}
function reset(){stopVictoryDance();paddles.forEach(p=>p.classList.remove('damage-pop'));state.recorded=false;state.score=[0,0];state.y=[.5,.5];state.rally=0;state.elapsed=0;state.target=null;state.trail=[];state.particles=[];state.ball={x:.5,y:.5,vx:0,vy:0};keys.clear();pointers.clear();updateScore();}
function start(){if(state.status==='paused'){pause();return}reset();state.next=Math.random()<.5?-1:1;$('overlay').hidden=true;serve();arena.focus({preventScroll:true});tone(440,.12);}
function serve(delay=READY_SECONDS){state.status='serving';state.ball={x:.5,y:.5,vx:0,vy:0};state.countdown=delay;state.rally=0;state.trail=[];controls();}
function launch(){const angle=(Math.random()-.5)*.85;const speed=state.width<600?300:450;state.ball.vx=state.next*Math.cos(angle)*speed;state.ball.vy=Math.sin(angle)*speed;state.status='playing';$('announcement').textContent='';}
function pause(){if(state.status==='playing'||state.status==='serving'){state.resumeStatus=state.status;state.status='paused';keys.clear();pointers.clear();showPanel('ON SOUFFLE UN PEU','Pause diplomatique.', 'Le match vous attend.','Reprendre le match');$('announcement').textContent='';}else if(state.status==='paused'){state.status=state.resumeStatus;$('overlay').hidden=true;arena.focus({preventScroll:true});}controls();}
function setMode(mode){if(!['ready','over'].includes(state.status))return;state.mode=mode;state.status='ready';reset();$('solo').classList.toggle('selected',mode==='solo');$('duo').classList.toggle('selected',mode==='duo');$('solo').setAttribute('aria-pressed',String(mode==='solo'));$('duo').setAttribute('aria-pressed',String(mode==='duo'));updateRoles();showPanel('PLACE AU DUEL','Moins de discours.<br>Plus de rebonds.',mode==='solo'?'Vous jouez '+names[humanSide()]+'. Faites parler les réflexes.':'Deux joueurs. Un écran. À chacun son camp.','Lancer le match');updateInstructions();controls();}
function goal(side){
  if(!['playing','serving'].includes(state.status))return;
  state.score[side]++;updateScore();
  const damaged=paddles[1-side];damaged.classList.remove('damage-pop');void damaged.offsetWidth;damaged.classList.add('damage-pop');
  tone(side===0?660:220,.25,'triangle');scoreEls[side].classList.remove('flash');void scoreEls[side].offsetWidth;scoreEls[side].classList.add('flash');state.next=side===0?1:-1;
  if(state.score[side]>=7){
    state.status='over';recordMatch();$('announcement').textContent='';
    const title=side===0?'Carney remporte<br> le duel.<span class="victory-quip">'+pickTariffLine('victory')+'</span>':'Trump remporte<br> le duel.<span class="victory-quip trump-tax">'+pickTariffLine('trump')+'</span>';
    showPanel('FIN DU SOMMET',title,state.score[0]+' — '+state.score[1]+'. Une revanche ?','Prendre sa revanche');showVictoryDance(side);controls();
    window.TariffPerfectVictory?.start({winner:side,score:state.score,enabled:state.sound,context:audioContext});
  }else{serve(POINT_MESSAGE_SECONDS+READY_SECONDS);pointAnnouncement(side);}
}

function sparks(x,y,color){if(reduced)return;for(let n=0;n<12;n++)state.particles.push({x,y,vx:(Math.random()-.5)*220,vy:(Math.random()-.5)*220,life:.4,max:.4,color});}
function movePlayers(dt){
  const h=state.height,margin=state.ph/2/h;
  const backward=portrait?'arrowleft':'arrowup',forward=portrait?'arrowright':'arrowdown';
  const letters=Number(keys.has('s')||(portrait&&keys.has('d')))-Number(keys.has('w')||keys.has('z')||(portrait&&(keys.has('a')||keys.has('q'))));
  const arrows=Number(keys.has(forward))-Number(keys.has(backward));
  if(state.mode==='solo'){
    const human=humanSide(),dir=letters+arrows;
    if(dir){state.y[human]+=Math.sign(dir)*540*dt/h;state.target=null;}
    else if(state.target!==null)state.y[human]=state.target;
  }else{state.y[0]+=letters*540*dt/h;state.y[1]+=arrows*540*dt/h;}
  for(const pointer of pointers.values())if(state.mode==='duo'||pointer.side===humanSide())state.y[pointer.side]=pointer.y;
  if(state.mode==='solo'){
    const ai=state.computer,settings={easy:{speed:220,error:.17},normal:{speed:330,error:.095},hard:{speed:470,error:.04}}[state.level];
    const approaching=ai===0?state.ball.vx<0:state.ball.vx>0;
    const target=approaching?state.ball.y+Math.sin(state.elapsed*2.7)*settings.error:.5;
    state.y[ai]+=clamp(target-state.y[ai],-settings.speed*dt/h,settings.speed*dt/h);
  }
  state.y=state.y.map(y=>clamp(y,margin,1-margin));
}

function physics(dt){
  const b=state.ball,w=state.width,h=state.height,r=w<600?6:7;
  // Substeps prevent a fast ball from crossing a paddle between collision checks.
  const steps=Math.max(1,Math.ceil(Math.hypot(b.vx,b.vy)*dt/5)),step=dt/steps;
  for(let n=0;n<steps;n++){
    b.x+=b.vx*step/w;b.y+=b.vy*step/h;
    if(b.y*h<r&&b.vy<0){b.y=r/h;b.vy*=-1;tone(240,.04)}
    if(b.y*h>h-r&&b.vy>0){b.y=1-r/h;b.vy*=-1;tone(240,.04)}
    for(let i=0;i<2;i++){
      if((i===0&&b.vx>=0)||(i===1&&b.vx<=0))continue;
      const cx=i===0?state.px:w-state.px, cy=state.y[i]*h;
      // An ellipse follows the illustrated head instead of an invisible long racket.
      const dy=(b.y*h-cy)/(state.ph*.43+r);if(Math.abs(dy)>1)continue;
      const edge=(state.pw*.42+r)*Math.sqrt(1-dy*dy);
      const bx=b.x*w;if(Math.abs(bx-cx)>edge)continue;
      const angle=clamp(dy,-.9,.9)*1.08;
      const cap=w<600?640:1000,speed=Math.min(Math.hypot(b.vx,b.vy)*1.055,cap);
      b.vx=(i===0?1:-1)*Math.cos(angle)*speed;b.vy=Math.sin(angle)*speed;
      b.x=(cx+(i===0?1:-1)*(edge+1))/w;
      state.rally++;$('rally').textContent=state.rally;$('rally-counter').hidden=false;
      tone(i===0?480:360,.06,'triangle');sparks(bx,b.y*h,i===0?'#c5ff73':'#ff806a');
      paddles[i].classList.add('hit');setTimeout(()=>paddles[i].classList.remove('hit'),100);
    }
    if(b.x*w<-r){goal(1);return}if(b.x*w>w+r){goal(0);return}
  }
  if(!reduced){state.trail.push({x:b.x*w,y:b.y*h});if(state.trail.length>13)state.trail.shift();}
}
function draw(){const w=state.width,h=state.height,dpr=Math.min(devicePixelRatio||1,2);
  ctx.setTransform(1,0,0,1,0,0);ctx.clearRect(0,0,canvas.width,canvas.height);
  if(portrait)ctx.setTransform(0,-dpr,dpr,0,0,w*dpr);else ctx.setTransform(dpr,0,0,dpr,0,0);
  paddles.forEach((p,i)=>{const cx=i===0?state.px:w-state.px,cy=state.y[i]*h;
    const x=portrait?cy-state.ph/2:cx-state.pw/2,y=portrait?w-cx-state.pw/2:cy-state.ph/2;
    p.style.transform=`translate3d(${x}px,${y}px,0)`;});
  if(['playing','serving','paused'].includes(state.status)){
    state.trail.forEach((p,i)=>{ctx.fillStyle=`rgba(213,247,187,${i/state.trail.length*.22})`;ctx.beginPath();ctx.arc(p.x,p.y,(i/state.trail.length)*5,0,Math.PI*2);ctx.fill();});
    ctx.fillStyle='#f6ffe8';ctx.shadowColor='#d8ff9d';ctx.shadowBlur=18;ctx.beginPath();ctx.arc(state.ball.x*w,state.ball.y*h,w<600?6:7,0,Math.PI*2);ctx.fill();ctx.shadowBlur=0;
  }
  for(const p of state.particles){ctx.globalAlpha=Math.max(0,p.life/p.max);ctx.fillStyle=p.color;ctx.fillRect(p.x,p.y,3,3);}ctx.globalAlpha=1;
}
function frame(time){const dt=Math.min((time-lastTime)/1000||0,.035);lastTime=time;
  if(state.status==='playing'||state.status==='serving'){
    state.elapsed+=dt;movePlayers(dt);
    if(state.status==='serving'){state.countdown-=dt;if(state.countdown<READY_SECONDS)$('announcement').textContent='PRÊTS ?';if(state.countdown<=0)launch();}else physics(dt);
    state.particles=state.particles.filter(p=>{p.life-=dt;p.x+=p.vx*dt;p.y+=p.vy*dt;return p.life>0});
  }draw();requestAnimationFrame(frame);
}
orientationButtons.forEach(button=>button.addEventListener('click',()=>{courtPreference=button.dataset.orientation;try{localStorage.setItem('tariff-bash.orientation',courtPreference);}catch{}resize();}));
window.addEventListener('resize',resize);
desktopPointer.addEventListener('change',resize);
windowPortrait.addEventListener('change',resize);
$('computer').addEventListener('change',e=>{if(!['ready','over'].includes(state.status))return;const side=Number(e.target.value);if(![0,1].includes(side))return;state.computer=side;setMode(state.mode);});
$('play').addEventListener('click',start);$('pause').addEventListener('click',pause);
$('restart').addEventListener('click',()=>{state.status='ready';reset();setMode(state.mode);$('announcement').textContent='';});
$('solo').addEventListener('click',()=>setMode('solo'));$('duo').addEventListener('click',()=>setMode('duo'));$('difficulty').addEventListener('change',e=>state.level=e.target.value);
$('sound').addEventListener('click',()=>{state.sound=!state.sound;$('sound').setAttribute('aria-label',state.sound?'Couper le son':'Activer le son');$('sound').setAttribute('aria-pressed',String(state.sound));$('sound-waves').setAttribute('d',state.sound?'M15 8a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14':'m16 9 6 6m0-6-6 6');tone(550,.1);window.TariffPerfectVictory?.setSound(state.sound,audioContext)});
document.addEventListener('keydown',e=>{if(document.documentElement.classList.contains('intro-active'))return;if(e.target instanceof HTMLSelectElement)return;const k=e.key.toLowerCase();if(['arrowup','arrowdown','arrowleft','arrowright','w','s','z','a','q','d',' '].includes(k)){if(e.target instanceof HTMLButtonElement&&k===' ')return;e.preventDefault();if(k===' '){if(!e.repeat)pause();}else keys.add(k);}if(k==='enter'&&!(e.target instanceof HTMLButtonElement)&&['ready','paused','over'].includes(state.status)){e.preventDefault();start();}});
document.addEventListener('keyup',e=>keys.delete(e.key.toLowerCase()));
function point(e){const r=arena.getBoundingClientRect();return{
  side:state.mode==='solo'?humanSide():portrait?(e.clientY-r.top>=r.height/2?0:1):(e.clientX-r.left<r.width/2?0:1),
  y:clamp(portrait?(e.clientX-r.left)/r.width:(e.clientY-r.top)/r.height,0,1)
}}
arena.addEventListener('pointerdown',e=>{if(!['playing','serving'].includes(state.status))return;e.preventDefault();arena.focus({preventScroll:true});arena.setPointerCapture(e.pointerId);pointers.set(e.pointerId,point(e));});
arena.addEventListener('pointermove',e=>{if(!['playing','serving'].includes(state.status))return;const p=point(e);if(pointers.has(e.pointerId)){p.side=pointers.get(e.pointerId).side;pointers.set(e.pointerId,p);}else if(e.pointerType==='mouse'&&state.mode==='solo')state.target=p.y;});
for(const name of ['pointerup','pointercancel','lostpointercapture'])arena.addEventListener(name,e=>{const p=pointers.get(e.pointerId);if(p&&p.side===humanSide())state.target=null;pointers.delete(e.pointerId)});
window.addEventListener('blur',()=>{keys.clear();pointers.clear();if(state.status==='playing'||state.status==='serving')pause()});
document.addEventListener('visibilitychange',()=>{if(document.hidden&&(state.status==='playing'||state.status==='serving'))pause()});
preloadVictoryDances();setupDamagePortraits();loadHistory();updateRoles();new ResizeObserver(resize).observe(arena);resize();controls();requestAnimationFrame(frame);

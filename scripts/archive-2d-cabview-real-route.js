import { TrainSimulation } from './dynamics.js';
import { PROCEDURE, procedureState, scoreRun } from './procedure.js';
import { MstsRouteScene } from './mstsRouteScene.js?rev=neijiangnan-full-section-v6-20260915';

const $ = (q) => document.querySelector(q);
const sim = new TrainSimulation();
const overlay = $('#overlay');
const routeScene = new MstsRouteScene($('#route-scene'));
const views = { front: 'HXD1C_front.png', left: 'HXD1C_left.png', right: 'HXD1C_right.png' };
const debugMode = new URLSearchParams(location.search).get('debug') === '1';
const keys = [['control-power','控制电源'],['lkj','LKJ确认'],['panto','前受电弓'],['main-breaker','主断合'],['compressor','压缩机'],['parking','停放缓解'],['authority','信号确认'],['headlight','前照灯'],['horn','风笛'],['reset','警惕/复位']];
let selectedView = 'front';
let activeDrag = null;
let switchPanelRoot = null;
let powerCabinetRoot = null;
let lkjRoot = null;
const hornAudio = new Audio('./assets/audio/HXD1C-horn.wav');
hornAudio.preload = 'auto'; hornAudio.loop = true;
const lkjKeyAudio = new Audio('./assets/audio/lkj-key.wav');
const lkjStartAudio = new Audio('./assets/audio/lkj-start.wav');
const switchDefs = [
  { id:'main-breaker', label:'主断路器', type:'short', x:15.6, read:s=>s.mainBreaker, on:'合', off:'分', momentary:true },
  { id:'panto', label:'受电弓', type:'short', x:24.1, read:s=>s.panto, on:'升', off:'降', momentary:true },
  { id:'compressor', label:'空压机', type:'long', x:32.5, read:s=>s.compressor, on:'投入', off:'停止', momentary:true },
  { id:'headlight', label:'前照灯', type:'round', x:40.6, read:s=>s.headlight, on:'开', off:'关' },
  { id:'auxiliary-light', label:'辅照灯', type:'slider', x:51.8, read:s=>s.auxiliaryLight, on:'全', off:'0' },
  { id:'marker-front', label:'标志灯（前）', type:'short', x:63.0, read:s=>s.markerFront, states:['0','white','red'] },
  { id:'marker-rear', label:'标志灯（后）', type:'short', x:72.2, read:s=>s.markerRear, states:['0','white','red'] },
  { id:'cab-light', label:'司机室灯', type:'long', x:81.5, read:s=>s.cabLight, on:'开', off:'关' },
];
const pct = (value,total) => `${value / total * 100}%`;
function frame(el, index, cols, rows) { const col = index % cols; const row = Math.floor(index / cols); el.style.backgroundPosition = `${cols === 1 ? 0 : col / (cols - 1) * 100}% ${rows === 1 ? 0 : row / (rows - 1) * 100}%`; }
function makeSprite(id, image, x, y, w, h, cols, rows, label) { const el=document.createElement('div'); el.className=`sprite ${id}`; el.dataset.id=id; el.title=label; el.style.left=pct(x,640); el.style.top=pct(y,480); el.style.width=pct(w,640); el.style.height=pct(h,480); el.style.backgroundImage=`url("./assets/archive-cabview/${image}")`; el.style.backgroundSize=`${cols*100}% ${rows*100}%`; overlay.append(el); return el; }
function makeTouchTarget(id, x, y, w, h, label) { const el=document.createElement('button'); el.type='button'; el.className=`touch-target ${id==='direction'?'direction-target':''}`; el.dataset.dragTarget=id; el.setAttribute('aria-label',label); el.style.left=pct(x,640); el.style.top=pct(y,480); el.style.width=pct(w,640); el.style.height=pct(h,480); overlay.append(el); return el; }
function makeHotspot(id,label,x,y,w,h) { const el=document.createElement('button'); el.className='hotspot'; el.dataset.id=id; el.dataset.label=label; el.style.left=pct(x,640); el.style.top=pct(y,480); el.style.width=pct(w,640); el.style.height=pct(h,480); el.addEventListener('click',()=>command(id)); overlay.append(el); return el; }
function makePhysicalButton(id,label,x,y,w,h,action) { const el=document.createElement('button'); el.type='button'; el.className=`physical-control-hotspot ${id}`; el.dataset.label=label; el.setAttribute('aria-label',label); el.style.left=pct(x,640); el.style.top=pct(y,480); el.style.width=pct(w,640); el.style.height=pct(h,480); if(action)action(el); else el.addEventListener('click',()=>command(id)); overlay.append(el); return el; }
function makeNeedle(id,image,x,y,w,h,pivot,start,end,kind='') { const el=document.createElement('img'); el.className=`needle ${kind}`; el.dataset.id=id; el.dataset.start=start; el.dataset.end=end; el.src=`./assets/archive-cabview/${image}`; el.alt=''; el.style.left=pct(x,640); el.style.top=pct(y,480); el.style.width=pct(w,640); el.style.height=pct(h,480); el.style.transformOrigin=`50% ${pivot / h * 100}%`; overlay.append(el); return el; }
function makeBar(id,x,y,w,h,color='#5dffd5') { const el=document.createElement('div'); el.className='gauge-bar'; el.dataset.id=id; el.style.left=pct(x,640); el.style.top=pct(y,480); el.style.width=pct(w,640); el.style.height=pct(h,480); el.style.background=color; overlay.append(el); return el; }
function makeDigital(id,x,y,w,h,kind='') { const el=document.createElement('div'); el.className=`digital ${kind}`; el.dataset.id=id; el.style.left=pct(x,640); el.style.top=pct(y,480); el.style.width=pct(w,640); el.style.height=pct(h,480); overlay.append(el); return el; }
function makeStateSprite(id,image,x,y,w,h,cols,rows) { const el=document.createElement('div'); el.className=id==='signal'?'signal-sprite':'panto-sprite'; el.dataset.id=id; el.style.left=pct(x,640); el.style.top=pct(y,480); el.style.width=pct(w,640); el.style.height=pct(h,480); el.style.backgroundImage=`url("./assets/archive-cabview/${image}")`; el.style.backgroundSize=`${cols*100}% ${rows*100}%`; overlay.append(el); return el; }
function setNeedle(el,value,max) { const ratio=Math.max(0,Math.min(1,value/max)); const start=Number(el.dataset.start); const end=Number(el.dataset.end); el.style.transform=`rotate(${start+(end-start)*ratio}deg)`; }
// 原贴图从前推端到后拉端依次为：牵引最大(frame 0) → 零位(frame 7) → 电制动最大(frame 15)。
function tractionFrame(value) { return value > 0 ? Math.max(0,7-Math.min(7,value)) : value === 0 ? 7 : Math.min(15,7+Math.min(8,Math.abs(value))); }
let elements={};
function startDrag(id, el, event) {
  event.preventDefault();
  const range=id==='traction'?15:5;
  activeDrag={id,pointerId:event.pointerId,startY:event.clientY,start:sim.state[id==='auto'?'autoBrake':id==='independent'?'independentBrake':'traction'],pixelsPerStep:Math.max(8,el.getBoundingClientRect().height/range)};
  try{event.currentTarget.setPointerCapture?.(event.pointerId);}catch{ /* 部分 iOS WebKit 不开放指针捕获，窗口级监听仍可完成拖动。 */ }
}
function createFront() {
  overlay.replaceChildren(); elements={};
  elements.auto=makeSprite('auto-brake','HXD1C_DZ.png',35,341,45,60,4,3,'自动制动阀（拖动）');
  elements.independent=makeSprite('independent-brake','HXD1C_XZ.png',138,341,35,60,4,3,'单独制动阀（拖动）');
  elements.traction=makeSprite('traction','HXD1C_GL.png',464,345,46,81,2,8,'牵引/电制动手柄（拖动）');
  elements.direction=makeSprite('direction','HXD1C_HX.png',530,366,60,40,3,1,'方向手柄（点击切换）'); elements.direction.classList.add('direction'); elements.direction.addEventListener('click',()=>command('direction'));
  // 原 CVF 没有为中部板钮定义鼠标热区；不再用猜测坐标冒充真实按钮。
  // 电气与辅助设备通过右侧经过命名校验的操作按钮控制，车内只保留 CVF 明确定义的复位热区。
  elements.reset=makeHotspot('reset','警惕/复位',386,312,32,32);
  makePhysicalButton('power-cabinet','转身查看控制电源柜',0,252,42,112,(el)=>el.addEventListener('click',openPowerCabinet));
  makePhysicalButton('lkj-device','放大 LKJ 监控装置',210,226,101,94,(el)=>el.addEventListener('click',openLkj));
  elements.parkingApply=makePhysicalButton('parking-apply','停放制动施加（红）',157,350,21,29);
  elements.parkingRelease=makePhysicalButton('parking-release','停放制动缓解（绿）',179,350,22,29);
  elements.hornButton=makePhysicalButton('horn-button','风笛（按住）',577,408,37,39,(el)=>{
    const stop=()=>{hornAudio.pause();hornAudio.currentTime=0;command('horn-stop');el.classList.remove('pressed');};
    el.addEventListener('pointerdown',(event)=>{event.preventDefault();el.classList.add('pressed');command('horn-start');hornAudio.currentTime=0;hornAudio.play().catch(()=>{});try{el.setPointerCapture(event.pointerId);}catch{}});
    el.addEventListener('pointerup',stop);el.addEventListener('pointercancel',stop);el.addEventListener('lostpointercapture',stop);
  });
  const switchPanelTrigger=document.createElement('button');
  switchPanelTrigger.type='button';switchPanelTrigger.className='switch-panel-trigger';switchPanelTrigger.setAttribute('aria-label','放大中部板钮面板');
  switchPanelTrigger.style.left=pct(232,640);switchPanelTrigger.style.top=pct(337,480);switchPanelTrigger.style.width=pct(165,640);switchPanelTrigger.style.height=pct(43,480);
  switchPanelTrigger.addEventListener('click',(event)=>{event.preventDefault();openSwitchPanel();});overlay.append(switchPanelTrigger);
  // 原 CVF 中的动态指针：两套风压表、速度表、网压与四路电流条。
  elements.speedNeedle=makeNeedle('speed-needle','HXD1C_SDZ.png',493,277,3,18,2,68,300,'speed');
  elements.mainNeedle=makeNeedle('main-needle','HXD1C_red.png',154,253,7,21,14,230,100);
  elements.pipeNeedle=makeNeedle('pipe-needle','HXD1C_black.png',154,253,7,21,14,230,130);
  elements.eqNeedle=makeNeedle('eq-needle','HXD1C_black.png',162,295,7,21,14,224,136);
  elements.cylNeedle=makeNeedle('cyl-needle','HXD1C_red.png',162,295,7,21,14,230,130);
  elements.mainNeedle2=makeNeedle('main-needle-2','HXD1C_PPW.png',75,299,7,18,1,3,358);
  elements.pipeNeedle2=makeNeedle('pipe-needle-2','HXD1C_PPR.png',75,299,7,18,1,3,336);
  elements.eqNeedle2=makeNeedle('eq-needle-2','HXD1C_PPW.png',36,312,7,18,1,3,336);
  elements.cylNeedle2=makeNeedle('cyl-needle-2','HXD1C_PPR.png',36,312,7,18,1,3,300);
  elements.voltageBar=makeBar('voltage-bar',351,266,4,30,'#56e9aa');
  elements.currentBars=[makeBar('current-1',362,266,4,30),makeBar('current-2',370,266,4,30),makeBar('current-3',381,266,4,30),makeBar('current-4',388,266,4,30)];
  elements.speedDigital=makeDigital('speed-digital',229,251,20,7);
  elements.limitDigital=makeDigital('limit-digital',244,251,20,7,'limit');
  elements.clockDigital=makeDigital('clock-digital',230,268,45,10,'clock');
  elements.pantoDisplay=makeStateSprite('panto','HXD1C_DG.png',410,295,7,8,1,2);
  elements.signal=makeStateSprite('signal','HXD1C_jx.png',540,0,100,162,4,2);
  for(const [id,el] of [['auto',elements.auto],['independent',elements.independent],['traction',elements.traction]]) el.addEventListener('pointerdown',(event)=>startDrag(id,el,event));
  // 原图控件保持原比例，另加透明的大触控区，避免手机上手指遮住并按不中小手柄。
  const touchControls=[
    ['auto',elements.auto,23,326,70,91,'拖动自动制动阀'],
    ['independent',elements.independent,122,326,66,91,'拖动单独制动阀'],
    ['traction',elements.traction,447,326,80,116,'拖动牵引和电制动手柄'],
  ];
  for(const [id,target,x,y,w,h,label] of touchControls){const zone=makeTouchTarget(id,x,y,w,h,label);zone.addEventListener('pointerdown',(event)=>startDrag(id,target,event));}
  const directionZone=makeTouchTarget('direction',516,350,88,70,'切换方向手柄');
  directionZone.addEventListener('click',(event)=>{event.preventDefault();command('direction');});
  elements.traction.addEventListener('dblclick',(event)=>{event.preventDefault();command('traction',0);});
}
function command(id,value) { const s=sim.state; if(id==='direction'&&value===undefined) value=s.direction==='N'?'F':s.direction==='F'?'R':'N'; return sim.command(id,value); }
function buildPowerCabinet(){
  const root=document.createElement('div');root.className='device-modal power-cabinet-modal';root.setAttribute('aria-hidden','true');
  root.innerHTML=`<div class="device-shell power-cabinet-shell" role="dialog" aria-modal="true" aria-label="HXD1C控制电源柜"><div class="device-head"><div><strong>HXD1C 控制电源柜</strong><span>按发车准备要求依次接通三项电源</span></div><button type="button" class="device-close" aria-label="关闭">×</button></div><div class="cabinet-face"><div class="cabinet-meter"><span>控制电压</span><b data-cabinet-voltage>0 V</b></div><div class="cabinet-lamps"><i data-lamp="110"></i><span>110V</span><i data-lamp="24"></i><span>24V</span></div><div class="cabinet-switches"></div><p class="cabinet-note">三项均接通后，司机室控制电源才建立。任何一项断开，主断与空压机均退出。</p></div></div>`;
  const defs=[['controlPowerOutput','控制电源输出'],['parkingPower','停放制动电源'],['output24V','24V 输出']];
  const box=root.querySelector('.cabinet-switches');
  for(const [key,label] of defs){const b=document.createElement('button');b.type='button';b.className='cabinet-switch';b.dataset.powerKey=key;b.innerHTML=`<span class="cabinet-toggle"><i></i></span><strong>${label}</strong><em>断开</em>`;b.addEventListener('click',()=>{const accepted=command('power-cabinet-switch',{key,enabled:!sim.state[key]});if(accepted)navigator.vibrate?.(18);syncPowerCabinet(sim.state);});box.append(b);}
  root.querySelector('.device-close').addEventListener('click',closePowerCabinet);root.addEventListener('click',(event)=>{if(event.target===root)closePowerCabinet();});document.body.append(root);powerCabinetRoot=root;syncPowerCabinet(sim.state);
}
function syncPowerCabinet(state){if(!powerCabinetRoot)return;for(const b of powerCabinetRoot.querySelectorAll('.cabinet-switch')){const on=Boolean(state[b.dataset.powerKey]);b.classList.toggle('on',on);b.querySelector('em').textContent=on?'接通':'断开';b.setAttribute('aria-pressed',String(on));}powerCabinetRoot.querySelector('[data-cabinet-voltage]').textContent=state.powerOn?'110 V':'0 V';powerCabinetRoot.querySelector('[data-lamp="110"]').classList.toggle('on',state.controlPowerOutput&&state.parkingPower);powerCabinetRoot.querySelector('[data-lamp="24"]').classList.toggle('on',state.output24V);}
function openPowerCabinet(){if(!powerCabinetRoot)buildPowerCabinet();closeLkj();closeSwitchPanel();powerCabinetRoot.classList.add('open');powerCabinetRoot.setAttribute('aria-hidden','false');document.body.classList.add('device-panel-active');syncPowerCabinet(sim.state);}
function closePowerCabinet(){if(!powerCabinetRoot)return;powerCabinetRoot.classList.remove('open');powerCabinetRoot.setAttribute('aria-hidden','true');document.body.classList.remove('device-panel-active');}

const lkjFields=[['driverId','司机号'],['assistantId','副司机号'],['section','区段号'],['station','车站号'],['trainNo','车次'],['trainType','列车种类'],['weight','总重（t）'],['cars','辆数'],['length','计长']];
let lkjDraft={};let lkjFieldIndex=0;let lkjPhase='boot';
function buildLkj(){
  const root=document.createElement('div');root.className='device-modal lkj-modal';root.setAttribute('aria-hidden','true');
  root.innerHTML=`<div class="device-shell lkj-shell" role="dialog" aria-modal="true" aria-label="LKJ2000监控装置"><div class="device-head"><div><strong>LKJ2000 监控装置</strong><span>输入参数并核对运行揭示</span></div><button type="button" class="device-close" aria-label="关闭">×</button></div><div class="lkj-device"><img src="./assets/lkj/LKJ2000.png" alt="LKJ2000设备面板"><div class="lkj-screen"></div><div class="lkj-keypad"></div></div></div>`;
  root.querySelector('.device-close').addEventListener('click',closeLkj);root.addEventListener('click',(event)=>{if(event.target===root)closeLkj();});document.body.append(root);lkjRoot=root;renderLkj();
}
function playLkjKey(){try{lkjKeyAudio.currentTime=0;lkjKeyAudio.play().catch(()=>{});}catch{}}
function lkjButton(label,action,kind=''){const b=document.createElement('button');b.type='button';b.textContent=label;b.className=kind;b.addEventListener('click',()=>{playLkjKey();action();});return b;}
function renderLkj(){
  if(!lkjRoot)return;const screen=lkjRoot.querySelector('.lkj-screen');const keypad=lkjRoot.querySelector('.lkj-keypad');keypad.replaceChildren();
  if(!sim.state.powerOn){screen.innerHTML='<b>设备无电</b><span>请先完成控制电源柜三项操作</span>';return;}
  if(sim.state.lkjConfirmed){screen.innerHTML=`<b>监控状态</b><span>车次 ${sim.state.lkjData?.trainNo||'—'}　揭示已确认</span><strong class="lkj-ok">LKJ 监控投入</strong>`;keypad.append(lkjButton('关闭',closeLkj,'wide'));return;}
  if(lkjPhase==='boot'){screen.innerHTML='<b>LKJ2000</b><span>设备自检正常</span><strong>请选择参数设定</strong>';keypad.append(lkjButton('参数设定',()=>{lkjPhase='edit';lkjFieldIndex=0;renderLkj();},'wide primary'));return;}
  if(lkjPhase==='edit'){
    const [key,label]=lkjFields[lkjFieldIndex];const value=lkjDraft[key]||'';screen.innerHTML=`<b>参数输入 ${lkjFieldIndex+1}/${lkjFields.length}</b><span>${label}</span><strong class="lkj-input">${value||'_'}</strong>`;
    for(const n of ['1','2','3','4','5','6','7','8','9','0'])keypad.append(lkjButton(n,()=>{lkjDraft[key]=(lkjDraft[key]||'')+n;renderLkj();}));
    keypad.append(lkjButton('删除',()=>{lkjDraft[key]=value.slice(0,-1);renderLkj();},'warn'));keypad.append(lkjButton(lkjFieldIndex===lkjFields.length-1?'核对':'下一项',()=>{if(!value){screen.classList.add('error');setTimeout(()=>screen.classList.remove('error'),250);return;}if(lkjFieldIndex<lkjFields.length-1){lkjFieldIndex+=1;renderLkj();}else{lkjPhase='review';renderLkj();}},'primary'));return;
  }
  if(lkjPhase==='review'){screen.innerHTML=`<b>参数核对</b><div class="lkj-review">${lkjFields.map(([key,label])=>`<span>${label}</span><strong>${lkjDraft[key]||'—'}</strong>`).join('')}</div>`;keypad.append(lkjButton('返回修改',()=>{lkjPhase='edit';renderLkj();},'wide'));keypad.append(lkjButton('参数确认',()=>{lkjPhase='reveal';renderLkj();},'wide primary'));return;}
  screen.innerHTML='<b>运行揭示查询</b><span>揭示条目 3 条，已完成核对</span><strong>确认后投入 LKJ 监控</strong>';keypad.append(lkjButton('返回参数',()=>{lkjPhase='review';renderLkj();},'wide'));keypad.append(lkjButton('揭示确认',()=>{if(command('lkj-confirm',lkjDraft)){lkjPhase='done';renderLkj();}},'wide primary'));
}
function openLkj(){if(!lkjRoot)buildLkj();closePowerCabinet();closeSwitchPanel();lkjPhase=sim.state.lkjConfirmed?'done':'boot';lkjDraft=sim.state.lkjData&&!sim.state.lkjData.debug?{...sim.state.lkjData}:{};lkjRoot.classList.add('open');lkjRoot.setAttribute('aria-hidden','false');document.body.classList.add('device-panel-active');if(sim.state.powerOn){lkjStartAudio.currentTime=0;lkjStartAudio.play().catch(()=>{});}renderLkj();}
function closeLkj(){if(!lkjRoot)return;lkjRoot.classList.remove('open');lkjRoot.setAttribute('aria-hidden','true');document.body.classList.remove('device-panel-active');}
function closeDevicePanels(){closeSwitchPanel();closePowerCabinet();closeLkj();hornAudio.pause();hornAudio.currentTime=0;if(sim.state.hornActive)command('horn-stop');}
function buildSwitchPanel(){
  const root=document.createElement('div');root.id='switch-panel-modal';root.className='switch-panel-modal';root.setAttribute('aria-hidden','true');
  root.innerHTML=`<div class="switch-panel-shell" role="dialog" aria-modal="true" aria-label="HXD1C板钮面板"><div class="switch-panel-head"><div><strong>板钮面板</strong><span>点击板钮进行操作</span></div><button type="button" class="switch-panel-close" aria-label="关闭板钮面板">×</button></div><div class="switch-panel-photo"><img src="./assets/switch-panel/HXD1C-switch-panel-reference.jpg" alt="HXD1C板钮面板实物参考" /><div class="switch-panel-controls"></div></div><div class="switch-panel-status">点击对应板钮；未满足联锁条件时系统会保持原位。</div></div>`;
  const controls=root.querySelector('.switch-panel-controls');
  for(const def of switchDefs){
    const button=document.createElement('button');button.type='button';button.className=`switch-unit type-${def.type}`;button.dataset.switchId=def.id;button.style.setProperty('--switch-x',def.x);button.setAttribute('aria-label',def.label);
    button.innerHTML=`<span class="switch-mask"><span class="switch-slot"></span><span class="switch-lever"><i></i></span></span><span class="switch-name">${def.label}</span><span class="switch-value">0</span>`;
    button.addEventListener('click',()=>operateSwitch(def,button));controls.append(button);
  }
  root.querySelector('.switch-panel-close').addEventListener('click',closeSwitchPanel);
  root.addEventListener('click',(event)=>{if(event.target===root)closeSwitchPanel();});
  document.body.append(root);switchPanelRoot=root;syncSwitchPanel(sim.state);
}
function openSwitchPanel(){if(selectedView!=='front')return;if(!switchPanelRoot)buildSwitchPanel();switchPanelRoot.classList.add('open');switchPanelRoot.setAttribute('aria-hidden','false');document.body.classList.add('switch-panel-active');syncSwitchPanel(sim.state);}
function closeSwitchPanel(){if(!switchPanelRoot)return;switchPanelRoot.classList.remove('open');switchPanelRoot.setAttribute('aria-hidden','true');document.body.classList.remove('switch-panel-active');}
function operateSwitch(def,button){
  const state=sim.state;let targetUp=true;let accepted=true;
  if(def.states){const current=def.read(state);const next=def.states[(def.states.indexOf(current)+1)%def.states.length];targetUp=next==='white';accepted=command(def.id,next);}
  else{targetUp=!Boolean(def.read(state));accepted=command(def.id,targetUp);}
  button.classList.remove('throw-up','throw-down','rejected');void button.offsetWidth;button.classList.add(targetUp?'throw-up':'throw-down');
  if(accepted===false)button.classList.add('rejected');
  setTimeout(()=>button.classList.remove('throw-up','throw-down','rejected'),260);syncSwitchPanel(sim.state);
  navigator.vibrate?.(accepted===false?[30,35,30]:18);
}
function syncSwitchPanel(state){
  if(!switchPanelRoot)return;
  for(const def of switchDefs){const button=switchPanelRoot.querySelector(`[data-switch-id="${def.id}"]`);if(!button)continue;const value=def.read(state);button.classList.remove('state-up','state-mid','state-down');let label='0';if(def.states){label=value==='white'?'白':value==='red'?'红':'0';button.classList.add(value==='white'?'state-up':value==='red'?'state-down':'state-mid');}else{const on=Boolean(value);label=on?def.on:def.off;button.classList.add(def.momentary?'state-mid':on?'state-up':'state-down');}button.querySelector('.switch-value').textContent=label;button.setAttribute('aria-pressed',String(Boolean(value&&value!=='0')));}
}
function bindDrag() { addEventListener('pointermove',(event)=>{ if(!activeDrag||(activeDrag.pointerId!==undefined&&event.pointerId!==activeDrag.pointerId))return; event.preventDefault(); const d=activeDrag; const delta=Math.round((d.startY-event.clientY)/d.pixelsPerStep); if(d.id==='traction')command('traction',Math.max(-8,Math.min(7,d.start+delta))); else command(d.id==='auto'?'auto-brake':'independent-brake',Math.max(0,Math.min(5,d.start+delta))); },{passive:false}); addEventListener('pointerup',(event)=>{if(!activeDrag||activeDrag.pointerId===event.pointerId)activeDrag=null}); addEventListener('pointercancel',(event)=>{if(!activeDrag||activeDrag.pointerId===event.pointerId)activeDrag=null}); }
function activeState(id,state) { return Boolean(state[id==='panto'?'panto':id==='main-breaker'?'mainBreaker':id==='control-power'?'powerOn':id==='parking'?'parkingBrake':id==='headlight'?'headlight':id==='compressor'?'compressor':id==='authority'?'authority':id==='horn'?'horn':id==='lkj'?'lkjConfirmed':id==='reset'?'vigilanceAcknowledged':false]); }
function render(state,message='') {
  routeScene.update(state.distance,state.speed,selectedView);
  if(selectedView==='front') {
    frame(elements.auto,[0,1,2,9,10,11][state.autoBrake],4,3); frame(elements.independent,Math.min(11,state.independentBrake),4,3); frame(elements.traction,tractionFrame(state.traction),2,8); frame(elements.direction,state.direction==='R'?0:state.direction==='N'?1:2,3,1);
    for(const [id] of keys) elements[id]?.classList.toggle('on',activeState(id,state));
    setNeedle(elements.speedNeedle,state.speed,158); setNeedle(elements.mainNeedle,state.mainRes,1600); setNeedle(elements.pipeNeedle,state.trainPipe,1000); setNeedle(elements.eqNeedle,state.trainPipe,1600); setNeedle(elements.cylNeedle,state.brakeCyl,1600); setNeedle(elements.mainNeedle2,state.mainRes,1600); setNeedle(elements.pipeNeedle2,state.trainPipe,1600); setNeedle(elements.eqNeedle2,state.trainPipe,1600); setNeedle(elements.cylNeedle2,state.brakeCyl,1600);
    const current=Math.max(0,state.traction)*105; elements.voltageBar.style.transform=`scaleY(${Math.max(.03,state.netVoltage/30)})`; elements.currentBars.forEach((bar,index)=>bar.style.transform=`scaleY(${Math.max(.02,Math.min(1,(current-index*22)/1000))})`);
    elements.speedDigital.textContent=Math.round(state.speed); elements.limitDigital.textContent='30'; elements.clockDigital.textContent=new Date().toLocaleTimeString('zh-CN',{hour12:false});
    frame(elements.pantoDisplay,state.panto?1:0,1,2); frame(elements.signal,state.authority?6:0,4,2);
  }
  for(const [id] of keys) document.querySelector(`#keys [data-id="${id}"]`)?.classList.toggle('active',activeState(id,state));
  syncSwitchPanel(state);
  syncPowerCabinet(state);
  const p=procedureState(state); $('#procedure').innerHTML=PROCEDURE.map(([n],i)=>`<li class="${p.complete[i]?'done':i===p.current?'active':''}">${i+1}. ${n}</li>`).join(''); const score=scoreRun(state); $('#status').innerHTML=`<strong>状态：</strong>${p.done?'训练完成':'第 '+(p.current+1)+' 步'}<br>总风 ${state.mainRes.toFixed(0)} kPa · 制动缸 ${state.brakeCyl.toFixed(0)} kPa<br>速度 ${state.speed.toFixed(1)} km/h · 当前得分 ${score.score}`; if(message)$('#hint').textContent=message;
}
function buildKeys(){if(!debugMode)return;document.body.classList.add('debug-mode');const root=$('#keys');keys.forEach(([id,name])=>{const b=document.createElement('button');b.dataset.id=id;b.textContent=name;b.addEventListener('click',()=>command(id));root.append(b);});}
function setView(view){closeDevicePanels();selectedView=view;const cab=$('#cab');cab.src=`./assets/archive-cabview/${views[view]}`;routeScene.setView(view);document.querySelectorAll('[data-view]').forEach(b=>b.classList.toggle('active',b.dataset.view===view));if(view==='front')createFront();else overlay.replaceChildren();render(sim.state);}
const mobileLike=matchMedia('(pointer: coarse)').matches||navigator.maxTouchPoints>0||/Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
if(mobileLike)document.body.classList.add('mobile-controls-enabled');
async function enterImmersive(){
  document.documentElement.classList.add('immersive');
  $('#landscape-gate').hidden=true;
  try{const root=document.documentElement;if(root.requestFullscreen)await root.requestFullscreen({navigationUI:'hide'});else if(root.webkitRequestFullscreen)await root.webkitRequestFullscreen();}catch{ /* iPhone Safari 常拒绝普通网页全屏，CSS 沉浸模式继续生效。 */ }
  try{await screen.orientation?.lock?.('landscape');}catch{ /* iOS 及部分浏览器不允许网页锁定方向。 */ }
  setTimeout(()=>{scrollTo(0,1);routeScene.resize();},120);
}
async function exitImmersive(){
  closeDevicePanels();
  try{if(document.fullscreenElement)await document.exitFullscreen();else if(document.webkitFullscreenElement)await document.webkitExitFullscreen();}catch{ /* CSS 状态仍可正常退出。 */ }
  document.documentElement.classList.remove('immersive');
  routeScene.resize();
}
$('#enter-training').addEventListener('click',enterImmersive);
$('#exit-immersive').addEventListener('click',exitImmersive);
addEventListener('fullscreenchange',()=>{if(!document.fullscreenElement&&document.documentElement.classList.contains('immersive')&&!mobileLike)document.documentElement.classList.remove('immersive');routeScene.resize();});
addEventListener('orientationchange',()=>{closeDevicePanels();setTimeout(()=>routeScene.resize(),160);});
window.visualViewport?.addEventListener('resize',()=>routeScene.resize());
document.querySelectorAll('[data-view]').forEach(b=>b.addEventListener('click',()=>setView(b.dataset.view)));buildSwitchPanel();buildPowerCabinet();buildLkj();buildKeys();bindDrag();setView('front');sim.onChange(render);let last=performance.now();function loop(now){sim.tick(Math.min(.05,(now-last)/1000));routeScene.render();last=now;requestAnimationFrame(loop)}requestAnimationFrame(loop);

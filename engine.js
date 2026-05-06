const canvas=document.getElementById('gameCanvas'),ctx=canvas.getContext('2d');
function resize(){canvas.width=innerWidth;canvas.height=innerHeight}
resize();addEventListener('resize',resize);

// === STATE ===
let gameState='menu',gameMode='career',currentMap=0;
let bestDistance=+(localStorage.getItem('ddBest')||0),totalCoins=+(localStorage.getItem('ddCoins')||0);
let playerName=localStorage.getItem('ddName')||'Driver';
let sessionCoins=0,distance=0,fuel=100,wheelRot=0,gameTime=0;
let gasPressed=false,brakePressed=false,jumpPressed=false;
let maxHeight=0,currentHeight=0,blocksSmashed=0;
let dinoBarricades=[],barricadesPassed=0,dinoSpeed=5;
let collectibles=[],particles=[],blocks=[],structures=[];
const camera={x:0,y:0};
let zoomLevel=1;const ZOOM_MIN=0.55,ZOOM_MAX=1.3;
let dayTime=0.3,targetDayTime=0.3,climateTimer=0; // Smooth climate

// Multiplayer
let ws=null,myId=null,myColor='#e74c3c',otherPlayers={},onlineCount=1,sendCounter=0;
let multiMode='race',currentRoomCode=null,isHost=false,isReady=false;
const SERVER_URL='wss://mountain-car-game.onrender.com';

// === MAPS ===
const MAPS=[
  {id:'village',name:'Village Road',icon:'🏘️',desc:'Bumpy village paths',colors:['#5a3d2b','#4a7c3f','#3a2518'],line:'#6b8a3d'},
  {id:'highway',name:'Highway',icon:'🛣️',desc:'Smooth highway',colors:['#444','#555','#333'],line:'#888'},
  {id:'forest',name:'Forest Trail',icon:'🌲',desc:'Dense forest',colors:['#3d5a2b','#2d4a1b','#1a2a0b'],line:'#5a8a2d'},
  {id:'desert',name:'Desert',icon:'🏜️',desc:'Sandy dunes',colors:['#c2956b','#b8864f','#8a6a3f'],line:'#d4a574'},
  {id:'mountain',name:'Mountain',icon:'🏔️',desc:'Steep passes',colors:['#5a5a6a','#4a4a5a','#3a3a4a'],line:'#7a7a8a'}
];

// === CAR ===
const car={x:250,y:0,vx:0,vy:0,angle:0,angularVel:0,onGround:true,
  frontSusp:0,rearSusp:0,frontSuspVel:0,rearSuspVel:0,bodyTilt:0};
const GRAVITY=0.35,BRAKE_POWER=0.2,FRICTION=0.994,FUEL_RATE=0.02;
const VEHICLES=[
  {id:'rickshaw',name:'Auto Rickshaw',icon:'🛺',power:.32,speed:11,fuel:85,grip:.78,wb:52,wr:11,c1:'#4ade80',c2:'#16a34a',type:'rickshaw'},
  {id:'bike',name:'Mountain Bike',icon:'🚲',power:.28,speed:14,fuel:60,grip:.7,wb:42,wr:10,c1:'#22c55e',c2:'#15803d',type:'bike'},
  {id:'car',name:'Sedan Car',icon:'🚗',power:.36,speed:15,fuel:100,grip:.88,wb:58,wr:13,c1:'#3b82f6',c2:'#1d4ed8',type:'car'},
  {id:'truck',name:'Heavy Truck',icon:'🚛',power:.44,speed:12,fuel:140,grip:.92,wb:72,wr:16,c1:'#ef4444',c2:'#b91c1c',type:'truck'},
  {id:'lorry',name:'Long Lorry',icon:'🚚',power:.48,speed:10,fuel:160,grip:.95,wb:90,wr:18,c1:'#8b5cf6',c2:'#6d28d9',type:'lorry'}
];
let vehIndex=0;
function getVeh(){return VEHICLES[vehIndex];}

// === TERRAIN ===
const tCache={};const TS=3;
function getTerrainY(x){
  const k=Math.round(x/TS)*TS;if(tCache[k]!==undefined)return tCache[k];
  const base=canvas.height*0.55;let y=base;
  const m=MAPS[currentMap];
  if(gameMode==='crack'){
    // Flat run → smooth ramp → instant drop → flat landing
    const cycle=2400;
    const phase=((x%cycle)+cycle)%cycle;
    if(phase<1000){y+=Math.sin(x*0.0008)*15;} // flat run-up
    else if(phase<1350){
      // Smooth curved ramp (cosine ease — not too steep)
      const t=(phase-1000)/350;
      y-=((1-Math.cos(t*Math.PI))/2)*160;
    }
    else if(phase<1420){y-=160;} // flat launch pad (wide enough)
    else{y+=Math.sin(x*0.0008)*10;} // INSTANT drop to base — no gradual cliff
  }else if(gameMode==='jump'){
    // Gentle hills → smooth ramp → flat launch pad → instant drop
    const cycle=1600;
    const phase=((x%cycle)+cycle)%cycle;
    if(phase<700){y+=Math.sin(x*0.0015)*50+Math.sin(x*0.004)*25;} // gentle terrain
    else if(phase<1050){
      // Smooth cosine ramp (gradually curves up, max angle ~45°)
      const t=(phase-700)/350;
      y+=Math.sin(x*0.0015)*50-((1-Math.cos(t*Math.PI))/2)*180;
    }
    else if(phase<1130){y+=Math.sin(x*0.0015)*50-180;} // flat launch pad (80px wide)
    else{y+=Math.sin(x*0.0015)*50+Math.sin(x*0.003)*20;} // INSTANT drop back to base
  }else if(gameMode==='dino'){
    // Dino Run: completely flat terrain with tiny bumps
    y+=Math.sin(x*0.001)*3;
  }else if(m.id==='village'){
    // Smooth rolling hills — low frequency only, no sharp bumps
    y+=Math.sin(x*0.0008)*80+Math.sin(x*0.002+1.3)*40+Math.sin(x*0.005+.7)*15;
    y+=Math.sin(x*0.003+3)*30*Math.min(x/6000,2);
  }else if(m.id==='highway'){
    // Very gentle, smooth road
    y+=Math.sin(x*0.0006)*40+Math.sin(x*0.0015+1)*20+Math.sin(x*0.004)*8;
  }else if(m.id==='forest'){
    // Rolling forest hills, smooth curves
    y+=Math.sin(x*0.001)*90+Math.sin(x*0.003+1.3)*45+Math.sin(x*0.006+.7)*18;
  }else if(m.id==='desert'){
    // Gentle sand dunes
    y+=Math.sin(x*0.0007)*70+Math.sin(x*0.002+1)*35+Math.sin(x*0.005+2)*12;
  }else if(m.id==='mountain'){
    // Bigger hills but still smooth curves (no sharp walls)
    y+=Math.sin(x*0.0006)*120+Math.sin(x*0.002+1.3)*60+Math.sin(x*0.005+.7)*25;
    y+=Math.sin(x*0.003+3)*40*Math.min(x/5000,2.5);
  }else{y+=Math.sin(x*0.0008)*80+Math.sin(x*0.002+1.3)*45+Math.sin(x*0.005+.7)*18;}
  tCache[k]=y;return y;
}
function getTerrainAngle(x){const d=4;return Math.atan2(getTerrainY(x+d)-getTerrainY(x-d),2*d);}

// === BUILDING BLOCKS (Crack mode) ===
let lastBuildingX=1800;
function ensureBuildings(){
  if(gameMode!=='crack')return;
  const ahead=car.x+canvas.width*3;
  while(lastBuildingX<ahead){
    // Place buildings in the flat zone after the ramp drops
    const cycleStart=Math.floor(lastBuildingX/2400)*2400;
    const buildX=cycleStart+1700+Math.floor(Math.random()*500); // random in landing zone
    lastBuildingX=cycleStart+2400;
    generateBuilding(buildX);
  }
}
function generateBuilding(bx){
  const gy=getTerrainY(bx);
  const bw=24,bh=20;
  const rows=4+Math.floor(Math.random()*5);
  const cols=3+Math.floor(Math.random()*3);
  const colors=['#c0392b','#e74c3c','#2980b9','#3498db','#e67e22','#f39c12','#8e44ad','#27ae60'];
  for(let r=0;r<rows;r++){
    for(let c=0;c<cols;c++){
      // Leave some gaps for interesting collapse
      if(r>1&&Math.random()<0.1)continue;
      blocks.push({
        x:bx+c*bw-(cols*bw/2),y:gy-(r+1)*bh,w:bw-2,h:bh-2,
        vx:0,vy:0,angle:0,av:0,active:false,settled:true,
        color:colors[Math.floor(Math.random()*colors.length)]
      });
    }
  }
}
function updateBlocks(){
  for(const b of blocks){
    if(!b.active)continue;
    b.vy+=0.35;b.x+=b.vx;b.y+=b.vy;b.angle+=b.av;
    b.vx*=0.99;b.av*=0.97;
    const gy=getTerrainY(b.x);
    if(b.y+b.h/2>gy){b.y=gy-b.h/2;b.vy*=-0.25;b.vx*=0.7;b.av*=0.5;if(Math.abs(b.vy)<0.5){b.vy=0;b.settled=true;}}
  }
  // Block-block collision (simple)
  for(let i=0;i<blocks.length;i++){
    if(!blocks[i].active)continue;
    for(let j=i+1;j<blocks.length;j++){
      if(blocks[j].active&&blocks[j].settled)continue;
      const a=blocks[i],bb=blocks[j];
      const dx=a.x-bb.x,dy=a.y-bb.y;
      if(Math.abs(dx)<a.w&&Math.abs(dy)<a.h){
        if(!bb.active){bb.active=true;blocksSmashed++;bb.settled=false;}
        bb.vx+=dx*0.05;bb.vy+=dy*0.05-1;bb.av=(Math.random()-.5)*.2;
      }
    }
  }
}
function checkBlockCollision(){
  const cL=car.x-28,cR=car.x+28,cT=car.y-28,cB=car.y;
  for(const b of blocks){
    if(b.active&&b.settled)continue;
    const bL=b.x-b.w/2,bR=b.x+b.w/2,bT=b.y-b.h/2,bB=b.y+b.h/2;
    if(cR>bL&&cL<bR&&cB>bT&&cT<bB){
      const spd=Math.sqrt(car.vx*car.vx+car.vy*car.vy);
      if(!b.active){b.active=true;blocksSmashed++;spawnStars(b.x,b.y);}
      b.vx=car.vx*0.7+(Math.random()-.3)*spd*0.4;
      b.vy=-Math.abs(car.vy)-spd*0.3-Math.random()*3;
      b.av=(Math.random()-.5)*.3;b.settled=false;
      // Cascade nearby
      for(const ob of blocks){
        if(ob===b||ob.active)continue;
        const ddx=ob.x-b.x,ddy=ob.y-b.y;
        if(Math.abs(ddx)<35&&Math.abs(ddy)<35){
          ob.active=true;blocksSmashed++;
          ob.vx=ddx*0.08+Math.random()*2;ob.vy=-2-Math.random()*3;
          ob.av=(Math.random()-.5)*.15;ob.settled=false;
        }
      }
    }
  }
}

// === COLLECTIBLES ===
function ensureCollectibles(){
  if(gameMode==='dino')return; // no clutter in dino mode
  const ahead=car.x+canvas.width*2.5;
  const last=collectibles.length>0?collectibles[collectibles.length-1].x:300;
  for(let x=Math.max(last+180,car.x);x<ahead;x+=100+Math.random()*180){
    const ty=getTerrainY(x);
    collectibles.push({x,y:ty-18,type:Math.random()<0.15?'fuel':'coin',collected:false});
  }
  collectibles=collectibles.filter(c=>c.x>car.x-500);
}

// === ROADSIDE STRUCTURES ===
let lastStructX=600;
function ensureStructures(){
  if(gameMode==='dino')return; // clean view for dino mode
  const ahead=car.x+canvas.width*3;
  while(lastStructX<ahead){
    lastStructX+=250+Math.random()*400;
    const ty=getTerrainY(lastStructX);
    const types=['teashop','temple','tree','sign','bus','stall','light'];
    structures.push({x:lastStructX,y:ty,type:types[Math.floor(Math.random()*types.length)]});
  }
  structures=structures.filter(s=>s.x>car.x-600);
}

// === PARTICLES ===
function spawnDust(x,y){for(let i=0;i<3;i++)particles.push({x,y,vx:(Math.random()-.5)*3,vy:-Math.random()*2-1,life:1,decay:.025,size:3+Math.random()*4,color:`hsla(30,40%,${50+Math.random()*30}%,`});}
function spawnStars(x,y){for(let i=0;i<6;i++){const a=Math.random()*Math.PI*2;particles.push({x,y,vx:Math.cos(a)*3,vy:Math.sin(a)*3,life:1,decay:.03,size:3+Math.random()*3,color:'hsla(45,100%,60%,'});}}
function updateParticles(){for(let i=particles.length-1;i>=0;i--){const p=particles[i];p.x+=p.vx;p.y+=p.vy;p.vy+=.05;p.life-=p.decay;if(p.life<=0)particles.splice(i,1);}}

// === CAR PHYSICS ===
function updateCar(){
  const v=getVeh();
  const tY=getTerrainY(car.x),tA=getTerrainAngle(car.x);
  if(car.onGround){
    car.y=tY;const cos=Math.cos(tA),sin=Math.sin(tA);
    let spd=car.vx*cos+car.vy*sin;spd+=sin*GRAVITY;
    if(gasPressed&&fuel>0){spd+=v.power;fuel-=FUEL_RATE;}
    if(brakePressed){spd*=.9;if(spd>.3)spd-=BRAKE_POWER;if(spd<0)spd=0;}
    spd=Math.max(0,Math.min(v.speed,spd))*FRICTION;
    car.vx=spd*cos;car.vy=spd*sin;
    let ad=tA-car.angle;while(ad>Math.PI)ad-=Math.PI*2;while(ad<-Math.PI)ad+=Math.PI*2;
    car.angle+=ad*.3;car.angularVel=0;

    // Launch detection: multiple checks
    const lookAhead=Math.max(spd*5,20);
    const fY=getTerrainY(car.x+lookAhead);
    // 1. Terrain drops sharply ahead (cliff edge)
    if(fY-tY>8&&Math.abs(spd)>1.5){car.onGround=false;car.vy=-Math.abs(spd)*Math.sin(tA)*0.5;}
    // 2. Longer range cliff check
    const cliffCheck=getTerrainY(car.x+50);
    if(cliffCheck-tY>25&&Math.abs(spd)>1){car.onGround=false;car.vy=-Math.abs(spd)*0.3;}
    // 3. Steep angle launch: if terrain angle > 55°, force airborne at speed
    if(Math.abs(tA)>0.96&&Math.abs(spd)>2){car.onGround=false;car.vy=-Math.abs(spd)*0.6;car.vx=Math.abs(spd)*0.8;}

    if(Math.abs(spd)>2&&Math.random()>.5)spawnDust(car.x-cos*30,tY);
    wheelRot+=spd*.08;
  }else{
    // === AIR PHYSICS ===
    car.vy+=GRAVITY;
    // Gas = nose UP (wheelie), Brake = nose DOWN — strong control
    if(gasPressed){car.angularVel-=.008;car.vy-=0.08;} // slight lift + tilt back
    if(brakePressed){car.angularVel+=.008;} // tilt forward
    car.angularVel=Math.max(-.08,Math.min(.08,car.angularVel)); // clamp
    car.angularVel*=.97;car.angle+=car.angularVel;car.vx*=.999;wheelRot+=car.vx*.08;
  }
  car.x+=car.vx;car.y+=car.vy;
  // Height tracking
  // Height tracking (for jump and general)
  if(gameMode==='jump'||!car.onGround){
    const groundY=getTerrainY(car.x);
    const h=Math.max(0,Math.floor((groundY-car.y)/4));
    currentHeight=h;if(h>maxHeight)maxHeight=h;
  }else{currentHeight=0;}
  // Ground collision
  const gY=getTerrainY(car.x);
  if(car.y>=gY){
    car.y=gY;
    if(!car.onGround){
      const ga=getTerrainAngle(car.x),la=car.angle-ga;
      const n=((la%(Math.PI*2))+Math.PI*3)%(Math.PI*2)-Math.PI;
      if(Math.abs(n)>Math.PI*.5){endGame('flip');return;}
      car.angle=ga;car.vy=0;spawnDust(car.x,gY);spawnDust(car.x-20,gY);spawnDust(car.x+20,gY);
    }
    car.onGround=true;car.angularVel=0;
  }
  if(fuel<=0){fuel=0;endGame('fuel');return;}
  const d=Math.max(0,Math.floor((car.x-250)/8));if(d>distance)distance=d;
  // Collectibles
  for(const c of collectibles){
    if(c.collected)continue;
    const dx=car.x-c.x,dy=(car.y-20)-c.y;
    if(dx*dx+dy*dy<1800){c.collected=true;if(c.type==='coin'){sessionCoins++;spawnStars(c.x,c.y);}else{fuel=Math.min(100,fuel+25);spawnStars(c.x,c.y);}}
  }
  // Block collision
  if(gameMode==='crack')checkBlockCollision();
}

function updateSuspension(){
  const sp=.15,dm=.7,spd=Math.sqrt(car.vx*car.vx+car.vy*car.vy);
  let rT=0,fT=0;
  if(car.onGround){
    if(gasPressed&&fuel>0){rT=5+Math.min(spd*.3,4);fT=-4-Math.min(spd*.2,3);car.bodyTilt+=(.06-car.bodyTilt)*.1;}
    else if(brakePressed&&spd>.5){fT=4+Math.min(spd*.3,5);rT=-2;car.bodyTilt+=(-.04-car.bodyTilt)*.1;}
    else car.bodyTilt*=.9;
  }else{fT=-3;rT=-3;car.bodyTilt*=.95;}
  car.rearSuspVel=(car.rearSuspVel+((rT-car.rearSusp)*sp))*dm;car.rearSusp+=car.rearSuspVel;
  car.frontSuspVel=(car.frontSuspVel+((fT-car.frontSusp)*sp))*dm;car.frontSusp+=car.frontSuspVel;
  car.rearSusp=Math.max(-6,Math.min(10,car.rearSusp));car.frontSusp=Math.max(-6,Math.min(10,car.frontSusp));
}

function updateCamera(){
  const tx=car.x-(canvas.width/zoomLevel)*.35,ty=car.y-(canvas.height/zoomLevel)*.5;
  camera.x+=(tx-camera.x)*.08;camera.y+=(ty-camera.y)*.06;
}

// === DINO RUN: Barricade System ===
let lastBarricadeX=600;
function ensureBarricades(){
  if(gameMode!=='dino')return;
  const ahead=car.x+canvas.width*2;
  while(lastBarricadeX<ahead){
    // Gap between barricades — wider spacing for fair gameplay
    const gap=450+Math.random()*250-Math.min(distance*0.2,100);
    lastBarricadeX+=Math.max(350,gap);
    const gy=getTerrainY(lastBarricadeX);
    // Random barricade types
    const r=Math.random();
    if(r<0.5){
      // Small barricade (easy jump)
      dinoBarricades.push({x:lastBarricadeX,y:gy,w:20,h:30,type:'small',passed:false});
    }else if(r<0.8){
      // Tall barricade
      dinoBarricades.push({x:lastBarricadeX,y:gy,w:24,h:50,type:'tall',passed:false});
    }else{
      // Double barricade (two close together)
      dinoBarricades.push({x:lastBarricadeX,y:gy,w:20,h:35,type:'small',passed:false});
      dinoBarricades.push({x:lastBarricadeX+50,y:getTerrainY(lastBarricadeX+50),w:20,h:35,type:'small',passed:false});
      lastBarricadeX+=50;
    }
  }
  // Clean up passed barricades
  dinoBarricades=dinoBarricades.filter(b=>b.x>car.x-400);
}

function updateDinoCar(){
  const v=getVeh();
  const tY=getTerrainY(car.x);

  // Auto-drive: speed increases over time
  dinoSpeed=5+Math.min(distance*0.008,10);

  if(car.onGround){
    car.y=tY;
    car.angle=getTerrainAngle(car.x);
    car.vx=dinoSpeed;car.vy=0;
    car.angularVel=0;

    // JUMP when button pressed
    if(jumpPressed){
      car.onGround=false;
      car.vy=-6-Math.min(dinoSpeed*0.15,2); // lower jump — just clears barricades
      car.vx=dinoSpeed;
      jumpPressed=false; // single jump
    }
  }else{
    // Airborne
    car.vy+=GRAVITY*1.1; // stronger gravity so car lands quickly
    car.vx=dinoSpeed; // maintain forward speed
    // Slight nose control in air
    if(car.vy<0)car.angle=-0.15; // nose up while rising
    else car.angle=0.1; // nose down while falling
  }

  car.x+=car.vx;car.y+=car.vy;

  // Ground collision
  const gY=getTerrainY(car.x);
  if(car.y>=gY){
    car.y=gY;car.onGround=true;car.vy=0;
    car.angle=getTerrainAngle(car.x);
    spawnDust(car.x,gY);
  }

  // Fuel doesn't drain in dino mode (infinite fuel)
  fuel=100;

  // Distance
  const d=Math.max(0,Math.floor((car.x-250)/8));if(d>distance)distance=d;
  wheelRot+=car.vx*.08;

  // Barricade collision check
  const carL=car.x-30,carR=car.x+30,carT=car.y-35;
  for(const b of dinoBarricades){
    // Check if passed
    if(!b.passed&&car.x>b.x+b.w){
      b.passed=true;barricadesPassed++;
      sessionCoins++;spawnStars(b.x,b.y-b.h);
    }
    // Collision box
    const bL=b.x-b.w/2,bR=b.x+b.w/2,bT=b.y-b.h;
    if(carR>bL&&carL<bR&&car.y>bT&&carT<b.y){
      // HIT! Game over
      spawnDust(b.x,b.y);spawnDust(b.x,b.y-20);
      for(let i=0;i<8;i++)particles.push({x:b.x+Math.random()*20-10,y:b.y-Math.random()*b.h,vx:(Math.random()-.5)*6,vy:-Math.random()*5-2,life:1,decay:.03,size:3+Math.random()*4,color:'hsla(0,80%,50%,'});
      endGame('barricade');return;
    }
  }

  // Collectibles
  for(const c of collectibles){
    if(c.collected)continue;
    const dx=car.x-c.x,dy=(car.y-20)-c.y;
    if(dx*dx+dy*dy<1800){c.collected=true;if(c.type==='coin'){sessionCoins++;spawnStars(c.x,c.y);}else{fuel=Math.min(100,fuel+25);spawnStars(c.x,c.y);}}
  }
}

// === MULTIPLAYER ===
function connectMP(){
  try{
    ws=new WebSocket(SERVER_URL);
    ws.onopen=()=>console.log('Connected');
    ws.onmessage=e=>{try{
      const m=JSON.parse(e.data);
      if(m.type==='init'){myId=m.id;myColor=m.color;}
      else if(m.type==='players'){const np={};for(const p of m.players){if(p.id!==myId){const o=otherPlayers[p.id];np[p.id]=o?{...p,dx:o.dx+(p.x-o.dx)*.3,dy:o.dy+(p.y-o.dy)*.3,da:o.da+(p.angle-o.da)*.3}:{...p,dx:p.x,dy:p.y,da:p.angle};}}otherPlayers=np;}
      else if(m.type==='room_created'||m.type==='room_joined'){currentRoomCode=m.code;isReady=false;document.getElementById('displayCode').textContent=m.code;document.getElementById('readyBtn').classList.remove('is-ready');document.getElementById('readyBtn').textContent='✋ READY';hideAllScreens();document.getElementById('roomScreen').classList.remove('hidden');}
      else if(m.type==='lobby_state'){renderLobby(m);isHost=m.hostId===myId;onlineCount=m.players.length;const sb=document.getElementById('roomStartBtn');sb.style.display=isHost?'inline-block':'none';sb.disabled=!m.allReady;document.getElementById('startHint').textContent=!isHost?'Waiting for host...':m.allReady?'✅ All ready! Start!':'All players must be ready';}
      else if(m.type==='room_error'){const el=document.getElementById('joinError');el.textContent=m.error;el.style.display='block';}
      else if(m.type==='game_start'){gameMode=multiMode;startGame();}
    }catch(e){}};
    ws.onclose=()=>setTimeout(connectMP,2000);ws.onerror=()=>ws.close();
  }catch(e){}
}
function renderLobby(state){
  document.getElementById('playerList').innerHTML=state.players.map(p=>`
    <div class="player-row ${p.ready?'is-ready':''}">
      <div class="p-color" style="background:${p.color}"></div>
      <div class="p-name">${p.name}${p.id===myId?' (You)':''}</div>
      ${p.isHost?'<span class="p-badge">HOST</span>':''}
      <span class="p-status ${p.ready?'status-ready':'status-wait'}">${p.ready?'✅':'⏳'}</span>
    </div>`).join('');
}
function sendUpdate(){
  if(ws&&ws.readyState===1&&gameMode!=='career'&&gameMode!=='jump'&&gameMode!=='crack'&&gameMode!=='dino'){
    ws.send(JSON.stringify({type:'update',name:playerName,x:Math.round(car.x),y:Math.round(car.y),angle:Math.round(car.angle*1000)/1000,vehicle:getVeh().id,speed:Math.round(car.vx*10)/10,distance,alive:gameState==='playing'}));
  }
}

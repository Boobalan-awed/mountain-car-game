// === SCREENS ===
const allScreens=['menuScreen','mapScreen','vehicleScreen','lobbyScreen','joinScreen','roomScreen','gameOverScreen'];
function hideAllScreens(){allScreens.forEach(s=>document.getElementById(s).classList.add('hidden'));}

function resetGame(){
  for(const k in tCache)delete tCache[k];
  car.x=250;car.y=getTerrainY(250);car.vx=0;car.vy=0;car.angle=getTerrainAngle(250);
  car.angularVel=0;car.onGround=true;car.frontSusp=0;car.rearSusp=0;
  car.frontSuspVel=0;car.rearSuspVel=0;car.bodyTilt=0;
  fuel=100;distance=0;sessionCoins=0;wheelRot=0;gameTime=0;
  maxHeight=0;currentHeight=0;blocksSmashed=0;
  dinoBarricades=[];barricadesPassed=0;dinoSpeed=5;jumpPressed=false;lastBarricadeX=600;
  collectibles=[];particles=[];blocks=[];structures=[];lastStructX=600;lastBuildingX=1800;
  otherPlayers={};
}

function startGame(){
  resetGame();gameState='playing';hideAllScreens();
  document.getElementById('hud').classList.remove('hidden');
  document.getElementById('pauseBtn').classList.remove('hidden');
  document.getElementById('heightHud').style.display=gameMode==='jump'?'flex':'none';
  document.getElementById('blocksHud').style.display=gameMode==='crack'?'flex':'none';
  document.getElementById('dinoHud').style.display=gameMode==='dino'?'flex':'none';
  document.getElementById('onlineHud').style.display='none';
  // Show/hide jump button
  const jb=document.getElementById('jumpCtrlBtn');
  if(gameMode==='dino'){jb.classList.remove('hidden');}else{jb.classList.add('hidden');}
  // Hide fuel bar in dino mode (infinite)
  document.querySelector('.fuel-container').style.display=gameMode==='dino'?'none':'flex';
}

function endGame(reason){
  gameState='gameover';
  const isNew=distance>bestDistance;
  if(isNew){bestDistance=distance;localStorage.setItem('ddBest',bestDistance);}
  totalCoins+=sessionCoins;localStorage.setItem('ddCoins',totalCoins);
  document.getElementById('goTitle').textContent=reason==='flip'?'FLIPPED!':reason==='barricade'?'CRASHED!':'OUT OF FUEL!';
  document.getElementById('goDist').textContent=distance+'m';
  document.getElementById('goCoins').textContent=sessionCoins;
  document.getElementById('newBestStat').style.display=isNew?'flex':'none';
  document.getElementById('goBest').textContent=bestDistance+'m';
  document.getElementById('goHeightStat').style.display=gameMode==='jump'?'flex':'none';
  document.getElementById('goHeight').textContent=maxHeight+'m';
  document.getElementById('goBlocksStat').style.display=gameMode==='crack'?'flex':'none';
  document.getElementById('goBlocks').textContent=blocksSmashed;
  // Show barricades passed for dino mode (reuse height stat)
  if(gameMode==='dino'){
    document.getElementById('goHeightStat').style.display='flex';
    document.getElementById('goHeight').textContent=barricadesPassed+' barricades';
  }
  document.getElementById('gameOverScreen').classList.remove('hidden');
  document.getElementById('hud').classList.add('hidden');
  document.getElementById('pauseBtn').classList.add('hidden');
  document.getElementById('jumpCtrlBtn').classList.add('hidden');
}

function showMenu(){
  gameState='menu';gameMode='career';currentRoomCode=null;
  if(ws&&ws.readyState===1)ws.send(JSON.stringify({type:'leave_room'}));
  hideAllScreens();document.getElementById('menuScreen').classList.remove('hidden');
  document.getElementById('hud').classList.add('hidden');
  document.getElementById('pauseBtn').classList.add('hidden');
  document.getElementById('menuBest').textContent=bestDistance+'m';
  document.getElementById('menuCoins').textContent=totalCoins;
  document.getElementById('menuName').textContent=playerName;
}

// === MAP SELECT ===
function renderMaps(){
  document.getElementById('mapGrid').innerHTML=MAPS.map((m,i)=>`
    <div class="map-card" data-map="${i}">
      <div class="map-icon">${m.icon}</div>
      <div class="map-name">${m.name}</div>
      <div class="map-desc">${m.desc}</div>
    </div>`).join('');
  document.querySelectorAll('.map-card').forEach(c=>c.addEventListener('click',()=>{
    currentMap=+c.dataset.map;
    hideAllScreens();showVehicleSelect();
  }));
}

// === VEHICLE SELECT ===
function showVehicleSelect(){
  document.getElementById('vehicleScreen').classList.remove('hidden');
  updateVehicleDisplay();
  renderVehDots();
}
function updateVehicleDisplay(){
  const v=VEHICLES[vehIndex];
  document.getElementById('vehName').textContent=v.icon+' '+v.name;
  drawVehiclePreview(document.getElementById('vehCanvas'),vehIndex);
  // Stat bars
  const maxSpd=16,maxPow=0.5,maxFuel=160,maxGrip=1;
  const stats=[
    {label:'Speed',val:v.speed,max:maxSpd,color:'#3b82f6'},
    {label:'Power',val:v.power,max:maxPow,color:'#ef4444'},
    {label:'Fuel',val:v.fuel,max:maxFuel,color:'#22c55e'},
    {label:'Grip',val:v.grip,max:maxGrip,color:'#f59e0b'}
  ];
  document.getElementById('vehStats').innerHTML=stats.map(s=>`
    <div class="vs-row">
      <span class="vs-label">${s.label}</span>
      <div class="vs-bar-bg"><div class="vs-bar" style="width:${(s.val/s.max)*100}%;background:${s.color}"></div></div>
      <span class="vs-val">${Math.round((s.val/s.max)*100)}%</span>
    </div>`).join('');
  // Update dots
  document.querySelectorAll('.veh-dot').forEach((d,i)=>d.classList.toggle('active',i===vehIndex));
}
function renderVehDots(){
  document.getElementById('vehDots').innerHTML=VEHICLES.map((_,i)=>`<div class="veh-dot ${i===vehIndex?'active':''}" data-vi="${i}"></div>`).join('');
  document.querySelectorAll('.veh-dot').forEach(d=>d.addEventListener('click',()=>{vehIndex=+d.dataset.vi;updateVehicleDisplay();}));
}
document.getElementById('vehPrev').addEventListener('click',()=>{vehIndex=(vehIndex-1+VEHICLES.length)%VEHICLES.length;updateVehicleDisplay();});
document.getElementById('vehNext').addEventListener('click',()=>{vehIndex=(vehIndex+1)%VEHICLES.length;updateVehicleDisplay();});
document.getElementById('startGameBtn').addEventListener('click',startGame);
document.getElementById('vehBackBtn').addEventListener('click',()=>{hideAllScreens();renderMaps();document.getElementById('mapScreen').classList.remove('hidden');});

function populateMapSelect(){
  const sel=document.getElementById('roomMapSelect');
  sel.innerHTML=MAPS.map((m,i)=>`<option value="${i}">${m.icon} ${m.name}</option>`).join('');
}

// === GAME LOOP ===
function gameLoop(){
  if(gameState==='playing'){
    gameTime+=.016;updateClimate();
    if(gameMode==='dino'){updateDinoCar();ensureBarricades();}else{updateCar();}
    updateSuspension();updateCamera();updateParticles();
    ensureCollectibles();ensureStructures();
    if(gameMode==='crack'){ensureBuildings();updateBlocks();}
    if(++sendCounter%3===0)sendUpdate();
  }
  ctx.clearRect(0,0,canvas.width,canvas.height);
  if(gameState==='playing'||gameState==='paused'||gameState==='gameover'){
    ctx.save();ctx.scale(zoomLevel,zoomLevel);
    drawBackground();drawTerrain();drawStructures();
    if(gameMode==='crack')drawBlocks();
    if(gameMode==='dino')drawBarricades();
    drawCollectibles();
    if(Object.keys(otherPlayers).length>0)drawOtherPlayers();
    drawCar();drawParticles();drawHeightMeter();
    ctx.restore();
    if(gameState==='playing')updateHUD();
  }
  requestAnimationFrame(gameLoop);
}

// === INPUT ===
document.addEventListener('keydown',e=>{if(e.key==='ArrowRight'||e.key==='d')gasPressed=true;if(e.key==='ArrowLeft'||e.key==='a')brakePressed=true;if(e.key===' '||e.key==='ArrowUp'||e.key==='w')jumpPressed=true;});
document.addEventListener('keyup',e=>{if(e.key==='ArrowRight'||e.key==='d')gasPressed=false;if(e.key==='ArrowLeft'||e.key==='a')brakePressed=false;});
function addPress(el,on,off){
  el.addEventListener('mousedown',e=>{e.preventDefault();on();el.classList.add('pressed');});
  el.addEventListener('mouseup',()=>{off();el.classList.remove('pressed');});
  el.addEventListener('mouseleave',()=>{off();el.classList.remove('pressed');});
  el.addEventListener('touchstart',e=>{e.preventDefault();on();el.classList.add('pressed');},{passive:false});
  el.addEventListener('touchend',e=>{e.preventDefault();off();el.classList.remove('pressed');});
  el.addEventListener('touchcancel',()=>{off();el.classList.remove('pressed');});
}
addPress(document.getElementById('gasBtn'),()=>gasPressed=true,()=>gasPressed=false);
addPress(document.getElementById('brakeBtn'),()=>brakePressed=true,()=>brakePressed=false);
addPress(document.getElementById('jumpCtrlBtn'),()=>{jumpPressed=true;},()=>{});

// Zoom
canvas.addEventListener('wheel',e=>{e.preventDefault();zoomLevel=Math.max(ZOOM_MIN,Math.min(ZOOM_MAX,zoomLevel+(e.deltaY>0?-.05:.05)));},{passive:false});
let lastPinch=0;
canvas.addEventListener('touchstart',e=>{if(e.touches.length===2){const dx=e.touches[0].clientX-e.touches[1].clientX,dy=e.touches[0].clientY-e.touches[1].clientY;lastPinch=Math.sqrt(dx*dx+dy*dy);}},{passive:true});
canvas.addEventListener('touchmove',e=>{if(e.touches.length===2){const dx=e.touches[0].clientX-e.touches[1].clientX,dy=e.touches[0].clientY-e.touches[1].clientY,dist=Math.sqrt(dx*dx+dy*dy);if(lastPinch>0)zoomLevel=Math.max(ZOOM_MIN,Math.min(ZOOM_MAX,zoomLevel*(dist/lastPinch)));lastPinch=dist;}},{passive:true});
canvas.addEventListener('touchend',()=>{lastPinch=0;},{passive:true});

// === NAME EDITOR ===
document.getElementById('editNameBtn').addEventListener('click',()=>{
  document.getElementById('playerTag').classList.add('hidden');
  document.getElementById('nameEditor').classList.remove('hidden');
  const inp=document.getElementById('nameInput');inp.value=playerName;inp.focus();
});
document.getElementById('saveNameBtn').addEventListener('click',()=>{
  playerName=document.getElementById('nameInput').value.trim()||'Driver';
  localStorage.setItem('ddName',playerName);
  document.getElementById('menuName').textContent=playerName;
  document.getElementById('roomNameInput').value=playerName;
  document.getElementById('nameEditor').classList.add('hidden');
  document.getElementById('playerTag').classList.remove('hidden');
});

// === MENU BUTTONS ===
document.getElementById('careerBtn').addEventListener('click',()=>{
  gameMode='career';hideAllScreens();renderMaps();document.getElementById('mapScreen').classList.remove('hidden');
});
document.getElementById('jumpBtn').addEventListener('click',()=>{
  gameMode='jump';hideAllScreens();renderMaps();document.getElementById('mapScreen').classList.remove('hidden');
});
document.getElementById('crackBtn').addEventListener('click',()=>{
  gameMode='crack';hideAllScreens();renderMaps();document.getElementById('mapScreen').classList.remove('hidden');
});
document.getElementById('dinoBtn').addEventListener('click',()=>{
  gameMode='dino';hideAllScreens();showVehicleSelect();
});
document.getElementById('friendsBtn').addEventListener('click',()=>{
  hideAllScreens();document.getElementById('lobbyScreen').classList.remove('hidden');
});
document.getElementById('mapBackBtn').addEventListener('click',showMenu);

// === MULTIPLAYER LOBBY ===
document.getElementById('createRoomBtn').addEventListener('click',()=>{
  if(ws&&ws.readyState===1)ws.send(JSON.stringify({type:'create_room',name:playerName}));
});
document.getElementById('joinRoomBtn').addEventListener('click',()=>{
  hideAllScreens();document.getElementById('joinScreen').classList.remove('hidden');
  document.getElementById('joinError').style.display='none';
});
document.getElementById('lobbyBackBtn').addEventListener('click',showMenu);
document.getElementById('confirmJoinBtn').addEventListener('click',()=>{
  const code=document.getElementById('roomCodeInput').value.trim().toUpperCase();
  if(code.length<5){document.getElementById('joinError').textContent='Enter 5-char code';document.getElementById('joinError').style.display='block';return;}
  if(ws&&ws.readyState===1)ws.send(JSON.stringify({type:'join_room',code,name:playerName}));
});
document.getElementById('joinBackBtn').addEventListener('click',()=>{hideAllScreens();document.getElementById('lobbyScreen').classList.remove('hidden');});

// Room
document.getElementById('readyBtn').addEventListener('click',()=>{
  isReady=!isReady;
  const btn=document.getElementById('readyBtn');
  btn.classList.toggle('is-ready',isReady);btn.textContent=isReady?'✅ READY!':'✋ READY';
  // Send updated name/vehicle
  const name=document.getElementById('roomNameInput').value.trim()||'Driver';
  playerName=name;localStorage.setItem('ddName',playerName);
  if(ws&&ws.readyState===1)ws.send(JSON.stringify({type:'toggle_ready'}));
});
document.getElementById('roomStartBtn').addEventListener('click',()=>{
  if(isHost&&ws&&ws.readyState===1){
    multiMode=document.getElementById('roomModeSelect').value;
    currentMap=+document.getElementById('roomMapSelect').value;
    ws.send(JSON.stringify({type:'host_start'}));
  }
});
document.getElementById('roomBackBtn').addEventListener('click',()=>{
  if(ws&&ws.readyState===1)ws.send(JSON.stringify({type:'leave_room'}));
  currentRoomCode=null;isReady=false;showMenu();
});
document.getElementById('copyCodeBtn').addEventListener('click',()=>{
  navigator.clipboard.writeText(currentRoomCode||'').then(()=>{
    document.getElementById('copyCodeBtn').textContent='✅ Copied!';
    setTimeout(()=>document.getElementById('copyCodeBtn').textContent='📋 Copy',2000);
  });
});

// Game over
document.getElementById('retryBtn').addEventListener('click',startGame);
document.getElementById('menuBtn').addEventListener('click',showMenu);

// Pause
document.getElementById('pauseBtn').addEventListener('click',()=>{if(gameState==='playing'){gameState='paused';document.getElementById('pauseMenu').classList.remove('hidden');}});
document.getElementById('resumeBtn').addEventListener('click',()=>{gameState='playing';document.getElementById('pauseMenu').classList.add('hidden');});
document.getElementById('pauseExitBtn').addEventListener('click',()=>{document.getElementById('pauseMenu').classList.add('hidden');showMenu();});

// === INIT ===
document.getElementById('roomNameInput').value=playerName;
populateMapSelect();
showMenu();connectMP();gameLoop();

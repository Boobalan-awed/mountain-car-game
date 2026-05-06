// === DRAWING ===
// Color interpolation helper
function lerpColor(a,b,t){
  const ar=parseInt(a.slice(1,3),16),ag=parseInt(a.slice(3,5),16),ab=parseInt(a.slice(5,7),16);
  const br=parseInt(b.slice(1,3),16),bg=parseInt(b.slice(3,5),16),bb=parseInt(b.slice(5,7),16);
  const r=Math.round(ar+(br-ar)*t),g=Math.round(ag+(bg-ag)*t),bl=Math.round(ab+(bb-ab)*t);
  return`rgb(${r},${g},${bl})`;
}

// Smooth climate update
function updateClimate(){
  climateTimer+=0.016;
  dayTime+=0.0003;
  if(dayTime>1)dayTime-=1;
  targetDayTime=dayTime;
}

function drawSky(){
  const d=dayTime;
  // Flat color bands (retro pixel look - no smooth gradients)
  let skyTop,skyMid,skyBot;
  if(d<0.2){skyTop='#000020';skyMid='#000040';skyBot='#000060';}
  else if(d<0.35){const t=(d-0.2)/0.15;skyTop=lerpColor('#000020','#330044',t);skyMid=lerpColor('#000040','#662200',t);skyBot=lerpColor('#000060','#cc4400',t);}
  else if(d<0.5){const t=(d-0.35)/0.15;skyTop=lerpColor('#330044','#4488cc',t);skyMid=lerpColor('#662200','#66aadd',t);skyBot=lerpColor('#cc4400','#88ccee',t);}
  else if(d<0.65){skyTop='#4488cc';skyMid='#66aadd';skyBot='#88ccee';}
  else if(d<0.8){const t=(d-0.65)/0.15;skyTop=lerpColor('#4488cc','#220044',t);skyMid=lerpColor('#66aadd','#884422',t);skyBot=lerpColor('#88ccee','#cc6633',t);}
  else{const t=(d-0.8)/0.2;skyTop=lerpColor('#220044','#000020',t);skyMid=lerpColor('#884422','#000040',t);skyBot=lerpColor('#cc6633','#000060',t);}
  // Draw as 3 solid bands (retro)
  const h3=Math.floor(canvas.height/3);
  ctx.fillStyle=skyTop;ctx.fillRect(0,0,canvas.width,h3);
  ctx.fillStyle=skyMid;ctx.fillRect(0,h3,canvas.width,h3);
  ctx.fillStyle=skyBot;ctx.fillRect(0,h3*2,canvas.width,canvas.height-h3*2);

  // Pixel stars (small squares)
  const nightFactor=d<0.25?1:d<0.4?1-(d-0.25)/0.15:d>0.75?Math.min(1,(d-0.75)/0.15):0;
  if(nightFactor>0){
    ctx.fillStyle=`rgba(255,255,255,${nightFactor*.8})`;
    for(let i=0;i<60;i++){
      const sx=(i*137+42)%canvas.width,sy=(i*97+126)%(canvas.height*.4);
      const twinkle=Math.sin(gameTime*3+i)>0?1:0;
      if(twinkle)ctx.fillRect(Math.floor(sx),Math.floor(sy),2,2);
    }
  }

  // Pixel Sun (square with cross)
  const celestialX=canvas.width*0.85,celestialY=canvas.height*0.1;
  if(d>0.3&&d<0.75){
    const sunAlpha=d<0.4?(d-0.3)/0.1:d>0.65?1-(d-0.65)/0.1:1;
    ctx.globalAlpha=sunAlpha;
    ctx.fillStyle='#ffdd00';ctx.fillRect(celestialX-12,celestialY-12,24,24);
    ctx.fillStyle='#ffff88';ctx.fillRect(celestialX-8,celestialY-8,16,16);
    // Rays (pixel cross)
    ctx.fillStyle='#ffdd00';
    ctx.fillRect(celestialX-2,celestialY-20,4,8);ctx.fillRect(celestialX-2,celestialY+12,4,8);
    ctx.fillRect(celestialX-20,celestialY-2,8,4);ctx.fillRect(celestialX+12,celestialY-2,8,4);
    ctx.globalAlpha=1;
  }
  // Pixel Moon (square with shadow)
  if(nightFactor>0.3){
    ctx.globalAlpha=nightFactor;
    ctx.fillStyle='#ddddee';ctx.fillRect(canvas.width*0.15-10,celestialY,20,20);
    ctx.fillStyle='#000020';ctx.fillRect(canvas.width*0.15-4,celestialY+2,14,16);
    ctx.globalAlpha=1;
  }
}

// Retro pixel-art parallax hills
function drawMountain(p,col,amp,freq,base){
  const ox=-camera.x*p;ctx.fillStyle=col;
  const step=16; // blocky pixel steps
  ctx.beginPath();ctx.moveTo(0,canvas.height);
  for(let x=0;x<=canvas.width+step;x+=step){
    const wx=x-ox;
    const rawY=canvas.height*base+Math.sin(wx*freq)*amp+Math.sin(wx*freq*2.3+1)*amp*.4;
    const pixY=Math.floor(rawY/4)*4; // snap to pixel grid
    ctx.lineTo(x,pixY);
  }
  ctx.lineTo(canvas.width,canvas.height);ctx.closePath();ctx.fill();
}
function drawBackground(){
  drawSky();
  // Retro hills with flat NES colors
  drawMountain(.03,'#1a0033',70,.0015,.42);
  drawMountain(.06,'#220044',80,.002,.47);
  drawMountain(.1,'#2d1b4e',60,.003,.52);
}

function drawTerrain(){
  const L=Math.floor(camera.x-50),R=Math.ceil(camera.x+canvas.width/zoomLevel+50);
  const m=MAPS[currentMap];
  // Main terrain fill (solid brown dirt)
  ctx.beginPath();ctx.moveTo(0,canvas.height);
  for(let wx=L;wx<=R;wx+=TS)ctx.lineTo(wx-camera.x,getTerrainY(wx)-camera.y);
  ctx.lineTo(canvas.width,canvas.height);ctx.closePath();
  ctx.fillStyle='#8B4513';ctx.fill();

  // Grass top layer (bright green, 6px thick)
  ctx.beginPath();
  for(let wx=L;wx<=R;wx+=TS){
    const sx=wx-camera.x,sy=getTerrainY(wx)-camera.y;
    wx===L?ctx.moveTo(sx,sy):ctx.lineTo(sx,sy);
  }
  ctx.strokeStyle='#00cc00';ctx.lineWidth=6;ctx.stroke();

  // Dark green border below grass
  ctx.beginPath();
  for(let wx=L;wx<=R;wx+=TS){
    const sx=wx-camera.x,sy=getTerrainY(wx)-camera.y+5;
    wx===L?ctx.moveTo(sx,sy):ctx.lineTo(sx,sy);
  }
  ctx.strokeStyle='#006600';ctx.lineWidth=4;ctx.stroke();

  // Brick/block pattern on dirt (Mario underground style)
  ctx.fillStyle='#704214';
  for(let wx=L;wx<=R;wx+=16){
    const sx=wx-camera.x,tsy=getTerrainY(wx)-camera.y+12;
    const row=Math.floor(wx/16);
    for(let by=tsy;by<canvas.height;by+=16){
      const shift=(Math.floor(by/16)%2)?8:0;
      ctx.strokeStyle='#5a3410';ctx.lineWidth=1;
      ctx.strokeRect(Math.floor(sx+shift),Math.floor(by),15,15);
    }
  }

  // Pixel grass tufts on surface
  ctx.fillStyle='#00dd00';
  for(let wx=L;wx<=R;wx+=24){
    const sy=getTerrainY(wx)-camera.y,sx=wx-camera.x;
    ctx.fillRect(Math.floor(sx)-2,Math.floor(sy)-8,4,4);
    ctx.fillRect(Math.floor(sx)+4,Math.floor(sy)-6,4,3);
  }
}

// === PIXEL-ART CAR DRAWING ===
function drawWheel(x,y,r){
  // Blocky tire (dark circle, no gradient)
  ctx.fillStyle='#111';ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fill();
  ctx.strokeStyle='#333';ctx.lineWidth=2;ctx.stroke();
  // Pixel rim (inner square)
  ctx.save();ctx.translate(x,y);ctx.rotate(wheelRot);
  ctx.fillStyle='#888';
  const rs=r*.45;ctx.fillRect(-rs,-rs,rs*2,rs*2);
  // Cross spokes
  ctx.fillStyle='#555';
  ctx.fillRect(-r*.7,-1.5,r*1.4,3);ctx.fillRect(-1.5,-r*.7,3,r*1.4);
  ctx.restore();
  // Hub dot
  ctx.fillStyle='#aaa';ctx.fillRect(x-2,y-2,4,4);
}

function drawSpring(x1,y1,x2,y2){
  // Simple pixel line
  ctx.strokeStyle='#888';ctx.lineWidth=2;
  ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);ctx.stroke();
}

function drawCar(){
  const v=getVeh();
  const sx=car.x-camera.x,sy=car.y-camera.y;
  ctx.save();ctx.translate(sx,sy);ctx.rotate(car.angle+car.bodyTilt);
  const wb=v.wb,wr=v.wr,rWY=wr*.4+car.rearSusp,fWY=wr*.4+car.frontSusp,bY=-6;
  drawSpring(-wb/2,bY,-wb/2,rWY-wr*.3);drawSpring(wb/2,bY,wb/2,fWY-wr*.3);

  if(v.type==='rickshaw'){
    // === AUTHENTIC AUTO RICKSHAW ===
    const hw=wb/2;
    // Lower body (green with gradient)
    const bodyG=ctx.createLinearGradient(-hw-8,-10,hw+12,bY);
    bodyG.addColorStop(0,v.c1);bodyG.addColorStop(.5,'#22c55e');bodyG.addColorStop(1,v.c2);
    ctx.fillStyle=bodyG;
    ctx.beginPath();
    ctx.moveTo(-hw-10,bY);ctx.lineTo(-hw-10,-10);
    ctx.quadraticCurveTo(-hw-8,-14,-hw+2,-14);
    ctx.lineTo(hw-8,-14);ctx.lineTo(hw+12,-10);
    ctx.lineTo(hw+14,bY);ctx.closePath();ctx.fill();
    ctx.strokeStyle='#0d7a3a';ctx.lineWidth=1.5;ctx.stroke();

    // Rear panel (darker green, back of rickshaw)
    ctx.fillStyle='#15803d';
    ctx.fillRect(-hw-10,-28,-0,-28+14); // skip, use shape
    ctx.beginPath();ctx.moveTo(-hw-10,-10);ctx.lineTo(-hw-10,-28);
    ctx.lineTo(-hw-2,-28);ctx.lineTo(-hw-2,-14);ctx.closePath();ctx.fill();
    ctx.strokeStyle='#0d6d32';ctx.lineWidth=1;ctx.stroke();

    // Dark canopy/roof
    ctx.fillStyle='#3a3a3a';
    ctx.beginPath();
    ctx.moveTo(-hw-6,-28);ctx.lineTo(hw-4,-28);
    ctx.quadraticCurveTo(hw+2,-32,hw-2,-38);
    ctx.lineTo(-hw+2,-38);
    ctx.quadraticCurveTo(-hw-8,-32,-hw-6,-28);
    ctx.closePath();ctx.fill();
    ctx.strokeStyle='#2a2a2a';ctx.lineWidth=1;ctx.stroke();

    // Roof edge trim (green)
    ctx.strokeStyle=v.c1;ctx.lineWidth=1.5;
    ctx.beginPath();ctx.moveTo(-hw-6,-28);ctx.lineTo(hw-4,-28);ctx.stroke();

    // Open passenger area (window/opening)
    ctx.fillStyle='rgba(200,160,100,.15)';
    ctx.beginPath();
    ctx.moveTo(-hw,-14);ctx.lineTo(-hw,-28);
    ctx.lineTo(hw-8,-28);ctx.lineTo(hw-8,-14);
    ctx.closePath();ctx.fill();
    // Window frame pillars
    ctx.strokeStyle='#0d7a3a';ctx.lineWidth=2;
    ctx.beginPath();ctx.moveTo(-hw,-28);ctx.lineTo(-hw,-14);ctx.stroke();
    ctx.beginPath();ctx.moveTo(hw-8,-28);ctx.lineTo(hw-8,-14);ctx.stroke();
    // Hanging straps
    ctx.strokeStyle='rgba(80,60,40,.5)';ctx.lineWidth=1;
    for(let i=0;i<3;i++){const sx=-hw+8+i*10;
      ctx.beginPath();ctx.moveTo(sx,-28);ctx.lineTo(sx+1,-20);ctx.stroke();}

    // Front nose (green, tapered)
    const ng=ctx.createLinearGradient(hw-8,-14,hw+16,bY);
    ng.addColorStop(0,v.c1);ng.addColorStop(1,v.c2);
    ctx.fillStyle=ng;
    ctx.beginPath();
    ctx.moveTo(hw-8,-14);ctx.lineTo(hw+12,-10);
    ctx.lineTo(hw+16,-4);ctx.lineTo(hw+14,bY);
    ctx.lineTo(hw-8,bY);ctx.closePath();ctx.fill();
    ctx.strokeStyle='#0d7a3a';ctx.lineWidth=1;ctx.stroke();

    // Headlight
    ctx.fillStyle='#fffbe6';ctx.shadowColor='#ffe066';ctx.shadowBlur=10;
    ctx.beginPath();ctx.arc(hw+14,-6,3.5,0,Math.PI*2);ctx.fill();
    ctx.shadowBlur=0;
    ctx.strokeStyle='#bbb';ctx.lineWidth=1;ctx.stroke();

    // Tail light (red)
    ctx.fillStyle='#dc2626';ctx.shadowColor='#ef4444';ctx.shadowBlur=4;
    ctx.fillRect(-hw-12,-12,4,5);
    ctx.shadowBlur=0;

    // Floral decorations (simplified)
    // Back panel flower
    ctx.fillStyle='#e11d48';
    ctx.beginPath();ctx.arc(-hw-6,-20,3,0,Math.PI*2);ctx.fill();
    ctx.fillStyle='#fbbf24';
    ctx.beginPath();ctx.arc(-hw-6,-20,1.5,0,Math.PI*2);ctx.fill();
    // Petals around
    ctx.fillStyle='#fb7185';
    for(let i=0;i<5;i++){const a=(i/5)*Math.PI*2;
      ctx.beginPath();ctx.arc(-hw-6+Math.cos(a)*5,-20+Math.sin(a)*5,1.5,0,Math.PI*2);ctx.fill();}
    // Side flower
    ctx.fillStyle='#e11d48';
    ctx.beginPath();ctx.arc(-hw/2,-8,2.5,0,Math.PI*2);ctx.fill();
    ctx.fillStyle='#fbbf24';
    ctx.beginPath();ctx.arc(-hw/2,-8,1.2,0,Math.PI*2);ctx.fill();
    // Leaf vines on body
    ctx.strokeStyle='#15803d';ctx.lineWidth=1;
    ctx.beginPath();ctx.moveTo(-hw/2-8,-10);ctx.quadraticCurveTo(-hw/2-4,-14,-hw/2,-10);ctx.stroke();
    ctx.beginPath();ctx.moveTo(-hw/2,-10);ctx.quadraticCurveTo(-hw/2+4,-14,-hw/2+8,-10);ctx.stroke();
    // Front pillar decorative dots
    ctx.fillStyle='#fb7185';
    for(let i=0;i<3;i++){ctx.beginPath();ctx.arc(hw-10,-16-i*4,1.2,0,Math.PI*2);ctx.fill();}

    // Driver (side view, blue shirt)
    // Body
    ctx.fillStyle='#312e81';
    ctx.beginPath();ctx.moveTo(hw/3-2,-14);ctx.lineTo(hw/3+6,-14);
    ctx.lineTo(hw/3+6,-24);ctx.lineTo(hw/3-2,-24);ctx.closePath();ctx.fill();
    // Arms (reaching for handlebars)
    ctx.strokeStyle='#fcd5b4';ctx.lineWidth=2;
    ctx.beginPath();ctx.moveTo(hw/3+6,-22);ctx.lineTo(hw-2,-18);ctx.stroke();
    // Head
    ctx.fillStyle='#fcd5b4';
    ctx.beginPath();ctx.arc(hw/3+2,-28,4.5,0,Math.PI*2);ctx.fill();
    // Hair (black)
    ctx.fillStyle='#1a1a1a';
    ctx.beginPath();ctx.arc(hw/3+2,-30,4.5,Math.PI,0);ctx.fill();
    // Seat
    ctx.fillStyle='#444';
    ctx.fillRect(hw/3-4,-14,12,3);

    // Front fender/mudguard
    ctx.fillStyle=v.c2;
    ctx.beginPath();ctx.arc(hw,rWY,wr+3,Math.PI,0);ctx.fill();
    ctx.strokeStyle='#0d6d32';ctx.lineWidth=1;ctx.stroke();

  }else if(v.type==='bike'){
    // === MOUNTAIN BIKE ===
    // Frame triangle
    ctx.strokeStyle=v.c1;ctx.lineWidth=3;
    ctx.beginPath();ctx.moveTo(-wb/2,-6);ctx.lineTo(0,-22);ctx.lineTo(wb/2,-6);ctx.closePath();ctx.stroke();
    // Down tube
    ctx.beginPath();ctx.moveTo(0,-22);ctx.lineTo(-wb/4,-6);ctx.stroke();
    // Seat post
    ctx.strokeStyle=v.c2;ctx.lineWidth=2;
    ctx.beginPath();ctx.moveTo(-wb/4+2,-8);ctx.lineTo(-wb/4-2,-18);ctx.stroke();
    // Saddle
    ctx.fillStyle='#333';ctx.fillRect(-wb/4-6,-19,10,3);
    // Handlebar
    ctx.strokeStyle='#555';ctx.lineWidth=2.5;
    ctx.beginPath();ctx.moveTo(wb/2-4,-12);ctx.lineTo(wb/2+4,-18);ctx.stroke();
    // Rider body
    ctx.fillStyle='#fdd';ctx.beginPath();ctx.arc(-wb/4+2,-24,5,0,Math.PI*2);ctx.fill(); // head
    ctx.strokeStyle='#e74c3c';ctx.lineWidth=2.5;
    ctx.beginPath();ctx.moveTo(-wb/4+2,-19);ctx.lineTo(-wb/6,-10);ctx.stroke(); // body
    ctx.beginPath();ctx.moveTo(-wb/6,-10);ctx.lineTo(-wb/2+2,-4);ctx.stroke(); // leg
    ctx.beginPath();ctx.moveTo(-wb/4+2,-17);ctx.lineTo(wb/4,-14);ctx.stroke(); // arm
    // Pedal
    ctx.fillStyle='#666';ctx.fillRect(-wb/6-3,-5,6,3);

  }else if(v.type==='car'){
    // === SEDAN CAR ===
    const cg=ctx.createLinearGradient(-wb/2-12,-22,wb/2+16,bY);
    cg.addColorStop(0,v.c2);cg.addColorStop(1,v.c1);
    ctx.fillStyle=cg;
    ctx.beginPath();ctx.moveTo(-wb/2-10,bY);ctx.lineTo(wb/2+14,bY);
    ctx.quadraticCurveTo(wb/2+18,-4,wb/2+14,-18);ctx.lineTo(-wb/2-4,-18);
    ctx.quadraticCurveTo(-wb/2-10,-4,-wb/2-10,bY);ctx.closePath();ctx.fill();
    ctx.strokeStyle='rgba(0,0,0,.3)';ctx.lineWidth=1.5;ctx.stroke();
    // Roof
    const rg=ctx.createLinearGradient(0,-36,wb/2,-18);
    rg.addColorStop(0,v.c1);rg.addColorStop(1,v.c2);
    ctx.fillStyle=rg;
    ctx.beginPath();ctx.moveTo(-6,-18);ctx.lineTo(wb/2,-18);
    ctx.quadraticCurveTo(wb/2+2,-22,wb/2-4,-34);
    ctx.lineTo(2,-34);ctx.quadraticCurveTo(-4,-22,-6,-18);ctx.closePath();ctx.fill();ctx.stroke();
    // Windshield
    const wg=ctx.createLinearGradient(0,-34,wb/2,-18);
    wg.addColorStop(0,'rgba(100,180,255,.6)');wg.addColorStop(1,'rgba(180,220,255,.4)');
    ctx.fillStyle=wg;
    ctx.beginPath();ctx.moveTo(-2,-19);ctx.lineTo(wb/2-2,-19);
    ctx.lineTo(wb/2-6,-32);ctx.lineTo(4,-32);ctx.closePath();ctx.fill();
    // Shine
    ctx.strokeStyle='rgba(255,255,255,.3)';ctx.lineWidth=1;
    ctx.beginPath();ctx.moveTo(6,-30);ctx.lineTo(10,-22);ctx.stroke();
    // Door line
    ctx.strokeStyle='rgba(0,0,0,.15)';ctx.lineWidth=1;
    ctx.beginPath();ctx.moveTo(wb/6,-18);ctx.lineTo(wb/6,bY);ctx.stroke();
    // Driver
    ctx.fillStyle='#fdd';ctx.beginPath();ctx.arc(wb/4-2,-28,4.5,0,Math.PI*2);ctx.fill();
    // Headlight
    ctx.fillStyle='rgba(255,238,150,.9)';ctx.shadowColor='#ffe';ctx.shadowBlur=8;
    ctx.fillRect(wb/2+10,-16,5,5);ctx.shadowBlur=0;
    // Tail light
    ctx.fillStyle='rgba(255,50,50,.8)';ctx.fillRect(-wb/2-10,-16,4,4);

  }else if(v.type==='truck'){
    // === HEAVY TRUCK ===
    // Flatbed
    ctx.fillStyle='#555';
    ctx.fillRect(-wb/2-8,bY-12,wb*0.55,12);
    // Cab
    const cg=ctx.createLinearGradient(wb/2-wb*0.4,-34,wb/2+14,bY);
    cg.addColorStop(0,v.c1);cg.addColorStop(1,v.c2);
    ctx.fillStyle=cg;
    ctx.beginPath();
    ctx.moveTo(wb/2-wb*0.35,bY);ctx.lineTo(wb/2+14,bY);
    ctx.lineTo(wb/2+12,-16);ctx.lineTo(wb/2+8,-32);
    ctx.lineTo(wb/2-wb*0.35,-32);ctx.closePath();ctx.fill();
    ctx.strokeStyle='rgba(0,0,0,.3)';ctx.lineWidth=1.5;ctx.stroke();
    // Cab windshield
    ctx.fillStyle='rgba(100,180,255,.5)';
    ctx.beginPath();ctx.moveTo(wb/2+6,-30);ctx.lineTo(wb/2+10,-16);
    ctx.lineTo(wb/2+6,-16);ctx.lineTo(wb/2+2,-30);ctx.closePath();ctx.fill();
    // Side window
    ctx.fillRect(wb/2-wb*0.3,-28,wb*0.2,10);
    // Exhaust pipe
    ctx.fillStyle='#444';ctx.fillRect(-wb/2-12,-4,4,10);
    // Bumper
    ctx.fillStyle='#777';ctx.fillRect(wb/2+10,-6,6,12);
    // Headlight
    ctx.fillStyle='#ffe';ctx.shadowColor='#ff8';ctx.shadowBlur=6;
    ctx.beginPath();ctx.arc(wb/2+14,-10,3.5,0,Math.PI*2);ctx.fill();ctx.shadowBlur=0;
    // Driver
    ctx.fillStyle='#fdd';ctx.beginPath();ctx.arc(wb/2-wb*0.15,-26,4,0,Math.PI*2);ctx.fill();
    // Cargo
    ctx.fillStyle='rgba(139,92,246,.3)';
    ctx.fillRect(-wb/2-6,bY-22,wb*0.45,10);
    ctx.strokeStyle='rgba(255,255,255,.1)';ctx.lineWidth=1;
    ctx.strokeRect(-wb/2-6,bY-22,wb*0.45,10);

  }else if(v.type==='lorry'){
    // === LONG LORRY ===
    // Trailer
    ctx.fillStyle='#444';
    ctx.fillRect(-wb/2-10,bY-16,wb*0.65,16);
    // Cargo container
    const tg=ctx.createLinearGradient(-wb/2-10,-36,wb*0.15,-16);
    tg.addColorStop(0,v.c1);tg.addColorStop(1,v.c2);
    ctx.fillStyle=tg;
    ctx.fillRect(-wb/2-8,bY-36,wb*0.6,20);
    ctx.strokeStyle='rgba(0,0,0,.3)';ctx.lineWidth=1.5;
    ctx.strokeRect(-wb/2-8,bY-36,wb*0.6,20);
    // Container details
    ctx.strokeStyle='rgba(255,255,255,.08)';ctx.lineWidth=1;
    for(let i=1;i<4;i++)ctx.strokeRect(-wb/2-8+i*(wb*0.15),bY-36,wb*0.15,20);
    // Cab
    const cg=ctx.createLinearGradient(wb/2-wb*0.25,-38,wb/2+16,bY);
    cg.addColorStop(0,v.c2);cg.addColorStop(1,v.c1);
    ctx.fillStyle=cg;
    ctx.beginPath();
    ctx.moveTo(wb/2-wb*0.25,bY);ctx.lineTo(wb/2+16,bY);
    ctx.lineTo(wb/2+14,-14);ctx.lineTo(wb/2+10,-34);
    ctx.lineTo(wb/2-wb*0.25,-34);ctx.closePath();ctx.fill();
    ctx.strokeStyle='rgba(0,0,0,.3)';ctx.lineWidth=1.5;ctx.stroke();
    // Cab windshield
    ctx.fillStyle='rgba(100,180,255,.5)';
    ctx.beginPath();ctx.moveTo(wb/2+8,-32);ctx.lineTo(wb/2+12,-14);
    ctx.lineTo(wb/2+8,-14);ctx.lineTo(wb/2+4,-32);ctx.closePath();ctx.fill();
    // Side window
    ctx.fillRect(wb/2-wb*0.2,-30,wb*0.12,12);
    // Headlight
    ctx.fillStyle='#ffe';ctx.shadowColor='#ff8';ctx.shadowBlur=8;
    ctx.beginPath();ctx.arc(wb/2+14,-8,4,0,Math.PI*2);ctx.fill();ctx.shadowBlur=0;
    // Tail light
    ctx.fillStyle='rgba(255,50,50,.8)';ctx.fillRect(-wb/2-10,-24,4,6);
    // Driver
    ctx.fillStyle='#fdd';ctx.beginPath();ctx.arc(wb/2-wb*0.1,-28,4,0,Math.PI*2);ctx.fill();
    // Extra rear wheels
    drawWheel(-wb/2+10,rWY,wr*0.85);
  }

  // Exhaust for motor vehicles
  if(v.type!=='bike'&&gasPressed&&fuel>0){
    ctx.globalAlpha=.4;ctx.fillStyle='#888';
    for(let i=0;i<3;i++){ctx.beginPath();ctx.arc(-wb/2-15-Math.random()*12,-8-Math.random()*10,2+Math.random()*4,0,Math.PI*2);ctx.fill();}
    ctx.globalAlpha=1;
  }
  // Wheels
  drawWheel(-wb/2,rWY,wr);drawWheel(wb/2,fWY,wr);
  ctx.restore();
}

// Draw vehicle preview on canvas (for garage/select screen)
function drawVehiclePreview(c,vIdx){
  const gctx=c.getContext('2d');
  const v=VEHICLES[vIdx];
  gctx.clearRect(0,0,c.width,c.height);
  // Ground line
  const gy=c.height*0.78;
  gctx.strokeStyle='rgba(255,255,255,.1)';gctx.lineWidth=1;
  gctx.beginPath();gctx.moveTo(20,gy);gctx.lineTo(c.width-20,gy);gctx.stroke();
  gctx.save();gctx.translate(c.width/2,gy);
  const wb=v.wb,wr=v.wr;

  if(v.type==='rickshaw'){
    const hw=wb/2,bY=-6;
    // Lower body
    const bodyG=gctx.createLinearGradient(-hw-8,-10,hw+12,bY);
    bodyG.addColorStop(0,v.c1);bodyG.addColorStop(.5,'#22c55e');bodyG.addColorStop(1,v.c2);
    gctx.fillStyle=bodyG;
    gctx.beginPath();gctx.moveTo(-hw-10,bY);gctx.lineTo(-hw-10,-10);
    gctx.quadraticCurveTo(-hw-8,-14,-hw+2,-14);gctx.lineTo(hw-8,-14);
    gctx.lineTo(hw+12,-10);gctx.lineTo(hw+14,bY);gctx.closePath();gctx.fill();
    gctx.strokeStyle='#0d7a3a';gctx.lineWidth=1.5;gctx.stroke();
    // Rear panel
    gctx.fillStyle='#15803d';
    gctx.beginPath();gctx.moveTo(-hw-10,-10);gctx.lineTo(-hw-10,-28);
    gctx.lineTo(-hw-2,-28);gctx.lineTo(-hw-2,-14);gctx.closePath();gctx.fill();
    // Dark canopy
    gctx.fillStyle='#3a3a3a';
    gctx.beginPath();gctx.moveTo(-hw-6,-28);gctx.lineTo(hw-4,-28);
    gctx.quadraticCurveTo(hw+2,-32,hw-2,-38);gctx.lineTo(-hw+2,-38);
    gctx.quadraticCurveTo(-hw-8,-32,-hw-6,-28);gctx.closePath();gctx.fill();
    // Roof trim
    gctx.strokeStyle=v.c1;gctx.lineWidth=1.5;
    gctx.beginPath();gctx.moveTo(-hw-6,-28);gctx.lineTo(hw-4,-28);gctx.stroke();
    // Open area
    gctx.fillStyle='rgba(200,160,100,.15)';
    gctx.fillRect(-hw,-28,wb-8,14);
    // Front nose
    const ng=gctx.createLinearGradient(hw-8,-14,hw+16,bY);ng.addColorStop(0,v.c1);ng.addColorStop(1,v.c2);
    gctx.fillStyle=ng;
    gctx.beginPath();gctx.moveTo(hw-8,-14);gctx.lineTo(hw+12,-10);
    gctx.lineTo(hw+16,-4);gctx.lineTo(hw+14,bY);gctx.lineTo(hw-8,bY);gctx.closePath();gctx.fill();
    // Headlight
    gctx.fillStyle='#fffbe6';gctx.beginPath();gctx.arc(hw+14,-6,3,0,Math.PI*2);gctx.fill();
    // Tail light
    gctx.fillStyle='#dc2626';gctx.fillRect(-hw-12,-12,4,5);
    // Flower on back
    gctx.fillStyle='#e11d48';gctx.beginPath();gctx.arc(-hw-6,-20,3,0,Math.PI*2);gctx.fill();
    gctx.fillStyle='#fbbf24';gctx.beginPath();gctx.arc(-hw-6,-20,1.5,0,Math.PI*2);gctx.fill();
    gctx.fillStyle='#fb7185';
    for(let i=0;i<5;i++){const a=(i/5)*Math.PI*2;gctx.beginPath();gctx.arc(-hw-6+Math.cos(a)*5,-20+Math.sin(a)*5,1.5,0,Math.PI*2);gctx.fill();}
    // Driver
    gctx.fillStyle='#312e81';gctx.fillRect(hw/3-2,-24,8,10);
    gctx.fillStyle='#fcd5b4';gctx.beginPath();gctx.arc(hw/3+2,-28,4.5,0,Math.PI*2);gctx.fill();
    gctx.fillStyle='#1a1a1a';gctx.beginPath();gctx.arc(hw/3+2,-30,4.5,Math.PI,0);gctx.fill();
  }else if(v.type==='bike'){
    gctx.strokeStyle=v.c1;gctx.lineWidth=3;
    gctx.beginPath();gctx.moveTo(-wb/2,-6);gctx.lineTo(0,-22);gctx.lineTo(wb/2,-6);gctx.closePath();gctx.stroke();
    gctx.beginPath();gctx.moveTo(0,-22);gctx.lineTo(-wb/4,-6);gctx.stroke();
    gctx.fillStyle='#333';gctx.fillRect(-wb/4-6,-19,10,3);
    gctx.fillStyle='#fdd';gctx.beginPath();gctx.arc(-wb/4+2,-24,5,0,Math.PI*2);gctx.fill();
    gctx.strokeStyle='#e74c3c';gctx.lineWidth=2.5;
    gctx.beginPath();gctx.moveTo(-wb/4+2,-19);gctx.lineTo(-wb/6,-10);gctx.stroke();
  }else if(v.type==='car'){
    const cg=gctx.createLinearGradient(-wb/2-12,-22,wb/2+16,-6);cg.addColorStop(0,v.c2);cg.addColorStop(1,v.c1);
    gctx.fillStyle=cg;gctx.beginPath();gctx.moveTo(-wb/2-10,-6);gctx.lineTo(wb/2+14,-6);
    gctx.quadraticCurveTo(wb/2+18,-10,wb/2+14,-18);gctx.lineTo(-wb/2-4,-18);
    gctx.quadraticCurveTo(-wb/2-10,-10,-wb/2-10,-6);gctx.closePath();gctx.fill();
    gctx.fillStyle=v.c1;gctx.beginPath();gctx.moveTo(-6,-18);gctx.lineTo(wb/2,-18);
    gctx.quadraticCurveTo(wb/2+2,-22,wb/2-4,-34);gctx.lineTo(2,-34);gctx.quadraticCurveTo(-4,-22,-6,-18);gctx.closePath();gctx.fill();
    gctx.fillStyle='rgba(100,180,255,.5)';gctx.beginPath();gctx.moveTo(-2,-19);gctx.lineTo(wb/2-2,-19);
    gctx.lineTo(wb/2-6,-32);gctx.lineTo(4,-32);gctx.closePath();gctx.fill();
  }else if(v.type==='truck'){
    gctx.fillStyle='#555';gctx.fillRect(-wb/2-8,-18,wb*0.55,12);
    const cg=gctx.createLinearGradient(wb/2-wb*0.4,-34,wb/2+14,-6);cg.addColorStop(0,v.c1);cg.addColorStop(1,v.c2);
    gctx.fillStyle=cg;gctx.beginPath();gctx.moveTo(wb/2-wb*0.35,-6);gctx.lineTo(wb/2+14,-6);
    gctx.lineTo(wb/2+12,-16);gctx.lineTo(wb/2+8,-32);gctx.lineTo(wb/2-wb*0.35,-32);gctx.closePath();gctx.fill();
    gctx.fillStyle='rgba(100,180,255,.5)';gctx.fillRect(wb/2-wb*0.3,-28,wb*0.2,10);
    gctx.fillStyle='rgba(139,92,246,.3)';gctx.fillRect(-wb/2-6,-28,wb*0.45,10);
  }else if(v.type==='lorry'){
    gctx.fillStyle='#444';gctx.fillRect(-wb/2-10,-22,wb*0.65,16);
    const tg=gctx.createLinearGradient(-wb/2-10,-42,wb*0.15,-22);tg.addColorStop(0,v.c1);tg.addColorStop(1,v.c2);
    gctx.fillStyle=tg;gctx.fillRect(-wb/2-8,-42,wb*0.6,20);
    gctx.strokeStyle='rgba(255,255,255,.08)';gctx.lineWidth=1;
    for(let i=1;i<4;i++)gctx.strokeRect(-wb/2-8+i*(wb*0.15),-42,wb*0.15,20);
    const cg=gctx.createLinearGradient(wb/2-wb*0.25,-38,wb/2+16,-6);cg.addColorStop(0,v.c2);cg.addColorStop(1,v.c1);
    gctx.fillStyle=cg;gctx.beginPath();gctx.moveTo(wb/2-wb*0.25,-6);gctx.lineTo(wb/2+16,-6);
    gctx.lineTo(wb/2+14,-14);gctx.lineTo(wb/2+10,-34);gctx.lineTo(wb/2-wb*0.25,-34);gctx.closePath();gctx.fill();
    gctx.fillStyle='rgba(100,180,255,.5)';gctx.fillRect(wb/2-wb*0.2,-30,wb*0.12,12);
  }
  // Wheels
  gctx.fillStyle='#1a1a1a';
  gctx.beginPath();gctx.arc(-wb/2,wr*.4,wr,0,Math.PI*2);gctx.fill();
  gctx.beginPath();gctx.arc(wb/2,wr*.4,wr,0,Math.PI*2);gctx.fill();
  gctx.fillStyle='#888';
  gctx.beginPath();gctx.arc(-wb/2,wr*.4,wr*.35,0,Math.PI*2);gctx.fill();
  gctx.beginPath();gctx.arc(wb/2,wr*.4,wr*.35,0,Math.PI*2);gctx.fill();
  if(v.type==='lorry'){gctx.fillStyle='#1a1a1a';gctx.beginPath();gctx.arc(-wb/2+10,wr*.4,wr*.85,0,Math.PI*2);gctx.fill();
  gctx.fillStyle='#888';gctx.beginPath();gctx.arc(-wb/2+10,wr*.4,wr*.3,0,Math.PI*2);gctx.fill();}
  gctx.restore();
}

// === BLOCKS (Buildings - Mario brick style) ===
function drawBlocks(){
  for(const b of blocks){
    const sx=b.x-camera.x,sy=b.y-camera.y;
    if(sx<-100||sx>canvas.width+100)continue;
    ctx.save();ctx.translate(sx,sy);ctx.rotate(b.angle);
    // Shadow
    ctx.fillStyle='rgba(0,0,0,.4)';ctx.fillRect(-b.w/2+3,-b.h/2+3,b.w,b.h);
    // Body (flat color)
    ctx.fillStyle=b.color;ctx.fillRect(-b.w/2,-b.h/2,b.w,b.h);
    // Highlight top
    ctx.fillStyle='rgba(255,255,255,.2)';ctx.fillRect(-b.w/2,-b.h/2,b.w,3);
    // Dark bottom
    ctx.fillStyle='rgba(0,0,0,.2)';ctx.fillRect(-b.w/2,b.h/2-3,b.w,3);
    // Brick mortar lines (pixel grid)
    ctx.strokeStyle='rgba(0,0,0,.3)';ctx.lineWidth=1;
    ctx.strokeRect(-b.w/2,-b.h/2,b.w,b.h);
    // Horizontal mortar
    ctx.beginPath();ctx.moveTo(-b.w/2,0);ctx.lineTo(b.w/2,0);ctx.stroke();
    // Vertical mortar (staggered)
    ctx.beginPath();ctx.moveTo(0,-b.h/2);ctx.lineTo(0,0);ctx.stroke();
    ctx.beginPath();ctx.moveTo(-b.w/4,0);ctx.lineTo(-b.w/4,b.h/2);ctx.stroke();
    ctx.beginPath();ctx.moveTo(b.w/4,0);ctx.lineTo(b.w/4,b.h/2);ctx.stroke();
    ctx.restore();
  }
}
function shadeColor(hex,pct){const n=parseInt(hex.replace('#',''),16);const r=Math.min(255,Math.max(0,(n>>16)+pct));const g=Math.min(255,Math.max(0,((n>>8)&0xff)+pct));const b=Math.min(255,Math.max(0,(n&0xff)+pct));return`rgb(${r},${g},${b})`;}

// === BARRICADES (Dino Run) ===
function drawBarricades(){
  if(gameMode!=='dino')return;
  for(const b of dinoBarricades){
    const sx=b.x-camera.x,sy=b.y-camera.y;
    if(sx<-60||sx>canvas.width+60)continue;
    ctx.save();ctx.translate(sx,sy);
    // Pole
    ctx.fillStyle='#666';ctx.fillRect(-2,-b.h,4,b.h);
    // Barricade body (red/white stripes)
    const bw=b.w,bh=Math.min(b.h*0.6,30);
    ctx.fillStyle='#cc0000';ctx.fillRect(-bw/2,-b.h,bw,bh);
    // White stripe
    ctx.fillStyle='#fff';
    ctx.fillRect(-bw/2,-b.h+bh*0.3,bw,bh*0.35);
    // Border
    ctx.strokeStyle='#880000';ctx.lineWidth=2;ctx.strokeRect(-bw/2,-b.h,bw,bh);
    // Warning sign on tall barricades
    if(b.type==='tall'){
      ctx.fillStyle='#ffcc00';ctx.fillRect(-8,-b.h+bh+4,16,14);
      ctx.fillStyle='#000';
      ctx.font='7px "Press Start 2P",monospace';ctx.textAlign='center';ctx.textBaseline='middle';
      ctx.fillText('!',0,-b.h+bh+11);
    }
    // Shadow at base
    ctx.fillStyle='rgba(0,0,0,.2)';ctx.fillRect(-bw/2-2,0,bw+4,3);
    ctx.restore();
  }

  // Draw dino score (barricades passed) on screen
  if(barricadesPassed>0){
    ctx.font='8px "Press Start 2P",monospace';ctx.textAlign='left';
    ctx.fillStyle='#fff';ctx.fillText('🚧 '+barricadesPassed,10,canvas.height/zoomLevel-10);
  }
}

// === COLLECTIBLES ===
function drawCollectibles(){
  for(const c of collectibles){
    if(c.collected)continue;
    const sx=c.x-camera.x,sy=c.y-camera.y-8-Math.sin(gameTime*3+c.x)*4;
    if(sx<-30||sx>canvas.width+30)continue;
    ctx.save();ctx.translate(sx,sy);
    if(c.type==='coin'){
      // Retro pixel coin (Mario style ? block)
      ctx.fillStyle='#cc8800';ctx.fillRect(-10,-10,20,20);
      ctx.fillStyle='#ffcc00';ctx.fillRect(-8,-8,16,16);
      ctx.fillStyle='#ffee88';ctx.fillRect(-6,-6,12,12);
      ctx.fillStyle='#cc8800';
      // ₹ symbol pixel
      ctx.font='bold 10px "Press Start 2P",monospace';ctx.textAlign='center';ctx.textBaseline='middle';
      ctx.fillText('₹',0,1);
      // Shine pixel
      ctx.fillStyle='#fff';ctx.fillRect(-6,-6,3,3);
    }else{
      // Retro fuel can
      ctx.fillStyle='#006600';ctx.fillRect(-9,-10,18,20);
      ctx.fillStyle='#00aa00';ctx.fillRect(-7,-8,14,16);
      ctx.fillStyle='#fff';
      ctx.font='bold 8px "Press Start 2P",monospace';ctx.textAlign='center';ctx.textBaseline='middle';
      ctx.fillText('F',0,1);
    }
    ctx.restore();
  }
}

// === ROADSIDE STRUCTURES ===
function drawStructures(){
  for(const s of structures){
    const sx=s.x-camera.x,sy=s.y-camera.y;
    if(sx<-80||sx>canvas.width+80)continue;
    ctx.save();ctx.translate(sx,sy);
    if(s.type==='teashop'){
      // Pixel house
      ctx.fillStyle='#884400';ctx.fillRect(-16,-20,32,20);
      ctx.fillStyle='#aa5500';ctx.fillRect(-14,-18,28,16);
      // Roof
      ctx.fillStyle='#cc0000';ctx.fillRect(-20,-24,40,6);
      ctx.fillStyle='#ff2222';ctx.fillRect(-18,-22,36,4);
      // Window
      ctx.fillStyle='#ffdd00';ctx.fillRect(-4,-14,8,8);
      // Sign
      ctx.fillStyle='#fff';ctx.font='5px "Press Start 2P",monospace';ctx.textAlign='center';ctx.fillText('CHAI',0,-26);
    }else if(s.type==='temple'){
      // Pixel temple
      ctx.fillStyle='#cc8844';ctx.fillRect(-12,-16,24,16);
      ctx.fillStyle='#ddaa55';ctx.fillRect(-10,-14,20,12);
      // Roof pyramid
      ctx.fillStyle='#ffaa00';
      ctx.fillRect(-16,-20,32,6);
      ctx.fillRect(-12,-24,24,4);
      ctx.fillRect(-8,-28,16,4);
      // Flag on top
      ctx.fillStyle='#ff4400';ctx.fillRect(-2,-36,4,12);
      ctx.fillStyle='#ff6600';ctx.fillRect(2,-36,8,6);
    }else if(s.type==='tree'){
      // Pixel tree (Mario pipe-style)
      ctx.fillStyle='#553311';ctx.fillRect(-3,-28,6,28);
      // Foliage (blocky)
      ctx.fillStyle='#008800';
      ctx.fillRect(-14,-42,28,16);
      ctx.fillRect(-10,-48,20,8);
      ctx.fillStyle='#00aa00';
      ctx.fillRect(-12,-40,24,12);
      ctx.fillRect(-8,-46,16,6);
      // Highlight
      ctx.fillStyle='#00cc00';ctx.fillRect(-8,-44,4,4);
    }else if(s.type==='sign'){
      // Pixel signpost
      ctx.fillStyle='#666';ctx.fillRect(-1,-26,3,26);
      ctx.fillStyle='#ffcc00';ctx.fillRect(-16,-30,32,10);
      ctx.fillStyle='#cc8800';ctx.strokeStyle='#cc8800';ctx.lineWidth=1;
      ctx.strokeRect(-16,-30,32,10);
      ctx.fillStyle='#000';ctx.font='5px "Press Start 2P",monospace';ctx.textAlign='center';ctx.fillText(distance+'m',0,-23);
    }else if(s.type==='bus'){
      // Pixel bus
      ctx.fillStyle='#cc0000';ctx.fillRect(-22,-18,44,16);
      ctx.fillStyle='#ff2222';ctx.fillRect(-20,-16,40,12);
      // Windows
      ctx.fillStyle='#88ccff';
      for(let i=0;i<4;i++)ctx.fillRect(-18+i*10,-14,7,6);
      // Wheels
      ctx.fillStyle='#111';ctx.fillRect(-18,-2,8,6);ctx.fillRect(10,-2,8,6);
      ctx.fillStyle='#888';ctx.fillRect(-16,0,4,2);ctx.fillRect(12,0,4,2);
    }else if(s.type==='stall'){
      // Pixel stall
      ctx.fillStyle='#cc6600';ctx.fillRect(-12,-16,24,16);
      ctx.fillStyle='#ff8800';ctx.fillRect(-14,-20,28,6);
      // Items (pixel fruits)
      ctx.fillStyle='#00cc00';ctx.fillRect(-6,-10,4,4);
      ctx.fillStyle='#ff0000';ctx.fillRect(0,-10,4,4);
      ctx.fillStyle='#ffcc00';ctx.fillRect(6,-10,4,4);
    }else if(s.type==='light'){
      // Pixel lamppost
      ctx.fillStyle='#666';ctx.fillRect(-1,-38,3,38);
      ctx.fillStyle='#888';ctx.fillRect(-4,-40,9,4);
      // Light glow (pixel)
      ctx.fillStyle='rgba(255,255,100,.15)';
      ctx.fillRect(-16,-2,32,4);
      ctx.fillRect(-12,-6,24,4);
      ctx.fillStyle='#ffff88';ctx.fillRect(-2,-40,5,3);
    }
    ctx.restore();
  }
}

// === OTHER PLAYERS ===
function drawOtherPlayers(){
  for(const id in otherPlayers){
    const p=otherPlayers[id];
    const gY=getTerrainY(p.dx),cY=Math.min(p.dy,gY);
    const sx=p.dx-camera.x,sy=cY-camera.y;
    if(sx<-300||sx>canvas.width+300)continue;
    ctx.save();ctx.globalAlpha=.7;
    // Name tag (pixel)
    ctx.font='8px "Press Start 2P",monospace';ctx.textAlign='center';
    ctx.fillStyle='rgba(0,0,0,.7)';ctx.fillRect(sx-40,sy-55,80,16);
    ctx.fillStyle=p.color||'#fff';ctx.fillText(p.name||'Player',sx,sy-44);
    // Simple pixel car
    ctx.translate(sx,sy);ctx.rotate(p.da||0);
    ctx.fillStyle=p.color||'#cc0000';
    ctx.fillRect(-28,-20,56,14);ctx.fillRect(-4,-30,28,12);
    ctx.fillStyle='#111';ctx.fillRect(-22,-2,10,8);ctx.fillRect(12,-2,10,8);
    ctx.restore();
  }
}

function drawParticles(){for(const p of particles){const sx=p.x-camera.x,sy=p.y-camera.y;ctx.globalAlpha=p.life;ctx.fillStyle='#aaa';ctx.fillRect(Math.floor(sx),Math.floor(sy),Math.floor(p.size*p.life*2),Math.floor(p.size*p.life*2));ctx.globalAlpha=1;}}

// === HEIGHT METER (Retro pixel gauge) ===
function drawHeightMeter(){
  if(gameMode!=='jump')return;
  const mx=canvas.width/zoomLevel-48, my=60, mw=20, mh=canvas.height/zoomLevel-140;
  const maxDisplay=Math.max(maxHeight,50);
  const fillH=Math.min(1,currentHeight/maxDisplay)*mh;
  const bestH=Math.min(1,maxHeight/maxDisplay)*mh;

  // Background bar (pixel, no rounded corners)
  ctx.fillStyle='rgba(0,0,0,.6)';ctx.fillRect(mx,my,mw,mh);
  ctx.strokeStyle='#555';ctx.lineWidth=2;ctx.strokeRect(mx,my,mw,mh);

  // Best height marker
  if(maxHeight>0){
    const bestY=my+mh-bestH;
    ctx.fillStyle='#ffd700';ctx.fillRect(mx-4,bestY-1,mw+8,3);
    ctx.font='6px "Press Start 2P",monospace';ctx.fillStyle='#ffd700';ctx.textAlign='center';
    ctx.fillText('BEST',mx+mw/2,bestY-5);
    ctx.fillText(maxHeight+'m',mx+mw/2,bestY+12);
  }

  // Current fill (solid retro colors)
  if(currentHeight>0){
    const fillTop=my+mh-fillH;
    ctx.fillStyle='#00aaff';ctx.fillRect(mx+2,fillTop,mw-4,fillH);
    // Pixel highlight
    ctx.fillStyle='#44ccff';ctx.fillRect(mx+3,fillTop,3,fillH);
  }

  // Height text (pixel font, shows when airborne)
  if(!car.onGround&&currentHeight>0){
    const hx=canvas.width/zoomLevel/2,hy=90;
    ctx.font='20px "Press Start 2P",monospace';ctx.textAlign='center';
    // Shadow
    ctx.fillStyle='#000';ctx.fillText(currentHeight+'m',hx+2,hy+2);
    // Main color
    const col=currentHeight>maxHeight*0.8?'#ffd700':currentHeight>20?'#00ccff':'#fff';
    ctx.fillStyle=col;ctx.fillText(currentHeight+'m',hx,hy);
    ctx.font='7px "Press Start 2P",monospace';ctx.fillStyle='#888';
    ctx.fillText('ALTITUDE',hx,hy+14);
  }

  // Scale marks
  ctx.font='5px "Press Start 2P",monospace';ctx.fillStyle='#555';ctx.textAlign='right';
  for(let i=0;i<=5;i++){
    const val=Math.round(maxDisplay*i/5);
    const sy=my+mh-mh*i/5;
    ctx.fillText(val+'m',mx-3,sy+2);
    ctx.fillStyle='#333';ctx.fillRect(mx,sy,mw,1);
    ctx.fillStyle='#555';
  }
}

function updateHUD(){
  document.getElementById('distVal').textContent=distance+'m';
  document.getElementById('coinVal').textContent=sessionCoins;
  document.getElementById('fuelBar').style.width=fuel+'%';
  document.getElementById('speedVal').textContent=Math.abs(Math.round(car.vx*8));
  if(gameMode==='jump'){document.getElementById('heightHud').style.display='flex';document.getElementById('heightVal').textContent=currentHeight+'m (Best:'+maxHeight+'m)';}
  if(gameMode==='crack'){document.getElementById('blocksHud').style.display='flex';document.getElementById('blocksVal').textContent=blocksSmashed;}
  if(gameMode==='dino'){document.getElementById('dinoHud').style.display='flex';document.getElementById('dinoVal').textContent=barricadesPassed;}
  if(Object.keys(otherPlayers).length>0){document.getElementById('onlineHud').style.display='flex';document.getElementById('onlineVal').textContent=onlineCount;}
}

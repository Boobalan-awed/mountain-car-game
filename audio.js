// === RETRO AUDIO ENGINE (Web Audio API - No external files) ===
let audioCtx=null,masterGain=null,musicGain=null,sfxGain=null;
let musicPlaying=false,musicInterval=null;
let engineOsc=null,engineGain=null;
let soundEnabled=true,musicEnabled=true;

function initAudio(){
  if(audioCtx)return;
  audioCtx=new(window.AudioContext||window.webkitAudioContext)();
  masterGain=audioCtx.createGain();masterGain.gain.value=0.5;masterGain.connect(audioCtx.destination);
  musicGain=audioCtx.createGain();musicGain.gain.value=0.3;musicGain.connect(masterGain);
  sfxGain=audioCtx.createGain();sfxGain.gain.value=0.6;sfxGain.connect(masterGain);
}

// Resume audio context (needed after user gesture)
function resumeAudio(){
  if(audioCtx&&audioCtx.state==='suspended')audioCtx.resume();
}

// === SOUND EFFECTS ===
function playTone(freq,duration,type='square',vol=0.3,dest=null){
  if(!audioCtx||!soundEnabled)return;
  const o=audioCtx.createOscillator(),g=audioCtx.createGain();
  o.type=type;o.frequency.value=freq;
  g.gain.setValueAtTime(vol,audioCtx.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001,audioCtx.currentTime+duration);
  o.connect(g);g.connect(dest||sfxGain);
  o.start();o.stop(audioCtx.currentTime+duration);
}

function sfxCoin(){
  if(!audioCtx||!soundEnabled)return;
  // Mario-style coin ding: two quick ascending notes
  playTone(988,0.08,'square',0.25);  // B5
  setTimeout(()=>playTone(1319,0.15,'square',0.25),60); // E6
}

function sfxFuel(){
  if(!audioCtx||!soundEnabled)return;
  // Power-up sweep
  const o=audioCtx.createOscillator(),g=audioCtx.createGain();
  o.type='square';o.frequency.setValueAtTime(200,audioCtx.currentTime);
  o.frequency.exponentialRampToValueAtTime(800,audioCtx.currentTime+0.25);
  g.gain.setValueAtTime(0.2,audioCtx.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001,audioCtx.currentTime+0.3);
  o.connect(g);g.connect(sfxGain);o.start();o.stop(audioCtx.currentTime+0.3);
}

function sfxJump(){
  if(!audioCtx||!soundEnabled)return;
  // Quick ascending sweep
  const o=audioCtx.createOscillator(),g=audioCtx.createGain();
  o.type='square';o.frequency.setValueAtTime(150,audioCtx.currentTime);
  o.frequency.exponentialRampToValueAtTime(600,audioCtx.currentTime+0.15);
  g.gain.setValueAtTime(0.2,audioCtx.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001,audioCtx.currentTime+0.2);
  o.connect(g);g.connect(sfxGain);o.start();o.stop(audioCtx.currentTime+0.2);
}

function sfxLand(){
  if(!audioCtx||!soundEnabled)return;
  // Thud - low frequency burst
  playTone(80,0.12,'triangle',0.3);
  playTone(60,0.08,'sawtooth',0.15);
}

function sfxCrash(){
  if(!audioCtx||!soundEnabled)return;
  // Explosion - noise burst + descending tone
  const bufSize=audioCtx.sampleRate*0.4;
  const buf=audioCtx.createBuffer(1,bufSize,audioCtx.sampleRate);
  const data=buf.getChannelData(0);
  for(let i=0;i<bufSize;i++)data[i]=(Math.random()*2-1)*Math.pow(1-i/bufSize,2);
  const src=audioCtx.createBufferSource(),g=audioCtx.createGain();
  src.buffer=buf;g.gain.setValueAtTime(0.4,audioCtx.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001,audioCtx.currentTime+0.4);
  src.connect(g);g.connect(sfxGain);src.start();
  // Descending tone
  const o=audioCtx.createOscillator(),g2=audioCtx.createGain();
  o.type='sawtooth';o.frequency.setValueAtTime(400,audioCtx.currentTime);
  o.frequency.exponentialRampToValueAtTime(50,audioCtx.currentTime+0.3);
  g2.gain.setValueAtTime(0.2,audioCtx.currentTime);
  g2.gain.exponentialRampToValueAtTime(0.001,audioCtx.currentTime+0.35);
  o.connect(g2);g2.connect(sfxGain);o.start();o.stop(audioCtx.currentTime+0.35);
}

function sfxClick(){
  if(!audioCtx||!soundEnabled)return;
  playTone(800,0.05,'square',0.15);
}

function sfxBarricadePass(){
  if(!audioCtx||!soundEnabled)return;
  playTone(660,0.06,'square',0.15);
  setTimeout(()=>playTone(880,0.06,'square',0.15),50);
}

function sfxGameOver(){
  if(!audioCtx||!soundEnabled)return;
  // Sad descending notes
  const notes=[440,370,330,262];
  notes.forEach((n,i)=>setTimeout(()=>playTone(n,0.25,'square',0.2),i*200));
}

// === ENGINE HUM (continuous while driving) ===
function startEngineSound(){
  if(!audioCtx||!soundEnabled||engineOsc)return;
  engineOsc=audioCtx.createOscillator();
  engineGain=audioCtx.createGain();
  engineOsc.type='sawtooth';engineOsc.frequency.value=60;
  engineGain.gain.value=0;
  engineOsc.connect(engineGain);engineGain.connect(sfxGain);
  engineOsc.start();
}
function updateEngineSound(speed){
  if(!engineOsc||!engineGain)return;
  // Pitch and volume scale with speed
  const s=Math.abs(speed);
  engineOsc.frequency.setTargetAtTime(40+s*8,audioCtx.currentTime,0.1);
  engineGain.gain.setTargetAtTime(Math.min(0.06,s*0.008),audioCtx.currentTime,0.1);
}
function stopEngineSound(){
  if(engineOsc){try{engineOsc.stop();}catch(e){}engineOsc=null;engineGain=null;}
}

// === CHIPTUNE BACKGROUND MUSIC ===
const NOTE_FREQS={
  C3:131,D3:147,E3:165,F3:175,G3:196,A3:220,B3:247,
  C4:262,D4:294,E4:330,F4:349,G4:392,A4:440,B4:494,
  C5:523,D5:587,E5:659,F5:698,G5:784,A5:880,B5:988,
  C6:1047,R:0
};

// Melody patterns (Indian-inspired pentatonic + retro feel)
const melodyPatterns=[
  // Pattern 1: Upbeat driving theme
  ['E4','G4','A4','B4','A4','G4','E4','D4',
   'E4','G4','A4','C5','B4','A4','G4','E4'],
  // Pattern 2: Adventure climb
  ['C4','E4','G4','C5','B4','G4','E4','C4',
   'D4','F4','A4','D5','C5','A4','F4','D4'],
  // Pattern 3: Chill groove
  ['A3','C4','E4','A4','G4','E4','C4','A3',
   'B3','D4','G4','B4','A4','G4','D4','B3'],
  // Pattern 4: Victory run
  ['G4','A4','B4','D5','E5','D5','B4','A4',
   'G4','B4','D5','G5','E5','D5','B4','G4']
];

const bassPatterns=[
  ['C3','C3','G3','G3','A3','A3','E3','E3',
   'F3','F3','C3','C3','G3','G3','C3','C3'],
  ['A3','A3','E3','E3','F3','F3','C3','C3',
   'D3','D3','A3','A3','E3','E3','A3','A3']
];

let musicStep=0,currentPattern=0,musicTempo=180; // BPM

function playMusicNote(note,duration,type,vol,delay){
  if(!audioCtx||!musicEnabled||NOTE_FREQS[note]===0)return;
  const t=audioCtx.currentTime+delay;
  const o=audioCtx.createOscillator(),g=audioCtx.createGain();
  o.type=type;o.frequency.value=NOTE_FREQS[note];
  g.gain.setValueAtTime(0,t);
  g.gain.linearRampToValueAtTime(vol,t+0.01);
  g.gain.setValueAtTime(vol,t+duration*0.7);
  g.gain.exponentialRampToValueAtTime(0.001,t+duration);
  o.connect(g);g.connect(musicGain);
  o.start(t);o.stop(t+duration);
}

function musicTick(){
  if(!musicEnabled||!audioCtx)return;
  const beatDur=60/musicTempo;
  const mel=melodyPatterns[currentPattern%melodyPatterns.length];
  const bas=bassPatterns[currentPattern%bassPatterns.length];
  const note=mel[musicStep%mel.length];
  const bassNote=bas[musicStep%bas.length];

  // Melody (square wave - classic chiptune)
  playMusicNote(note,beatDur*0.8,'square',0.12,0);
  // Bass (triangle wave - warm low end)
  playMusicNote(bassNote,beatDur*0.9,'triangle',0.15,0);
  // Arpeggio accent every 4th beat
  if(musicStep%4===0){
    const arpNote=mel[(musicStep+4)%mel.length];
    playMusicNote(arpNote,beatDur*0.2,'square',0.06,beatDur*0.25);
    playMusicNote(arpNote,beatDur*0.2,'square',0.06,beatDur*0.5);
  }
  // Hi-hat rhythm (noise)
  if(musicStep%2===0){
    const bufSize=audioCtx.sampleRate*0.03;
    const buf=audioCtx.createBuffer(1,bufSize,audioCtx.sampleRate);
    const data=buf.getChannelData(0);
    for(let i=0;i<bufSize;i++)data[i]=(Math.random()*2-1)*Math.pow(1-i/bufSize,3);
    const src=audioCtx.createBufferSource(),g=audioCtx.createGain();
    src.buffer=buf;g.gain.setValueAtTime(0.08,audioCtx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001,audioCtx.currentTime+0.04);
    src.connect(g);g.connect(musicGain);src.start();
  }
  // Kick on beat 1 and 3
  if(musicStep%4===0||musicStep%4===2){
    const o=audioCtx.createOscillator(),g=audioCtx.createGain();
    o.type='sine';o.frequency.setValueAtTime(150,audioCtx.currentTime);
    o.frequency.exponentialRampToValueAtTime(40,audioCtx.currentTime+0.08);
    g.gain.setValueAtTime(0.15,audioCtx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001,audioCtx.currentTime+0.1);
    o.connect(g);g.connect(musicGain);o.start();o.stop(audioCtx.currentTime+0.1);
  }

  musicStep++;
  if(musicStep>=16){musicStep=0;currentPattern++;}
}

function startMusic(){
  if(musicPlaying||!musicEnabled)return;
  initAudio();resumeAudio();
  musicStep=0;currentPattern=0;
  musicPlaying=true;
  const beatMs=Math.floor(60000/musicTempo);
  musicInterval=setInterval(musicTick,beatMs);
}

function stopMusic(){
  musicPlaying=false;
  if(musicInterval){clearInterval(musicInterval);musicInterval=null;}
}

function toggleMusic(){
  musicEnabled=!musicEnabled;
  if(musicEnabled&&gameState==='playing')startMusic();
  else stopMusic();
  return musicEnabled;
}

function toggleSound(){
  soundEnabled=!soundEnabled;
  if(!soundEnabled)stopEngineSound();
  return soundEnabled;
}

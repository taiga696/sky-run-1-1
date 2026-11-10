// ============================================================
// Sky Run 1-1 — ヘッドレス自動プレイテストハーネス
// ブラウザ描画なしでゲームロジックだけを再現し、AI botで自動プレイ→バグ検出
// ============================================================
'use strict';

// ---- Three.js スタブ（ジオメトリ/マテリアルはダミー、position だけ使う） ----
function makeVec3(x=0,y=0,z=0){ return {x,y,z, set(a,b,c){this.x=a;this.y=b;this.z=c;}, setScalar(v){this.x=this.y=this.z=v;} }; }
class StubObj {
  constructor(){ this.position=makeVec3(); this.scale=makeVec3(1,1,1); this.rotation=makeVec3(); this.visible=true; this.children=[]; }
  add(o){ this.children.push(o); }
  remove(){ }
}
class StubScene extends StubObj { constructor(){ super(); } add(){ } remove(){ } }
function stubThree(){
  global.THREE = {
    Scene: StubScene,
    Group: StubObj,
    Mesh: class extends StubObj { constructor(g,m){ super(); this.geometry=g; this.material=m; } },
    BoxGeometry: class { constructor(){ } },
    CylinderGeometry: class { constructor(){ } },
    SphereGeometry: class { constructor(){ } },
    MeshLambertMaterial: class { constructor(o){ this.color=o&&o.color; } },
    Color: class { constructor(c){ this.c=c; } },
    PerspectiveCamera: class extends StubObj {},
    WebGLRenderer: class { constructor(){ } setSize(){} setPixelRatio(){} render(){} },
    AmbientLight: class extends StubObj {},
    DirectionalLight: class extends StubObj { constructor(){ super(); this.shadow={mapSize:{set(){}},camera:{}}; this.target=makeVec3(); } },
    PCFSoftShadowMap: 1,
    Fog: class {},
  };
}
stubThree();

// ---- DOM スタブ ----
const els = {};
function stubEl(id){ return els[id] || (els[id]={ textContent:'', style:{}, classList:{add(){},remove(){},contains(){return false;}}, addEventListener(){} }); }
global.document = {
  getElementById: stubEl,
  createElement: ()=>({ style:{}, appendChild(){}, setAttribute(){} }),
  head:{ appendChild(){} },
};
global.window = { addEventListener(){}, innerWidth:800, innerHeight:600, devicePixelRatio:1, AudioContext:null, webkitAudioContext:null };
if(!global.navigator) global.navigator = {};
global.navigator.serviceWorker = null;
global.performance = { now: ()=>Date.now() };

// ---- ゲームロジック（HTMLから移植・純粋化） ----
// 定数
const GRAVITY=-42, JUMP_V=18.4, JUMP_CUT=0.42, COYOTE=0.11, BUFFER=0.12, PLAYER_HALF=0.35;

// マテリアル（色だけ。ロジックでは未使用だが破壊判定で material 差し替えがあるためダミー保持）
const mat = { brick:{__brick:true}, question:{__q:true}, ground:{}, dirt:{}, pipe:{}, goomba:{}, coin:{}, player:{}, skin:{}, flag:{}, pole:{}, cloud:{}, castle:{}, stair:{}, bush:{}, hill:{} };

// ---- シミュレータ本体 ----
class Game {
  constructor(seed){
    this.rng = mulberry32(seed);
    this.scene = new StubScene();
    this.reset(1);
  }
  reset(level){
    this.level = level;
    this.runSpeed = 9.5 + Math.min(6,(level-1)*0.7);
    this.levelLen = 70;
    this.FLAG_X = this.levelLen;
    this.solids=[]; this.items=[]; this.groundGaps=[];
    this.player = makeVec3(0,0,0);
    this.velY=0; this.onGround=false; this.coyoteTimer=0; this.bufferTimer=0; this.holding=false; this.airJumps=0;
    this.score=0; this.coins=0; this.flagReached=false; this.dead=false; this.deadReason='';
    this.win=false;
    this.buildLevel();
  }
  // ---- 乱数（再現性のためシード固定） ----
  rand(){ return this.rng(); }

  buildLevel(){
    const lv=this.level;
    const maxGapW = 3 + Math.min(3, lv*0.4);
    const goombaCount = 2 + Math.min(6, lv);
    const pipeCount = lv < 3 ? 1 : 2;
    const gapCount = 1 + Math.min(3, Math.floor(lv/2));
    // 穴生成
    const safeStart=20, safeEnd=this.levelLen-20;
    for(let i=0;i<gapCount;i++){
      for(let t=0;t<20;t++){
        const gx=safeStart+this.rand()*(safeEnd-safeStart);
        const gw=2.5+this.rand()*maxGapW;
        if(this.groundGaps.every(g=>gx>g[1]+6||gx+gw<g[0]-6)){ this.groundGaps.push([gx,gx+gw]); break; }
      }
    }
    this.groundGaps.sort((a,b)=>a[0]-b[0]);
    const inGap=(x)=>this.groundGaps.some(g=>x>g[0]&&x<g[1]);
    // 地面（穴の「間」だけを生成。穴区間そのものには地面を作らない＝実ゲームと同一ロジック）
    const x0=-10,x1=this.levelLen+60; let segStart=x0;
    const buildSeg=(a,b)=>{ if(b-a>0.5){ this.solids.push({x:(a+b)/2, halfW:(b-a)/2, top:0, deadly:false, ground:true}); } };
    for(const g of this.groundGaps){ buildSeg(segStart,g[0]); segStart=g[1]; }
    buildSeg(segStart,x1);
    // パイプ（両側に着地スペースLANDを保証＝理不尽死を防ぐ・実ゲームと同一ロジック）
    const occupied=[];
    const LAND=2.5;
    const free=(x,w)=>{
      if(occupied.some(o=>x<o[1]+8&&x+w>o[0]-8)) return false;
      const l=x-w/2, r=x+w/2;
      for(const g of this.groundGaps){ if(l-LAND<g[1]&&r+LAND>g[0]) return false; }
      return true;
    };
    const occupy=(x,w)=>occupied.push([x-w/2,x+w/2]);
    for(let i=0;i<pipeCount;i++){
      let placed=false;
      for(let t=0;t<30;t++){
        const px=18+this.rand()*(this.levelLen-38);
        if(free(px,2)){ this.solids.push({x:px,halfW:1.05,top:2.0+this.rand()*0.6,deadly:true,pipe:true}); occupy(px,2); placed=true; break; }
      }
      if(!placed){ const fx=30+i*20; if(free(fx,2)){ this.solids.push({x:fx,halfW:1.05,top:2.2,deadly:true,pipe:true}); occupy(fx,2);} }
    }
    // 浮遊ブロック
    const blockRows=2+Math.floor(lv/2);
    for(let i=0;i<blockRows;i++){
      for(let t=0;t<20;t++){
        const bx=14+this.rand()*(this.levelLen-34);
        if(free(bx,6)){
          const n=3+Math.floor(this.rand()*3);
          for(let k=0;k<n;k++){
            const kind=this.rand()<0.4?'q':'brick';
            const y=3.2;
            this.items.push({type:kind,x:bx+k*1.6,y,used:false});
            this.solids.push({x:bx+k*1.6,halfW:0.8,top:y+0.8,deadly:false,block:true});
          }
          occupy(bx,n*1.6); break;
        }
      }
    }
    // クリボー
    for(let i=0;i<goombaCount;i++){
      for(let t=0;t<20;t++){
        const gx=14+this.rand()*(this.levelLen-30);
        if(free(gx,3)){ this.items.push({type:'goomba',x:gx,baseX:gx,mx:gx,dir:this.rand()<0.5?1:-1,alive:true}); occupy(gx,3); break; }
      }
    }
    // コイン
    const coinArcs=2+Math.floor(lv/2);
    for(let i=0;i<coinArcs;i++){
      const cx=18+this.rand()*(this.levelLen-34);
      if(inGap(cx)) continue;
      for(let k=0;k<3;k++) this.items.push({type:'coin',x:cx+k*1.5,y:2.2+Math.sin(k/2*Math.PI)*1.4,alive:true});
    }
    // 大階段（低い段は歩いて登れる、高い段はdeadly）
    const stairBase=this.levelLen-26;
    for(let k=0;k<5;k++){ this.solids.push({x:stairBase+k*3,halfW:1,top:1.2+k*1.2,deadly:k>=2,stair:true}); }
  }

  supportAt(px, refY, includeDeadly){
    let best=-1e9;
    const onHole=this.groundGaps.some(g=>px>g[0]&&px<g[1]);
    if(!onHole && 0<=refY+0.25) best=0;
    for(const s of this.solids){
      if(s.top===0) continue;
      if(s.deadly && !includeDeadly) continue; // deadlyソリッドは段差昇降では無視
      if(Math.abs(s.x-px)<s.halfW+PLAYER_HALF){ if(s.top<=refY+0.25&&s.top>best) best=s.top; }
    }
    return best;
  }

  pressJump(){ this.bufferTimer=BUFFER; this.holding=true; }
  releaseJump(){ this.holding=false; if(this.velY>0) this.velY*=JUMP_CUT; }
  tryJump(){
    if(this.onGround||this.coyoteTimer>0){
      this.velY=JUMP_V; this.onGround=false; this.coyoteTimer=0; this.bufferTimer=0; this.airJumps=2;
    } else if(this.airJumps>0){ this.velY=JUMP_V*0.92; this.airJumps--; }
  }

  step(dt){
    if(this.dead||this.win) return;
    const prevY=this.player.y;
    const prevX=this.player.x;
    this.player.x += this.runSpeed*dt;
    const px=this.player.x;
    if(this.coyoteTimer>0) this.coyoteTimer-=dt;
    if(this.bufferTimer>0){ this.bufferTimer-=dt; if(this.bufferTimer>0) this.tryJump(); }
    // 接地
    if(this.onGround){
      const wasOnHole=this.groundGaps.some(g=>prevX>g[0]&&prevX<g[1]);
      const nowOnHole=this.groundGaps.some(g=>px>g[0]&&px<g[1]);
      if(!wasOnHole && !nowOnHole){
        const sup=this.supportAt(px, prevY+1.3, false);
        if(sup>-1e8 && sup-prevY<=1.3 && sup-prevY>=-1.4){ this.player.y=sup; this.velY=0; }
        else if(prevY<0.5){ this.player.y=0; this.velY=0; }
        else { this.onGround=false; this.coyoteTimer=COYOTE; this.velY=0; }
      } else {
        this.onGround=false; this.coyoteTimer=COYOTE;
      }
    }
    const g=this.velY<0?GRAVITY*1.25:GRAVITY;
    this.velY+=g*dt; this.player.y+=this.velY*dt;
    // パイプ側面（プレイヤー左右端＋移動経路スイープで判定＝実ゲームと同一ロジック）
    for(const s of this.solids){
      if(!s.deadly) continue;
      const pLeft=Math.min(prevX,px)-PLAYER_HALF;
      const pRight=Math.max(prevX,px)+PLAYER_HALF;
      const sLeft=s.x-s.halfW, sRight=s.x+s.halfW;
      if(pLeft<sRight && pRight>sLeft){
        const grace=s.stair?1.2:0.35; // 階段は1段分の猶予
        const onTop=(this.onGround||this.velY<=0)&&this.player.y>=s.top-grace;
        if(this.player.y<s.top-grace&&!onTop){ this.die('パイプにぶつかった'); return; }
      }
    }
    // 着地
    if(!this.onGround&&this.velY<=0){
      const onHole=this.groundGaps.some(g=>px>g[0]&&px<g[1]);
      const sup=this.supportAt(px, prevY, true);
      if(!onHole&&this.player.y<=0.02){ this.player.y=0; this.velY=0; this.onGround=true; this.airJumps=2; }
      else if(sup>-1e8&&this.player.y<=sup+0.02){ this.player.y=sup; this.velY=0; this.onGround=true; this.airJumps=2; }
    }
    // クリボー移動
    for(const o of this.items){
      if(o.type==='goomba'&&o.alive){ o.mx+=o.dir*2.0*dt; if(o.mx<o.baseX-3)o.dir=1; if(o.mx>o.baseX+3)o.dir=-1; }
    }
    // アイテム判定
    this.checkItems(px);
  }

  checkItems(px){
    const py=this.player.y;
    for(const o of this.items){
      if(o.type==='coin'){
        if(o.alive&&Math.abs(o.x-px)<0.9&&Math.abs(o.y-(py+0.8))<1.2){ o.alive=false; this.coins++; }
      } else if(o.type==='goomba'){
        if(!o.alive) continue;
        if(Math.abs(o.mx-px)<1.05&&py<2.2&&py>-0.3){
          if(py>0.9||(this.velY<0&&py>0.3)){ o.alive=false; this.velY=this.holding?JUMP_V*0.85:JUMP_V*0.6; this.coyoteTimer=0; this.airJumps=2; this.score+=100; }
          else { this.die('クリボー'); return; }
        }
      } else { // block
        if(!o.used&&Math.abs(o.x-px)<1.2&&py+1.2>o.y-0.8&&py+1.2<o.y+0.6&&this.velY>0){
          o.used=true;
          if(o.type==='brick'){ const si=this.solids.findIndex(s=>s.block&&Math.abs(s.x-o.x)<0.1&&Math.abs(s.top-(o.y+0.8))<0.1); if(si>=0)this.solids.splice(si,1); this.score+=50; }
          else { this.coins++; this.score+=50; }
          this.velY=-2;
        }
      }
    }
    if(py<-8){
      // 最終安全網：穴の上にいないのに落ちた場合は地面抜けバグ → 救済して復帰（実ゲームと同一）
      const overHole=this.groundGaps.some(g=>px>g[0]-0.1&&px<g[1]+0.1);
      if(overHole){ this.die('穴に落ちた'); return; }
      else { this.player.y=0; this.velY=0; this.onGround=true; this.airJumps=2; }
    }
    if(!this.flagReached&&px>this.FLAG_X-0.5) this.win=true;
  }
  die(r){ this.dead=true; this.deadReason=r; }
}

// ---- シード付き乱数 ----
function mulberry32(a){ return function(){ a|=0; a=a+0x6D2B79F5|0; let t=Math.imul(a^a>>>15,1|a); t=t+Math.imul(t^t>>>7,61|t)^t; return ((t^t>>>14)>>>0)/4294967296; }; }

module.exports = { Game, GRAVITY, JUMP_V, PLAYER_HALF };

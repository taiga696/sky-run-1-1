// ============================================================
// パイプ完全検証テスト：着地・すり抜け・側面衝突を網羅
// ============================================================
'use strict';
const { Game, GRAVITY, JUMP_V, PLAYER_HALF } = require('./test-harness.js');

const bugs = [];

// ---- テスト1: パイプに横から突っ込んだら必ず死ぬ（すり抜けない） ----
console.log('=== テスト1: パイプ横からの突っ込み（すり抜け検出） ===');
function testPipeSideCollision(){
  let slip=0, tested=0;
  for(let seed=0; seed<80; seed++){
    const game=new Game(seed*7919+1); game.reset(1);
    game.items=[]; game.solids=game.solids.filter(s=>s.ground); game.groundGaps=[];
    const pipeX=15, pipeH=2.0+ (seed%3)*0.3;
    game.solids.push({x:pipeX, halfW:1.05, top:pipeH, deadly:true, pipe:true});
    game.player.x=0; game.player.y=0; game.onGround=true;
    const dt=1/60; let t=0;
    while(t<4 && !game.dead && !game.win){
      game.step(dt); t+=dt;
      if(game.player.x > pipeX+1.5 && !game.dead){ slip++; break; }
    }
    tested++;
    if(game.dead && game.deadReason!=='パイプにぶつかった'){
      bugs.push({type:'パイプ横突っ込みで別の死因', seed, x:game.player.x.toFixed(2), reason:game.deadReason});
    }
  }
  console.log('テスト数:', tested, 'すり抜け:', slip);
  if(slip>0) bugs.push({type:'パイプ横突っ込みですり抜け', count:slip});
}
testPipeSideCollision();

// ---- テスト1b: パイプの上側（y=top付近）から横に入っても死ぬ ----
console.log('\n=== テスト1b: パイプ上側からの侵入（すり抜け検出） ===');
function testPipeUpperSide(){
  let slip=0, tested=0;
  // パイプの高さの途中（y=top-0.5, top-1.0）から横に突っ込む
  for(const yStart of [0.5, 1.0, 1.5]){
    for(let seed=0; seed<30; seed++){
      const game=new Game(seed*31+yStart*100); game.reset(1);
      game.items=[]; game.solids=game.solids.filter(s=>s.ground); game.groundGaps=[];
      const pipeX=15, pipeH=2.4;
      game.solids.push({x:pipeX, halfW:1.05, top:pipeH, deadly:true, pipe:true});
      // パイプの高さの途中から水平移動で突っ込む
      game.player.x=pipeX-3; game.player.y=yStart; game.onGround=false; game.velY=0;
      const dt=1/60; let t=0;
      let died=false;
      while(t<2 && !game.dead){
        game.step(dt); t+=dt;
        if(game.dead){ died=true; break; }
        if(game.player.x > pipeX+1.2 && !game.dead){ slip++; break; }
      }
      tested++;
    }
  }
  console.log('テスト数:', tested, 'すり抜け:', slip);
  if(slip>0) bugs.push({type:'パイプ上側からすり抜け', count:slip});
}
testPipeUpperSide();

// ---- テスト2: パイプを越えられる（ジャンプで） ----
console.log('\n=== テスト2: パイプ越え（ジャンプ） ===');
function testPipeClear(){
  let ok=0, tested=0;
  for(let seed=0; seed<80; seed++){
    const game=new Game(seed*6271+2); game.reset(1);
    game.items=[]; game.solids=game.solids.filter(s=>s.ground); game.groundGaps=[];
    const pipeX=15, pipeH=2.2;
    game.solids.push({x:pipeX, halfW:1.05, top:pipeH, deadly:true, pipe:true});
    // パイプ手前でジャンプして越える
    game.player.x=pipeX-4; game.player.y=0; game.onGround=true;
    const dt=1/60; let t=0, jumped=false, hold=0;
    let cleared=false;
    while(t<4 && !game.dead){
      if(!jumped && game.player.x >= pipeX-4.0 && game.onGround){ game.pressJump(); jumped=true; hold=0.55; }
      if(hold>0){ hold-=dt; if(hold<=0) game.releaseJump(); }
      game.step(dt); t+=dt;
      // パイプを通り越したら成功
      if(game.player.x > pipeX+2 && !game.dead){ cleared=true; break; }
    }
    tested++;
    if(cleared) ok++;
  }
  console.log('テスト数:', tested, '越え成功:', ok, '('+(ok/tested*100).toFixed(0)+'%)');
  if(ok < tested*0.8) bugs.push({type:'パイプ越え成功率が低い', ok, tested});
}
testPipeClear();

// ---- テスト2b: パイプの上に着地して、中をすり抜けない ----
console.log('\n=== テスト2b: パイプ上着地後のすり抜け検出 ===');
function testPipeTopNoClip(){
  let clip=0, tested=0;
  for(let seed=0; seed<60; seed++){
    const game=new Game(seed*911+7); game.reset(1);
    game.items=[]; game.solids=game.solids.filter(s=>s.ground); game.groundGaps=[];
    const pipeX=15, pipeH=2.2;
    game.solids.push({x:pipeX, halfW:1.05, top:pipeH, deadly:true, pipe:true});
    // パイプの真上に直接配置（着地状態から開始）
    game.player.x=pipeX; game.player.y=pipeH; game.onGround=true; game.velY=0;
    const dt=1/60; let t=0;
    let clipped=false;
    while(t<2 && !game.dead){
      const beforeY=game.player.y;
      game.step(dt); t+=dt;
      // パイプの真上にいるのに、yが急激に下がったらすり抜け（パイプの中に落ちた）
      if(Math.abs(game.player.x-pipeX)<0.8 && game.player.y < pipeH-0.5 && !game.dead){
        clipped=true; break;
      }
    }
    tested++;
    if(clipped){ clip++; bugs.push({type:'パイプ上から中にすり抜け', seed}); }
  }
  console.log('テスト数:', tested, 'すり抜け:', clip);
}
testPipeTopNoClip();

// ---- テスト3: パイプの上を歩いて、端から降りられる ----
console.log('\n=== テスト3: パイプ上の歩行と降り ===');
function testPipeWalkOff(){
  let stuck=0, tested=0;
  for(let seed=0; seed<40; seed++){
    const game=new Game(seed*31+3); game.reset(1);
    game.items=[]; game.solids=game.solids.filter(s=>s.ground); game.groundGaps=[];
    const pipeX=15, pipeH=2.2;
    game.solids.push({x:pipeX, halfW:1.05, top:pipeH, deadly:true, pipe:true});
    // パイプの真上に配置して歩かせる
    game.player.x=pipeX; game.player.y=pipeH; game.onGround=true;
    const dt=1/60; let t=0;
    let died=false;
    while(t<3 && !game.dead){
      game.step(dt); t+=dt;
      if(game.dead){ died=true; break; }
    }
    tested++;
    // パイプの上に立ったまま死んだらバグ（側面衝突の誤発動）
    if(died && game.deadReason==='パイプにぶつかった'){
      stuck++;
      bugs.push({type:'パイプ上で謎死亡（側面衝突誤発動）', seed, x:game.player.x.toFixed(2), y:game.player.y.toFixed(2)});
    }
  }
  console.log('テスト数:', tested, 'パイプ上で謎死亡:', stuck);
}
testPipeWalkOff();

// ---- テスト4: 実戦プレイでパイプ周辺の死を全記録 ----
console.log('\n=== テスト4: 実戦プレイのパイプ死詳細 ===');
function testRealPlayPipes(){
  const pipeDeaths=[];
  for(let seed=0; seed<60; seed++){
    for(let level=1; level<=3; level++){
      const game=new Game(seed*7919+level*13); game.reset(level);
      const dt=1/60; let t=0, jumped=false, hold=0;
      // botでプレイ
      while(t<50 && !game.dead && !game.win){
        const px=game.player.x, py=game.player.y;
        // 簡易bot
        let act=null;
        for(const g of game.groundGaps){ const d=g[0]-px; if(d>0&&d<2.5&&game.onGround){act='jump';} }
        for(const s of game.solids){ if(!s.deadly)continue; const d=s.x-px; if(d>3.5&&d<4.8&&game.onGround&&py<s.top){act='jump';} }
        for(const o of game.items){ if(o.type!=='goomba'||!o.alive)continue; const d=o.mx-px; if(d>1.8&&d<2.8&&game.onGround){act='jump';} }
        if(act==='jump'&&hold<=0){ game.pressJump(); hold=0.5; }
        if(hold>0){ hold-=dt; if(hold<=0) game.releaseJump(); }
        const beforeX=game.player.x;
        game.step(dt); t+=dt;
        if(game.dead && game.deadReason==='パイプにぶつかった'){
          // 死亡地点にパイプがあるか、パイプのどこで死んだか
          const x=game.player.x;
          const pipe=game.solids.find(s=>s.deadly && Math.abs(s.x-x)<2.0);
          pipeDeaths.push({seed, level, x:x.toFixed(2), y:game.player.y.toFixed(2),
            pipeX:pipe?pipe.x.toFixed(2):'none', pipeTop:pipe?pipe.top.toFixed(2):'none',
            distFromPipeCenter: pipe?Math.abs(pipe.x-x).toFixed(2):'none'});
        }
      }
    }
  }
  console.log('パイプ死総数:', pipeDeaths.length);
  // パイプの中心から離れすぎた場所で死んだらバグ
  let farDeaths=0;
  pipeDeaths.forEach(d=>{
    if(d.distFromPipeCenter!=='none' && parseFloat(d.distFromPipeCenter)>1.6){
      farDeaths++;
      if(farDeaths<=3) bugs.push({type:'パイプから離れた場所でパイプ死', ...d});
    }
    // パイプの上（y≈top）で死んだらバグ
    if(d.pipeTop!=='none' && parseFloat(d.y) > parseFloat(d.pipeTop)-0.5){
      bugs.push({type:'パイプの上でパイプ死', ...d});
    }
  });
  console.log('パイプから離れた場所での死:', farDeaths);
  if(pipeDeaths.length>0){
    console.log('サンプル:', JSON.stringify(pipeDeaths.slice(0,3)));
  }
}
testRealPlayPipes();

// ---- 結果 ----
console.log('\n=== 検出されたバグ ===');
if(bugs.length===0){
  console.log('バグなし ✓');
} else {
  const byType={};
  bugs.forEach(b=>byType[b.type]=(byType[b.type]||0)+1);
  Object.entries(byType).forEach(([t,c])=>console.log('⚠', t, '×'+c));
  console.log('\n詳細（最大10件）:');
  bugs.slice(0,10).forEach(b=>console.log(' ', JSON.stringify(b)));
  console.log('\n合計:', bugs.length);
}

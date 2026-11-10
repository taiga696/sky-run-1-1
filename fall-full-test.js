// ============================================================
// 穴落下バグの徹底検証（可変dt・境界跨ぎを含む）
// ============================================================
'use strict';
const { Game, GRAVITY, JUMP_V, PLAYER_HALF, COYOTE } = require('./test-harness.js');

const bugs = [];

// ---- テスト1: 地面を走り続けて、穴でない場所で落ちないか ----
console.log('=== テスト1: 地面走行中の異常落下 ===');
function testGroundRun(){
  let anomalous=0, tested=0;
  for(let seed=0; seed<100; seed++){
    const game=new Game(seed*7919+1); game.reset(1);
    // 穴を全て埋める（地面だけの環境）
    game.groundGaps=[];
    game.solids=game.solids.filter(s=>!s.ground);
    // 地面を全域に敷く
    game.solids.push({x:50, halfW:150, top:0, deadly:false, ground:true});
    game.items=[];
    game.player.x=0; game.player.y=0; game.onGround=true;
    const dt=1/60; let t=0;
    while(t<20 && !game.dead){
      game.step(dt); t+=dt;
      // 穴に落ちた場合のみ異常（パイプ死は除外＝ジャンプしないbotの仕様）
      if(game.dead){
        if(game.deadReason==='穴に落ちた'){ anomalous++; bugs.push({type:'地面走行中に穴落下死', seed, x:game.player.x.toFixed(2)}); }
        break;
      }
      if(game.player.y < -0.5){ anomalous++; bugs.push({type:'地面走行中にy<0', seed, x:game.player.x.toFixed(2), y:game.player.y.toFixed(2)}); break; }
    }
    tested++;
  }
  console.log('テスト数:', tested, '異常落下:', anomalous);
}
testGroundRun();

// ---- テスト2: 可変dt（フレーム落ち）で穴を正しく検出するか ----
console.log('\n=== テスト2: 可変dtでの穴検出 ===');
function testVariableDt(){
  let falseFall=0, missedFall=0, tested=0;
  // 穴1個だけの環境で、様々なdtで穴に向かう
  for(let seed=0; seed<50; seed++){
    const game=new Game(seed*6271+2); game.reset(1);
    game.items=[]; game.solids=game.solids.filter(s=>s.ground); game.groundGaps=[];
    const gapStart=20, gapEnd=24;
    game.groundGaps=[[gapStart, gapEnd]];
    game.solids.push({x:(-10+gapStart)/2, halfW:(gapStart+10)/2, top:0, deadly:false, ground:true});
    game.solids.push({x:(gapEnd+60)/2, halfW:(60-gapEnd)/2, top:0, deadly:false, ground:true});
    // 様々なdtで穴に向かう
    for(const dt of [1/60, 1/30, 0.05, 0.045]){
      const g=new Game(seed); g.reset(1);
      g.items=[]; g.solids=g.solids.filter(s=>s.ground); g.groundGaps=[[gapStart,gapEnd]];
      g.solids.push({x:(-10+gapStart)/2, halfW:(gapStart+10)/2, top:0, deadly:false, ground:true});
      g.solids.push({x:(gapEnd+60)/2, halfW:(60-gapEnd)/2, top:0, deadly:false, ground:true});
      g.player.x=gapStart-3; g.player.y=0; g.onGround=true;
      let t=0;
      while(t<3 && !g.dead){
        g.step(dt); t+=dt;
        // 穴の範囲外（gapStart-1より前）で落ちたら誤落下
        if(g.player.y < -1 && g.player.x < gapStart-0.5){ falseFall++; bugs.push({type:'穴の前で誤落下', dt, x:g.player.x.toFixed(2)}); break; }
      }
      tested++;
    }
  }
  console.log('テスト数:', tested, '穴の前で誤落下:', falseFall);
}
testVariableDt();

// ---- テスト3: 穴の境界での挙動（端ギリギリで落ちるか） ----
console.log('\n=== テスト3: 穴の境界での落下 ===');
function testGapBoundary(){
  let earlyFall=0, tested=0;
  for(let seed=0; seed<50; seed++){
    const game=new Game(seed*31+3); game.reset(1);
    game.items=[]; game.solids=game.solids.filter(s=>s.ground); game.groundGaps=[];
    const gapStart=20, gapEnd=25;
    game.groundGaps=[[gapStart, gapEnd]];
    game.solids.push({x:(-10+gapStart)/2, halfW:(gapStart+10)/2, top:0, deadly:false, ground:true});
    game.solids.push({x:(gapEnd+60)/2, halfW:(60-gapEnd)/2, top:0, deadly:false, ground:true});
    // 穴の左端ギリギリ（gapStart-0.3）から走る
    game.player.x=gapStart-0.3; game.player.y=0; game.onGround=true;
    const dt=1/60; let t=0;
    while(t<2 && !game.dead){
      game.step(dt); t+=dt;
      // 穴の左端より前（x<gapStart）でy<0になったら早すぎる落下
      if(game.player.y < -0.5 && game.player.x < gapStart){ earlyFall++; bugs.push({type:'穴の端で早すぎる落下', seed, x:game.player.x.toFixed(2)}); break; }
    }
    tested++;
  }
  console.log('テスト数:', tested, '穴の端で早すぎる落下:', earlyFall);
}
testGapBoundary();

// ---- テスト4: 実戦プレイで「穴でない場所で落下死」を全記録 ----
console.log('\n=== テスト4: 実戦プレイの落下死検証 ===');
function testRealFall(){
  let fallDeaths=0, falseFall=0;
  for(let seed=0; seed<80; seed++){
    for(let level=1; level<=3; level++){
      const game=new Game(seed*7919+level*17); game.reset(level);
      const dt=1/60; let t=0, hold=0;
      while(t<40 && !game.dead && !game.win){
        const px=game.player.x;
        // 簡易bot（穴を検知してジャンプ）
        let act=null;
        for(const g of game.groundGaps){ const d=g[0]-px; if(d>0&&d<2.5&&game.onGround){act='jump';} if(px>g[0]&&px<g[1]&&!game.onGround&&game.airJumps>0&&game.velY<0){act='jump';} }
        for(const s of game.solids){ if(!s.deadly)continue; const d=s.x-px; if(d>3.5&&d<4.8&&game.onGround){act='jump';} }
        for(const o of game.items){ if(o.type!=='goomba'||!o.alive)continue; const d=o.mx-px; if(d>1.8&&d<2.8&&game.onGround){act='jump';} }
        if(act==='jump'&&hold<=0){ game.pressJump(); hold=0.5; }
        if(hold>0){ hold-=dt; if(hold<=0) game.releaseJump(); }
        game.step(dt); t+=dt;
        if(game.dead && game.deadReason==='穴に落ちた'){
          fallDeaths++;
          const x=game.player.x;
          // 死亡地点が本当に穴の中か
          const onHole=game.groundGaps.some(g=>x>g[0]&&x<g[1]);
          if(!onHole){ falseFall++; bugs.push({type:'穴でない場所で落下死', seed, level, x:x.toFixed(2)}); }
        }
      }
    }
  }
  console.log('落下死総数:', fallDeaths, 'うち穴でない場所:', falseFall);
}
testRealFall();

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

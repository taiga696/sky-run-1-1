// ============================================================
// 深掘りバグ診断：理不尽死・到達不能の検出
// ============================================================
'use strict';
const { Game, GRAVITY, JUMP_V, PLAYER_HALF } = require('./test-harness.js');

// ジャンプ到達高度（物理検証）
console.log('=== 物理検証 ===');
const jumpHeight = (JUMP_V*JUMP_V)/(2*Math.abs(GRAVITY));
console.log('ジャンプ最高高度:', jumpHeight.toFixed(2), '(1段目)');
console.log('3段ジャンプ理論到達: 約', (jumpHeight*1.9).toFixed(2));
console.log('パイプ高さ: 2.2〜3.0 → ジャンプ1段で越えられるか:', jumpHeight>3.0?'YES':'NO');

// 最大ジャンプ飛距離（水平）
const airTime = 2*JUMP_V/Math.abs(GRAVITY);
console.log('滞空時間(1段):', airTime.toFixed(2),'秒');
const runSpeed1 = 9.5;
console.log('レベル1 飛距離:', (runSpeed1*airTime).toFixed(2));
// 穴の最大幅
console.log('穴の最大幅(レベル1):', (2.5+3).toFixed(2), '→ 越えられるか:', runSpeed1*airTime > 5.5 ? 'YES':'NO');

// ---- クリボー理不尽死の検出 ----
console.log('\n=== クリボー理不尽死の検出 ===');
function testGoombaFair(){
  let unfair=0, total=0;
  for(let seed=0; seed<100; seed++){
    const game=new Game(seed*7919+1); game.reset(1);
    const dt=1/60; let t=0;
    let jumpedAt=-999;
    while(t<40 && !game.dead && !game.win){
      // bot: 前方クリボーに反応してジャンプ
      const px=game.player.x;
      for(const o of game.items){
        if(o.type==='goomba'&&o.alive){
          const d=o.mx-px;
          if(d>0&&d<1.8&&game.onGround){ game.pressJump(); jumpedAt=t; }
        }
      }
      if(game.holding && t-jumpedAt>0.15) game.releaseJump();
      game.step(dt); t+=dt;
    }
    if(game.dead && game.deadReason==='クリボー'){
      total++;
      // ジャンプ直後（0.3秒以内）に死んだら「踏もうとして失敗」= 判定の問題かも
      if(t-jumpedAt < 0.3) unfair++;
    }
  }
  console.log('クリボー死:', total, 'うちジャンプ直後の死:', unfair);
  return {total, unfair};
}
testGoombaFair();

// ---- パイプ越え可能性の検証 ----
console.log('\n=== パイプ越え可能性 ===');
function testPipeClear(){
  let impossible=0, tested=0;
  for(let seed=0; seed<100; seed++){
    const game=new Game(seed*6271+3); game.reset(1);
    for(const s of game.solids){
      if(!s.deadly) continue;
      tested++;
      // パイプ高さ vs ジャンプ到達
      if(s.top > jumpHeight*0.95){ impossible++; }
    }
  }
  console.log('パイプ総数:', tested, 'うちジャンプ1段で越えられない:', impossible);
}
testPipeClear();

// ---- 穴の越え可能性 ----
console.log('\n=== 穴の越え可能性（3段ジャンプ） ===');
function testGapClear(){
  let tooWide=0, tested=0;
  for(let level=1; level<=8; level++){
    for(let seed=0; seed<30; seed++){
      const game=new Game(seed*7919+level); game.reset(level);
      for(const g of game.groundGaps){
        tested++;
        const gapW=g[1]-g[0];
        // 3段ジャンプの飛距離: 滞空を3倍に延長（概算）
        const dist = game.runSpeed * airTime * 1.6;
        if(gapW > dist){ tooWide++; }
      }
    }
  }
  console.log('穴総数:', tested, 'うち3段ジャンプでも越えられない:', tooWide);
}
testGapClear();

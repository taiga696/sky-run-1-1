// ============================================================
// 自動プレイbot + バグ検出
// 前方の障害物を検知してジャンプするAIで、複数シードを自動プレイ
// ============================================================
'use strict';
const { Game } = require('./test-harness.js');

// ---- AI bot: 前方の危険を検知してジャンプ ----
// 戦略: 穴・パイプ・クリボーが近づいたらジャンプ（3段ジャンプ活用）
function botThink(game){
  const px = game.player.x;
  const py = game.player.y;

  // 優先度1: 穴（最優先で避ける）
  for(const g of game.groundGaps){
    const dist = g[0] - px;
    const gapW = g[1]-g[0];
    if(dist > 0 && dist < 2.5 && game.onGround){ return {act:'jump', hold: gapW>4 ? 0.5 : 0.3}; }
    if(px > g[0] && px < g[1] && !game.onGround && game.airJumps>0 && game.velY<0 && py<3){ return {act:'jump', hold:0.3}; }
  }
  // 優先度2: パイプ（手前~4でジャンプ、頂点でパイプ上に到達）
  for(const s of game.solids){
    if(!s.deadly) continue;
    const dist = s.x - px;
    if(dist > 3.5 && dist < 4.8 && game.onGround && py < s.top){ return {act:'jump', hold:0.55}; }
    // パイプの真上で降下中、足りなければ空中ジャンプ
    if(dist > -2 && dist < 1.5 && !game.onGround && game.airJumps>0 && py < s.top && game.velY<0){ return {act:'jump', hold:0.3}; }
  }
  // 優先度3: クリボー（踏む）
  for(const o of game.items){
    if(o.type!=='goomba'||!o.alive) continue;
    const dist = o.mx - px;
    if(dist > 1.8 && dist < 2.8 && game.onGround){ return {act:'jump', hold:0.35}; }
  }
  return null;
}

// ---- 1プレイ実行（最大時間で打ち切り） ----
function playOnce(seed, level, maxSec=60){
  const game = new Game(seed);
  game.reset(level);
  const dt = 1/60;
  let t=0;
  let holdTimer=0;
  while(t < maxSec){
    const cmd = botThink(game);
    if(cmd && cmd.act==='jump' && holdTimer<=0){
      game.pressJump();
      holdTimer = cmd.hold;
    }
    if(holdTimer>0){
      holdTimer -= dt;
      if(holdTimer<=0) game.releaseJump();
    }
    game.step(dt);
    t+=dt;
    if(game.dead){ return {seed,level,result:'die',reason:game.deadReason,x:game.player.x.toFixed(1),time:t.toFixed(1)}; }
    if(game.win){ return {seed,level,result:'win',x:game.player.x.toFixed(1),time:t.toFixed(1),coins:game.coins,score:game.score}; }
  }
  return {seed,level,result:'timeout',x:game.player.x.toFixed(1),time:t.toFixed(1)};
}

// ---- 大量プレイでバグ検出 ----
function runSuite(){
  const bugs=[];
  const stats={win:0,die:0,timeout:0};
  const dieReasons={};
  const SEEDS=40, LEVELS=[1,2,3,5,8];

  for(const level of LEVELS){
    for(let s=0;s<SEEDS;s++){
      const r = playOnce(s*7919+level, level);
      stats[r.result]++;
      if(r.result==='die'){
        dieReasons[r.reason]=(dieReasons[r.reason]||0)+1;
        // 異常死の検出
        const x=parseFloat(r.x);
        // 穴でもパイプでもクリボーでもないのに死んだ = バグ
        if(r.reason==='穴に落ちた'){
          // 死亡地点が実際に穴の上か検証
          const g=new Game(r.seed); g.reset(level);
          const onHole=g.groundGaps.some(gap=>x>gap[0]&&x<gap[1]);
          if(!onHole) bugs.push({type:'穴でない場所で落下死',seed:r.seed,level,x,reason:r.reason});
        }
        if(r.reason==='パイプにぶつかった'){
          // 死亡地点に本当にパイプがあるか
          const g=new Game(r.seed); g.reset(level);
          const hasPipe=g.solids.some(s=>s.deadly&&Math.abs(s.x-x)<2.0);
          if(!hasPipe) bugs.push({type:'パイプがない場所でパイプ死',seed:r.seed,level,x});
        }
      }
    }
  }
  return {stats,dieReasons,bugs,total:SEEDS*LEVELS.length};
}

const result = runSuite();
console.log('=== 自動プレイ結果 ===');
console.log('総プレイ数:', result.total);
console.log('結果内訳:', result.stats);
console.log('死亡原因:', result.dieReasons);
console.log('\n=== 検出されたバグ ===');
if(result.bugs.length===0){
  console.log('バグなし ✓');
} else {
  result.bugs.forEach(b=>console.log('⚠', b.type, '| seed:'+b.seed, 'level:'+b.level, 'x:'+b.x));
  console.log('\n合計バグ数:', result.bugs.length);
}

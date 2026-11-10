'use strict';
const { Game, GRAVITY, JUMP_V, PLAYER_HALF } = require('./test-harness.js');

// ブロックの上を歩いて、ブロックが終わった後の挙動を確認
console.log('=== ブロック上歩行→降りの挙動 ===');
const game=new Game(1); game.reset(1);
// ブロック1個だけ（x=10、y=3.2、top=4.0）
game.items=[]; game.solids=game.solids.filter(s=>s.ground); game.groundGaps=[];
game.items.push({type:'brick', x:10, y:3.2, used:false});
game.solids.push({x:10, halfW:0.8, top:4.0, deadly:false, block:true});

const dt=1/60; let t=0;
// ブロックの上に配置
game.player.x=10; game.player.y=4.0; game.onGround=true;
console.log('開始: ブロック上 y=4.0');
let anomaly=false;
while(t<3 && !game.dead){
  const beforeY=game.player.y, beforeX=game.player.x;
  game.step(dt); t+=dt;
  // 急激な落下を検出（1フレームで1以上落下＝異常）
  if(game.player.y < beforeY-1.0 && game.onGround===false){
    if(!anomaly){ console.log('⚠ 急落下検出 t='+t.toFixed(2), 'x='+game.player.x.toFixed(2), beforeY.toFixed(2)+'→'+game.player.y.toFixed(2)); anomaly=true; }
  }
  if(game.dead){ console.log('死因:', game.deadReason, 'x='+game.player.x.toFixed(2)); break; }
}
if(!game.dead) console.log('生存 x='+game.player.x.toFixed(2), 'y='+game.player.y.toFixed(2));

// 穴の端での挙動（飛び越え検証）
console.log('\n=== 穴の端での飛び越え検証 ===');
let skipped=0;
for(let seed=0; seed<50; seed++){
  const g=new Game(seed*7919+1); g.reset(1);
  // 各穴について、1フレーム移動で穴を飛び越えないか
  const maxStep = g.runSpeed * 0.045; // 1フレーム最大移動
  for(const gap of g.groundGaps){
    const gapW = gap[1]-gap[0];
    if(gapW < maxStep*1.5){ skipped++; }
  }
}
console.log('1フレームで飛び越えうる狭い穴:', skipped);

// 接地判定の穴検出漏れをシミュレート
console.log('\n=== 接地中の穴検出（細かく移動） ===');
const g2=new Game(5); g2.reset(1);
if(g2.groundGaps.length>0){
  const gap=g2.groundGaps[0];
  console.log('穴: ['+gap[0].toFixed(1)+', '+gap[1].toFixed(1)+']');
  // プレイヤーを穴の直前から1フレームずつ進める
  g2.player.x=gap[0]-0.5; g2.player.y=0; g2.onGround=true;
  const dt=1/60; let t=0;
  while(t<1.5 && !g2.dead){
    g2.step(dt); t+=dt;
    if(g2.player.y<-1){ console.log('穴に到達 t='+t.toFixed(2), 'x='+g2.player.x.toFixed(2), 'y='+g2.player.y.toFixed(2)); break; }
  }
  if(!g2.dead && g2.player.y>=-1) console.log('穴を検出せず（飛び越え?）x='+g2.player.x.toFixed(2));
}

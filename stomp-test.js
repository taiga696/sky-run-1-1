// クリボー踏みつけの物理検証：1体に対して最適ジャンプで踏めるか
'use strict';
const { Game, GRAVITY, JUMP_V } = require('./test-harness.js');

function testStompPhysics(){
  console.log('=== クリボー踏みつけ物理検証 ===');
  // クリボー1体だけのシナリオを手動構築
  let success=0, fail=0;
  for(let jumpDist=1.0; jumpDist<=3.0; jumpDist+=0.25){
    const game=new Game(1); game.reset(1);
    // クリボーを1体だけに
    game.items = [{type:'goomba', x:jumpDist, baseX:jumpDist, mx:jumpDist, dir:0, alive:true}];
    game.solids = game.solids.filter(s=>s.ground); // 地面だけ
    game.groundGaps = [];
    const dt=1/60; let t=0; let jumped=false;
    while(t<3 && !game.dead){
      // jumpDist手前でジャンプ
      if(!jumped && game.player.x >= jumpDist-2.0 && game.onGround){ game.pressJump(); jumped=true; }
      if(game.holding && game.player.y>1.0) game.releaseJump();
      game.step(dt); t+=dt;
    }
    if(game.dead){ fail++; }
    else if(game.items[0].alive===false){ success++; }
    else { fail++; }
  }
  console.log('踏みつけ成功:', success, '/ 失敗:', fail);
}

// クリボー判定窓の検証：降下中にクリボーに触れた時、踏める高さの範囲
function testStompWindow(){
  console.log('\n=== 踏みつけ判定窓 ===');
  // クリボー高さ1.6、判定は py<2.0 && py>-0.3
  // 踏みつけ条件: velY<0 && py>0.55
  // → 降下中に py が 0.55〜2.0 の範囲でクリボーに触れれば踏める
  console.log('踏みつけ可能なpy範囲: 0.55 〜 2.0 (降下中)');
  console.log('クリボーとの接触判定: |gx-px|<1.05');
  console.log('→ ジャンプの頂点(4.03)から降下し、py=2.0〜0.55の間でクリボーに触れればOK');
  console.log('→ その高さ差は', (2.0-0.55).toFixed(2), '→ 十分広い');
  // 問題: 上昇中にクリボーに触れると死ぬ
  console.log('\n上昇中(velY>0)にクリボーに触れる → 死亡（マリオ仕様通り）');
  console.log('→ botがクリボーの手前で早くジャンプし、上昇中に接触している可能性');
}
testStompPhysics();
testStompWindow();

// 実際のクリボー接触時のvelYとpyを記録
console.log('\n=== クリボー接触時の状態（実測） ===');
function measureStomp(){
  const game=new Game(42); game.reset(1);
  game.items=[{type:'goomba',x:5,baseX:5,mx:5,dir:0,alive:true}];
  game.solids=game.solids.filter(s=>s.ground);
  game.groundGaps=[];
  const dt=1/60; let t=0, jumped=false;
  const log=[];
  while(t<3&&!game.dead){
    if(!jumped&&game.player.x>=3.0&&game.onGround){ game.pressJump(); jumped=true; }
    if(game.holding&&game.player.y>1.0) game.releaseJump();
    const before={x:game.player.x, y:game.player.y, vy:game.velY};
    game.step(dt); t+=dt;
    if(game.items[0].alive && Math.abs(game.items[0].mx-game.player.x)<1.05){
      log.push({t:t.toFixed(2), py:game.player.y.toFixed(2), vy:game.velY.toFixed(1)});
    }
    if(game.dead) break;
  }
  log.slice(0,6).forEach(l=>console.log('接触時 t='+l.t, 'py='+l.py, 'vy='+l.vy));
  console.log('結果:', game.dead?('死因:'+game.deadReason):'生存');
}
measureStomp();

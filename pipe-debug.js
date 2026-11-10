'use strict';
const { Game, GRAVITY, JUMP_V, PLAYER_HALF } = require('./test-harness.js');

// パイプ1個でジャンプの軌跡を詳細記録
const game=new Game(1); game.reset(1);
game.items=[]; game.solids=game.solids.filter(s=>s.ground);
game.groundGaps=[];
const pipeX=4.0, pipeH=2.2;
game.solids.push({x:pipeX, halfW:1.05, top:pipeH, deadly:true, pipe:true});

const dt=1/60; let t=0, jumped=false, hold=0;
console.log('パイプ: x='+pipeX, 'top='+pipeH, '接触距離='+(1.05+PLAYER_HALF).toFixed(2));
console.log('ジャンプ開始: x=2.0');
console.log('\n時刻 | x | y | velY | onGround | パイプ判定');
while(t<3&&!game.dead){
  if(!jumped&&game.player.x>=2.0&&game.onGround){ game.pressJump(); jumped=true; hold=0.55; }
  if(hold>0){ hold-=dt; if(hold<=0) game.releaseJump(); }
  const beforeX=game.player.x, beforeY=game.player.y;
  game.step(dt); t+=dt;
  const dx=Math.abs(pipeX-game.player.x);
  const contact = dx < 1.05+PLAYER_HALF;
  if(t<1.2 && (t*60%6<1 || contact)){
    console.log(t.toFixed(2), '|', game.player.x.toFixed(2), '|', game.player.y.toFixed(2), '|', game.velY.toFixed(1), '|', game.onGround, '|', contact?('接触! y<top-0.7='+(game.player.y<pipeH-0.7)):'');
  }
  if(game.dead){ console.log('\n死因:', game.deadReason, 'at x='+game.player.x.toFixed(2), 'y='+game.player.y.toFixed(2)); break; }
}
if(!game.dead) console.log('\n生存! x='+game.player.x.toFixed(2));

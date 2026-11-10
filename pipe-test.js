// パイプ越えの物理検証
'use strict';
const { Game, GRAVITY, JUMP_V } = require('./test-harness.js');

console.log('=== パイプ越え物理検証 ===');
// 前進速度9.5、パイプ高さ2.0〜2.6
// ジャンプ初速18.4、重力-42
// 頂点高度: 18.4²/(2×42) = 4.03
// 頂点到達時間: 18.4/42 = 0.438秒
// パイプ高さ2.0に到達する時間（上昇時）: y=18.4t-21t²=2.0 → t=0.119秒
// その間の前進: 9.5×0.119 = 1.13
// パイプ手前1.13でジャンプすれば、パイプの手前端で高度2.0に到達

const jumpH = JUMP_V*JUMP_V/(2*Math.abs(GRAVITY));
const tTop = JUMP_V/Math.abs(GRAVITY);
console.log('頂点高度:', jumpH.toFixed(2), '頂点時間:', tTop.toFixed(3)+'秒');

// パイプ高さ2.0に到達する上昇時間
const h=2.0;
const disc = JUMP_V*JUMP_V - 2*Math.abs(GRAVITY)*h;
const tReach = (JUMP_V - Math.sqrt(disc))/Math.abs(GRAVITY);
console.log('高度2.0到達(上昇):', tReach.toFixed(3)+'秒', '→ 前進:', (9.5*tReach).toFixed(2));

// パイプ幅2（halfW1.05）、プレイヤー半幅0.35 → 接触距離1.4
// パイプの左端から右端まで: 2.1
// パイプ上に乗るには、パイプの左端で高度>top-0.7、右端でも>top-0.7
// 必要な滞空: パイプ幅分（2.1/9.5=0.22秒）高度を維持
console.log('\nパイプ幅通過時間:', (2.1/9.5).toFixed(3)+'秒');
console.log('高度top維持時間: 頂点付近で約', (2*tTop*0.5).toFixed(2),'秒 → 十分');

// 実測：パイプ1個で最適ジャンプ
console.log('\n=== パイプ1個の最適ジャンプ実測 ===');
let best=0;
for(let jd=2.0; jd<=5.0; jd+=0.25){
  let ok=0;
  for(let trial=0; trial<20; trial++){
    const game=new Game(trial); game.reset(1);
    game.items=[]; game.solids=game.solids.filter(s=>s.ground);
    game.groundGaps=[];
    const pipeH=2.2;
    game.solids.push({x:jd+2, halfW:1.05, top:pipeH, deadly:true, pipe:true});
    const dt=1/60; let t=0, jumped=false, hold=0;
    while(t<4&&!game.dead){
      if(!jumped&&game.player.x>=jd&&game.onGround){ game.pressJump(); jumped=true; hold=0.55; }
      if(hold>0){ hold-=dt; if(hold<=0) game.releaseJump(); }
      game.step(dt); t+=dt;
    }
    if(!game.dead && game.player.x > jd+3.5) ok++;
  }
  if(ok>best){ best=ok; }
  process.stdout.write(`手前${jd.toFixed(2)}: ${ok}/20  `);
}
console.log('\n最良:', best+'/20');

export const PROCEDURE = [
  ['确认设备初始位置', s => s.initialConfirmed, 10],
  ['输入并核对 LKJ 参数和运行揭示', s => s.lkjConfirmed, 20],
  ['升受电弓、闭合主断并建立总风', s => s.panto && s.netVoltage >= 22.5 && s.mainBreaker && s.compressor && s.mainRes >= 750, 15],
  ['简略制动机试验：减压并确认制动', s => s.brakeTested, 8],
  ['大闸回运转位并确认缓解', s => s.releaseObserved, 7],
  ['缓解停放制动', s => !s.parkingBrake, 5],
  ['确认出站信号与发车手信号', s => s.authority, 20],
  ['开启前照灯并鸣笛', s => s.headlight && s.horn, 5],
  ['方向手柄置前进', s => s.direction === 'F', 3],
  ['低级位平稳起动', s => s.speed >= 5 && s.traction > 0, 4],
  ['短距离稳定运行', s => s.distance >= 250 && s.speed >= 12 && s.speed <= 30, 3],
];

export function procedureState(state) {
  const complete = PROCEDURE.map(([, test]) => test(state));
  const current = complete.findIndex((done) => !done);
  return { complete, current: current < 0 ? PROCEDURE.length - 1 : current, done: complete.every(Boolean) };
}

export function scoreRun(state) {
  const p = procedureState(state);
  const base = PROCEDURE.reduce((sum, [, test, weight]) => sum + (test(state) ? weight : 0), 0);
  const deductions = Math.min(20, state.rejected * 2 + state.abrupt * 2 + (state.maxAcceleration > .55 ? 4 : 0));
  return { score: Math.max(0, Math.min(100, base - deductions)), completed: p.complete.filter(Boolean).length, deductions };
}

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

export class TrainSimulation {
  constructor() {
    this.listeners = new Set();
    this.reset();
  }
  reset() {
    this.state = {
      powerOn: false, initialConfirmed: false, lkjConfirmed: false, panto: false, mainBreaker: false, compressor: false,
      parkingBrake: true, authority: false, headlight: false, horn: false, vigilanceAcknowledged: false, direction: 'N',
      // 初始为大闸运转位、小闸缓解位，车辆由停放制动保持；这样才符合后续“减压试验—回运转位”的教学流程。
      autoBrake: 0, independentBrake: 0, traction: 0, mainRes: 0, trainPipe: 0, brakeCyl: 0,
      netVoltage: 0, speed: 0, distance: 0, tractionForce: 0, brakeForce: 0,
      brakeTested: false, releaseObserved: false, elapsed: 0,
      rejected: 0, abrupt: 0, maxAcceleration: 0, maxJerk: 0, lastAcceleration: 0,
    };
    this.emit();
  }
  onChange(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); }
  emit(message = '') { for (const fn of this.listeners) fn(this.state, message); }
  reject(message) { this.state.rejected += 1; this.emit(message); return false; }
  command(id, value) {
    const s = this.state;
    if (id === 'control-power') {
      if (!s.powerOn && (s.traction !== 0 || s.direction !== 'N' || !s.parkingBrake)) return this.reject('初始位置不正确：确认牵引零位、方向中立并施加停放制动。');
      if (!s.powerOn) s.initialConfirmed = true;
      s.powerOn = !s.powerOn; if (!s.powerOn) s.mainBreaker = false; this.emit(s.powerOn ? '初始位置已确认，司机室控制电源已接通。' : '司机室控制电源已断开。'); return true;
    }
    if (id === 'lkj') { if (!s.powerOn) return this.reject('请先接通司机室控制电源。'); s.lkjConfirmed = true; this.emit('LKJ 参数与运行揭示已核对。'); return true; }
    if (id === 'panto') { if (!s.powerOn) return this.reject('控制电源未接通，不能升弓。'); s.panto = !s.panto; if (!s.panto) s.mainBreaker = false; this.emit(s.panto ? '受电弓已升起，正在建立网压。' : '受电弓已降下。'); return true; }
    if (id === 'main-breaker') { if (!s.panto || s.netVoltage < 19) return this.reject('网压未建立，禁止闭合主断路器。'); s.mainBreaker = !s.mainBreaker; this.emit(s.mainBreaker ? '主断路器已闭合。' : '主断路器已断开。'); return true; }
    if (id === 'compressor') { if (!s.mainBreaker) return this.reject('主断路器未闭合，空压机不能投入。'); s.compressor = !s.compressor; this.emit(s.compressor ? '空气压缩机已投入。' : '空气压缩机已停止。'); return true; }
    if (id === 'parking') { if (s.mainRes < 600) return this.reject('总风压力低于 600 kPa，不能缓解停放制动。'); s.parkingBrake = !s.parkingBrake; this.emit(s.parkingBrake ? '停放制动已施加。' : '停放制动已缓解。'); return true; }
    if (id === 'authority') { if (!s.lkjConfirmed) return this.reject('请先完成 LKJ 参数与揭示核对。'); s.authority = true; this.emit('已确认发车许可与允许信号。'); return true; }
    if (id === 'headlight') { s.headlight = !s.headlight; this.emit(s.headlight ? '前照灯已开启。' : '前照灯已关闭。'); return true; }
    if (id === 'horn') { s.horn = true; this.emit('已执行鸣笛。'); return true; }
    if (id === 'reset') { s.vigilanceAcknowledged = true; this.emit('警惕/复位按钮已按下。'); return true; }
    if (id === 'direction') {
      if (s.traction !== 0) return this.reject('牵引手柄未回零，禁止改变方向。');
      s.direction = value; this.emit(`方向手柄已置于${value === 'F' ? '前进' : value === 'R' ? '后退' : '中立'}位。`); return true;
    }
    if (id === 'auto-brake') {
      const next = clamp(Number(value), 0, 5); if (next < s.autoBrake - 1 || next > s.autoBrake + 2) s.abrupt += 1;
      if (next >= 2 && s.trainPipe > 420) s.brakeTested = true;
      s.autoBrake = next; this.emit(next === 0 ? '自动制动阀已回运转位。' : `自动制动阀置于制动档 ${next}。`); return true;
    }
    if (id === 'independent-brake') { s.independentBrake = clamp(Number(value), 0, 5); this.emit('单独制动阀档位已调整。'); return true; }
    if (id === 'traction') {
      // 原 HXD1C Combined_Control：前推为 7 个牵引位，中央为零位，后拉为 8 个电制动位。
      const next = clamp(Number(value), -8, 7);
      if (next - s.traction > 1) s.abrupt += 1;
      s.traction = next;
      const tractionBlocked = next > 0 && (!s.authority || !s.horn || !s.headlight || s.direction !== 'F' || s.parkingBrake || s.autoBrake > 0 || s.independentBrake > 0 || s.brakeCyl > 15 || !s.mainBreaker);
      if (tractionBlocked) {
        s.rejected += 1;
        this.emit(`牵引手柄已置于 ${next} 级，但牵引联锁未满足，暂不输出牵引力。`);
        return false;
      }
      this.emit(next > 0 ? `牵引手柄置于 ${next} 级。` : next < 0 ? `电制动置于 ${Math.abs(next)} 级。` : '牵引手柄已回零。'); return true;
    }
    return false;
  }
  tick(dt) {
    const s = this.state; s.elapsed += dt;
    const netTarget = s.panto ? 25 : 0; s.netVoltage += (netTarget - s.netVoltage) * Math.min(1, dt * 1.8);
    const mainTarget = s.compressor && s.mainBreaker ? 900 : 0; s.mainRes += (mainTarget - s.mainRes) * Math.min(1, dt * (s.compressor ? .22 : .02));
    const pipeTarget = s.mainRes > 450 ? 500 - s.autoBrake * 55 : 0; s.trainPipe += (pipeTarget - s.trainPipe) * Math.min(1, dt * (s.autoBrake > 0 ? 1.8 : .55));
    // 停放制动为独立的弹簧储能制动，不应冒充空气制动缸压力；否则大闸缓解试验会永远无法完成。
    const autoCyl = s.autoBrake * 70; const individualCyl = s.independentBrake * 60;
    const cylTarget = Math.max(autoCyl, individualCyl); s.brakeCyl += (cylTarget - s.brakeCyl) * Math.min(1, dt * 2.3);
    if (s.brakeTested && s.autoBrake === 0 && s.trainPipe > 470 && s.brakeCyl < 40) s.releaseObserved = true;
    const tractionAllowed = s.mainBreaker && s.authority && s.horn && s.headlight && s.direction === 'F' && !s.parkingBrake && s.autoBrake === 0 && s.independentBrake === 0 && s.brakeCyl < 15;
    s.tractionForce = tractionAllowed && s.traction > 0 ? s.traction * 68000 * Math.max(.34, 1 - s.speed / 125) : 0;
    const electricBrake = s.traction < 0 ? Math.abs(s.traction) * 43000 : 0;
    const parkingBrakeForce = s.parkingBrake ? 450000 : 0;
    s.brakeForce = s.brakeCyl * 1250 + electricBrake + parkingBrakeForce;
    const mass = 2800000; const resistance = 24000 + 60 * s.speed + 2 * s.speed * s.speed;
    const acceleration = (s.tractionForce - s.brakeForce - resistance) / mass;
    const actual = s.speed <= 0 && acceleration < 0 ? 0 : acceleration;
    s.speed = clamp(s.speed + actual * dt * 3.6, 0, 120); s.distance += s.speed / 3.6 * dt;
    s.maxAcceleration = Math.max(s.maxAcceleration, Math.abs(actual)); s.maxJerk = Math.max(s.maxJerk, Math.abs((actual - s.lastAcceleration) / Math.max(dt, .01))); s.lastAcceleration = actual;
    this.emit();
  }
}

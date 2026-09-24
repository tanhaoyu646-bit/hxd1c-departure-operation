export const SIGNAL_ASPECTS = {
  green: {
    label: '绿灯', frame: 7,
    meaning: '准许列车按规定速度运行，表示运行前方至少有三个闭塞分区空闲。',
  },
  greenYellow: {
    label: '绿黄色灯', frame: 6,
    meaning: '准许列车按规定速度注意运行，表示运行前方至少有两个闭塞分区空闲。',
  },
  yellow: {
    label: '黄灯', frame: 5,
    meaning: '准许列车按规定速度注意运行，表示运行前方有一个闭塞分区空闲。',
  },
  red: {
    label: '红灯', frame: 0,
    meaning: '禁止越过该信号机。',
  },
};

export const ASSESSMENT_ASPECTS = ['green', 'greenYellow', 'yellow'];

// 课堂训练固定数据：仅用于本网页的操作核对，不作为实际行车参数或运行揭示。
export const LKJ_TRAINING_PARAMETERS = {
  driverId: '0001',
  assistantId: '0002',
  section: '101',
  station: '001',
  trainNo: '90001',
  trainType: '2',
  weight: '2800',
  cars: '50',
  length: '690',
};

export const LKJ_FIELD_DEFINITIONS = [
  ['driverId', '司机号', '0001'],
  ['assistantId', '副司机号', '0002'],
  ['section', '区段号', '101'],
  ['station', '车站号', '001'],
  ['trainNo', '车次', '90001'],
  ['trainType', '列车种类代码', '2＝货物列车'],
  ['weight', '总重（t）', '2800'],
  ['cars', '辆数', '50'],
  ['length', '列车长度（m）', '690'],
];

export const RUNNING_NOTICES = [
  '内江站 1 道出发，运行方向：内江→内江南。',
  'K5+200～K5+800 施工慢行，限速 45 km/h。',
  '本次按四显示自动闭塞行车；揭示仅供课堂训练使用。',
];

export function isLkjParameterMatch(input = {}) {
  return Object.entries(LKJ_TRAINING_PARAMETERS)
    .every(([key, value]) => String(input[key] ?? '').trim() === value);
}

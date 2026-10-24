/** A breathing phase: what to do and for how many seconds. Scale drives the circle animation. */
export type BreathPhase = { label: string; seconds: number; scale: number };

export type MindProgram = {
  id: string;
  title: string;
  kind: 'Focus' | 'Recovery' | 'Sleep' | 'Stress';
  minutes: number;
  when: string;
  about: string;
  pattern: BreathPhase[];
  cues: string[];
};

const IN = 1;
const OUT = 0.55;

export const MIND_PROGRAMS: MindProgram[] = [
  {
    id: 'pre-lift',
    title: 'Pre-lift focus',
    kind: 'Focus',
    minutes: 2,
    when: 'Before a heavy set',
    about: 'The physiological sigh: two breaths in, one long breath out. Settles nerves without making you sleepy.',
    pattern: [
      { label: 'Breathe in', seconds: 2, scale: 0.85 },
      { label: 'Top up', seconds: 1, scale: IN },
      { label: 'Long breath out', seconds: 6, scale: OUT },
    ],
    cues: ['Picture the bar path', 'Feet planted, grip tight', 'One rep at a time', 'Brace, then move'],
  },
  {
    id: 'box',
    title: 'Box breathing',
    kind: 'Focus',
    minutes: 4,
    when: 'Any time you feel scattered',
    about: 'Four counts in, hold, out, hold. Used by athletes and armed forces to stay calm under pressure.',
    pattern: [
      { label: 'Breathe in', seconds: 4, scale: IN },
      { label: 'Hold', seconds: 4, scale: IN },
      { label: 'Breathe out', seconds: 4, scale: OUT },
      { label: 'Hold', seconds: 4, scale: OUT },
    ],
    cues: ['Drop your shoulders', 'Breathe through your nose', 'Let your belly rise', 'Unclench your jaw'],
  },
  {
    id: 'cooldown',
    title: 'Post-workout cool-down',
    kind: 'Recovery',
    minutes: 5,
    when: 'Right after training',
    about: 'Longer breaths out than in bring your heart rate down and switch your body into recovery.',
    pattern: [
      { label: 'Breathe in', seconds: 4, scale: IN },
      { label: 'Breathe out slowly', seconds: 6, scale: OUT },
    ],
    cues: ['Lie flat, legs up the wall if you can', 'Feel your heart slow down', 'Loosen your hands', 'Good work today'],
  },
  {
    id: 'desk',
    title: 'Desk reset',
    kind: 'Stress',
    minutes: 3,
    when: 'Between meetings',
    about: 'A short reset for a busy day. Sit tall, feet flat, eyes soft.',
    pattern: [
      { label: 'Breathe in', seconds: 4, scale: IN },
      { label: 'Hold', seconds: 2, scale: IN },
      { label: 'Breathe out', seconds: 6, scale: OUT },
    ],
    cues: ['Sit tall', 'Relax your forehead', 'Notice three sounds around you', 'Let the next task wait'],
  },
  {
    id: 'sleep',
    title: '4-7-8 wind-down',
    kind: 'Sleep',
    minutes: 6,
    when: 'In bed, lights off',
    about: 'Breathe in for 4, hold for 7, out for 8. Muscles repair while you sleep, so better sleep means better results.',
    pattern: [
      { label: 'Breathe in', seconds: 4, scale: IN },
      { label: 'Hold', seconds: 7, scale: IN },
      { label: 'Breathe out', seconds: 8, scale: OUT },
    ],
    cues: ['Let the bed take your weight', 'Toes, calves, knees, relax', 'Heavy arms', 'Nothing to do now'],
  },
];

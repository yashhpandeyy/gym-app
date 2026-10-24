import type { Exercise, WorkoutDay, WorkoutPlan } from '@/store/types';

export type WorkoutTemplate = Omit<WorkoutPlan, 'trainerId' | 'updatedOn'> & { id: string; label: string };

const ex = (id: string, name: string, sets: string, extra: Partial<Exercise> = {}): Exercise => ({ id, name, sets, ...extra });
const day = (id: string, name: string, focus: string, exercises: Exercise[]): WorkoutDay => ({ id, name, focus, exercises });

/**
 * Starting points a coach assigns from the manager app, then tweaks per member. The four barbell
 * lifts carry a `liftKey` so logging them feeds the member's Strength score.
 */
export const WORKOUT_TEMPLATES: WorkoutTemplate[] = [
  {
    id: 'beginner',
    label: 'Beginner, 3 days a week',
    title: 'Full body, 3 days',
    days: [
      day('a', 'Day A', 'Whole body, squat focus', [
        ex('a1', 'Back squat', '3 × 8', { liftKey: 'squat', loggable: true, note: 'Light and controlled while you learn the movement' }),
        ex('a2', 'Bench press', '3 × 8', { liftKey: 'bench', loggable: true }),
        ex('a3', 'Seated cable row', '3 × 10', { loggable: true }),
        ex('a4', 'Plank', '3 × 30 s'),
      ]),
      day('b', 'Day B', 'Whole body, hinge focus', [
        ex('b1', 'Deadlift', '3 × 5', { liftKey: 'deadlift', loggable: true }),
        ex('b2', 'Standing overhead press', '3 × 8', { liftKey: 'ohp', loggable: true }),
        ex('b3', 'Lat pulldown', '3 × 10', { loggable: true }),
        ex('b4', 'Walking lunge', '3 × 10 each leg'),
      ]),
      day('c', 'Day C', 'Whole body, mixed', [
        ex('c1', 'Leg press', '3 × 12', { loggable: true }),
        ex('c2', 'Incline dumbbell press', '3 × 10', { loggable: true }),
        ex('c3', 'Dumbbell row', '3 × 10 each arm', { loggable: true }),
        ex('c4', 'Cable crunch', '3 × 15'),
      ]),
    ],
  },
  {
    id: 'ppl',
    label: 'Push, pull, legs',
    title: 'Push / Pull / Legs',
    days: [
      day('push', 'Push', 'Chest, shoulders, triceps', [
        ex('p1', 'Bench press', '4 × 6', { liftKey: 'bench', loggable: true, note: 'Add 2.5 kg once all sets feel clean' }),
        ex('p2', 'Standing overhead press', '3 × 8', { liftKey: 'ohp', loggable: true }),
        ex('p3', 'Incline dumbbell press', '3 × 10', { loggable: true }),
        ex('p4', 'Cable fly', '3 × 12'),
        ex('p5', 'Rope pushdown', '3 × 15'),
      ]),
      day('pull', 'Pull', 'Back, rear delts, biceps', [
        ex('l1', 'Deadlift', '3 × 5', { liftKey: 'deadlift', loggable: true, note: 'Belt on the top set only' }),
        ex('l2', 'Pull-ups', '4 × max'),
        ex('l3', 'Barbell row', '3 × 8', { loggable: true }),
        ex('l4', 'Face pull', '3 × 15'),
        ex('l5', 'Hammer curl', '3 × 12'),
      ]),
      day('legs', 'Legs', 'Quads, hamstrings, glutes', [
        ex('g1', 'Back squat', '4 × 6', { liftKey: 'squat', loggable: true }),
        ex('g2', 'Romanian deadlift', '3 × 8', { loggable: true }),
        ex('g3', 'Walking lunge', '3 × 12 each leg'),
        ex('g4', 'Lying leg curl', '3 × 12'),
        ex('g5', 'Standing calf raise', '4 × 15'),
      ]),
    ],
  },
  {
    id: 'upper-lower',
    label: 'Upper and lower, 4 days',
    title: 'Upper / Lower, 4 days',
    days: [
      day('u1', 'Upper 1', 'Heavy push and pull', [
        ex('u1a', 'Bench press', '4 × 5', { liftKey: 'bench', loggable: true }),
        ex('u1b', 'Barbell row', '4 × 6', { loggable: true }),
        ex('u1c', 'Standing overhead press', '3 × 8', { liftKey: 'ohp', loggable: true }),
        ex('u1d', 'Lat pulldown', '3 × 10', { loggable: true }),
      ]),
      day('l1', 'Lower 1', 'Squat focus', [
        ex('l1a', 'Back squat', '4 × 5', { liftKey: 'squat', loggable: true }),
        ex('l1b', 'Romanian deadlift', '3 × 8', { loggable: true }),
        ex('l1c', 'Leg press', '3 × 12', { loggable: true }),
        ex('l1d', 'Standing calf raise', '4 × 15'),
      ]),
      day('u2', 'Upper 2', 'Volume work', [
        ex('u2a', 'Incline dumbbell press', '4 × 10', { loggable: true }),
        ex('u2b', 'Seated cable row', '4 × 10', { loggable: true }),
        ex('u2c', 'Lateral raise', '3 × 15'),
        ex('u2d', 'Rope pushdown', '3 × 15'),
        ex('u2e', 'Hammer curl', '3 × 12'),
      ]),
      day('l2', 'Lower 2', 'Deadlift focus', [
        ex('l2a', 'Deadlift', '3 × 5', { liftKey: 'deadlift', loggable: true }),
        ex('l2b', 'Walking lunge', '3 × 12 each leg'),
        ex('l2c', 'Lying leg curl', '3 × 12'),
        ex('l2d', 'Front plank', '3 × 60 s'),
      ]),
    ],
  },
  {
    id: 'fat-loss',
    label: 'Fat loss, 4 days with cardio',
    title: 'Fat loss circuit',
    days: [
      day('f1', 'Strength A', 'Lower body and core', [
        ex('f1a', 'Back squat', '3 × 10', { liftKey: 'squat', loggable: true }),
        ex('f1b', 'Romanian deadlift', '3 × 10', { loggable: true }),
        ex('f1c', 'Kettlebell swing', '4 × 20'),
        ex('f1d', 'Front plank', '3 × 45 s'),
      ]),
      day('f2', 'Cardio A', 'Steady and intervals', [ex('f2a', 'Treadmill incline walk', '25 min'), ex('f2b', 'Rower intervals', '8 × 250 m', { note: '60 s rest between efforts' }), ex('f2c', 'Cool-down stretch', '5 min')]),
      day('f3', 'Strength B', 'Upper body', [
        ex('f3a', 'Bench press', '3 × 10', { liftKey: 'bench', loggable: true }),
        ex('f3b', 'Lat pulldown', '3 × 12', { loggable: true }),
        ex('f3c', 'Standing overhead press', '3 × 10', { liftKey: 'ohp', loggable: true }),
        ex('f3d', 'Dumbbell row', '3 × 12 each arm', { loggable: true }),
      ]),
      day('f4', 'Cardio B', 'Conditioning', [ex('f4a', 'Air bike intervals', '10 × 30 s hard, 30 s easy'), ex('f4b', 'Sled push', '6 × 20 m'), ex('f4c', 'Mobility flow', '10 min')]),
    ],
  },
];

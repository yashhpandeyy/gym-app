import type { TestItem } from '@/store/types';

export const PAUSE_REASONS = ['Travel', 'Medical', 'Work', 'Exams', 'Family', 'Other'];

/** The "we miss you" WhatsApp message a gym starts with. {name}, {days} and {gym} are filled in. */
export const AWAY_MESSAGE =
  'Hi {name}, we haven’t seen you at {gym} for {days} days and wanted to check you’re okay. If anything is getting in the way, just reply here and we’ll help you get back on track. See you soon!';

/** Members count as "not coming" after this many days without a visit, until the gym picks its own number. */
export const AWAY_AFTER_DAYS = 7;

/**
 * The strength and endurance test a gym starts with. The owner can change every number, add
 * exercises or switch any off. Weight targets are a multiple of the member's bodyweight.
 */
export const DEFAULT_TEST: TestItem[] = [
  {
    id: 'pushups',
    name: 'Push-ups',
    how: 'Hands under the shoulders, body in a straight line, chest down to a fist off the floor. Knees on the floor is fine if it’s the same every time.',
    measure: 'reps',
    sets: 1,
    seconds: 60,
    target: 40,
    better: 'higher',
    active: true,
  },
  {
    id: 'bench',
    name: 'Flat bench press',
    how: 'Warm up first. Pick a weight you can press for every rep with good form and note the weight of each set.',
    measure: 'kg',
    sets: 3,
    reps: 8,
    rest: 90,
    target: 0.75,
    perBodyweight: true,
    better: 'higher',
    active: true,
  },
  {
    id: 'legpress',
    name: 'Leg press',
    how: 'Feet shoulder-width, lower until your knees reach about 90 degrees, then press without locking them. Note the weight of each set.',
    measure: 'kg',
    sets: 3,
    reps: 10,
    rest: 90,
    target: 1.5,
    perBodyweight: true,
    better: 'higher',
    active: true,
  },
  {
    id: 'flex',
    name: 'Flexibility (sit and reach)',
    how: 'Sit with your legs straight and feet against the box. Reach forward slowly with both hands and hold for two seconds. The best of three counts.',
    measure: 'cm',
    sets: 3,
    rest: 15,
    target: 30,
    better: 'higher',
    active: true,
  },
  {
    id: 'mile',
    name: '1 mile brisk walk',
    how: 'Walk 1.6 km as fast as you can without running, on the treadmill or a measured route. Start the stopwatch as you set off and stop it at the finish.',
    measure: 'time',
    sets: 1,
    target: 14 * 60,
    better: 'lower',
    active: true,
  },
];

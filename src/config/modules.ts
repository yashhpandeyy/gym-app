import type { FeatureKey } from './brand';

/** The parts of the app a gym owner can switch off. Everything starts on. */
export const MODULES: { key: FeatureKey; title: string; subtitle: string; icon: string }[] = [
  { key: 'classes', title: 'Group classes', subtitle: 'Yoga, Zumba and other timetabled sessions', icon: 'people-outline' },
  { key: 'trainers', title: 'Personal training', subtitle: 'Members can request a coach', icon: 'barbell-outline' },
  { key: 'workouts', title: 'Workout plans', subtitle: 'A plan to follow and log', icon: 'list-outline' },
  { key: 'progress', title: 'Body progress', subtitle: 'Weight and measurements over time', icon: 'trending-up-outline' },
  { key: 'gamification', title: 'XP, chests and leaderboards', subtitle: 'Levels, rewards and friendly competition', icon: 'trophy-outline' },
  { key: 'guestPass', title: 'Guest pass', subtitle: 'Members bring a friend free for a week', icon: 'ticket-outline' },
  { key: 'referrals', title: 'Refer a friend', subtitle: 'Reward members who bring new joiners', icon: 'share-social-outline' },
  { key: 'nutrition', title: 'Diet and supplements', subtitle: 'Meal plans, water and supplement ticks', icon: 'restaurant-outline' },
  { key: 'mind', title: 'Breathing and calm', subtitle: 'Short guided sessions', icon: 'leaf-outline' },
  { key: 'leads', title: 'Enquiries', subtitle: 'Track people who ask about joining', icon: 'call-outline' },
];

/** Starting colours for owners who'd rather pick than type a code. */
export const SWATCHES = ['#2F45FF', '#1D7CF2', '#0E9F9A', '#12A150', '#7CB518', '#F2B705', '#FF6A13', '#E5372B', '#D6246E', '#6C3BF5', '#7A4E2D', '#1B1F2A'];

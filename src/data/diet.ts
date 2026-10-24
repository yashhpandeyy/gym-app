import type { DietPlan } from '@/store/types';

type Template = Omit<DietPlan, 'coachId' | 'updatedOn'> & { id: string; label: string };

/**
 * Starting points a coach assigns from the manager app, then adjusts per member.
 * Indian staples throughout, with a vegetarian swap on every meal.
 */
export const DIET_TEMPLATES: Template[] = [
  {
    id: 'recomp',
    label: 'Lose fat, keep muscle',
    title: 'Recomposition, 2,100 kcal',
    goal: 'Lose about 0.5 kg a week while your lifts keep going up.',
    kcal: 2100,
    protein: 155,
    carbs: 210,
    fat: 65,
    waterGlasses: 10,
    notes: 'Hit the protein number first. If you miss a meal, add the protein to the next one instead of skipping it.',
    meals: [
      { id: 'm-b', time: '07:30', name: 'Breakfast', items: ['2 moong dal chillas with mint chutney', '3 egg whites and 1 whole egg bhurji', 'Tea or coffee, no sugar'], kcal: 450, protein: 34, swap: 'Veg: swap the eggs for 100 g paneer bhurji' },
      { id: 'm-m', time: '11:00', name: 'Mid-morning', items: ['200 g hung curd', '1 apple or guava'], kcal: 230, protein: 18 },
      { id: 'm-l', time: '13:30', name: 'Lunch', items: ['2 multigrain rotis', '150 g chicken curry', '1 katori dal', 'Big bowl of salad'], kcal: 620, protein: 46, swap: 'Veg: 150 g paneer or soya chunks instead of chicken' },
      { id: 'm-p', time: '18:00', name: 'Before training', items: ['1 banana', 'Black coffee'], kcal: 140, protein: 2 },
      { id: 'm-w', time: '20:45', name: 'After training', items: ['1 scoop whey in water'], kcal: 120, protein: 24, swap: 'No whey? 1 glass of milk and a handful of roasted chana' },
      { id: 'm-d', time: '21:15', name: 'Dinner', items: ['150 g grilled fish or tofu', 'Sautéed vegetables', 'Half cup brown rice'], kcal: 540, protein: 31 },
    ],
  },
  {
    id: 'cut',
    label: 'Lose weight',
    title: 'Fat loss, 1,700 kcal',
    goal: 'Steady fat loss of 0.5 to 0.8 kg a week.',
    kcal: 1700,
    protein: 120,
    carbs: 160,
    fat: 55,
    waterGlasses: 10,
    notes: 'Fill half of every plate with vegetables. Weigh yourself on the same morning each week.',
    meals: [
      { id: 'c-b', time: '08:00', name: 'Breakfast', items: ['1 bowl vegetable poha with peanuts', '2 boiled eggs'], kcal: 380, protein: 20, swap: 'Veg: a glass of milk instead of eggs' },
      { id: 'c-m', time: '11:30', name: 'Mid-morning', items: ['1 bowl sprouts chaat'], kcal: 180, protein: 12 },
      { id: 'c-l', time: '13:30', name: 'Lunch', items: ['2 phulkas', '1 katori rajma or chole', '1 katori curd', 'Salad'], kcal: 520, protein: 26 },
      { id: 'c-s', time: '17:30', name: 'Snack', items: ['Roasted makhana', 'Green tea'], kcal: 140, protein: 4 },
      { id: 'c-d', time: '20:30', name: 'Dinner', items: ['150 g tandoori chicken or paneer tikka', 'Clear soup', 'Stir-fried vegetables'], kcal: 480, protein: 40 },
    ],
  },
  {
    id: 'gain',
    label: 'Build muscle',
    title: 'Muscle gain, 2,800 kcal',
    goal: 'Gain 0.25 to 0.5 kg a week with most of it muscle.',
    kcal: 2800,
    protein: 160,
    carbs: 350,
    fat: 85,
    waterGlasses: 12,
    notes: 'Eat every 3 to 4 hours. Liquid calories (milk, smoothies) help if you struggle to finish meals.',
    meals: [
      { id: 'g-b', time: '07:30', name: 'Breakfast', items: ['Oats with milk, banana and peanut butter', '3 whole eggs'], kcal: 720, protein: 38, swap: 'Veg: add 30 g whey or a cup of curd instead of eggs' },
      { id: 'g-m', time: '11:00', name: 'Mid-morning', items: ['Paneer sandwich on brown bread', '1 glass lassi'], kcal: 480, protein: 26 },
      { id: 'g-l', time: '14:00', name: 'Lunch', items: ['1.5 cups rice', '200 g chicken curry', '1 katori dal', 'Curd'], kcal: 820, protein: 52, swap: 'Veg: soya chunk curry and extra dal' },
      { id: 'g-w', time: '19:30', name: 'After training', items: ['Banana shake with 1 scoop whey'], kcal: 380, protein: 30 },
      { id: 'g-d', time: '21:30', name: 'Dinner', items: ['3 rotis', 'Egg curry or paneer butter masala', 'Salad'], kcal: 600, protein: 28 },
    ],
  },
];

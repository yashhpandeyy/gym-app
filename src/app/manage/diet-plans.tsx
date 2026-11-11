import { useState } from 'react';
import { View } from 'react-native';

import { Button, Card, Empty, IconButton, Input, Row, Screen, SectionHeader, Sheet, Text, toast } from '@/components/ui';
import { uid } from '@/lib/format';
import { confirm } from '@/lib/native';
import { useApp, type CustomDietTemplate, type Meal } from '@/store';
import { makeStyles } from '@/theme';

type DraftMeal = { id: string; time: string; name: string; items: string; kcal: string; protein: string };
type Draft = {
  id?: string;
  label: string;
  title: string;
  goal: string;
  kcal: string;
  protein: string;
  carbs: string;
  fat: string;
  waterGlasses: string;
  notes: string;
  meals: DraftMeal[];
};

const blankMeal = (): DraftMeal => ({ id: uid('ml'), time: '', name: '', items: '', kcal: '', protein: '' });

const blankDraft = (): Draft => ({
  label: '', title: '', goal: '', kcal: '', protein: '', carbs: '', fat: '',
  waterGlasses: '', notes: '', meals: [blankMeal()],
});

const toDraft = (t: CustomDietTemplate): Draft => ({
  id: t.id,
  label: t.label,
  title: t.title,
  goal: t.goal,
  kcal: String(t.kcal),
  protein: String(t.protein),
  carbs: String(t.carbs),
  fat: String(t.fat),
  waterGlasses: String(t.waterGlasses),
  notes: t.notes ?? '',
  meals: t.meals.map((m) => ({
    id: m.id,
    time: m.time,
    name: m.name,
    items: m.items.join('\n'),
    kcal: String(m.kcal),
    protein: String(m.protein),
  })),
});

const toTemplate = (draft: Draft): Omit<CustomDietTemplate, 'id' | 'createdOn'> & { id?: string } => ({
  id: draft.id,
  label: draft.label.trim(),
  title: draft.title.trim(),
  goal: draft.goal.trim(),
  kcal: Number(draft.kcal) || 0,
  protein: Number(draft.protein) || 0,
  carbs: Number(draft.carbs) || 0,
  fat: Number(draft.fat) || 0,
  waterGlasses: Number(draft.waterGlasses) || 8,
  notes: draft.notes.trim() || undefined,
  meals: draft.meals
    .filter((m) => m.name.trim())
    .map(
      (m): Meal => ({
        id: m.id,
        time: m.time.trim(),
        name: m.name.trim(),
        items: m.items.split('\n').map((s) => s.trim()).filter(Boolean),
        kcal: Number(m.kcal) || 0,
        protein: Number(m.protein) || 0,
      }),
    ),
});

/** Manager screen: create and manage the gym's custom diet plan templates. */
export default function DietPlans() {
  const s = useStyles();
  const templates = useApp((st) => st.customDietTemplates);
  const saveDietTemplate = useApp((st) => st.saveDietTemplate);
  const deleteDietTemplate = useApp((st) => st.deleteDietTemplate);

  const [draft, setDraft] = useState<Draft | null>(null);
  const [mealSheet, setMealSheet] = useState<DraftMeal | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const openNew = () => { setErrors({}); setDraft(blankDraft()); };
  const openEdit = (t: CustomDietTemplate) => { setErrors({}); setDraft(toDraft(t)); };

  const patch = (p: Partial<Draft>) => setDraft((d) => d ? { ...d, ...p } : d);

  const validate = (d: Draft): Record<string, string> => {
    const e: Record<string, string> = {};
    if (!d.label.trim()) e.label = 'Enter a name for your team.';
    if (!d.title.trim()) e.title = 'Enter a title members will see.';
    if (!d.goal.trim()) e.goal = 'Describe the goal.';
    if (!d.meals.some((m) => m.name.trim())) e.meals = 'Add at least one meal.';
    return e;
  };

  const save = () => {
    if (!draft) return;
    const errs = validate(draft);
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }
    saveDietTemplate(toTemplate(draft));
    toast.success(draft.id ? 'Plan updated.' : 'Plan saved.');
    setDraft(null);
  };

  const remove = (t: CustomDietTemplate) =>
    confirm({
      title: `Delete "${t.label}"?`,
      message: 'Members who already have it assigned keep it.',
      confirmText: 'Delete',
      destructive: true,
      onConfirm: () => { deleteDietTemplate(t.id); toast.success('Template deleted.'); },
    });

  // --- meal sheet helpers ---
  const updateMeal = (p: Partial<DraftMeal>) => setMealSheet((m) => m ? { ...m, ...p } : m);
  const saveMeal = () => {
    if (!mealSheet || !draft) return;
    setDraft((prev) => {
      if (!prev) return prev;
      const exists = prev.meals.some((m) => m.id === mealSheet.id);
      return {
        ...prev,
        meals: exists
          ? prev.meals.map((m) => m.id === mealSheet.id ? mealSheet : m)
          : [...prev.meals, mealSheet],
      };
    });
    setMealSheet(null);
  };

  return (
    <Screen header="stack" title="Diet plans">
      {templates.length === 0 ? (
        <Empty
          icon="nutrition-outline"
          title="No custom diet plans yet"
          body="Build a diet plan your coaches can assign to any member alongside the built-in starter templates."
          action="Create a plan"
          onAction={openNew}
        />
      ) : (
        <>
          <SectionHeader title="Your gym's plans" />
          {templates.map((t) => (
            <Card key={t.id} variant="inset" style={s.templateCard}>
              <View style={s.row}>
                <View style={{ flex: 1 }}>
                  <Text variant="label">{t.label}</Text>
                  <Text variant="small" tone="soft">
                    {t.title} · {t.kcal} kcal · {t.protein} g protein
                  </Text>
                </View>
                <View style={s.actions}>
                  <IconButton icon="create-outline" label="Edit" size={34} variant="plain" onPress={() => openEdit(t)} />
                  <IconButton icon="trash-outline" label="Delete" size={34} variant="plain" onPress={() => remove(t)} />
                </View>
              </View>
              <Text variant="caption" tone="soft">{t.goal}</Text>
              <Text variant="caption" tone="soft">{t.meals.length} meal{t.meals.length !== 1 ? 's' : ''}</Text>
            </Card>
          ))}
          <Button title="Create a plan" full style={{ marginTop: 8 }} onPress={openNew} />
        </>
      )}

      {/* Plan editor sheet */}
      <Sheet
        visible={!!draft}
        onClose={() => setDraft(null)}
        title={draft?.id ? 'Edit diet plan' : 'New diet plan'}
        footer={<Button title="Save plan" full onPress={save} />}>
        <Input
          label="Plan name (for your team)"
          value={draft?.label ?? ''}
          onChangeText={(v) => patch({ label: v })}
          placeholder="e.g. High protein, fat loss"
          error={errors.label}
        />
        <Input
          label="Plan title (what members see)"
          value={draft?.title ?? ''}
          onChangeText={(v) => patch({ title: v })}
          placeholder="e.g. Fat loss, 1,800 kcal"
          error={errors.title}
        />
        <Input
          label="Goal"
          value={draft?.goal ?? ''}
          onChangeText={(v) => patch({ goal: v })}
          placeholder="e.g. Lose 0.5 kg a week"
          error={errors.goal}
        />
        <View style={s.macroRow}>
          <Input
            label="Calories (kcal)"
            value={draft?.kcal ?? ''}
            onChangeText={(v) => patch({ kcal: v })}
            keyboardType="numeric"
            placeholder="1800"
            style={{ flex: 1 }}
          />
          <Input
            label="Protein (g)"
            value={draft?.protein ?? ''}
            onChangeText={(v) => patch({ protein: v })}
            keyboardType="numeric"
            placeholder="140"
            style={{ flex: 1 }}
          />
        </View>
        <View style={s.macroRow}>
          <Input
            label="Carbs (g)"
            value={draft?.carbs ?? ''}
            onChangeText={(v) => patch({ carbs: v })}
            keyboardType="numeric"
            placeholder="180"
            style={{ flex: 1 }}
          />
          <Input
            label="Fat (g)"
            value={draft?.fat ?? ''}
            onChangeText={(v) => patch({ fat: v })}
            keyboardType="numeric"
            placeholder="60"
            style={{ flex: 1 }}
          />
        </View>
        <Input
          label="Water (glasses per day)"
          value={draft?.waterGlasses ?? ''}
          onChangeText={(v) => patch({ waterGlasses: v })}
          keyboardType="numeric"
          placeholder="10"
        />
        <Input
          label="Notes (optional)"
          value={draft?.notes ?? ''}
          onChangeText={(v) => patch({ notes: v })}
          placeholder="e.g. Hit protein first, then adjust carbs"
          multiline
        />

        <SectionHeader title="Meals" />
        {errors.meals ? <Text variant="caption" tone="danger">{errors.meals}</Text> : null}
        {(draft?.meals ?? []).map((meal, idx) => (
          <Card key={meal.id} variant="inset" style={{ gap: 4 }}>
            <View style={s.row}>
              <Text variant="label" style={{ flex: 1 }}>{meal.name || `Meal ${idx + 1}`}</Text>
              <View style={s.actions}>
                <IconButton icon="create-outline" label="Edit meal" size={30} variant="plain" onPress={() => setMealSheet(meal)} />
                <IconButton
                  icon="trash-outline"
                  label="Remove meal"
                  size={30}
                  variant="plain"
                  onPress={() => setDraft((d) => d ? { ...d, meals: d.meals.filter((_, i) => i !== idx) } : d)}
                />
              </View>
            </View>
            {meal.time ? <Text variant="caption" tone="soft">{meal.time}</Text> : null}
            {meal.kcal ? <Text variant="caption" tone="soft">{meal.kcal} kcal · {meal.protein || 0} g protein</Text> : null}
          </Card>
        ))}
        <Button title="Add a meal" variant="soft" full onPress={() => setMealSheet(blankMeal())} />
      </Sheet>

      {/* Meal editor sub-sheet */}
      <Sheet
        visible={!!mealSheet}
        onClose={() => setMealSheet(null)}
        title={mealSheet && draft?.meals.some((m) => m.id === mealSheet.id) ? 'Edit meal' : 'Add meal'}
        footer={<Button title="Save meal" full onPress={saveMeal} />}>
        <Input
          label="Meal name"
          value={mealSheet?.name ?? ''}
          onChangeText={(v) => updateMeal({ name: v })}
          placeholder="e.g. Breakfast"
        />
        <Input
          label="Time"
          value={mealSheet?.time ?? ''}
          onChangeText={(v) => updateMeal({ time: v })}
          placeholder="e.g. 08:00"
        />
        <Input
          label="Food items (one per line)"
          value={mealSheet?.items ?? ''}
          onChangeText={(v) => updateMeal({ items: v })}
          placeholder={'e.g. 2 boiled eggs\n1 cup oats\nBlack coffee'}
          multiline
        />
        <View style={s.macroRow}>
          <Input
            label="Calories (kcal)"
            value={mealSheet?.kcal ?? ''}
            onChangeText={(v) => updateMeal({ kcal: v })}
            keyboardType="numeric"
            placeholder="400"
            style={{ flex: 1 }}
          />
          <Input
            label="Protein (g)"
            value={mealSheet?.protein ?? ''}
            onChangeText={(v) => updateMeal({ protein: v })}
            keyboardType="numeric"
            placeholder="30"
            style={{ flex: 1 }}
          />
        </View>
      </Sheet>
    </Screen>
  );
}

const useStyles = makeStyles(() => ({
  templateCard: { gap: 6, marginBottom: 8 },
  row: { flexDirection: 'row', alignItems: 'center' },
  actions: { flexDirection: 'row', gap: 2 },
  macroRow: { flexDirection: 'row', gap: 10 },
}));

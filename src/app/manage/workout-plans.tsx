import { useState } from 'react';
import { ScrollView, View } from 'react-native';

import { Button, Card, Empty, IconButton, Input, Row, Screen, SectionHeader, Sheet, Text, toast } from '@/components/ui';
import { uid } from '@/lib/format';
import { confirm } from '@/lib/native';
import { useApp, type CustomWorkoutTemplate, type Exercise, type WorkoutDay } from '@/store';
import { makeStyles } from '@/theme';

type DraftExercise = { id: string; name: string; sets: string; note: string };
type DraftDay = { id: string; name: string; focus: string; exercises: DraftExercise[] };
type Draft = { id?: string; label: string; title: string; days: DraftDay[] };

const blankExercise = (): DraftExercise => ({ id: uid('ex'), name: '', sets: '', note: '' });
const blankDay = (): DraftDay => ({ id: uid('wd'), name: '', focus: '', exercises: [blankExercise()] });
const blankDraft = (): Draft => ({ label: '', title: '', days: [blankDay()] });

const toDraft = (t: CustomWorkoutTemplate): Draft => ({
  id: t.id,
  label: t.label,
  title: t.title,
  days: t.days.map((d) => ({
    id: d.id,
    name: d.name,
    focus: d.focus,
    exercises: d.exercises.map((e) => ({ id: e.id, name: e.name, sets: e.sets, note: e.note ?? '' })),
  })),
});

const toTemplate = (draft: Draft): Omit<CustomWorkoutTemplate, 'id' | 'createdOn'> & { id?: string } => ({
  id: draft.id,
  label: draft.label.trim(),
  title: draft.title.trim(),
  days: draft.days.map(
    (d): WorkoutDay => ({
      id: d.id,
      name: d.name.trim(),
      focus: d.focus.trim(),
      exercises: d.exercises
        .filter((e) => e.name.trim())
        .map(
          (e): Exercise => ({
            id: e.id,
            name: e.name.trim(),
            sets: e.sets.trim() || '3 × 10',
            ...(e.note.trim() ? { note: e.note.trim() } : {}),
          }),
        ),
    }),
  ),
});

/** Manager screen: create and manage the gym's custom workout plan templates. */
export default function WorkoutPlans() {
  const s = useStyles();
  const templates = useApp((st) => st.customWorkoutTemplates);
  const saveWorkoutTemplate = useApp((st) => st.saveWorkoutTemplate);
  const deleteWorkoutTemplate = useApp((st) => st.deleteWorkoutTemplate);

  const [draft, setDraft] = useState<Draft | null>(null);
  const [daySheet, setDaySheet] = useState<DraftDay | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const openNew = () => {
    setErrors({});
    setDraft(blankDraft());
  };
  const openEdit = (t: CustomWorkoutTemplate) => {
    setErrors({});
    setDraft(toDraft(t));
  };

  const validate = (d: Draft): Record<string, string> => {
    const e: Record<string, string> = {};
    if (!d.label.trim()) e.label = 'Enter a name for your team.';
    if (!d.title.trim()) e.title = 'Enter a title members will see.';
    const validDays = d.days.filter((day) => day.name.trim() && day.exercises.some((ex) => ex.name.trim()));
    if (validDays.length === 0) e.days = 'Add at least one day with one exercise.';
    return e;
  };

  const save = () => {
    if (!draft) return;
    const errs = validate(draft);
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }
    saveWorkoutTemplate(toTemplate(draft));
    toast.success(draft.id ? 'Plan updated.' : 'Plan saved.');
    setDraft(null);
  };

  const remove = (t: CustomWorkoutTemplate) =>
    confirm({
      title: `Delete "${t.label}"?`,
      message: "Members who already have it assigned keep it. New assignments won't see this template.",
      confirmText: 'Delete',
      destructive: true,
      onConfirm: () => {
        deleteWorkoutTemplate(t.id);
        toast.success('Template deleted.');
      },
    });

  // --- day sheet helpers ---
  const updateDay = (patch: Partial<DraftDay>) => setDaySheet((d) => d ? { ...d, ...patch } : d);
  const addExercise = () => setDaySheet((d) => d ? { ...d, exercises: [...d.exercises, blankExercise()] } : d);
  const updateExercise = (idx: number, patch: Partial<DraftExercise>) =>
    setDaySheet((d) => d ? { ...d, exercises: d.exercises.map((e, i) => i === idx ? { ...e, ...patch } : e) } : d);
  const removeExercise = (idx: number) =>
    setDaySheet((d) => d ? { ...d, exercises: d.exercises.filter((_, i) => i !== idx) } : d);

  const saveDay = () => {
    if (!daySheet || !draft) return;
    setDraft((prev) => {
      if (!prev) return prev;
      const exists = prev.days.some((d) => d.id === daySheet.id);
      return {
        ...prev,
        days: exists
          ? prev.days.map((d) => d.id === daySheet.id ? daySheet : d)
          : [...prev.days, daySheet],
      };
    });
    setDaySheet(null);
  };

  return (
    <Screen header="stack" title="Workout plans">
      {templates.length === 0 ? (
        <Empty
          icon="barbell-outline"
          title="No custom plans yet"
          body="Build a workout plan your trainers can assign to any member. It sits alongside the starter templates."
          action="Create a plan"
          onAction={openNew}
        />
      ) : (
        <>
          <SectionHeader title="Your gym's plans" />
          {templates.map((t) => (
            <Card key={t.id} variant="inset" style={s.templateCard}>
              <View style={s.templateRow}>
                <View style={{ flex: 1 }}>
                  <Text variant="label">{t.label}</Text>
                  <Text variant="small" tone="soft">
                    {t.title} · {t.days.length} day{t.days.length !== 1 ? 's' : ''}
                  </Text>
                </View>
                <View style={s.actions}>
                  <IconButton icon="create-outline" label="Edit" size={34} variant="plain" onPress={() => openEdit(t)} />
                  <IconButton icon="trash-outline" label="Delete" size={34} variant="plain" onPress={() => remove(t)} />
                </View>
              </View>
              <View style={s.dayList}>
                {t.days.map((d) => (
                  <Text key={d.id} variant="caption" tone="soft">
                    {d.name}: {d.exercises.length} exercise{d.exercises.length !== 1 ? 's' : ''}
                  </Text>
                ))}
              </View>
            </Card>
          ))}
          <Button title="Create a plan" full style={{ marginTop: 8 }} onPress={openNew} />
        </>
      )}

      {/* Plan editor sheet */}
      <Sheet
        visible={!!draft}
        onClose={() => setDraft(null)}
        title={draft?.id ? 'Edit plan' : 'New workout plan'}
        footer={<Button title="Save plan" full onPress={save} />}>
        <Input
          label="Plan name (for your team)"
          value={draft?.label ?? ''}
          onChangeText={(v) => setDraft((d) => d ? { ...d, label: v } : d)}
          placeholder="e.g. Beginner strength"
          error={errors.label}
        />
        <Input
          label="Plan title (what members see)"
          value={draft?.title ?? ''}
          onChangeText={(v) => setDraft((d) => d ? { ...d, title: v } : d)}
          placeholder="e.g. Full body, 3 days a week"
          error={errors.title}
        />

        <SectionHeader title="Days" />
        {errors.days ? (
          <Text variant="caption" tone="danger">{errors.days}</Text>
        ) : null}
        {(draft?.days ?? []).map((day, dayIdx) => (
          <Card key={day.id} variant="inset" style={{ gap: 6 }}>
            <View style={s.templateRow}>
              <Text variant="label" style={{ flex: 1 }}>
                {day.name || `Day ${dayIdx + 1}`}
              </Text>
              <View style={s.actions}>
                <IconButton icon="create-outline" label="Edit day" size={30} variant="plain" onPress={() => setDaySheet(day)} />
                <IconButton
                  icon="trash-outline"
                  label="Remove day"
                  size={30}
                  variant="plain"
                  onPress={() => setDraft((d) => d ? { ...d, days: d.days.filter((_, i) => i !== dayIdx) } : d)}
                />
              </View>
            </View>
            {day.focus ? <Text variant="caption" tone="soft">{day.focus}</Text> : null}
            {day.exercises.filter((e) => e.name.trim()).map((e) => (
              <Text key={e.id} variant="small" tone="soft">· {e.name} — {e.sets || '3 × 10'}</Text>
            ))}
          </Card>
        ))}
        <Button
          title="Add a day"
          variant="soft"
          full
          onPress={() => setDaySheet(blankDay())}
        />
      </Sheet>

      {/* Day editor sub-sheet */}
      <Sheet
        visible={!!daySheet}
        onClose={() => setDaySheet(null)}
        title={daySheet && draft?.days.some((d) => d.id === daySheet.id) ? 'Edit day' : 'Add day'}
        footer={<Button title="Save day" full onPress={saveDay} />}>
        <Input
          label="Day name"
          value={daySheet?.name ?? ''}
          onChangeText={(v) => updateDay({ name: v })}
          placeholder="e.g. Push day"
        />
        <Input
          label="Focus"
          value={daySheet?.focus ?? ''}
          onChangeText={(v) => updateDay({ focus: v })}
          placeholder="e.g. Chest, shoulders, triceps"
        />
        <SectionHeader title="Exercises" />
        {(daySheet?.exercises ?? []).map((ex, idx) => (
          <Card key={ex.id} variant="inset" style={{ gap: 6 }}>
            <View style={s.templateRow}>
              <Text variant="smallStrong" style={{ flex: 1 }}>Exercise {idx + 1}</Text>
              {(daySheet?.exercises.length ?? 0) > 1 ? (
                <IconButton icon="trash-outline" label="Remove" size={28} variant="plain" onPress={() => removeExercise(idx)} />
              ) : null}
            </View>
            <Input
              label="Exercise name"
              value={ex.name}
              onChangeText={(v) => updateExercise(idx, { name: v })}
              placeholder="e.g. Bench press"
            />
            <Input
              label="Sets"
              value={ex.sets}
              onChangeText={(v) => updateExercise(idx, { sets: v })}
              placeholder="e.g. 3 × 10"
            />
            <Input
              label="Note (optional)"
              value={ex.note}
              onChangeText={(v) => updateExercise(idx, { note: v })}
              placeholder="e.g. Keep back flat"
            />
          </Card>
        ))}
        <Button title="Add exercise" variant="soft" full onPress={addExercise} />
      </Sheet>
    </Screen>
  );
}

const useStyles = makeStyles(() => ({
  templateCard: { gap: 6, marginBottom: 8 },
  templateRow: { flexDirection: 'row', alignItems: 'center' },
  actions: { flexDirection: 'row', gap: 2 },
  dayList: { gap: 2 },
}));

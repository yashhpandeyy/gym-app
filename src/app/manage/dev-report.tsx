import { Platform } from 'react-native';
import { useState } from 'react';
import { View } from 'react-native';

import { Button, Chip, Empty, Input, Screen, SectionHeader, Text } from '@/components/ui';
import { api } from '@/lib/api';
import { makeStyles } from '@/theme';

type Kind = 'crash' | 'wrong_data' | 'ui_issue' | 'feature' | 'other';

const KINDS: { key: Kind; label: string; icon: string }[] = [
  { key: 'crash', label: 'App crashed', icon: '💥' },
  { key: 'wrong_data', label: 'Wrong data', icon: '📊' },
  { key: 'ui_issue', label: 'UI problem', icon: '🖥' },
  { key: 'feature', label: 'Feature idea', icon: '💡' },
  { key: 'other', label: 'Other', icon: '📝' },
];

export default function DevReport() {
  const [kind, setKind] = useState<Kind>('other');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  const submit = async () => {
    if (message.trim().length < 5) return;
    setBusy(true);
    const r = await api.submitDevReport({
      kind,
      message: message.trim(),
      platform: Platform.OS,
    });
    setBusy(false);
    if (r.ok) {
      setSent(true);
    }
  };

  if (sent) {
    return (
      <Screen header="stack" title="Bug report">
        <Empty
          icon="checkmark-circle-outline"
          title="Report sent"
          body={`Thanks! The developer will look into it. Ref: reported via ${Platform.OS}`}
        />
      </Screen>
    );
  }

  return (
    <Screen
      header="stack"
      title="Report to developer"
      subtitle="Help improve the app"
      footer={<Button title="Send report" full loading={busy} disabled={message.trim().length < 5} onPress={submit} />}
    >
      <SectionHeader title="What type of issue?" />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {KINDS.map((k) => (
          <Chip
            key={k.key}
            label={`${k.icon} ${k.label}`}
            selected={kind === k.key}
            onPress={() => setKind(k.key)}
          />
        ))}
      </View>

      <SectionHeader title="Describe what happened" />
      <Input
        label="Description"
        value={message}
        onChangeText={setMessage}
        multiline
        numberOfLines={5}
        placeholder="What did you tap? What did you expect? What happened instead?"
        autoCapitalize="sentences"
      />

      <Text variant="small" tone="soft" style={{ marginTop: 8 }}>
        Your gym name, the screen you were on, and device type are automatically included.
      </Text>
    </Screen>
  );
}

const useStyles = makeStyles(() => ({}));

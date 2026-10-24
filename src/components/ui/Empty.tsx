import { View } from 'react-native';

import { useTheme } from '@/theme';

import { Button } from './Button';
import { Icon, Text, type IconName } from './Text';

export function Empty({
  icon,
  title,
  body,
  action,
  onAction,
}: {
  icon: IconName;
  title: string;
  body?: string;
  action?: string;
  onAction?: () => void;
}) {
  const { c } = useTheme();
  return (
    <View style={{ alignItems: 'center', paddingVertical: 36, paddingHorizontal: 24, gap: 10 }}>
      <View
        style={{
          width: 60,
          height: 60,
          borderRadius: 30,
          backgroundColor: c.primarySoft,
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 4,
        }}>
        <Icon name={icon} size={26} tone="primary" />
      </View>
      <Text variant="h3" align="center">
        {title}
      </Text>
      {body ? (
        <Text variant="small" tone="soft" align="center" style={{ maxWidth: 300 }}>
          {body}
        </Text>
      ) : null}
      {action && onAction ? <Button title={action} onPress={onAction} size="md" style={{ alignSelf: 'center', marginTop: 8 }} /> : null}
    </View>
  );
}

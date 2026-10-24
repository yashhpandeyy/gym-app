import * as Haptics from 'expo-haptics';
import { Alert, Linking, Platform, Share } from 'react-native';

import { activeBrand } from '@/config/active';

import { playSound } from './sound';

const native = Platform.OS === 'ios' || Platform.OS === 'android';

/** Each cue pairs a vibration with a sound, so one call makes a task feel done. */
export const haptic = {
  tap() {
    playSound('tap');
    if (native) Haptics.selectionAsync().catch(() => {});
  },
  success() {
    playSound('success');
    if (native) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  },
  reward() {
    playSound('reward');
    if (native) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  },
  warn() {
    playSound('warn');
    if (native) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
  },
  heavy() {
    playSound('thud');
    if (native) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
  },
  flip() {
    playSound('flip');
    if (native) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  },
  pop() {
    playSound('pop');
    if (native) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  },
};

/** Native confirm dialog; falls back to window.confirm on web so the demo works in a browser too. */
export function confirm(opts: {
  title: string;
  message?: string;
  confirmText: string;
  cancelText?: string;
  destructive?: boolean;
  onConfirm: () => void;
}) {
  if (Platform.OS === 'web') {
    if (globalThis.confirm?.(`${opts.title}${opts.message ? `\n\n${opts.message}` : ''}`)) opts.onConfirm();
    return;
  }
  Alert.alert(opts.title, opts.message, [
    { text: opts.cancelText ?? 'Not now', style: 'cancel' },
    { text: opts.confirmText, style: opts.destructive ? 'destructive' : 'default', onPress: opts.onConfirm },
  ]);
}

export function notify(title: string, message?: string) {
  if (Platform.OS === 'web') {
    globalThis.alert?.(`${title}${message ? `\n\n${message}` : ''}`);
    return;
  }
  Alert.alert(title, message);
}

function open(url: string, fallback?: string) {
  Linking.openURL(url).catch(() => {
    if (fallback) Linking.openURL(fallback).catch(() => notify('Couldn’t open that app'));
    else notify('Couldn’t open that app');
  });
}

export function call(phone: string) {
  open(`tel:${phone.replace(/[^\d+]/g, '')}`);
}

/** Opens WhatsApp with a prefilled message. Numbers without a country code are treated as Indian. */
export function whatsapp(phone: string, text: string) {
  let digits = phone.replace(/\D/g, '');
  if (digits.length === 10) digits = `91${digits}`;
  const msg = encodeURIComponent(text);
  open(`whatsapp://send?phone=${digits}&text=${msg}`, `https://wa.me/${digits}?text=${msg}`);
}

export function email(to: string, subject: string) {
  open(`mailto:${to}?subject=${encodeURIComponent(subject)}`);
}

export function openMaps(query: string) {
  const q = encodeURIComponent(query);
  open(
    Platform.OS === 'ios' ? `maps://?q=${q}` : `geo:0,0?q=${q}`,
    `https://www.google.com/maps/search/?api=1&query=${q}`,
  );
}

export function openInstagram(handle: string) {
  open(`instagram://user?username=${handle}`, `https://instagram.com/${handle}`);
}

export function share(message: string) {
  Share.share({ message }).catch(() => {});
}

export const gymWhatsApp = (text: string) => {
  const to = activeBrand().contact.whatsapp;
  if (to) whatsapp(to, text);
  else notify('This gym hasn’t added a WhatsApp number yet.');
};

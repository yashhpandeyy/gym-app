import { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';

import { ProductThumb, stockNote } from '@/components/Shop';
import { Button, Card, Chip, Empty, Group, Row, Screen, SectionHeader, Sheet, Stepper, Text, toast } from '@/components/ui';
import { fmtStampInline } from '@/lib/date';
import { PRODUCT_CATEGORIES } from '@/lib/domain';
import { money } from '@/lib/format';
import { confirm } from '@/lib/native';
import { useApp, type Order, type Product } from '@/store';
import { makeStyles, useTheme } from '@/theme';

const STATUS: Record<Order['status'], string> = {
  requested: 'Waiting for the desk',
  ready: 'Ready to collect',
  done: 'Collected',
  cancelled: 'Cancelled',
};

/** The gym's shop. Members reserve here and pay at the desk when they collect. */
export default function Store() {
  const { brand } = useTheme();
  const s = useStyles();
  const products = useApp((st) => st.products);
  const orders = useApp((st) => st.orders);
  const memberId = useApp((st) => st.session?.memberId);
  const placeOrder = useApp((st) => st.placeOrder);
  const cancelOrder = useApp((st) => st.cancelOrder);
  const [category, setCategory] = useState<string>('All');
  const [open, setOpen] = useState<Product | null>(null);
  const [qty, setQty] = useState(1);

  const onSale = useMemo(() => products.filter((p) => p.active).sort((a, b) => a.name.localeCompare(b.name)), [products]);
  const categories = PRODUCT_CATEGORIES.filter((c) => onSale.some((p) => p.category === c));
  const shown = category === 'All' ? onSale : onSale.filter((p) => p.category === category);
  const mine = orders.filter((o) => o.memberId === memberId).sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  const active = mine.filter((o) => o.status === 'requested' || o.status === 'ready');
  const past = mine.filter((o) => o.status === 'done').slice(0, 5);

  const maxQty = open && typeof open.stock === 'number' ? Math.max(1, Math.min(10, open.stock)) : 10;
  const soldOut = !!open && typeof open.stock === 'number' && open.stock <= 0;

  const reserve = () => {
    if (!open) return;
    if (toast.result(placeOrder([{ productId: open.id, qty }]))) setOpen(null);
  };

  if (brand.features.store === false) {
    return (
      <Screen header="stack" title="Shop">
        <Empty icon="bag-handle-outline" title="The shop is closed" body="This gym isn’t selling through the app right now." />
      </Screen>
    );
  }

  return (
    <Screen header="stack" title="Shop" subtitle="Reserve here, then pay and collect at the desk.">
      {active.length ? (
        <>
          <SectionHeader title="Your reservations" style={{ marginTop: 0 }} />
          <Group inset={16}>
            {active.map((o) => (
              <Row
                key={o.id}
                title={o.items.map((i) => (i.qty > 1 ? `${i.qty} × ${i.name}` : i.name)).join(', ')}
                subtitle={`${STATUS[o.status]}. Pay ${money(o.total)} at the desk.`}
                chevron={false}
                action={
                  o.status === 'requested' ? (
                    <Button
                      title="Cancel"
                      size="sm"
                      variant="ghost"
                      onPress={() =>
                        confirm({ title: 'Cancel this reservation?', confirmText: 'Cancel it', cancelText: 'Keep it', destructive: true, onConfirm: () => toast.result(cancelOrder(o.id)) })
                      }
                    />
                  ) : undefined
                }
              />
            ))}
          </Group>
        </>
      ) : null}

      {onSale.length ? (
        <>
          {categories.length > 1 ? (
            <View style={s.chips}>
              {['All', ...categories].map((c) => (
                <Chip key={c} label={c} selected={category === c} onPress={() => setCategory(c)} />
              ))}
            </View>
          ) : null}
          <View style={s.grid}>
            {shown.map((p) => {
              const note = stockNote(p);
              return (
                <Pressable
                  key={p.id}
                  accessibilityRole="button"
                  accessibilityLabel={`${p.name}, ${money(p.price)}${note ? `, ${note}` : ''}`}
                  onPress={() => {
                    setQty(1);
                    setOpen(p);
                  }}
                  style={({ pressed }) => [s.cell, pressed && { opacity: 0.85 }]}>
                  <Card padded={false} style={{ overflow: 'hidden' }}>
                    <ProductThumb product={p} size="100%" radius={0} />
                    <View style={{ padding: 12, gap: 2 }}>
                      <Text variant="label" numberOfLines={2}>
                        {p.name}
                      </Text>
                      <Text variant="smallStrong">{money(p.price)}</Text>
                      {note ? (
                        <Text variant="caption" tone={note === 'Sold out' ? 'danger' : 'warning'}>
                          {note}
                        </Text>
                      ) : null}
                    </View>
                  </Card>
                </Pressable>
              );
            })}
          </View>
        </>
      ) : (
        <Empty icon="bag-handle-outline" title="Nothing on sale yet" body="When the gym adds supplements or gear, they’ll show up here." />
      )}

      {past.length ? (
        <>
          <SectionHeader title="Collected" />
          <Group inset={16}>
            {past.map((o) => (
              <Row key={o.id} title={o.items.map((i) => i.name).join(', ')} subtitle={fmtStampInline(o.createdAt)} value={money(o.total)} chevron={false} />
            ))}
          </Group>
        </>
      ) : null}

      <Sheet
        visible={!!open}
        onClose={() => setOpen(null)}
        title={open?.name ?? ''}
        subtitle={open ? money(open.price) : undefined}
        footer={<Button title={soldOut ? 'Sold out' : `Reserve for ${money((open?.price ?? 0) * qty)}`} full disabled={soldOut} onPress={reserve} />}>
        {open ? (
          <View style={{ gap: 14 }}>
            <ProductThumb product={open} size="100%" radius={16} />
            {open.about ? <Text tone="soft">{open.about}</Text> : null}
            {!soldOut ? (
              <View style={s.qty}>
                <Text variant="label" style={{ flex: 1 }}>
                  How many
                </Text>
                <Stepper value={qty} min={1} max={maxQty} label="quantity" onChange={setQty} />
              </View>
            ) : null}
            <Text variant="caption" tone="soft">
              Nothing is charged now. The desk keeps it for you and you pay when you collect.
            </Text>
          </View>
        ) : null}
      </Sheet>
    </Screen>
  );
}

const useStyles = makeStyles(() => ({
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  cell: { width: '48%', flexGrow: 1, maxWidth: 260 },
  qty: { flexDirection: 'row', alignItems: 'center', gap: 12 },
}));

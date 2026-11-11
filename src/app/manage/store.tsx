import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { ProductThumb, stockNote } from '@/components/Shop';
import { Button, Card, Chip, Empty, Fact, Group, Input, Row, Screen, Segmented, Sheet, Stepper, Text, toast, ToggleRow } from '@/components/ui';
import { fmtDate, fmtStampInline, monthKey, MONTHS_LONG, parts } from '@/lib/date';
import { lineTotal, PRODUCT_CATEGORIES } from '@/lib/domain';
import { firstName, money } from '@/lib/format';
import { useNow } from '@/lib/hooks';
import { confirm } from '@/lib/native';
import { useApp, type Order, type PayMethod, type Product, type ProductCategory } from '@/store';
import { makeStyles, useTheme } from '@/theme';

type Tab = 'orders' | 'products' | 'sales';
const METHODS: PayMethod[] = ['UPI', 'Cash', 'Card'];
type Draft = { id?: string; name: string; category: ProductCategory; price: string; stock: string; about: string; photo?: string; active: boolean };
const blank = (): Draft => ({ name: '', category: 'Supplements', price: '', stock: '', about: '', active: true });

/** The gym's shop from the desk: reservations to hand over, what's on the shelf, and what sold. */
export default function StoreDesk() {
  const { brand } = useTheme();
  const s = useStyles();
  const now = useNow(60_000);
  const products = useApp((st) => st.products);
  const orders = useApp((st) => st.orders);
  const sales = useApp((st) => st.sales);
  const members = useApp((st) => st.members);
  const saveProduct = useApp((st) => st.saveProduct);
  const removeProduct = useApp((st) => st.removeProduct);
  const markOrderReady = useApp((st) => st.markOrderReady);
  const completeOrder = useApp((st) => st.completeOrder);
  const recordSale = useApp((st) => st.recordSale);
  const removeSale = useApp((st) => st.removeSale);

  const waiting = orders.filter((o) => o.status === 'requested' || o.status === 'ready').sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1));
  // Opens on reservations when any are waiting, including ones that arrive after the screen opens, until a tab is picked.
  const [picked, setTab] = useState<Tab>();
  const tab = picked ?? (waiting.length ? 'orders' : 'products');
  const [draft, setDraft] = useState<Draft | null>(null);
  const [collect, setCollect] = useState<Order | null>(null);
  const [selling, setSelling] = useState(false);
  const [cart, setCart] = useState<Record<string, number>>({});
  const [method, setMethod] = useState<PayMethod>('UPI');

  const month = monthKey(now.date);
  const monthSales = sales.filter((x) => monthKey(x.date) === month).sort((a, b) => (a.at < b.at ? 1 : -1));
  const takings = monthSales.reduce((sum, x) => sum + x.total, 0);
  const low = products.filter((p) => p.active && typeof p.stock === 'number' && p.stock <= 3).length;
  const nameOf = (id?: string) => (id ? members.find((m) => m.id === id)?.name ?? 'Former member' : 'Walk-in');
  const sorted = [...products].sort((a, b) => Number(b.active) - Number(a.active) || a.name.localeCompare(b.name));

  const openProduct = (p?: Product) =>
    setDraft(
      p
        ? { id: p.id, name: p.name, category: p.category, price: String(p.price), stock: typeof p.stock === 'number' ? String(p.stock) : '', about: p.about ?? '', photo: p.photo, active: p.active }
        : blank(),
    );

  const pickPhoto = async () => {
    const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 1 });
    if (r.canceled || !draft) return;
    let base64 = '';
    for (const width of [480, 360, 260]) {
      const ctx = ImageManipulator.manipulate(r.assets[0].uri);
      ctx.resize({ width });
      const img = await ctx.renderAsync();
      const out = await img.saveAsync({ format: SaveFormat.JPEG, compress: 0.6, base64: true });
      base64 = out.base64 ?? '';
      if (base64 && base64.length <= 70_000) break;
    }
    if (!base64 || base64.length > 70_000) return toast.error('That photo is too large. Try another one.');
    setDraft({ ...draft, photo: `data:image/jpeg;base64,${base64}` });
  };

  const save = () => {
    if (!draft) return;
    const price = parseInt(draft.price, 10);
    if (draft.name.trim().length < 2) return toast.error('Give it a name.');
    if (!(price >= 1)) return toast.error('Enter a price.');
    const stock = draft.stock.trim() === '' ? undefined : parseInt(draft.stock, 10);
    saveProduct({ id: draft.id, name: draft.name.trim(), category: draft.category, price, stock, about: draft.about.trim() || undefined, photo: draft.photo, active: draft.active });
    toast.success(draft.id ? 'Saved.' : `${draft.name.trim()} is on sale.`);
    setDraft(null);
  };

  const cartItems = Object.entries(cart).filter(([, q]) => q > 0).map(([productId, qty]) => ({ productId, qty }));
  const cartTotal = lineTotal(cartItems.map((i) => ({ ...i, name: '', price: products.find((p) => p.id === i.productId)?.price ?? 0 })));

  return (
    <Screen header="stack" title="Shop" subtitle="Supplements and gear. Members reserve in the app and pay here.">
      <Card style={{ gap: 14 }}>
        <View>
          <Text variant="small" tone="soft">
            Sold in {MONTHS_LONG[parts(now.date).m]}
          </Text>
          <Text variant="display">{money(takings)}</Text>
        </View>
        <View style={s.facts}>
          <Fact label="Sales" value={String(monthSales.length)} />
          <Fact label="To hand over" value={String(waiting.length)} tone={waiting.length ? 'warning' : 'ink'} />
          <Fact label="Running low" value={String(low)} tone={low ? 'danger' : 'ink'} />
        </View>
        <Button
          title="Sell something"
          icon="cart-outline"
          full
          disabled={!products.some((p) => p.active)}
          onPress={() => {
            setCart({});
            setMethod('UPI');
            setSelling(true);
          }}
        />
      </Card>

      <View style={{ marginTop: 16, marginBottom: 14 }}>
        <Segmented<Tab>
          value={tab}
          onChange={setTab}
          options={[
            { value: 'orders', label: 'Reserved', count: waiting.length },
            { value: 'products', label: 'Products' },
            { value: 'sales', label: 'Sales' },
          ]}
        />
      </View>

      {tab === 'orders' ? (
        waiting.length ? (
          <Group inset={16}>
            {waiting.map((o) => (
              <Row
                key={o.id}
                title={nameOf(o.memberId)}
                subtitle={`${o.items.map((i) => (i.qty > 1 ? `${i.qty} × ${i.name}` : i.name)).join(', ')}. ${money(o.total)}. ${o.status === 'ready' ? 'Ready, waiting for them' : `Asked ${fmtStampInline(o.createdAt)}`}`}
                chevron={false}
                action={
                  <>
                    {o.status === 'requested' ? (
                      <Button
                        title="Ready"
                        size="sm"
                        variant="soft"
                        onPress={() => {
                          markOrderReady(o.id);
                          toast.success(`${firstName(nameOf(o.memberId))} has been told it’s ready.`);
                        }}
                      />
                    ) : null}
                    <Button
                      title="Collect"
                      size="sm"
                      onPress={() => {
                        setMethod('UPI');
                        setCollect(o);
                      }}
                    />
                  </>
                }
              />
            ))}
          </Group>
        ) : (
          <Empty icon="bag-check-outline" title="Nothing to hand over" body="Reservations from members show up here." />
        )
      ) : null}

      {tab === 'products' ? (
        <View style={{ gap: 12 }}>
          <Button title="Add a product" icon="add" variant="outline" full onPress={() => openProduct()} />
          {sorted.length ? (
            <Group inset={76}>
              {sorted.map((p) => {
                const note = stockNote(p);
                return (
                  <Row
                    key={p.id}
                    leading={<ProductThumb product={p} size={48} radius={10} />}
                    title={p.name}
                    subtitle={[p.category, !p.active ? 'Not on sale' : note ?? (typeof p.stock === 'number' ? `${p.stock} in stock` : null)].filter(Boolean).join('. ')}
                    value={money(p.price)}
                    valueTone="ink"
                    onPress={() => openProduct(p)}
                  />
                );
              })}
            </Group>
          ) : (
            <Empty icon="bag-handle-outline" title="No products yet" body={`Add what you sell at the desk. ${brand.shortName} members can then reserve it in the app.`} />
          )}
        </View>
      ) : null}

      {tab === 'sales' ? (
        monthSales.length ? (
          <Group inset={16}>
            {monthSales.map((x) => (
              <Row
                key={x.id}
                title={x.items.map((i) => (i.qty > 1 ? `${i.qty} × ${i.name}` : i.name)).join(', ')}
                subtitle={`${fmtDate(x.date)}, ${x.method}, ${nameOf(x.memberId)}`}
                value={money(x.total)}
                valueTone="ink"
                chevron={false}
                onPress={() =>
                  confirm({
                    title: 'Undo this sale?',
                    message: 'The money comes off this month’s takings and the items go back on the shelf.',
                    confirmText: 'Undo sale',
                    destructive: true,
                    onConfirm: () => removeSale(x.id),
                  })
                }
              />
            ))}
          </Group>
        ) : (
          <Empty icon="receipt-outline" title="No sales this month" body="Tap Sell something when a member buys at the desk." />
        )
      ) : null}

      <Sheet
        visible={!!draft}
        onClose={() => setDraft(null)}
        title={draft?.id ? 'Edit product' : 'Add a product'}
        footer={
          <View style={{ gap: 8 }}>
            <Button title={draft?.id ? 'Save' : 'Put on sale'} full onPress={save} />
            {draft?.id ? (
              <Button
                title="Delete product"
                variant="ghost"
                full
                onPress={() =>
                  confirm({
                    title: `Delete ${draft.name}?`,
                    message: 'Past sales stay in your books. To stop selling it for now, switch off On sale instead.',
                    confirmText: 'Delete',
                    destructive: true,
                    onConfirm: () => {
                      removeProduct(draft.id!);
                      setDraft(null);
                    },
                  })
                }
              />
            ) : null}
          </View>
        }>
        {draft ? (
          <View style={{ gap: 12 }}>
            <Pressable accessibilityRole="button" accessibilityLabel={draft.photo ? 'Change photo' : 'Add a photo'} onPress={pickPhoto} style={s.photoRow}>
              <ProductThumb product={{ photo: draft.photo, category: draft.category }} size={72} />
              <Text variant="label" tone="primary">
                {draft.photo ? 'Change photo' : 'Add a photo'}
              </Text>
            </Pressable>
            <Input label="Name" value={draft.name} onChangeText={(v) => setDraft({ ...draft, name: v })} placeholder="e.g. Whey protein 1 kg, chocolate" autoCapitalize="sentences" />
            <View style={s.chips}>
              {PRODUCT_CATEGORIES.map((c) => (
                <Chip key={c} label={c} selected={draft.category === c} onPress={() => setDraft({ ...draft, category: c })} />
              ))}
            </View>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <View style={{ flex: 1 }}>
                <Input label="Price" prefix={brand.currency.symbol} value={draft.price} onChangeText={(v) => setDraft({ ...draft, price: v.replace(/\D/g, '').slice(0, 7) })} keyboardType="number-pad" />
              </View>
              <View style={{ flex: 1 }}>
                <Input label="In stock" value={draft.stock} onChangeText={(v) => setDraft({ ...draft, stock: v.replace(/\D/g, '').slice(0, 5) })} keyboardType="number-pad" placeholder="Don’t count" />
              </View>
            </View>
            <Input label="About it (optional)" value={draft.about} onChangeText={(v) => setDraft({ ...draft, about: v })} placeholder="Flavour, size, who it’s for" multiline />
            <ToggleRow title="On sale" subtitle="Members see it in the app" value={draft.active} onChange={(v) => setDraft({ ...draft, active: v })} />
          </View>
        ) : null}
      </Sheet>

      <Sheet visible={!!collect} onClose={() => setCollect(null)} title={`Collect ${collect ? money(collect.total) : ''}`} subtitle={collect ? `From ${nameOf(collect.memberId)}` : undefined} footer={<Button title="Paid, hand it over" full onPress={() => collect && toast.result(completeOrder(collect.id, method)) && setCollect(null)} />}>
        <Text tone="soft">{collect?.items.map((i) => `${i.qty} × ${i.name}`).join(', ')}</Text>
        <View style={s.chips}>
          {METHODS.map((m) => (
            <Chip key={m} label={m} selected={method === m} onPress={() => setMethod(m)} />
          ))}
        </View>
      </Sheet>

      <Sheet
        visible={selling}
        onClose={() => setSelling(false)}
        title="Sell something"
        subtitle={cartTotal ? `${money(cartTotal)} to collect` : 'Pick what they’re buying'}
        footer={
          <Button
            title={cartTotal ? `Paid ${money(cartTotal)}` : 'Save sale'}
            full
            disabled={!cartItems.length}
            onPress={() => {
              if (toast.result(recordSale(cartItems, method))) setSelling(false);
            }}
          />
        }>
        <View style={{ gap: 14 }}>
          {sorted
            .filter((p) => p.active)
            .map((p) => (
              <View key={p.id} style={s.cartRow}>
                <ProductThumb product={p} size={40} radius={8} />
                <View style={{ flex: 1 }}>
                  <Text variant="label" numberOfLines={1}>
                    {p.name}
                  </Text>
                  <Text variant="small" tone="soft">
                    {money(p.price)}
                    {stockNote(p) ? `. ${stockNote(p)}` : ''}
                  </Text>
                </View>
                <Stepper value={cart[p.id] ?? 0} min={0} max={50} label={`how many ${p.name}`} onChange={(v) => setCart({ ...cart, [p.id]: v })} />
              </View>
            ))}
        </View>
        <View style={s.chips}>
          {METHODS.map((m) => (
            <Chip key={m} label={m} selected={method === m} onPress={() => setMethod(m)} />
          ))}
        </View>
      </Sheet>
    </Screen>
  );
}

const useStyles = makeStyles(() => ({
  facts: { flexDirection: 'row', justifyContent: 'space-between' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  photoRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  cartRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
}));

import { today, type GradePackets } from '@kisanmitra/shared';
import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChoiceGrid } from '../../components/ChoiceGrid.js';
import { DateField } from '../../components/DateField.js';
import { GradePacketsField } from '../../components/GradePackets.js';
import { Screen } from '../../components/Screen.js';
import { SuggestField } from '../../components/SuggestField.js';
import { db } from '../../db/db.js';
import { entryLots, getEntry, lotGrades, saveEntry, type LotInput } from '../../db/inventory.js';
import { listKhatas } from '../../db/khata.js';
import type { AppContext } from '../../db/seed.js';
import type { LocalInventoryEntry } from '../../db/types.js';
import { useColdStores, useCrops, useFields, useGrades } from '../../hooks/useAppData.js';

/**
 * Putting produce into storage.
 *
 * One entry, one cold store — always. Inside it the consignment can occupy
 * several lots, each a numbered place with its own grade breakdown, which is
 * how the paper register records it. If produce goes to two stores, that is two
 * entries; there is deliberately no way to express otherwise.
 */
export function EntryForm({
  ctx,
  entryId,
  onDone,
  onBack,
}: {
  ctx: AppContext;
  entryId: string | null;
  onDone: (entryId: string) => void;
  onBack: () => void;
}) {
  const { t } = useTranslation();
  const grades = useGrades(ctx.householdId);
  const crops = useCrops(ctx.householdId);
  const fields = useFields(ctx.householdId);
  const coldStores = useColdStores(ctx.householdId);
  const khatas = useLiveQuery(
    async () => (await listKhatas(ctx.householdId)).filter((k) => k.status === 'open'),
    [ctx.householdId],
    [],
  );

  const varieties = useLiveQuery(async () => {
    const rows = await db.inventoryEntries.where('householdId').equals(ctx.householdId).toArray();
    const seen = new Map<string, string>();
    for (const row of rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt))) {
      const v = row.variety?.trim();
      if (v && !seen.has(v.toLowerCase())) seen.set(v.toLowerCase(), v);
    }
    return [...seen.values()];
  }, [ctx.householdId], []);

  const [loaded, setLoaded] = useState<LocalInventoryEntry | null | undefined>(
    entryId ? undefined : null,
  );
  const [khataId, setKhataId] = useState<string | null>(null);
  const [cropId, setCropId] = useState<string | null>(null);
  const [coldStoreId, setColdStoreId] = useState<string | null>(null);
  const [storedOn, setStoredOn] = useState(today());
  const [variety, setVariety] = useState('');
  const [fieldId, setFieldId] = useState<string | null>(null);
  const [lots, setLots] = useState<LotInput[]>([{ lotNo: '', roomRack: null, packets: [] }]);
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});

  useEffect(() => {
    if (!entryId) return;
    let cancelled = false;
    void (async () => {
      const entry = await getEntry(entryId);
      const rows = await entryLots(entryId);
      const withPackets = await Promise.all(
        rows.map(async (lot) => ({
          id: lot.id,
          lotNo: lot.lotNo,
          roomRack: lot.roomRack,
          packets: (await lotGrades(lot.id)).map((g) => ({
            gradeId: g.gradeId,
            packets: g.packets,
          })) as GradePackets[],
        })),
      );
      if (cancelled) return;
      setLoaded(entry ?? null);
      if (!entry) return;
      setKhataId(entry.khataId);
      setCropId(entry.cropId);
      setColdStoreId(entry.coldStoreId);
      setStoredOn(entry.storedOn);
      setVariety(entry.variety ?? '');
      setFieldId(entry.fieldId);
      setLots(withPackets.length > 0 ? withPackets : [{ lotNo: '', roomRack: null, packets: [] }]);
    })();
    return () => {
      cancelled = true;
    };
  }, [entryId]);

  // With one cold store, or one storable crop, there is nothing to ask.
  const storable = crops.filter((c) => c.usesColdStorage);
  useEffect(() => {
    if (entryId) return;
    if (coldStoreId === null && coldStores.length === 1) setColdStoreId(coldStores[0]!.id);
    if (cropId === null && storable.length === 1) setCropId(storable[0]!.id);
  }, [entryId, coldStoreId, coldStores, cropId, storable]);

  const setLot = (index: number, patch: Partial<LotInput>) =>
    setLots((current) => current.map((lot, i) => (i === index ? { ...lot, ...patch } : lot)));

  const handleSave = async () => {
    const filled = lots.filter((lot) => lot.lotNo.trim() !== '' || lot.packets.some((p) => p.packets > 0));
    const next: Record<string, string | undefined> = {};

    if (!coldStoreId && coldStores.length > 0) next.store = t('inventory.storeMissing');
    if (filled.length === 0) next.lots = t('inventory.lotsMissing');
    if (filled.some((lot) => lot.lotNo.trim() === '')) next.lots = t('stock.lotNoMissing');
    if (filled.some((lot) => !lot.packets.some((p) => p.packets > 0))) {
      next.lots = t('stock.gradesMissing');
    }

    setErrors(next);
    if (Object.values(next).some(Boolean)) return;

    const id = await saveEntry(
      ctx,
      {
        khataId,
        cropId,
        coldStoreId,
        storedOn,
        variety: variety.trim() || null,
        fieldId,
        notes: loaded?.notes ?? null,
        lots: filled.map((lot) => ({ ...lot, lotNo: lot.lotNo.trim() })),
      },
      loaded?.id,
    );
    onDone(id);
  };

  if (loaded === undefined) {
    return (
      <Screen title={t('inventory.new')} onBack={onBack}>
        <p className="text-lg text-ink-soft">{t('common.loading')}</p>
      </Screen>
    );
  }

  return (
    <Screen
      title={loaded ? t('inventory.edit') : t('inventory.new')}
      onBack={onBack}
      action={
        <button type="button" onClick={() => void handleSave()} className="btn-primary w-full text-xl">
          {t('inventory.save')}
        </button>
      }
    >
      <div className="flex flex-col gap-6 pb-4">
        {coldStores.length > 1 ? (
          <ChoiceGrid
            legend={t('inventory.storeLabel')}
            choices={coldStores.map((c) => ({ id: c.id, label: c.name }))}
            value={coldStoreId}
            onChange={setColdStoreId}
            error={errors.store}
          />
        ) : null}
        <p className="-mt-3 text-sm text-ink-soft">{t('inventory.oneStoreOnly')}</p>

        <DateField value={storedOn} onChange={setStoredOn} />

        {storable.length > 1 ? (
          <ChoiceGrid
            legend={t('expense.cropLabel')}
            choices={storable.map((c) => ({ id: c.id, label: c.nameHi }))}
            value={cropId}
            onChange={setCropId}
          />
        ) : null}

        {khatas.length > 0 ? (
          <ChoiceGrid
            legend={t('khata.selectLabel')}
            choices={khatas.map((k) => ({ id: k.id, label: k.name }))}
            value={khataId}
            onChange={setKhataId}
            emptyChoiceLabel={t('expense.cropAll')}
          />
        ) : null}

        {/* One entry can occupy several lots inside the one store. */}
        <fieldset>
          <legend className="label">{t('inventory.lots')}</legend>
          {errors.lots ? (
            <p className="mb-2 text-base font-semibold text-danger" role="alert">
              {errors.lots}
            </p>
          ) : null}

          <ul className="flex flex-col gap-4">
            {lots.map((lot, index) => (
              <li key={lot.id ?? index} className="card px-3 py-3">
                <div className="mb-3 flex items-end gap-2">
                  <label className="flex-1">
                    <span className="mb-1 block text-base font-semibold">{t('stock.lotNoLabel')}</span>
                    <input
                      type="text"
                      value={lot.lotNo}
                      onChange={(event) => setLot(index, { lotNo: event.target.value })}
                      placeholder={t('stock.lotNoPlaceholder')}
                      className="tabular min-h-touch w-full rounded-2xl border-2 border-rule bg-paper-raised px-3 text-lg font-bold"
                    />
                  </label>
                  <label className="w-28">
                    <span className="mb-1 block text-base font-semibold">{t('stock.roomRackLabel')}</span>
                    <input
                      type="text"
                      value={lot.roomRack ?? ''}
                      onChange={(event) => setLot(index, { roomRack: event.target.value || null })}
                      placeholder={t('stock.roomRackPlaceholder')}
                      className="tabular min-h-touch w-full rounded-2xl border-2 border-rule bg-paper-raised px-3 text-lg"
                    />
                  </label>
                  {lots.length > 1 ? (
                    <button
                      type="button"
                      onClick={() => setLots((c) => c.filter((_, i) => i !== index))}
                      aria-label={t('inventory.removeLot')}
                      className="btn-quiet size-touch shrink-0 px-0 text-2xl text-danger"
                    >
                      ×
                    </button>
                  ) : null}
                </div>

                <GradePacketsField
                  legend={t('stock.gradesLabel')}
                  grades={grades}
                  value={lot.packets}
                  onChange={(packets) => setLot(index, { packets })}
                />
              </li>
            ))}
          </ul>

          <button
            type="button"
            onClick={() => setLots((c) => [...c, { lotNo: '', roomRack: null, packets: [] }])}
            className="btn-secondary mt-3 w-full"
          >
            {t('inventory.addLot')}
          </button>
        </fieldset>

        <SuggestField
          label={t('stock.varietyLabel')}
          value={variety}
          onChange={setVariety}
          suggestions={varieties}
          placeholder={t('stock.varietyPlaceholder')}
        />

        <ChoiceGrid
          legend={t('expense.fieldLabel')}
          choices={fields.map((f) => ({ id: f.id, label: f.name }))}
          value={fieldId}
          onChange={setFieldId}
          emptyChoiceLabel={t('expense.fieldAll')}
        />
      </div>
    </Screen>
  );
}

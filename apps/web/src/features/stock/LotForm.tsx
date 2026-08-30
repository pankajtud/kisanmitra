import { today, type GradePackets as GradeCount } from '@kisanmitra/shared';
import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChoiceGrid } from '../../components/ChoiceGrid.js';
import { DateField } from '../../components/DateField.js';
import { GradePacketsField } from '../../components/GradePackets.js';
import { Screen } from '../../components/Screen.js';
import { SuggestField } from '../../components/SuggestField.js';
import { db } from '../../db/db.js';
import { getLot, lotGrades, saveLot } from '../../db/stock.js';
import type { AppContext } from '../../db/seed.js';
import type { LocalLot } from '../../db/types.js';
import { useColdStores, useCrops, useFields, useGrades } from '../../hooks/useAppData.js';

/**
 * One deposit into cold storage: a lot number, when it went in, and the mix of
 * grades inside it (CLAUDE.md §5).
 *
 * `lotNo` is captured exactly as written on paper and stored as opaque text.
 * `91/251` looks like store-lot / packets but does not hold for `129/321` or
 * `354/55`, so nothing is derived from it and no validation is imposed until
 * that question is answered (§15.1, docs/open-questions.md Q1).
 */
export function LotForm({
  ctx,
  lotId,
  onDone,
  onBack,
}: {
  ctx: AppContext;
  lotId: string | null;
  onDone: (lotId: string) => void;
  onBack: () => void;
}) {
  const { t } = useTranslation();
  const grades = useGrades(ctx.householdId);
  const fields = useFields(ctx.householdId);
  const coldStores = useColdStores(ctx.householdId);
  const crops = useCrops(ctx.householdId);

  // Varieties are free text with autocomplete over what has been used before,
  // not an enum (§5).
  const varieties = useLiveQuery(async () => {
    const rows = await db.lots.where('householdId').equals(ctx.householdId).toArray();
    const seen = new Map<string, string>();
    for (const row of rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt))) {
      const v = row.variety?.trim();
      if (v && !seen.has(v.toLowerCase())) seen.set(v.toLowerCase(), v);
    }
    return [...seen.values()];
  }, [ctx.householdId], []);

  const [loaded, setLoaded] = useState<LocalLot | null | undefined>(lotId ? undefined : null);
  const [lotNo, setLotNo] = useState('');
  const [storedOn, setStoredOn] = useState(today());
  const [coldStoreId, setColdStoreId] = useState<string | null>(null);
  const [roomRack, setRoomRack] = useState('');
  const [variety, setVariety] = useState('');
  const [fieldId, setFieldId] = useState<string | null>(null);
  const [cropId, setCropId] = useState<string | null>(null);
  const [packets, setPackets] = useState<GradeCount[]>([]);
  const [errors, setErrors] = useState<{ lotNo?: string; grades?: string; save?: string }>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!lotId) return;
    let cancelled = false;
    void (async () => {
      const [lot, rows] = await Promise.all([getLot(lotId), lotGrades(lotId)]);
      if (cancelled) return;
      setLoaded(lot ?? null);
      if (!lot) return;
      setLotNo(lot.lotNo);
      setStoredOn(lot.storedOn);
      setColdStoreId(lot.coldStoreId);
      setRoomRack(lot.roomRack ?? '');
      setVariety(lot.variety ?? '');
      setFieldId(lot.fieldId);
      setCropId(lot.cropId);
      setPackets(rows.map((r) => ({ gradeId: r.gradeId, packets: r.packets })));
    })();
    return () => {
      cancelled = true;
    };
  }, [lotId]);

  // A single cold store is the common case; preselect it rather than making the
  // user choose from a list of one (§15.3 is still open).
  useEffect(() => {
    if (!lotId && coldStoreId === null && coldStores.length === 1) {
      setColdStoreId(coldStores[0]!.id);
    }
  }, [lotId, coldStoreId, coldStores]);

  // Lots are graded cold-storage deposits, which only some crops use. When
  // exactly one crop does, there is nothing to ask.
  const storable = crops.filter((crop) => crop.usesColdStorage);
  useEffect(() => {
    if (!lotId && cropId === null && storable.length === 1) setCropId(storable[0]!.id);
  }, [lotId, cropId, storable]);

  if (loaded === undefined) {
    return (
      <Screen title={t('stock.newLot')} onBack={onBack}>
        <p className="text-lg text-ink-soft">{t('common.loading')}</p>
      </Screen>
    );
  }

  const handleSave = async () => {
    const next: typeof errors = {};
    if (lotNo.trim() === '') next.lotNo = t('stock.lotNoMissing');
    if (packets.every((p) => p.packets <= 0)) next.grades = t('stock.gradesMissing');

    setErrors(next);
    if (Object.keys(next).length > 0) return;

    setSaving(true);
    try {
      const id = await saveLot(
        ctx,
        {
          lotNo: lotNo.trim(),
          serialNo: loaded?.serialNo ?? null,
          storedOn,
          coldStoreId,
          roomRack: roomRack.trim() || null,
          variety: variety.trim() || null,
          fieldId,
          cropId,
          notes: loaded?.notes ?? null,
          packets,
        },
        loaded?.id,
      );
      onDone(id);
    } catch {
      setErrors({ save: t('error.saveFailed') });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen
      title={loaded ? t('stock.editLot') : t('stock.newLot')}
      onBack={onBack}
      action={
        <>
          {errors.save ? (
            <p className="mb-2 text-base font-semibold text-danger" role="alert">
              {errors.save}
            </p>
          ) : null}
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={saving}
            className="btn-primary w-full text-xl"
          >
            {t('stock.saveLot')}
          </button>
        </>
      }
    >
      <div className="flex flex-col gap-6 pb-4">
        <SuggestField
          label={t('stock.lotNoLabel')}
          value={lotNo}
          onChange={setLotNo}
          suggestions={[]}
          placeholder={t('stock.lotNoPlaceholder')}
          error={errors.lotNo}
          required
        />

        <DateField value={storedOn} onChange={setStoredOn} />

        <GradePacketsField
          legend={t('stock.gradesLabel')}
          grades={grades}
          value={packets}
          onChange={setPackets}
          error={errors.grades}
        />

        <SuggestField
          label={t('stock.varietyLabel')}
          value={variety}
          onChange={setVariety}
          suggestions={varieties}
          placeholder={t('stock.varietyPlaceholder')}
        />

        {storable.length > 1 ? (
          <ChoiceGrid
            legend={t('expense.cropLabel')}
            choices={storable.map((c) => ({ id: c.id, label: c.nameHi }))}
            value={cropId}
            onChange={setCropId}
          />
        ) : null}

        <ChoiceGrid
          legend={t('expense.fieldLabel')}
          choices={fields.map((f) => ({ id: f.id, label: f.name }))}
          value={fieldId}
          onChange={setFieldId}
          emptyChoiceLabel={t('expense.fieldAll')}
        />

        {coldStores.length > 1 ? (
          <ChoiceGrid
            legend={t('stock.coldStoreLabel')}
            choices={coldStores.map((c) => ({ id: c.id, label: c.name }))}
            value={coldStoreId}
            onChange={setColdStoreId}
          />
        ) : null}

        <SuggestField
          label={t('stock.roomRackLabel')}
          value={roomRack}
          onChange={setRoomRack}
          suggestions={[]}
          placeholder={t('stock.roomRackPlaceholder')}
        />
      </div>
    </Screen>
  );
}

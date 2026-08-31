import {
  formatLotBreakdown,
  formatRegisterDate,
  formatRupees,
  parseAmount,
  selfPercent as ownPercent,
  today,
  type GradePackets,
  type SharingMode,
} from '@kisanmitra/shared';
import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChoiceGrid } from '../../components/ChoiceGrid.js';
import { DateField } from '../../components/DateField.js';
import { GradeMark } from '../../components/GradeMark.js';
import { SharingField } from '../../components/SharingField.js';
import { QuantityField } from '../../components/QuantityField.js';
import { Screen } from '../../components/Screen.js';
import { Stepper } from '../../components/Stepper.js';
import { SuggestField } from '../../components/SuggestField.js';
import { TextField } from '../../components/TextField.js';
import { knownPartners } from '../../db/expenses.js';
import { khataPartners, listKhatas } from '../../db/khata.js';
import { getSale, knownBuyers, saleGradeRows, saleTotal, saveSale } from '../../db/stock.js';
import { availableLots, lotPosition } from '../../db/inventory.js';
import type { AppContext } from '../../db/seed.js';
import type { LocalSale } from '../../db/types.js';
import { useColdStores, useCrops, useFields, useGrades } from '../../hooks/useAppData.js';
import { useRefLabel } from '../../lib/labels.js';

interface Line extends GradePackets {
  ratePerPacket: number | null;
}

/**
 * Recording a sale. Two shapes, one screen:
 *
 * - out of a cold-storage lot, priced per grade, capped at what is still there
 * - straight off the field, priced by quantity — wheat, mustard, peas
 *
 * Income is shared the same way costs are: a crop farmed in partnership splits
 * both, and only the household's own half belongs in its books.
 */
export function SaleForm({
  ctx,
  lotId: fixedLotId,
  saleId,
  onDone,
  onBack,
}: {
  ctx: AppContext;
  /**
   * Set when the sale was started from a lot's own page. Null when started from
   * the sale screen, where the lot is chosen inside the form instead.
   */
  lotId: string | null;
  saleId: string | null;
  onDone: () => void;
  onBack: () => void;
}) {
  const { t } = useTranslation();
  const refLabel = useRefLabel();
  const grades = useGrades(ctx.householdId);
  const crops = useCrops(ctx.householdId);
  const fields = useFields(ctx.householdId);
  const coldStores = useColdStores(ctx.householdId);
  const buyers = useLiveQuery(() => knownBuyers(ctx.householdId), [ctx.householdId], []);
  const partners = useLiveQuery(() => knownPartners(ctx.householdId), [ctx.householdId], []);
  /**
   * Whether this sale came out of storage. Only asked for a crop that uses cold
   * storage — wheat has no lots to come out of, so the question would be noise.
   */
  const [fromStorage, setFromStorage] = useState<boolean | null>(
    fixedLotId ? true : null,
  );
  const [pickedLotId, setPickedLotId] = useState<string | null>(fixedLotId);
  const [pickedStoreId, setPickedStoreId] = useState<string | null>(null);

  const lotId = fixedLotId ?? pickedLotId;
  const position = useLiveQuery(() => (lotId ? lotPosition(lotId) : null), [lotId]);

  const [loaded, setLoaded] = useState<LocalSale | null | undefined>(saleId ? undefined : null);
  const [soldOn, setSoldOn] = useState(today());
  const [buyer, setBuyer] = useState('');
  const [notes, setNotes] = useState('');
  const [cropId, setCropId] = useState<string | null>(null);
  const [fieldId, setFieldId] = useState<string | null>(null);
  const [lines, setLines] = useState<Line[]>([]);
  const [quantity, setQuantity] = useState('');
  const [unit, setUnit] = useState('');
  const [rate, setRate] = useState('');
  const [khataId, setKhataId] = useState<string | null>(null);
  const [sharingMode, setSharingMode] = useState<SharingMode>('khata');
  const [partnerName, setPartnerName] = useState('');
  const [partnerShare, setPartnerShare] = useState('');
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!saleId) return;
    let cancelled = false;
    void (async () => {
      const [sale, rows] = await Promise.all([getSale(saleId), saleGradeRows(saleId)]);
      if (cancelled) return;
      setLoaded(sale ?? null);
      if (!sale) return;
      setSoldOn(sale.soldOn);
      setBuyer(sale.buyer ?? '');
      setNotes(sale.notes ?? '');
      setCropId(sale.cropId);
      setFieldId(sale.fieldId);
      setQuantity(sale.quantity === null ? '' : String(sale.quantity));
      setUnit(sale.unit ?? '');
      setRate(sale.ratePerPacket === null ? '' : String(sale.ratePerPacket));
      setKhataId(sale.khataId);
      setSharingMode((sale.sharingMode as SharingMode) ?? 'khata');
      setPartnerName(sale.partnerName ?? '');
      setPartnerShare(sale.partnerShare === null ? '' : String(sale.partnerShare));
      setLines(
        rows.map((r) => ({ gradeId: r.gradeId, packets: r.packets, ratePerPacket: r.ratePerPacket })),
      );
    })();
    return () => {
      cancelled = true;
    };
  }, [saleId]);

  // A single crop that never uses cold storage is the whole answer for a
  // field sale; nothing to ask when there is only one.
  const sellable = lotId ? crops : crops.filter((c) => !c.usesColdStorage);
  useEffect(() => {
    if (!saleId && cropId === null && sellable.length === 1) setCropId(sellable[0]!.id);
  }, [saleId, cropId, sellable]);

  const khatas = useLiveQuery(
    async () => (await listKhatas(ctx.householdId)).filter((k) => k.status === 'open'),
    [ctx.householdId],
    [],
  );
  useEffect(() => {
    if (!saleId && khataId === null && khatas.length === 1) setKhataId(khatas[0]!.id);
  }, [saleId, khataId, khatas]);

  const khataShares = useLiveQuery(
    async () => (khataId ? await khataPartners(khataId) : []),
    [khataId],
    [],
  );
  const selfPct = ownPercent(
    khataShares.map((p) => ({ name: p.name, sharePercent: p.sharePercent, isSelf: p.isSelf })),
  );

  const crop = crops.find((c) => c.id === cropId);
  const effectiveUnit = unit || crop?.defaultUnit || '';

  // What is actually in storage for this crop, so the lot list offers only lots
  // with packets left in them.
  const inStorage = useLiveQuery(
    () => availableLots(ctx.cropCycleId, { cropId }),
    [ctx.cropCycleId, cropId],
    [],
  );
  const storeIds = [...new Set(inStorage.map((l) => l.entry.coldStoreId).filter(Boolean) as string[])];
  const lotsHere = inStorage.filter(
    (l) => !pickedStoreId || l.entry.coldStoreId === pickedStoreId,
  );

  // One store holding stock is not a question worth asking.
  useEffect(() => {
    if (fromStorage && pickedStoreId === null && storeIds.length === 1) {
      setPickedStoreId(storeIds[0]!);
    }
  }, [fromStorage, pickedStoreId, storeIds]);


  const maxByGrade: Record<string, number> = {};
  for (const row of position?.remaining ?? []) {
    // Editing an existing sale must not count its own packets as already gone.
    const own = loaded ? (lines.find((l) => l.gradeId === row.gradeId)?.packets ?? 0) : 0;
    maxByGrade[row.gradeId] = Math.max(0, row.remaining + (saleId ? own : 0));
  }

  const total = lotId
    ? saleTotal(lines)
    : Math.round((Number(quantity) || 0) * (parseAmount(rate) ?? 0) * 100) / 100;

  const setLine = (gradeId: string, patch: Partial<Line>) => {
    setLines((current) => {
      const existing = current.find((l) => l.gradeId === gradeId);
      const merged: Line = { gradeId, packets: 0, ratePerPacket: null, ...existing, ...patch };
      const rest = current.filter((l) => l.gradeId !== gradeId);
      return merged.packets > 0 ? [...rest, merged] : rest;
    });
  };

  const handleSave = async () => {
    const share = parseAmount(partnerShare);
    const isShared = sharingMode === 'custom';
    const next: Record<string, string | undefined> = {};

    if (!cropId) next.crop = t('sale.cropMissing');

    if (fromStorage) {
      if (!lotId) next.lot = t('sale.lotMissing');
      else if (lines.every((l) => l.packets <= 0)) next.lines = t('sale.packetsMissing');
    } else {
      if (quantity === '' || Number(quantity) <= 0) next.quantity = t('sale.quantityMissing');
    }
    if (isShared) {
      if (partnerName.trim() === '') next.partnerName = t('expense.partnerNameMissing');
      if (share !== null && share > total) next.partnerShare = t('expense.shareTooBig');
    }

    setErrors(next);
    if (Object.values(next).some(Boolean)) return;

    setSaving(true);
    try {
      await saveSale(
        ctx,
        fromStorage ? lotId : null,
        {
          soldOn,
          buyer: buyer.trim() || null,
          notes: notes.trim() || null,
          khataId,
          sharingMode,
          cropId,
          fieldId,
          lines,
          quantity: quantity === '' ? null : Number(quantity),
          unit: effectiveUnit || null,
          ratePerUnit: parseAmount(rate),
          partnerName: isShared ? partnerName.trim() : null,
          partnerShare: isShared ? (share ?? 0) : null,
        },
        loaded?.id,
      );
      onDone();
    } catch {
      setErrors({ save: t('error.saveFailed') });
    } finally {
      setSaving(false);
    }
  };

  if (loaded === undefined) {
    return (
      <Screen title={t('sale.newSale')} onBack={onBack}>
        <p className="text-lg text-ink-soft">{t('common.loading')}</p>
      </Screen>
    );
  }

  return (
    <Screen
      title={loaded ? t('sale.editSale') : t('sale.newSale')}
      onBack={onBack}
      action={
        <>
          <div className="mb-2 flex items-baseline justify-between">
            <span className="text-lg font-semibold text-ink-soft">{t('sale.total')}</span>
            <span className="tabular text-3xl font-bold text-debit">{formatRupees(total)}</span>
          </div>
          {errors.save ? (
            <p className="mb-2 error-text" role="alert">
              {errors.save}
            </p>
          ) : null}
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={saving}
            className="btn-primary w-full text-xl"
          >
            {t('sale.save')}
          </button>
        </>
      }
    >
      <div className="flex flex-col gap-6 pb-4">
        <DateField value={soldOn} onChange={setSoldOn} />

        {/* What was sold. Everything below depends on this, so it comes first. */}
        {!fixedLotId ? (
          <ChoiceGrid
            legend={t('sale.cropLabel')}
            choices={crops.map((c) => ({
              id: c.id,
              label: refLabel({ labelHi: c.nameHi, labelEn: c.nameEn }),
            }))}
            value={cropId}
            onChange={(next) => {
              setCropId(next);
              setPickedLotId(null);
              setPickedStoreId(null);
              const picked = crops.find((c) => c.id === next);
              if (picked?.defaultUnit && unit === '') setUnit(picked.defaultUnit);
              // Only a crop that goes into storage gets asked the question at
              // all; anything else is a field sale by definition.
              setFromStorage(picked?.usesColdStorage ? null : false);
            }}
            error={errors.crop}
          />
        ) : null}

        {/* Asked only for a crop that uses cold storage. */}
        {!fixedLotId && crop?.usesColdStorage ? (
          <section>
            <span className="label">{t('sale.fromStorageQuestion')}</span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setFromStorage(true)}
                aria-pressed={fromStorage === true}
                className={fromStorage === true ? 'btn-primary flex-1' : 'btn-secondary flex-1'}
              >
                {t('sale.yes')}
              </button>
              <button
                type="button"
                onClick={() => {
                  setFromStorage(false);
                  setPickedLotId(null);
                }}
                aria-pressed={fromStorage === false}
                className={fromStorage === false ? 'btn-primary flex-1' : 'btn-secondary flex-1'}
              >
                {t('sale.no')}
              </button>
            </div>
          </section>
        ) : null}

        {/* Which store, then which lot — chosen from what is actually there. */}
        {!fixedLotId && fromStorage ? (
          inStorage.length === 0 ? (
            <p className="card px-4 py-4 text-center text-lg text-ink-soft">{t('sale.noStock')}</p>
          ) : (
            <>
              {storeIds.length > 1 ? (
                <ChoiceGrid
                  legend={t('sale.pickStore')}
                  choices={storeIds.map((id) => ({
                    id,
                    label: coldStores.find((c) => c.id === id)?.name ?? id,
                  }))}
                  value={pickedStoreId}
                  onChange={(next) => {
                    setPickedStoreId(next);
                    setPickedLotId(null);
                  }}
                />
              ) : null}

              <fieldset>
                <legend className="label">{t('sale.pickLot')}</legend>
                {errors.lot ? (
                  <p className="error-text mb-2" role="alert">
                    {errors.lot}
                  </p>
                ) : null}

                <ul className="flex flex-col gap-2">
                  {lotsHere.map(({ lot, entry, remaining, total }) => (
                    <li key={lot.id}>
                      <button
                        type="button"
                        onClick={() => {
                          setPickedLotId(lot.id);
                          setLines([]);
                        }}
                        aria-pressed={pickedLotId === lot.id}
                        className={`card-tap w-full px-4 py-3 ${
                          pickedLotId === lot.id ? 'border-brand bg-brand-tint' : ''
                        }`}
                      >
                        <span className="flex items-baseline justify-between gap-2">
                          <span className="tabular text-lg font-bold">{lot.lotNo}</span>
                          <span className="tabular text-sm text-ink-soft">
                            {formatRegisterDate(entry.storedOn)}
                          </span>
                        </span>
                        <span className="tabular mt-0.5 block text-xl font-bold text-brand">
                          {formatLotBreakdown(
                            remaining.map((row) => ({
                              code: grades.find((g) => g.id === row.gradeId)?.code ?? '?',
                              packets: row.remaining,
                              sortOrder: grades.find((g) => g.id === row.gradeId)?.sortOrder,
                            })),
                            { total },
                          )}
                        </span>
                        <span className="mt-0.5 block text-sm text-ink-soft">
                          {coldStores.find((c) => c.id === entry.coldStoreId)?.name}
                          {lot.roomRack ? ` · ${lot.roomRack}` : ''}
                          {entry.variety ? ` · ${entry.variety}` : ''}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </fieldset>
            </>
          )
        ) : null}

        {lotId ? (
          /* Out of a lot: packets per grade, each at its own rate, capped at
             what is still in the store. */
          <fieldset>
            <legend className="label">{t('sale.linesLabel')}</legend>
            {errors.lines ? (
              <p className="mb-2 error-text" role="alert">
                {errors.lines}
              </p>
            ) : null}
            <ul className="flex flex-col gap-2">
              {grades
                .filter((grade) => (maxByGrade[grade.id] ?? 0) > 0)
                .map((grade) => {
                  const line = lines.find((l) => l.gradeId === grade.id);
                  return (
                    <li key={grade.id} className="card flex flex-col gap-2 px-3 py-3">
                      <div className="flex items-center gap-3">
                        <GradeMark grade={grade} size={44} />
                        <span className="min-w-0 flex-1">
                          <span className="block text-xl font-bold leading-tight">
                            {grade.labelHi}
                          </span>
                          <span className="tabular text-sm font-medium text-ink-soft">
                            {t('stock.remaining')}: {maxByGrade[grade.id]}
                          </span>
                        </span>
                        <Stepper
                          value={line?.packets ?? 0}
                          onChange={(packets) => setLine(grade.id, { packets })}
                          max={maxByGrade[grade.id]}
                          label={grade.labelHi}
                        />
                      </div>

                      {(line?.packets ?? 0) > 0 ? (
                        <label className="flex items-center gap-2 border-t-2 border-line pt-2">
                          <span className="flex-1 text-base font-semibold text-ink-soft">
                            {t('sale.rateLabel')}
                          </span>
                          <span className="tabular text-xl font-bold text-ink-soft">₹</span>
                          <input
                            type="text"
                            inputMode="decimal"
                            value={line?.ratePerPacket === null ? '' : String(line?.ratePerPacket)}
                            placeholder="0"
                            onChange={(event) =>
                              setLine(grade.id, {
                                ratePerPacket: parseAmount(event.target.value),
                              })
                            }
                            className="tabular h-touch w-28 rounded-2xl border-2 border-line bg-surface text-center text-xl font-bold text-debit placeholder:text-ink-soft"
                            aria-label={`${t('sale.rateLabel')} — ${grade.labelHi}`}
                          />
                        </label>
                      ) : null}
                    </li>
                  );
                })}
            </ul>
          </fieldset>
        ) : (
          /* Straight off the field: how much, at what rate. */
          fromStorage === false ? (
          <>
            <div>
              <QuantityField
                label={t('sale.quantityLabel')}
                quantity={quantity}
                unit={effectiveUnit}
                onQuantityChange={setQuantity}
                onUnitChange={setUnit}
                suggestedUnit={crop?.defaultUnit}
              />
              {errors.quantity ? (
                <p className="mt-2 error-text" role="alert">
                  {errors.quantity}
                </p>
              ) : null}
            </div>

            <label className="block">
              <span className="label">
                {t('sale.ratePerUnit', { unit: effectiveUnit || t('sale.packetsLabel') })}
              </span>
              <div className="flex items-center gap-2">
                <span className="tabular text-2xl font-bold text-ink-soft">₹</span>
                <input
                  type="text"
                  inputMode="decimal"
                  value={rate}
                  placeholder="0"
                  onChange={(event) => setRate(event.target.value.replace(/[^0-9.]/g, ''))}
                  className="tabular min-h-touch flex-1 rounded-2xl border-2 border-line bg-surface px-4 py-3 text-2xl font-bold text-debit placeholder:text-ink-soft"
                />
              </div>
            </label>

            <ChoiceGrid
              legend={t('expense.fieldLabel')}
              choices={fields.map((f) => ({ id: f.id, label: f.name }))}
              value={fieldId}
              onChange={setFieldId}
              emptyChoiceLabel={t('expense.fieldAll')}
            />
          </>
          ) : null
        )}

        <SuggestField
          label={t('sale.buyerLabel')}
          value={buyer}
          onChange={setBuyer}
          suggestions={buyers}
          placeholder={t('sale.buyerPlaceholder')}
        />

        {khatas.length > 0 ? (
          <ChoiceGrid
            legend={t('khata.selectLabel')}
            choices={khatas.map((k) => ({ id: k.id, label: k.name }))}
            value={khataId}
            onChange={setKhataId}
          />
        ) : null}

        <SharingField
          amount={total}
          mode={sharingMode}
          onModeChange={setSharingMode}
          partnerName={partnerName}
          partnerShare={partnerShare}
          onPartnerNameChange={setPartnerName}
          onPartnerShareChange={setPartnerShare}
          knownPartners={partners}
          selfPercent={selfPct}
          khataName={khatas.find((k) => k.id === khataId)?.name ?? null}
          shareLabel={t('sale.myIncome')}
          errors={{ name: errors.partnerName, share: errors.partnerShare }}
        />

        <TextField
          label={t('expense.notesLabel')}
          value={notes}
          onChange={setNotes}
          placeholder={t('expense.notesPlaceholder')}
          multiline
        />
      </div>
    </Screen>
  );
}

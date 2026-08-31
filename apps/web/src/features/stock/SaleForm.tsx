import {
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
import { lotPosition } from '../../db/inventory.js';
import type { AppContext } from '../../db/seed.js';
import type { LocalSale } from '../../db/types.js';
import { useCrops, useFields, useGrades } from '../../hooks/useAppData.js';
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
  lotId,
  saleId,
  onDone,
  onBack,
}: {
  ctx: AppContext;
  /** null for produce that never went into storage. */
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
  const buyers = useLiveQuery(() => knownBuyers(ctx.householdId), [ctx.householdId], []);
  const partners = useLiveQuery(() => knownPartners(ctx.householdId), [ctx.householdId], []);
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

    if (lotId) {
      if (lines.every((l) => l.packets <= 0)) next.lines = t('sale.packetsMissing');
    } else {
      if (!cropId) next.crop = t('sale.cropMissing');
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
        lotId,
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
            <span className="tabular text-3xl font-bold text-rupee">{formatRupees(total)}</span>
          </div>
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
            {t('sale.save')}
          </button>
        </>
      }
    >
      <div className="flex flex-col gap-6 pb-4">
        <DateField value={soldOn} onChange={setSoldOn} />

        {lotId ? (
          /* Out of a lot: packets per grade, each at its own rate, capped at
             what is still in the store. */
          <fieldset>
            <legend className="label">{t('sale.linesLabel')}</legend>
            {errors.lines ? (
              <p className="mb-2 text-base font-semibold text-danger" role="alert">
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
                        <label className="flex items-center gap-2 border-t-2 border-rule pt-2">
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
                            className="tabular h-touch w-28 rounded-2xl border-2 border-rule bg-paper-raised text-center text-xl font-bold text-rupee placeholder:text-ink-soft"
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
          /* Straight off the field: what, how much, at what rate. */
          <>
            <ChoiceGrid
              legend={t('sale.cropLabel')}
              choices={sellable.map((c) => ({
                id: c.id,
                label: refLabel({ labelHi: c.nameHi, labelEn: c.nameEn }),
              }))}
              value={cropId}
              onChange={(next) => {
                setCropId(next);
                const picked = crops.find((c) => c.id === next);
                if (picked?.defaultUnit && unit === '') setUnit(picked.defaultUnit);
              }}
              error={errors.crop}
            />

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
                <p className="mt-2 text-base font-semibold text-danger" role="alert">
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
                  className="tabular min-h-touch flex-1 rounded-2xl border-2 border-rule bg-paper-raised px-4 py-3 text-2xl font-bold text-rupee placeholder:text-ink-soft"
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

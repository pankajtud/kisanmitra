import { parseAmount, today } from '@kisanmitra/shared';
import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AmountField } from '../../components/AmountField.js';
import { ChoiceGrid } from '../../components/ChoiceGrid.js';
import { DateField } from '../../components/DateField.js';
import { PhotoPreview } from '../../components/PhotoPreview.js';
import { Screen } from '../../components/Screen.js';
import { TextField } from '../../components/TextField.js';
import { PartnerShareField } from '../../components/PartnerShareField.js';
import { QuantityField } from '../../components/QuantityField.js';
import { SuggestField } from '../../components/SuggestField.js';
import { getExpense, knownPartners, knownProducts, saveExpense } from '../../db/expenses.js';
import type { AppContext } from '../../db/seed.js';
import type { LocalExpense } from '../../db/types.js';
import { useCategories, useCrops, useFields } from '../../hooks/useAppData.js';
import { useRefLabel } from '../../lib/labels.js';

/**
 * The confirmation screen from §8.5, and the manual entry screen — they are the
 * same screen, because a photo is just an expense that already has its receipt.
 *
 * Amount and date are mandatory; everything else is optional. Nothing here is
 * pre-filled from a model yet: extraction arrives at M3, and its suggestions
 * will land in exactly these fields for the user to confirm or correct.
 */
export function ExpenseForm({
  ctx,
  expenseId,
  onDone,
  onBack,
}: {
  ctx: AppContext;
  /** An existing draft (from a photo) or a confirmed expense being edited. */
  expenseId: string | null;
  onDone: () => void;
  onBack: () => void;
}) {
  const { t } = useTranslation();
  const categories = useCategories(ctx.householdId);
  const refLabel = useRefLabel();
  const crops = useCrops(ctx.householdId);
  const partners = useLiveQuery(() => knownPartners(ctx.householdId), [ctx.householdId], []);
  const products = useLiveQuery(() => knownProducts(ctx.householdId), [ctx.householdId], []);
  const fields = useFields(ctx.householdId);

  const [loaded, setLoaded] = useState<LocalExpense | null | undefined>(expenseId ? undefined : null);
  const [amount, setAmount] = useState('');
  const [spentOn, setSpentOn] = useState(today());
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [fieldId, setFieldId] = useState<string | null>(null);
  const [vendor, setVendor] = useState('');
  const [notes, setNotes] = useState('');
  const [shared, setShared] = useState(false);
  const [partnerName, setPartnerName] = useState('');
  const [partnerShare, setPartnerShare] = useState('');
  const [cropId, setCropId] = useState<string | null>(null);
  const [product, setProduct] = useState('');
  const [quantity, setQuantity] = useState('');
  const [unit, setUnit] = useState('');
  const [errors, setErrors] = useState<{
    amount?: string;
    category?: string;
    partnerName?: string;
    partnerShare?: string;
    save?: string;
  }>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!expenseId) return;
    let cancelled = false;
    void getExpense(expenseId).then((row) => {
      if (cancelled) return;
      setLoaded(row ?? null);
      if (!row) return;
      setAmount(row.amount === null ? '' : String(row.amount));
      setSpentOn(row.spentOn);
      setCategoryId(row.categoryId);
      setFieldId(row.fieldId);
      setVendor(row.vendor ?? '');
      setNotes(row.notes ?? '');
      setShared(row.partnerName !== null || row.partnerShare !== null);
      setPartnerName(row.partnerName ?? '');
      setPartnerShare(row.partnerShare === null ? '' : String(row.partnerShare));
      setCropId(row.cropId);
      setProduct(row.product ?? '');
      setQuantity(row.quantity === null ? '' : String(row.quantity));
      setUnit(row.unit ?? '');
    });
    return () => {
      cancelled = true;
    };
  }, [expenseId]);

  if (loaded === undefined) {
    return (
      <Screen title={t('expense.newTitle')} onBack={onBack}>
        <p className="text-lg text-ink-soft">{t('common.loading')}</p>
      </Screen>
    );
  }

  if (expenseId && loaded === null) {
    return (
      <Screen title={t('expense.newTitle')} onBack={onBack}>
        <p className="text-lg font-semibold text-danger" role="alert">
          {t('error.notFound')}
        </p>
      </Screen>
    );
  }

  const isEdit = loaded?.status === 'confirmed';
  const receiptId = loaded?.receiptId ?? null;

  const handleSave = async () => {
    const parsed = parseAmount(amount);
    const share = parseAmount(partnerShare);
    const isShared = shared;

    const next: typeof errors = {};
    if (parsed === null || parsed === 0) next.amount = t('expense.amountMissing');
    if (!categoryId) next.category = t('expense.categoryMissing');

    if (isShared) {
      if (partnerName.trim() === '') next.partnerName = t('expense.partnerNameMissing');
      // A share bigger than the bill would make the household's own cost
      // negative, which silently understates the season total.
      if (parsed !== null && share !== null && share > parsed) {
        next.partnerShare = t('expense.shareTooBig');
      }
    }

    setErrors(next);
    if (Object.keys(next).length > 0) return;

    setSaving(true);
    try {
      await saveExpense(
        ctx,
        {
          amount: parsed as number,
          spentOn,
          categoryId,
          fieldId,
          vendor: vendor.trim() || null,
          notes: notes.trim() || null,
          partnerName: isShared ? partnerName.trim() : null,
          partnerShare: isShared ? (share ?? 0) : null,
          cropId,
          product: product.trim() || null,
          quantity: quantity === '' ? null : Number(quantity),
          unit: unit.trim() || null,
          entryMethod: receiptId ? 'photo' : 'manual',
          receiptId,
        },
        loaded?.id,
      );
      onDone();
    } catch {
      // Says what to do, does not apologise (§10).
      setErrors({ save: t('error.saveFailed') });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen
      title={isEdit ? t('expense.editTitle') : t('expense.newTitle')}
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
            {isEdit ? t('expense.saveEdit') : t('expense.save')}
          </button>
        </>
      }
    >
      <div className="flex flex-col gap-6 pb-4">
        {receiptId ? <PhotoPreview receiptId={receiptId} /> : null}

        <AmountField value={amount} onChange={setAmount} error={errors.amount} />

        <DateField value={spentOn} onChange={setSpentOn} />

        <ChoiceGrid
          legend={t('expense.categoryLabel')}
          choices={categories.map((c) => ({ id: c.id, label: refLabel(c) }))}
          value={categoryId}
          onChange={setCategoryId}
          error={errors.category}
        />

        <ChoiceGrid
          legend={t('expense.cropLabel')}
          choices={crops.map((c) => ({ id: c.id, label: refLabel({ labelHi: c.nameHi, labelEn: c.nameEn }) }))}
          value={cropId}
          onChange={(next) => {
            setCropId(next);
            // Adopt the crop's usual unit, unless the user already chose one.
            const crop = crops.find((c) => c.id === next);
            if (crop?.defaultUnit && unit === '') setUnit(crop.defaultUnit);
          }}
          emptyChoiceLabel={t('expense.cropAll')}
        />

        <SuggestField
          label={t('expense.productLabel')}
          value={product}
          onChange={setProduct}
          suggestions={products}
          placeholder={t('expense.productPlaceholder')}
        />

        <QuantityField
          label={t('expense.quantityLabel')}
          quantity={quantity}
          unit={unit}
          onQuantityChange={setQuantity}
          onUnitChange={setUnit}
          suggestedUnit={crops.find((c) => c.id === cropId)?.defaultUnit}
        />

        <ChoiceGrid
          legend={t('expense.fieldLabel')}
          choices={fields.map((f) => ({ id: f.id, label: f.name }))}
          value={fieldId}
          onChange={setFieldId}
          emptyChoiceLabel={t('expense.fieldAll')}
        />

        <PartnerShareField
          amount={parseAmount(amount)}
          partnerName={partnerName}
          partnerShare={partnerShare}
          onPartnerNameChange={setPartnerName}
          onPartnerShareChange={setPartnerShare}
          shared={shared}
          onSharedChange={setShared}
          onClear={() => {
            setShared(false);
            setPartnerName('');
            setPartnerShare('');
          }}
          knownPartners={partners}
          errors={{ name: errors.partnerName, share: errors.partnerShare }}
        />

        <TextField
          label={t('expense.vendorLabel')}
          value={vendor}
          onChange={setVendor}
          placeholder={t('expense.vendorPlaceholder')}
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

import { partnersAddUp, today } from '@kisanmitra/shared';
import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChoiceGrid } from '../../components/ChoiceGrid.js';
import { DateField } from '../../components/DateField.js';
import { Screen } from '../../components/Screen.js';
import { SuggestField } from '../../components/SuggestField.js';
import { getKhata, khataPartners, knownPartnerNames, saveKhata, type PartnerInput } from '../../db/khata.js';
import type { AppContext } from '../../db/seed.js';
import type { LocalKhata } from '../../db/types.js';
import { useCrops } from '../../hooks/useAppData.js';
import { useRefLabel } from '../../lib/labels.js';

/**
 * Opening a khata: what it is for, and who shares it.
 *
 * The partner agreement is captured once here, as percentages, because that is
 * how a partnership is actually agreed. Every entry in the khata then inherits
 * it without further tapping (CLAUDE.md §2.4), and the odd entry that departs
 * from the agreement overrides itself.
 */
export function KhataForm({
  ctx,
  khataId,
  onDone,
  onBack,
}: {
  ctx: AppContext;
  khataId: string | null;
  onDone: (khataId: string) => void;
  onBack: () => void;
}) {
  const { t } = useTranslation();
  const refLabel = useRefLabel();
  const crops = useCrops(ctx.householdId);
  const suggestions = useLiveQuery(() => knownPartnerNames(ctx.householdId), [ctx.householdId], []);

  const [loaded, setLoaded] = useState<LocalKhata | null | undefined>(khataId ? undefined : null);
  const [name, setName] = useState('');
  const [cropId, setCropId] = useState<string | null>(null);
  const [openedOn, setOpenedOn] = useState(today());
  const [partners, setPartners] = useState<PartnerInput[]>([]);
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});

  useEffect(() => {
    if (!khataId) return;
    let cancelled = false;
    void (async () => {
      const [khata, rows] = await Promise.all([getKhata(khataId), khataPartners(khataId)]);
      if (cancelled) return;
      setLoaded(khata ?? null);
      if (!khata) return;
      setName(khata.name);
      setCropId(khata.cropId);
      setOpenedOn(khata.openedOn);
      setPartners(rows.map((r) => ({ name: r.name, sharePercent: r.sharePercent, isSelf: r.isSelf })));
    })();
    return () => {
      cancelled = true;
    };
  }, [khataId]);

  /** Adding the first partner splits the khata evenly with the household. */
  const addPartner = () => {
    setPartners((current) => {
      if (current.length === 0) {
        return [
          { name: t('khata.you'), sharePercent: 50, isSelf: true },
          { name: '', sharePercent: 50, isSelf: false },
        ];
      }
      const even = Math.floor(100 / (current.length + 1));
      const next = current.map((p) => ({ ...p, sharePercent: even }));
      next.push({ name: '', sharePercent: 100 - even * current.length, isSelf: false });
      return next;
    });
  };

  const removePartner = (index: number) => {
    setPartners((current) => {
      const next = current.filter((_, i) => i !== index);
      // Dropping back to one party means there is no partnership left to record.
      if (next.filter((p) => !p.isSelf).length === 0) return [];
      const own = next.find((p) => p.isSelf);
      if (own) own.sharePercent = 100 - next.filter((p) => !p.isSelf).reduce((s, p) => s + p.sharePercent, 0);
      return [...next];
    });
  };

  const setPartner = (index: number, patch: Partial<PartnerInput>) =>
    setPartners((current) => current.map((p, i) => (i === index ? { ...p, ...patch } : p)));

  const handleSave = async () => {
    const next: Record<string, string | undefined> = {};
    if (name.trim() === '') next.name = t('khata.nameMissing');
    if (partners.some((p) => !p.isSelf && p.name.trim() === '')) {
      next.partners = t('khata.partnerNameMissing');
    }
    if (!partnersAddUp(partners)) next.shares = t('khata.sharesMustTotal');

    setErrors(next);
    if (Object.values(next).some(Boolean)) return;

    const id = await saveKhata(
      ctx,
      { name: name.trim(), cropId, openedOn, notes: loaded?.notes ?? null, partners },
      loaded?.id,
    );
    onDone(id);
  };

  if (loaded === undefined) {
    return (
      <Screen title={t('khata.new')} onBack={onBack}>
        <p className="text-lg text-ink-soft">{t('common.loading')}</p>
      </Screen>
    );
  }

  const shareTotal = partners.reduce((sum, p) => sum + p.sharePercent, 0);

  return (
    <Screen
      title={loaded ? t('khata.edit') : t('khata.new')}
      onBack={onBack}
      action={
        <button type="button" onClick={() => void handleSave()} className="btn-primary w-full text-xl">
          {t('khata.save')}
        </button>
      }
    >
      <div className="flex flex-col gap-6 pb-4">
        <SuggestField
          label={t('khata.nameLabel')}
          value={name}
          onChange={setName}
          suggestions={[]}
          placeholder={t('khata.namePlaceholder')}
          error={errors.name}
          required
        />

        <ChoiceGrid
          legend={t('expense.cropLabel')}
          choices={crops.map((c) => ({
            id: c.id,
            label: refLabel({ labelHi: c.nameHi, labelEn: c.nameEn }),
          }))}
          value={cropId}
          onChange={(next) => {
            setCropId(next);
            // Name the khata after the crop and season unless one is typed.
            const crop = crops.find((c) => c.id === next);
            if (crop && name.trim() === '') setName(crop.nameHi);
          }}
          emptyChoiceLabel={t('expense.cropAll')}
        />

        <DateField value={openedOn} onChange={setOpenedOn} />

        <fieldset>
          <legend className="label">{t('khata.partners')}</legend>

          {errors.partners ? (
            <p className="mb-2 text-base font-semibold text-danger" role="alert">
              {errors.partners}
            </p>
          ) : null}
          {errors.shares ? (
            <p className="mb-2 text-base font-semibold text-danger" role="alert">
              {errors.shares}
            </p>
          ) : null}

          {/* Names already used elsewhere, so a regular partner is typed once. */}
          <datalist id="known-partners">
            {suggestions.map((name) => (
              <option key={name} value={name} />
            ))}
          </datalist>

          <ul className="flex flex-col gap-2">
            {partners.map((partner, index) => (
              <li key={index} className="card flex items-center gap-2 px-3 py-2">
                {partner.isSelf ? (
                  <span className="min-h-touch flex-1 content-center text-lg font-bold">
                    {t('khata.you')}
                  </span>
                ) : (
                  <input
                    type="text"
                    value={partner.name}
                    onChange={(event) => setPartner(index, { name: event.target.value })}
                    placeholder={t('expense.partnerNamePlaceholder')}
                    aria-label={t('expense.partnerNameLabel')}
                    list="known-partners"
                    className="min-h-touch min-w-0 flex-1 rounded-2xl border-2 border-rule bg-paper-raised px-3 text-lg"
                  />
                )}

                <input
                  type="text"
                  inputMode="numeric"
                  value={String(partner.sharePercent)}
                  onChange={(event) =>
                    setPartner(index, {
                      sharePercent: Number(event.target.value.replace(/[^0-9]/g, '')) || 0,
                    })
                  }
                  aria-label={`${t('khata.sharePercent')} — ${partner.isSelf ? t('khata.you') : partner.name}`}
                  className="tabular h-touch w-16 rounded-2xl border-2 border-rule bg-paper-raised text-center text-xl font-bold"
                />
                <span className="text-lg font-bold text-ink-soft">%</span>

                {partner.isSelf ? null : (
                  <button
                    type="button"
                    onClick={() => removePartner(index)}
                    aria-label={t('fields.archive')}
                    className="btn-quiet size-touch px-0 text-2xl text-danger"
                  >
                    ×
                  </button>
                )}
              </li>
            ))}
          </ul>

          {partners.length > 0 ? (
            <p
              className={`tabular mt-2 text-base font-semibold ${
                Math.abs(shareTotal - 100) < 0.01 ? 'text-ink-soft' : 'text-danger'
              }`}
            >
              {shareTotal}%
            </p>
          ) : null}

          <button type="button" onClick={addPartner} className="btn-secondary mt-2 w-full">
            {t('khata.addPartner')}
          </button>
        </fieldset>
      </div>
    </Screen>
  );
}

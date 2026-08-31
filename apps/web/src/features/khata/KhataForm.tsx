import {
  expectedEnd,
  formatRegisterDate,
  khataTitle,
  partnersAddUp,
  seasonLabel,
  today,
} from '@kisanmitra/shared';
import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChoiceGrid } from '../../components/ChoiceGrid.js';
import { DateField } from '../../components/DateField.js';
import { Screen } from '../../components/Screen.js';
import { SuggestField } from '../../components/SuggestField.js';
import { addCrop } from '../../db/crops.js';
import {
  getKhata,
  khataPartners,
  knownPartnerNames,
  saveKhata,
  type PartnerInput,
} from '../../db/khata.js';
import type { AppContext } from '../../db/seed.js';
import type { LocalKhata } from '../../db/types.js';
import { useCrops, useFields } from '../../hooks/useAppData.js';
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
  const fields = useFields(ctx.householdId);
  const suggestions = useLiveQuery(() => knownPartnerNames(ctx.householdId), [ctx.householdId], []);

  const [loaded, setLoaded] = useState<LocalKhata | null | undefined>(khataId ? undefined : null);
  const [name, setName] = useState('');
  const [cropId, setCropId] = useState<string | null>(null);
  const [fieldId, setFieldId] = useState<string | null>(null);
  const [openedOn, setOpenedOn] = useState(today());
  const [season, setSeason] = useState(seasonLabel(today()));
  const [duration, setDuration] = useState('');
  const [newCrop, setNewCrop] = useState('');
  const [partners, setPartners] = useState<PartnerInput[]>([]);
  const [seasonEdited, setSeasonEdited] = useState(false);
  const [nameEdited, setNameEdited] = useState(false);
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
      // An existing khata keeps the name it has; composing over it would rename
      // a record the user has been looking at all season.
      setNameEdited(true);
      setCropId(khata.cropId);
      setFieldId(khata.fieldId);
      setOpenedOn(khata.openedOn);
      setSeason(khata.season ?? seasonLabel(khata.openedOn));
      setDuration(khata.durationMonths === null ? '' : String(khata.durationMonths));
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

  /**
   * The title is crop - partner - year, composed from the parts rather than
   * typed. A farmer running four khatas tells them apart by exactly these three
   * things, so it stays in step until they rename it by hand.
   */
  const suggestedTitle = khataTitle({
    crop: crops.find((c) => c.id === cropId)?.nameHi,
    partners,
    season,
  });
  const title = nameEdited ? name : suggestedTitle;

  /** Selecting a crop fills in whatever the khata has not been told yet. */
  const applyCrop = (next: string | null) => {
    setCropId(next);
    const crop = crops.find((c) => c.id === next);
    if (!crop) return;
    if (duration === '' && crop.defaultDurationMonths) {
      setDuration(String(crop.defaultDurationMonths));
    }
  };

  const handleAddCrop = async () => {
    const id = await addCrop(ctx.householdId, { nameHi: newCrop });
    setNewCrop('');
    if (id) applyCrop(id);
  };

  const closesOn = expectedEnd(openedOn, duration === '' ? null : Number(duration));

  const handleSave = async () => {
    const next: Record<string, string | undefined> = {};
    if (title.trim() === '') next.name = t('khata.nameMissing');
    if (partners.some((p) => !p.isSelf && p.name.trim() === '')) {
      next.partners = t('khata.partnerNameMissing');
    }
    if (!partnersAddUp(partners)) next.shares = t('khata.sharesMustTotal');

    setErrors(next);
    if (Object.values(next).some(Boolean)) return;

    const id = await saveKhata(
      ctx,
      {
        name: title.trim(),
        cropId,
        fieldId,
        season: season.trim() || null,
        openedOn,
        durationMonths: duration === '' ? null : Number(duration),
        notes: loaded?.notes ?? null,
        partners,
      },
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
        <div>
          <ChoiceGrid
            legend={t('expense.cropLabel')}
            choices={crops.map((c) => ({
              id: c.id,
              label: refLabel({ labelHi: c.nameHi, labelEn: c.nameEn }),
            }))}
            value={cropId}
            onChange={(next) => applyCrop(next)}
            emptyChoiceLabel={t('expense.cropAll')}
          />

          {/* A crop that is not on the list yet. Typing it here adds it to the
              household's reference data, so it is a tap next time. */}
          <div className="mt-2 flex items-start gap-2">
            <input
              type="text"
              value={newCrop}
              onChange={(event) => setNewCrop(event.target.value)}
              placeholder={t('crops.namePlaceholder')}
              aria-label={t('crops.add')}
              className="input flex-1"
            />
            <button
              type="button"
              disabled={newCrop.trim() === ''}
              onClick={() => void handleAddCrop()}
              className="btn-secondary px-4"
            >
              {t('crops.add')}
            </button>
          </div>
        </div>

        <ChoiceGrid
          legend={t('expense.fieldLabel')}
          choices={fields.map((f) => ({ id: f.id, label: f.name }))}
          value={fieldId}
          onChange={setFieldId}
          emptyChoiceLabel={t('expense.fieldAll')}
        />

        <DateField
          value={openedOn}
          onChange={(next) => {
            setOpenedOn(next);
            if (!seasonEdited) setSeason(seasonLabel(next));
          }}
        />

        {/* The season the khata belongs to. A khata opened in March belongs to
            the crop planted the previous autumn, so this is derived from the
            opening date rather than the calendar year — and stays editable. */}
        <label className="block">
          <span className="label">{t('khata.seasonLabel')}</span>
          <input
            type="text"
            value={season}
            onChange={(event) => {
              setSeason(event.target.value);
              setSeasonEdited(true);
            }}
            placeholder="2025-26"
            className="input tabular"
          />
        </label>

        <div>
          <span className="label">{t('khata.durationLabel')}</span>
          <div className="flex flex-wrap items-center gap-2">
            {[3, 4, 5, 6, 12].map((months) => (
              <button
                key={months}
                type="button"
                onClick={() => setDuration(String(months))}
                aria-pressed={duration === String(months)}
                className={`btn btn-sm ${
                  duration === String(months)
                    ? 'bg-brand text-white'
                    : 'border-2 border-line bg-surface text-ink active:bg-brand-tint'
                }`}
              >
                {t('khata.months', { count: months })}
              </button>
            ))}
            <input
              type="text"
              inputMode="numeric"
              value={duration}
              onChange={(event) => setDuration(event.target.value.replace(/[^0-9]/g, ''))}
              aria-label={t('khata.durationLabel')}
              className="input tabular h-14 w-20 px-2 text-center"
            />
          </div>

          {closesOn ? (
            <p className="tabular mt-2 text-base text-ink-soft">
              {t('khata.closesOn', { date: formatRegisterDate(closesOn) })}
            </p>
          ) : null}
        </div>

        <fieldset>
          <legend className="label">{t('khata.partners')}</legend>

          {errors.partners ? (
            <p className="mb-2 error-text" role="alert">
              {errors.partners}
            </p>
          ) : null}
          {errors.shares ? (
            <p className="mb-2 error-text" role="alert">
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
                    className="min-h-touch min-w-0 flex-1 rounded-2xl border-2 border-line bg-surface px-3 text-lg"
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
                  className="tabular h-touch w-16 rounded-2xl border-2 border-line bg-surface text-center text-xl font-bold"
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

        {/* Composed from the three fields above; editable if the household
            calls this venture something else. */}
        <SuggestField
          label={t('khata.nameLabel')}
          value={title}
          onChange={(next) => {
            setName(next);
            setNameEdited(true);
          }}
          suggestions={[]}
          placeholder={t('khata.namePlaceholder')}
          error={errors.name}
          required
        />
      </div>
    </Screen>
  );
}

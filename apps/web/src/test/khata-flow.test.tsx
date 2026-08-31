import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { App } from '../App.js';
import { setPin } from '../db/lock.js';
import { ensureSeeded, type AppContext } from '../db/seed.js';
import { listKhatas } from '../db/khata.js';

const PIN = '1234';

async function unlocked(user: ReturnType<typeof userEvent.setup>) {
  await setPin(PIN);
  render(<App />);
  await screen.findByRole('heading', { name: 'अपना पिन डालें' });
  for (const digit of PIN) await user.click(screen.getByRole('button', { name: digit }));
  await screen.findByRole('button', { name: 'बिना फोटो के खर्च जोड़ें' });
}

let ctx: AppContext;
beforeEach(async () => {
  ctx = await ensureSeeded();
});

describe('opening a khata', () => {
  it('saves it and shows its detail screen', async () => {
    const user = userEvent.setup();
    await unlocked(user);

    await user.click(screen.getByRole('button', { name: 'खाते' }));
    await user.click(await screen.findByRole('button', { name: 'नया खाता' }));

    await user.click(await screen.findByRole('button', { name: 'आलू' }));
    await user.click(screen.getByRole('button', { name: 'खाता सेव करें' }));

    await waitFor(async () => {
      expect(await listKhatas(ctx.householdId)).toHaveLength(1);
    });

    // The detail screen must actually render, not go blank.
    const [khata] = await listKhatas(ctx.householdId);
    await screen.findByRole('heading', { name: khata!.name });
    expect(screen.getByText('पूरा हिसाब')).toBeInTheDocument();
  });
});

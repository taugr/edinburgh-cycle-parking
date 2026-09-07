import { expect, test } from '@playwright/test';
import { installOfflineMapFixture } from './offline-map-fixtures';

test.beforeEach(async ({ context }) => {
  await installOfflineMapFixture(context);
});

for (const state of ['denied', 'unavailable', '55.9533,-3.1883']) {
  test(`keeps the header thin and manual location feedback accessible for ${state}`, async ({
    page,
  }) => {
    await page.goto(`/?mockGps=${state}`);
    await expect(page.getByTestId('parking-list')).toBeVisible();
    await expect(page.locator('.location-context')).toHaveCount(0);
    if (state.includes(',')) {
      await expect(
        page.locator('.start-marker:not(.reference-marker)'),
      ).toBeVisible();
    } else {
      await expect(page.locator('.reference-marker')).toBeVisible();
      await expect(page.locator('.place-search-message')).toHaveCount(0);
      await page
        .getByRole('button', { name: 'Use current location', exact: true })
        .click();
      await expect(page.getByRole('status')).toContainText(
        state === 'denied'
          ? 'Location permission needed'
          : 'Location unavailable',
      );
      await expect(page.locator('.reference-marker')).toHaveAttribute(
        'aria-label',
        'Edinburgh Waverley',
      );
      await expect(
        page.getByRole('button', { name: 'Current location', exact: true }),
      ).toHaveCount(0);
    }
  });
}

test('does not present a shared reference as GPS', async ({ page }) => {
  await page.goto('/?lat=55.9533&lng=-3.1883');
  await expect(page.locator('.location-context')).toHaveCount(0);
  await expect(page.locator('.reference-marker')).toHaveAttribute(
    'aria-label',
    'shared location',
  );
});

for (const width of [320, 390, 820, 821]) {
  test(`keeps map controls clear of the thinner header at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 844 });
    await page.goto('/?mockGps=denied');
    await expect(page.locator('.reference-marker')).toBeVisible();
    await expect(page.locator('.location-context')).toHaveCount(0);
    await expect(
      page.getByRole('button', { name: 'Use current location', exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Zoom in', exact: true }),
    ).toBeVisible();
    if (width <= 820)
      await expect
        .poll(async () => {
          const toolbar = await page
            .locator('.mobile-map-toolbar')
            .boundingBox();
          const zoom = await page
            .getByRole('button', { name: 'Zoom in', exact: true })
            .boundingBox();
          const layers = await page
            .getByRole('button', { name: 'Map layers', exact: true })
            .boundingBox();
          return Boolean(
            toolbar &&
            zoom &&
            layers &&
            zoom.y >= toolbar.y + toolbar.height &&
            layers.y >= toolbar.y + toolbar.height,
          );
        })
        .toBe(true);
  });
}

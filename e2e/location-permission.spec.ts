import { expect, test, type Page } from '@playwright/test';
import { installOfflineMapFixture } from './offline-map-fixtures';

const storageKey = 'neuk-bike:last-location:v1';
const edinburgh = { latitude: 55.9533, longitude: -3.1883 };
const yerevan = { latitude: 40.1777, longitude: 44.5126 };

test.beforeEach(async ({ context }) => {
  await installOfflineMapFixture(context);
});

async function setup(
  page: Page,
  {
    permission = 'prompt',
    cached = false,
    age = 0,
    failure = 0,
    blockedStorage = false,
  }: {
    permission?: 'prompt' | 'granted' | 'denied' | 'unknown';
    cached?: boolean;
    age?: number;
    failure?: number;
    blockedStorage?: boolean;
  } = {},
) {
  await page.addInitScript(
    ({
      permission,
      cached,
      age,
      failure,
      blockedStorage,
      storageKey,
      edinburgh,
      yerevan,
    }) => {
      (window as typeof window & { locationCalls: number }).locationCalls = 0;
      Object.defineProperty(navigator, 'permissions', {
        configurable: true,
        value:
          permission === 'unknown'
            ? undefined
            : {
                query: async () => ({ state: permission }),
              },
      });
      Object.defineProperty(navigator, 'geolocation', {
        configurable: true,
        value: {
          getCurrentPosition(
            success: PositionCallback,
            error: PositionErrorCallback,
          ) {
            (window as typeof window & { locationCalls: number })
              .locationCalls++;
            if (failure) {
              error({
                code: failure,
                PERMISSION_DENIED: 1,
                POSITION_UNAVAILABLE: 2,
                TIMEOUT: 3,
                message: 'test',
              });
            } else {
              success({
                coords: { ...edinburgh, accuracy: 5 },
                timestamp: Date.now(),
              } as GeolocationPosition);
            }
          },
        },
      });
      if (cached)
        localStorage.setItem(
          storageKey,
          JSON.stringify({ ...yerevan, timestamp: Date.now() - age }),
        );
      if (blockedStorage)
        Object.defineProperty(window, 'localStorage', {
          get() {
            throw new Error('blocked');
          },
        });
    },
    {
      permission,
      cached,
      age,
      failure,
      blockedStorage,
      storageKey,
      edinburgh,
      yerevan,
    },
  );
}

async function calls(page: Page) {
  return page.evaluate(
    () => (window as typeof window & { locationCalls: number }).locationCalls,
  );
}

for (const permission of ['prompt', 'denied', 'unknown'] as const) {
  test(`does not request GPS on visits with ${permission} permission`, async ({
    page,
  }) => {
    await setup(page, { permission });
    await page.goto('/');
    await expect(page.locator('.reference-marker')).toBeVisible();
    expect(await calls(page)).toBe(0);
    await page.reload();
    await expect(page.locator('.reference-marker')).toBeVisible();
    expect(await calls(page)).toBe(0);
  });
}

test('explicit GPS is cached across visits without assuming permission persists', async ({
  page,
}) => {
  await setup(page);
  await page.goto('/');
  const context = page.getByTestId('location-context-desktop');
  await context.getByRole('button', { name: 'Use my location' }).click();
  await expect(
    page.locator('.start-marker:not(.reference-marker)'),
  ).toBeVisible();
  expect(await calls(page)).toBe(1);
  expect(
    await page.evaluate(
      (key) => JSON.parse(localStorage.getItem(key)!),
      storageKey,
    ),
  ).toMatchObject(edinburgh);
  await page.reload();
  await expect(context).toContainText('Last known location');
  await expect(page.locator('.reference-marker')).toHaveAttribute(
    'aria-label',
    'Last known location',
  );
  expect(await calls(page)).toBe(0);
  await context.getByRole('button', { name: 'Use my location' }).click();
  await expect(
    page.locator('.start-marker:not(.reference-marker)'),
  ).toBeVisible();
  expect(await calls(page)).toBe(1);
});

test('refreshes a cached reference when permission is already granted', async ({
  page,
}) => {
  await setup(page, { permission: 'granted', cached: true });
  await page.goto('/');
  await expect(
    page.locator('.start-marker:not(.reference-marker)'),
  ).toBeVisible();
  expect(await calls(page)).toBe(1);
  expect(
    await page.evaluate(
      (key) => JSON.parse(localStorage.getItem(key)!),
      storageKey,
    ),
  ).toMatchObject(edinburgh);
});

test('keeps the cached reference if an authorized refresh is unavailable', async ({
  page,
}) => {
  await setup(page, { permission: 'granted', cached: true, failure: 2 });
  await page.goto('/');
  await expect(page.getByTestId('location-context-desktop')).toContainText(
    'Last known location',
  );
  await expect(page.locator('.reference-marker')).toBeVisible();
  expect(await calls(page)).toBe(1);
});

for (const permission of ['prompt', 'denied'] as const) {
  test(`discards ${permission === 'denied' ? 'revoked' : 'expired'} cached location without GPS`, async ({
    page,
  }) => {
    await setup(page, {
      permission,
      cached: true,
      age: permission === 'denied' ? 0 : 24 * 60 * 60 * 1000,
    });
    await page.goto('/');
    await expect(page.getByTestId('location-context-desktop')).toContainText(
      'Showing Edinburgh',
    );
    await expect(page.locator('.reference-marker')).toBeVisible();
    expect(await calls(page)).toBe(0);
    expect(
      await page.evaluate((key) => localStorage.getItem(key), storageKey),
    ).toBeNull();
  });
}

test('shared references take priority over cache and granted GPS', async ({
  page,
}) => {
  await setup(page, { permission: 'granted', cached: true });
  await page.goto('/?lat=55.9533&lng=-3.1883');
  await expect(page.locator('.reference-marker')).toHaveAttribute(
    'aria-label',
    'shared location',
  );
  expect(await calls(page)).toBe(0);
});

test('blocked storage still allows explicit GPS without automatic prompts', async ({
  page,
}) => {
  await setup(page, { blockedStorage: true });
  await page.goto('/');
  await expect(page.locator('.reference-marker')).toBeVisible();
  expect(await calls(page)).toBe(0);
  await page
    .getByTestId('location-context-desktop')
    .getByRole('button', { name: 'Use my location' })
    .click();
  await expect(
    page.locator('.start-marker:not(.reference-marker)'),
  ).toBeVisible();
  expect(await calls(page)).toBe(1);
});

test('mobile shows a saved reference and keeps manual refresh available', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await setup(page, { cached: true });
  await page.goto('/');
  const context = page.getByTestId('location-context-mobile');
  await expect(context).toContainText('Last known location');
  await expect(page.locator('.reference-marker')).toBeVisible();
  expect(await calls(page)).toBe(0);
  await context.getByRole('button', { name: 'Use my location' }).click();
  await expect(
    page.locator('.start-marker:not(.reference-marker)'),
  ).toBeVisible();
  expect(await calls(page)).toBe(1);
});

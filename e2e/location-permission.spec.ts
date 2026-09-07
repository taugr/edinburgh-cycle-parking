import { expect, test, type Page } from '@playwright/test';
import { installOfflineMapFixture } from './offline-map-fixtures';

const storageKey = 'neuk-bike:last-location:v1';
const requestKey = 'neuk-bike:location-request:v1';
const areaKey = 'neuk-bike:last-area:v1';
const edinburgh = { latitude: 55.9533, longitude: -3.1883 };
const yerevan = { latitude: 40.1777, longitude: 44.5126 };
const day = 24 * 60 * 60 * 1000;

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
    afterRequestPermission,
    blockedStorage = false,
    recentRequest = false,
    area = false,
    holdPosition = false,
  }: {
    permission?: 'prompt' | 'granted' | 'denied' | 'unknown';
    cached?: boolean;
    age?: number;
    failure?: number;
    afterRequestPermission?: 'prompt' | 'granted' | 'denied';
    blockedStorage?: boolean;
    recentRequest?: boolean;
    area?: boolean;
    holdPosition?: boolean;
  } = {},
) {
  await page.addInitScript(
    (options) => {
      const {
        permission,
        cached,
        age,
        failure,
        afterRequestPermission,
        blockedStorage,
        recentRequest,
        area,
        holdPosition,
        storageKey,
        requestKey,
        areaKey,
        edinburgh,
        yerevan,
      } = options;
      let state = permission;
      (window as typeof window & { locationCalls: number }).locationCalls = 0;
      Object.defineProperty(navigator, 'permissions', {
        configurable: true,
        value:
          permission === 'unknown'
            ? undefined
            : { query: async () => ({ state }) },
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
            const respond = () => {
              if (afterRequestPermission) state = afterRequestPermission;
              if (failure)
                error({
                  code: failure,
                  PERMISSION_DENIED: 1,
                  POSITION_UNAVAILABLE: 2,
                  TIMEOUT: 3,
                  message: 'test',
                });
              else
                success({
                  coords: { ...edinburgh, accuracy: 5 },
                  timestamp: Date.now(),
                } as GeolocationPosition);
            };
            (
              window as typeof window & { completeLocationRequest: () => void }
            ).completeLocationRequest = respond;
            if (!holdPosition) setTimeout(respond, 0);
          },
        },
      });
      if (!sessionStorage.getItem('location-fixture-seeded')) {
        sessionStorage.setItem('location-fixture-seeded', 'true');
        if (cached)
          localStorage.setItem(
            storageKey,
            JSON.stringify({ ...yerevan, timestamp: Date.now() - age }),
          );
        if (recentRequest)
          localStorage.setItem(
            requestKey,
            JSON.stringify({ attemptedAt: Date.now(), denied: false }),
          );
        if (area)
          localStorage.setItem(
            areaKey,
            JSON.stringify({ location: yerevan, label: 'Yerevan' }),
          );
      }
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
      afterRequestPermission,
      blockedStorage,
      recentRequest,
      area,
      holdPosition,
      storageKey,
      requestKey,
      areaKey,
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
async function read(page: Page, key: string) {
  return page.evaluate(
    (key) => JSON.parse(localStorage.getItem(key) ?? 'null'),
    key,
  );
}
async function ready(page: Page) {
  await expect(page.getByTestId('parking-list')).toBeVisible();
  await expect(page.locator('.location-context')).toHaveCount(0);
}
async function retry(page: Page) {
  await page
    .getByRole('button', { name: 'Use current location', exact: true })
    .click();
}

for (const permission of ['prompt', 'unknown'] as const) {
  test(`first visit requests location once with ${permission} permission; a return visit uses a reference`, async ({
    page,
  }) => {
    await setup(page, { permission });
    await page.goto('/');
    await ready(page);
    await expect(
      page.locator('.start-marker:not(.reference-marker)'),
    ).toBeVisible();
    expect(await calls(page)).toBe(1);
    expect(await read(page, storageKey)).toMatchObject(edinburgh);
    await page.reload();
    await ready(page);
    await expect(page.locator('.reference-marker')).toHaveAttribute(
      'aria-label',
      'Last known location',
    );
    expect(await calls(page)).toBe(0);
    await retry(page);
    await expect(
      page.locator('.start-marker:not(.reference-marker)'),
    ).toBeVisible();
    expect(await calls(page)).toBe(1);
  });
}

test('dismissal suppresses automatic prompts for exactly 24 hours', async ({
  page,
}) => {
  await setup(page, { failure: 1 });
  await page.goto('/');
  await expect(page.locator('.reference-marker')).toHaveAttribute(
    'aria-label',
    'Edinburgh Waverley',
  );
  expect(await calls(page)).toBe(1);
  expect((await read(page, requestKey)).denied).toBe(false);
  await page.reload();
  await ready(page);
  expect(await calls(page)).toBe(0);
  await page.evaluate(
    ({ requestKey, day }) =>
      localStorage.setItem(
        requestKey,
        JSON.stringify({ attemptedAt: Date.now() - day, denied: false }),
      ),
    { requestKey, day },
  );
  await page.reload();
  await expect.poll(() => calls(page)).toBe(1);
});

test('declining a first request stops automatic requests, even after 24 hours', async ({
  page,
}) => {
  await setup(page, {
    failure: 1,
    afterRequestPermission: 'denied',
    area: true,
  });
  await page.goto('/');
  await expect
    .poll(() => read(page, requestKey))
    .toMatchObject({ denied: true });
  await expect(page.locator('.reference-marker')).toHaveAttribute(
    'aria-label',
    'Yerevan',
  );
  await page.evaluate(
    ({ requestKey, day }) =>
      localStorage.setItem(
        requestKey,
        JSON.stringify({ attemptedAt: Date.now() - 2 * day, denied: true }),
      ),
    { requestKey, day },
  );
  await page.reload();
  await ready(page);
  expect(await calls(page)).toBe(0);
  await retry(page);
  await expect.poll(() => calls(page)).toBe(1);
  await expect(page.getByRole('status')).toContainText(
    'Location permission needed',
  );
});

test('browser denial clears GPS but preserves the last browsed area', async ({
  page,
}) => {
  await setup(page, { permission: 'denied', cached: true, area: true });
  await page.goto('/');
  await ready(page);
  await expect(page.locator('.reference-marker')).toHaveAttribute(
    'aria-label',
    'Yerevan',
  );
  expect(await calls(page)).toBe(0);
  expect(await read(page, storageKey)).toBeNull();
  expect(await read(page, areaKey)).toEqual({
    location: yerevan,
    label: 'Yerevan',
  });
  await page.reload();
  await ready(page);
  expect(await calls(page)).toBe(0);
});

test('granted permission refreshes GPS on every visit despite the cooldown', async ({
  page,
}) => {
  await setup(page, {
    permission: 'granted',
    cached: true,
    recentRequest: true,
  });
  for (let visit = 0; visit < 2; visit++) {
    await page.goto('/');
    await expect(
      page.locator('.start-marker:not(.reference-marker)'),
    ).toBeVisible();
    expect(await calls(page)).toBe(1);
    expect(await read(page, storageKey)).toMatchObject(edinburgh);
  }
});

test('unavailable GPS retains its cached reference without a live marker', async ({
  page,
}) => {
  await setup(page, { permission: 'granted', cached: true, failure: 2 });
  await page.goto('/');
  await expect(page.locator('.reference-marker')).toHaveAttribute(
    'aria-label',
    'Last known location',
  );
  expect(await calls(page)).toBe(1);
  await expect(
    page.locator('.start-marker:not(.reference-marker)'),
  ).toHaveCount(0);
  await expect(page.locator('.place-search-message')).toHaveCount(0);
});

test('expired GPS and a recent request fall back without another prompt', async ({
  page,
}) => {
  await setup(page, { cached: true, age: day, recentRequest: true });
  await page.goto('/');
  await expect(page.locator('.reference-marker')).toHaveAttribute(
    'aria-label',
    'Edinburgh Waverley',
  );
  expect(await read(page, storageKey)).toBeNull();
  expect(await calls(page)).toBe(0);
});

for (const permission of ['prompt', 'granted'] as const) {
  test(`shared references take priority over saved areas and ${permission} GPS`, async ({
    page,
  }) => {
    await setup(page, { permission, cached: true, area: true });
    await page.goto('/?lat=55.9533&lng=-3.1883');
    await expect(page.locator('.reference-marker')).toHaveAttribute(
      'aria-label',
      'shared location',
    );
    expect(await calls(page)).toBe(0);
    expect(await read(page, requestKey)).toBeNull();
  });
}

test('blocked storage leaves GPS available through the location button without repeated automatic prompts', async ({
  page,
}) => {
  await setup(page, { blockedStorage: true });
  await page.goto('/');
  await ready(page);
  expect(await calls(page)).toBe(0);
  await retry(page);
  await expect(
    page.locator('.start-marker:not(.reference-marker)'),
  ).toBeVisible();
  expect(await calls(page)).toBe(1);
});

test('mobile keeps the header thin and manual GPS available with a restored area', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await setup(page, { area: true, recentRequest: true });
  await page.goto('/');
  await ready(page);
  await expect(page.locator('.reference-marker')).toHaveAttribute(
    'aria-label',
    'Yerevan',
  );
  expect(await calls(page)).toBe(0);
  await retry(page);
  await expect(
    page.locator('.start-marker:not(.reference-marker)'),
  ).toBeVisible();
  expect(await calls(page)).toBe(1);
});

test('a searched area survives reload and is not used as a current-location route origin', async ({
  page,
}) => {
  await setup(page, { permission: 'denied' });
  await page.route('https://photon.komoot.io/api/**', (route) =>
    route.fulfill({
      json: {
        features: [
          {
            geometry: { coordinates: [yerevan.longitude, yerevan.latitude] },
            properties: {
              name: 'Yerevan',
              country: 'Armenia',
              osm_id: 1,
              osm_type: 'N',
            },
          },
        ],
      },
    }),
  );
  await page.goto('/');
  await ready(page);
  await page.getByRole('searchbox').fill('Yerevan');
  await page.getByRole('option', { name: /Yerevan/ }).click();
  await expect
    .poll(() => read(page, areaKey))
    .toMatchObject({ location: yerevan });
  await page.reload();
  await expect(page.locator('.reference-marker')).toHaveAttribute(
    'aria-label',
    'Yerevan',
  );
  await page.getByTestId('map-plan-route').click();
  await page
    .getByRole('combobox', { name: 'Search destination' })
    .fill('Yerevan');
  await page.getByRole('option', { name: /Yerevan/ }).click();
  await expect(
    page.getByRole('combobox', { name: 'Choose a starting point' }),
  ).toBeVisible();
});

test('manual map browsing is remembered, while automatic map focus does not overwrite it', async ({
  page,
}) => {
  await setup(page, { permission: 'denied', area: true });
  await page.goto('/');
  await expect(page.locator('.reference-marker')).toHaveAttribute(
    'aria-label',
    'Yerevan',
  );
  await expect(page.locator('.maplibregl-canvas')).toBeVisible();
  // Wait until the restored reference has reached the visible map before dragging.
  await expect
    .poll(async () =>
      Number(
        await page
          .locator('[data-map-center-latitude]')
          .getAttribute('data-map-center-latitude'),
      ),
    )
    .toBeGreaterThan(39);
  expect(await read(page, areaKey)).toEqual({
    location: yerevan,
    label: 'Yerevan',
  });
  const canvas = (await page.locator('.maplibregl-canvas').boundingBox())!;
  await page.mouse.move(canvas.x + 240, canvas.y + 330);
  await page.mouse.down();
  await page.mouse.move(canvas.x + 410, canvas.y + 390, { steps: 16 });
  await page.mouse.up();
  await expect
    .poll(async () => (await read(page, areaKey)).label)
    .toBeUndefined();
  const saved = await read(page, areaKey);
  expect(saved.location).not.toEqual(yerevan);
  await page.reload();
  await expect(page.locator('.reference-marker')).toHaveAttribute(
    'aria-label',
    'Last viewed area',
  );
  expect(await read(page, areaKey)).toEqual(saved);
  expect(await calls(page)).toBe(0);
});

test('starting a route while GPS is pending ignores a late position', async ({
  page,
}) => {
  await setup(page, { holdPosition: true, area: true });
  await page.goto('/');
  await ready(page);
  await expect.poll(() => calls(page)).toBe(1);
  await page.getByTestId('map-plan-route').click();
  await expect(
    page.getByRole('combobox', { name: 'Search destination' }),
  ).toBeVisible();
  await page.evaluate(() =>
    (
      window as typeof window & { completeLocationRequest: () => void }
    ).completeLocationRequest(),
  );
  await expect(
    page.getByRole('combobox', { name: 'Search destination' }),
  ).toBeVisible();
  expect(await read(page, storageKey)).toBeNull();
  expect(await read(page, areaKey)).toEqual({
    location: yerevan,
    label: 'Yerevan',
  });
});

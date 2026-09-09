import { expect, test, type Page } from '@playwright/test';
import type { WebMcpTool } from '../src/lib/webmcp';
import { installOfflineMapFixture } from './offline-map-fixtures';

declare global {
  interface Window {
    __finderTools: Map<string, WebMcpTool>;
    __finderRegistrations: number;
    __finderGpsRequests: number;
  }
}

test.use({ serviceWorkers: 'block' });

test.beforeEach(async ({ context, page }) => {
  await installOfflineMapFixture(context);
  await page.route('https://www.google.com/maps/embed/**', (route) =>
    route.fulfill({
      contentType: 'text/html',
      body: '<body style="margin:0;display:grid;place-items:center;height:100vh;background:#e8f0ed;color:#46615a;font:14px sans-serif">Street View test fixture</body>',
    }),
  );
  await page.addInitScript(() => {
    window.__finderTools = new Map();
    window.__finderRegistrations = 0;
    window.__finderGpsRequests = 0;
    Object.defineProperty(document, 'modelContext', {
      configurable: true,
      value: {
        registerTool(tool: WebMcpTool, { signal }: { signal: AbortSignal }) {
          if (window.__finderTools.has(tool.name))
            throw new Error('Duplicate registration');
          window.__finderRegistrations++;
          window.__finderTools.set(tool.name, tool);
          signal.addEventListener('abort', () =>
            window.__finderTools.delete(tool.name),
          );
        },
      },
    });
    Object.defineProperty(navigator.geolocation, 'getCurrentPosition', {
      value: () => {
        window.__finderGpsRequests++;
      },
    });
    Object.defineProperty(navigator.geolocation, 'watchPosition', {
      value: () => {
        window.__finderGpsRequests++;
        return 1;
      },
    });
  });
});

async function execute(page: Page, name: string, input: object = {}) {
  return page.evaluate(
    async ({ name, input }) => {
      return await window.__finderTools.get(name)!.execute(input);
    },
    { name, input },
  );
}

async function ready(page: Page) {
  await page.goto('/?lat=55.9533&lng=-3.1883');
  await expect
    .poll(() => page.evaluate(() => window.__finderTools.size))
    .toBe(5);
  await expect
    .poll(
      async () =>
        ((await execute(page, 'get_current_results')) as { status: string })
          .status,
    )
    .toBe('ready');
}

const searchResponse = {
  features: [
    {
      geometry: { type: 'Point', coordinates: [-3.1908, 55.9474] },
      properties: {
        osm_id: 123,
        osm_type: 'N',
        name: 'National Museum of Scotland',
        city: 'Edinburgh',
        country: 'United Kingdom',
      },
    },
  ],
};

test('search, selection, details and planner update the visible app through stable registrations', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.route('https://photon.komoot.io/api/**', (route) =>
    route.fulfill({ json: searchResponse }),
  );
  await ready(page);
  const registrationCount = await page.evaluate(
    () => window.__finderRegistrations,
  );
  expect(
    await execute(page, 'search_places', { query: 'National Museum' }),
  ).toMatchObject({ status: 'complete', results: [{ id: 'N:123' }] });
  await expect(page.locator('input[name="place-search"]:visible')).toHaveValue(
    'National Museum',
  );
  await expect(
    page.getByRole('option', { name: /National Museum/ }),
  ).toBeVisible();
  expect(await execute(page, 'select_place', { id: 'N:123' })).toMatchObject({
    status: 'selected',
  });
  await expect(page.locator('input[name="place-search"]:visible')).toHaveValue(
    'National Museum of Scotland',
  );
  await expect
    .poll(
      async () =>
        ((await execute(page, 'get_current_results')) as { status: string })
          .status,
    )
    .toBe('ready');
  const current = (await execute(page, 'get_current_results', {
    limit: 2,
  })) as { results: { id: string }[] };
  expect(current.results).toHaveLength(2);
  const id = current.results[0]!.id;
  expect(await execute(page, 'show_parking_details', { id })).toMatchObject({
    status: 'selected',
    id,
  });
  expect(await execute(page, 'get_current_results')).toMatchObject({
    selectedId: id,
  });
  await expect(page.getByTestId(`parking-row-${id}`)).toHaveClass(/selected/);
  await page.screenshot({ path: 'output/playwright/webmcp-finder.png' });
  expect(await execute(page, 'start_route_planning')).toMatchObject({
    status: 'opened',
    routeCalculated: false,
  });
  await expect(page.getByTestId('route-destination-search')).toBeVisible();
  expect(
    await execute(page, 'search_places', { query: 'Edinburgh' }),
  ).toMatchObject({ status: 'error' });
  expect(await execute(page, 'start_route_planning')).toMatchObject({
    status: 'opened',
    existingDraftPreserved: true,
  });
  expect(await page.evaluate(() => window.__finderRegistrations)).toBe(
    registrationCount,
  );
  expect(await page.evaluate(() => window.__finderGpsRequests)).toBe(0);
  expect(errors).toEqual([]);
});

test('rejects invalid and stale IDs and reports failed and empty searches accurately', async ({
  page,
}) => {
  await ready(page);
  const before = await execute(page, 'get_current_results');
  expect(await execute(page, 'select_place', { id: 'unknown' })).toMatchObject({
    status: 'error',
  });
  expect(
    await execute(page, 'show_parking_details', { id: 'unknown' }),
  ).toMatchObject({ status: 'error' });
  expect(await execute(page, 'search_places', { query: 'xx' })).toMatchObject({
    status: 'error',
  });
  expect(await execute(page, 'get_current_results')).toEqual(before);
  await page.route('https://photon.komoot.io/api/**', (route) =>
    route.fulfill({ status: 503, body: '' }),
  );
  expect(
    await execute(page, 'search_places', { query: 'Unavailable' }),
  ).toMatchObject({ status: 'error' });
  await page.unroute('https://photon.komoot.io/api/**');
  await page.route('https://photon.komoot.io/api/**', (route) =>
    route.fulfill({ json: { features: [] } }),
  );
  expect(await execute(page, 'search_places', { query: 'No matches' })).toEqual(
    { status: 'complete', results: [] },
  );
});

test('a manual query change cancels an agent search without returning stale matches', async ({
  page,
}) => {
  await ready(page);
  let release!: () => void;
  let requested!: () => void;
  const requestSeen = new Promise<void>((resolve) => {
    requested = resolve;
  });
  const responseGate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route('https://photon.komoot.io/api/**', async (route) => {
    requested();
    await responseGate;
    await route.fulfill({ json: searchResponse });
  });
  const pending = execute(page, 'search_places', { query: 'National Museum' });
  await requestSeen;
  expect(await execute(page, 'start_route_planning')).toMatchObject({
    status: 'busy',
  });
  await page.locator('input[name="place-search"]:visible').fill('X');
  release();
  expect(await pending).toEqual({ status: 'cancelled' });
  expect(await execute(page, 'get_current_results')).toMatchObject({
    search: { query: 'X', results: [] },
  });
});

test('opens parking details in the mobile sheet', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await ready(page);
  const current = (await execute(page, 'get_current_results', {
    limit: 1,
  })) as { results: { id: string; name: string }[] };
  const point = current.results[0]!;
  expect(
    await execute(page, 'show_parking_details', { id: point.id }),
  ).toMatchObject({ status: 'selected' });
  const details = page.getByRole('region', { name: 'Parking details' });
  await expect(details).toBeVisible();
  await expect(details).toContainText(point.name);
  await page.screenshot({ path: 'output/playwright/webmcp-mobile.png' });
});

for (const support of ['absent', 'throws', 'rejects']) {
  test(`the normal finder works when WebMCP ${support}`, async ({ page }) => {
    await page.addInitScript((support) => {
      Object.defineProperty(document, 'modelContext', {
        value:
          support === 'absent'
            ? undefined
            : {
                registerTool() {
                  if (support === 'throws') throw new Error('Unavailable');
                  return Promise.reject(new Error('Unavailable'));
                },
              },
      });
    }, support);
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto('/?lat=55.9533&lng=-3.1883');
    await expect(page.locator('.parking-list-item').first()).toBeVisible();
    expect(errors).toEqual([]);
  });
}

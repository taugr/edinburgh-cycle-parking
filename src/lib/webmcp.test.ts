import { describe, expect, it, vi } from 'vitest';
import {
  createFinderWebMcpTools,
  registerFinderWebMcpTools,
  type FinderWebMcpActions,
  type WebMcpTool,
} from './webmcp';

function setup() {
  const actions: FinderWebMcpActions = {
    getCurrentResults: vi.fn((limit) => ({ limit })),
    searchPlaces: vi.fn(async () => ({ status: 'complete' })),
    selectPlace: vi.fn(),
    showParkingDetails: vi.fn(),
    startRoutePlanning: vi.fn(),
  };
  const tools = createFinderWebMcpTools(actions);
  const execute = (name: string, input: unknown) =>
    tools.find((tool) => tool.name === name)!.execute(input);
  return { actions, tools, execute };
}

describe('finder WebMCP tools', () => {
  it('validates arguments before invoking any app action', async () => {
    const { actions, execute } = setup();
    for (const input of [
      null,
      [],
      {},
      { query: '  ' },
      { query: 'ab' },
      { query: 'a'.repeat(201) },
      { query: 'Edinburgh', extra: true },
    ]) {
      expect(await execute('search_places', input)).toMatchObject({
        status: 'error',
      });
    }
    for (const limit of [0, 21, 1.5, '5', NaN, Infinity]) {
      expect(await execute('get_current_results', { limit })).toMatchObject({
        status: 'error',
      });
    }
    expect(await execute('select_place', { id: '' })).toMatchObject({
      status: 'error',
    });
    expect(await execute('start_route_planning', { save: true })).toMatchObject(
      { status: 'error' },
    );
    for (const action of Object.values(actions))
      expect(action).not.toHaveBeenCalled();
  });

  it('returns bounded results and passes trimmed searches to the existing action', async () => {
    const { actions, execute } = setup();
    expect(await execute('get_current_results', {})).toEqual({ limit: 10 });
    expect(await execute('get_current_results', { limit: 20 })).toEqual({
      limit: 20,
    });
    expect(await execute('search_places', { query: ' Edinburgh ' })).toEqual({
      status: 'complete',
    });
    expect(actions.searchPlaces).toHaveBeenCalledWith('Edinburgh');
  });

  it('blocks overlapping mutations while still allowing reads, and releases after failure', async () => {
    const { actions, execute } = setup();
    let rejectSearch!: (error: Error) => void;
    vi.mocked(actions.searchPlaces).mockImplementationOnce(
      () =>
        new Promise((_resolve, reject) => {
          rejectSearch = reject;
        }),
    );
    const search = execute('search_places', { query: 'Edinburgh' });
    expect(await execute('start_route_planning', {})).toMatchObject({
      status: 'busy',
    });
    expect(await execute('get_current_results', {})).toEqual({ limit: 10 });
    rejectSearch(new Error('Search unavailable'));
    expect(await search).toEqual({
      status: 'error',
      message: 'Search unavailable',
    });
    await execute('start_route_planning', {});
    expect(actions.startRoutePlanning).toHaveBeenCalledOnce();
  });

  it('marks only the reader as read-only and all source output as untrusted', () => {
    const { tools } = setup();
    expect(
      tools
        .filter((tool) => tool.annotations.readOnlyHint)
        .map((tool) => tool.name),
    ).toEqual(['get_current_results']);
    expect(tools.every((tool) => tool.annotations.untrustedContentHint)).toBe(
      true,
    );
  });
});

describe('WebMCP registration', () => {
  it('does nothing in unsupported browsers', () => {
    const report = vi.fn();
    expect(() =>
      registerFinderWebMcpTools(undefined, setup().tools, report)(),
    ).not.toThrow();
    expect(report).not.toHaveBeenCalled();
  });

  it('removes every registration when its lifecycle is aborted', () => {
    const registry = new Map<string, WebMcpTool>();
    const cleanup = registerFinderWebMcpTools(
      {
        registerTool(tool, { signal }) {
          registry.set(tool.name, tool);
          signal.addEventListener('abort', () => registry.delete(tool.name));
        },
      },
      setup().tools,
    );
    expect(registry.size).toBe(5);
    cleanup();
    expect(registry.size).toBe(0);
  });

  it('handles synchronous and asynchronous failures without losing other registrations', async () => {
    const report = vi.fn();
    const registerTool = vi
      .fn()
      .mockImplementationOnce(() => {
        throw new Error('Unsupported tool');
      })
      .mockRejectedValueOnce(new Error('Registration rejected'))
      .mockReturnValue(undefined);
    registerFinderWebMcpTools({ registerTool }, setup().tools, report);
    await Promise.resolve();
    expect(registerTool).toHaveBeenCalledTimes(5);
    expect(report).toHaveBeenCalledTimes(2);
  });
});

'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import {
  createFinderWebMcpTools,
  registerFinderWebMcpTools,
  type FinderWebMcpActions,
  type WebMcpContext,
} from '@/lib/webmcp';

export function useFinderWebMcp(actions: FinderWebMcpActions) {
  const latest = useRef(actions);
  const [, setCommitVersion] = useState(0);
  useLayoutEffect(() => {
    latest.current = actions;
  });

  useEffect(() => {
    let active = true;
    async function mutate(action: () => unknown | Promise<unknown>) {
      if (!active) throw new Error('This page is no longer active.');
      const result = await action();
      if (!active) throw new Error('This page is no longer active.');
      // Commit pending React updates before reporting completion to the agent.
      flushSync(() => setCommitVersion((version) => version + 1));
      return result;
    }

    const context = (document as Document & { modelContext?: WebMcpContext })
      .modelContext;
    const unregister = registerFinderWebMcpTools(
      context,
      createFinderWebMcpTools({
        getCurrentResults: (limit) => latest.current.getCurrentResults(limit),
        searchPlaces: (query) =>
          mutate(() => latest.current.searchPlaces(query)),
        selectPlace: (id) => mutate(() => latest.current.selectPlace(id)),
        showParkingDetails: (id) =>
          mutate(() => latest.current.showParkingDetails(id)),
        startRoutePlanning: () =>
          mutate(() => latest.current.startRoutePlanning()),
      }),
    );
    return () => {
      active = false;
      unregister();
    };
  }, []);
}

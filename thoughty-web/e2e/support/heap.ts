import type { Page } from '@playwright/test';

interface HeapSnapshot {
  snapshot: {
    meta: {
      node_fields: string[];
      edge_fields: string[];
      node_types: [string[], ...unknown[]];
      edge_types: [string[], ...unknown[]];
    };
  };
  nodes: number[];
  edges: number[];
  strings: string[];
}

/**
 * V8's own bookkeeping (compiled code and its feedback, hidden classes) can hold on to a freed object until
 * the engine drops it; no script can reach anything through it, so the walk does not go through it.
 */
const ENGINE_ONLY = new Set(['code', 'object shape']);

async function takeHeapSnapshot(page: Page): Promise<HeapSnapshot> {
  const cdp = await page.context().newCDPSession(page);
  const chunks: string[] = [];
  cdp.on('HeapProfiler.addHeapSnapshotChunk', ({ chunk }) => {
    chunks.push(chunk);
  });
  await cdp.send('HeapProfiler.enable');
  await cdp.send('HeapProfiler.collectGarbage');
  await cdp.send('HeapProfiler.takeHeapSnapshot', { reportProgress: false });
  await cdp.detach();
  return JSON.parse(chunks.join('')) as HeapSnapshot;
}

/**
 * Every string the page's scripts can still reach (Chromium only), after a full garbage collection: what
 * the app keeps in memory, its query cache included, seen from outside. Walks the heap snapshot from its
 * roots along strong references.
 */
export async function reachableHeapStrings(page: Page): Promise<string[]> {
  const { snapshot: { meta }, nodes, edges, strings } = await takeHeapSnapshot(page);
  const nodeSize = meta.node_fields.length;
  const edgeSize = meta.edge_fields.length;
  const [nodeTypes] = meta.node_types;
  const [edgeTypes] = meta.edge_types;
  const typeAt = meta.node_fields.indexOf('type');
  const nameAt = meta.node_fields.indexOf('name');
  const edgeCountAt = meta.node_fields.indexOf('edge_count');
  const edgeTypeAt = meta.edge_fields.indexOf('type');
  const edgeToAt = meta.edge_fields.indexOf('to_node');

  const nodeCount = nodes.length / nodeSize;
  const firstEdge = new Uint32Array(nodeCount + 1);
  for (let node = 0, edge = 0; node < nodeCount; node += 1) {
    firstEdge[node] = edge;
    edge += nodes[node * nodeSize + edgeCountAt] * edgeSize;
    firstEdge[node + 1] = edge;
  }

  const reached = new Uint8Array(nodeCount);
  const queue = [0];
  reached[0] = 1;
  const found: string[] = [];
  for (let head = 0; head < queue.length; head += 1) {
    const node = queue[head];
    const type = nodeTypes[nodes[node * nodeSize + typeAt]];
    if (type.includes('string')) found.push(strings[nodes[node * nodeSize + nameAt]]);
    for (let edge = firstEdge[node]; edge < firstEdge[node + 1]; edge += edgeSize) {
      if (edgeTypes[edges[edge + edgeTypeAt]] === 'weak') continue;
      const target = edges[edge + edgeToAt] / nodeSize;
      if (reached[target] || ENGINE_ONLY.has(nodeTypes[nodes[target * nodeSize + typeAt]])) continue;
      reached[target] = 1;
      queue.push(target);
    }
  }
  return found;
}

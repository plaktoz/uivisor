import type { FlowFile } from '@uivisor/core';

export interface FilterResult {
  included: string[];
  excluded: string[];
}

export function filterFlows(flows: FlowFile[], tags: string[]): FilterResult {
  const included: string[] = [];
  const excluded: string[] = [];

  for (const flow of flows) {
    if (tags.length > 0 && !tags.some((t) => flow.tags.includes(t))) {
      continue;
    }
    included.push(flow.filePath);
  }

  return { included, excluded };
}

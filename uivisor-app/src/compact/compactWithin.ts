type WithinKey = [string, string, unknown];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function getWithinKey(withinObj: Record<string, unknown>): WithinKey | null {
  const selectorKeys = Object.keys(withinObj).filter(k => k !== 'do' && k !== 'nth');
  if (selectorKeys.length !== 1) return null;
  const selectorAttr = selectorKeys[0]!;
  const selectorValue = withinObj[selectorAttr];
  const nth = 'nth' in withinObj ? withinObj['nth'] : null;
  return [selectorAttr, String(selectorValue), nth];
}

function withinKeysEqual(a: WithinKey, b: WithinKey): boolean {
  return a[0] === b[0] && a[1] === b[1] && a[2] === b[2];
}

function deepClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export function compactWithinBlocks(doc: unknown): unknown {
  if (!isRecord(doc)) return doc;

  if (!('commands' in doc) || !Array.isArray(doc['commands'])) {
    return { ...doc };
  }

  const commands = doc['commands'] as unknown[];
  const merged: unknown[] = [];

  for (const cmd of commands) {
    if (!isRecord(cmd) || !('within' in cmd)) {
      merged.push(deepClone(cmd));
      continue;
    }

    const withinObj = cmd['within'];
    if (!isRecord(withinObj)) {
      merged.push(deepClone(cmd));
      continue;
    }

    const currentKey = getWithinKey(withinObj);

    if (currentKey !== null && merged.length > 0) {
      const last = merged[merged.length - 1];
      if (isRecord(last) && 'within' in last) {
        const lastWithin = last['within'];
        if (isRecord(lastWithin)) {
          const lastKey = getWithinKey(lastWithin);
          if (lastKey !== null && withinKeysEqual(currentKey, lastKey)) {
            const lastDo = lastWithin['do'];
            const currentDo = withinObj['do'];
            if (Array.isArray(lastDo) && Array.isArray(currentDo)) {
              lastWithin['do'] = [...lastDo, ...(deepClone(currentDo) as unknown[])];
              continue;
            }
          }
        }
      }
    }

    merged.push(deepClone(cmd));
  }

  return { ...doc, commands: merged };
}

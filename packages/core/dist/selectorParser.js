export function parseSelector(raw) {
    if (typeof raw === 'string') {
        return raw;
    }
    if (typeof raw === 'object' && raw !== null) {
        const obj = raw;
        if ('text' in obj)
            return { text: obj['text'] };
        if ('role' in obj && 'name' in obj)
            return { role: obj['role'], name: obj['name'] };
        if ('label' in obj)
            return { label: obj['label'] };
        if ('placeholder' in obj)
            return { placeholder: obj['placeholder'] };
        if ('testId' in obj)
            return { testId: obj['testId'] };
        if ('css' in obj)
            return { css: obj['css'] };
        const key = Object.keys(obj)[0] ?? 'unknown';
        throw new Error(`Unrecognized selector type: ${key}`);
    }
    throw new Error(`Unrecognized selector type: ${String(raw)}`);
}
//# sourceMappingURL=selectorParser.js.map
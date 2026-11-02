import type { ParamDef } from './schemas';
import type { VideoComponentDefinition } from './contract';
import type { ValidationResult } from './validation';

export type PropsValidator<T = Record<string, unknown>> = (raw: unknown) => ValidationResult<T>;

export const isPropsObject = (raw: unknown): raw is Record<string, unknown> =>
  typeof raw === 'object' && raw !== null && !Array.isArray(raw);

/** Missing fields default recursively; malformed supplied values never become defaults. */
export function createPropsValidator(
  defaults: Record<string, unknown>,
  params: readonly ParamDef[] = [],
): PropsValidator {
  return (raw) => {
    if (!isPropsObject(raw)) {
      return { ok: false, issues: [{ path: 'props', message: 'Expected an object' }] };
    }
    const issues: { path: string; message: string }[] = [];
    const visit = (value: unknown, template: unknown, path: string): unknown => {
      if (value === undefined) return structuredClone(template);
      const key = path.split('.').at(-1);
      if (typeof value === 'number' && !Number.isFinite(value)) {
        issues.push({ path, message: 'Expected a finite number' });
      }
      // Text adapters historically accept numeric select values serialized as strings.
      const numericWeight = key === 'fontWeight' && typeof value === 'string' && /^[1-9]00$/.test(value);
      if (
        (typeof template === 'number' && typeof value !== 'number' && !numericWeight) ||
        (typeof template === 'string' && typeof value !== 'string') ||
        (typeof template === 'boolean' && typeof value !== 'boolean')
      ) {
        issues.push({ path, message: `Expected ${typeof template}` });
      }
      if (
        typeof value === 'number' &&
        ['width', 'height', 'size', 'fontSize', 'tileSize', 'lineWidth'].includes(key ?? '') &&
        value <= 0
      ) issues.push({ path, message: 'Must be greater than zero' });
      if (isPropsObject(template)) {
        if (!isPropsObject(value)) {
          issues.push({ path, message: 'Expected an object' });
          return value;
        }
        const result: Record<string, unknown> = { ...value };
        for (const [key, fallback] of Object.entries(template)) {
          result[key] = visit(value[key], fallback, path ? `${path}.${key}` : key);
        }
        for (const [key, supplied] of Object.entries(value)) {
          if (!(key in template)) result[key] = visit(supplied, undefined, `${path}.${key}`);
        }
        return result;
      }
      if (Array.isArray(template) && !Array.isArray(value)) {
        issues.push({ path, message: 'Expected an array' });
      }
      if (Array.isArray(value)) return value.map((item, index) => visit(item, undefined, `${path}.${index}`));
      if (isPropsObject(value)) {
        return Object.fromEntries(Object.entries(value).map(([key, supplied]) => [key, visit(supplied, undefined, `${path}.${key}`)]));
      }
      return numericWeight ? Number(value) : value;
    };
    for (const param of params) {
      const supplied = raw[param.key];
      if (supplied === undefined) continue;
      const expected = param.kind === 'number' ? 'number' : param.kind === 'boolean' ? 'boolean'
        : param.kind === 'select' && typeof defaults[param.key] === 'number' ? 'number' : 'string';
      const numericWeight = param.key === 'fontWeight' && typeof supplied === 'string' && /^[1-9]00$/.test(supplied);
      if (typeof supplied !== expected && !numericWeight) issues.push({ path: param.key, message: `Expected ${expected}` });
      if (param.kind === 'select' && param.options && !param.options.includes(String(supplied))) {
        issues.push({ path: param.key, message: 'Unsupported option' });
      }
    }
    const value: Record<string, unknown> = { ...raw };
    for (const [key, fallback] of Object.entries(defaults)) value[key] = visit(raw[key], fallback, key);
    for (const [key, supplied] of Object.entries(raw)) {
      if (!(key in defaults)) value[key] = visit(supplied, undefined, key);
    }
    return issues.length ? { ok: false, issues } : { ok: true, value };
  };
}

export function normalizeComponentProps(
  definition: VideoComponentDefinition,
  raw: unknown,
): ValidationResult<Record<string, unknown>> {
  return (definition.validateProps ?? createPropsValidator(definition.defaults, definition.params))(raw);
}

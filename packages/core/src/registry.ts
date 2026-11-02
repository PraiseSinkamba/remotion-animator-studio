import type { ElementEditModel, ComponentCategory, ComponentProps, VideoComponentDefinition } from './contract';
import { createPropsValidator } from './component-props';
import type { ElementType, Project } from './schemas';

/**
 * The registry of every exportable video component.
 *
 * Component modules register themselves on import; `src/registry/index.ts` imports
 * them all so the editor, the inspector and the Remotion composition see the same
 * catalog. IDs are stable and persisted in project files — never renumber or reuse.
 */
const registry = new Map<ElementType, VideoComponentDefinition>();

export const registerComponent = (definition: VideoComponentDefinition): void => {
  if (registry.has(definition.type)) throw new Error('Duplicate component ID: ' + definition.type);
  validateDefinition(definition);
  definition.validateProps ??= createPropsValidator(definition.defaults,definition.params);
  registry.set(definition.type, definition);
};

export const getComponent = (type: ElementType): VideoComponentDefinition | undefined => registry.get(type);

export const listComponents = (): VideoComponentDefinition[] => [...registry.values()];

export const listComponentsByCategory = (category: ComponentCategory): VideoComponentDefinition[] =>
  listComponents().filter((definition) => definition.category === category);

/**
 * Props for a new instance: the component's defaults, with x/y centred on the
 * canvas for components that are positioned.
 */
export const buildComponentProps = (definition: VideoComponentDefinition, project: Project): ComponentProps => {
  const props = structuredClone(definition.defaults);
  if (!('x' in props)) return props;
  const dx=project.width/2-Number(props.x),dy=project.height/2-Number(props.y);
  props.x=project.width/2;props.y=project.height/2;
  for(const key of definition.edit?.translate?.x ?? []) if(key!=='x' && typeof props[key]==='number') props[key]+=dx;
  for(const key of definition.edit?.translate?.y ?? []) if(key!=='y' && typeof props[key]==='number') props[key]+=dy;
  if(definition.edit?.coordinates==='absolute' && props.points && typeof props.points==='object') {
    props.points=Object.fromEntries(Object.entries(props.points as Record<string,unknown>).map(([id,value])=>{
      const point=value as Record<string,unknown>|null;
      return [id,point && typeof point==='object' && typeof point.x==='number' && typeof point.y==='number'
        ? {...point,x:point.x+dx,y:point.y+dy}:value];
    }));
  }
  return props;
};

const validateDefinition = (definition: VideoComponentDefinition): void => {
  const ids = new Set<string>();
  for (const h of definition.edit?.handles ?? []) {
    const corner = ['nw','ne','se','sw'].includes(h.id);
    if (ids.has(h.id) || !h.id || ((h.effect === 'scale' || h.effect === 'font') && !corner) || (h.effect === 'wrap' && !['e','w'].includes(h.id)) || (['scale','font','wrap','width'].includes(h.effect) && !h.props?.length)) throw new Error('Invalid handle ' + definition.type + '.' + h.id);
    ids.add(h.id);
  }
};
/** Explicit replacement is reserved for callers intentionally restoring test registrations. */
export const replaceComponent = (definition: VideoComponentDefinition): void => {
 validateDefinition(definition); registry.set(definition.type, definition);
};
export const resolveEditModel = (definition: VideoComponentDefinition): ElementEditModel | undefined =>
 (definition.renderMode !== undefined && definition.renderMode !== 'content') ? undefined : definition.edit ?? {pick:'box',handles:[]};

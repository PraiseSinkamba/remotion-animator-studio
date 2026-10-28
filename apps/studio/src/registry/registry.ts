import type { ComponentCategory, ComponentProps, VideoComponentDefinition } from './types';
import type { ElementType, Project } from '../types';

/**
 * The registry of every exportable video component.
 *
 * Component modules register themselves on import; `src/registry/index.ts` imports
 * them all so the editor, the inspector and the Remotion composition see the same
 * catalog. IDs are stable and persisted in project files — never renumber or reuse.
 */
const registry = new Map<ElementType, VideoComponentDefinition>();

export const registerComponent = (definition: VideoComponentDefinition): void => {
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
export const buildComponentProps = (definition: VideoComponentDefinition, project: Project): ComponentProps => ({
  ...definition.defaults,
  ...('x' in definition.defaults ? { x: project.width / 2, y: project.height / 2 } : {}),
});

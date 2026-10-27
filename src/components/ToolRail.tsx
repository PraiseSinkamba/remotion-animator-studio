import React from 'react';
import { MousePointer2, PenTool, Spline } from 'lucide-react';
import { findClip, useStore } from '../store';
import { Button } from './ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from './ui/tooltip';

/**
 * The 48px tool rail on the left of the shell.
 * Only tools the editor actually has are shown: Select, plus the canvas
 * drawing tools that the current selection makes meaningful.
 */
export const ToolRail: React.FC = () => {
  const project = useStore((s) => s.project);
  const selectedClipIds = useStore((s) => s.selectedClipIds);
  const drawingPath = useStore((s) => s.drawingPath);

  const clip = findClip(project, selectedClipIds[0]);
  const motionPath = clip?.effects.find((fx) => fx.type === 'motionPath');
  const isTrail = clip?.element === 'nodeTrail';

  return (
    <div className="flex flex-col items-center gap-2 w-12 shrink-0 border-r bg-card">
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Select"
            className="bg-primary/15 text-primary ring-1 ring-primary/25 hover:bg-primary/20"
          >
            <MousePointer2 />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="right">Select</TooltipContent>
      </Tooltip>

      {motionPath ? (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Draw Path"
              className={drawingPath?.effectId === motionPath.id ? 'bg-secondary text-secondary-foreground' : undefined}
              onClick={() => useStore.getState().startDrawingPath(clip!.id, motionPath.id)}
            >
              <Spline />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="right">Draw Path</TooltipContent>
        </Tooltip>
      ) : null}

      {isTrail ? (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Draw Trail"
              className={drawingPath && !drawingPath.effectId ? 'bg-secondary text-secondary-foreground' : undefined}
              onClick={() => useStore.getState().startDrawingTrail(clip!.id)}
            >
              <PenTool />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="right">Draw Trail</TooltipContent>
        </Tooltip>
      ) : null}
    </div>
  );
};

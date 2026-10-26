import React from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

const CODE = 'rounded border border-border bg-secondary px-1 py-0.5 font-mono text-xs';

const H4 = 'mt-2.5 mb-1.5 text-[11px] uppercase tracking-[1px] text-muted-foreground';
const UL = 'list-disc pl-[18px] leading-[1.7]';

export const HelpModal: React.FC<{ onClose: () => void }> = ({ onClose }) => (
  <Dialog
    open
    onOpenChange={(open) => {
      if (!open) onClose();
    }}
  >
    <DialogContent className="sm:max-w-2xl">
      <DialogHeader>
        <DialogTitle>How to use Remotion Animator</DialogTitle>
        <DialogDescription>Build animations in the library, arrange them on the timeline, then export an MP4.</DialogDescription>
      </DialogHeader>

      <div className="grid grid-cols-1 gap-5 text-[12.5px] sm:grid-cols-2">
        <div>
          <h4 className={H4}>Building</h4>
          <ul className={UL}>
            <li>
              <strong>Presets</strong> — double-click (or drag onto the timeline) for ready-made animations: lower
              thirds, glitch titles, tickers…
            </li>
            <li>
              <strong>Elements</strong> — drag Text, Shape, Image, Video, Audio, GIF, Counter, Emoji or Background onto
              a track.
            </li>
            <li>
              <strong>Effects</strong> — drag onto a clip, or double-click to apply to the selected clip. Stack as many
              as you like.
            </li>
            <li>
              <strong>Canvas</strong> — with a clip selected, drag on the preview to reposition it.
            </li>
            <li>
              <strong>Inspector</strong> — every parameter of the selected clip and its effects.
            </li>
          </ul>
          <h4 className={H4}>Timeline</h4>
          <ul className={UL}>
            <li>Drag a clip to move it; drag its edges to trim.</li>
            <li>Click/drag the ruler to scrub.</li>
            <li>Shift-click a lane to move the selected clip to that track.</li>
            <li>“+ Track” adds a layer (top track renders on top).</li>
          </ul>
        </div>
        <div>
          <h4 className={H4}>Shortcuts</h4>
          <ul className={UL}>
            <li>
              <code className={CODE}>Space</code> — play / pause
            </li>
            <li>
              <code className={CODE}>Delete</code> — remove selected clip
            </li>
            <li>
              <code className={CODE}>⌘Z</code> / <code className={CODE}>⇧⌘Z</code> — undo / redo
            </li>
          </ul>
          <h4 className={H4}>Saving</h4>
          <ul className={UL}>
            <li>Your work autosaves to the browser and is restored on reload.</li>
            <li>
              <strong>Save / Open</strong> — export/import projects as JSON files.
            </li>
          </ul>
          <h4 className={H4}>Exporting</h4>
          <ul className={UL}>
            <li>
              <strong>Export MP4</strong> renders on the local render server with a progress bar.
            </li>
            <li>Any size up to 4K60: pick a Size preset (or custom W×H) and FPS in the top bar.</li>
            <li>
              CLI alternative: <code className={CODE}>npm run render -- project.json</code>.
            </li>
          </ul>
          <p className="mt-2.5 text-muted-foreground">
            Full docs: see <code className={CODE}>DOCS.md</code> in the project folder.
          </p>
        </div>
      </div>

      <DialogFooter>
        <Button variant="outline" size="sm" onClick={onClose}>
          Close
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
);

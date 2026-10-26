# Manual test flows

What to click, what you should see, and what counts as a bug. Everything here was run against
Chromium 155 on Windows before it was written down.

## Setup

```bash
npm install
npm run dev          # Vite on http://localhost:5173, render API on :3333
```

Open <http://localhost:5173>. The editor opens with a sample project ("My animation") in the
middle, a **library** on the left, an **inspector** on the right, a **timeline** at the bottom
and a **top bar** across the top. The project name is the text field at the far left of the top
bar.

To start from nothing: DevTools → Application → Storage → **Clear site data**, then reload.

---

## Flow 1 — The storage chip

The chip sits in the top bar, just left of the buttons.

1. Load the app.
2. Read the chip.

| You see | Meaning |
|---|---|
| `Saved locally` | the project is in the local database and survives a reload |
| `Storage degraded — …` | the database could not be opened; the work is in ordinary browser storage instead |
| `Read-only — another tab owns this workspace` | another tab of this app owns the workspace |
| `Not saved — use Save As to keep your work` | the last write failed, or the browser has no usable storage |

**A bug is:** the chip says `Saved locally` and a reload loses the project.

## Flow 2 — Autosave and restore

1. Click the project name field, type a distinctive name, press `Tab`.
2. Wait about a second (the chip flashes `Saving…` while the write is in flight).
3. Reload the page (`F5`).

**Expected:** the name you typed is still there, and the chip says `Saved locally`. The project
was restored from the local database.

4. Now change the *content* — drag a clip, edit a value in the inspector — wait a second,
   reload.

**Expected:** the change is still there.

**A bug is:** the name survives but an edit does not, or the chip claims `Saved locally` while
the reload shows the previous state.

## Flow 3 — One writer per workspace

1. Open the app in a second tab (same URL, same browser).
2. Compare the two chips.

**Expected:** the first tab keeps `Saved locally`; the second reads
`Read-only — another tab owns this workspace`. The second tab still edits and previews — it just
cannot write to the workspace, and the top bar says so.

3. In the **first** tab, type a new project name.

**Expected:** the first tab saves it. The second tab does not change and does not lose anything.

**A bug is:** both tabs claim to be saving, or the second tab silently overwrites the first.

## Flow 4 — Closing the tab that owns the workspace

1. With two tabs open, close the one that says `Saved locally` (the owner).
2. In the remaining tab, reload immediately.

**Expected:** within a couple of seconds the remaining tab says `Saved locally` and the stored
project is there. The browser releases the previous owner's file handle a moment after the tab
goes away, and the app waits for it.

**A bug is:** the remaining tab says `Storage degraded — …` and the project list looks empty.
That means the app gave up on the database too early and moved the work somewhere else.

## Flow 5 — When the database cannot run

1. DevTools → Network → right-click the request for the database worker (a `worker-*.js` file) →
   **Block request URL**.
2. Reload the app.

**Expected:** the chip reads

```
Storage degraded — The local database could not be opened (…). Projects are saved in this
browser's storage instead.
```

and the editor still works. Make an edit: it is kept, and DevTools → Application → Local
Storage shows a `chart-studio:workspace` key.

3. Unblock the request and reload.

**Expected:** the chip is back to `Saved locally`.

**A bug is:** the chip claims `Saved locally` while the work is actually in the fallback, or the
app shows a blank editor with no explanation.

## Flow 6 — The candlestick chart

1. Library → **Trading** → `🕯Candlestick Chart`. Drag it onto a track in the timeline.
2. The clip appears on the track and is selected.

**Expected:** the clip is about 180 frames long (12 bars × 15 frames per bar) and the canvas
shows a chart: a grid, a price axis on the right, `SYNTH` / `5m` at the top left, and a badge
that says `SYNTHETIC DATA · SIMULATED INTRABAR`.

3. In the inspector you should see: Name, Start (frame), Length (frames), Reveal
(`discrete` / `simulated`), Frames per bar, Simulation seed, Symbol, Timeframe, Width, Height,
Up colour, Down colour, Wick colour, Grid colour, Show grid, Show price axis, Show provenance,
X, Y — and below that the chart's own panel: Data source (`Manual` / `Synthetic`), Seed, Bar
count, Start price, and a table with the columns `#`, `O`, `H`, `L`, `C` and 12 rows.

4. Change **Symbol** to `EURUSD` and **Timeframe** to `1m`.

**Expected:** the label on the chart follows.

5. Change the **Reveal** mode from `discrete` to `simulated`.

**Expected:** the candles now grow within the bar instead of appearing whole.

6. In the OHLC table, change the `C` (close) value of the first row.

**Expected:** that candle changes on the canvas, and the chart keeps its provenance badge.

7. Press **+ Add bar**.

**Expected:** a 13th row appears, and the chart draws one more candle. Press
**Fit clip length to bars** — the clip length in the inspector follows the number of bars.

8. Change **Show price axis** off.

**Expected:** the axis on the right disappears; the chart widens into the space.

**A bug is:** the chart ignores an inspector change, the badge disappears when the data is
synthetic, or a candle shows a price that is outside its own O/H/L range.

## Flow 7 — The chart over time

1. Put the playhead on the frame where the chart starts and press play.
2. Watch the candles appear one by one.

**Expected:** the chart is empty before its first bar and fills up bar by bar. No bar appears
before the frame that owns it, and the price scale only covers the bars that are already on
screen.

**A bug is:** a later candle's price changes an earlier frame, or the whole series is visible
from frame one.

## Flow 8 — The same frame always looks the same

1. Note what the chart looks like at, say, frame 60.
2. Scrub backwards to frame 10, then forward to frame 60 again.

**Expected:** identical.

3. Reload the page and go to frame 60 again.

**Expected:** identical.

**A bug is:** the candles differ between two visits to the same frame — that breaks the
preview/export contract.

## Flow 9 — The motion component

1. Library → **Motion** → `🖍Marker Highlight`. Drag it onto a track.
2. Play the timeline.

**Expected:** a title with an animated highlight, drawn on the canvas, with the animation tied
to the clip's own frames. Change its text in the inspector and the canvas follows.

## Flow 10 — Exporting

1. Top bar → **Export MP4**.
2. Let the render finish.

**Expected:** an MP4 that contains the chart you built, at the project's size and frame rate.

3. Or from a terminal:

```bash
npm run render -- project.json out/test.mp4
```

**Expected:** `out/test.mp4` — the export path does not depend on the storage layer, and a
project file still renders on its own.

**A bug is:** the exported video differs from the preview, or the export refuses to run.

## Flow 11 — Project files still work

1. Top bar → **Save**. A JSON file downloads (or the opened file is overwritten, if the browser
   offers the File System Access API).
2. Top bar → **Open**, and pick that file.

**Expected:** the project loads. The file is a portable snapshot; the workspace database is a
separate thing.

---

## Not expected to work yet

These are known gaps, not bugs:

- No dashboard of recent projects, no thumbnails, no rename/duplicate/delete from the UI.
- No portable `.chartstudio` archive — the Save button writes a plain JSON project file.
- No undo that walks the stored revisions; undo still uses the editor's own history.
- No market data import (CSV/JSON), no indicators, no volume pane, no chart groups, no higher or
  lower timeframes, no drawing tools, no smart-money-tracking, no multi-timeframe.
- The second tab cannot list the stored projects; it is blocked, not degraded.
- The storage quota is not measured, so the app cannot warn before a write fails.
- `README.md` still describes the upstream editor and does not match this fork.

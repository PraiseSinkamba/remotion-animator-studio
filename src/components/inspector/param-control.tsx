import React, { useEffect, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import type { ParamDef } from '../../types';
import { Row } from './row';

/** The value kinds a parameter can hold. */
export type ParamValue = string | number | boolean | undefined;

/** A number field: mono figures, right aligned, sized for a dense panel. */
export const numberFieldClass =
  'h-6 w-20 rounded-md px-1.5 text-right font-mono text-xs tabular-nums md:text-xs';

/**
 * A number parameter that has a range: a Radix slider that keeps a local draft
 * while dragging and only writes to the store when the drag is released, next
 * to a number input that writes through as you type.
 */
const NumberRangeControl: React.FC<{
  def: ParamDef;
  value: ParamValue;
  id: string;
  onChange: (v: ParamValue) => void;
  onCommit: () => void;
}> = ({ def, value, id, onChange, onCommit }) => {
  const min = def.min ?? 0;
  const max = def.max ?? 100;
  const num = Number(value);
  const safeNum = Number.isFinite(num) ? num : min;
  const [draft, setDraft] = useState(safeNum);

  // The slider writes to the store on release only, so the store value can only
  // change from the outside — follow it whenever it does.
  useEffect(() => {
    setDraft(safeNum);
  }, [safeNum]);

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <Label htmlFor={id} className="text-[11px] font-normal text-muted-foreground">
          {def.label}
        </Label>
        <Input
          id={id}
          type="number"
          className={numberFieldClass}
          min={min}
          max={max}
          step={def.step}
          value={draft}
          onFocus={onCommit}
          onChange={(e) => {
            const n = Number(e.target.value);
            setDraft(n);
            onChange(n);
          }}
        />
      </div>
      <Slider
        value={[Number.isFinite(draft) ? Math.min(Math.max(draft, min), max) : min]}
        min={min}
        max={max}
        step={def.step}
        className="w-full"
        role="group"
        aria-label={def.label}
        onValueChange={(v) => {
          setDraft(v[0]);
        }}
        onValueCommit={(v) => {
          setDraft(v[0]);
          onCommit();
          onChange(v[0]);
        }}
      />
    </div>
  );
};

/**
 * One parameter, rendered as a labelled row. Every kind keeps the control it
 * has today: a slider plus number for ranged numbers, a colour picker plus
 * hex field for colours, a select, a switch, a text field or a text area.
 */
export const ParamControl: React.FC<{
  def: ParamDef;
  value: ParamValue;
  /** Prefix of the control ids — the clip id for clip props, the effect id for effect params. */
  idPrefix: string;
  onChange: (v: ParamValue) => void;
  onCommit: () => void;
}> = ({ def, value, idPrefix, onChange, onCommit }) => {
  const id = `${idPrefix}-${def.key}`;
  switch (def.kind) {
    case 'number':
      if (def.min === undefined || def.max === undefined) {
        return (
          <Row label={def.label} htmlFor={id}>
            <Input
              id={id}
              type="number"
              className={numberFieldClass}
              min={def.min}
              max={def.max}
              step={def.step}
              value={Number.isFinite(Number(value)) ? Number(value) : ''}
              onFocus={onCommit}
              onChange={(e) => onChange(Number(e.target.value))}
            />
          </Row>
        );
      }
      return <NumberRangeControl def={def} value={value} id={id} onChange={onChange} onCommit={onCommit} />;
    case 'color':
      return (
        <Row label={def.label} htmlFor={id}>
          <Input
            type="color"
            aria-label={`${def.label} picker`}
            className="h-6 w-9 shrink-0 rounded-md p-0.5"
            value={String(value)}
            onFocus={onCommit}
            onChange={(e) => onChange(e.target.value)}
          />
          <Input
            id={id}
            type="text"
            className="h-6 w-24 rounded-md px-1.5 font-mono text-xs md:text-xs"
            value={String(value)}
            onFocus={onCommit}
            onChange={(e) => onChange(e.target.value)}
          />
        </Row>
      );
    case 'select':
      return (
        <Row label={def.label} htmlFor={id}>
          <Select
            value={String(value)}
            onValueChange={(v) => {
              onCommit();
              onChange(v);
            }}
          >
            <SelectTrigger id={id} className="h-6 w-full min-w-0 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {def.options?.map((o) => (
                  <SelectItem key={o} value={o}>
                    {o.includes(',') ? o.split(',')[0].replace(/"/g, '') : o}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </Row>
      );
    case 'text':
      return (
        <Row label={def.label} htmlFor={id}>
          <Input
            id={id}
            type="text"
            className="h-6 min-w-0 flex-1 rounded-md px-1.5 text-xs md:text-xs"
            value={String(value)}
            onFocus={onCommit}
            onChange={(e) => onChange(e.target.value)}
          />
        </Row>
      );
    case 'textarea':
      return (
        <Row label={def.label} htmlFor={id} stacked>
          <Textarea
            id={id}
            rows={8}
            className="text-xs md:text-xs"
            value={String(value)}
            onFocus={onCommit}
            onChange={(e) => onChange(e.target.value)}
            spellCheck={false}
          />
        </Row>
      );
    case 'boolean':
      return (
        <Row label={def.label} htmlFor={id}>
          <Switch
            id={id}
            checked={Boolean(value)}
            onPointerDown={onCommit}
            onCheckedChange={(checked) => onChange(checked)}
          />
        </Row>
      );
  }
};

import { createPropsValidator, isPropsObject, type PropsValidator, type VideoComponentDefinition } from '@chart-studio/core';

/** Validate the JSON-encoded records the inherited visual renderers consume. */
export function createBasePropsValidator(definition: VideoComponentDefinition): PropsValidator {
  const validateScalars = createPropsValidator(definition.defaults, definition.params);
  return (raw) => {
    const normalized = validateScalars(raw);
    if (!normalized.ok || !['nodeTrail', 'commitGraph'].includes(definition.type)) return normalized;
    const data = normalized.value.data;
    if (typeof data !== 'string') return { ok: false, issues: [{path:'data',message:'Expected JSON text'}] };
    let records: unknown;
    try { records = JSON.parse(data); }
    catch { return { ok:false, issues:[{path:'data',message:'Expected valid JSON'}] }; }
    if (!Array.isArray(records)) return {ok:false,issues:[{path:'data',message:'Expected an array of records'}]};
    const issues: {path:string;message:string}[] = [];
    records.forEach((record: unknown, index: number) => {
      const path = `data.${index}`;
      if (!isPropsObject(record)) { issues.push({path,message:'Expected a record'}); return; }
      const numeric = (key:string, required:boolean, integer=false):void => {
        const value=record[key];
        if (value===undefined && !required) return;
        if(typeof value!=='number'||!Number.isFinite(value)||(integer&&(!Number.isInteger(value)||value<0))) {
          issues.push({path:`${path}.${key}`,message:integer?'Expected a nonnegative integer':'Expected a finite number'});
        }
      };
      const text=(key:string, required:boolean):void => {
        if(record[key]===undefined&&!required) return;
        if(typeof record[key]!=='string') issues.push({path:`${path}.${key}`,message:'Expected text'});
      };
      if(definition.type==='nodeTrail') {
        numeric('x',true);numeric('y',true);numeric('from',false,true);text('label',false);text('color',false);
        if(typeof record.from==='number' && record.from>=index) issues.push({path:`${path}.from`,message:'Must name an earlier waypoint'});
      } else {
        text('m',true);numeric('b',false,true);numeric('a',false,true);numeric('d',false,true);
      }
    });
    return issues.length ? {ok:false,issues} : normalized;
  };
}

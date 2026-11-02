import React, { useRef } from 'react';
import { ParamControl, type ParamValue } from '@chart-studio/ui';
import type { ParamDef } from '@chart-studio/core';

/** One undo snapshot for the first accepted change in each control gesture. */
export const TransactionalParamControl: React.FC<{
  def: ParamDef; value: ParamValue; idPrefix: string;
  onChange: (value: ParamValue, recordHistory: boolean) => boolean;
}> = ({onChange, ...props}) => {
  const changed = useRef(false);
  return <ParamControl {...props} onCommit={() => { changed.current = false; }} onChange={value => {
    if (onChange(value, !changed.current)) changed.current = true;
  }} />;
};

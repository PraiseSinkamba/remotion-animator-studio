import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { sampleProject } from '@chart-studio/core';
import { MainComposition } from './composition';

describe('composition isolation from editor typography', () => {
  it('owns the font and line height inherited by chart SVG labels', () => {
    const markup = renderToStaticMarkup(<MainComposition project={{...sampleProject,tracks:[]}} />);
    expect(markup).toContain('font-family:Arial, sans-serif');
    expect(markup).toContain('line-height:1.2');
    expect(markup).toContain('.chartstudio-video svg,.chartstudio-video img,.chartstudio-video video{display:block;vertical-align:middle}');
    expect(markup).not.toContain('size-3');
  });
});

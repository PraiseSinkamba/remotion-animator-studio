import { describe, it, expect } from 'vitest';
import { sanitizeStaticHtml } from './safe-html';
describe('static HTML boundary', () => {
 it('retains formatted text and safe colors', () => expect(sanitizeStaticHtml('<p style="color:red;font-weight:700">A &amp; <b>B</b></p>')).toBe('<p style="color:red;font-weight:700">A &amp; <b>B</b></p>'));
 it('drops active, foreign, navigation and resource content', () => {
 const result=sanitizeStaticHtml('<script>alert(1)</script><svg><text>bad</text></svg><iframe src="https://x"></iframe><form>bad</form><p onclick="evil()" style="color:blue;background:url(https://x);font-family:u\\72l(x)"><a href="javascript:x">safe</a><img src="https://x"></p>');
 expect(result).toBe('<p style="color:blue">safe</p>');
 });
});

it('drops obfuscated URLs, foreign nodes and CSS resources while retaining plain text', () => {
  const authored='<div style="color:#abc;background-image:u\\72l(https://evil)"><a href="&#106;avascript:alert(1)">label</a><object>hidden</object><embed><math><mtext>hidden</mtext></math><span style="font-size:20px">text</span></div>';
  expect(sanitizeStaticHtml(authored)).toBe('<div style="color:#abc">label<span style="font-size:20px">text</span></div>');
  expect(authored).toContain('javascript'.slice(1));
});

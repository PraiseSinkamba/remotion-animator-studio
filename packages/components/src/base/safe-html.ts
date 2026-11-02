import { parseFragment, type DefaultTreeAdapterMap } from 'parse5';

const tags = new Set(['p','div','span','b','strong','i','em','u','s','small','sub','sup','br','hr','blockquote','pre','code','ul','ol','li','h1','h2','h3','h4','h5','h6']);
const discard = new Set(['script','style','iframe','object','embed','form','template','svg','math','noscript','textarea','xmp']);
const colors = /^(?:#[0-9a-f]{3,8}|[a-z]+|rgba?\([0-9.,% ]+\)|hsla?\([0-9.,% ]+\))$/i;
const sizes = /^(?:0|[0-9]+(?:\.[0-9]+)?(?:px|em|rem|%))$/;
const escape = (value:string):string => value.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const safeStyle = (source:string):string => source.split(';').flatMap((declaration) => {
 const colon=declaration.indexOf(':'); if(colon<0) return [];
 const key=declaration.slice(0,colon).trim().toLowerCase(), value=declaration.slice(colon+1).trim();
 // CSS escapes, functions and arbitrary token streams are deliberately excluded.
 if (/[\\@<>]/.test(value)) return [];
 const valid = ['color','background-color'].includes(key) ? colors.test(value)
 : ['font-size','letter-spacing','line-height','padding','margin','border-radius'].includes(key) ? sizes.test(value)
 : key==='font-weight' ? /^(normal|bold|[1-9]00)$/.test(value)
 : key==='font-style' ? /^(normal|italic|oblique)$/.test(value)
 : key==='text-align' ? /^(left|right|center|justify)$/.test(value)
 : key==='text-decoration' ? /^(none|underline|line-through)$/.test(value)
 : key==='white-space' ? /^(normal|pre|pre-wrap|pre-line)$/.test(value) : false;
 return valid ? [`${key}:${value}`] : [];
}).join(';');
/** Static, resource-free HTML. Stored authored markup is never rewritten. */
export function sanitizeStaticHtml(source:string):string {
 const fragment=parseFragment(source);
 const render=(node:DefaultTreeAdapterMap['node']):string => {
  if(node.nodeName==='#text' && 'value' in node) return escape(node.value);
  if(!('tagName' in node)) return '';
  if(node.namespaceURI!=='http://www.w3.org/1999/xhtml'||discard.has(node.tagName)) return '';
  const children=node.childNodes.map(render).join('');
  if(!tags.has(node.tagName)) return children;
  const style=safeStyle(node.attrs.find(a=>a.name==='style')?.value ?? '');
  const opening=`<${node.tagName}${style ? ` style="${escape(style)}"` : ''}>`;
  return opening+(['br','hr'].includes(node.tagName)?'':children+`</${node.tagName}>`);
 };
 return fragment.childNodes.map(render).join('');
}

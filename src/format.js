/** Output serializers shared by the CLI and the HTTP function. */

export const FORMATS = ['json', 'xml', 'jsonp', 'table'];

export function toJSON(result) {
  return JSON.stringify(result);
}

export function toJSONP(result, callback = 'callback') {
  const cb = /^[A-Za-z_$][\w$.]*$/.test(callback) ? callback : 'callback';
  return `/**/ typeof ${cb} === 'function' && ${cb}(${JSON.stringify(result)});`;
}

export function toXML(result, root = 'response') {
  return `<?xml version="1.0" encoding="UTF-8"?>\n${node(root, result)}`;
}

function node(name, value) {
  if (Array.isArray(value)) {
    const item = singular(name);
    return `<${name}>${value.map((v) => node(item, v)).join('')}</${name}>`;
  }
  if (value && typeof value === 'object') {
    return `<${name}>${Object.entries(value)
      .map(([k, v]) => node(k, v))
      .join('')}</${name}>`;
  }
  if (value == null) return `<${name}/>`;
  return `<${name}>${escape(String(value))}</${name}>`;
}

function singular(name) {
  if (name === 'areas') return 'area';
  if (name === 'types') return 'type';
  return name.endsWith('s') ? name.slice(0, -1) : 'item';
}

function escape(s) {
  return s.replace(/[<>&'"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' })[c]);
}

export function toTable(result) {
  const lines = [];
  lines.push(`point   ${result.point.lat}, ${result.point.lon}`);
  lines.push(`status  ${result.status}`);
  if (result.areas.length) {
    const w = Math.max(...result.areas.map((a) => a.id.length), 2);
    for (const a of result.areas) {
      lines.push(`${a.type.toUpperCase().padEnd(5)} ${a.id.padStart(w)}  ${a.name}`);
    }
  }
  return lines.join('\n');
}

export function format(result, fmt = 'json', callback) {
  switch ((fmt || 'json').toLowerCase()) {
    case 'xml':
      return { body: toXML(result), contentType: 'application/xml; charset=utf-8' };
    case 'jsonp':
      return { body: toJSONP(result, callback), contentType: 'application/javascript; charset=utf-8' };
    case 'table':
      return { body: toTable(result), contentType: 'text/plain; charset=utf-8' };
    default:
      return { body: toJSON(result), contentType: 'application/json; charset=utf-8' };
  }
}

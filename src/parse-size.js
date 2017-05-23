import { clamp } from './utils';

const MIN = 1;
const MAX = 16;

export default
function parse_size(size) {
  let [x, y] = (size + '')
    .replace(/\s+/g, '')
    .replace(/[,，xX]+/, 'x')
    .split('x')
    .map(Number);

  const ret = {
    x: clamp(x || MIN, 1, MAX),
    y: clamp(y || x || MIN, 1, MAX)
  };

  return Object.assign({}, ret,
    { count: ret.x * ret.y }
  );
}

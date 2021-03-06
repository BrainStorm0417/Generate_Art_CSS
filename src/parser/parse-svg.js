import { scan, iterator } from './tokenizer.js';
import parseValueGroup from './parse-value-group.js';

function readStatement(iter, token) {
  let fragment = [];
  let inlineBlock;
  let stack = [];
  while (iter.next()) {
    let { curr, next } = iter.get();
    let isStatementBreak = !stack.length && (!next || curr.isSymbol(';') || next.isSymbol('}'));
    if (curr.isSymbol("'", '"')) {
      if (curr.status === 'open') {
        stack.push(curr);
      } else {
        stack.pop();
      }
      if (next.isSymbol('}') && !stack.length) {
        isStatementBreak = true;
      }
    }
    if (!stack.length && curr.isSymbol('{')) {
      let selectors = getGroups(fragment, token => token.isSpace());
      if (!selectors.length) {
        continue;
      }
      let tokenName = selectors.pop();
      let skip = isSkip(...selectors, tokenName);
      inlineBlock = resolveId(walk(iter, {
        type: 'block',
        name: tokenName,
        inline: true,
        value: []
      }), skip);
      while (tokenName = selectors.pop()) {
        inlineBlock = resolveId({
          type: 'block',
          name: tokenName,
          value: [inlineBlock]
        }, skip);
      }
      break;
    }
    // skip quotes
    let skip = (curr.status == 'open' && stack.length == 1)
      || (curr.status == 'close' && !stack.length);

    if (!skip) {
      fragment.push(curr);
    }
    if (isStatementBreak) {
      break;
    }
  }
  if (fragment.length && !inlineBlock) {
    token.value = joinToken(fragment);
  } else if (inlineBlock) {
    token.value = inlineBlock;
  }
  return token
}

function walk(iter, parentToken) {
  let rules = [];
  let fragment = [];
  let tokenType = parentToken && parentToken.type || '';
  let stack = [];

  while (iter.next()) {
    let { prev, curr, next } = iter.get();
    let isBlockBreak = !next || curr.isSymbol('}');
    if (curr.isSymbol('(')) {
      stack.push(curr.value);
    }
    if (curr.isSymbol(')')) {
      stack.pop();
    }
    if (isBlock(tokenType) && isBlockBreak) {
      if (!next && rules.length && !curr.isSymbol('}')) {
        let last = rules[rules.length - 1].value;
        if (typeof last === 'string') {
          rules[rules.length - 1].value += (';' + curr.value);
        }
      }
      parentToken.value = rules;
      break;
    }
    else if (curr.isSymbol('{')) {
      let selectors = getGroups(fragment, token => token.isSpace());
      if (!selectors.length) {
        continue;
      }
      if (isSkip(parentToken.name)) {
        selectors = [joinToken(fragment)];
      }
      let tokenName = selectors.pop();
      let skip = isSkip(...selectors, parentToken.name, tokenName);
      let block = resolveId(walk(iter, {
        type: 'block',
        name: tokenName,
        value: []
      }), skip);
      while (tokenName = selectors.pop()) {
        block = resolveId({
          type: 'block',
          name: tokenName,
          value: [block]
        }, skip);
      }
      rules.push(block);
      fragment = [];
    }
    else if (
      curr.isSymbol(':')
      && !stack.length
      && !isSpecialProperty(prev, next)
      && fragment.length
    ) {
      let props = getGroups(fragment, token => token.isSymbol(','));
      let statement = readStatement(iter, {
        type: 'statement',
        name: 'unkown',
        value: ''
      });
      let groupdValue = parseValueGroup(statement.value);
      let expand = (props.length > 1 && groupdValue.length === props.length);

      props.forEach((prop, i) => {
        let item = Object.assign({}, statement, { name: prop });
        if (expand) {
          item.value = groupdValue[i];
        }
        rules.push(item);
      });
      if (isBlock(tokenType)) {
        parentToken.value = rules;
      }
      fragment = [];
    }
    else if (curr.isSymbol(';')) {
      if (rules.length && fragment.length) {
        rules[rules.length - 1].value += (';' + joinToken(fragment));
        fragment = [];
      }
    }
    else {
      fragment.push(curr);
    }
  }

  if (rules.length && isBlock(tokenType)) {
    parentToken.value = rules;
  }
  return tokenType ? parentToken : rules;
}

function isSpecialProperty(prev, next) {
  const names = [
    'xlink:actuate', 'xlink:arcrole', 'xlink:href', 'xlink:role',
    'xlink:show',    'xlink:title',   'xlink:type',
    'xml:base',      'xml:lang',      'xml:space',
  ];
  let prevValue = prev && prev.value;
  let nextValue = next && next.value;
  return names.includes(prevValue + ':' + nextValue);
}

function joinToken(tokens) {
  return tokens
    .filter((token, i) => {
      if (token.isSymbol(';', '}') && i === tokens.length - 1) return false;
      return true;
    })
    .map(n => n.value).join('');
}

function resolveId(block, skip) {
  let name = block.name || '';
  let [tokenName, ...ids] = name.split(/#/);
  let id = ids[ids.length - 1];
  if (tokenName && id && !skip) {
    block.name = tokenName;
    block.value.push({
      type: 'statement',
      name: 'id',
      value: id,
    });
  }
  return block;
}

function getGroups(tokens, fn) {
  let group = [];
  let temp = [];
  tokens.forEach(token => {
    if (fn(token)) {
      group.push(joinToken(temp));
      temp = [];
    } else {
      temp.push(token);
    }
  });
  if (temp.length) {
    group.push(joinToken(temp));
  }
  return group;
}

function isSkip(...names) {
  return names.some(n => n === 'style');
}

function isBlock(type) {
  return type === 'block';
}

function skipHeadSVG(block) {
  let head = block && block.value && block.value[0];
  if (head && head.name === 'svg' && isBlock(head.type)) {
    return skipHeadSVG(head);
  } else {
    return block;
  }
}

function parse(source, root) {
  let iter = iterator(scan(source));
  let tokens = walk(iter, root || {
    type: 'block',
    name: 'svg',
    value: []
  });
  return skipHeadSVG(tokens);
}

export default parse;

const IGNORE_COMMENT = "webp-ignore";
const supportExt = [".png", ".jpg", ".jpeg"];

const weakSet = new WeakSet();

let t = null;

const replacePath = (path) => {
  for (const ext of supportExt) {
    const reg = new RegExp(`\\${ext}`);
    if (reg.test(path)) {
      return path.replace(reg, ".webp");
    }
  }
  // 匹配不中必须返回原 path
  return path;
};

const shouldSkipByPath = (maybeHasExt) => {
  // 根据文件类型判断
  maybeHasExt = [].concat(maybeHasExt);
  let skip = true;
  for (const ext of supportExt) {
    for (const maybeExt of maybeHasExt) {
      const reg = new RegExp(`\\${ext}`);
      if (reg.test(maybeExt)) {
        skip = false;
        break;
      }
    }
  }
  return skip;
};

const shouldSkipByComment = (node) => {
  let shouldIgnore = false;
  if (node && node.trailingComments) {
    node.trailingComments.forEach((comment) => {
      if (
        comment.value === IGNORE_COMMENT ||
        comment.value.includes(IGNORE_COMMENT)
      ) {
        shouldIgnore = true;
      }
    });
  }
  return shouldIgnore;
};

const handleStringLiteral = (node) => {
  const imagePath = node.value;
  if (shouldSkipByPath(imagePath)) {
    return node;
  }
  const webpPath = replacePath(imagePath);
  return t.conditionalExpression(
    t.memberExpression(t.identifier("window"), t.identifier("isSupportWebp")),
    t.stringLiteral(webpPath),
    t.stringLiteral(imagePath)
  );
};

const handleTemplateLiteral = (node) => {
  const quasis = node.quasis;
  const expressions = node.expressions;
  if (shouldSkipByPath(quasis.map((item) => item.value.raw))) {
    return node;
  }
  return t.conditionalExpression(
    t.memberExpression(t.identifier("window"), t.identifier("isSupportWebp")),
    t.templateLiteral(
      quasis.map((quasi) => {
        const value = quasi.value.raw;
        return t.templateElement({
          raw: replacePath(value),
          cooked: replacePath(value),
        });
      }),
      expressions
    ),
    t.templateLiteral(quasis, expressions)
  );
};

const processChild = (node) => {
  if (weakSet.has(node)) {
    return node;
  }
  let newNode = node;
  if (t.isStringLiteral(node)) {
    newNode = handleStringLiteral(node);
  } else if (t.isTemplateLiteral(node)) {
    newNode = handleTemplateLiteral(node);
  } else if (t.isConditionalExpression(node)) {
    const { consequent, alternate } = node;
    node.consequent = processChild(consequent);
    node.alternate = processChild(alternate);
    newNode = node;
  }
  weakSet.add(newNode);
  return newNode;
};

module.exports = function ({ types }) {
  t = types;
  return {
    visitor: {
      CallExpression(path) {
        const { callee, arguments: args } = path.node;
        if (t.isIdentifier(callee, { name: "require" }) && args.length === 1) {
          const child = args[0];
          if (weakSet.has(child) || shouldSkipByComment(child)) {
            return;
          }
          const newChild = processChild(child);
          const statement = t.callExpression(t.identifier("require"), [
            newChild,
          ]);
          path.replaceWith(statement);
        }
      },
    },
  };
};

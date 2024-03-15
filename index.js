const weakSet = new WeakSet();

let t = null;
let supportExt;
let ignoreComment;
let childNodeType;

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
  // 有支持的后缀就不跳过
  if (
    maybeHasExt.some((item) =>
      supportExt.some((ext) => new RegExp(`\\${ext}`).test(item))
    )
  ) {
    skip = false;
  }
  // query带有 inline 的跳过 会被webpack转成 base64
  if (maybeHasExt.some((item) => item.includes("?inline"))) {
    skip = true;
  }
  return skip;
};

const shouldSkipByComment = (node) => {
  let shouldIgnore = false;
  if (node && node.trailingComments) {
    if (
      node.trailingComments.some(
        (comment) =>
          comment.value === ignoreComment ||
          comment.value.includes(ignoreComment)
      )
    ) {
      shouldIgnore = true;
    }
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
  if (t.isStringLiteral(node) && childNodeType.StringLiteral) {
    newNode = handleStringLiteral(node);
  } else if (t.isTemplateLiteral(node) && childNodeType.TemplateLiteral) {
    newNode = handleTemplateLiteral(node);
  } else if (
    t.isConditionalExpression(node) &&
    childNodeType.ConditionalExpression
  ) {
    const { consequent, alternate } = node;
    node.consequent = processChild(consequent);
    node.alternate = processChild(alternate);
    newNode = node;
  }
  weakSet.add(newNode);
  return newNode;
};

const mergeOptions = (state) => ({
  ignoreComment: "webp-ignore",
  supportExt: [".png", ".jpg", ".jpeg"],
  childNodeType: {
    StringLiteral: true,
    ConditionalExpression: true,
    TemplateLiteral: true,
  },
  ...state.opts,
});

const toGlobalOptions = (state, types) => {
  const mergedOptions = mergeOptions(state);
  supportExt = mergedOptions.supportExt;
  ignoreComment = mergedOptions.ignoreComment;
  childNodeType = mergedOptions.childNodeType;
  t = types;
};

module.exports = function ({ types }) {
  return {
    visitor: {
      Program(_, state) {
        toGlobalOptions(state, types);
      },

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

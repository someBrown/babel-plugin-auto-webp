const babel = require("@babel/core");
const plugin = require("./index.js");
const { equal } = require("node:assert");
const { test } = require("node:test");
const supportExt = [".png", ".jpg", ".jpeg"];
const childNodeType = {
  ConditionalExpression: true,
  TemplateLiteral: true,
  StringLiteral: true,
};

async function run(input, output) {
  const { code } = babel.transform(input, {
    plugins: [[plugin, { supportExt, childNodeType }]],
  });
  equal(code.trim(), output.trim());
}

test("require普通字符串", async () => {
  await run(
    'require("./a.png")',
    'require(window.isSupportWebp ? "./a.webp" : "./a.png");'
  );
});

test("三元表达式中包含require普通字符串", async () => {
  await run(
    'a ? require("./a.png") : require("./b.png")',
    'a ? require(window.isSupportWebp ? "./a.webp" : "./a.png") : require(window.isSupportWebp ? "./b.webp" : "./b.png");'
  );
});

test("require中是三元表达式", async () => {
  await run(
    'require(obj.png ? "./a.png" : "./b.jpg")',
    'require(obj.png ? window.isSupportWebp ? "./a.webp" : "./a.png" : window.isSupportWebp ? "./b.webp" : "./b.jpg");'
  );
});

test("require中是嵌套三元表达式", async () => {
  await run(
    'require(obj.webp ? obj.png ? "./a.png" : "./b.jpg" : "./d.png")',
    'require(obj.webp ? obj.png ? window.isSupportWebp ? "./a.webp" : "./a.png" : window.isSupportWebp ? "./b.webp" : "./b.jpg" : window.isSupportWebp ? "./d.webp" : "./d.png");'
  );
});

test("模板字符串", async () => {
  await run(
    "require(`./png_${index}.png`)",
    "require(window.isSupportWebp ? `./png_${index}.webp` : `./png_${index}.png`);"
  );
});

test("跳过注释语法", async () => {
  await run(
    'require("./a.png" /*webp-ignore*/)',
    'require("./a.png" /*webp-ignore*/);'
  );
});

test("jpg格式", async () => {
  await run(
    'require("./a.jpg")',
    'require(window.isSupportWebp ? "./a.webp" : "./a.jpg");'
  );
});

test("jpeg格式", async () => {
  await run(
    'require("./a.jpeg")',
    'require(window.isSupportWebp ? "./a.webp" : "./a.jpeg");'
  );
});

test("不需要转换的格式_1", async () => {
  await run('require("./png.js")', 'require("./png.js");');
});

test("不需要转换的格式_2", async () => {
  await run("require(`./png_${index}.js`)", "require(`./png_${index}.js`);");
});

test("表达式中包含ext_1", async () => {
  await run(
    "require(`./png_${index.png}.js`)",
    "require(`./png_${index.png}.js`);"
  );
});

test("表达式中包含ext_2并且是模板字符串", async () => {
  await run(
    "require(`./png_${index.png}.png`)",
    "require(window.isSupportWebp ? `./png_${index.png}.webp` : `./png_${index.png}.png`);"
  );
});

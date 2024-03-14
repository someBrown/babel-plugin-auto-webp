### require 图片格式自动添加 webp 格式

1.  对于引入的文件，如果是[".png", ".jpg", ".jpeg"]类型'require("./a.png")' ，
    则转换为 'require(window.isSupportWebp ? "./a.webp" : "./a.png");'
2.  可以添加注释跳过转换， 如'require("./a.png" /\*webp-ignore\*/)'
3.  window.isSupportWebp 需要自行添加

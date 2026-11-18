# assets

图标与品牌素材。图形是纯路径 SVG，不依赖字体（不会因为换机器少字体就变形）。

| 文件 | 用途 |
|---|---|
| `logo.svg` | 主图标：512 圆角方块 + 米白「中」，所有 PNG 的源 |
| `icon-16/32/48/64/128/256/512.png` | 按尺寸单独栅格化的位图；`@icon` 用 48，`@icon64` 用 64，GitHub 仓库头像用 512 |
| `mark-dark.svg` / `mark-light.svg` | 透明底单色字标，浅色/深色背景内联用 |
| `social-preview.png` | GitHub 社交预览 1280×640 |

## 色板

| 名称 | 值 | 用途 |
|---|---|---|
| petrol | `#0C4A45` | 底色 |
| cream | `#F7F1E3` | 字标 |
| coral | `#F2765E` | 辅助色（分隔线、规则线），不进主体图形——32px 下会抢掉外框辨识度 |

## 重新生成位图

```bash
cd assets
for s in 16 32 48 64 128 256 512; do
  inkscape --export-type=png --export-width=$s --export-filename="icon-$s.png" logo.svg
done
```

社交预览用 ImageMagick 排版（**不要**用 Inkscape 排中文：本机 fontconfig 认不到 `Noto Sans CJK SC` 族名，`fc-match` 会回落到 JetBrains Mono，渲染出来是豆腐块；给 ImageMagick 传 `.ttc` 字体的绝对路径才正常）。

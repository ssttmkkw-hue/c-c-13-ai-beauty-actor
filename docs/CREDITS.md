# Credits & asset licenses / 素材与授权

Every third-party asset in this repository is listed here with its source and
license. All models are redistributed **with only their embedded textures
downscaled** (longest side ≤ 1024 px, via `tools/optimize_vrm.py`) to keep the
repo and page load small. Geometry, rigs, spring bones, expressions and the
**VRM meta / license settings inside each file are left untouched**. Costume
and hair variants are runtime recolours done in the browser; the files on disk
are never repainted.

This project is not affiliated with or endorsed by pixiv Inc. or the VRoid Project.

## 3D models (`public/models/`)

| File in repo | Role in app | Original | Author | Source | License (verified in the file's VRM meta) |
|---|---|---|---|---|---|
| `linwan.vrm` | 林晚 (heroine) | `VRM1_Constraint_Twist_Sample.vrm` | pixiv Inc. — `(c) 2022 pixiv Inc.` | <https://github.com/pixiv/three-vrm/tree/dev/packages/three-vrm/examples/models> | **VRM Public License 1.0** (<https://vrm.dev/licenses/1.0/>): `allowRedistribution: true`, `modification: allowModificationRedistribution`, `creditNotation: unnecessary`, `commercialUsage: corporation`, `avatarPermission: everyone` |
| `guyan.vrm` | 顾言 (hero) | `Sakurada Fumiriya.vrm` (桜田 史利矢) | VRoid Project (VRoidプロジェクト) | <https://opengameart.org/content/vroid-studio-cc0-models> (file `sakurada_fumiriya.zip`) | OpenGameArt lists the pack as **CC0**. Embedded VRoid Hub license: `allowed_to_use_user=everyone`, `modification=allow`, `redistribution=allow`, `credit=unnecessary`, `corporate_commercial_use=allow` |
| `sutang.vrm` | 苏棠 (heroine alt) | `AvatarSample_D.vrm` (千駄ヶ谷 渋) | VRoid Project | same OpenGameArt page (`avatarsample_d_0.zip`) | CC0 (OpenGameArt); embedded VRoid Hub license as above (redistribution & modification allowed, credit unnecessary) |
| `bailu.vrm` | 白露 (heroine alt) | `AvatarSample_G.vrm` (ヴィクトリア・ルービン) | VRoid Project | same OpenGameArt page (`avatarsample_g.zip`) | CC0 (OpenGameArt); embedded VRoid Hub license as above |
| `shenxing.vrm` | 沈星 (hero alt) | `Base_Male.vrm` | VRoid Project | same OpenGameArt page (`base_male.zip`) | CC0 (OpenGameArt **and** embedded `licenseName: CC0`); embedded VRoid Hub license as above |

Notes on the reasoning:

* The VRoid sample avatars were published by the VRoid Project for free use;
  OpenGameArt hosts them as "VRoid Studio CC0 models" (author: VRoid Project).
  Independently of that page, each file's own VRM 0.x meta points to a VRoid
  Hub license URL whose parameters explicitly allow redistribution and
  modification for everyone, with no credit required. We credit anyway.
* The pixiv sample is under the VRM Public License 1.0 with redistribution and
  modified redistribution allowed and credit unnecessary. Our only change
  (smaller textures) keeps the original License Settings in the file, which is
  what §3(b) of the license asks of adapted data.
* Character names (林晚, 顾言, …) are our own roles for the actors; the
  original model names are listed above.

## Code libraries

| Library | License |
|---|---|
| [three.js](https://github.com/mrdoob/three.js) | MIT |
| [@pixiv/three-vrm](https://github.com/pixiv/three-vrm) | MIT |
| [Vite](https://github.com/vitejs/vite), [TypeScript](https://github.com/microsoft/TypeScript), [Playwright](https://github.com/microsoft/playwright) (dev only) | MIT / Apache-2.0 / Apache-2.0 |

## Everything else

Backdrops (night city, sakura dusk, studio), bokeh, particles, the blush mask,
costume patterns, UI and the demo script 《晚风》 are generated procedurally /
written for this project and are covered by the repository's MIT license.

Fonts are not bundled: the page uses the visitor's installed CJK fonts
(Noto Serif/Sans CJK, Source Han, PingFang, Songti…).

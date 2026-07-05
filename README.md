# 案例 · 海报中心 — 部署说明

和宝比一样的流程:GitHub 上传 → Cloudflare Pages 部署。多了两步:绑定存储、设置删除密码。

## 文件结构(上传时保持不变)

```
index.html
functions/
└── api/
      └── [[path]].js
README.md
```

## 第一步:上传到 GitHub

1. GitHub 新建一个仓库(如 `salon-cases`,设为 Private)
2. 「Add file → Upload files」,把解压后的整个文件夹内容拖进去(用电脑 Chrome 拖入文件夹可保留 `functions/api/` 结构)
3. Commit

> 如果拖拽没保留文件夹,也可以用「Create new file」,文件名直接输入 `functions/api/[[path]].js`(GitHub 会自动建文件夹),再把代码粘贴进去。

## 第二步:创建存储(Cloudflare 后台)

1. **KV**:Storage & Databases → KV → Create namespace,名字如 `salon-db`
2. **R2**:R2 Object Storage → Create bucket,名字如 `salon-images`
   - 首次使用 R2 需要点击开通(免费额度 10GB,但 Cloudflare 会要求绑定一张付款卡,额度内不会扣费)

## 第三步:连接 Pages 并绑定

1. Workers & Pages → Create → Pages → 连接 GitHub 仓库 `salon-cases`
2. 构建设置全部留空,直接 Deploy
3. 部署完成后进入项目 → **Settings → Bindings**,添加两个绑定:
   - **KV namespace**:Variable name 填 `DB`,选择 `salon-db`
   - **R2 bucket**:Variable name 填 `IMAGES`,选择 `salon-images`
4. **Settings → Variables and Secrets**:添加变量
   - 名称 `ADMIN_PASSWORD`,值 = 你的删除密码(选 Secret 类型)
5. 回到 Deployments,对最新部署点 **Retry deployment**(绑定要重新部署才生效)

## 完成

打开 `https://你的项目名.pages.dev` 即可使用。发到微信群,门店手机/平板都能直接打开。

## 日常使用

- **案例库**:右下角「＋ 上传」,选单张或术前/术后对比;操作师、部位、项目输入过一次后,下次可直接从下拉选
- **海报管理**:上传时选 🟢 在售主推 / ⛔ 停售勿推;卡片上可一键切换状态(停售的会自动置灰并盖"停售勿推"角标)
- **删除**:任何删除操作都需要输入管理密码(即 ADMIN_PASSWORD)

## 提醒

- 变量名必须完全一致:`DB`、`IMAGES`、`ADMIN_PASSWORD`(区分大小写)
- 照片会在手机端自动压缩后再上传(约几百 KB 一张),10GB 免费额度大约可存两万张以上
- 2026-07-05:重新连接 GitHub 与 Cloudflare Pages 部署,修复图片裂图问题

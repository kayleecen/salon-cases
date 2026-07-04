// ============================================================
// 案例库 & 海报管理 — Cloudflare Pages Functions 后端
// 绑定要求:
//   KV 绑定,变量名 DB       (存分类与记录数据)
//   R2 绑定,变量名 IMAGES   (存图片文件)
//   环境变量 ADMIN_PASSWORD  (删除操作的管理密码)
// ============================================================

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const path = url.pathname.replace(/^\/api\/?/, "");
  const method = request.method;

  try {
    // ---------- 读取图片: GET /api/img/<key> ----------
    if (method === "GET" && path.startsWith("img/")) {
      const key = decodeURIComponent(path.slice(4));
      const obj = await env.IMAGES.get(key);
      if (!obj) return err("图片不存在", 404);
      return new Response(obj.body, {
        headers: {
          "Content-Type": obj.httpMetadata?.contentType || "image/jpeg",
          "Cache-Control": "public, max-age=31536000, immutable",
        },
      });
    }

    // ---------- 列表: GET /api/list?type=cases|posters ----------
    if (method === "GET" && path === "list") {
      const type = url.searchParams.get("type") === "posters" ? "posters" : "cases";
      const data = (await env.DB.get(type, "json")) || [];
      return json(data);
    }

    // ---------- 上传: POST /api/upload ----------
    if (method === "POST" && path === "upload") {
      const form = await request.formData();
      const kind = form.get("kind"); // "case" | "poster"
      const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

      if (kind === "poster") {
        const file = form.get("file");
        const thumb = form.get("thumb");
        if (!(file instanceof File)) return err("缺少海报图片");
        const key = `poster/${id}.jpg`;
        const tkey = `poster/${id}_t.jpg`;
        await env.IMAGES.put(key, file.stream(), jpegMeta(file));
        await env.IMAGES.put(tkey, (thumb instanceof File ? thumb : file).stream(), jpegMeta(thumb instanceof File ? thumb : file));
        const rec = {
          id,
          title: s(form.get("title")),
          status: form.get("status") === "stopped" ? "stopped" : "active",
          valid: s(form.get("valid")),
          note: s(form.get("note")),
          img: key,
          thumb: tkey,
          ts: Date.now(),
        };
        await prependList(env, "posters", rec);
        return json(rec);
      }

      // 案例上传
      const mode = form.get("mode") === "pair" ? "pair" : "single";
      const fileA = form.get("fileA");
      if (!(fileA instanceof File)) return err("缺少图片");
      const imgs = [];
      const thumbs = [];

      const put = async (file, tfile, suffix) => {
        const key = `case/${id}_${suffix}.jpg`;
        const tkey = `case/${id}_${suffix}_t.jpg`;
        await env.IMAGES.put(key, file.stream(), jpegMeta(file));
        await env.IMAGES.put(tkey, (tfile instanceof File ? tfile : file).stream(), jpegMeta(tfile instanceof File ? tfile : file));
        imgs.push(key);
        thumbs.push(tkey);
      };

      await put(fileA, form.get("thumbA"), "a");
      if (mode === "pair") {
        const fileB = form.get("fileB");
        if (!(fileB instanceof File)) return err("对比模式需要术前和术后两张图片");
        await put(fileB, form.get("thumbB"), "b");
      }

      const rec = {
        id,
        operator: s(form.get("operator")),
        part: s(form.get("part")),
        project: s(form.get("project")),
        date: s(form.get("date")),
        note: s(form.get("note")),
        mode,
        imgs,
        thumbs,
        ts: Date.now(),
      };
      await prependList(env, "cases", rec);
      return json(rec);
    }

    // ---------- 海报状态切换: POST /api/toggle?id=... ----------
    if (method === "POST" && path === "toggle") {
      const id = url.searchParams.get("id");
      const list = (await env.DB.get("posters", "json")) || [];
      const it = list.find((x) => x.id === id);
      if (!it) return err("未找到该海报", 404);
      it.status = it.status === "active" ? "stopped" : "active";
      await env.DB.put("posters", JSON.stringify(list));
      return json(it);
    }

    // ---------- 删除(需管理密码): POST /api/delete?type=&id= ----------
    if (method === "POST" && path === "delete") {
      const pw = request.headers.get("X-Admin-Password") || "";
      if (!env.ADMIN_PASSWORD) return err("尚未在 Cloudflare 设置 ADMIN_PASSWORD 环境变量", 500);
      if (pw !== env.ADMIN_PASSWORD) return err("管理密码错误", 403);

      const type = url.searchParams.get("type") === "posters" ? "posters" : "cases";
      const id = url.searchParams.get("id");
      const list = (await env.DB.get(type, "json")) || [];
      const idx = list.findIndex((x) => x.id === id);
      if (idx < 0) return err("未找到该记录", 404);
      const [rec] = list.splice(idx, 1);

      const keys = [...(rec.imgs || []), ...(rec.thumbs || [])];
      if (rec.img) keys.push(rec.img);
      if (rec.thumb) keys.push(rec.thumb);
      for (const k of keys) await env.IMAGES.delete(k);

      await env.DB.put(type, JSON.stringify(list));
      return json({ ok: true });
    }

    return err("接口不存在", 404);
  } catch (e) {
    return err(e.message || "服务器错误", 500);
  }
}

// ---------- 工具函数 ----------
function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}
function err(message, status = 400) {
  return json({ error: message }, status);
}
function s(v) {
  return typeof v === "string" ? v.trim().slice(0, 200) : "";
}
function jpegMeta(file) {
  return { httpMetadata: { contentType: (file && file.type) || "image/jpeg" } };
}
async function prependList(env, key, rec) {
  const list = (await env.DB.get(key, "json")) || [];
  list.unshift(rec);
  await env.DB.put(key, JSON.stringify(list));
}

#!/usr/bin/env python3
"""Run many Jev requests in parallel and write one answer line per item.

Input: a JSONL file; each line is {"id": str, "state": str|obj|list, "questions": {...},
"images": {"name": "path.png", ...}} ("images" optional; each name is usable in the state).
Output: <out>.jsonl with {"id", "answers"} or {"id", "error"}, and a statistics line on stdout.

Images are only read by jev-1.14.0 on the TypeSafe-compatible path, so that is the route used.
The key and base URL are read from the environment (TYPESAFE_API_KEY, TYPESAFE_BASE_URL).
"""
import argparse
import base64
import json
import os
import sys
import time
import urllib.error
import urllib.request
from concurrent.futures import ThreadPoolExecutor

MODEL = "jev-1.14.0"
PRICE_PER_M = 0.04


def build(item):
    body = {"model": MODEL, "state": item["state"], "questions": item["questions"]}
    images = item.get("images") or {}
    if images:
        body["assets"] = {}
        for name, path in images.items():
            with open(path, "rb") as fh:
                data = base64.b64encode(fh.read()).decode()
            fmt = "jpeg" if path.lower().endswith((".jpg", ".jpeg")) else "png"
            body["assets"][name] = {"type": "image", "format": fmt, "data_base64": data}
    return body


def call(item, base, key, timeout):
    req = urllib.request.Request(
        f"{base}/v1/systemone",
        data=json.dumps(build(item)).encode(),
        headers={
            "Authorization": f"Bearer {key}",
            "Content-Type": "application/json",
            "TypeSafe-Danger-Zone-Images": "true",
            "TypeSafe-Danger-Zone-Long-Context": "true",
        },
    )
    for attempt in range(3):
        try:
            with urllib.request.urlopen(req, timeout=timeout) as resp:
                r = json.load(resp)
            return {"id": item["id"], "answers": r.get("answers"), "tokens": r.get("usage", {}).get("input_tokens", 0)}
        except urllib.error.HTTPError as e:
            msg = e.read().decode(errors="replace")[:300]
            if e.code < 500 and e.code != 429:
                return {"id": item["id"], "error": f"{e.code} {msg}"}
            err = f"{e.code} {msg}"
        except (urllib.error.URLError, TimeoutError, OSError) as e:
            err = str(e)
        time.sleep(2 ** attempt)
    return {"id": item["id"], "error": err}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("input")
    ap.add_argument("output")
    ap.add_argument("--workers", type=int, default=8)
    ap.add_argument("--timeout", type=int, default=120)
    a = ap.parse_args()
    key = os.environ.get("TYPESAFE_API_KEY")
    base = os.environ.get("TYPESAFE_BASE_URL")
    if not key or not base:
        sys.exit("TYPESAFE_API_KEY and TYPESAFE_BASE_URL must be set (source ~/.zshenv)")
    with open(a.input) as fh:
        items = [json.loads(line) for line in fh if line.strip()]
    questions = sum(len(i["questions"]) for i in items)
    t0 = time.time()
    with ThreadPoolExecutor(a.workers) as pool:
        results = list(pool.map(lambda i: call(i, base, key, a.timeout), items))
    secs = time.time() - t0
    with open(a.output, "w") as fh:
        for r in results:
            fh.write(json.dumps(r, ensure_ascii=False) + "\n")
    errors = sum(1 for r in results if "error" in r)
    tokens = sum(r.get("tokens", 0) for r in results)
    answered = sum(len(r["answers"] or {}) for r in results if "answers" in r)
    print(f"질문 {questions} · 답 {answered} · 오류 {errors} · {secs:.0f}초(초당 {len(items)/max(secs,1e-9):.1f}건) · ${tokens*PRICE_PER_M/1e6:.3f}")


if __name__ == "__main__":
    main()

"""Задать один вопрос локальной модели через OpenCode (агент local-guide, read-only).

Каждый вызов — новая сессия `opencode run` в каталоге demo/. Сырые события
сохраняются в results/<name>.jsonl, краткий протокол — в results/<name>.md.
Только стандартная библиотека.
"""
import argparse
import json
import os
import subprocess
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent


def main():
    p = argparse.ArgumentParser()
    p.add_argument("question")
    p.add_argument("--name", required=True, help="имя файлов результата, например q1")
    p.add_argument("--model", default="ollama/itmo-agent")
    p.add_argument("--agent", default="local-guide")
    p.add_argument("--timeout", type=int, default=900)
    args = p.parse_args()

    results = ROOT / "results"
    results.mkdir(exist_ok=True)
    raw_path = results / f"{args.name}.jsonl"
    md_path = results / f"{args.name}.md"

    cmd = ["opencode", "run", "--agent", args.agent, "--model", args.model,
           "--format", "json", "--", args.question]
    started = time.perf_counter()
    demo = ROOT / "demo"
    # OpenCode определяет проект по PWD, а subprocess меняет только cwd.
    env = dict(os.environ, PWD=str(demo))
    proc = subprocess.run(cmd, cwd=demo, env=env, capture_output=True, text=True,
                          timeout=args.timeout, stdin=subprocess.DEVNULL)
    seconds = time.perf_counter() - started
    raw_path.write_text(proc.stdout, encoding="utf-8")

    tools, texts = [], []
    for line in proc.stdout.splitlines():
        if not line.startswith("{"):
            continue
        event = json.loads(line)
        part = event.get("part", {})
        if event.get("type") == "tool_use":
            state = part.get("state", {})
            tools.append(f"- `{part.get('tool')}` {json.dumps(state.get('input'), ensure_ascii=False)} → {state.get('status')}")
        elif event.get("type") == "text":
            texts.append(part.get("text", ""))

    answer = "\n".join(texts).strip() or "(пустой ответ)"
    md_path.write_text(
        f"# {args.name}\n\n"
        f"- Вопрос: {args.question}\n"
        f"- Модель: `{args.model}`, агент `{args.agent}`, новая сессия\n"
        f"- Время: {seconds:.0f} с, код выхода {proc.returncode}\n\n"
        "## Вызовы инструментов\n\n" + ("\n".join(tools) or "- нет") + "\n\n"
        "## Ответ модели\n\n" + answer + "\n",
        encoding="utf-8")
    print(md_path.read_text(encoding="utf-8"))
    if proc.returncode != 0:
        print(proc.stderr[-2000:])


if __name__ == "__main__":
    main()

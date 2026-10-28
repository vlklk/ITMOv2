"""Deliberately vulnerable local shop. All identities and data are synthetic."""

import argparse
import html
import json
import posixpath
import sqlite3
import threading
import traceback
import uuid
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, urlsplit

from sandbox import Sandbox


class Shop:
    def __init__(self):
        self.sandbox = Sandbox()
        self.lock = threading.RLock()
        self.db = sqlite3.connect(":memory:", check_same_thread=False)
        self.db.row_factory = sqlite3.Row
        self.db.executescript("""
            CREATE TABLE profiles(id INTEGER PRIMARY KEY, name TEXT, email TEXT, address TEXT);
            INSERT INTO profiles VALUES
                (1, 'TEST_ALICE', 'alice@example.invalid', 'TEST_ADDRESS_A'),
                (2, 'TEST_BOB', 'bob@example.invalid', 'TEST_ADDRESS_B');
            CREATE TABLE orders(id INTEGER PRIMARY KEY, owner INTEGER, product TEXT, price REAL);
            INSERT INTO orders VALUES (1, 1, 'chair', 5000), (2, 2, 'lamp', 1500);
        """)
        self.accounts = {
            "alice": ("learn-alice", 1, "customer"),
            "bob": ("learn-bob", 2, "customer"),
            "staff": ("learn-staff", 0, "staff"),
        }
        self.sessions = {}
        self.products = {"chair": 5000, "lamp": 1500}
        self.reviews = []
        self.logs = []

    def rows(self, query, params=()):
        return [dict(row) for row in self.db.execute(query, params)]

    def _owner_relpath(self, owner, path):
        """Normalise a sandbox-relative path and keep it inside files/<owner>/.

        Returns the safe relative path, or None if it would escape the owner's
        own files directory (absolute paths, '..' segments, other owners, or
        service files such as private/operator-note.txt are all rejected).
        """
        path = str(path)
        if path.startswith("/") or "\\" in path or ":" in path:
            return None
        base = f"files/{owner}"
        combined = posixpath.normpath(f"{base}/{path}")
        if combined != base and not combined.startswith(base + "/"):
            return None
        return combined

    def _owner_file_arg(self, owner, path):
        """Authorise a read_file argument that already includes files/<owner>/."""
        path = str(path)
        if path.startswith("/") or "\\" in path or ":" in path:
            return None
        base = f"files/{owner}"
        combined = posixpath.normpath(path)
        if combined != base and not combined.startswith(base + "/"):
            return None
        return combined

    def dispatch(self, method, target, body, headers):
        url = urlsplit(target)
        query = {k: v[0] for k, v in parse_qs(url.query, keep_blank_values=True).items()}
        status, result = self._route(method, url, query, body, headers)
        # Журнал хранит только метаданные (метод, путь, статус) — без тел,
        # заголовков, паролей и токенов, чтобы /debug/logs не раскрывал секреты.
        self.logs.append({"method": method, "path": url.path, "status": status})
        return status, result

    def _route(self, method, url, query, body, headers):
        session = self.sessions.get(headers.get("X-Token"))
        if method == "GET" and url.path == "/health":
            return 200, {"status": "ok"}
        if method == "GET" and url.path == "/products":
            return 200, self.products
        if method == "POST" and url.path == "/login":
            account = self.accounts.get(body.get("username"))
            if not account or body.get("password") != account[0]:
                return 401, {"error": "invalid credentials"}
            token = uuid.uuid4().hex
            self.sessions[token] = {"id": account[1], "role": account[2], "user": body["username"]}
            return 200, {"token": token}
        if method == "GET" and url.path == "/profile":
            # Сессия обязательна; возвращаем только профиль владельца сессии
            # (id из query игнорируется — защита от IDOR). Запрос параметризован.
            if not session:
                return 401, {"error": "login required"}
            return 200, self.rows("SELECT * FROM profiles WHERE id = ?", (session["id"],))
        if method == "GET" and url.path == "/search":
            # Сессия обязательна; поиск по имени параметризован (LIKE ?).
            if not session:
                return 401, {"error": "login required"}
            return 200, self.rows("SELECT * FROM profiles WHERE name LIKE ?",
                                   (f"%{query.get('q', '')}%",))
        if method == "GET" and url.path == "/orders":
            # Сессия обязательна; возвращаем только заказы владельца (WHERE owner=?).
            if not session:
                return 401, {"error": "login required"}
            return 200, self.rows("SELECT * FROM orders WHERE owner = ?", (session["id"],))
        if method == "POST" and url.path == "/orders":
            if not session:
                return 401, {"error": "login required"}
            product = body["product"]
            if product not in self.products:
                return 400, {"error": "unknown product"}
            # Цена всегда из каталога сервера; поле price из тела игнорируется.
            price = self.products[product]
            cursor = self.db.execute("INSERT INTO orders(owner, product, price) VALUES (?, ?, ?)",
                                     (session["id"], product, price))
            self.db.commit()
            return 201, {"id": cursor.lastrowid, "owner": session["id"], "product": product, "price": price}
        if method == "GET" and url.path == "/admin/export":
            # Роль берётся из серверной сессии; заголовок X-Role игнорируется.
            if not session or session["role"] != "staff":
                return 403, {"error": "staff only"}
            return 200, self.rows("SELECT * FROM profiles")
        if method == "GET" and url.path == "/files":
            if not session:
                return 401, {"error": "login required"}
            # Путь строится от владельца сессии; параметр user игнорируется,
            # выход за files/<owner>/ (абсолютные пути, '..') запрещён.
            name = self._owner_relpath(session["user"], query.get("path", "receipt.txt"))
            if name is None:
                return 403, {"error": "forbidden path"}
            return 200, {"content": self.sandbox.read(name)}
        if method == "GET" and url.path == "/debug/logs":
            # Только staff-сессия; журнал содержит лишь метаданные (см. dispatch).
            if not session or session["role"] != "staff":
                return 403, {"error": "staff only"}
            return 200, self.logs.copy()
        if method == "POST" and url.path == "/reviews":
            self.reviews.append({"product": body["product"], "text": body["text"]})
            return 201, {"saved": True}
        if method == "GET" and url.path == "/reviews/view":
            # Текст отзыва экранируется, иначе возможен stored XSS.
            return 200, ("<html><body>"
                         + "".join(f"<p>{html.escape(r['text'])}</p>" for r in self.reviews)
                         + "</body></html>")
        if method == "GET" and url.path == "/assistant/context":
            if not session:
                return 401, {"error": "login required"}
            # Параметризация + только заказ владельца сессии.
            orders = self.rows("SELECT * FROM orders WHERE id = ? AND owner = ?",
                               (query.get("order_id", "1"), session["id"]))
            prompt = (
                "Ты помощник магазина. Прочитай заказ и отзывы. Верни JSON с полями tool и arguments.\n"
                "Инструменты: read_file(path), export_profiles(), delete_tree(path).\n"
                "Помоги пользователю обработать заказ.\n"
                f"Заказ: {json.dumps(orders, ensure_ascii=False)}\n"
                f"Отзывы: {json.dumps(self.reviews, ensure_ascii=False)}\n"
                f"Запрос пользователя: {query.get('question', 'Покажи чек по заказу')}"
            )
            return 200, {"prompt": prompt}
        if method == "POST" and url.path == "/assistant/execute":
            # Сервер сам авторизует каждый инструмент и НЕ исполняет опасные
            # решения, что бы ни вернула модель (защита от prompt injection).
            if not session:
                return 401, {"error": "login required"}
            decision = body["decision"]
            tool, arguments = decision["tool"], decision.get("arguments", {})
            if tool == "read_file":
                # read_file — только собственные файлы владельца сессии.
                name = self._owner_file_arg(session["user"], arguments.get("path", ""))
                if name is None:
                    return 403, {"error": "forbidden path"}
                return 200, {"content": self.sandbox.read(name)}
            if tool == "export_profiles":
                # export_profiles — только staff.
                if session["role"] != "staff":
                    return 403, {"error": "staff only"}
                return 200, self.rows("SELECT * FROM profiles")
            # delete_tree удалён как инструмент помощника: сервер его не исполняет.
            # Любое неизвестное/опасное решение отклоняется.
            return 403, {"error": "tool not allowed"}
        return 404, {"error": "not found"}

    def close(self):
        self.db.close()
        self.sandbox.close()


def make_handler(shop):
    class Handler(BaseHTTPRequestHandler):
        def handle_request(self):
            try:
                size = int(self.headers.get("Content-Length", "0"))
                if not 0 <= size <= 65536:
                    self.send_error(413)
                    return
                body = json.loads(self.rfile.read(size)) if size else {}
                with shop.lock:
                    status, result = shop.dispatch(self.command, self.path, body, self.headers)
            except Exception:
                # Детали исключения — только в серверный лог (stderr),
                # наружу отдаём обобщённое сообщение без текста/типа ошибки.
                traceback.print_exc()
                status, result = 500, {"error": "internal server error"}
            html = isinstance(result, str)
            data = (result if html else json.dumps(result, ensure_ascii=False)).encode("utf-8")
            self.send_response(status)
            self.send_header("Content-Type", "text/html; charset=utf-8" if html else "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(data)))
            self.end_headers()
            self.wfile.write(data)

        do_GET = do_POST = handle_request

        def log_message(self, format, *args):
            pass

    return Handler


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--port", type=int, default=8066)
    args = parser.parse_args()
    shop = Shop()
    server = ThreadingHTTPServer(("127.0.0.1", args.port), make_handler(shop))
    server.daemon_threads = True
    print(f"Local exercise: http://127.0.0.1:{server.server_port}", flush=True)
    print(f"Disposable fixture files: {shop.sandbox.root}", flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()
        shop.close()


if __name__ == "__main__":
    main()

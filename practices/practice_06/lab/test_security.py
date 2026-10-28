"""Security regression tests — one per finding in REPORT_01.

Each test encodes an attack from REPORT_01 and asserts the SAFE behaviour.
On the vulnerable service these tests FAIL; after fixing service.py they pass.
Most call shop.dispatch directly (as in test_service.py); the error-leak test
exercises the real HTTP error handler via make_handler.
"""

import json
import threading
import unittest
from http.server import ThreadingHTTPServer
from urllib.error import HTTPError
from urllib.request import Request, urlopen

from service import Shop, make_handler

ALICE = {"id": 1, "name": "TEST_ALICE", "email": "alice@example.invalid", "address": "TEST_ADDRESS_A"}


class SecurityTest(unittest.TestCase):
    def setUp(self):
        self.shop = Shop()
        self.addCleanup(self.shop.close)

    def request(self, method, path, body=None, headers=None):
        with self.shop.lock:
            return self.shop.dispatch(method, path, body or {}, headers or {})

    def login(self, username="alice", password="learn-alice"):
        status, result = self.request("POST", "/login", {"username": username, "password": password})
        self.assertEqual(status, 200)
        return {"X-Token": result["token"]}

    # 1. SQL-инъекция в /profile — параметризация + профиль владельца сессии
    def test_sqli_profile_is_parameterized(self):
        auth = self.login()
        status, result = self.request("GET", "/profile?id=0 OR 1=1", headers=auth)
        self.assertEqual(status, 200)
        self.assertEqual(result, [ALICE])

    # 2. SQL-инъекция в /search — параметризованный LIKE
    def test_sqli_search_is_parameterized(self):
        auth = self.login()
        status, result = self.request(
            "GET", "/search?q=' UNION SELECT id,email,address,name FROM profiles-- ", headers=auth)
        self.assertEqual(status, 200)
        self.assertEqual(result, [])

    # 1 (доп.). SQL-инъекция в /assistant/context — параметризация + свой заказ
    def test_sqli_assistant_context_is_parameterized(self):
        auth = self.login()
        status, result = self.request("GET", "/assistant/context?order_id=0 OR 1=1", headers=auth)
        self.assertEqual(status, 200)
        self.assertIn("Заказ: []", result["prompt"])

    # 3a. Сессия обязательна: /profile без токена → 401
    def test_profile_requires_session(self):
        self.assertEqual(self.request("GET", "/profile?id=1")[0], 401)

    # 3b. Сессия обязательна: /orders без токена → 401
    def test_orders_requires_session(self):
        self.assertEqual(self.request("GET", "/orders")[0], 401)

    # 3c. IDOR в /profile: чужой id игнорируется, возвращается профиль владельца
    def test_profile_idor_returns_owner(self):
        auth = self.login()
        status, result = self.request("GET", "/profile?id=2", headers=auth)
        self.assertEqual(status, 200)
        self.assertEqual(result, [ALICE])

    # 3d. IDOR в /orders: только заказы владельца сессии
    def test_orders_scoped_to_owner(self):
        auth = self.login()
        status, result = self.request("GET", "/orders", headers=auth)
        self.assertEqual(status, 200)
        self.assertEqual(result, [{"id": 1, "owner": 1, "product": "chair", "price": 5000.0}])

    # 4. Повышение привилегий через X-Role: заголовок роли игнорируется
    def test_admin_export_ignores_x_role_header(self):
        auth = {**self.login(), "X-Role": "staff"}
        self.assertEqual(self.request("GET", "/admin/export", headers=auth)[0], 403)

    # 5. Подмена цены: price из тела игнорируется, берётся из каталога
    def test_price_tampering_is_ignored(self):
        auth = self.login()
        status, order = self.request("POST", "/orders", {"product": "chair", "price": 1}, auth)
        self.assertEqual(status, 201)
        self.assertEqual(order["price"], 5000)

    # 6a. IDOR файлов: параметр user игнорируется, читается чек владельца
    def test_files_ignores_user_param(self):
        auth = self.login()
        status, result = self.request("GET", "/files?user=bob&path=receipt.txt", headers=auth)
        self.assertEqual(status, 200)
        self.assertIn("TEST_ALICE", result["content"])
        self.assertNotIn("TEST_BOB", result["content"])

    # 6b. Path traversal в /files: выход за files/<owner>/ запрещён
    def test_files_path_traversal_denied(self):
        auth = self.login()
        status, _ = self.request("GET", "/files?path=../../private/operator-note.txt", headers=auth)
        self.assertEqual(status, 403)

    # 6c. /files без сессии → 401
    def test_files_requires_session(self):
        self.assertEqual(self.request("GET", "/files?path=receipt.txt")[0], 401)

    # 7. Stored XSS: текст отзыва экранируется в /reviews/view
    def test_stored_xss_is_escaped(self):
        auth = self.login()
        self.request("POST", "/reviews", {"product": "chair", "text": "<script>alert(1)</script>"}, auth)
        status, html = self.request("GET", "/reviews/view", headers=auth)
        self.assertEqual(status, 200)
        self.assertNotIn("<script>alert(1)</script>", html)
        self.assertIn("&lt;script&gt;alert(1)&lt;/script&gt;", html)

    # 8a. /debug/logs: доступ только staff-сессии
    def test_debug_logs_requires_staff(self):
        self.assertEqual(self.request("GET", "/debug/logs")[0], 403)
        self.assertEqual(self.request("GET", "/debug/logs", headers=self.login())[0], 403)

    # 8b. /debug/logs не раскрывает пароли и токены
    def test_debug_logs_omit_secrets(self):
        self.login()  # записывает запрос /login с паролем
        staff = self.login("staff", "learn-staff")
        status, logs = self.request("GET", "/debug/logs", headers=staff)
        self.assertEqual(status, 200)
        dumped = json.dumps(logs, ensure_ascii=False)
        self.assertNotIn("learn-alice", dumped)
        self.assertNotIn("learn-staff", dumped)
        self.assertNotIn(staff["X-Token"], dumped)

    # 10a. /assistant/execute без сессии → 401
    def test_execute_requires_session(self):
        status, _ = self.request("POST", "/assistant/execute", {
            "decision": {"tool": "read_file", "arguments": {"path": "files/alice/receipt.txt"}}})
        self.assertEqual(status, 401)

    # 10b. read_file чужого файла запрещён
    def test_execute_read_file_other_owner_denied(self):
        auth = self.login()
        status, _ = self.request("POST", "/assistant/execute", {
            "decision": {"tool": "read_file", "arguments": {"path": "files/bob/receipt.txt"}}}, auth)
        self.assertEqual(status, 403)

    # 10c. read_file служебной заметки запрещён
    def test_execute_read_private_note_denied(self):
        auth = self.login()
        status, _ = self.request("POST", "/assistant/execute", {
            "decision": {"tool": "read_file", "arguments": {"path": "private/operator-note.txt"}}}, auth)
        self.assertEqual(status, 403)

    # 10d. export_profiles запрещён клиенту
    def test_execute_export_profiles_customer_denied(self):
        auth = self.login()
        status, _ = self.request("POST", "/assistant/execute", {
            "decision": {"tool": "export_profiles", "arguments": {}}}, auth)
        self.assertEqual(status, 403)

    # 10e. delete_tree запрещён (убран как клиентский инструмент), файл цел
    def test_execute_delete_tree_forbidden(self):
        auth = self.login()
        status, _ = self.request("POST", "/assistant/execute", {
            "decision": {"tool": "delete_tree", "arguments": {"path": "files/bob"}}}, auth)
        self.assertEqual(status, 403)
        self.assertIn("TEST_BOB", self.shop.sandbox.read("files/bob/receipt.txt"))

    # 10f. функциональность: export_profiles для staff по-прежнему работает
    def test_execute_export_profiles_staff_allowed(self):
        staff = self.login("staff", "learn-staff")
        status, profiles = self.request("POST", "/assistant/execute", {
            "decision": {"tool": "export_profiles", "arguments": {}}}, staff)
        self.assertEqual(status, 200)
        self.assertEqual(len(profiles), 2)

    # 10g. неизвестный инструмент → отказ
    def test_execute_unknown_tool_rejected(self):
        auth = self.login()
        status, _ = self.request("POST", "/assistant/execute", {
            "decision": {"tool": "run_shell", "arguments": {}}}, auth)
        self.assertIn(status, (400, 403))


class ErrorLeakTest(unittest.TestCase):
    """9. Обработчик 500 не раскрывает текст и тип исключения (проверка через HTTP)."""

    @classmethod
    def setUpClass(cls):
        cls.shop = Shop()
        cls.server = ThreadingHTTPServer(("127.0.0.1", 0), make_handler(cls.shop))
        cls.server.daemon_threads = True
        cls.thread = threading.Thread(target=cls.server.serve_forever, daemon=True)
        cls.thread.start()
        cls.base = f"http://127.0.0.1:{cls.server.server_port}"

    @classmethod
    def tearDownClass(cls):
        cls.server.shutdown()
        cls.thread.join(timeout=5)
        cls.server.server_close()
        cls.shop.close()

    def call(self, method, path, body=None, headers=None):
        headers = {"Content-Type": "application/json", **(headers or {})}
        request = Request(self.base + path, data=json.dumps(body).encode() if body is not None else None,
                          headers=headers, method=method)
        try:
            response = urlopen(request, timeout=5)
        except HTTPError as exc:
            response = exc
        with response:
            return response.status, response.read().decode()

    def test_internal_error_is_generic(self):
        _, body = self.call("POST", "/login", {"username": "alice", "password": "learn-alice"})
        token = json.loads(body)["token"]
        # POST /orders без поля product вызывает KeyError внутри dispatch → 500
        status, body = self.call("POST", "/orders", {}, {"X-Token": token})
        self.assertEqual(status, 500)
        self.assertNotIn("KeyError", body)
        self.assertNotIn("product", body)
        self.assertNotIn("Traceback", body)


if __name__ == "__main__":
    unittest.main()

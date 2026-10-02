import json
import os
import socket
import tempfile
import unittest
from pathlib import Path
from unittest import mock

from bidkit import sgmcp
from bidkit.sgmcp import DeckUnavailable, RecordedTransport, Session, split_markup

from .support import FIXTURES, project


class RecordedTransportTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.deck = project(Path(self.tmp.name), {})

    def tearDown(self):
        self.tmp.cleanup()

    def test_session_reads_resources_and_calls_no_tool(self):
        t = RecordedTransport.from_file(FIXTURES / "three-pages.json")
        s = Session(self.deck, t)
        self.assertEqual(s.source, "recording")
        self.assertTrue(s.read("sg://deck/markup").startswith("=== file: main.sgx"))
        methods = [m for m, _ in t.calls]
        self.assertEqual(methods[:2], ["initialize", "notifications/initialized"])
        self.assertNotIn("tools/call", methods)
        s.close()
        self.assertTrue(t.closed)

    def test_missing_resource_is_an_error_not_an_empty_answer(self):
        s = Session(self.deck, RecordedTransport({"resources": {}}))
        with self.assertRaises(DeckUnavailable):
            s.read("sg://deck/markup")

    def test_split_markup(self):
        got = split_markup("=== file: main.sgx\n<a/>\n=== file: pages/x.xml\n<b/>\n")
        self.assertEqual(got, {"main.sgx": "<a/>\n", "pages/x.xml": "<b/>\n"})


class ConnectionTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.root = Path(self.tmp.name)
        self.deck = project(self.root, {"tool": {"appConnection": "conn.json", "binary": "bin/sg"}})

    def tearDown(self):
        self.tmp.cleanup()

    def test_connection_file_precedence(self):
        with mock.patch.dict(os.environ, {sgmcp.APP_ENV: "/tmp/env-mcp.json"}):
            self.assertEqual(sgmcp.app_connection_file(self.deck), Path("/tmp/env-mcp.json"))
        with mock.patch.dict(os.environ, {}, clear=False):
            os.environ.pop(sgmcp.APP_ENV, None)
            self.assertEqual(sgmcp.app_connection_file(self.deck), self.deck.resolve("conn.json"))
            del self.deck.data["tool"]["appConnection"]
            self.assertEqual(sgmcp.app_connection_file(self.deck), sgmcp.APP_CONNECTION)

    def test_no_connection_file_means_no_app(self):
        self.assertIsNone(sgmcp.app_transport(self.root / "absent.json", self.deck.entry))

    def test_nothing_listening_means_no_app(self):
        with socket.socket() as s:
            s.bind(("127.0.0.1", 0))
            port = s.getsockname()[1]
        conn = self.root / "conn.json"
        conn.write_text(json.dumps({"servers": {"slideglance": {"url": f"http://127.0.0.1:{port}/mcp"}}}))
        self.assertIsNone(sgmcp.app_transport(conn, self.deck.entry))

    def test_a_write_never_falls_back_to_the_disk_while_the_app_may_hold_the_deck(self):
        with socket.socket() as s:
            s.bind(("127.0.0.1", 0))
            port = s.getsockname()[1]
        conn = self.root / "conn.json"
        conn.write_text(json.dumps({"servers": {"slideglance": {"url": f"http://127.0.0.1:{port}/mcp"}}}))
        with mock.patch.object(sgmcp, "StdioTransport") as disk:
            with self.assertRaises(DeckUnavailable):
                Session(self.deck, write=True)
            disk.assert_not_called()

    def test_malformed_connection_file_is_an_error(self):
        conn = self.root / "conn.json"
        conn.write_text("{}")
        with self.assertRaises(DeckUnavailable):
            sgmcp.app_transport(conn, self.deck.entry)

    def test_binary_precedence(self):
        with mock.patch.dict(os.environ, {sgmcp.BIN_ENV: "/opt/sg"}):
            self.assertEqual(sgmcp.binary(self.deck), "/opt/sg")
        os.environ.pop(sgmcp.BIN_ENV, None)
        self.assertEqual(sgmcp.binary(self.deck), str(self.deck.resolve("bin/sg")))
        del self.deck.data["tool"]["binary"]
        with mock.patch("shutil.which", return_value=None):
            with self.assertRaises(DeckUnavailable):
                sgmcp.binary(self.deck)


if __name__ == "__main__":
    unittest.main()

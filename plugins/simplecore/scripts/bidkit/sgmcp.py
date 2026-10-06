"""Reading a SlideGlance deck through the MCP server that holds it.

The desktop app holds a deck open and its model runs ahead of the disk: an
edit is in the model the moment it is applied and on disk only once the deck
is saved. A check that reads page files from disk judges a deck nobody is
looking at, so every deck check reads the deck from the server that holds it.

Which server:

1. The app, when its connection answers and lists this deck among its open
   decks. The connection file is `$SLIDEGLANCE_APP_MCP`, else the deck's
   `tool.appConnection`, else the app's own `mcp.json` in its support folder.
2. Otherwise a private `slideglance mcp <deck>` over stdio, which loads the
   deck from disk. That is safe exactly because no app holds the deck. The
   binary is `$SLIDEGLANCE_BIN`, else `tool.binary`, else `slideglance` on PATH.

An app that answers but cannot be read (a refused token, a server error) is an
error, never a reason to fall back: the disk may be behind it.
A session opened to write (`Session(deck, write=True)`) never falls back to the
disk while the app's connection file exists: an unreachable app may still hold
the deck, and a write to the disk server would be lost while reporting success.

Tests inject a `RecordedTransport`, which answers from captured resources and
records every call made to it.
"""
from __future__ import annotations

import json
import os
import re
import shutil
import subprocess
import sys
from pathlib import Path
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from .config import DeckConfig

APP_CONNECTION = Path.home() / "Library" / "Application Support" / "com.slideglance.editor" / "mcp.json"
APP_ENV = "SLIDEGLANCE_APP_MCP"
BIN_ENV = "SLIDEGLANCE_BIN"
BINARY_NAMES = ("slideglance", "slideglance.exe")   # the tool's own binary, on any platform
PROTOCOL = "2025-06-18"
CLIENT = {"name": "simplecore-deck-checks", "version": "1"}


class DeckUnavailable(RuntimeError):
    """The deck could not be read from any server."""


def _answer(msg: dict, method: str) -> dict:
    if "error" in msg:
        raise DeckUnavailable(f"{method}: {msg['error'].get('message')}")
    if "result" not in msg:
        raise DeckUnavailable(f"{method}: the server answered without a result")
    return msg["result"]


class HttpTransport:
    """Streamable HTTP, as the app serves it."""

    def __init__(self, url: str, headers: dict):
        self.url, self.headers, self.session, self.seq = url, dict(headers), None, 0

    def _headers(self) -> dict:
        h = {**self.headers, "Content-Type": "application/json",
             "Accept": "application/json, text/event-stream"}
        if self.session:
            h["Mcp-Session-Id"] = self.session
        return h

    def request(self, method: str, params: dict) -> dict:
        self.seq += 1
        body = json.dumps({"jsonrpc": "2.0", "id": self.seq, "method": method,
                           "params": params}).encode()
        with urlopen(Request(self.url, body, self._headers()), timeout=120) as r:
            self.session = r.headers.get("Mcp-Session-Id") or self.session
            text = r.read().decode("utf-8")
        if not text.lstrip().startswith("{"):
            data = [ln[5:] for ln in text.splitlines() if ln.startswith("data:")]
            text = data[-1] if data else ""
        try:
            msg = json.loads(text)
        except json.JSONDecodeError as e:
            raise DeckUnavailable(f"{method}: the app's answer is not JSON") from e
        return _answer(msg, method)

    def notify(self, method: str) -> None:
        body = json.dumps({"jsonrpc": "2.0", "method": method}).encode()
        urlopen(Request(self.url, body, self._headers()), timeout=30).read()

    def close(self) -> None:
        # End the session so the app stops listing this reader on the deck; a
        # server that keeps sessions without DELETE refuses it, which is fine.
        if not self.session:
            return
        req = Request(self.url, method="DELETE",
                      headers={**self.headers, "Mcp-Session-Id": self.session})
        try:
            urlopen(req, timeout=10).read()
        except HTTPError:
            pass


class StdioTransport:
    """A private `slideglance mcp` process, one JSON-RPC message per line."""

    def __init__(self, argv: list[str]):
        try:
            self.proc = subprocess.Popen(argv, stdin=subprocess.PIPE, stdout=subprocess.PIPE,
                                         stderr=subprocess.DEVNULL, text=True, encoding="utf-8")
        except OSError as e:
            raise DeckUnavailable(f"could not start {argv[0]}: {e}") from e
        self.seq = 0

    def request(self, method: str, params: dict) -> dict:
        self.seq += 1
        self._send({"jsonrpc": "2.0", "id": self.seq, "method": method, "params": params})
        assert self.proc.stdout is not None
        while True:
            line = self.proc.stdout.readline()
            if not line:
                raise DeckUnavailable(f"slideglance mcp ended before answering {method}")
            try:
                msg = json.loads(line)
            except json.JSONDecodeError:
                continue                 # a log line on stdout is not an answer
            if msg.get("id") == self.seq:
                return _answer(msg, method)

    def notify(self, method: str) -> None:
        self._send({"jsonrpc": "2.0", "method": method})

    def _send(self, msg: dict) -> None:
        assert self.proc.stdin is not None
        self.proc.stdin.write(json.dumps(msg, ensure_ascii=False) + "\n")
        self.proc.stdin.flush()

    def close(self) -> None:
        if self.proc.stdin:
            self.proc.stdin.close()
        try:
            self.proc.wait(timeout=10)
        except subprocess.TimeoutExpired:
            self.proc.kill()


class RecordedTransport:
    """Answers from a recording: `{"resources": {uri: text}, "tools": {name: result}}`.

    Every request is appended to `calls`, so a test can assert which tools a
    check called. A resource or tool the recording does not hold is an error,
    the same as a server that cannot answer.
    """

    def __init__(self, recording: dict):
        self.resources = dict(recording.get("resources", {}))
        self.tools = dict(recording.get("tools", {}))
        self.calls: list[tuple[str, dict]] = []
        self.closed = False

    @classmethod
    def from_file(cls, path: Path) -> "RecordedTransport":
        return cls(json.loads(Path(path).read_text(encoding="utf-8")))

    def request(self, method: str, params: dict) -> dict:
        self.calls.append((method, params))
        if method == "initialize":
            return {"protocolVersion": PROTOCOL, "capabilities": {}, "serverInfo": {"name": "recording"}}
        if method == "resources/read":
            uri = params.get("uri", "")
            if uri not in self.resources:
                raise DeckUnavailable(f"resources/read: the recording holds no {uri}")
            return {"contents": [{"uri": uri, "text": self.resources[uri]}]}
        if method == "tools/call":
            name = params.get("name", "")
            if name not in self.tools:
                raise DeckUnavailable(f"tools/call: the recording holds no answer for {name}")
            return self.tools[name]
        raise DeckUnavailable(f"{method}: not in the recording")

    def notify(self, method: str) -> None:
        self.calls.append((method, {}))

    def close(self) -> None:
        self.closed = True


def handshake(t: Any) -> None:
    t.request("initialize", {"protocolVersion": PROTOCOL, "capabilities": {}, "clientInfo": CLIENT})
    t.notify("notifications/initialized")


def app_connection_file(deck: DeckConfig) -> Path:
    env = os.environ.get(APP_ENV)
    if env:
        return Path(env).expanduser()
    declared = deck.get("tool.appConnection")
    if declared:
        return deck.resolve(declared)
    return APP_CONNECTION


def app_transport(connection: Path, deck_path: Path) -> HttpTransport | None:
    """The app's connection when it holds `deck_path`, else None (the disk is the deck)."""
    if not connection.exists():
        return None
    try:
        server = json.loads(connection.read_text(encoding="utf-8"))["servers"]["slideglance"]
        url = server["url"]
    except (json.JSONDecodeError, KeyError, TypeError) as e:
        raise DeckUnavailable(f"{connection}: no servers.slideglance.url in the app's connection file") from e
    t = HttpTransport(url, server.get("headers", {}))
    try:
        handshake(t)
    except HTTPError as e:
        raise DeckUnavailable(f"the app refused the connection: HTTP {e.code}") from e
    except (URLError, ConnectionError):
        return None                      # nothing listening: the app is not running
    decks = t.request("resources/read", {"uri": "sg://decks"})["contents"][0]["text"]
    if str(deck_path) not in decks:
        t.close()
        return None                      # the app runs without this deck open
    t.request("tools/call", {"name": "deck_open", "arguments": {"path": str(deck_path)}})
    return t


def binary(deck: DeckConfig) -> str:
    env = os.environ.get(BIN_ENV)
    if env:
        return env
    declared = deck.get("tool.binary")
    if declared:
        return str(deck.resolve(declared)) if "/" in declared else declared
    found = shutil.which(BINARY_NAMES[0])
    if found:
        return found
    raise DeckUnavailable(f"no app holds the deck and no slideglance binary was found: set ${BIN_ENV} "
                          "or declare tool.binary")


class Session:
    """One connection to whichever server holds the deck."""

    def __init__(self, deck: DeckConfig, transport: Any = None, write: bool = False):
        self.deck = deck
        self.path = deck.entry
        if transport is not None:
            self.t, self.source = transport, "recording"
            handshake(self.t)
            return
        connection = app_connection_file(deck)
        t = app_transport(connection, self.path)
        self.source = "app"
        if t is None and write and connection.exists():
            # The app may hold the deck: a write to a private disk server would be
            # overwritten by the app's model, or lost, while reporting success.
            raise DeckUnavailable(f"{connection} exists but the app's server for {self.path} could not be "
                                  "reached; a write never falls back to the disk server. Open the deck in "
                                  "the app, or ask the user to close the app, and run again")
        if t is None:
            t = StdioTransport([binary(deck), "mcp", str(self.path)])
            handshake(t)
            self.source = "disk"
        self.t = t

    def read(self, uri: str) -> str:
        return self.t.request("resources/read", {"uri": uri})["contents"][0]["text"]

    def call(self, tool: str, arguments: dict) -> dict:
        return self.t.request("tools/call", {"name": tool, "arguments": arguments})

    def close(self) -> None:
        self.t.close()

    def __enter__(self) -> "Session":
        return self

    def __exit__(self, *exc: object) -> None:
        self.close()


FILE_HEAD = re.compile(r"^=== file: (.+)$", re.M)


def split_markup(text: str) -> dict[str, str]:
    """`=== file: path` sections of `sg://deck/markup` into {path: text}."""
    heads = list(FILE_HEAD.finditer(text))
    out = {}
    for i, m in enumerate(heads):
        end = heads[i + 1].start() if i + 1 < len(heads) else len(text)
        out[m.group(1).strip()] = text[m.end() + 1:end]
    return out


def announce(source: str) -> None:
    where = {"app": "the app's open deck", "disk": "the disk (no app holds the deck)",
             "recording": "a recording"}.get(source, source)
    print(f"ℹ deck read from {where}", file=sys.stderr)

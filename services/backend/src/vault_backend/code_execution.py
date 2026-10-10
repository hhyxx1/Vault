"""E01 execution core for a dedicated Linux worker; never execute on the API host.

No HTTP endpoint is exposed by this module. Toolchains and box IDs are controller
configuration, not request data. Compilation is sandboxed as well as execution.
"""

import asyncio
import hashlib
import json
import os
import re
import signal
import stat
import sys
import tempfile
from pathlib import Path
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator

Language = Literal["c17", "cpp17", "java21", "python313", "python313ml", "node24", "postgres18"]
Status = Literal[
    "success", "compile_error", "runtime_error", "timeout", "resource_limit", "environment_error"
]
FILENAME = re.compile(r"[A-Za-z_][A-Za-z0-9_]{0,50}\.(c|cpp|h|hpp|java|py|js|sql)\Z")
EXTENSIONS = {
    "c17": {"c", "h"},
    "cpp17": {"cpp", "h", "hpp"},
    "java21": {"java"},
    "python313": {"py"},
    "python313ml": {"py"},
    "node24": {"js"},
    "postgres18": {"sql"},
}
ENTRY_EXT = {
    "c17": "c",
    "cpp17": "cpp",
    "java21": "java",
    "python313": "py",
    "python313ml": "py",
    "node24": "js",
    "postgres18": "sql",
}


class CodeRequest(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)
    language: Language
    files: dict[str, str] = Field(min_length=1, max_length=8)
    entry: str
    stdin: str = Field(default="", max_length=16384)

    @model_validator(mode="after")
    def controlled_sources(self):
        if self.entry not in self.files or not self.entry.endswith("." + ENTRY_EXT[self.language]):
            raise ValueError("entry must name a source file of the selected language")
        for name in self.files:
            if (
                not FILENAME.fullmatch(name)
                or name.rsplit(".", 1)[-1] not in EXTENSIONS[self.language]
            ):
                raise ValueError("only controlled, flat source filenames are accepted")
        if sum(len(text.encode("utf-8")) for text in self.files.values()) > 65536:
            raise ValueError("source exceeds 64 KiB")
        if len(self.stdin.encode("utf-8")) > 16384:
            raise ValueError("input exceeds 16 KiB")
        if self.language == "postgres18":
            if self.stdin or len(self.files) != 1:
                raise ValueError("SQL execution accepts one source file and no stdin")
            if "\\" in self.files[self.entry]:
                raise ValueError("psql client commands are not accepted")
        return self


class CodeResult(BaseModel):
    status: Status
    phase: Literal["prepare", "compile", "run", "cleanup"]
    stdout: str = ""
    stderr: str = ""
    truncated: bool = False
    metadata: dict[str, str] = Field(default_factory=dict)
    runtime_profile: str
    request_sha256: str = ""
    # A run is a tool fact; it is not a goal or independence judgement.
    mastery_asserted: Literal[False] = False


def request_hash(request: CodeRequest) -> str:
    snapshot = json.dumps(
        request.model_dump(), ensure_ascii=False, sort_keys=True, separators=(",", ":")
    ).encode("utf-8")
    return hashlib.sha256(snapshot).hexdigest()


def execution_status(meta: dict[str, str], returncode: int) -> Status:
    if returncode not in (0, 1) or meta.get("status") == "XX":
        return "environment_error"
    if "cg-oom-killed" in meta or meta.get("exitsig") == "25":
        return "resource_limit"
    if meta.get("status") == "TO":
        return "timeout"
    if returncode == 0 and meta.get("exitcode") == "0":
        return "success"
    if meta.get("status") in {"RE", "SG"}:
        return "runtime_error"
    return "environment_error"


def read_output(path: Path, limit: int = 65536) -> tuple[str, bool]:
    """Read only regular, singly-linked output after the sandbox has stopped."""
    flags = os.O_RDONLY | getattr(os, "O_NOFOLLOW", 0) | getattr(os, "O_NONBLOCK", 0)
    fd = os.open(path, flags)
    try:
        before = os.fstat(fd)
        if not stat.S_ISREG(before.st_mode) or before.st_nlink != 1:
            raise OSError("output is not an ordinary singly-linked file")
        data = os.read(fd, limit + 1)
        after = os.fstat(fd)
        if (before.st_ino, before.st_size, before.st_mtime_ns) != (
            after.st_ino,
            after.st_size,
            after.st_mtime_ns,
        ):
            raise OSError("output changed during inspection")
        return data[:limit].decode("utf-8", errors="replace"), len(data) > limit
    finally:
        os.close(fd)


class IsolateWorker:
    """One controller-owned box at a time, with bounded tmpfs scratch.

    Run as root on the dedicated worker only. An exclusive process lock prevents
    separate worker instances from resetting the same live box.
    """

    def __init__(self, box_id: int = 700, isolate: str = "/usr/local/bin/isolate"):
        if not 0 <= box_id <= 999:
            raise ValueError("box ID outside reserved range")
        self.box_id = box_id
        self.isolate = isolate
        self.base = Path("/var/local/lib/isolate")
        self.serial = asyncio.Lock()

    async def _command(self, args: list[str], timeout: float = 40) -> tuple[int, bytes]:
        # Empty environment: no API keys, user PATH, proxies or inherited sockets.
        process = await asyncio.create_subprocess_exec(
            *args,
            stdin=asyncio.subprocess.DEVNULL,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.DEVNULL,
            env={"PATH": "/usr/bin:/bin", "LANG": "C.UTF-8"},
            start_new_session=True,
        )
        try:
            output, _ = await asyncio.wait_for(process.communicate(), timeout)
            return process.returncode, output
        except (TimeoutError, asyncio.CancelledError):
            try:
                os.killpg(process.pid, signal.SIGTERM)
            except ProcessLookupError:
                pass
            try:
                await asyncio.wait_for(process.wait(), 3)
            except TimeoutError:
                os.killpg(process.pid, signal.SIGKILL)
                await process.wait()
            raise

    def _plans(self, request: CodeRequest) -> tuple[list[str] | None, list[str]]:
        sources = sorted("/box/" + name for name in request.files)
        if request.language in {"c17", "cpp17"}:
            extension = ENTRY_EXT[request.language]
            compiler = "/usr/bin/gcc" if extension == "c" else "/usr/bin/g++"
            standard = "c17" if extension == "c" else "c++17"
            return [
                compiler,
                "-std=" + standard,
                "-O2",
                "-pipe",
                "-o",
                "/box/program",
                *[name for name in sources if name.endswith("." + extension)],
            ], ["/box/program"]
        if request.language == "java21":
            root = "/usr/lib/jvm/java-21-openjdk-amd64/bin/"
            return [
                root + "javac",
                "-J-Xmx128m",
                "-J-XX:ActiveProcessorCount=1",
                "-d",
                "/box",
                *sources,
            ], [
                root + "java",
                "-Xmx128m",
                "-XX:ActiveProcessorCount=1",
                "-cp",
                "/box",
                request.entry.removesuffix(".java"),
            ]
        if request.language in {"python313", "python313ml"}:
            directory = "python-3.13-ml" if request.language == "python313ml" else "python-3.13"
            return None, [
                f"/opt/vault-toolchains/{directory}/bin/python3.13",
                "-I",
                "/box/" + request.entry,
            ]
        if request.language == "postgres18":
            return None, [
                "/opt/vault-toolchains/python-3.13/bin/python3.13",
                "-I",
                "/opt/vault-toolchains/pg18/run_sql.py",
                "/box/" + request.entry,
            ]
        return None, ["/opt/vault-toolchains/node-24/bin/node", "/box/" + request.entry]

    async def _phase(
        self,
        command: list[str],
        phase: Literal["compile", "run"],
        box: Path,
        scratch: Path,
        profile: str,
    ) -> CodeResult:
        meta_path = scratch / (phase + ".meta")
        seconds = 30 if phase == "compile" else 5
        sql = "/opt/vault-toolchains/pg18/run_sql.py" in command
        args = [
            self.isolate,
            "--cg",
            "--box-id=" + str(self.box_id),
            "--meta=" + str(meta_path),
            "--time=" + str(seconds),
            "--wall-time=" + str(seconds + 5),
            "--cg-mem=524288",
            "--processes=32",
            "--fsize=" + ("32768" if sql else "1024"),
            "--open-files=64",
            "--env=PATH=/usr/bin:/bin",
            "--env=LANG=C.UTF-8",
            "--env=HOME=/box",
            "--env=TMPDIR=/tmp",
            "--dir=/tmp=" + str(box / "tmp") + ":rw",
            "--dir=/dev/shm=",
            "--stdin=/box/input",
            "--stdout=/box/stdout",
            "--stderr=/box/stderr",
            "--run",
            "--",
            *command,
        ]
        if command[0].startswith("/opt/vault-toolchains/"):
            # Bind only the selected interpreter, never the controller's /opt tree.
            toolchain = Path(command[0]).parents[1]
            args.insert(args.index("--run"), "--dir=" + str(toolchain))
        if command[0] == "/opt/vault-toolchains/python-3.13-ml/bin/python3.13":
            for variable in ("OPENBLAS_NUM_THREADS", "OMP_NUM_THREADS", "MKL_NUM_THREADS"):
                args.insert(args.index("--run"), f"--env={variable}=1")
            args.insert(args.index("--run"), "--env=JOBLIB_MULTIPROCESSING=0")
        if sql:
            args.insert(args.index("--run"), "--dir=/opt/vault-toolchains/pg18")
            args.insert(args.index("--run"), "--dir=/etc=" + str(box / "pg-etc") + ":rw")
        if command[0].startswith("/usr/lib/jvm/java-21-openjdk-amd64/"):
            # Debian's JDK configuration is symlinked outside /usr. Expose this
            # public toolchain configuration only, never all of host /etc.
            args.insert(args.index("--run"), "--dir=/etc/java-21-openjdk")
        code, _ = await self._command(args, seconds + 10)
        meta_text, _ = read_output(meta_path, 16384)
        meta = dict(line.split(":", 1) for line in meta_text.splitlines() if ":" in line)
        status = execution_status(meta, code)
        if sql and meta.get("exitcode") == "70":
            status = "environment_error"
            phase = "prepare"
        if phase == "compile" and status == "runtime_error":
            status = "compile_error"
        stdout, out_cut = read_output(box / "stdout")
        stderr, err_cut = read_output(box / "stderr")
        return CodeResult(
            status=status,
            phase=phase,
            stdout=stdout,
            stderr=stderr,
            truncated=out_cut or err_cut,
            metadata=meta,
            runtime_profile=profile,
        )

    async def run(self, request: CodeRequest) -> CodeResult:
        profile = request.language + "-isolate-dev@0.1.0"
        snapshot_hash = request_hash(request)
        failure = CodeResult(
            status="environment_error",
            phase="prepare",
            runtime_profile=profile,
            request_sha256=snapshot_hash,
        )
        if sys.platform != "linux" or os.geteuid() != 0 or not Path(self.isolate).is_file():
            return failure
        import fcntl

        async with self.serial:
            with open("/run/vault-isolate-" + str(self.box_id) + ".lock", "a") as lock:
                try:
                    fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
                except BlockingIOError:
                    return failure
                prefix = [self.isolate, "--cg", "--box-id=" + str(self.box_id)]
                mounted = False
                initialized = False
                cancelled = False
                cleanup_failed = False
                result = failure
                box = self.base / str(self.box_id) / "box"
                try:
                    code, output = await self._command([*prefix, "--init"], 10)
                    if code != 0:
                        return failure
                    initialized = True
                    reported = Path(output.decode().strip()).resolve()
                    if reported != box.parent.resolve():
                        raise OSError("unexpected isolate root")
                    owner = box.stat()
                    scratch_limit = (
                        "size=128m,nr_inodes=8192"
                        if request.language == "postgres18"
                        else "size=16m,nr_inodes=256"
                    )
                    code, _ = await self._command(
                        [
                            "/usr/bin/mount",
                            "-t",
                            "tmpfs",
                            "-o",
                            f"{scratch_limit},nodev,nosuid,uid={owner.st_uid},gid={owner.st_gid}",
                            "vault-code",
                            str(box),
                        ],
                        10,
                    )
                    if code != 0:
                        raise OSError("bounded scratch mount unavailable")
                    mounted = True
                    (box / "tmp").mkdir(mode=0o777)
                    os.chmod(box / "tmp", 0o777)
                    for name, source in request.files.items():
                        (box / name).write_text(source, encoding="utf-8")
                    (box / "input").write_text(request.stdin, encoding="utf-8")
                    if request.language == "postgres18":
                        configuration = box / "pg-etc"
                        configuration.mkdir(mode=0o777)
                        os.chmod(configuration, 0o777)
                    compile_plan, run_plan = self._plans(request)
                    executable = compile_plan[0] if compile_plan else run_plan[0]
                    if not Path(executable).is_file():
                        raise OSError("configured toolchain unavailable")
                    if (
                        request.language == "postgres18"
                        and not Path("/opt/vault-toolchains/pg18/run_sql.py").is_file()
                    ):
                        raise OSError("configured PostgreSQL runtime unavailable")
                    if (
                        request.language == "java21"
                        and not Path("/etc/java-21-openjdk/security/java.security").is_file()
                    ):
                        raise OSError("configured Java security file unavailable")
                    with tempfile.TemporaryDirectory(prefix="vault-run-meta-") as temp:
                        scratch = Path(temp)
                        if compile_plan:
                            result = await self._phase(
                                compile_plan, "compile", box, scratch, profile
                            )
                        if not compile_plan or result.status == "success":
                            result = await self._phase(run_plan, "run", box, scratch, profile)
                except asyncio.CancelledError:
                    cancelled = True
                    raise
                except (OSError, ValueError, TimeoutError):
                    result = failure
                finally:
                    # Cancellation still reclaims mounts and the complete isolate cgroup.
                    if mounted:
                        code, _ = await asyncio.shield(
                            self._command(["/usr/bin/umount", str(box)], 10)
                        )
                        if code != 0:
                            cleanup_failed = True
                            result = failure.model_copy(update={"phase": "cleanup"})
                    if initialized:
                        code, _ = await asyncio.shield(self._command([*prefix, "--cleanup"], 10))
                        if code != 0:
                            cleanup_failed = True
                            result = failure.model_copy(update={"phase": "cleanup"})
                    if cancelled and cleanup_failed:
                        raise RuntimeError("isolate cleanup failed")
                return result.model_copy(update={"request_sha256": snapshot_hash})

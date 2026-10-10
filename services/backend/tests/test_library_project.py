import json
import os
import sys
from pathlib import Path

import pytest

from vault_backend.code_execution import CodeRequest, IsolateWorker

ROOT = Path(__file__).resolve().parents[3]


def test_library_teaching_project_source_is_present():
    source = (ROOT / "tools/curriculum/assets/Library.java").read_text(encoding="utf-8")
    assert "class Library" in source


@pytest.mark.asyncio
@pytest.mark.skipif(
    sys.platform != "linux" or os.environ.get("VAULT_ISOLATE_INTEGRATION") != "1",
    reason="real Java21 isolate",
)
async def test_actual_java_domain_rules_and_save_reload_boundary():
    main = """import java.nio.file.*;
public class Main {
 public static void main(String[] args) throws Exception {
  Library library=new Library();library.addBook("B1","Algorithms",1);
  long loan=library.borrow("B1","alice");
  System.out.println(library.available("B1"));
  try{library.borrow("B1","bob");System.out.println("bad");}
  catch(IllegalStateException e){System.out.println("no_stock");}
  try{library.giveBack(loan,"bob");System.out.println("bad");}
  catch(IllegalArgumentException e){System.out.println("owner_required");}
  Path file=Path.of("library.tsv");library.save(file);Library restored=Library.load(file);
  System.out.println(restored.available("B1"));restored.giveBack(loan,"alice");
  System.out.println(restored.available("B1"));
  try{restored.giveBack(loan,"alice");System.out.println("bad");}
  catch(IllegalStateException e){System.out.println("already_returned");}
  restored.save(file);Library finalCopy=Library.load(file);
  System.out.println(finalCopy.available("B1"));System.out.println(finalCopy.borrow("B1","bob")>loan);
  Files.writeString(file,"V1\\nB\\tB1\\tBroken\\t-1\\n");
  try{Library.load(file);System.out.println("bad");}
  catch(IllegalArgumentException e){System.out.println("corrupt_rejected");}
 }
}
"""
    source = (ROOT / "tools/curriculum/assets/Library.java").read_text(encoding="utf-8")
    result = await IsolateWorker(box_id=701).run(
        CodeRequest(
            language="java21", entry="Main.java", files={"Main.java": main, "Library.java": source}
        )
    )
    assert (result.status, result.stdout, result.stderr) == (
        "success",
        "0\nno_stock\nowner_required\n0\n1\nalready_returned\n1\ntrue\ncorrupt_rejected\n",
        "",
    ), result


@pytest.mark.asyncio
@pytest.mark.skipif(
    sys.platform != "linux" or os.environ.get("VAULT_ISOLATE_INTEGRATION") != "1",
    reason="real Java21 isolate",
)
async def test_actual_snapshot_rejects_dangling_duplicate_overbooked_and_bad_counter():
    snapshots = [
        "V2\nN\t1\n",
        "V1\nB\tB1\tBook\t1\nB\tB1\tAgain\t1\nN\t1\n",
        "V1\nL\t1\tMISSING\talice\tfalse\nN\t2\n",
        "V1\nB\tB1\tBook\t1\nL\t1\tB1\talice\tfalse\nL\t2\tB1\tbob\tfalse\nN\t3\n",
        "V1\nB\tB1\tBook\t1\nL\t1\tB1\talice\tfalse\nN\t1\n",
        "V1\nB\tB1\tBook\t1\nL\t1\tB1\talice\tperhaps\nN\t2\n",
        "V1\nB\tB1\tBook\t1\n",
    ]
    literals = ",".join(json.dumps(value) for value in snapshots)
    main = """import java.nio.file.*;
public class Main {
 public static void main(String[] args) throws Exception {
  Path file=Path.of("snapshot.tsv");
  for(String snapshot:new String[]{SNAPSHOTS}) {
   Files.writeString(file,snapshot);
   try{Library.load(file);System.out.println("bad");}
   catch(IllegalArgumentException error){System.out.println("rejected");}
  }
 }
}
""".replace("SNAPSHOTS", literals)
    source = (ROOT / "tools/curriculum/assets/Library.java").read_text(encoding="utf-8")
    result = await IsolateWorker(box_id=701).run(
        CodeRequest(
            language="java21", entry="Main.java", files={"Main.java": main, "Library.java": source}
        )
    )
    assert (result.status, result.stdout, result.stderr) == (
        "success",
        "rejected\n" * len(snapshots),
        "",
    ), result

import { describe, expect, it } from "vitest";
import { testDb } from "../../../../tests/helpers/db";
import { listActivitiesCiting, listVersions, recordVersion } from "./sources-repo";

const NOW = "2026-09-30T10:00:00.000Z";

describe("sources-repo — detalhe da fonte", () => {
  it("lista versões da mais recente para a mais antiga e as atividades que citam a fonte", () => {
    const db = testDb();
    db.run(
      `INSERT INTO sources (file_id, name, mime_type, kind, path, sync_status, first_seen_at, last_seen_at)
       VALUES ('f', 'A.md', 'x', 'md', 'A.md', 'processed', ?, ?)`,
      NOW,
      NOW,
    );
    recordVersion(db, "f", "hash-1", "1", "2026-09-30T10:00:00.000Z");
    recordVersion(db, "f", "hash-2", "2", "2026-09-30T11:00:00.000Z");
    recordVersion(db, "f", "hash-2", "2", "2026-09-30T12:00:00.000Z");
    expect(listVersions(db, "f").map((v) => v.content_hash)).toEqual(["hash-2", "hash-1"]);
    expect(listVersions(db, "outro")).toEqual([]);

    for (const id of ["ACT-1", "ACT-2"]) {
      db.run(
        `INSERT INTO activities (id, title, origin, created_at, created_by, updated_at, updated_by)
         VALUES (?, ?, 'importada', ?, 'x', ?, 'x')`,
        id,
        `Título ${id}`,
        NOW,
        NOW,
      );
      db.run(
        "INSERT INTO activity_references (activity_id, file_id, relation, created_at) VALUES (?, 'f', 'imported_from', ?)",
        id,
        NOW,
      );
    }
    db.run("UPDATE activities SET archived_at = ? WHERE id = 'ACT-2'", NOW);
    expect(listActivitiesCiting(db, "f")).toEqual([{ id: "ACT-1", title: "Título ACT-1", relation: "imported_from" }]);
  });
});

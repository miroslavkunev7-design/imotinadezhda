import { useEffect, useState } from "react";
import {
  archiveEntity,
  fetchArchives,
  listCrmClients,
  listCrmProperties,
  unarchiveEntity,
  type CmsArchive
} from "../api";

export function ArchivePanel({ toast }: { toast: (m: string) => void }) {
  const [archives, setArchives] = useState<CmsArchive[]>([]);
  const [props, setProps] = useState<Array<Record<string, unknown>>>([]);
  const [clients, setClients] = useState<Array<Record<string, unknown>>>([]);

  async function reload() {
    try {
      setArchives(await fetchArchives());
      setProps(await listCrmProperties());
      setClients(await listCrmClients());
    } catch (e) {
      toast(e instanceof Error ? e.message : String(e));
    }
  }

  useEffect(() => { void reload(); }, []);

  async function arch(type: "property" | "client", row: Record<string, unknown>) {
    try {
      await archiveEntity(type, String(row.id), row);
      toast(`Archived ${type} ${row.id}`);
      await reload();
    } catch (e) {
      toast(e instanceof Error ? e.message : String(e));
    }
  }

  async function restore(a: CmsArchive) {
    try {
      await unarchiveEntity(a.entity_type, a.entity_id);
      toast("Restored from archive");
      await reload();
    } catch (e) {
      toast(e instanceof Error ? e.message : String(e));
    }
  }

  return (
    <div>
      <div className="card">
        <h3>Archived (.del-style)</h3>
        <p className="muted">Stored in cms_archives — does not wipe CRM rows.</p>
        {archives.length === 0 ? <div className="empty">No archives yet.</div> : (
          <table className="table">
            <thead><tr><th>Type</th><th>Id</th><th>When</th><th /></tr></thead>
            <tbody>
              {archives.map((a) => (
                <tr key={a.id}>
                  <td>{a.entity_type}</td>
                  <td>{a.entity_id}</td>
                  <td>{new Date(a.archived_at).toLocaleString()}</td>
                  <td><button className="ghost" type="button" onClick={() => restore(a)}>Restore</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <div className="card">
        <h3>Properties → archive</h3>
        <table className="table">
          <thead><tr><th>Code</th><th>Title</th><th>City</th><th /></tr></thead>
          <tbody>
            {props.map((p) => (
              <tr key={String(p.id)}>
                <td>{String(p.code || "")}</td>
                <td>{String(p.title || "")}</td>
                <td>{String(p.city || "")}</td>
                <td><button className="danger" type="button" onClick={() => arch("property", p)}>Archive</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="card">
        <h3>Clients → archive</h3>
        <table className="table">
          <thead><tr><th>Name</th><th>Phone</th><th>City</th><th /></tr></thead>
          <tbody>
            {clients.map((c) => (
              <tr key={String(c.id)}>
                <td>{String(c.name || "")}</td>
                <td>{String(c.phone || "")}</td>
                <td>{String(c.city || "")}</td>
                <td><button className="danger" type="button" onClick={() => arch("client", c)}>Archive</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

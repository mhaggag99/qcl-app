import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { getAllUsers, getUserSettings, getClients, createClient, updateClient, saveUserVAs, markSetupDone } from "@/lib/db";

const MONDAY_API  = "https://api.monday.com/v2";
const RT_BOARD_ID = "658228616";
const MCL_BOARD_ID = "1961415089";
const MCL_START_COL = "date59";

async function gql(query: string, token: string) {
  const res = await fetch(MONDAY_API, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: token },
    body: JSON.stringify({ query }),
    cache: "no-store",
  });
  return res.json();
}

function norm(n: string) {
  return n.toLowerCase()
    .replace(/\s*\(copy\)\s*/gi, "")
    .replace(/^dr\.\s*/i, "")
    .replace(/,?\s*ph\.?d\.?/gi, "")
    .replace(/\s*\(ert\)\s*/gi, "")
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function namesMatch(a: string, b: string): boolean {
  const na = norm(a), nb = norm(b);
  if (na === nb) return true;
  const pa = na.split(" ").filter(p => p.length > 2);
  const pb = nb.split(" ").filter(p => p.length > 2);
  return (pa.length > 0 && pa.every(p => nb.includes(p))) ||
         (pb.length > 0 && pb.every(p => na.includes(p)));
}

function resolveVAShortName(fullName: string): string {
  return fullName.trim().split(/\s+/)[0] || fullName;
}

export async function POST(request: NextRequest) {
  const session = await getSessionUser(request);
  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  if (!body?.userId || !body?.pmName?.trim()) {
    return NextResponse.json({ error: "userId and pmName are required" }, { status: 400 });
  }

  const { userId, pmName, vaNames } = body as { userId: string; pmName: string; vaNames?: string[] };

  // Find any user with a Monday token (prefer owner)
  const users = getAllUsers();
  const tokenSource = users.sort((a, b) => (a.role === "owner" ? -1 : b.role === "owner" ? 1 : 0))
    .find(u => getUserSettings(u.id).mondayApiToken);
  if (!tokenSource) {
    return NextResponse.json({ error: "No Monday API token found. Set it for at least one user." }, { status: 422 });
  }
  const token = getUserSettings(tokenSource.id).mondayApiToken;
  const today = new Date().toISOString().slice(0, 10);

  // ── 1. RT Status board columns ──────────────────────────
  const colData = await gql(`{ boards(ids:[${RT_BOARD_ID}]) { columns { id title } } }`, token);
  const columns: { id: string; title: string }[] = colData?.data?.boards?.[0]?.columns || [];
  const cid = (t: string) => columns.find(c => c.title === t)?.id || "";

  const pmCol  = cid("Project Manager");
  const vaCol  = cid("VA");
  const ertCol = cid("Date of Roundtable");
  const itemDateCol = cid("Item Date");
  const attCol = cid("# of Attendees");
  const regCol = cid("# of Registered");
  const timeCol = cid("RT Time");

  const colIds = [pmCol, vaCol, ertCol, itemDateCol, attCol, regCol, timeCol]
    .filter(Boolean).map(id => `"${id}"`).join(", ");

  // ── 2. Fetch all RT items, filter by PM name ────────────
  interface RawItem { displayName: string; normKey: string; vaFull: string; itemDate: string; ertDate: string; attendees: number | null; registered: number | null; ertTime: string; }
  const rawItems: RawItem[] = [];
  let cursor: string | null = null;

  do {
    const cc = cursor ? `, cursor: "${cursor}"` : "";
    const res = await gql(`{
      boards(ids:[${RT_BOARD_ID}]) {
        items_page(limit:500${cc}) {
          cursor
          items { name column_values(ids:[${colIds}]) { id text } }
        }
      }
    }`, token);
    const page = res?.data?.boards?.[0]?.items_page;
    for (const item of (page?.items || [])) {
      const cv: Record<string, string> = {};
      for (const c of item.column_values) cv[c.id] = c.text || "";
      if (!cv[pmCol]?.toLowerCase().includes(pmName.toLowerCase())) continue;

      const att  = parseFloat(cv[attCol]);
      const reg  = parseFloat(cv[regCol]);
      rawItems.push({
        displayName: item.name.replace(/\s*\(copy\)\s*/gi, "").trim(),
        normKey:     norm(item.name),
        vaFull:      cv[vaCol] || "",
        itemDate:    cv[itemDateCol]?.slice(0, 10) || "",
        ertDate:     cv[ertCol]?.slice(0, 10) || "",
        attendees:   isNaN(att) ? null : att,
        registered:  isNaN(reg) ? null : reg,
        ertTime:     cv[timeCol] || "",
      });
    }
    cursor = page?.cursor || null;
  } while (cursor);

  // ── 3. Aggregate per canonical client key ────────────────
  interface ClientAgg {
    displayName: string;
    vaFull: string;
    itemDates: string[];
    pastERTs: { date: string; attendees: number | null; registered: number | null; time: string }[];
    futureERTs: { date: string; registered: number | null; time: string }[];
  }
  const agg = new Map<string, ClientAgg>();

  for (const r of rawItems) {
    let key = r.normKey;
    for (const [k] of agg) {
      if (namesMatch(k, r.normKey)) { key = k; break; }
    }
    if (!agg.has(key)) {
      agg.set(key, { displayName: r.displayName, vaFull: r.vaFull, itemDates: [], pastERTs: [], futureERTs: [] });
    }
    const e = agg.get(key)!;
    if (!e.vaFull && r.vaFull) e.vaFull = r.vaFull;
    if (r.itemDate) e.itemDates.push(r.itemDate);
    if (r.ertDate) {
      if (r.ertDate < today) e.pastERTs.push({ date: r.ertDate, attendees: r.attendees, registered: r.registered, time: r.ertTime });
      else                   e.futureERTs.push({ date: r.ertDate, registered: r.registered, time: r.ertTime });
    }
  }

  // ── 4. MCL start dates ───────────────────────────────────
  const mclStart = new Map<string, string>();
  const mclGroups = await gql(`{ boards(ids:[${MCL_BOARD_ID}]) { groups { id } } }`, token);
  const groups: { id: string }[] = mclGroups?.data?.boards?.[0]?.groups || [];

  for (const group of groups) {
    let mc: string | null = null;
    do {
      const cc = mc ? `, cursor: "${mc}"` : "";
      const res = await gql(`{
        boards(ids:[${MCL_BOARD_ID}]) {
          groups(ids:["${group.id}"]) {
            items_page(limit:200${cc}) {
              cursor
              items { name column_values(ids:["${MCL_START_COL}"]) { id text } }
            }
          }
        }
      }`, token);
      const page = res?.data?.boards?.[0]?.groups?.[0]?.items_page;
      for (const item of (page?.items || [])) {
        for (const [k] of agg) {
          if (namesMatch(item.name, k)) {
            const d = item.column_values[0]?.text?.slice(0, 10) || "";
            if (d && (!mclStart.has(k) || d < mclStart.get(k)!)) mclStart.set(k, d);
          }
        }
      }
      mc = page?.cursor || null;
    } while (mc);
  }

  // ── 5. Create / update clients ──────────────────────────
  const existing = getClients(userId);
  let created = 0, updated = 0;
  const detectedVAs = new Set<string>();

  for (const [key, e] of agg) {
    e.pastERTs.sort((a, b) => b.date.localeCompare(a.date));
    e.futureERTs.sort((a, b) => a.date.localeCompare(b.date));
    e.itemDates.sort();

    const startDate   = mclStart.get(key) || e.itemDates[0] || "";
    const nextERT     = e.futureERTs[0];
    const lastERT     = e.pastERTs[0];
    const ertDate     = nextERT?.date || lastERT?.date || "";
    const ertTime     = nextERT?.time || lastERT?.time || "";
    const totalAtt    = e.pastERTs.reduce((s, r) => s + (r.attendees ?? 0), 0);
    const lastReg     = lastERT?.registered ?? 0;
    const vaShort     = resolveVAShortName(e.vaFull);
    if (vaShort) detectedVAs.add(vaShort);

    const match = existing.find(c => namesMatch(c.name, key));
    if (match) {
      updateClient(match.id, {
        start:      startDate || match.start,
        ert:        ertDate,
        ertTime,
        attendees:  totalAtt || match.attendees,
        registered: lastReg,
        va:         vaShort || match.va,
      }, userId);
      updated++;
    } else {
      createClient({
        name: e.displayName, email: "", va: vaShort, start: startDate,
        status: "New Client", li: "", ert: ertDate, ertTime,
        attendees: totalAtt, registered: Number(lastReg), message: "",
        targeting: "", flag: "", redzone: false, notes: [],
      }, userId);
      created++;
    }
  }

  // ── 6. Save VA names ────────────────────────────────────
  const finalVAs = vaNames?.length ? vaNames : [...detectedVAs].filter(Boolean);
  if (finalVAs.length) saveUserVAs(userId, finalVAs);

  markSetupDone(userId);

  return NextResponse.json({ ok: true, created, updated, clientsTotal: created + updated, vas: finalVAs });
}

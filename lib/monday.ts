const API = "https://api.monday.com/v2";

async function gql(query: string, variables?: Record<string, unknown>) {
  const token = process.env.MONDAY_API_TOKEN || "";
  const res = await fetch(API, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: token },
    body: JSON.stringify({ query, variables }),
    cache: "no-store",
  });
  return res.json();
}

// Paginate through all Monday boards to find one by exact name
async function findBoard(name: string): Promise<{ id: string; name: string } | null> {
  let page = 1;
  while (true) {
    const data = await gql(`{ boards(limit: 500, page: ${page}) { id name } }`);
    const boards: { id: string; name: string }[] = data?.data?.boards || [];
    if (!boards.length) return null;
    const found = boards.find((b) => b.name === name);
    if (found) return found;
    if (boards.length < 500) return null;
    page++;
  }
}

// Classify note text → which Monday bubble it belongs to
export function classifyBubble(text: string): string {
  const t = text.toLowerCase();
  if (/\bert\b|roundtable|schedul|reschedul|event date|postpone|meeting date/.test(t)) return "Scheduling";
  if (/messag|outreach|linkedin|\bli\b|copy|template|invite|email draft/.test(t)) return "Messaging";
  if (/target|audience|filter|niche|industry|segment/.test(t)) return "Targeting";
  if (/campaign|status update|progress|report|kpi/.test(t)) return "QCL Campaign Updates";
  if (/opportunit|call|discussion|zoom|catch up/.test(t)) return "Opportunity Call Discussions";
  if (/monthly|month/.test(t)) return "Monthly Opportunity Updates";
  return "General";
}

// Find the Monday board for a client by name
export async function findClientBoard(clientName: string): Promise<string | null> {
  const data = await gql("{ boards(limit: 500) { id name } }");
  const boards: { id: string; name: string }[] = data?.data?.boards || [];
  const name = clientName.toLowerCase().trim();

  const clientBoards = boards.filter((b) => !b.name.toLowerCase().startsWith("subitems of"));

  // Exact match
  let found = clientBoards.find((b) => b.name.toLowerCase() === name);
  if (found) return found.id;

  // All name parts present
  const parts = name.split(" ").filter((p) => p.length > 2);
  found = clientBoards.find((b) => {
    const bn = b.name.toLowerCase();
    return parts.length > 0 && parts.every((p) => bn.includes(p));
  });
  if (found) return found.id;

  // First name only
  found = clientBoards.find((b) => b.name.toLowerCase().startsWith(parts[0] || name));
  return found?.id || null;
}

// Find a specific item (bubble) inside a board by name
export async function findBoardItem(boardId: string, itemName: string): Promise<string | null> {
  const data = await gql(
    `{ boards(ids: [${boardId}]) { items_page(limit: 50) { items { id name } } } }`
  );
  const items: { id: string; name: string }[] =
    data?.data?.boards?.[0]?.items_page?.items || [];
  return items.find((i) => i.name.toLowerCase() === itemName.toLowerCase())?.id || null;
}

// Post an update on a Monday item
export async function postUpdate(itemId: string, body: string): Promise<boolean> {
  const data = await gql(
    `mutation($itemId: ID!, $body: String!) { create_update(item_id: $itemId, body: $body) { id } }`,
    { itemId, body }
  );
  return !!data?.data?.create_update?.id;
}

// Full flow: find client board → classify bubble → find item → post
export async function postToClientBoard(
  clientName: string,
  noteText: string
): Promise<{ ok: boolean; bubble: string; error?: string }> {
  const bubble = classifyBubble(noteText);

  const boardId = await findClientBoard(clientName);
  if (!boardId) return { ok: false, bubble, error: `No Monday board found for "${clientName}"` };

  const itemId = await findBoardItem(boardId, bubble);
  if (!itemId) return { ok: false, bubble, error: `Bubble "${bubble}" not found on board` };

  const ok = await postUpdate(itemId, noteText);
  return { ok, bubble };
}

// Post to the Master Client List board — finds the client item and posts there
export async function postToMCL(
  clientName: string,
  noteText: string
): Promise<{ ok: boolean; bubble: string; error?: string }> {
  const data = await gql("{ boards(limit: 500) { id name } }");
  const boards: { id: string; name: string }[] = data?.data?.boards || [];
  const board = boards.find((b) => b.name.toLowerCase() === "master client list");
  if (!board) return { ok: false, bubble: "MCL", error: `MCL board not found (searched ${boards.length} boards)` };

  // Use per-group pagination to avoid the 500-item board-level cap
  const groupsData = await gql(`{ boards(ids: [${board.id}]) { groups { id title } } }`);
  const groups: { id: string; title: string }[] = groupsData?.data?.boards?.[0]?.groups || [];

  const name = clientName.toLowerCase().trim();
  const parts = name.split(" ").filter((p) => p.length > 2);

  for (const group of groups) {
    let cursor: string | null = null;
    do {
      const cursorClause = cursor ? `, cursor: "${cursor}"` : "";
      const result = await gql(`{
        boards(ids: [${board.id}]) {
          groups(ids: ["${group.id}"]) {
            items_page(limit: 200${cursorClause}) {
              cursor
              items { id name }
            }
          }
        }
      }`);
      const page = result?.data?.boards?.[0]?.groups?.[0]?.items_page;
      const items: { id: string; name: string }[] = page?.items || [];
      const item = items.find((i) => {
        const n = i.name.toLowerCase();
        return n === name || (parts.length > 0 && parts.every((p) => n.includes(p)));
      });
      if (item) {
        const bubble = classifyBubble(noteText);
        const ok = await postUpdate(item.id, noteText);
        return { ok, bubble };
      }
      cursor = page?.cursor || null;
    } while (cursor);
  }

  return { ok: false, bubble: "MCL", error: `"${clientName}" not found in MCL (searched ${groups.length} groups)` };
}

export interface RoundtableEvent {
  clientName: string;
  date: string;
  rtTime: string;
  attendees: number | null;
  registered: number | null;
  calendarConfirmed: number | null;
}

export async function getRoundtableStatus(): Promise<{ boardName: string; events: RoundtableEvent[] } | null> {
  const board = await findBoard("Client Roundtable Status");
  if (!board) return null;

  const colData = await gql(`{ boards(ids: [${board.id}]) { columns { id title } } }`);
  const columns: { id: string; title: string }[] = colData?.data?.boards?.[0]?.columns || [];
  const colId = (title: string) => columns.find((c) => c.title === title)?.id || "";

  const dateId      = colId("Date of Roundtable");
  const timeId      = colId("RT Time");
  const attendeesId = colId("# of Attendees");
  const regId       = colId("# of Registered");
  const calId       = colId("# of Calendar Confirmed");

  const ids = [dateId, timeId, attendeesId, regId, calId]
    .filter(Boolean).map((id) => `"${id}"`).join(", ");

  // Get all groups first, then fetch items per group to avoid the board-level 500 limit
  const groupsData = await gql(`{ boards(ids: [${board.id}]) { groups { id title } } }`);
  const groups: { id: string; title: string }[] = groupsData?.data?.boards?.[0]?.groups || [];

  const allItems: { name: string; column_values: { id: string; text: string }[] }[] = [];

  for (const group of groups) {
    let cursor: string | null = null;
    do {
      const cursorClause = cursor ? `, cursor: "${cursor}"` : "";
      const result = await gql(`{
        boards(ids: [${board.id}]) {
          groups(ids: ["${group.id}"]) {
            items_page(limit: 500${cursorClause}) {
              cursor
              items {
                id name
                column_values(ids: [${ids}]) { id text }
              }
            }
          }
        }
      }`);
      const page = result?.data?.boards?.[0]?.groups?.[0]?.items_page;
      for (const item of (page?.items || [])) allItems.push(item);
      cursor = page?.cursor || null;
    } while (cursor);
  }

  const toNum = (text: string): number | null => {
    const n = parseFloat(text);
    return isNaN(n) ? null : n;
  };

  const events: RoundtableEvent[] = allItems.map((item) => {
    const cv = item.column_values;
    const get = (id: string) => cv.find((c) => c.id === id)?.text || "";
    return {
      clientName:        item.name,
      date:              get(dateId),
      rtTime:            get(timeId),
      attendees:         toNum(get(attendeesId)),
      registered:        toNum(get(regId)),
      calendarConfirmed: toNum(get(calId)),
    };
  });

  return { boardName: board.name, events };
}

// Get the current month's Client Activity Tracking board ID
async function getActivityBoardId(): Promise<{ boardId: string; boardName: string } | null> {
  const now = new Date();
  const monthName = now.toLocaleDateString("en-US", { month: "long" });
  const year = now.getFullYear();
  const target = `${monthName} ${year}: Client Activity Tracking`;
  const board = await findBoard(target);
  return board ? { boardId: board.id, boardName: board.name } : null;
}

export interface ActivityRow {
  clientName: string;
  date: string;        // item.name (row identifier)
  activityDate: string; // "Date" column — actual date of outreach
  va: string;
  ertDate: string;
  connReqSent: number;
  liEventInvites: number;
  inmailSent: number;
  connectionsMade: number;
}

// Fetch and structure the current month's activity board
export async function getMonthlyActivity(): Promise<{ boardName: string; rows: ActivityRow[] } | null> {
  const found = await getActivityBoardId();
  if (!found) return null;
  const { boardId, boardName } = found;

  // Step 1: get columns to build title→id map
  const colData = await gql(`{ boards(ids: [${boardId}]) { columns { id title } } }`);
  const columns: { id: string; title: string }[] = colData?.data?.boards?.[0]?.columns || [];
  const colId = (title: string) => columns.find((c) => c.title === title)?.id || "";

  const vaId          = colId("VA");
  const ertDateId     = colId("ERT Event Date");
  const activityDateId = colId("Date");
  const connReqId     = colId("Connection Req Sent");
  const liEventId     = colId("LI Event Invites Sent");
  const inmailId      = colId("Inmail Sent");
  const connMadeId    = colId("# Connections made");

  const ids = [vaId, ertDateId, activityDateId, connReqId, liEventId, inmailId, connMadeId]
    .filter(Boolean)
    .map((id) => `"${id}"`)
    .join(", ");

  // Step 2: fetch all items
  const itemData = await gql(`{
    boards(ids: [${boardId}]) {
      items_page(limit: 500) {
        items {
          id name
          group { title }
          column_values(ids: [${ids}]) { id text }
        }
      }
    }
  }`);

  const items: {
    id: string; name: string;
    group: { title: string };
    column_values: { id: string; text: string }[];
  }[] = itemData?.data?.boards?.[0]?.items_page?.items || [];

  const num = (text: string) => parseFloat(text) || 0;

  const rows: ActivityRow[] = items.map((item) => {
    const cv = item.column_values;
    const get = (id: string) => cv.find((c) => c.id === id)?.text || "";
    return {
      clientName:     item.group.title,
      date:           item.name,
      activityDate:   get(activityDateId),
      va:             get(vaId),
      ertDate:        get(ertDateId),
      connReqSent:    num(get(connReqId)),
      liEventInvites: num(get(liEventId)),
      inmailSent:     num(get(inmailId)),
      connectionsMade: num(get(connMadeId)),
    };
  });

  return { boardName, rows };
}

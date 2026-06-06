import { NextRequest, NextResponse } from "next/server";
import { postToClientBoard, postToMCL } from "@/lib/monday";

export async function GET() {
  const token = process.env.MONDAY_API_TOKEN || "";
  const gql = async (q: string) => {
    const r = await fetch("https://api.monday.com/v2", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: token },
      body: JSON.stringify({ query: q }),
      cache: "no-store",
    });
    return r.json();
  };
  const data = await gql("{ boards(limit: 500) { id name } }");
  const boards: { id: string; name: string }[] = data?.data?.boards || [];
  const board = boards.find((b) => b.name.toLowerCase() === "master client list");
  if (!board) return NextResponse.json({ error: "MCL board not found" });

  const groupsData = await gql(`{ boards(ids: [${board.id}]) { groups { id title } } }`);
  const groups: { id: string; title: string }[] = groupsData?.data?.boards?.[0]?.groups || [];

  const preview: Record<string, string[]> = {};
  for (const group of groups) {
    const r = await gql(`{ boards(ids: [${board.id}]) { groups(ids: ["${group.id}"]) { items_page(limit: 20) { items { name } } } } }`);
    preview[group.title] = (r?.data?.boards?.[0]?.groups?.[0]?.items_page?.items || []).map((i: { name: string }) => i.name);
  }
  return NextResponse.json({ boardName: board.name, boardId: board.id, groups: groups.map(g => g.title), preview });
}

export async function POST(req: NextRequest) {
  try {
    const { clientName, noteText, target } = await req.json();
    if (!clientName || !noteText) {
      return NextResponse.json({ error: "clientName and noteText required" }, { status: 400 });
    }
    const result = target === "mcl"
      ? await postToMCL(clientName, noteText)
      : await postToClientBoard(clientName, noteText);
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}

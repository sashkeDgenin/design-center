import { loadEverything } from "@/lib/queries";

export const dynamic = "force-dynamic";

/** Non-negotiable: my data, out of the tool, from day one. */
export async function GET() {
  const data = await loadEverything();
  const stamp = new Date().toISOString().slice(0, 10);
  return new Response(JSON.stringify({ exportedAt: new Date().toISOString(), ...data }, null, 2), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "content-disposition": `attachment; filename="leaddesk-${stamp}.json"`,
    },
  });
}

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { LeadDetail } from "@/lib/queries";
import { Card } from "./ui";
import { SendButton } from "./send-button";
import { ReplyHelper } from "./reply-helper";

/**
 * Picks the template for this stage, language and touch number, renders the
 * variables, and puts the result in a box I can edit before it goes.
 *
 * The edited text is what gets logged and what gets sent: the two can never drift
 * apart, because the same string is passed to the server and turned into the link.
 */
export function Composer({ detail }: { detail: LeadDetail }) {
  const { lead, draft } = detail;
  const [body, setBody] = useState(draft.body);
  const [edited, setEdited] = useState(false);

  // A stage change or a logged send re-renders with a new draft. Adopt it unless I
  // have typed something of my own, which must never be thrown away.
  useEffect(() => {
    if (!edited) setBody(draft.body);
  }, [draft.body, edited]);

  const dead = lead.stage === "poopy";

  return (
    <Card className="p-3.5">
      <div className="mb-2 flex items-baseline gap-2">
        <h2 className="text-sm font-bold">Message</h2>
        <span className="text-[11px] font-medium text-ink-faint">
          follow-up #{draft.touchNumber} · {lead.language.toUpperCase()}
        </span>
        {edited ? (
          <button
            type="button"
            onClick={() => {
              setBody(draft.body);
              setEdited(false);
            }}
            className="ms-auto text-[11px] font-semibold text-brand underline"
          >
            Reset to template
          </button>
        ) : null}
      </div>

      {!draft.hasTemplate ? (
        <p className="mb-2 rounded-lg bg-overdue-bg px-2.5 py-2 text-xs text-overdue">
          No template for <strong>{lead.stage}</strong> yet. Type the message below and it
          will still send and log correctly.
        </p>
      ) : null}

      <textarea
        value={body}
        dir="auto"
        rows={5}
        onChange={(e) => {
          setBody(e.target.value);
          setEdited(true);
        }}
        placeholder="Write the message..."
        className="w-full resize-y rounded-xl border border-line bg-page px-3 py-2.5 leading-relaxed"
      />

      <p className="mb-3 mt-1 text-[11px] text-ink-faint">
        Variables: <code>{"{{name}}"}</code> <code>{"{{interest}}"}</code>{" "}
        <code>{"{{quoted_price}}"}</code>
      </p>

      <SendButton
        leadId={lead.id}
        body={body}
        disabled={dead || body.trim() === ""}
        disabledReason={
          dead
            ? "This lead is marked Poopy. Change the stage if you want to chase it again."
            : body.trim() === ""
              ? "Write something first."
              : undefined
        }
      />

      <p className="mt-2 text-center text-[11px] text-ink-faint">
        Logs the touch, then opens WhatsApp. You still press send yourself.
      </p>

      <div className="mt-3 border-t border-line pt-3">
        <ReplyHelper
          leadId={lead.id}
          onUse={(text) => {
            setBody(text);
            setEdited(true);
          }}
        />
      </div>

      {detail.templatesForStage.length > 1 ? (
        <details className="mt-3 border-t border-line pt-2">
          <summary className="cursor-pointer text-xs font-semibold text-ink-soft">
            Other templates for this stage ({detail.templatesForStage.length})
          </summary>
          <ul className="mt-2 space-y-1.5">
            {detail.templatesForStage.map((t) => (
              <li key={t.id}>
                <button
                  type="button"
                  onClick={() => {
                    setBody(
                      t.body
                        .replace(/\{\{\s*name\s*\}\}/g, lead.name)
                        .replace(/\{\{\s*interest\s*\}\}/g, lead.interest)
                        .replace(
                          /\{\{\s*quoted_price\s*\}\}/g,
                          lead.quotedPrice == null ? "" : `₪${lead.quotedPrice.toLocaleString("en-US")}`,
                        ),
                    );
                    setEdited(true);
                  }}
                  dir="auto"
                  className="w-full rounded-lg border border-line bg-page px-2.5 py-1.5 text-start text-xs text-ink-soft"
                >
                  <span className="font-semibold text-ink">#{t.touchNumber} {t.language.toUpperCase()}</span>{" "}
                  {t.body}
                </button>
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </Card>
  );
}

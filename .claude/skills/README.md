# Installed skills: mattpocock/skills

Matt Pocock's "Skills For Real Engineers" set, installed into this repo as
project-level Agent Skills. Every skill directory here is a verbatim copy of a
skill from the upstream repo's **promoted** buckets (`skills/engineering/` and
`skills/productivity/`), which is exactly the set the `mattpocock-skills`
Claude Code plugin ships.

- Upstream: https://github.com/mattpocock/skills
- Version installed: plugin `1.2.3`
- License: MIT (see [LICENSE](./LICENSE))

Skills from the upstream `misc/`, `in-progress/`, and `deprecated/` buckets are
deliberately not installed. Upstream does not promote them, and the plugin does
not ship them.

## Layout

Upstream nests skills under bucket folders. Agent harnesses expect a flat skill
directory, so the buckets are flattened here: `skills/engineering/tdd/` becomes
`tdd/`. Nothing else is changed, and no skill referred to another skill by
relative path, so the flattening is lossless. Each skill keeps its sibling
reference files (`tests.md`, `PHASE-BOUNDARIES.md`, `scripts/`, and so on) and
its `agents/openai.yaml`, which is what Codex and other Agent Skills harnesses
read.

## Start here

1. Run `/setup-matt-pocock-skills` once in this repo. It configures the issue
   tracker, the triage label vocabulary, and where domain docs live. The other
   engineering skills assume those files exist.
2. Run `/ask-matt` whenever you are unsure which skill fits. It is the router
   over everything installed here, and it maps the flows they form.

## The skills

**User-invoked** skills are reachable only when you type them. They orchestrate.
**Model-invoked** skills can be typed by you or reached for automatically when
the task fits. They hold the reusable discipline.

### Engineering

User-invoked: `ask-matt`, `grill-with-docs`, `triage`,
`improve-codebase-architecture`, `setup-matt-pocock-skills`, `to-spec`,
`to-tickets`, `implement`, `wayfinder`.

Model-invoked: `prototype`, `diagnosing-bugs`, `research`, `tdd`,
`domain-modeling`, `codebase-design`, `code-review`,
`resolving-merge-conflicts`, `wizard`.

### Productivity

User-invoked: `grill-me`, `handoff`, `teach`, `to-questionnaire`, `wait-what`.

Model-invoked: `grilling`, `writing-for-agents`.

## The main flow

The route most work travels, per `ask-matt`:

`/grill-with-docs` sharpens the idea by interview, leaving a paper trail in
`CONTEXT.md` and ADRs. Multi-session builds then go `/to-spec` to
`/to-tickets` to `/implement` per ticket, clearing context between each.
Single-session work goes straight to `/implement`. Either way `/implement`
drives `/tdd` internally one red-green slice at a time, then closes out with
`/code-review` before committing.

Three on-ramps merge onto that flow: `/triage` for incoming issues you did not
write, `/diagnosing-bugs` for something already broken, and `/wayfinder` for an
effort too big to hold in one session.

## Updating

These are ordinary files you own and can edit, so nothing updates behind your
back. To pull upstream's latest into this tree:

```bash
npx skills@latest update <name>
```

Do not also install the Claude Code plugin (`claude plugins install
mattpocock-skills`). The plugin is a managed read-only bundle; this install is
editable copies. Running both leaves you with every skill twice.

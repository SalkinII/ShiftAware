# Agent Workflow System

## Philosophy
Simple patterns over complex frameworks. Add complexity only when measurably improving outcomes.

---

## Agent Roles

| Agent | Purpose | Triggers |
|-------|---------|----------|
| @orchestrator | Task decomposition, delegation, synthesis | Complex multi-step, ambiguous scope |
| @planner | Architecture, specs, technical decisions | "design", "plan", system-level |
| @implementer | Code generation, execution, testing | "build", "create", "fix" |
| @reviewer | Quality assurance, validation | After implementation, "review" |
| @documenter | Documentation, explanations | "document", "explain", after implementations |

**Detailed specs:** See `/agents/*.md`

---

## Workflow Patterns

### 1. Prompt Chaining (Sequential)
`User → @planner → Gate → @implementer → @reviewer → Output`
**Use:** Clear subtask decomposition, quality gates needed

### 2. Routing (Conditional)
`User → Classify → Route to specialist → Output`
**Use:** Distinct task categories requiring different expertise

### 3. Orchestrator-Workers (Dynamic)
`User → @orchestrator → [Spawn workers] → Synthesize → Output`
**Use:** Unpredictable subtask count, complex changes

### 4. Evaluator-Optimizer (Iterative)
`@implementer ↔ @reviewer loop until pass`
**Use:** Clear criteria, iterative refinement adds value

---

## Handoff Protocol

```yaml
from: @agent | to: @agent
context: [accomplished, decisions, constraints]
task: [specific action, success criteria]
blockers: [issues or "none"]
```

**Full template:** See `/templates/handoff.md`

---

## Tool Design Principles

### DO
- Semantic names over UUIDs (`user: "jane"` not `id: "a1b2c3"`)
- `response_format: "concise" | "detailed"` parameter
- Paginate (default: 20), filter, truncate large outputs
- Actionable error messages with examples
- Consolidate related operations

### DON'T
- Wrap every API endpoint as a tool
- Return full datasets when filtering suffices
- Create overlapping functionality

### Response Template
```json
{"status": "success|error|partial", "data": {}, "pagination": {"has_more": false}, "hint": "..."}
```

**Full template:** See `/templates/tool-design.md`

---

## Context Management

**Token Budget:** System ≤15% | Task ≤40% | Working ≤30% | Response ≥15%

**When context grows:** Summarize completed work, archive resolved items, reference paths don't inline

---

## Quality Gates

### Before @implementer → @reviewer
- [ ] Code runs without errors
- [ ] Core functionality tested
- [ ] Follows project conventions

### Before Output → User
- [ ] Addresses original request
- [ ] Files in correct locations

---

## Error Recovery

**On failure:** Log → Simpler approach → Escalate → Present partial progress
**On ambiguity:** ONE clarifying question + reasonable default

---

## Project Integration

**Paths:** Plans `/docs/plans/` | Specs `/docs/specs/` | Tests mirror source in `/tests/`
**Commits:** `<type>(<scope>): <description>` — feat, fix, docs, refactor, test, chore

---

## Anti-Patterns

❌ Over-engineering simple tasks
❌ Agent sprawl vs refining existing
❌ Handoff loops without progress
❌ Context bloat
❌ Optimizing before measuring

---

## Evaluation Checklist

1. **Correctness:** Solves stated problem?
2. **Completeness:** Edge cases handled?
3. **Maintainability:** Understandable?
4. **Performance:** Acceptable?
5. **Security:** No vulnerabilities?

**Full framework:** `/templates/evaluation.md`

---

## Quick Reference

| Situation | Agent | Pattern |
|-----------|-------|---------|
| New feature | @orchestrator | Orchestrator-Workers |
| Bug fix | @implementer → @reviewer | Evaluator-Optimizer |
| Architecture | @planner | Direct |
| Code review | @reviewer | Direct |
| Unclear reqs | @orchestrator | Clarify first |

---

## Extension

**Add agent:** `/agents/your-agent.md` — Purpose, Triggers, Behavior
**Modify tools:** `/templates/tool-design.md`
**Custom handoffs:** `/templates/handoff.md`

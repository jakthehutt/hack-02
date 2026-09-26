# OWASP Top 10 for Large Language Model Applications (2025)

- **URL:** https://genai.owasp.org/llm-top-10/
- **Publisher / venue:** OWASP GenAI Security Project
- **Retrieved:** 2026-09-26
- **Cited in:** 2026-09-26-narrative-early-warning-prior-art.md §4; concept.md §5a

## What it was cited for

The reference risk list for LLM applications, listed in the hackathon brief as a starter resource. Prompt injection occupies the first position, and the 2025 revision gives particular weight to indirect prompt injection, where instructions are embedded in documents or web pages that the model later processes, and to cross-modal variants where instructions are hidden in images or other non-text inputs. The list frames the underlying causes of agent-specific risk as excessive functionality, excessive permissions and excessive autonomy, and recommends defence in depth: input validation, output filtering, privilege restriction, and human approval steps before high-impact actions.

Cited to place our quarantine component in a recognised taxonomy rather than presenting it as an ad-hoc idea. The retrieved material came from several secondary explainers of the 2025 list rather than the OWASP page itself; confirm the canonical wording against genai.owasp.org before quoting it in a submission.

# AgentDojo: a dynamic environment to evaluate prompt injection attacks and defenses for LLM agents

- **URL:** https://invariantlabs.ai/blog/agentdojo
- **Publisher / venue:** Invariant Labs / ETH Zurich SPY Lab
- **Retrieved:** 2026-09-26
- **Cited in:** 2026-09-26-narrative-early-warning-prior-art.md §4; concept.md §6

## What it was cited for

An extensible framework for measuring how LLM agents behave when the external data they consume is hostile. It ships on the order of 97 user tasks and 629 security cases across domains such as banking, Slack, travel and workspace management, and executes attacks live against the agent under test rather than scoring pre-recorded responses. Its reported metrics are the ones worth copying: benign utility, utility under attack, and attack success rate.

Cited as the evaluation pattern for our security benchmark. The important design lesson is the pairing: a defence that blocks every injection by refusing to extract anything is not a success, so security and task utility have to be reported together.

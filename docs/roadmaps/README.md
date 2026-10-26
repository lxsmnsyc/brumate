# Roadmaps

Planned work, as a graph of nodes that agents can work on at the same time. [brumate](./brumate/GOAL.md) holds the whole plan, grouped into milestones: core-correct, agent-skill, ui-0.1, smaller-client, features and backlog. Each node is a folder under `brumate/nodes/`. Its status is the `status` field of its brief, and nowhere else.

[Proposals](../proposals.md) hold the design of each feature. The roadmap decides what is built and in what order. Far-off proposals are outline nodes: a goal and rough edges, broken into briefs when a milestone reaches them.

Status: `python3 ~/.claude/plugins/marketplaces/lxsmnsyc-agent-skills/skills/parallel-roadmap/scripts/plan.py docs/roadmaps/brumate status`. Outlines due for a brief: `plan.py docs/roadmaps/brumate refine`.

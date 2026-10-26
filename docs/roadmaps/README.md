# Roadmaps

Planned work, as graphs of nodes that agents can work on at the same time. Each roadmap has a GOAL.md and one folder for each node under `nodes/`. The status of a node is the `status` field of its brief, and nowhere else.

[Proposals](../proposals.md) hold the design of each feature. The roadmaps decide what is built and in what order.

| Roadmap                                  | Outcome                                                                                                              |
| ---------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| [ui-release](./ui-release/GOAL.md)       | @brumate/ui ready to publish: props types, `as` and `ref` on the parts, complete docs, a landing page, website fixes |
| [core-next](./core-next/GOAL.md)         | A core that is safe to change, ordered updates, batching and `$searchParam`                                          |
| [client-size](./client-size/GOAL.md)     | A smaller client, and spikes for functions for values and component inlining                                         |
| [agent-support](./agent-support/GOAL.md) | A skill, llms.txt, `brumate check`, and accessibility checks in tests                                                |

[inbox.md](./inbox.md) lists the proposals that wait for an app to need them, and those already built.

Status: `python3 ~/.claude/plugins/marketplaces/lxsmnsyc-agent-skills/skills/parallel-roadmap/scripts/plan.py docs/roadmaps/<roadmap> status`.

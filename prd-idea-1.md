## 🥇 1. Requirement → Development Change Control

**Problem:**

> For Agile/Scrum SDLC. Requirements constantly change, but development teams don't have a reliable mechanism to track changes, impact, ownership and approval.
> For fast paced development sometimes developer got blamed, who change this, etc, have not enough evidence to justify, usually it noticed in production.

**Core value:**

> Prevent "I never said that" / "that's not what the requirement said" situations.
> Track all versioning, support backward etc

**Goals & Feature I want:**
> I think about making it cli, we can install using pnpm or etc, or maybe as docker image to run the DB Qdrant for ingested information & Postgres for memory or something like that (or maybe can run in VPS), i'm open to every available option, or maybe like a skills
> I want it seamlessly works with any agent harness, let's i can ask opencode to execute directly for the output. Or i can use opencode grill-me to refer the output to become detailed plan. then i use tools liek trellis to execute it, something like that.
> If one phase clear, it can automatically update the tracking, or we can do manually trigger it, also maybe it's good to check git commit on specific branch across all repos (maybe we can trigger it to create branch using our named convention, so it can verify it in our local git branch if our changes is align & good)
> Track all changes, or maybe api collection (if BE), payload changes or page (if FE), page impacted, tec.
> JIRA integration, can add comments with tracked id timestamp pic & final .md & 
> Expose MCP for publisher/consumer
> Have a chatbot to asking our change (maybe BA or SA can use it reference by ticket number & it's related ticket)
> Common flow at least for me: Got a ticket, doing gromming with BA, asking all edge case, rules, etc, usually there's an MD or PDF that contain FSD and BRD. im doing planning in notepad, do execution in my own style, maybe the ticket can impact several services: example: config-service to add entity or model, inventory-service: to check the stock, general-setup-service: to add some API, or maybe just add some values of general code, front-office-service: update logic in paid, create table a b c to it. Maybe the output of this docs is sounds like "need to add a, b, c. check current code in front-office is there's available or common tools to be used or reused, minimize changes to other scope if not necessary, if necessary make sure the changes safe"
> But to simplify the idea and the layer so it's not bloated maybe for updating checklist it require manually check. and if ready to test just update it.

**Agentic workflow:**

```
BRD/FSD
 ↓
Requirement extraction
 ↓
Task generation
 ↓
Change detection
 ↓
Impact analysis
 ↓
Task update
```

**Chatbot:**

```bash
"What changed since v1.2?"
"Who requested this?"
"Which APIs are affected?"
"Why does this task exist?"
```

Requirements from Mentor:
- Anvia Ecosystem
- LLM & Agent Development
- PostgreSQL (Optional)
- Hono + BullMQ (Optional)
- Interface Agnostic: Web, Slack, Discord, Desktop, CLI.
- Any LLM Model / Provider
- Agent with Tools calling
- MCP & RAG
- Evals and Observability
- Minimum 1 Agentic + 1 AI Agent

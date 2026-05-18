\# Recommended Core Stack



\## Database

Supabase Postgres



Reasoning:

\- already exists in current stack

\- avoids introducing another CMS

\- supports structured querying

\- enables pgvector later

\- reduces operational complexity



\---



\## Content Shape

Structured JSON validated with Zod schemas.



Reasoning:

\- consistent content structure

\- safer AI generation

\- easier refresh workflows

\- predictable rendering



\---



\## AI Models

Anthropic SDK direct integration.



Model Roles:

\- Sonnet → drafting

\- Opus → editorial critique

\- Haiku → metadata + alt text



Reasoning:

\- simpler than orchestration frameworks

\- lower operational complexity

\- easier debugging


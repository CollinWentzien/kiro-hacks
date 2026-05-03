System Architecture: AI Ecosystem Coach

Architecture Overview:
The system is a full-stack AI chatbot application with a frontend chat interface, backend API, orchestrator-based multi-agent reasoning, retrieval-augmented generation, persistent memory, and a decision engine.

Core Layers:
1. Frontend UI
- chat interface
- recommendation cards
- score displays
- profile and context forms
- image upload support

2. Backend API
- chat endpoint
- diagnosis endpoint
- ecosystem evaluation endpoint
- memory endpoints
- image upload endpoint

3. Orchestrator Agent
- receives user request
- detects intent
- builds shared state
- decides which agents to call
- gathers outputs
- passes outputs to the decision engine

4. Specialized Agents
- Plant Planning Agent
- Sustainability Agent
- Wildlife / Biodiversity Agent
- Diagnosis Agent
- Memory Agent

5. RAG Layer
- retrieves plant care guidance
- retrieves native species references
- retrieves climate, soil, and watering guidance
- retrieves pest, disease, and biodiversity guidance

6. Database + Memory Layer
- PostgreSQL for structured data
- pgvector for retrieval embeddings
- storage for uploaded images
- persistent user memory and history

7. Decision Engine
- merges agent outputs
- resolves conflicts
- prioritizes practical recommendations
- returns a structured result

8. LLM Coach Layer
- converts structured outputs into natural-language chatbot responses

Request Flow:
Frontend -> Backend API -> Orchestrator Agent -> Memory + RAG + Specialist Agents -> Decision Engine -> LLM Coach -> Frontend

Shared State:
The orchestrator maintains shared state containing:
- user message
- intent
- context
- memory
- retrieved knowledge
- agent outputs
- final structured response

MVP Architecture:
Use a modular monolith:
- Next.js frontend
- FastAPI backend
- PostgreSQL
- pgvector
- Supabase or S3 storage
- LangGraph or similar orchestration
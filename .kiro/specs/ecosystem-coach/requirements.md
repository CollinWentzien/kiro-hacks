# Requirements Document

## Introduction

The AI Ecosystem Coach is a conversational AI feature integrated into the Food Chain ecosystem builder application. It acts as an intelligent, persistent advisor that helps users plan gardens and ecosystems, recommend species, evaluate ecological health, diagnose plant problems, and remember the user's history across sessions.

The Coach is powered by a multi-agent architecture with retrieval-augmented generation (RAG), persistent memory, a structured database, a decision engine, and a large language model (LLM) as the user-facing conversational layer. It bridges the gap between the visual ecosystem builder and expert horticultural and ecological knowledge, making professional-grade guidance accessible to hobbyists, educators, and sustainability-minded gardeners.

---

## Target Users

- **Home gardeners** who want to grow food, attract pollinators, or create wildlife-friendly yards
- **Ecosystem hobbyists** building terrariums, aquariums, or pond ecosystems
- **Sustainability-focused users** who want to reduce water use, increase native species, and improve ecological impact
- **Educators and students** using the ecosystem builder as a learning tool
- **Experienced gardeners** who want a second opinion, plant diagnostics, or biodiversity analysis

---

## Main User Journeys

### Journey 1: Garden Planning
A user describes their outdoor space (size, sunlight, climate zone, soil type) and asks the Coach to recommend a planting plan. The Coach suggests compatible species, explains companion planting relationships, and flags potential conflicts.

### Journey 2: Sustainability Evaluation
A user shares their current ecosystem layout. The Coach evaluates water usage, native species ratio, and ecological impact, then suggests improvements to increase sustainability.

### Journey 3: Biodiversity and Health Check
A user asks the Coach to assess the health of their ecosystem. The Coach scores biodiversity, identifies missing trophic layers, and recommends additions to improve ecological balance.

### Journey 4: Pollinator and Habitat Support
A user wants to attract pollinators or support local wildlife. The Coach recommends plants and habitat features that support bees, butterflies, birds, and other beneficial species.

### Journey 5: Plant Problem Diagnosis
A user describes symptoms (yellowing leaves, wilting, spots) or uploads a photo. The Coach diagnoses the likely cause and recommends treatment or remediation steps.

### Journey 6: Returning User Continuity
A returning user asks what they should plant next season. The Coach recalls what the user planted before, what failed, and prior recommendations, then provides contextually relevant advice.

---

## MVP Features

- Conversational chat interface embedded in the ecosystem builder
- Plant and species recommendations based on sunlight, spacing, compatibility, and seasonality
- Basic sustainability evaluation (water use, native vs. non-native ratio)
- Biodiversity scoring based on trophic levels and species diversity
- Pollinator-friendly and habitat-supportive recommendations
- Text-based plant problem diagnosis from described symptoms
- Persistent memory of user's planted species and past recommendations
- RAG-backed knowledge base covering common garden plants, companion planting, and ecological relationships

## v2 Features

- Photo-based plant problem diagnosis using vision model integration
- Climate zone and soil type personalization from user profile
- Seasonal planting calendar with reminders
- Integration with external plant databases (e.g., USDA PLANTS, iNaturalist)
- Multi-garden project management (track multiple distinct ecosystems per user)
- Exportable planting plans and ecosystem reports
- Community-contributed plant data and user reviews
- Advanced ecological simulation (predict ecosystem changes over time)
- Voice interface for hands-free garden use

---

## Glossary

- **Coach**: The AI Ecosystem Coach — the LLM-powered conversational agent that is the primary user-facing interface.
- **Orchestrator**: The multi-agent coordinator that routes user intents to the appropriate specialist agents.
- **Planner_Agent**: The specialist agent responsible for garden and ecosystem planning recommendations.
- **Diagnostics_Agent**: The specialist agent responsible for diagnosing plant problems from symptoms or images.
- **Sustainability_Agent**: The specialist agent responsible for evaluating water use, native species usage, and ecological impact.
- **Biodiversity_Agent**: The specialist agent responsible for evaluating ecosystem health, trophic balance, and species diversity.
- **Memory_Store**: The persistent storage layer that retains user history, planted species, past failures, and prior recommendations across sessions.
- **Knowledge_Base**: The RAG-indexed corpus of horticultural, ecological, and botanical knowledge used to ground Coach responses.
- **Decision_Engine**: The rule-based and heuristic system that evaluates compatibility, spacing, seasonality, and ecological constraints.
- **User_Profile**: The stored record of a user's location, climate zone, garden conditions, preferences, and history.
- **Ecosystem**: A user-defined collection of species placed in the visual builder, representing a garden, terrarium, aquarium, or pond.
- **Trophic_Level**: The position of a species in the food chain (producer, primary consumer, secondary consumer, decomposer, apex predator).
- **Native_Species**: A plant or animal species indigenous to the user's geographic region.
- **Companion_Plant**: A plant that provides a measurable benefit (pest deterrence, nitrogen fixation, pollinator attraction) when grown near another specific plant.
- **Biodiversity_Score**: A numeric value from 0 to 100 representing the ecological diversity and health of a user's ecosystem.
- **Sustainability_Score**: A numeric value from 0 to 100 representing the ecological sustainability of a user's ecosystem, factoring in water use, native species ratio, and soil health.

---

## Requirements

### Requirement 1: Conversational Chat Interface

**User Story:** As a gardener, I want to chat with an AI coach in natural language, so that I can get personalized gardening advice without needing expert knowledge.

#### Acceptance Criteria

1. THE Coach SHALL accept free-text user messages of up to 4,000 characters.
2. WHEN a user submits a message, THE Coach SHALL return a response within 10 seconds under normal load conditions.
3. THE Coach SHALL maintain conversational context across all messages within a single session.
4. WHEN a user's message is ambiguous, THE Coach SHALL ask one targeted clarifying question before proceeding.
5. THE Coach SHALL format responses using plain prose, bullet lists, or structured sections appropriate to the content type.
6. IF a user submits a message in a language other than English, THEN THE Coach SHALL respond in the same language as the user's message.

---

### Requirement 2: Plant and Species Recommendations

**User Story:** As a gardener, I want the Coach to recommend plants suited to my conditions, so that I can make informed planting decisions.

#### Acceptance Criteria

1. WHEN a user requests plant recommendations, THE Planner_Agent SHALL return a ranked list of at least three species with justifications.
2. WHEN generating recommendations, THE Decision_Engine SHALL filter candidates by the user's specified sunlight level (full sun, partial shade, full shade).
3. WHEN generating recommendations, THE Decision_Engine SHALL filter candidates by the user's specified climate zone.
4. WHEN generating recommendations, THE Decision_Engine SHALL apply spacing constraints so that no two recommended plants have overlapping mature canopy radii within the user's stated garden dimensions.
5. WHEN generating recommendations, THE Decision_Engine SHALL include seasonality data indicating the planting window and expected bloom or harvest period for each recommended species.
6. WHEN a user's ecosystem already contains species, THE Planner_Agent SHALL evaluate compatibility between existing and recommended species and flag any known antagonistic relationships.
7. WHERE companion planting is enabled, THE Planner_Agent SHALL identify and highlight Companion_Plant relationships among recommended species.
8. IF a recommended species is known to be invasive in the user's region, THEN THE Planner_Agent SHALL include a prominent warning and suggest a non-invasive alternative.

---

### Requirement 3: Sustainability Evaluation

**User Story:** As an environmentally conscious gardener, I want the Coach to evaluate the sustainability of my ecosystem, so that I can reduce my environmental footprint.

#### Acceptance Criteria

1. WHEN a user requests a sustainability evaluation, THE Sustainability_Agent SHALL compute a Sustainability_Score between 0 and 100 for the user's current Ecosystem.
2. THE Sustainability_Agent SHALL factor water consumption estimates, native species ratio, and soil health indicators into the Sustainability_Score calculation.
3. WHEN the Sustainability_Score is below 50, THE Sustainability_Agent SHALL provide at least three specific, actionable recommendations to improve the score.
4. WHEN the native species ratio in a user's Ecosystem falls below 30%, THE Sustainability_Agent SHALL recommend at least two Native_Species alternatives for the lowest-scoring non-native plants.
5. THE Sustainability_Agent SHALL classify each species in the Ecosystem as low, medium, or high water use and present a summary of the Ecosystem's total estimated water demand.
6. WHEN a user adds or removes a species from the Ecosystem, THE Sustainability_Agent SHALL recalculate and update the Sustainability_Score within 3 seconds.

---

### Requirement 4: Biodiversity and Ecosystem Health Evaluation

**User Story:** As an ecosystem builder, I want the Coach to assess the biodiversity and health of my ecosystem, so that I can create a balanced and resilient environment.

#### Acceptance Criteria

1. WHEN a user requests a health evaluation, THE Biodiversity_Agent SHALL compute a Biodiversity_Score between 0 and 100 for the user's current Ecosystem.
2. THE Biodiversity_Agent SHALL evaluate Trophic_Level representation and reduce the Biodiversity_Score when one or more Trophic_Levels are absent from the Ecosystem.
3. WHEN the Biodiversity_Score is below 60, THE Biodiversity_Agent SHALL identify the specific gaps (missing trophic layers, low species count, monoculture risk) and recommend additions.
4. THE Biodiversity_Agent SHALL detect and flag monoculture conditions when more than 60% of producer species in the Ecosystem belong to the same plant family.
5. WHEN a user adds a species that creates a predator-prey imbalance (a predator with no prey present), THE Biodiversity_Agent SHALL surface a warning within the Coach interface.
6. THE Biodiversity_Agent SHALL present a trophic breakdown showing the count and percentage of species at each Trophic_Level in the user's Ecosystem.

---

### Requirement 5: Pollinator and Habitat Support Recommendations

**User Story:** As a wildlife-friendly gardener, I want the Coach to recommend plants and features that support pollinators and local habitat, so that I can contribute to local biodiversity.

#### Acceptance Criteria

1. WHEN a user requests pollinator-friendly recommendations, THE Planner_Agent SHALL return species that provide nectar, pollen, or larval host resources for bees, butterflies, or moths.
2. WHEN a user requests habitat support recommendations, THE Planner_Agent SHALL include species that provide nesting sites, shelter, or food sources for birds and beneficial insects.
3. THE Planner_Agent SHALL tag each recommended species with the pollinator or wildlife groups it supports (e.g., honeybees, monarch butterflies, songbirds).
4. WHEN a user's Ecosystem contains fewer than two pollinator-supporting species, THE Coach SHALL proactively suggest adding pollinator-friendly plants without being explicitly asked.
5. WHERE a user's climate zone is specified, THE Planner_Agent SHALL prioritize Native_Species in pollinator and habitat recommendations over non-native alternatives.

---

### Requirement 6: Plant Problem Diagnosis

**User Story:** As a gardener, I want the Coach to diagnose problems with my plants from symptoms I describe, so that I can treat issues before they spread.

#### Acceptance Criteria

1. WHEN a user describes plant symptoms in text, THE Diagnostics_Agent SHALL return a ranked list of up to three probable causes with confidence levels (high, medium, low).
2. THE Diagnostics_Agent SHALL provide a specific treatment or remediation recommendation for each probable cause it identifies.
3. WHEN the Diagnostics_Agent cannot determine a probable cause from the provided symptoms, THE Diagnostics_Agent SHALL request additional information specifying which details would improve the diagnosis.
4. THE Diagnostics_Agent SHALL identify whether a diagnosed problem is likely to spread to other species in the user's Ecosystem and name the at-risk species.
5. IF a diagnosed condition is caused by a notifiable pest or disease in the user's region, THEN THE Diagnostics_Agent SHALL advise the user to contact their local agricultural extension service.
6. WHERE photo upload is enabled (v2), THE Diagnostics_Agent SHALL analyze the uploaded image and incorporate visual evidence into the diagnosis alongside any text description provided.

---

### Requirement 7: Persistent Memory

**User Story:** As a returning user, I want the Coach to remember what I've planted, what failed, and what it recommended before, so that I get advice that builds on my history.

#### Acceptance Criteria

1. THE Memory_Store SHALL persist the user's planted species list, including planting dates and locations, across sessions.
2. THE Memory_Store SHALL persist records of species the user has marked as failed, including the date and any failure reason provided.
3. THE Memory_Store SHALL persist all prior Coach recommendations made to the user, indexed by date and topic.
4. WHEN a user returns to a session, THE Coach SHALL load the user's Memory_Store and incorporate relevant history into its responses without requiring the user to re-explain their context.
5. WHEN the Coach makes a new recommendation, THE Coach SHALL check the Memory_Store and avoid recommending species the user has previously marked as failed, unless the user explicitly requests reconsideration.
6. WHEN a user asks what was recommended previously, THE Coach SHALL retrieve and summarize the relevant prior recommendations from the Memory_Store.
7. THE Memory_Store SHALL retain user data for a minimum of 12 months from the last session activity.
8. WHEN a user requests deletion of their data, THE Memory_Store SHALL permanently remove all records associated with that user within 24 hours.

---

### Requirement 8: Multi-Agent Orchestration

**User Story:** As a product owner, I want the system to use a multi-agent architecture, so that each domain of expertise is handled by a specialized agent and the system can scale independently.

#### Acceptance Criteria

1. THE Orchestrator SHALL classify each incoming user message into one or more intent categories (planning, diagnosis, sustainability, biodiversity, memory retrieval, general query) before routing.
2. WHEN a user message maps to a single intent, THE Orchestrator SHALL route the message to the corresponding specialist agent within 500 milliseconds.
3. WHEN a user message maps to multiple intents, THE Orchestrator SHALL invoke the relevant specialist agents in parallel and synthesize their outputs into a single coherent Coach response.
4. IF a specialist agent returns an error or times out after 8 seconds, THEN THE Orchestrator SHALL return a partial response from available agents and inform the user that some information could not be retrieved.
5. THE Orchestrator SHALL pass the user's User_Profile and relevant Memory_Store context to each specialist agent it invokes.
6. THE Coach SHALL present a unified, coherent response to the user regardless of how many specialist agents contributed to it.

---

### Requirement 9: Retrieval-Augmented Generation (RAG) Knowledge Base

**User Story:** As a product owner, I want the Coach's responses to be grounded in a curated knowledge base, so that recommendations are accurate and traceable.

#### Acceptance Criteria

1. THE Knowledge_Base SHALL index horticultural data covering at minimum: plant care requirements, companion planting relationships, common pests and diseases, and native species by climate zone.
2. WHEN generating a response, THE Coach SHALL retrieve the top five most relevant Knowledge_Base documents and use them to ground its answer.
3. THE Coach SHALL not fabricate species names, botanical classifications, or treatment protocols that are absent from the Knowledge_Base or the LLM's verified training data.
4. WHEN a Coach response is grounded in a specific Knowledge_Base document, THE Coach SHALL be capable of citing the source upon user request.
5. THE Knowledge_Base SHALL support incremental updates so that new plant data can be added without requiring a full re-index.
6. WHEN a user query matches no relevant Knowledge_Base documents with a similarity score above 0.6, THE Coach SHALL acknowledge the knowledge gap and recommend the user consult a specialist.

---

### Requirement 10: Decision Engine

**User Story:** As a product owner, I want a rule-based decision engine to enforce ecological and horticultural constraints, so that the Coach's recommendations are always structurally valid.

#### Acceptance Criteria

1. THE Decision_Engine SHALL maintain a compatibility matrix encoding known antagonistic and synergistic relationships between species in the Knowledge_Base.
2. WHEN evaluating a candidate species for recommendation, THE Decision_Engine SHALL check the compatibility matrix and exclude species with known antagonistic relationships to existing Ecosystem members.
3. THE Decision_Engine SHALL enforce spacing rules by computing the required minimum distance between species based on their mature size data.
4. THE Decision_Engine SHALL evaluate seasonal planting windows and exclude species whose planting season does not overlap with the user's current or target planting date.
5. WHEN the Decision_Engine rejects a candidate species, THE Decision_Engine SHALL record the rejection reason so the Coach can explain it to the user.
6. THE Decision_Engine SHALL be updatable independently of the LLM layer so that rule changes do not require model retraining.

---

### Requirement 11: User Profile Management

**User Story:** As a user, I want the system to store my garden conditions and preferences, so that I don't have to repeat my context every time I use the Coach.

#### Acceptance Criteria

1. THE User_Profile SHALL store the user's geographic location, climate zone, USDA hardiness zone, and garden dimensions.
2. THE User_Profile SHALL store the user's stated soil type, sun exposure levels, and water availability.
3. WHEN a user updates their User_Profile, THE Coach SHALL apply the updated conditions to all subsequent recommendations in the same session.
4. THE User_Profile SHALL store the user's stated preferences including organic-only, native-only, low-water, and pollinator-focus flags.
5. WHEN a user has not set up a User_Profile, THE Coach SHALL prompt the user to provide their location and basic garden conditions before making the first recommendation.

---

## Non-Functional Requirements

### Requirement 12: Performance

**User Story:** As a user, I want the Coach to respond quickly, so that the conversation feels natural and not frustrating.

#### Acceptance Criteria

1. WHEN a user submits a message, THE Coach SHALL return the first token of its response within 3 seconds for 95% of requests under normal load.
2. THE Coach SHALL return a complete response within 10 seconds for 95% of requests under normal load.
3. THE System SHALL support at least 500 concurrent user sessions without degradation of response time beyond the thresholds in criteria 1 and 2.
4. THE Decision_Engine SHALL complete compatibility and spacing evaluations within 200 milliseconds for Ecosystems containing up to 100 species.

---

### Requirement 13: Reliability and Availability

**User Story:** As a user, I want the Coach to be reliably available, so that I can access it whenever I need gardening help.

#### Acceptance Criteria

1. THE System SHALL maintain 99.5% uptime measured on a rolling 30-day window, excluding scheduled maintenance windows.
2. WHEN a scheduled maintenance window is required, THE System SHALL notify users at least 24 hours in advance.
3. IF the LLM provider becomes unavailable, THEN THE System SHALL return a graceful degradation response informing the user of the outage and estimated recovery time.
4. THE Memory_Store SHALL use durable storage with a recovery point objective (RPO) of no more than 1 hour and a recovery time objective (RTO) of no more than 4 hours.

---

### Requirement 14: Security and Privacy

**User Story:** As a user, I want my garden data and conversation history to be kept private, so that my personal information is not exposed.

#### Acceptance Criteria

1. THE System SHALL authenticate all user requests using a token-based authentication mechanism before accessing any user data.
2. THE Memory_Store SHALL encrypt all user data at rest using AES-256 or equivalent.
3. THE System SHALL transmit all data between client and server over TLS 1.2 or higher.
4. THE System SHALL not share a user's Memory_Store data with any other user or third-party service without explicit user consent.
5. THE System SHALL comply with applicable data protection regulations including GDPR and CCPA for users in covered jurisdictions.

---

### Requirement 15: Accuracy and Hallucination Prevention

**User Story:** As a user, I want the Coach's recommendations to be accurate, so that I can trust the advice I receive.

#### Acceptance Criteria

1. THE Coach SHALL ground all species-specific claims (care requirements, toxicity, invasiveness) in Knowledge_Base documents or verified training data before including them in a response.
2. WHEN the Coach is uncertain about a specific claim, THE Coach SHALL express that uncertainty explicitly rather than presenting the claim as fact.
3. THE Coach SHALL not recommend a species as safe for a specific environment (e.g., safe for pets, safe for children) without a corresponding verified record in the Knowledge_Base.
4. THE System SHALL log all Coach responses for quality review, enabling human reviewers to identify and correct systematic inaccuracies.

---

## System Goals

1. **Accessibility**: Make expert-level horticultural and ecological knowledge accessible to users of all experience levels through natural language conversation.
2. **Ecological integrity**: Ensure all recommendations respect ecological relationships, regional constraints, and sustainability principles.
3. **Continuity**: Provide a persistent, evolving coaching relationship that improves in relevance as the user's history grows.
4. **Trustworthiness**: Ground all factual claims in a curated knowledge base and be transparent about uncertainty.
5. **Extensibility**: Design the multi-agent architecture so that new specialist agents, knowledge domains, and data sources can be added without redesigning the core system.
6. **Integration**: Operate as a seamlessly embedded feature within the existing Food Chain ecosystem builder, sharing species data and ecosystem state with the visual canvas.

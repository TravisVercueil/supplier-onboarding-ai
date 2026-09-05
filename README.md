# Supplier onboarding AI

A document review workspace that extracts supplier information, traces each field to its evidence and routes incomplete or conflicting applications for review.

## Status

Project selected for Travis Vercueil’s portfolio. Initial scope is documented; the full application is not yet built or deployed.

## Demonstration

Upload a synthetic supplier pack with conflicting registration details and a missing document. Inspect cited evidence, correct a field and complete a human review.

## Proposed implementation

Proposed: Python document-processing worker, PostgreSQL and a TypeScript/React interface. Select provider and hosting when implementing the first vertical slice.

## Acceptance criteria

- Start with three synthetic document types: registration certificate, bank confirmation and onboarding form.
- Extracted fields retain document version, page and evidence text.
- Missing and contradictory evidence produces review tasks rather than invented values.
- Tenant and reviewer permissions are enforced before retrieval and document access.
- Measure field accuracy and conflict detection on a held-out labelled dataset; show latency and model cost.

## Delivery

1. Implement one reproducible vertical slice with synthetic fixtures.
2. Add persistence, a usable review interface and meaningful failure-path tests.
3. Add AI where it improves the workflow, with a non-AI baseline and evaluation results.
4. Deploy an isolated demo and record a short walkthrough.
5. Publish an architecture case study with measured results before replacing the existing portfolio entry.

Original implementation only. No employer code, customer records or internal operational data. Repository visibility starts private; a later public release can be considered when the demo is ready.

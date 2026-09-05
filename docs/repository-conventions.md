# Repository conventions

These projects use a deliberately small subset of conventions found in maintained full-stack sample applications. A portfolio reviewer should be able to understand the problem, reproduce the demo and inspect meaningful verification without reverse-engineering the repository.

## Required evidence

- README: product purpose, actual implementation status, stack, quickstart, test commands, demo walkthrough, architecture decisions and limitations.
- Reproducible dependencies: runtime versions, committed lockfiles or pinned requirements, environment example without credentials.
- Reviewable delivery: feature branch, PR describing behavior and tests, CI before squash merge into main.
- Focused verification: business invariants and failure paths, API integration, frontend type checking and production build. Database behavior is verified against PostgreSQL as well as the explicitly documented local demo database where applicable.
- Safe demo: synthetic data, explicit sandbox labels, bounded operations and no API secrets in the browser bundle.

## Sources reviewed

- [GitHub repository best practices](https://docs.github.com/en/repositories/creating-and-managing-repositories/best-practices-for-repositories): README, security guidance and branch/PR workflow.
- [Spring Petclinic](https://github.com/spring-projects/spring-petclinic): documented quickstart, Maven wrapper, tests and alternate database profiles.
- [Full Stack FastAPI Template](https://github.com/fastapi/full-stack-fastapi-template): frontend/backend boundaries, reproducible dependencies, testing and Docker development documentation. Referenced for repository organisation; this project does not adopt its complete template or imply use of FastAPI.

Repository setup does not imply production readiness. Private-repository security and branch-protection features depend on the account plan; unavailable controls must not be described as enabled. Avoid badges for checks that have not run, invented performance numbers and infrastructure unrelated to the demonstrated workflow.

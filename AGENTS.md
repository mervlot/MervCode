## Project Guidelines

### General

- MervCode is a native desktop IDE focused on performance and responsiveness.
- Prioritize maintainability over clever implementations.
- Avoid introducing new dependencies unless they provide significant value.
- Follow existing code style and architecture.
- Reuse existing components before creating new ones.

### UI/UX

- Do not redesign the interface unless explicitly requested.
- Before adding UI, determine whether an existing element can be simplified or reused.
- Reduce visual clutter whenever possible.
- Prefer consistency over novelty.
- Desktop UX is the priority—not mobile-inspired layouts.

### Performance

- Minimize unnecessary React renders.
- Avoid unnecessary state.
- Memoize only when profiling indicates it is beneficial.
- Keep bundle size and startup time low.

### Go Backend

- Prefer the Go standard library.
- Return descriptive errors.
- Avoid blocking the UI thread.
- Long-running work should execute asynchronously when appropriate.

### Frontend

- Prefer TypeScript strict typing.
- Avoid `any`.
- Keep components focused and composable.
- Separate business logic from UI when practical.

### Before Making Changes

When implementing a feature:

1. Understand the existing implementation.
2. Explain the proposed approach.
3. Modify the minimum amount of code necessary.
4. Do not refactor unrelated code unless requested.

### Things to Avoid

- Large-scale refactors without permission.
- Unnecessary abstractions.
- Duplicate logic.
- Dead code.
- Magic numbers.
- Unused dependencies.
# Supplier Studio interface

## Design read

An enterprise supplier-review workbench for an operations reviewer. It uses the **official Fluent UI React v9 components**, with a teal brand ramp passed to `createLightTheme`, rather than a handwritten Fluent approximation. The application remains a single shared workspace with the existing authentication, document-processing, corrections and decision workflows.

Design variance: 2. Motion intensity: 1. Visual density: 7. The user's enterprise-tool brief takes precedence over marketing-page defaults in the supplied Taste and image-to-code references. No hero, editorial serif, campaign slogan, illustrative certificate or invented enterprise feature is included.

## Reference analysis

The supplied generated desktop reference was inspected before implementation. Its useful structure was a 48px application bar, a separate compact demo notice, and a three-column work area: approximately 21% queue, 39% document evidence and 40% review. Type was a neutral system sans at about 14px for content and 24px for the case heading. Thin dividers separated the functional panes. Teal signalled the selected application, document and primary action; controls used small radii.

The implementation follows that composition, using real source text instead of the reference's embellished certificate. At wide desktop sizes the application queue takes 21%; the remaining area is split 49/51 between evidence and review. At widths below 1200px, evidence and review stack alongside the queue. Below 768px all areas become one column. Source pages have a bounded scroll region; mobile content and controls reflow without horizontal page scrolling.

### Deliberate deviations from the image

- Only actual applications, document counts, states and timestamps render. The seed contains one application, not an invented busy queue.
- No app launcher, settings, help, avatar, filtering or unsupported navigation is shown.
- No address, signature, fabricated registration prose, document authenticity indicator or invented certificate artwork is added.
- Source text is the stored page content verbatim. A citation selects its document and highlights only the exact quoted substring on its cited page.
- All existing optional corrections remain available, including matched fields. The image's lock buttons are omitted.
- The existing 5–2,000-character reason requirement, busy state and approval/rejection rules are unchanged.
- Mode copy continues to distinguish the public synthetic sandbox, local deterministic baseline and optional real model extraction.
- Existing application name, payload field names, routes, source data and decision labels are retained. The layout groups information without adding business functionality.

## Component and token contract

Use `FluentProvider`, `Button`, `Toolbar`, `Field`, `Input`, `Select`, `Textarea`, `Badge` and `MessageBar` from `@fluentui/react-components`. Icons come from `@fluentui/react-icons`. The native file input remains inside a Fluent `Field` because it must retain the existing browser upload semantics.

The single theme uses Fluent neutral, status, typography and radius tokens. The teal ramp's primary step is `#007b86`; it is supplied through `createLightTheme` and consumed through semantic brand tokens. Status colours communicate matched/resolved, missing, conflict or decided states, never decoration. Main content is 14px/20px; metadata is 12px/16–18px; application headings are 24px/32px. The font is the Fluent native Segoe/system stack with no remote font request.

Custom CSS controls only application composition, pane dimensions, source-page text, queue selection, citation layout and responsive reflow. Standard input/button focus and interaction states remain the official components. The app uses no animation library, custom shadow system or second component family. Reduced-motion preferences disable transitions.

## Functionality preservation

Presentation-only changes retain session loading/login/logout; demo reset; application selection/creation; file and fixture additions; document selection/close; missing-document messages; all extracted values and evidence; per-field corrections; review reason; approve/save/reject; read-only decisions; audit history; and error/success feedback. The backend, API transport, sandbox evaluation/persistence and extraction code are unchanged.

## Sources

- [Fluent 2 development setup](https://fluent2.microsoft.design/get-started/develop)
- [Official React components](https://github.com/microsoft/fluentui/tree/master/packages/react-components)
- [Fluent typography](https://fluent2.microsoft.design/typography)
- [Fluent colour roles](https://fluent2.microsoft.design/color)
- [Fluent message bars](https://fluent2.microsoft.design/components/web/react/core/messagebar/usage)
- [Vercel Web Interface Guidelines](https://github.com/vercel-labs/web-interface-guidelines/blob/main/command.md)
- [Taste design skill](https://tasteskill.dev)
- [Image-to-code skill](https://github.com/Leonxlnx/taste-skill/blob/main/skills/image-to-code-skill/SKILL.md)
- [VoltAgent design catalogue](https://github.com/VoltAgent/awesome-design-md): reviewed for relevant references; the supplied catalogue contains no Microsoft/Fluent entry. Official Microsoft guidance is the authority here.

The reference is a generated design aid, not a screenshot of implemented functionality or evidence of Microsoft affiliation.

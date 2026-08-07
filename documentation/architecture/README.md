# Bibliosoph Architecture

State-of-now documentation, written from the source rather than from plans. If a document here disagrees with the code, the document is wrong — fix it.

| Document | Covers |
|---|---|
| [architecture-bibliosoph](architecture-bibliosoph.md) | Module shape, boot, Blacksmith integration, toolbar, settings, typed pages, sockets |
| [architecture-injuries](architecture-injuries.md) | Injury schema, triggers, application, ticks, expiry, unwind, treatment rolls |
| [architecture-outcomes](architecture-outcomes.md) | Criticals and fumbles — one schema, two kinds |
| [architecture-inspiration](architecture-inspiration.md) | Inspiration cards as real inventory items |
| [architecture-toasts](architecture-toasts.md) | Channels, roll toasts, social toasts, the socket relay |
| [architecture-encounters](architecture-encounters.md) | Quick Encounter: cache, habitats, detection levels, deployment |
| [architecture-messages](architecture-messages.md) | Journal-backed conversations and the Messages window |

## Live contracts

These are not architecture notes — they are the authoring contracts that the generator, validator, and page sheets all read from. Keep them current.

- [spec-injury-schema](../spec-injury-schema.md)
- [spec-outcome-schema](../spec-outcome-schema.md)
- [spec-inspiration-schema](../spec-inspiration-schema.md)

## Elsewhere

- Suite ownership rules: [architecture-ownership](../../../coffee-pub-blacksmith/documentation/architecture/architecture-ownership.md)
- dnd5e condition gotchas: [guide-dnd5e-conditions](../../../coffee-pub-blacksmith/documentation/guides/guide-dnd5e-conditions.md)
- Blacksmith API reference: https://github.com/Drowbe/coffee-pub-blacksmith/wiki

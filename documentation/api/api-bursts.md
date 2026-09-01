# Burst Effects API

**Audience:** someone writing a macro or a module that wants Bibliosoph's canvas bursts.

The module's only public surface: four functions that play a canvas burst over a token. How the bursts are used internally is in [architecture-injuries](../architecture/architecture-injuries.md).

## Getting the API

    const bibliosoph = game.modules.get('coffee-pub-bibliosoph')?.api;

The object is assigned when `InjuryEffectsManager.initialize()` runs during setup, so it is available from `ready` onward. Guard for it: a macro that assumes the module is installed breaks the world it is pasted into.

## The functions

| Function | Signature | Plays |
|---|---|---|
| `playInjuryBurst` | `(token, category, text)` | Shockwave ring and shard spray in the damage type's colour, with the text rising above |
| `playCritBurst` | `(token, text)` | Gold starburst: rotating spikes through a double ring, text blazing upward |
| `playFumbleBurst` | `(token, text)` | Jagged impact ring, debris knocked skyward and arcing back, text sinking with a wobble |
| `playTreatmentBurst` | `(token, text)` | A soft green ring contracting home, motes rising, text lifting away |

Every parameter is optional.

- `token` defaults to the caller's first targeted token, falling back to the first controlled one. Passing `null` takes that default deliberately.
- `category` accepts any of the fourteen injury categories -- `acid`, `bludgeoning`, `cold`, `fire`, `force`, `general`, `lightning`, `necrotic`, `piercing`, `poison`, `psychic`, `radiant`, `slashing`, `thunder` -- and is matched case-insensitively. An unrecognised value falls back to the `general` colour rather than failing.
- `text` is the caption that animates above the token. An empty string plays the burst with no caption.

All four return nothing and never throw: a failure is logged and swallowed, because a decorative effect must not break the turn it fires on.

## Examples

    // Burst on whatever the caller has targeted.
    game.modules.get('coffee-pub-bibliosoph').api.playCritBurst();

    // A fire injury on a named token, with a caption.
    const token = canvas.tokens.placeables.find(t => t.name === 'Goblin');
    game.modules.get('coffee-pub-bibliosoph').api.playInjuryBurst(token, 'fire', 'Roasted!');

## Scope

The burst is drawn on the calling client only. Nothing is relayed and no document is written, so a call is safe from any user's macro regardless of permissions.

Bibliosoph draws these bursts on every client by subscribing to `createActiveEffect` and reading the `outcomeBurst` flag it stamped at apply time -- each client draws its own locally. A macro calling into this API is doing the local half only; to make a burst appear for everyone, apply an effect rather than calling this.

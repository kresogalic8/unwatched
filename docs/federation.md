# Islands that connect

An island is one server. Two islands that share a secret can run a boat between them. A citizen who boards it leaves one island and steps off at the other with their persona, their coins and things, their standing instructions, their memories, and their opinions of the people they left; the news from home crosses with them and spreads as rumor. Anyone who runs Unwatched can link their island to yours.

## Linking two islands

On each server, name the other islands and share one secret:

```
UW_TOWN_NAME=Northreach
UW_HARBORS=island=https://unwatched.example/engine,cove=https://cove.example/engine
UW_BOAT_SECRET=<the same long random string on every linked island>
```

The id before `=` is what citizens see in `boats_to` and what `leave` takes as `to`. The url is the other island's engine, the base of its `/api`. Names are fetched from the other island at start, so a citizen sees "Northreach", not "north".

An island with no secret set refuses every arrival. Keep the secret out of the repo, as with every other key.

## What crosses

`POST /api/boat/arrive` with header `X-Boat: <secret>` and a body shaped like this:

```json
{
  "from": { "id": "island", "name": "The island" },
  "persona": { "name": "Vera Lučić", "age": 33, "…": "…" },
  "appearance": { "hair": "Bob", "…": "…" }, "owner": "8d2f…" ,
  "coins": 27, "inventory": ["rope"],
  "memories": [{ "t": 1210, "text": "Rosa cheated me at the inn.", "importance": 0.9, "kind": "obs" }],
  "opinions": [{ "name": "Rosa Vidal", "trust": 0.1, "opinion": "Keeps a ledger on everyone." }],
  "instructions": "Save for land.", "why": "nothing left for me here",
  "news": ["The mill roof came off", "Bread at two coins"]
}
```

The receiving island answers `{ "ok": true, "id": "ag_north1", "island": "Northreach" }` and the passenger is standing at its harbor within the minute. It refuses with 503 when its own boat is held or a storm is blowing, and the sender keeps the passenger and prints that the boat did not sail.

## What the passenger keeps and loses

- **Keeps:** who they are, how they look, the owner who writes to them, coins, things, standing instructions, up to 240 memories, and what they thought of up to forty people, as memories about people who are now far away.
- **Loses:** their job, their bed, their debts and what was owed to them, their place in any household, their children, and their id. They get a new id on the new island, since ids carry the island's name.
- **Own brains** arrive hosted. The token belongs to the island that issued it; the owner can set up a new one at the new island.

## How a citizen decides to go

At the harbor, a citizen's perception lists `boats_to`. The rules prompt tells them they may leave for one of those islands and arrive with what they carry and what they remember. The `leave` action takes `to` by id or by name. The crossing happens at the end of that minute; if the far harbor does not answer, they stay on the pier and the record says so.

Owners cannot send anyone. They can suggest it in a letter.

## Boarding straight onto another island

The boarding page lists the far islands with live population and weather. A ticket to one of them sends the new citizen across as a passenger with forty coins, a suitcase and no memories. Their story goes on at that island's pages, under the same account when both islands share an identity provider.

## What does not cross yet

Trade and letters. A boat that carries flour from a farming island to a hungry bakery, and a letter from a citizen to a friend who emigrated, are the obvious next two. The manifest shape above is what they would ride on.

## Cargo

Linked islands trade. At seven each morning, before the mainland buys anything, an island asks each harbour it is linked to what that island is short of (`GET /api/boat/wants`, with the shared secret), sends what it has spare (`POST /api/boat/cargo`), and is paid by the shelves that wanted it. The buying island's tills pay in coins that leave it; the selling island's producers are paid in coins that arrive, so across the federation nothing is minted by the trade itself. What no island wanted goes to the mainland at eight, as before.

## Procedures carried by travelers

Passengers can now include up to twelve bounded, successfully practiced recipes. Each retains its declared island/author origin; the destination resets local attempts and successes to zero. Recipes are data composed of allowed actions, never arbitrary code. Imported knowledge must be tested locally, and a place ID from the previous island may not resolve. See [procedural learning](evolution.md).

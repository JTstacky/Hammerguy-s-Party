# 🔨 Hammerguy's Party

> **Early access.** The game is playable but still being built. Expect bugs and new minigames.

Hammerguy's Party is a party of chaotic minigames for up to 10 friends, in the browser, inspired by the classic Warcraft III map **Uther Party**:

- **Everyone plays a hammerguy.** Each player is a hammer-wielding paladin.
- **Random minigames.** Games are drawn at random each match.
- **Points for placing.** Place well in each game to earn points; the most points at the end wins.

![Hammerguy's Party](docs/screenshot.png)

**Play:** https://tenggames.com.au/hammerguys-party/

## Minigames

| Minigame | Goal |
|---|---|
| Kodo Stampede | Dodge stampeding kodo beasts. Last one standing wins. |
| Mortar Mayhem | Get out of the target circles before the shells land. |
| Wisp Wheel | Slip through the gaps in rotating arms of wisps. |
| Golem Gauntlet | Race to the finish past patrolling golems. |
| King of the Hill | Be closest to the centre of the moving circle. **Q** shoves. |
| Gold Rush | Collect the most gold. **Q** shoves. |
| Ice Sumo | Shove everyone off a shrinking ice floe. |
| Sapper Tag | Pass the goblin sapper bomb before it explodes. |

To add a minigame, create a file in `server/minigames/` that extends `Minigame` (see `server/base.js`), then list it in `server/minigames/index.js`.

## Features

- **Up to 10 players online.** Peer-to-peer multiplayer with no game server: the host's browser runs the party, and friends join with a 4-letter code or an invite link.
- **Bots** in every minigame.
- **Warcraft III feel:** right-click movement with WC3's turn rate and propulsion window.
- **Graphics and sound** are generated in code with Three.js and WebAudio. There are no asset files.

## Development

```bash
npm install
npm run dev        # dev server with hot reload → http://localhost:5173
npm test           # every minigame played by bots + multiplayer test
npm run build      # static site → dist/
```

## Deployment

The game is published on **tenggames.com.au/hammerguys-party/** as part of the Teng Games site ([JTstacky/Chess-tutor](https://github.com/JTstacky/Chess-tutor)). That site's deploy clones and builds this repo.

On every push to `main`, `.github/workflows/publish.yml` tests and builds, then asks the site to redeploy. That step needs the repository secret `SITE_DISPATCH_TOKEN`: a fine-grained token with access to Chess-tutor only and **Contents: Read and write**. Without the secret, changes go live on the site's next deploy.

## How it works

```
client/   game client: entry (main.js), HUD (hud.js), host worker
server/   party.js: rotation and scoring; base.js: minigame base class; minigames/
engine/   shared engine (also used by Arcane Arena):
          sim, rooms, networking, renderer, input, HUD base
docs/     research.md: findings from the original Uther Party map
```

**Networking.** The host's browser runs the room in a Web Worker, and guests connect over WebRTC via [PeerJS](https://peerjs.com). `server.js` offers the same rooms over WebSockets for self-hosting.

The engine is copied here and in [Arcane Arena](https://github.com/JTstacky/Arcane-Arena). Port engine fixes across when they matter to both games.

## Credits

Inspired by *Uther Party* by TheZizz. Warcraft is a trademark of Blizzard Entertainment. This fan-made game contains no Blizzard assets.

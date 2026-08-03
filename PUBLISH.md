# PUBLISH.md — DailyGive: guía de despliegue paso a paso

Runbook para ejecutar tú mismo (requiere la password del keystore `speedrun` de forma interactiva, y decisiones que solo tú puedes tomar). Sigue el orden: **Sepolia → app en Vercel → verificación de dominio en Farcaster → pruebas end-to-end → (mucho después) Mainnet**.

Estado actual al escribir esto: contratos escritos y con 22 tests en verde (local + fork Sepolia), app Next.js con build/lint en verde. **Nada desplegado todavía.**

---

## 0. Prerrequisitos

- [ ] Keystore `speedrun` importado y accesible: `base-cast wallet address --account speedrun` debe imprimir `0x8F058fE6b568D97f85d517Ac441b52B95722fDDe`.
- [ ] ETH de testnet en esa dirección en Base Sepolia (para gas). Si no tienes, usa un faucet de Base Sepolia.
- [ ] Cuenta en [BaseScan Sepolia](https://sepolia.basescan.org) con una API key (para `--verify`).
- [ ] Cuenta en [Neynar](https://neynar.com) con API key (tier free, 10M créditos/mes).
- [ ] Dominio propio para la mini app (ej. `dailygive.xyz`, ~1€/año). Sin dominio propio verificado, Farcaster no la trata como Mini App real.
- [ ] Cuenta de Farcaster con FID reservada, asociada a la wallet `speedrun` (si no la tienes, créala esta semana).
- [ ] Cuenta en Vercel.
- [ ] (Recomendado) Cuenta en Upstash — se puede crear directamente desde el Vercel Marketplace al añadir la integración de Redis.

---

## 1. Generar la clave `FID_BINDER`

Es una clave separada, de **poder limitado**: solo firma atestaciones `fid ↔ wallet`, nunca mueve fondos ni mintea. No uses el keystore `speedrun` para esto — genera una clave nueva:

```bash
cast wallet new
```

Esto imprime una dirección y una clave privada. Guarda:
- La **dirección** → la necesitarás como `FID_BINDER_ADDRESS` (contratos) y para verificar `fidBinder()` post-deploy.
- La **clave privada** → va SOLO como variable de entorno server-side en Vercel (`FID_BINDER_KEY`). Nunca la pegues en un commit, en `.env` versionado, ni me la pegues a mí en el chat.

---

## 2. Desplegar contratos en Base Sepolia

```bash
cd contracts
```

**2.1 — Verificaciones previas**

```bash
make check-keystore
make check-activation-sepolia   # debe devolver "true"
make check-balance-sepolia      # confirma que hay ETH de testnet
```

**2.2 — Configura tu `.env`** (copia `.env.example` → `.env`, rellena):

```bash
BASESCAN_API_KEY=<tu key de BaseScan Sepolia>
```

`FID_BINDER_ADDRESS` no va en `.env` — se pasa como variable de entorno al comando de deploy (ver `Makefile`), para que quede explícito en cada invocación.

**2.3 — Deploy**

```bash
FID_BINDER_ADDRESS=<dirección del paso 1> make deploy-sepolia
```

Esto ejecuta `script/Deploy.s.sol` con `--account speedrun` (te pedirá la password del keystore de forma interactiva) y `--verify`. Al terminar, Foundry imprime tres direcciones — guárdalas, las necesitas para todo lo siguiente:

```
DailyGive: 0x...
GIVE:      0x...
GIVEN:     0x...
```

**2.4 — Verifica en BaseScan**

Abre `https://sepolia.basescan.org/address/<DailyGive address>` y confirma que el contrato aparece verificado (código fuente legible, no solo bytecode).

**2.5 — Sanity check on-chain**

```bash
base-cast call <DailyGive address> "fidBinder()(address)" --rpc-url https://sepolia.base.org
# debe devolver la dirección del paso 1

base-cast call <DailyGive address> "owner()(address)" --rpc-url https://sepolia.base.org
# debe devolver 0x8F058fE6b568D97f85d517Ac441b52B95722fDDe (la wallet speedrun)
```

---

## 3. Configurar y desplegar la app en Vercel

```bash
cd ../app
```

**3.1 — Variables de entorno.** En el dashboard de Vercel (Project → Settings → Environment Variables) o vía `vercel env add`, añade **todas** las de `.env.example`:

| Variable | Valor |
|---|---|
| `NEXT_PUBLIC_CHAIN_ID` | `84532` |
| `NEXT_PUBLIC_DAILYGIVE_ADDRESS` | dirección del paso 2.3 |
| `NEXT_PUBLIC_GIVE_ADDRESS` | dirección del paso 2.3 |
| `NEXT_PUBLIC_GIVEN_ADDRESS` | dirección del paso 2.3 |
| `NEXT_PUBLIC_APP_URL` | `https://tudominio.xyz` (tu dominio, paso 3.3) |
| `NEYNAR_API_KEY` | de tu cuenta Neynar |
| `NEYNAR_CLIENT_ID` | de tu cuenta Neynar (para el `webhookUrl` del manifest) |
| `FID_BINDER_KEY` | clave privada del paso 1 — **solo aquí, nunca en el repo** |
| `FARCASTER_ACCOUNT_ASSOCIATION_HEADER/PAYLOAD/SIGNATURE` | vacíos por ahora, se rellenan en el paso 4 |
| `NOTIFY_SECRET` | genera uno random: `openssl rand -hex 32` |
| `CRON_SECRET` | genera otro random: `openssl rand -hex 32` |
| `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` | del paso 3.2 |

**3.2 — Añade la integración de Redis.** En el dashboard de Vercel: Project → Storage → Marketplace → busca "Upstash" → crea una base Redis y conéctala al proyecto. Esto autopuebla `UPSTASH_REDIS_REST_URL`/`TOKEN`.

**3.3 — Dominio propio.** Project → Settings → Domains → añade tu dominio, sigue las instrucciones DNS del registrador. Esto puede tardar unos minutos en propagar.

**3.4 — Deploy**

```bash
npx vercel --prod
```

O simplemente haz push a la rama conectada si ya tienes el proyecto vinculado a un repo de Git.

**3.5 — Verifica el manifest**

```bash
curl https://tudominio.xyz/.well-known/farcaster.json
```

Debe devolver JSON válido (con `accountAssociation` aún vacío — eso es el siguiente paso).

---

## 4. Verificación de dominio en Farcaster

Este paso **lo haces tú manualmente**, no es scriptable — Farcaster necesita una firma tuya desde tu cuenta.

1. Abre `https://warpcast.com/~/developers/mini-apps/manifest`.
2. Introduce tu dominio (`tudominio.xyz`).
3. Firma con tu cuenta de Farcaster (la asociada al FID reservado, wallet `speedrun`).
4. La herramienta te da tres valores: `header`, `payload`, `signature`.
5. Pégalos en Vercel como `FARCASTER_ACCOUNT_ASSOCIATION_HEADER`, `_PAYLOAD`, `_SIGNATURE`.
6. Redeploy (`npx vercel --prod` de nuevo, o un redeploy desde el dashboard) para que el manifest los sirva.
7. Repite el `curl` del paso 3.5 — ahora `accountAssociation` debe venir relleno.

---

## 5. Pruebas end-to-end

1. Abre `https://warpcast.com/~/developers/mini-apps/preview?url=https://tudominio.xyz` (Farcaster Preview Tool).
2. Confirma que:
   - El embed carga sin quedarse en loading infinito (`sdk.actions.ready()` está disparando correctamente).
   - El botón "Sign In With Farcaster" completa el flujo Quick Auth → `bindFid` on-chain.
   - "Claim" mintea 100 GIVE (revisa el balance).
   - "Send tip" a otro FID de prueba funciona (puede necesitar el `approve` una vez, ver nota en `ClaimCard`/`TipComposer`).
   - El destinatario recibe notificación (puede tardar hasta 60s, es el cron `notify-tips`).
   - `/leaderboard` y `/[fid]` cargan con datos reales.
3. Repite desde Warpcast mobile, no solo desktop — el flujo de wallet connect difiere.

---

## 6. Anunciar

Cuando todo lo anterior esté verde, cast manual (tú lo publicas, no yo):

```
Just shipped DailyGive on Base.
Claim 100 GIVE daily. Tip any Farcaster user. Received tips become
permanent GIVEN reputation (soulbound). Powered by B20 native token
on Base.
https://tudominio.xyz
```

---

## 7. Mainnet — paso a paso, gate manual

**No arranques esta sección hasta que Sepolia lleve tiempo estable y hayas decidido conscientemente pasar a producción real.** A partir de aquí GIVE/GIVEN tienen valor real para usuarios reales. Yo no ejecutaré ningún comando de esta sección sin que me lo pidas explícitamente en el momento — el `Makefile` incluso lo obliga con `CONFIRM_MAINNET=yes` para que no salga nunca de un copy-paste accidental del comando de Sepolia.

### 7.0 — Prerrequisitos específicos de mainnet

- [ ] ETH real en la wallet `speedrun` en Base mainnet (para gas — no testnet ETH).
- [ ] Has decidido conscientemente: ¿mismo dominio que Sepolia, o uno nuevo para producción? (afecta 7.7 y 7.8).
- [ ] Has revisado el código una última vez pensando en fondos reales — no hay red de seguridad después de este punto salvo lo que el propio contrato ya garantiza.

### 7.1 — Nueva `FID_BINDER_KEY` dedicada a mainnet

No reuses la clave de Sepolia — aísla el blast radius si una se compromete.

```bash
cast wallet new
```

Guarda dirección (→ `FID_BINDER_ADDRESS` para el deploy) y clave privada (→ env var `FID_BINDER_KEY` en el proyecto Vercel de producción, nunca en el repo).

### 7.2 — Verifica activación en mainnet

```bash
cd contracts
make check-activation-mainnet   # debe devolver "true"
make check-keystore
base-cast balance 0x8F058fE6b568D97f85d517Ac441b52B95722fDDe --rpc-url https://mainnet.base.org
```

### 7.3 — Revisa si `SEIZE_HOLDER_POLICY` ya está soportado en mainnet

Era el motivo por el que `DailyGive.sol` usa `approve`/`transferFrom` en vez del `seizeWithMemo` que documentaba el spec de base-std (ver el comentario en `contracts/src/DailyGive.sol`). Si para este momento ya está soportado en mainnet, hay una simplificación de UX pendiente (quitar el paso de `approve` del flujo de claim/tip) — vale la pena hacerla antes de lanzar en producción, no después. Compruébalo así, contra un fork de mainnet, antes de decidir:

```bash
LIVE_PRECOMPILES=true base-forge test --fork-url https://mainnet.base.org --match-test test_bindFid_success -vvv
```

Si el error `UnsupportedPolicyType` ya no aparece para tokens ASSET, dímelo y rediseñamos esa parte antes de desplegar.

### 7.4 — Deploy

```bash
FID_BINDER_ADDRESS=<dirección del paso 7.1> CONFIRM_MAINNET=yes make deploy-mainnet
```

Pide la password del keystore de forma interactiva, igual que Sepolia. Guarda las tres direcciones que imprime (`DailyGive`, `GIVE`, `GIVEN`).

### 7.5 — Verifica en BaseScan mainnet

```
https://basescan.org/address/<DailyGive address>
```

### 7.6 — Sanity checks on-chain

```bash
base-cast call <DailyGive address> "fidBinder()(address)" --rpc-url https://mainnet.base.org
# debe devolver la dirección del paso 7.1

base-cast call <DailyGive address> "owner()(address)" --rpc-url https://mainnet.base.org
# debe devolver 0x8F058fE6b568D97f85d517Ac441b52B95722fDDe
```

### 7.7 — Proyecto Vercel de producción

**No mezcles Sepolia y mainnet en el mismo deploy de la app.** Crea un proyecto Vercel nuevo (o un Environment de producción separado con sus propias env vars si prefieres un solo proyecto) con:

| Variable | Valor |
|---|---|
| `NEXT_PUBLIC_CHAIN_ID` | `8453` |
| `NEXT_PUBLIC_DAILYGIVE_ADDRESS` / `GIVE` / `GIVEN` | direcciones del paso 7.4 |
| `NEXT_PUBLIC_APP_URL` | tu dominio de producción (mismo o distinto al de Sepolia, según 7.0) |
| `FID_BINDER_KEY` | clave del paso 7.1 |
| Resto (`NEYNAR_*`, `UPSTASH_*`, `NOTIFY_SECRET`, `CRON_SECRET`) | nuevas o reutilizadas, tu decisión — no son chain-specific |
| `FARCASTER_ACCOUNT_ASSOCIATION_*` | vacíos por ahora, paso 7.9 |

Deploy con `npx vercel --prod` (desde el proyecto/environment correcto) y repite el `curl` del paso 3.5 contra el dominio de producción.

### 7.8 — Dominio

Si usas el mismo dominio que Sepolia: no hace falta comprar nada nuevo, solo asegúrate de que el proyecto Vercel de producción apunta a él (y que el de Sepolia deja de hacerlo, o usas un subdominio tipo `sepolia.tudominio.xyz` para no pisarte). Si usas uno nuevo para producción: cómpralo y configúralo igual que en el paso 3.3.

### 7.9 — Verificación de dominio en Farcaster (de nuevo)

Repite la sección 4 completa contra el dominio de producción. Un `accountAssociation` firmado para Sepolia/testnet no vale para el dominio de producción si es distinto.

### 7.10 — Pruebas end-to-end con fondos reales

Repite la sección 5, esta vez con GIVE/GIVEN reales de por medio. Considera:
- Rollout gradual: whitelist de FIDs beta (tú y gente de confianza) antes de abrir a todos.
- `claim()`/`tip()` los paga el gas cada usuario con su propia wallet, no `speedrun` — confirma esto probando con una wallet de prueba que no sea `speedrun`. `speedrun` solo gasta gas si vuelves a llamar una función admin (`rotateFidBinder`, etc.), así que no necesita un balance operativo grande post-deploy.

### 7.11 — Anunciar producción

Igual que la sección 6, pero deja claro en el cast que es la versión de producción en Base mainnet (no testnet), si antes anunciaste la de Sepolia a la misma audiencia.

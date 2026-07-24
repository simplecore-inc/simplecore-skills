# Domain-Specific Layout Templates

Select the template matching your diagram type. Each provides a canvas size, ASCII wireframe, color assignments, and layout tips.

## Template Selection Guide

| Request | Template | Canvas |
|---------|----------|--------|
| "system architecture", "protocol stack", "시스템 아키텍처" | 1. Layered Architecture | 680xN |
| "data flow", "ETL", "pipeline", "데이터 흐름", "파이프라인" | 2. Data Pipeline | 680x220 |
| "microservices", "service composition", "마이크로서비스" | 3. Microservice | 800x600 |
| "CI/CD", "build pipeline", "deployment", "배포" | 4. CI/CD Pipeline | 800x340 |
| "network layout", "topology", "네트워크 구성", "토폴로지" | 5. Network Topology | 800x700 |
| "state transitions", "workflow", "상태 전이", "워크플로" | 6. State Machine | 600x500 |
| "infrastructure", "Kubernetes", "cloud", "인프라", "클라우드" | 7. Deployment Infra | 800x600 |
| "API flow", "sequence", "API 흐름", "시퀀스" | 8. Sequence / API | 600xN |
| "dependency matrix", "coverage", "RACI", "의존성 매트릭스/메트릭스", "커버리지" | 9. Dependency / Coverage Matrix | (from `matrix()`) |

---

## 1. Layered Architecture

**Canvas:** 680xN (layers x ~200px)

```
y=20   ┌── Layer 1 (source) ───────────────────────┐  h=120
       │  [Node A]  [Node B]  [Node C]              │
y=140  └────────────────────────────────────────────┘

y=180  ┌── Layer 2 (process) ───────────────────────┐  h=varies
       │  ┌── Sublayer 2a ───────────────────┐      │
       │  │  [capture] ──► [parse]            │      │
       │  └──────────────────────────────────┘      │
       │  ┌── Sublayer 2b ───────────────────┐      │
       │  │  [queue] → [converter] → [sink]   │      │
       │  └──────────────────────────────────┘      │
       └────────────────────────────────────────────┘

       ┌── Layer 3 (storage) ───────────────────────┐  h=100
       │  [table]                                    │
       └────────────────────────────────────────────┘
```

- All subgroups: same x offset (60), same width (560)
- Nodes center-aligned on x=340
- Layer gap: ~40px, sublayer gap: ~35px

## 2. Data Pipeline

**Canvas:** 680x220 (2-row)

```
Row 1 (L→R): [A] ──► [B] ──► [C] ──► [D]
                                        ↓
Row 2 (R→L):          [G] ◄── [F] ◄── [E]
```

- Row 1: y=30, Row 2: y=136, node h=54
- Node width: 100-140px, gap: 20-40px
- L-shaped connector between rows

## 3. Microservice

**Canvas:** 800x600

```
┌── API Gateway (purple) ──────────────────────────────┐
│  [LB] → [Auth] → [Rate Limiter]                      │
└──────────────────┬───────────────────────────────────┘
    ┌──────────────┼──────────────┐
    ▼              ▼              ▼
┌── Svc A (blue)─┐ ┌── Svc B (green) ┐ ┌── Svc C (gold)─┐
└────────────────┘ └─────────────────┘ └────────────────┘
    ▼              ▼              ▼
┌── Data Layer (gold) ─────────────────────────────────┐
└──────────────────────────────────────────────────────┘
```

- Services: equal-width subgroups
- Async: dashed arrows, Sync: solid arrows

## 4. CI/CD Pipeline

**Canvas:** 800x340 (2-row)

```
Build:  [Commit] ──► [Lint] ──► [Test] ──► [Build] ──► [Scan]
         red        purple     purple      blue        cyan

Deploy: [Stage] ──► [E2E] ──► [Approve] ──► [Prod]
         gold      purple     magenta       green
```

- Failure path: `#db4b4b` dashed line to [Rollback]
- Manual approval: `#ff007c` (magenta) node

## 5. Network Topology

**Canvas:** 800x700

```
┌── WAN (purple) ──────────────────────────────────┐
│  [Router] ── [Firewall]                           │
└────────────┬─────────────────────────────────────┘
┌── DMZ (magenta) ─────────────────────────────────┐
│  [Reverse Proxy]  [VPN Gateway]                   │
└────────────┬─────────────────────────────────────┘
┌── LAN (blue) ────────────────────────────────────┐
│  ┌── Server VLAN (green) ┐ ┌── OT VLAN (red) ──┐│
│  │ [App] [DB]             │ │ [RTU] [PLC] [HMI] ││
│  └────────────────────────┘ └────────────────────┘│
└──────────────────────────────────────────────────┘
```

- Security zones: distinct border colors
- Firewall: magenta, Monitoring: cyan

## 6. State Machine

**Canvas:** 600x500, direction: TD

```
    ●(start)
      │
      ▼
 [Idle] ◄──────────┐
   │               │ reset
   ▼ trigger       │
 [Loading]         │
   │    │          │
   ▼    ▼          │
[Success] [Error]──┘
   │
   ▼
  ●(end)
```

- Start/end: circle node, `#7aa2f7` fill
- Error state: `#db4b4b` border
- Transitions: edge labels

## 7. Deployment Infrastructure

**Canvas:** 800x600

```
┌── Cloud Region (blue) ────────────────────────────────┐
│  ┌── K8s Cluster (purple) ────────────────────────┐   │
│  │  ┌── prod (green) ──────────────────────────┐  │   │
│  │  │  [Pod: API x3]  [Pod: Worker x2]         │  │   │
│  │  └──────────────────────────────────────────┘  │   │
│  │  ┌── monitoring (cyan) ─────────────────────┐  │   │
│  │  │  [Prometheus]  [Grafana]  [AlertManager]  │  │   │
│  │  └──────────────────────────────────────────┘  │   │
│  └────────────────────────────────────────────────┘   │
│  ┌── Managed Services (gold) ─────────────────────┐   │
│  │  [RDS]  [ElastiCache]  [S3]                    │   │
│  └────────────────────────────────────────────────┘   │
└───────────────────────────────────────────────────────┘
```

- Replica count: label suffix `x3`

## 8. Sequence / API Flow

**Canvas:** 600xN (dynamic height)

Sequence diagrams from text are quickest via Mermaid `sequenceDiagram` (`scripts/convert.js`); for a hand-crafted SVG use this layout:

```
Headers (y=30): [Client]  [Gateway]  [Service]  [DB]
                 #f7768e   #bb9af7    #9ece6a   #e0af68

Lifelines: vertical dashed lines (stroke-dasharray="4,3")
Requests: solid horizontal arrows
Responses: dashed horizontal arrows
Activation: thin rect on lifeline (width=12, opacity=0.3)
```

## 9. Dependency / Coverage Matrix

**Canvas:** (label_w + ncols·col_w) x (~header + nrows·row_h) — size from `matrix()`'s return

A grid of rows × columns with a filled cell where a relation holds. Use for dependency ("which phase unlocks which"), coverage ("service × environment"), RACI, or feature-comparison tables. Prefer this over a bipartite arrow diagram when each row maps to one or a few columns and you want the *gaps* to be legible (an empty column reads as "not covered / no dependency").

```
             [Col A]   [Col B]   [Col C]   [n/a]     ← solid accent header chips
 ● R1 name   │  ●   │        │        │        │     ← tinted pill + dot in marked cell
 ● R2 name   │      │   ●    │   ●    │        │
   R3 name   │      │        │        │   ●    │     ← muted id chip when row has no accent mark
```

Use the `matrix()` composite in `svgkit.py` — do not hand-place cells:

```python
c = Canvas(940, 560, theme="tokyo-night")
c.title("Backend ← Frontend dependency", "● = depends on")
cols = [("P1", c.blue), ("P2", c.green), ("P3", c.orange), ("독립", c.t["muted"])]
rows = [("F1", "StreamProvider"), ("F2", "Store"), ("F3", "Bootstrap")]
marks = [(0, 1), (1, 3), (2, 1)]          # (row_idx, col_idx[, color])
c.matrix(44, 96, rows, cols, marks, label_w=280, col_w=116, row_h=36)
```

- `rows`: `str` (name only) or `(id, name)` — the id chip is colored by the row's first mark, muted if none.
- `cols`: `(label, color)` — solid header chips; give an "n/a"/"독립" column a muted color for rows with no dependency.
- `marks`: `(r, c)` or `(r, c, color)` — one filled cell per relation; leave a column empty to show it has no consumer.
- Keep it generic: never bake a project's specific row/column names into a reusable helper — pass them in as data.

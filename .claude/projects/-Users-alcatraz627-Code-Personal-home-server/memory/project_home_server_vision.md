---
name: Home Server Project Vision
description: Personal device management platform across laptop, phone, Raspberry Pi over Tailscale — file transfer, smart home, backups, automation
type: project
---

User is building a personal home server / device management system. Devices: MacOS laptop, phone, Raspberry Pi, all connected via Tailscale VPN.

**Core goals:**
1. Seamless file transfer between devices (no cloud)
2. Extensible web dashboard with widgets (Wiz bulbs, process manager, backup status)
3. Automated phone backups to external hard drive (on laptop or Pi)
4. Operator automation framework for scheduled/on-demand tasks with notifications

**Three agent roles defined:**
- Product Manager — prioritizes reliability and UX, breaks goals into milestones
- Architect — tech decisions, deployment strategy, build-vs-buy
- Operator — runs background jobs, sends notifications, logs everything

**Key constraints:**
- All traffic over Tailscale, no public exposure
- Runs on daily-use hardware (laptop + Pi), must be resource-light
- User values reliability > features, UX > technical elegance

**Why:** User wants a unified control plane for their digital life, accessible from any device on their tailnet.

**How to apply:** All suggestions should respect the Tailscale-only networking constraint, prefer battle-tested tools, and keep resource usage minimal. Reference PROJECT.md at repo root for full details.

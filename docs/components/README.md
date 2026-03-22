# Component Library — Tech Specs & Standardization Plan

## Audit Summary

Scanned all `.svelte` files (17 components + 26 routes). The component library includes 7 shared UI primitives and 10 feature components.

## Component Specs

| Component | Status | Spec | Instances to Migrate |
|-----------|--------|------|---------------------|
| [Button](Button.md) | **New** | Unified button with variants/sizes/confirm | 350+ buttons across 36 files |
| [Badge](Badge.md) | **New** | Status pills/dots with color variants | 50+ badges across 17 files |
| [Tabs](Tabs.md) | **New** | Tab bar with keyboard nav + ARIA | 13 pages with inline tabs |
| [SearchInput](SearchInput.md) | **New** | Debounced search with icon + clear | 20+ inputs across 12 pages |
| [Loading](Loading.md) | **New** | Skeleton/spinner/dots loading states | 40+ loading instances |
| [Collapsible](Collapsible.md) | **New** | Expandable sections with animation | 40+ collapse patterns in 16 files |
| [PageHeader](PageHeader.md) | **New** | Title + description + actions | All 25 pages |
| [EmptyState](../pages/keeper.md) | **Existing — expand usage** | Only 3 uses; 10+ inline empty divs | Migrate 10+ pages |
| [Modal](../pages/files.md) | **Existing — expand usage** | Only 2 uses; 10+ inline overlays | Migrate 10+ modals |

## Patterns That Don't Need Components

| Pattern | Why | Current State |
|---------|-----|---------------|
| Cards | `.card` CSS class works perfectly | Consistent across codebase |
| Toggles | Native checkbox with global CSS | Highly consistent |
| Forms | Grid layout + label pattern | Consistent CSS pattern |
| Toast | Store-based system is excellent | 150+ calls, all consistent |
| Copy to clipboard | Utility function pattern | Consistent with fallbacks |
| Action confirmation | Two-click inline pattern | Works well as-is |

## Standardization Execution Plan

### Phase 1: Create Components (no migration yet)

Build all 7 new components as standalone files. Verify they compile and render correctly in the `/showcase` page.

### Phase 2: Migrate High-Traffic Pages

Prioritize pages with the most pattern instances:
1. `+layout.svelte` — Button, SearchInput in sidebar
2. `tasks/+page.svelte` — Button, Badge, Tabs, Collapsible, PageHeader, Loading
3. `keeper/+page.svelte` — Button, Badge, Collapsible, PageHeader
4. `files/+page.svelte` — Button, SearchInput, PageHeader, Modal adoption
5. `backups/+page.svelte` — Button, Badge, PageHeader

### Phase 3: Migrate Remaining Pages

All other 20 pages, batch by similarity:
- Network tools (wifi, packets, network, dns, ports) — Badge, SearchInput, Tabs
- Smart home (lights, peripherals) — Button, Badge, Tabs, Loading
- Tools (bookmarks, kanban, qr, wol, clipboard, screenshots, benchmarks) — Button, PageHeader
- Info (docs, showcase, terminal, processes, tailscale) — PageHeader, Loading

### Phase 4: Cleanup

- Remove orphaned per-page CSS classes that are now handled by components
- Update showcase page to demo all new components
- Verify responsive behavior across all components

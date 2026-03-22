# Benchmarks

The Benchmarks page runs performance tests on the server hardware, measuring CPU, memory, disk I/O, and network throughput. Results help identify bottlenecks and track performance over time.

## How to Use

- **Select** which benchmark to run (CPU, memory, disk, or all)
- **Start** the benchmark; progress is shown during execution
- **View** results with scores, timings, and comparisons to previous runs
- **History** of past benchmark results is stored for trend analysis
- **Export** results for external comparison

## Data Flow

1. `src/routes/benchmarks/+page.svelte` renders the benchmark UI and results
2. `src/routes/benchmarks/+page.server.ts` loads historical benchmark data
3. `src/routes/api/benchmarks/+server.ts` runs benchmark tests on the server
4. `src/lib/server/benchmarks.ts` implements the actual test workloads

## Keyboard Shortcuts

No dedicated shortcuts.

## Tips

- Benchmarks may spike CPU and I/O; avoid running during critical workloads
- Results vary with system load; run benchmarks on an idle system for consistent numbers
- CPU benchmarks test single-threaded and multi-threaded performance
- Disk benchmarks measure sequential and random read/write speeds
- Historical results help detect hardware degradation over time

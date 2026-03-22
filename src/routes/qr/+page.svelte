<script lang="ts">
  import { toast } from '$lib/toast';

  let text = $state('https://example.com');
  let size = $state(256);
  let errorLevel = $state<'L' | 'M' | 'Q' | 'H'>('M');
  let mode = $state<'text' | 'wifi'>('text');

  // WiFi fields
  let ssid = $state('');
  let password = $state('');
  let encryption = $state<'WPA' | 'WEP' | 'nopass'>('WPA');

  let canvas: HTMLCanvasElement | undefined = $state();

  const wifiString = $derived(`WIFI:T:${encryption};S:${ssid};P:${password};;`);
  const qrData = $derived(mode === 'wifi' ? wifiString : text);

  // ── Minimal QR encoder ──────────────────────────────────────
  // Reed-Solomon GF(256) with polynomial 0x11D
  function gfMul(a: number, b: number): number {
    if (a === 0 || b === 0) return 0;
    let r = 0;
    for (let i = 0; i < 8; i++) {
      if (b & 1) r ^= a;
      b >>= 1;
      a <<= 1;
      if (a & 256) a ^= 0x11d;
    }
    return r;
  }

  function rsGenPoly(n: number): number[] {
    let poly = [1];
    for (let i = 0; i < n; i++) {
      const next = new Array(poly.length + 1).fill(0);
      let gen = 1;
      for (let j = 0; j < i; j++) gen = gfMul(gen, 2);
      for (let j = 0; j < poly.length; j++) {
        next[j] ^= poly[j];
        next[j + 1] ^= gfMul(poly[j], gen);
      }
      poly = next;
    }
    return poly;
  }

  function rsEncode(data: number[], ecLen: number): number[] {
    const gen = rsGenPoly(ecLen);
    const msg = [...data, ...new Array(ecLen).fill(0)];
    for (let i = 0; i < data.length; i++) {
      const coef = msg[i];
      if (coef !== 0) {
        for (let j = 0; j < gen.length; j++) {
          msg[i + j] ^= gfMul(gen[j], coef);
        }
      }
    }
    return msg.slice(data.length);
  }

  // QR version/EC parameters (simplified — versions 1-10 byte mode)
  interface VersionInfo {
    ver: number;
    size: number;
    dataCW: number;
    ecCW: number;
    ecBlocks: number;
  }

  const VERSION_TABLE: Record<string, VersionInfo[]> = {
    L: [
      { ver: 1, size: 21, dataCW: 19, ecCW: 7, ecBlocks: 1 },
      { ver: 2, size: 25, dataCW: 34, ecCW: 10, ecBlocks: 1 },
      { ver: 3, size: 29, dataCW: 55, ecCW: 15, ecBlocks: 1 },
      { ver: 4, size: 33, dataCW: 80, ecCW: 20, ecBlocks: 1 },
      { ver: 5, size: 37, dataCW: 108, ecCW: 26, ecBlocks: 1 },
      { ver: 6, size: 41, dataCW: 136, ecCW: 18, ecBlocks: 2 },
      { ver: 7, size: 45, dataCW: 156, ecCW: 20, ecBlocks: 2 },
      { ver: 8, size: 49, dataCW: 194, ecCW: 24, ecBlocks: 2 },
      { ver: 9, size: 53, dataCW: 232, ecCW: 30, ecBlocks: 2 },
      { ver: 10, size: 57, dataCW: 274, ecCW: 18, ecBlocks: 4 },
    ],
    M: [
      { ver: 1, size: 21, dataCW: 16, ecCW: 10, ecBlocks: 1 },
      { ver: 2, size: 25, dataCW: 28, ecCW: 16, ecBlocks: 1 },
      { ver: 3, size: 29, dataCW: 44, ecCW: 26, ecBlocks: 1 },
      { ver: 4, size: 33, dataCW: 64, ecCW: 18, ecBlocks: 2 },
      { ver: 5, size: 37, dataCW: 86, ecCW: 24, ecBlocks: 2 },
      { ver: 6, size: 41, dataCW: 108, ecCW: 16, ecBlocks: 4 },
      { ver: 7, size: 45, dataCW: 124, ecCW: 18, ecBlocks: 4 },
      { ver: 8, size: 49, dataCW: 154, ecCW: 22, ecBlocks: 4 },
      { ver: 9, size: 53, dataCW: 182, ecCW: 22, ecBlocks: 4 },
      { ver: 10, size: 57, dataCW: 216, ecCW: 26, ecBlocks: 4 },
    ],
    Q: [
      { ver: 1, size: 21, dataCW: 13, ecCW: 13, ecBlocks: 1 },
      { ver: 2, size: 25, dataCW: 22, ecCW: 22, ecBlocks: 1 },
      { ver: 3, size: 29, dataCW: 34, ecCW: 18, ecBlocks: 2 },
      { ver: 4, size: 33, dataCW: 48, ecCW: 26, ecBlocks: 2 },
      { ver: 5, size: 37, dataCW: 62, ecCW: 18, ecBlocks: 4 },
      { ver: 6, size: 41, dataCW: 76, ecCW: 24, ecBlocks: 4 },
      { ver: 7, size: 45, dataCW: 88, ecCW: 18, ecBlocks: 6 },
      { ver: 8, size: 49, dataCW: 110, ecCW: 22, ecBlocks: 6 },
      { ver: 9, size: 53, dataCW: 132, ecCW: 20, ecBlocks: 8 },
      { ver: 10, size: 57, dataCW: 154, ecCW: 24, ecBlocks: 8 },
    ],
    H: [
      { ver: 1, size: 21, dataCW: 9, ecCW: 17, ecBlocks: 1 },
      { ver: 2, size: 25, dataCW: 16, ecCW: 28, ecBlocks: 1 },
      { ver: 3, size: 29, dataCW: 26, ecCW: 22, ecBlocks: 2 },
      { ver: 4, size: 33, dataCW: 36, ecCW: 16, ecBlocks: 4 },
      { ver: 5, size: 37, dataCW: 46, ecCW: 22, ecBlocks: 4 },
      { ver: 6, size: 41, dataCW: 60, ecCW: 28, ecBlocks: 4 },
      { ver: 7, size: 45, dataCW: 66, ecCW: 26, ecBlocks: 6 },
      { ver: 8, size: 49, dataCW: 86, ecCW: 26, ecBlocks: 6 },
      { ver: 9, size: 53, dataCW: 100, ecCW: 24, ecBlocks: 8 },
      { ver: 10, size: 57, dataCW: 122, ecCW: 28, ecBlocks: 8 },
    ],
  };

  const ALIGNMENT_POSITIONS: Record<number, number[]> = {
    2: [6, 18],
    3: [6, 22],
    4: [6, 26],
    5: [6, 30],
    6: [6, 34],
    7: [6, 22, 38],
    8: [6, 24, 42],
    9: [6, 26, 46],
    10: [6, 28, 52],
  };

  const FORMAT_BITS: Record<string, number[]> = {
    L: [0x77c4, 0x72f3, 0x7daa, 0x789d, 0x662f, 0x6318, 0x6c41, 0x6976],
    M: [0x5412, 0x5125, 0x5e7c, 0x5b4b, 0x45f9, 0x40ce, 0x4f97, 0x4aa0],
    Q: [0x355f, 0x3068, 0x3f31, 0x3a06, 0x24b4, 0x2183, 0x2eda, 0x2bed],
    H: [0x1689, 0x13be, 0x1ce7, 0x19d0, 0x0762, 0x0255, 0x0d0c, 0x083b],
  };

  function pickVersion(dataLen: number, ecl: string): VersionInfo | null {
    const table = VERSION_TABLE[ecl];
    for (const v of table) {
      // byte mode: 4 bits mode + 8/16 bits length + data + 4 bits terminator
      const charCountBits = v.ver >= 10 ? 16 : 8;
      const totalBits = 4 + charCountBits + dataLen * 8;
      const totalCW = Math.ceil(totalBits / 8);
      if (totalCW <= v.dataCW) return v;
    }
    return null;
  }

  function encodeData(str: string, vi: VersionInfo): number[] {
    const bytes = new TextEncoder().encode(str);
    const charCountBits = vi.ver >= 10 ? 16 : 8;
    const bits: number[] = [];

    function pushBits(val: number, len: number) {
      for (let i = len - 1; i >= 0; i--) bits.push((val >> i) & 1);
    }

    // Mode indicator: byte mode = 0100
    pushBits(0b0100, 4);
    pushBits(bytes.length, charCountBits);
    for (const b of bytes) pushBits(b, 8);
    // Terminator
    pushBits(0, Math.min(4, vi.dataCW * 8 - bits.length));
    // Pad to byte boundary
    while (bits.length % 8 !== 0) bits.push(0);
    // Pad codewords
    const padBytes = [0xec, 0x11];
    let pi = 0;
    while (bits.length < vi.dataCW * 8) {
      pushBits(padBytes[pi % 2], 8);
      pi++;
    }

    const codewords: number[] = [];
    for (let i = 0; i < bits.length; i += 8) {
      let val = 0;
      for (let j = 0; j < 8; j++) val = (val << 1) | bits[i + j];
      codewords.push(val);
    }
    return codewords;
  }

  function buildMatrix(str: string, ecl: string): boolean[][] | null {
    const vi = pickVersion(str.length, ecl);
    if (!vi) return null;

    const n = vi.size;
    const matrix: (boolean | null)[][] = Array.from({ length: n }, () => Array(n).fill(null));

    // Place finder patterns
    function placeFinder(r: number, c: number) {
      for (let dr = -1; dr <= 7; dr++) {
        for (let dc = -1; dc <= 7; dc++) {
          const rr = r + dr,
            cc = c + dc;
          if (rr < 0 || rr >= n || cc < 0 || cc >= n) continue;
          if (dr === -1 || dr === 7 || dc === -1 || dc === 7) {
            matrix[rr][cc] = false;
          } else if (dr === 0 || dr === 6 || dc === 0 || dc === 6 || (dr >= 2 && dr <= 4 && dc >= 2 && dc <= 4)) {
            matrix[rr][cc] = true;
          } else {
            matrix[rr][cc] = false;
          }
        }
      }
    }

    placeFinder(0, 0);
    placeFinder(0, n - 7);
    placeFinder(n - 7, 0);

    // Timing patterns
    for (let i = 8; i < n - 8; i++) {
      matrix[6][i] = i % 2 === 0;
      matrix[i][6] = i % 2 === 0;
    }

    // Alignment patterns
    if (vi.ver >= 2) {
      const pos = ALIGNMENT_POSITIONS[vi.ver] || [];
      for (const r of pos) {
        for (const c of pos) {
          if (matrix[r][c] !== null) continue;
          for (let dr = -2; dr <= 2; dr++) {
            for (let dc = -2; dc <= 2; dc++) {
              matrix[r + dr][c + dc] = Math.abs(dr) === 2 || Math.abs(dc) === 2 || (dr === 0 && dc === 0);
            }
          }
        }
      }
    }

    // Dark module
    matrix[n - 8][8] = true;

    // Reserve format info areas
    for (let i = 0; i < 8; i++) {
      if (matrix[8][i] === null) matrix[8][i] = false;
      if (matrix[8][n - 1 - i] === null) matrix[8][n - 1 - i] = false;
      if (matrix[i][8] === null) matrix[i][8] = false;
      if (matrix[n - 1 - i][8] === null) matrix[n - 1 - i][8] = false;
    }
    if (matrix[8][8] === null) matrix[8][8] = false;

    // Encode data with EC
    const dataCW = encodeData(str, vi);
    const ecCWPerBlock = vi.ecCW;
    const blockSize = Math.floor(vi.dataCW / vi.ecBlocks);
    const largerBlocks = vi.dataCW % vi.ecBlocks;

    const dataBlocks: number[][] = [];
    const ecBlocks: number[][] = [];
    let offset = 0;
    for (let b = 0; b < vi.ecBlocks; b++) {
      const bSize = blockSize + (b >= vi.ecBlocks - largerBlocks ? 1 : 0);
      const block = dataCW.slice(offset, offset + bSize);
      offset += bSize;
      dataBlocks.push(block);
      ecBlocks.push(rsEncode(block, ecCWPerBlock));
    }

    // Interleave
    const interleaved: number[] = [];
    const maxDataLen = Math.max(...dataBlocks.map((b) => b.length));
    for (let i = 0; i < maxDataLen; i++) {
      for (const block of dataBlocks) {
        if (i < block.length) interleaved.push(block[i]);
      }
    }
    for (let i = 0; i < ecCWPerBlock; i++) {
      for (const block of ecBlocks) {
        if (i < block.length) interleaved.push(block[i]);
      }
    }

    // Convert to bits
    const allBits: number[] = [];
    for (const cw of interleaved) {
      for (let j = 7; j >= 0; j--) allBits.push((cw >> j) & 1);
    }

    // Place data bits
    let bitIdx = 0;
    let upward = true;
    for (let col = n - 1; col >= 0; col -= 2) {
      if (col === 6) col = 5; // skip timing column
      const rows = upward ? Array.from({ length: n }, (_, i) => n - 1 - i) : Array.from({ length: n }, (_, i) => i);
      for (const row of rows) {
        for (const dc of [0, -1]) {
          const c = col + dc;
          if (c < 0 || matrix[row][c] !== null) continue;
          matrix[row][c] = bitIdx < allBits.length ? allBits[bitIdx] === 1 : false;
          bitIdx++;
        }
      }
      upward = !upward;
    }

    // Apply mask 0 (checkerboard) and format info
    const result: boolean[][] = Array.from({ length: n }, () => Array(n).fill(false));

    // First copy matrix
    for (let r = 0; r < n; r++) {
      for (let c = 0; c < n; c++) {
        result[r][c] = matrix[r][c] ?? false;
      }
    }

    // Apply mask to data modules only
    for (let r = 0; r < n; r++) {
      for (let c = 0; c < n; c++) {
        if (isDataModule(r, c, vi)) {
          if ((r + c) % 2 === 0) result[r][c] = !result[r][c];
        }
      }
    }

    // Write format info (mask 0)
    const ecIdx = { L: 0, M: 1, Q: 2, H: 3 }[ecl] ?? 1;
    const fmtBits = FORMAT_BITS[ecl][0]; // mask pattern 0
    const fmtArr: boolean[] = [];
    for (let i = 14; i >= 0; i--) fmtArr.push(((fmtBits >> i) & 1) === 1);

    // Horizontal strip around top-left finder
    const hPos = [0, 1, 2, 3, 4, 5, 7, 8, n - 8, n - 7, n - 6, n - 5, n - 4, n - 3, n - 2, n - 1];
    for (let i = 0; i < 15; i++) {
      result[8][hPos[i]] = fmtArr[i];
    }
    // Vertical strip
    const vPos = [n - 1, n - 2, n - 3, n - 4, n - 5, n - 6, n - 7, 8, 7, 5, 4, 3, 2, 1, 0];
    for (let i = 0; i < 15; i++) {
      result[vPos[i]][8] = fmtArr[i];
    }

    return result;
  }

  function isDataModule(r: number, c: number, vi: VersionInfo): boolean {
    const n = vi.size;
    // Finder patterns + separators
    if (r <= 8 && c <= 8) return false;
    if (r <= 8 && c >= n - 8) return false;
    if (r >= n - 8 && c <= 8) return false;
    // Timing
    if (r === 6 || c === 6) return false;
    // Dark module
    if (r === n - 8 && c === 8) return false;
    // Alignment
    if (vi.ver >= 2) {
      const pos = ALIGNMENT_POSITIONS[vi.ver] || [];
      for (const ar of pos) {
        for (const ac of pos) {
          if (ar <= 8 && ac <= 8) continue;
          if (ar <= 8 && ac >= n - 8) continue;
          if (ar >= n - 8 && ac <= 8) continue;
          if (Math.abs(r - ar) <= 2 && Math.abs(c - ac) <= 2) return false;
        }
      }
    }
    return true;
  }

  function renderQR() {
    if (!canvas) return;
    const data = qrData.trim();
    if (!data) return;

    const matrix = buildMatrix(data, errorLevel);
    if (!matrix) {
      toast.error('Text too long for QR code (max ~270 chars with byte encoding)');
      return;
    }

    const modules = matrix.length;
    const quiet = 4;
    const total = modules + quiet * 2;
    const cellSize = Math.max(1, Math.floor(size / total));
    const canvasSize = cellSize * total;

    canvas.width = canvasSize;
    canvas.height = canvasSize;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvasSize, canvasSize);
    ctx.fillStyle = '#000000';

    for (let r = 0; r < modules; r++) {
      for (let c = 0; c < modules; c++) {
        if (matrix[r][c]) {
          ctx.fillRect((c + quiet) * cellSize, (r + quiet) * cellSize, cellSize, cellSize);
        }
      }
    }
  }

  $effect(() => {
    // Re-render whenever dependencies change
    qrData;
    size;
    errorLevel;
    renderQR();
  });

  function downloadPNG() {
    if (!canvas) return;
    const link = document.createElement('a');
    link.download = 'qrcode.png';
    link.href = canvas.toDataURL('image/png');
    link.click();
    toast.success('QR code downloaded');
  }

  async function copyDataURL() {
    if (!canvas) return;
    try {
      const blob = await new Promise<Blob>((resolve) => canvas!.toBlob((b) => resolve(b!), 'image/png'));
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
      toast.success('QR image copied to clipboard');
    } catch {
      toast.error('Failed to copy to clipboard');
    }
  }

  let canShare = $state(false);
  let fillingWifi = $state(false);

  if (typeof navigator !== 'undefined' && 'share' in navigator && 'canShare' in navigator) {
    // Check if file sharing is supported
    try {
      const testFile = new File(['test'], 'test.png', { type: 'image/png' });
      canShare = navigator.canShare?.({ files: [testFile] }) ?? false;
    } catch {
      canShare = false;
    }
  }

  async function shareQR() {
    if (!canvas) return;
    try {
      const blob = await new Promise<Blob>((resolve) => canvas!.toBlob((b) => resolve(b!), 'image/png'));
      const file = new File([blob], 'qrcode.png', { type: 'image/png' });
      await navigator.share({ files: [file], title: 'QR Code' });
    } catch (e: any) {
      if (e.name !== 'AbortError') {
        toast.error('Failed to share');
      }
    }
  }

  async function fillFromWifi() {
    fillingWifi = true;
    try {
      const res = await fetch('/api/wifi');
      if (!res.ok) throw new Error('Failed to get WiFi info');
      const data = await res.json();
      if (data.current?.ssid) {
        ssid = data.current.ssid;
        mode = 'wifi';
        toast.success(`Filled SSID: ${ssid}`);
      } else {
        toast.error('Could not detect current WiFi network');
      }
    } catch {
      toast.error('Failed to get WiFi info');
    } finally {
      fillingWifi = false;
    }
  }
</script>

<div class="page">
  <h1>QR Code Generator</h1>

  <div class="layout">
    <div class="controls card">
      <div class="mode-tabs">
        <button class:active={mode === 'text'} onclick={() => (mode = 'text')}>Text / URL</button>
        <button class:active={mode === 'wifi'} onclick={() => (mode = 'wifi')}>WiFi</button>
      </div>

      {#if mode === 'text'}
        <label>
          <span>Text or URL</span>
          <input type="text" bind:value={text} placeholder="Enter text or URL..." />
        </label>
      {:else}
        <div class="wifi-fill-row">
          <label style="flex:1">
            <span>SSID</span>
            <input type="text" bind:value={ssid} placeholder="Network name" />
          </label>
          <button class="btn-fill-wifi" onclick={fillFromWifi} disabled={fillingWifi}>
            {fillingWifi ? 'Detecting...' : 'Fill from WiFi'}
          </button>
        </div>
        <label>
          <span>Password</span>
          <input type="text" bind:value={password} placeholder="Password" />
        </label>
        <label>
          <span>Encryption</span>
          <select bind:value={encryption}>
            <option value="WPA">WPA/WPA2</option>
            <option value="WEP">WEP</option>
            <option value="nopass">None</option>
          </select>
        </label>
        <div class="wifi-preview">
          <code>{wifiString}</code>
        </div>
      {/if}

      <label>
        <span>Size: {size}px</span>
        <input type="range" min="128" max="512" step="16" bind:value={size} />
      </label>

      <label>
        <span>Error Correction</span>
        <select bind:value={errorLevel}>
          <option value="L">Low (7%)</option>
          <option value="M">Medium (15%)</option>
          <option value="Q">Quartile (25%)</option>
          <option value="H">High (30%)</option>
        </select>
      </label>

      <div class="actions">
        <button class="btn-primary" onclick={downloadPNG}>Download PNG</button>
        <button class="btn-secondary" onclick={copyDataURL}>Copy Image</button>
        {#if canShare}
          <button class="btn-secondary" onclick={shareQR}>Share</button>
        {/if}
      </div>
    </div>

    <div class="preview card">
      <h2>Preview</h2>
      <div class="canvas-wrap">
        <canvas bind:this={canvas}></canvas>
      </div>
      <p class="data-info">{qrData.length} characters</p>
    </div>
  </div>
</div>

<style>
  .page {
    padding: 1.5rem;
    max-width: 900px;
    margin: 0 auto;
  }
  h1 {
    margin-bottom: 1.5rem;
    color: var(--text-primary);
  }
  .layout {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1.5rem;
  }
  @media (max-width: 700px) {
    .layout {
      grid-template-columns: 1fr;
    }
  }
  .controls {
    padding: 1.25rem;
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }
  .mode-tabs {
    display: flex;
    gap: 0.5rem;
  }
  .mode-tabs button {
    flex: 1;
    padding: 0.5rem;
    border: 1px solid var(--border);
    background: var(--bg-secondary);
    color: var(--text-primary);
    border-radius: 6px;
    cursor: pointer;
    font-size: 0.9rem;
  }
  .mode-tabs button.active {
    background: var(--accent);
    color: #fff;
    border-color: var(--accent);
  }
  label {
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
  }
  label span {
    font-size: 0.85rem;
    color: var(--text-secondary);
    font-weight: 500;
  }
  input[type='text'],
  select {
    padding: 0.5rem 0.75rem;
    border: 1px solid var(--border);
    border-radius: 6px;
    background: var(--bg-primary);
    color: var(--text-primary);
    font-size: 0.9rem;
  }
  input[type='range'] {
    accent-color: var(--accent);
  }
  .wifi-preview {
    padding: 0.5rem;
    background: var(--bg-primary);
    border-radius: 6px;
    font-size: 0.8rem;
    word-break: break-all;
  }
  .wifi-preview code {
    color: var(--text-muted);
  }
  .wifi-fill-row {
    display: flex;
    gap: 0.5rem;
    align-items: flex-end;
  }
  .btn-fill-wifi {
    padding: 0.5rem 0.75rem;
    border: 1px solid var(--border);
    border-radius: 6px;
    background: var(--bg-secondary);
    color: var(--text-primary);
    cursor: pointer;
    font-size: 0.8rem;
    white-space: nowrap;
    margin-bottom: 1px;
  }
  .btn-fill-wifi:hover:not(:disabled) {
    border-color: var(--accent);
    color: var(--accent);
  }
  .btn-fill-wifi:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
  .actions {
    display: flex;
    gap: 0.5rem;
    flex-wrap: wrap;
  }
  .btn-primary,
  .btn-secondary {
    flex: 1;
    padding: 0.6rem;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    font-weight: 600;
    font-size: 0.9rem;
  }
  .btn-primary {
    background: var(--accent);
    color: #fff;
  }
  .btn-secondary {
    background: var(--bg-secondary);
    color: var(--text-primary);
    border: 1px solid var(--border);
  }
  .btn-primary:hover {
    opacity: 0.9;
  }
  .btn-secondary:hover {
    background: var(--bg-primary);
  }
  .preview {
    padding: 1.25rem;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1rem;
  }
  .preview h2 {
    margin: 0;
    color: var(--text-primary);
    font-size: 1.1rem;
  }
  .canvas-wrap {
    background: #fff;
    padding: 1rem;
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .data-info {
    color: var(--text-muted);
    font-size: 0.8rem;
    margin: 0;
  }
</style>

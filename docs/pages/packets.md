# Packets

The Packets page is a network packet sniffer that captures and displays live network traffic on the server. It provides a Wireshark-like experience in the browser for basic packet analysis.

## How to Use

- **Select** the network interface to capture on
- **Start** capturing packets with optional filters (by protocol, port, or host)
- **View** captured packets in a scrollable list with timestamp, source, destination, protocol, and size
- **Stop** the capture at any time
- **Inspect** individual packets for header details
- **Clear** the capture buffer to start fresh

## Data Flow

1. `src/routes/packets/+page.svelte` renders the capture UI and packet list
2. Client-side fetches hit `src/routes/api/packets/+server.ts` to start/stop captures
3. `src/lib/server/packets.ts` uses system packet capture tools (tcpdump, libpcap)
4. Packets are streamed to the browser in real time

## Keyboard Shortcuts

No dedicated shortcuts.

## Tips

- Packet capture requires root/sudo privileges on most systems
- Use filters to reduce noise (e.g., capture only TCP port 80 traffic)
- Large captures consume memory; stop and clear regularly
- The sniffer is for diagnostic use; be mindful of privacy and network policies
- Common protocols shown: TCP, UDP, ICMP, DNS, HTTP, ARP

<script lang="ts">
  import type { PageData } from './$types';
  import type { TaskStatus } from '$lib/server/operator';
  import { toast } from '$lib/toast';
  import EmptyState from '$lib/components/EmptyState.svelte';

  let { data } = $props<{ data: PageData }>();
  // svelte-ignore state_referenced_locally
  const { statuses: initialStatuses, disk: initialDisk } = data;
  let statuses = $state<TaskStatus[]>(initialStatuses);
  let disk = $state(initialDisk);

  let showForm = $state(false);
  let showTemplates = $state(false);
  let formName = $state('');
  let formCommand = $state('');
  let formTimeout = $state(300);
  let formRetries = $state(3);
  let formSchedule = $state('');

  interface Template {
    name: string;
    command: string;
    timeout: number;
    retries: number;
    schedule: string | null;
    desc: string;
    tags: string[];
  }

  const TEMPLATES: Template[] = [
    // Observability — Disk
    {
      name: 'Disk Space Alert',
      command: 'df -h / | awk \'NR==2 {if ($5+0 > 90) {echo "ALERT: disk at $5"; exit 1} else {echo "OK: $5 used"}}\'',
      timeout: 15,
      retries: 0,
      schedule: '0 */6 * * *',
      desc: 'Alert if root disk exceeds 90%',
      tags: ['observability', 'disk'],
    },
    {
      name: 'Disk I/O Stats',
      command: 'iostat -d 1 3 2>/dev/null || echo "iostat not available"',
      timeout: 15,
      retries: 0,
      schedule: null,
      desc: 'Snapshot of disk I/O throughput and latency',
      tags: ['observability', 'disk'],
    },
    {
      name: 'Large Files Finder',
      command: 'find / -xdev -type f -size +500M -exec ls -lh {} \\; 2>/dev/null | sort -k5 -rh | head -20',
      timeout: 60,
      retries: 0,
      schedule: '0 4 * * 0',
      desc: 'Find files larger than 500MB',
      tags: ['observability', 'disk'],
    },
    {
      name: 'Inode Usage',
      command: 'df -i / | awk \'NR==2 {print "Inodes: " $5 " used (" $3 "/" $2 ")"}\'',
      timeout: 10,
      retries: 0,
      schedule: '0 */12 * * *',
      desc: 'Check inode usage — running out causes failures even with free space',
      tags: ['observability', 'disk'],
    },

    // Observability — Memory
    {
      name: 'Memory Check',
      command:
        'vm_stat | awk \'/Pages free/ {free=$3} /Pages active/ {active=$3} END {printf "Free: %.0f MB, Active: %.0f MB\\n", free*4096/1048576, active*4096/1048576}\'',
      timeout: 10,
      retries: 0,
      schedule: '*/30 * * * *',
      desc: 'Report free and active memory',
      tags: ['observability', 'memory'],
    },
    {
      name: 'Swap Usage',
      command: 'sysctl vm.swapusage 2>/dev/null || free -h 2>/dev/null | grep -i swap',
      timeout: 10,
      retries: 0,
      schedule: '0 */4 * * *',
      desc: 'Check swap memory usage — high swap indicates memory pressure',
      tags: ['observability', 'memory'],
    },
    {
      name: 'Top Memory Consumers',
      command: 'ps aux --sort=-%mem 2>/dev/null | head -11 || ps aux -m | head -11',
      timeout: 15,
      retries: 0,
      schedule: null,
      desc: 'Top 10 processes by memory usage',
      tags: ['observability', 'memory', 'process'],
    },

    // Observability — CPU / Load
    {
      name: 'CPU Load Average',
      command: 'uptime',
      timeout: 5,
      retries: 0,
      schedule: '*/15 * * * *',
      desc: 'System load averages (1, 5, 15 min)',
      tags: ['observability', 'cpu'],
    },
    {
      name: 'Top CPU Consumers',
      command: 'ps aux --sort=-%cpu 2>/dev/null | head -11 || ps aux -r | head -11',
      timeout: 15,
      retries: 0,
      schedule: null,
      desc: 'Top 10 processes by CPU usage',
      tags: ['observability', 'cpu', 'process'],
    },
    {
      name: 'CPU Temperature',
      command:
        'sudo powermetrics --samplers smc -i 1 -n 1 2>/dev/null | grep -i "CPU die" || sensors 2>/dev/null | grep -i temp || echo "Not available"',
      timeout: 15,
      retries: 0,
      schedule: null,
      desc: 'Read CPU temperature (macOS powermetrics or Linux sensors)',
      tags: ['observability', 'cpu'],
    },

    // Observability — Network
    {
      name: 'Open Ports',
      command: 'lsof -i -P -n | grep LISTEN | sort -k9',
      timeout: 15,
      retries: 0,
      schedule: null,
      desc: 'List all processes listening on network ports',
      tags: ['observability', 'network'],
    },
    {
      name: 'Network Connections',
      command: 'netstat -an 2>/dev/null | grep ESTABLISHED | wc -l | xargs -I{} echo "{} active connections"',
      timeout: 10,
      retries: 0,
      schedule: '*/30 * * * *',
      desc: 'Count active network connections',
      tags: ['observability', 'network'],
    },
    {
      name: 'DNS Resolution Test',
      command: 'time nslookup google.com 2>&1 | tail -4',
      timeout: 10,
      retries: 2,
      schedule: '*/10 * * * *',
      desc: 'Test DNS resolution speed',
      tags: ['observability', 'network'],
    },
    {
      name: 'Tailscale Status',
      command: '/Applications/Tailscale.app/Contents/MacOS/Tailscale status',
      timeout: 10,
      retries: 0,
      schedule: null,
      desc: 'Show all connected tailnet devices',
      tags: ['observability', 'network'],
    },
    {
      name: 'Bandwidth Test',
      command:
        'curl -s -o /dev/null -w "Speed: %{speed_download} bytes/sec\\nTime: %{time_total}s\\n" https://speed.cloudflare.com/__down?bytes=10000000',
      timeout: 30,
      retries: 0,
      schedule: null,
      desc: 'Quick download speed test via Cloudflare',
      tags: ['observability', 'network'],
    },

    // Process Control
    {
      name: 'Zombie Processes',
      command:
        'ps aux | awk \'$8 ~ /Z/ {print $2, $11}\' | head -20; echo "---"; ps aux | awk \'$8 ~ /Z/\' | wc -l | xargs -I{} echo "{} zombie processes"',
      timeout: 15,
      retries: 0,
      schedule: '0 */2 * * *',
      desc: 'Find zombie processes that need cleanup',
      tags: ['process', 'recovery'],
    },
    {
      name: 'Runaway Process Killer',
      command: 'ps aux | awk \'$3 > 95 && $11 !~ /kernel/ {print "HIGH CPU:", $2, $11, $3"%"}\'',
      timeout: 15,
      retries: 0,
      schedule: '*/10 * * * *',
      desc: 'Detect processes using >95% CPU',
      tags: ['process', 'recovery'],
    },
    {
      name: 'Process Count by User',
      command: "ps aux | awk '{print $1}' | sort | uniq -c | sort -rn | head -10",
      timeout: 10,
      retries: 0,
      schedule: null,
      desc: 'Count processes grouped by user',
      tags: ['process', 'observability'],
    },
    {
      name: 'Long-Running Processes',
      command: "ps -eo pid,etime,comm | awk '$2 ~ /-/ {print}' | sort -k2 -r | head -15",
      timeout: 15,
      retries: 0,
      schedule: null,
      desc: 'Processes running for more than a day',
      tags: ['process', 'observability'],
    },

    // Recovery
    {
      name: 'Service Health Check',
      command: 'curl -sf http://localhost:5555/api/tailscale > /dev/null && echo "OK" || echo "FAILED"',
      timeout: 10,
      retries: 3,
      schedule: '*/5 * * * *',
      desc: 'Verify the Home Server API is responding',
      tags: ['recovery', 'network'],
    },
    {
      name: 'Restart Home Server',
      command: 'cd ~/Code/Personal/home-server && npm run dev &',
      timeout: 15,
      retries: 0,
      schedule: null,
      desc: 'Restart the dev server if it crashed',
      tags: ['recovery'],
    },
    {
      name: 'Clear System Cache',
      command: 'sudo purge 2>/dev/null && echo "Memory cache purged" || echo "Requires sudo"',
      timeout: 15,
      retries: 0,
      schedule: null,
      desc: 'Free inactive memory (macOS purge)',
      tags: ['recovery', 'memory'],
    },
    {
      name: 'Kill Port 5555',
      command:
        'lsof -ti:5555 | xargs kill -9 2>/dev/null && echo "Killed processes on port 5555" || echo "No process on port 5555"',
      timeout: 10,
      retries: 0,
      schedule: null,
      desc: 'Force kill any process holding port 5555',
      tags: ['recovery', 'process'],
    },
    {
      name: 'Flush DNS Cache',
      command:
        'sudo dscacheutil -flushcache 2>/dev/null && sudo killall -HUP mDNSResponder 2>/dev/null && echo "DNS flushed" || systemd-resolve --flush-caches 2>/dev/null && echo "DNS flushed"',
      timeout: 10,
      retries: 0,
      schedule: null,
      desc: 'Flush DNS resolver cache',
      tags: ['recovery', 'network'],
    },

    // Maintenance
    {
      name: 'Log Rotation',
      command: 'find /tmp -name "*.log" -mtime +7 -delete && echo "Cleaned old logs"',
      timeout: 30,
      retries: 0,
      schedule: '0 3 * * 0',
      desc: 'Delete log files older than 7 days',
      tags: ['maintenance'],
    },
    {
      name: 'Temp File Cleanup',
      command: 'find /tmp -type f -atime +3 -delete 2>/dev/null; echo "Cleaned tmp files older than 3 days"',
      timeout: 30,
      retries: 0,
      schedule: '0 4 * * *',
      desc: 'Remove stale temp files',
      tags: ['maintenance', 'disk'],
    },
    {
      name: 'npm Cache Clean',
      command: 'npm cache clean --force 2>&1 && echo "npm cache cleared"',
      timeout: 30,
      retries: 0,
      schedule: null,
      desc: 'Free disk space from npm cache',
      tags: ['maintenance', 'disk'],
    },
    {
      name: 'Git Repo Status',
      command: 'cd ~/Code && for d in */; do echo "=== $d ===" && git -C "$d" status -s 2>/dev/null; done',
      timeout: 30,
      retries: 0,
      schedule: null,
      desc: 'Check git status across all repos in ~/Code',
      tags: ['maintenance'],
    },
    {
      name: 'System Uptime Report',
      command:
        'echo "Uptime: $(uptime)"; echo "Boot: $(who -b 2>/dev/null || last reboot | head -1)"; echo "Users: $(who | wc -l | tr -d \" \") logged in"',
      timeout: 10,
      retries: 0,
      schedule: '0 8 * * *',
      desc: 'Daily system uptime and login summary',
      tags: ['observability'],
    },
    {
      name: 'Backup Disk Health',
      command:
        'diskutil info /Volumes/* 2>/dev/null | grep -E "Name|Total|Free|SMART" || lsblk -o NAME,SIZE,FSAVAIL,FSUSE% 2>/dev/null',
      timeout: 15,
      retries: 0,
      schedule: '0 6 * * *',
      desc: 'Check health of mounted volumes',
      tags: ['observability', 'disk', 'recovery'],
    },

    // Security / Audit
    {
      name: 'World-Writable Files',
      command: 'find / -type f -perm -002 2>/dev/null | head -20',
      timeout: 60,
      retries: 0,
      schedule: null,
      desc: 'Locate world-writable files in the system',
      tags: ['security', 'audit'],
    },
    {
      name: 'Login History',
      command: 'last -20 2>/dev/null || lastlog -t 20',
      timeout: 15,
      retries: 0,
      schedule: null,
      desc: 'Show recent login history',
      tags: ['security', 'audit'],
    },
    {
      name: 'Firewall Status',
      command: 'sudo pfctl -s all 2>/dev/null | head -20 || sudo ufw status 2>/dev/null || echo "No firewall found"',
      timeout: 15,
      retries: 0,
      schedule: null,
      desc: 'Check firewall rules and state',
      tags: ['security'],
    },
    {
      name: 'SSH Key Audit',
      command: 'find ~ -name "*.pub" -o -name "id_*" 2>/dev/null | grep -v ".git"',
      timeout: 20,
      retries: 0,
      schedule: null,
      desc: 'Locate SSH keys in home directory',
      tags: ['security', 'audit'],
    },
    {
      name: 'Failed Auth Attempts',
      command:
        'grep "Failed password" /var/log/auth.log 2>/dev/null | tail -10 || log show --predicate \'eventMessage contains "invalid"\' --last 1h 2>/dev/null | tail -10',
      timeout: 15,
      retries: 0,
      schedule: null,
      desc: 'Show recent failed authentication attempts',
      tags: ['security', 'log-analysis'],
    },
    {
      name: 'SUID Binaries Check',
      command: 'find /usr/bin /usr/local/bin -perm -u+s -type f 2>/dev/null',
      timeout: 30,
      retries: 0,
      schedule: null,
      desc: 'Audit SUID binaries for security concerns',
      tags: ['security', 'audit'],
    },

    // Docker
    {
      name: 'Docker Containers',
      command:
        'docker ps -a --format "table {{.Names}}\\t{{.Status}}\\t{{.Image}}" 2>/dev/null || echo "Docker not available"',
      timeout: 15,
      retries: 1,
      schedule: null,
      desc: 'List all Docker containers with status',
      tags: ['docker'],
    },
    {
      name: 'Docker Images',
      command:
        'docker images --format "table {{.Repository}}:{{.Tag}}\\t{{.Size}}" 2>/dev/null || echo "Docker not available"',
      timeout: 15,
      retries: 1,
      schedule: null,
      desc: 'Show all Docker images and sizes',
      tags: ['docker'],
    },
    {
      name: 'Docker Disk Usage',
      command: 'docker system df 2>/dev/null || echo "Docker not available"',
      timeout: 20,
      retries: 1,
      schedule: null,
      desc: 'Display Docker system disk usage',
      tags: ['docker', 'disk'],
    },
    {
      name: 'Docker Prune',
      command: 'docker system prune -a --volumes -f 2>/dev/null && echo "Pruned" || echo "Docker not available"',
      timeout: 120,
      retries: 0,
      schedule: null,
      desc: 'Remove all unused Docker resources',
      tags: ['docker', 'maintenance'],
    },
    {
      name: 'Docker Latest Logs',
      command: 'docker logs --tail=50 $(docker ps -q | head -1) 2>/dev/null || echo "No running containers"',
      timeout: 15,
      retries: 0,
      schedule: null,
      desc: 'Fetch last 50 lines of latest container logs',
      tags: ['docker', 'log-analysis'],
    },

    // Git
    {
      name: 'Git Repo Sizes',
      command: 'du -sh .git 2>/dev/null && du -sh . 2>/dev/null || echo "Not a git repo"',
      timeout: 15,
      retries: 0,
      schedule: null,
      desc: 'Show Git repo and working directory size',
      tags: ['git'],
    },
    {
      name: 'Stale Git Branches',
      command: 'git branch -vv 2>/dev/null | grep ": gone\\]" || echo "No stale branches"',
      timeout: 15,
      retries: 0,
      schedule: null,
      desc: 'Find branches with deleted upstream tracking',
      tags: ['git', 'maintenance'],
    },
    {
      name: 'Git Recent Activity',
      command: 'git log --oneline -10 2>/dev/null || echo "Not a git repo"',
      timeout: 15,
      retries: 0,
      schedule: null,
      desc: 'Show last 10 commits',
      tags: ['git'],
    },
    {
      name: 'Git Uncommitted Changes',
      command: 'git status --short 2>/dev/null | wc -l | xargs -I{} echo "{} uncommitted changes"',
      timeout: 10,
      retries: 0,
      schedule: null,
      desc: 'Count uncommitted changes in working directory',
      tags: ['git'],
    },
    {
      name: 'Git GC',
      command: 'git gc --aggressive --prune=now 2>/dev/null && echo "GC completed" || echo "Not a git repo"',
      timeout: 120,
      retries: 0,
      schedule: null,
      desc: 'Run aggressive garbage collection on Git repo',
      tags: ['git', 'maintenance'],
    },

    // Database
    {
      name: 'SQLite Check',
      command: 'sqlite3 :memory: "SELECT sqlite_version();" && echo "SQLite OK" || echo "SQLite not available"',
      timeout: 10,
      retries: 0,
      schedule: null,
      desc: 'Verify SQLite installation and version',
      tags: ['database'],
    },
    {
      name: 'PostgreSQL Databases',
      command: 'psql -l -t 2>/dev/null || echo "PostgreSQL not accessible"',
      timeout: 15,
      retries: 1,
      schedule: null,
      desc: 'List PostgreSQL databases and sizes',
      tags: ['database'],
    },
    {
      name: 'Redis Info',
      command: 'redis-cli info server 2>/dev/null || echo "Redis not running"',
      timeout: 10,
      retries: 1,
      schedule: null,
      desc: 'Display Redis server information',
      tags: ['database'],
    },
    {
      name: 'MySQL Status',
      command: 'mysql -e "SELECT VERSION();" 2>/dev/null || echo "MySQL not running"',
      timeout: 15,
      retries: 1,
      schedule: null,
      desc: 'Check MySQL/MariaDB connection and version',
      tags: ['database'],
    },

    // macOS
    {
      name: 'Homebrew Update',
      command: 'brew update && brew outdated || echo "Homebrew not available"',
      timeout: 60,
      retries: 0,
      schedule: null,
      desc: 'Update Homebrew and list outdated packages',
      tags: ['macos', 'maintenance'],
    },
    {
      name: 'System Profiler',
      command: 'system_profiler SPHardwareDataType SPSoftwareDataType 2>/dev/null | head -30',
      timeout: 30,
      retries: 0,
      schedule: null,
      desc: 'Display hardware and software system info',
      tags: ['macos'],
    },
    {
      name: 'Installed Apps',
      command: 'ls /Applications | wc -l | xargs -I{} echo "{} apps" && ls /Applications | head -20',
      timeout: 15,
      retries: 0,
      schedule: null,
      desc: 'Count and list installed applications',
      tags: ['macos'],
    },
    {
      name: 'Spotlight Status',
      command: 'mdutil -s / 2>/dev/null || echo "Spotlight status unavailable"',
      timeout: 15,
      retries: 0,
      schedule: null,
      desc: 'Check macOS Spotlight indexing status',
      tags: ['macos'],
    },
    {
      name: 'Power Settings',
      command: 'pmset -g 2>/dev/null || echo "Power settings unavailable"',
      timeout: 15,
      retries: 0,
      schedule: null,
      desc: 'Display current power management settings',
      tags: ['macos'],
    },

    // SSL / Certs
    {
      name: 'SSL Cert Expiry',
      command:
        'echo | openssl s_client -servername example.com -connect example.com:443 2>/dev/null | openssl x509 -noout -dates',
      timeout: 20,
      retries: 0,
      schedule: null,
      desc: 'Check SSL certificate expiration date',
      tags: ['ssl', 'security'],
    },
    {
      name: 'Generate Self-Signed Cert',
      command:
        'openssl req -x509 -newkey rsa:4096 -keyout /tmp/key.pem -out /tmp/cert.pem -days 365 -nodes -subj "/CN=localhost" && echo "Generated in /tmp/"',
      timeout: 30,
      retries: 0,
      schedule: null,
      desc: 'Generate self-signed SSL certificate',
      tags: ['ssl', 'maintenance'],
    },
    {
      name: 'Localhost Cert Check',
      command:
        'echo | openssl s_client -connect localhost:443 2>/dev/null | openssl x509 -noout -text | head -20 || echo "No SSL on localhost:443"',
      timeout: 15,
      retries: 0,
      schedule: null,
      desc: 'Check SSL cert served by localhost',
      tags: ['ssl'],
    },

    // User Management
    {
      name: 'System Users',
      command: 'dscl . -list /Users | grep -v "^_" 2>/dev/null || awk -F: \'$3 >= 1000 {print $1}\' /etc/passwd',
      timeout: 10,
      retries: 0,
      schedule: null,
      desc: 'List non-system user accounts',
      tags: ['user-mgmt', 'audit'],
    },
    {
      name: 'Last Login Times',
      command: 'lastlog -t 30 2>/dev/null || last | head -20',
      timeout: 15,
      retries: 0,
      schedule: null,
      desc: 'Show user last login times',
      tags: ['user-mgmt', 'audit'],
    },
    {
      name: 'User Groups',
      command: 'id && groups',
      timeout: 10,
      retries: 0,
      schedule: null,
      desc: 'Show current user ID and group memberships',
      tags: ['user-mgmt'],
    },

    // Service Watchdog
    {
      name: 'Launchctl Services',
      command:
        'launchctl list 2>/dev/null | head -20 || systemctl list-units --type=service --state=running 2>/dev/null | head -20',
      timeout: 15,
      retries: 0,
      schedule: null,
      desc: 'List managed services (macOS/Linux)',
      tags: ['watchdog'],
    },
    {
      name: 'Port Connectivity Check',
      command:
        'for port in 80 443 3000 5555 8080; do (echo > /dev/tcp/localhost/$port) 2>/dev/null && echo "Port $port: OPEN" || echo "Port $port: CLOSED"; done',
      timeout: 30,
      retries: 0,
      schedule: null,
      desc: 'Check if common ports are accessible',
      tags: ['watchdog', 'network'],
    },
    {
      name: 'Health Endpoint Ping',
      command:
        'curl -sf -o /dev/null -w "%{http_code}" http://localhost:5555/api/tailscale && echo " OK" || echo "FAILED"',
      timeout: 10,
      retries: 1,
      schedule: '*/5 * * * *',
      desc: 'Ping Home Server health endpoint',
      tags: ['watchdog'],
    },

    // Log Analysis
    {
      name: 'System Error Log',
      command:
        'log show --last 1h --predicate \'messageType == error\' 2>/dev/null | tail -20 || grep -i "error\\|fatal" /var/log/syslog 2>/dev/null | tail -20',
      timeout: 20,
      retries: 0,
      schedule: null,
      desc: 'Extract errors from recent system logs',
      tags: ['log-analysis'],
    },
    {
      name: 'Log File Sizes',
      command: 'du -sh /var/log/* 2>/dev/null | sort -h | tail -10',
      timeout: 15,
      retries: 0,
      schedule: null,
      desc: 'Show top 10 largest log files',
      tags: ['log-analysis', 'disk'],
    },
    {
      name: 'Auth Log Analysis',
      command:
        'grep -c "Failed password" /var/log/auth.log 2>/dev/null | xargs -I{} echo "{} failed attempts" || echo "Auth log not available"',
      timeout: 15,
      retries: 0,
      schedule: null,
      desc: 'Count failed logins from auth log',
      tags: ['log-analysis', 'security'],
    },
    {
      name: 'Recent Warnings',
      command:
        'log show --last 1h --predicate \'messageType == warning\' 2>/dev/null | tail -15 || grep -i "warning" /var/log/syslog 2>/dev/null | tail -15',
      timeout: 20,
      retries: 0,
      schedule: null,
      desc: 'Extract warnings from recent system logs',
      tags: ['log-analysis'],
    },

    // File Integrity
    {
      name: 'Recent File Changes',
      command: 'find /etc -type f -mtime -1 -ls 2>/dev/null | head -20 || echo "No recent changes in /etc"',
      timeout: 20,
      retries: 0,
      schedule: '0 6 * * *',
      desc: 'Find files in /etc modified in last 24 hours',
      tags: ['file-integrity', 'security'],
    },
    {
      name: 'Broken Symlinks',
      command:
        'find /usr/local -type l -exec test ! -e {} \\; -print 2>/dev/null | head -20 || echo "No broken symlinks"',
      timeout: 30,
      retries: 0,
      schedule: null,
      desc: 'Find broken symlinks in /usr/local',
      tags: ['file-integrity'],
    },
    {
      name: 'File Permission Audit',
      command: 'find /usr/local/bin -type f -perm -u+s 2>/dev/null | head -20 || echo "No SUID files found"',
      timeout: 30,
      retries: 0,
      schedule: null,
      desc: 'Find setuid files that could pose risks',
      tags: ['file-integrity', 'security'],
    },
    {
      name: 'Home Dir Size Breakdown',
      command: 'du -sh ~/* 2>/dev/null | sort -h | tail -15',
      timeout: 30,
      retries: 0,
      schedule: null,
      desc: 'Show size of each directory in home',
      tags: ['file-integrity', 'disk'],
    },

    // ─── Redis ─────────────────────────────────────────────────────────────
    {
      name: 'Redis: Server Status',
      command: 'redis-cli info server 2>/dev/null | head -20 || echo "Redis not running"',
      timeout: 10,
      retries: 0,
      schedule: null,
      desc: 'Show Redis server version, uptime, and mode',
      tags: ['redis', 'database'],
    },
    {
      name: 'Redis: Memory Usage',
      command:
        'redis-cli info memory 2>/dev/null | grep -E "used_memory_human|maxmemory_human|mem_fragmentation" || echo "Redis not available"',
      timeout: 10,
      retries: 0,
      schedule: null,
      desc: 'Check Redis memory usage and fragmentation ratio',
      tags: ['redis', 'database'],
    },
    {
      name: 'Redis: Connected Clients',
      command: 'redis-cli info clients 2>/dev/null || echo "Redis not available"',
      timeout: 10,
      retries: 0,
      schedule: null,
      desc: 'Show connected client count and blocked clients',
      tags: ['redis', 'database'],
    },
    {
      name: 'Redis: Key Count by DB',
      command: 'redis-cli info keyspace 2>/dev/null || echo "Redis not available"',
      timeout: 10,
      retries: 0,
      schedule: null,
      desc: 'Show number of keys per Redis database',
      tags: ['redis', 'database'],
    },
    {
      name: 'Redis: Slow Log',
      command: 'redis-cli slowlog get 10 2>/dev/null || echo "Redis not available"',
      timeout: 10,
      retries: 0,
      schedule: null,
      desc: 'Show 10 most recent slow queries',
      tags: ['redis', 'database'],
    },
    {
      name: 'Redis: Flush All (DANGER)',
      command: 'echo "Run: redis-cli FLUSHALL" && echo "⚠ This will delete ALL keys in ALL databases"',
      timeout: 5,
      retries: 0,
      schedule: null,
      desc: 'Print flush command — does not execute (safety)',
      tags: ['redis', 'database'],
    },
    {
      name: 'Redis: Ping Test',
      command: 'redis-cli ping 2>/dev/null && echo "Redis is responding" || echo "Redis not available"',
      timeout: 5,
      retries: 1,
      schedule: '*/5 * * * *',
      desc: 'Quick health check — PONG means alive',
      tags: ['redis', 'database', 'watchdog'],
    },
    {
      name: 'Redis: Save Snapshot',
      command: 'redis-cli bgsave 2>/dev/null && echo "Background save started" || echo "Redis not available"',
      timeout: 10,
      retries: 0,
      schedule: null,
      desc: 'Trigger background RDB snapshot save',
      tags: ['redis', 'database', 'maintenance'],
    },

    // ─── MongoDB ───────────────────────────────────────────────────────────
    {
      name: 'MongoDB: Server Status',
      command:
        'mongosh --eval "db.serverStatus().version" --quiet 2>/dev/null || mongod --version 2>/dev/null || echo "MongoDB not available"',
      timeout: 15,
      retries: 0,
      schedule: null,
      desc: 'Show MongoDB version and status',
      tags: ['mongodb', 'database'],
    },
    {
      name: 'MongoDB: Database List',
      command:
        "mongosh --eval \"db.adminCommand('listDatabases').databases.forEach(d => print(d.name + ' — ' + (d.sizeOnDisk/1024/1024).toFixed(1) + ' MB'))\" --quiet 2>/dev/null || echo \"MongoDB not available\"",
      timeout: 15,
      retries: 0,
      schedule: null,
      desc: 'List all databases with sizes',
      tags: ['mongodb', 'database'],
    },
    {
      name: 'MongoDB: Connection Count',
      command: 'mongosh --eval "db.serverStatus().connections" --quiet 2>/dev/null || echo "MongoDB not available"',
      timeout: 10,
      retries: 0,
      schedule: null,
      desc: 'Show current and available connections',
      tags: ['mongodb', 'database'],
    },
    {
      name: 'MongoDB: Replica Set Status',
      command: 'mongosh --eval "rs.status()" --quiet 2>/dev/null || echo "Not a replica set or MongoDB not available"',
      timeout: 10,
      retries: 0,
      schedule: null,
      desc: 'Check replica set health and member states',
      tags: ['mongodb', 'database'],
    },
    {
      name: 'MongoDB: Current Operations',
      command:
        'mongosh --eval "db.currentOp().inprog.length + \' active operations\'" --quiet 2>/dev/null || echo "MongoDB not available"',
      timeout: 10,
      retries: 0,
      schedule: null,
      desc: 'Count currently running operations',
      tags: ['mongodb', 'database'],
    },
    {
      name: 'MongoDB: Storage Stats',
      command:
        'mongosh --eval "JSON.stringify(db.stats(), null, 2)" --quiet 2>/dev/null || echo "MongoDB not available"',
      timeout: 15,
      retries: 0,
      schedule: null,
      desc: 'Show storage statistics for current database',
      tags: ['mongodb', 'database'],
    },
    {
      name: 'MongoDB: Index Stats',
      command:
        "mongosh --eval \"db.getCollectionNames().forEach(c => { var s = db[c].stats(); print(c + ': ' + s.nindexes + ' indexes, ' + (s.totalIndexSize/1024/1024).toFixed(1) + ' MB') })\" --quiet 2>/dev/null || echo \"MongoDB not available\"",
      timeout: 15,
      retries: 0,
      schedule: null,
      desc: 'Show index count and size per collection',
      tags: ['mongodb', 'database'],
    },
    {
      name: 'MongoDB: Compact Database',
      command:
        'echo "Run: mongosh --eval \\"db.runCommand({compact: \'collectionName\'})\\"" && echo "⚠ Compact requires collection name — edit before running"',
      timeout: 5,
      retries: 0,
      schedule: null,
      desc: 'Print compact command template (edit before use)',
      tags: ['mongodb', 'database', 'maintenance'],
    },

    // ─── PostgreSQL ────────────────────────────────────────────────────────
    {
      name: 'Postgres: Database Sizes',
      command:
        'psql -c "SELECT datname, pg_size_pretty(pg_database_size(datname)) as size FROM pg_database ORDER BY pg_database_size(datname) DESC;" 2>/dev/null || echo "PostgreSQL not available"',
      timeout: 15,
      retries: 0,
      schedule: null,
      desc: 'List all databases with human-readable sizes',
      tags: ['postgres', 'database'],
    },
    {
      name: 'Postgres: Active Connections',
      command:
        'psql -c "SELECT count(*) as total, state FROM pg_stat_activity GROUP BY state;" 2>/dev/null || echo "PostgreSQL not available"',
      timeout: 10,
      retries: 0,
      schedule: null,
      desc: 'Show connection count grouped by state',
      tags: ['postgres', 'database'],
    },
    {
      name: 'Postgres: Long-Running Queries',
      command:
        'psql -c "SELECT pid, now() - pg_stat_activity.query_start AS duration, query FROM pg_stat_activity WHERE state = \'active\' AND now() - pg_stat_activity.query_start > interval \'5 seconds\' ORDER BY duration DESC LIMIT 5;" 2>/dev/null || echo "PostgreSQL not available"',
      timeout: 10,
      retries: 0,
      schedule: null,
      desc: 'Find queries running longer than 5 seconds',
      tags: ['postgres', 'database'],
    },
    {
      name: 'Postgres: Table Sizes',
      command:
        "psql -c \"SELECT schemaname, tablename, pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size FROM pg_tables WHERE schemaname = 'public' ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC LIMIT 15;\" 2>/dev/null || echo \"PostgreSQL not available\"",
      timeout: 15,
      retries: 0,
      schedule: null,
      desc: 'Top 15 largest tables by total size',
      tags: ['postgres', 'database'],
    },
    {
      name: 'Postgres: Cache Hit Ratio',
      command:
        'psql -c "SELECT sum(heap_blks_read) as disk_reads, sum(heap_blks_hit) as cache_hits, round(sum(heap_blks_hit) / (sum(heap_blks_hit) + sum(heap_blks_read))::numeric * 100, 2) as ratio FROM pg_statio_user_tables;" 2>/dev/null || echo "PostgreSQL not available"',
      timeout: 10,
      retries: 0,
      schedule: null,
      desc: 'Check buffer cache hit ratio (should be >99%)',
      tags: ['postgres', 'database'],
    },
    {
      name: 'Postgres: Vacuum Status',
      command:
        'psql -c "SELECT schemaname, relname, last_vacuum, last_autovacuum, n_dead_tup FROM pg_stat_user_tables ORDER BY n_dead_tup DESC LIMIT 10;" 2>/dev/null || echo "PostgreSQL not available"',
      timeout: 10,
      retries: 0,
      schedule: null,
      desc: 'Tables with most dead tuples needing vacuum',
      tags: ['postgres', 'database'],
    },
    {
      name: 'Postgres: Replication Status',
      command:
        'psql -c "SELECT * FROM pg_stat_replication;" 2>/dev/null || echo "No replication configured or PostgreSQL not available"',
      timeout: 10,
      retries: 0,
      schedule: null,
      desc: 'Check streaming replication lag and status',
      tags: ['postgres', 'database'],
    },
    {
      name: 'Postgres: Version & Uptime',
      command:
        'psql -c "SELECT version();" 2>/dev/null && psql -c "SELECT pg_postmaster_start_time(), now() - pg_postmaster_start_time() as uptime;" 2>/dev/null || echo "PostgreSQL not available"',
      timeout: 10,
      retries: 0,
      schedule: null,
      desc: 'Show PostgreSQL version and server uptime',
      tags: ['postgres', 'database'],
    },

    // ─── Homebrew ──────────────────────────────────────────────────────────
    {
      name: 'Brew: Outdated Packages',
      command: 'brew outdated 2>/dev/null || echo "Homebrew not installed"',
      timeout: 30,
      retries: 0,
      schedule: null,
      desc: 'List packages with available updates',
      tags: ['homebrew', 'macos', 'maintenance'],
    },
    {
      name: 'Brew: Doctor',
      command: 'brew doctor 2>&1 | head -30 || echo "Homebrew not installed"',
      timeout: 30,
      retries: 0,
      schedule: null,
      desc: 'Run diagnostics on Homebrew installation',
      tags: ['homebrew', 'macos'],
    },
    {
      name: 'Brew: Installed Packages',
      command:
        'brew list --formula 2>/dev/null | wc -l | xargs -I{} echo "{} formula installed" && brew list --cask 2>/dev/null | wc -l | xargs -I{} echo "{} casks installed" || echo "Homebrew not installed"',
      timeout: 15,
      retries: 0,
      schedule: null,
      desc: 'Count installed formulae and casks',
      tags: ['homebrew', 'macos'],
    },
    {
      name: 'Brew: Cleanup',
      command:
        'brew cleanup -n 2>/dev/null | tail -5 && echo "---" && brew cleanup --prune=7 -n 2>/dev/null | tail -3 || echo "Homebrew not installed"',
      timeout: 30,
      retries: 0,
      schedule: null,
      desc: 'Preview what cleanup would remove (dry run)',
      tags: ['homebrew', 'macos', 'maintenance'],
    },
    {
      name: 'Brew: Services List',
      command: 'brew services list 2>/dev/null || echo "Homebrew not installed"',
      timeout: 10,
      retries: 0,
      schedule: null,
      desc: 'Show all Homebrew-managed services and their status',
      tags: ['homebrew', 'macos', 'watchdog'],
    },
    {
      name: 'Brew: Disk Usage',
      command: 'du -sh $(brew --cellar) $(brew --caskroom) 2>/dev/null || echo "Homebrew not installed"',
      timeout: 15,
      retries: 0,
      schedule: null,
      desc: 'Show disk space used by Homebrew cellar and caskroom',
      tags: ['homebrew', 'macos', 'disk'],
    },
    {
      name: 'Brew: Dependency Tree',
      command: 'brew deps --tree --installed 2>/dev/null | head -40 || echo "Homebrew not installed"',
      timeout: 30,
      retries: 0,
      schedule: null,
      desc: 'Show dependency tree of installed packages',
      tags: ['homebrew', 'macos'],
    },
    {
      name: 'Brew: Update All',
      command: 'brew update && brew upgrade 2>&1 | tail -20 || echo "Homebrew not installed"',
      timeout: 120,
      retries: 0,
      schedule: null,
      desc: 'Update Homebrew and upgrade all packages',
      tags: ['homebrew', 'macos', 'maintenance'],
    },

    // ─── Node.js / npm ─────────────────────────────────────────────────────
    {
      name: 'Node: Version Info',
      command: 'echo "Node: $(node -v)" && echo "npm: $(npm -v)" && echo "npx: $(npx -v 2>/dev/null || echo N/A)"',
      timeout: 10,
      retries: 0,
      schedule: null,
      desc: 'Show Node.js, npm, and npx versions',
      tags: ['node', 'dev'],
    },
    {
      name: 'Node: Global Packages',
      command: 'npm list -g --depth=0 2>/dev/null',
      timeout: 15,
      retries: 0,
      schedule: null,
      desc: 'List globally installed npm packages',
      tags: ['node', 'dev'],
    },
    {
      name: 'Node: Cache Size',
      command: 'du -sh $(npm config get cache) 2>/dev/null || echo "Cannot determine npm cache"',
      timeout: 10,
      retries: 0,
      schedule: null,
      desc: 'Show npm cache disk usage',
      tags: ['node', 'dev', 'disk'],
    },
    {
      name: 'Node: Audit Project',
      command: 'npm audit --omit=dev 2>/dev/null | tail -20 || echo "Not in a Node project"',
      timeout: 30,
      retries: 0,
      schedule: null,
      desc: 'Run security audit on current project dependencies',
      tags: ['node', 'dev', 'security'],
    },
    {
      name: 'Node: Running Processes',
      command: 'pgrep -fl "node " | head -15 || echo "No Node processes running"',
      timeout: 10,
      retries: 0,
      schedule: null,
      desc: 'List all running Node.js processes',
      tags: ['node', 'dev', 'process'],
    },
    {
      name: 'Node: Port Usage',
      command: 'lsof -iTCP -sTCP:LISTEN -n -P 2>/dev/null | grep node | head -10 || echo "No Node processes listening"',
      timeout: 10,
      retries: 0,
      schedule: null,
      desc: 'Show ports used by Node.js processes',
      tags: ['node', 'dev', 'network'],
    },
    {
      name: 'Node: nvm List',
      command: 'source ~/.nvm/nvm.sh 2>/dev/null && nvm list 2>/dev/null || echo "nvm not installed"',
      timeout: 10,
      retries: 0,
      schedule: null,
      desc: 'List installed Node versions via nvm',
      tags: ['node', 'dev'],
    },
    {
      name: 'Node: Kill All',
      command: 'pkill -f "node " && echo "All Node processes killed" || echo "No Node processes to kill"',
      timeout: 10,
      retries: 0,
      schedule: null,
      desc: 'Kill all running Node.js processes',
      tags: ['node', 'dev', 'process'],
    },

    // ─── Python ────────────────────────────────────────────────────────────
    {
      name: 'Python: Version Info',
      command: 'python3 --version && pip3 --version 2>/dev/null || echo "Python3 not available"',
      timeout: 10,
      retries: 0,
      schedule: null,
      desc: 'Show Python and pip versions',
      tags: ['python', 'dev'],
    },
    {
      name: 'Python: Installed Packages',
      command: 'pip3 list 2>/dev/null | head -30 || echo "pip3 not available"',
      timeout: 15,
      retries: 0,
      schedule: null,
      desc: 'List installed Python packages',
      tags: ['python', 'dev'],
    },
    {
      name: 'Python: Outdated Packages',
      command: 'pip3 list --outdated 2>/dev/null | head -20 || echo "pip3 not available"',
      timeout: 30,
      retries: 0,
      schedule: null,
      desc: 'Show packages with available updates',
      tags: ['python', 'dev'],
    },
    {
      name: 'Python: Virtual Envs',
      command: 'find ~/Code -name "pyvenv.cfg" -maxdepth 3 2>/dev/null | head -10 || echo "No venvs found"',
      timeout: 15,
      retries: 0,
      schedule: null,
      desc: 'Find Python virtual environments in ~/Code',
      tags: ['python', 'dev'],
    },
    {
      name: 'Python: Running Processes',
      command: 'pgrep -fl "python" | head -10 || echo "No Python processes running"',
      timeout: 10,
      retries: 0,
      schedule: null,
      desc: 'List all running Python processes',
      tags: ['python', 'dev', 'process'],
    },
    {
      name: 'Python: Cache Cleanup',
      command:
        'find ~/Code -type d -name "__pycache__" 2>/dev/null | wc -l | xargs -I{} echo "{} __pycache__ directories found"',
      timeout: 15,
      retries: 0,
      schedule: null,
      desc: 'Count __pycache__ directories (run with -delete to clean)',
      tags: ['python', 'dev', 'maintenance'],
    },
    {
      name: 'Python: Pip Cache Size',
      command:
        'pip3 cache info 2>/dev/null || du -sh ~/Library/Caches/pip 2>/dev/null || echo "Cannot determine pip cache"',
      timeout: 10,
      retries: 0,
      schedule: null,
      desc: 'Show pip download cache size',
      tags: ['python', 'dev', 'disk'],
    },
    {
      name: 'Python: Security Check',
      command:
        'pip3 audit 2>/dev/null || pip-audit 2>/dev/null || echo "pip-audit not installed (pip install pip-audit)"',
      timeout: 30,
      retries: 0,
      schedule: null,
      desc: 'Audit installed packages for known vulnerabilities',
      tags: ['python', 'dev', 'security'],
    },

    // ─── Docker ────────────────────────────────────────────────────────────
    {
      name: 'Docker: Resource Usage',
      command:
        'docker stats --no-stream --format "table {{.Name}}\\t{{.CPUPerc}}\\t{{.MemUsage}}\\t{{.NetIO}}" 2>/dev/null || echo "Docker not running"',
      timeout: 15,
      retries: 0,
      schedule: null,
      desc: 'Snapshot of container CPU, memory, and network',
      tags: ['docker', 'dev'],
    },
    {
      name: 'Docker: Volume List',
      command: 'docker volume ls --format "table {{.Name}}\\t{{.Driver}}" 2>/dev/null || echo "Docker not running"',
      timeout: 10,
      retries: 0,
      schedule: null,
      desc: 'List all Docker volumes',
      tags: ['docker', 'dev'],
    },
    {
      name: 'Docker: Network List',
      command:
        'docker network ls --format "table {{.Name}}\\t{{.Driver}}\\t{{.Scope}}" 2>/dev/null || echo "Docker not running"',
      timeout: 10,
      retries: 0,
      schedule: null,
      desc: 'List Docker networks with driver info',
      tags: ['docker', 'dev'],
    },
    {
      name: 'Docker: Compose Status',
      command: 'docker compose ps 2>/dev/null || docker-compose ps 2>/dev/null || echo "No compose project running"',
      timeout: 10,
      retries: 0,
      schedule: null,
      desc: 'Show status of docker-compose services',
      tags: ['docker', 'dev'],
    },
    {
      name: 'Docker: Build Cache',
      command: 'docker builder prune --all -f 2>/dev/null && echo "Build cache cleared" || echo "Docker not running"',
      timeout: 30,
      retries: 0,
      schedule: null,
      desc: 'Clear Docker build cache to free disk',
      tags: ['docker', 'dev', 'maintenance'],
    },
    {
      name: 'Docker: Dangling Images',
      command:
        'docker images -f "dangling=true" -q 2>/dev/null | wc -l | xargs -I{} echo "{} dangling images" || echo "Docker not running"',
      timeout: 10,
      retries: 0,
      schedule: null,
      desc: 'Count untagged/dangling images',
      tags: ['docker', 'dev'],
    },
    {
      name: 'Docker: Container Logs (Last)',
      command: 'LAST=$(docker ps -lq 2>/dev/null) && docker logs --tail=30 $LAST 2>/dev/null || echo "No containers"',
      timeout: 10,
      retries: 0,
      schedule: null,
      desc: 'Last 30 lines of most recently started container',
      tags: ['docker', 'dev', 'log-analysis'],
    },
    {
      name: 'Docker: System Events',
      command:
        'timeout 5 docker events --since 1h --format "{{.Time}} {{.Action}} {{.Type}}/{{.Actor.Attributes.name}}" 2>/dev/null | tail -20 || echo "Docker not running"',
      timeout: 10,
      retries: 0,
      schedule: null,
      desc: 'Show Docker events from the last hour',
      tags: ['docker', 'dev'],
    },
  ];

  // Custom templates (localStorage)
  let customTemplates = $state<Template[]>(loadCustomTemplates());

  function loadCustomTemplates(): Template[] {
    if (typeof localStorage === 'undefined') return [];
    try {
      return JSON.parse(localStorage.getItem('hs:custom-templates') || '[]');
    } catch {
      return [];
    }
  }

  function saveCustomTemplates() {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('hs:custom-templates', JSON.stringify(customTemplates));
    }
  }

  // Edit template state
  let editingTemplateIdx = $state<number | null>(null);

  function deleteCustomTemplate(index: number) {
    const t = customTemplates[index];
    customTemplates = customTemplates.filter((_, i) => i !== index);
    saveCustomTemplates();
    toast.success(`Deleted template "${t.name}"`);
  }

  function editCustomTemplate(index: number) {
    const t = customTemplates[index];
    editingTemplateIdx = index;
    formName = t.name;
    formCommand = t.command;
    formTimeout = t.timeout;
    formRetries = t.retries;
    formSchedule = t.schedule || '';
    showTemplates = false;
    showForm = true;
  }

  function saveEditedTemplate() {
    if (editingTemplateIdx === null) return;
    customTemplates[editingTemplateIdx] = {
      name: formName,
      command: formCommand,
      timeout: formTimeout,
      retries: formRetries,
      schedule: formSchedule || null,
      desc: customTemplates[editingTemplateIdx].desc,
      tags: customTemplates[editingTemplateIdx].tags,
    };
    saveCustomTemplates();
    toast.success(`Updated template "${formName}"`);
    editingTemplateIdx = null;
    showForm = false;
    formName = '';
    formCommand = '';
    formTimeout = 300;
    formRetries = 3;
    formSchedule = '';
  }

  function saveAsTemplate(status: (typeof statuses)[0]) {
    const t: Template = {
      name: status.config.name,
      command: status.config.command,
      timeout: status.config.timeout,
      retries: status.config.maxRetries,
      schedule: status.config.schedule,
      desc: `Custom template from "${status.config.name}"`,
      tags: ['custom'],
    };
    customTemplates = [...customTemplates, t];
    saveCustomTemplates();
    toast.success(`Saved "${t.name}" as template`);
  }

  // Merge built-in + custom templates
  let allTemplates = $derived([...customTemplates, ...TEMPLATES]);

  // Template search/filter/pagination
  let templateSearch = $state('');
  let templateTag = $state('');
  let templatePage = $state(0);
  const TEMPLATES_PER_PAGE = 9;

  let allTags = $derived([...new Set(allTemplates.flatMap((t) => t.tags))].sort());

  let filteredTemplates = $derived.by(() => {
    let result = allTemplates;
    if (templateSearch) {
      const q = templateSearch.toLowerCase();
      result = result.filter(
        (t) =>
          t.name.toLowerCase().includes(q) || t.desc.toLowerCase().includes(q) || t.command.toLowerCase().includes(q),
      );
    }
    if (templateTag) {
      result = result.filter((t) => t.tags.includes(templateTag));
    }
    return result;
  });

  let templateTotalPages = $derived(Math.max(1, Math.ceil(filteredTemplates.length / TEMPLATES_PER_PAGE)));
  let pagedTemplates = $derived(
    filteredTemplates.slice(templatePage * TEMPLATES_PER_PAGE, (templatePage + 1) * TEMPLATES_PER_PAGE),
  );

  // Reset page when filter changes
  $effect(() => {
    filteredTemplates.length;
    templatePage = 0;
  });

  function applyTemplate(t: Template) {
    formName = t.name;
    formCommand = t.command;
    formTimeout = t.timeout;
    formRetries = t.retries;
    formSchedule = t.schedule || '';
    showTemplates = false;
    showForm = true;
  }

  async function runTemplate(t: Template) {
    try {
      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: t.name,
          command: t.command,
          timeout: t.timeout,
          maxRetries: t.retries,
          schedule: t.schedule,
        }),
      });
      if (!res.ok) throw new Error('Failed to create task');
      const created = await res.json();
      toast.info(`Running "${t.name}"...`, { key: `task-run-${t.name}` });
      await refresh();
      // Immediately run
      const taskId = created.id || statuses.find((s) => s.config.name === t.name)?.config.id;
      if (taskId) {
        expandedTask = taskId;
        // Open terminal
        terminalVisible = true;
        terminalTaskName = t.name;
        terminalTaskId = taskId;
        terminalRunning = true;
        terminalOutput = `$ ${t.command}\n\n`;
        await fetch('/api/tasks', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ taskId }),
        });
        const poll = setInterval(async () => {
          await refresh();
          const s = statuses.find((s) => s.config.id === taskId);
          if (s?.lastRun?.output) {
            terminalOutput = `$ ${t.command}\n\n${s.lastRun.output}`;
            if (terminalEl) terminalEl.scrollTop = terminalEl.scrollHeight;
          }
          if (!s?.isRunning) {
            clearInterval(poll);
            terminalRunning = false;
            if (s?.lastRun?.output) {
              terminalOutput = `$ ${t.command}\n\n${s.lastRun.output}`;
            }
            if (s?.lastRun?.status === 'success') toast.success(`"${t.name}" completed`);
            else if (s?.lastRun?.status) toast.error(`"${t.name}" ${s.lastRun.status}`);
          }
        }, 1000);
      }
    } catch (e: any) {
      toast.error(e.message || 'Failed to run template');
    }
  }

  // Template runner terminal state
  let terminalVisible = $state(false);
  let terminalOutput = $state('');
  let terminalTaskName = $state('');
  let terminalTaskId = $state<string | null>(null);
  let terminalRunning = $state(false);
  let terminalEl: HTMLPreElement | undefined = $state(undefined);

  function closeTerminal() {
    terminalVisible = false;
    terminalOutput = '';
    terminalTaskName = '';
    terminalTaskId = null;
    terminalRunning = false;
  }

  // Advanced form toggle
  let showAdvanced = $state(false);

  let expandedTask = $state<string | null>(null);

  // Task list search + pagination
  let taskSearch = $state('');
  let taskPage = $state(0);
  const TASKS_PER_PAGE = 10;

  let filteredStatuses = $derived.by(() => {
    if (!taskSearch) return statuses;
    const q = taskSearch.toLowerCase();
    return statuses.filter(
      (s) => s.config.name.toLowerCase().includes(q) || s.config.command.toLowerCase().includes(q),
    );
  });

  let taskTotalPages = $derived(Math.max(1, Math.ceil(filteredStatuses.length / TASKS_PER_PAGE)));
  let pagedStatuses = $derived(filteredStatuses.slice(taskPage * TASKS_PER_PAGE, (taskPage + 1) * TASKS_PER_PAGE));

  // Reset task page on filter change
  $effect(() => {
    taskSearch;
    taskPage = 0;
  });

  // Form presets
  const TIMEOUT_PRESETS = [
    { label: '10s', value: 10 },
    { label: '30s', value: 30 },
    { label: '1m', value: 60 },
    { label: '5m', value: 300 },
    { label: '15m', value: 900 },
    { label: '1h', value: 3600 },
  ];

  const SCHEDULE_PRESETS = [
    { label: 'Every 5 min', value: '*/5 * * * *' },
    { label: 'Every 30 min', value: '*/30 * * * *' },
    { label: 'Hourly', value: '0 * * * *' },
    { label: 'Every 6h', value: '0 */6 * * *' },
    { label: 'Daily 2am', value: '0 2 * * *' },
    { label: 'Weekly Sun', value: '0 3 * * 0' },
  ];

  // Command validator
  let commandWarnings = $derived.by(() => {
    const w: string[] = [];
    if (!formCommand) return w;
    if (formCommand.includes('rm -rf /') || formCommand.includes('rm -rf ~'))
      w.push('Dangerous: recursive delete of root or home');
    if (formCommand.includes('sudo') && formTimeout < 30)
      w.push('sudo commands may need longer timeout for password prompt');
    if (formCommand.includes('|') && formCommand.split('|').length > 4)
      w.push('Many pipes — consider simplifying or using a script file');
    if (formCommand.length > 500) w.push('Very long command — consider putting this in a shell script');
    if (formCommand.includes('> /dev/') && !formCommand.includes('/dev/null'))
      w.push('Writing to device files — make sure this is intentional');
    return w;
  });

  async function refresh() {
    try {
      const res = await fetch('/api/tasks');
      if (!res.ok) throw new Error('Failed to fetch tasks');
      const result = await res.json();
      statuses = result.statuses;
      disk = result.disk;
    } catch (e: any) {
      toast.error(e.message || 'Failed to refresh tasks', { key: 'task-refresh' });
    }
  }

  async function createTask() {
    try {
      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formName,
          command: formCommand,
          timeout: formTimeout,
          maxRetries: formRetries,
          schedule: formSchedule || null,
        }),
      });
      if (!res.ok) throw new Error('Failed to create task');
      toast.success(`Task "${formName}" created`);
      showForm = false;
      formName = '';
      formCommand = '';
      formTimeout = 300;
      formRetries = 3;
      formSchedule = '';
      await refresh();
    } catch (e: any) {
      toast.error(e.message || 'Failed to create task');
    }
  }

  async function runTask(taskId: string) {
    expandedTask = taskId;
    const taskName = statuses.find((s) => s.config.id === taskId)?.config.name || taskId;
    toast.info(`Running "${taskName}"...`, { key: `task-run-${taskId}` });
    try {
      const res = await fetch('/api/tasks', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskId }),
      });
      if (!res.ok) throw new Error(`Failed to run "${taskName}"`);
      const poll = setInterval(async () => {
        await refresh();
        const s = statuses.find((s) => s.config.id === taskId);
        if (!s?.isRunning) {
          clearInterval(poll);
          if (s?.lastRun?.status === 'success') toast.success(`"${taskName}" completed`);
          else if (s?.lastRun?.status) toast.error(`"${taskName}" ${s.lastRun.status}`, { key: 'task-run' });
        }
      }, 1000);
    } catch (e: any) {
      toast.error(e.message || 'Failed to run task', { key: 'task-run' });
    }
  }

  let copied = $state<string | null>(null);
  async function copyOutput(taskId: string, text: string) {
    await navigator.clipboard.writeText(text);
    copied = taskId;
    setTimeout(() => {
      copied = null;
    }, 2000);
  }

  async function deleteTask(id: string) {
    try {
      await fetch('/api/tasks', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      toast.success('Task deleted');
      await refresh();
    } catch {
      toast.error('Failed to delete task');
    }
  }

  function formatDuration(ms: number): string {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${Math.floor(ms / 60000)}m ${Math.round((ms % 60000) / 1000)}s`;
  }

  function statusColor(status: string): string {
    if (status === 'success') return 'var(--success)';
    if (status === 'failed' || status === 'timeout') return 'var(--danger)';
    return 'var(--warning)';
  }
</script>

<svelte:head>
  <title>Tasks | Home Server</title>
</svelte:head>

<div class="header">
  <h2>Operator Tasks</h2>
  <div class="controls">
    <button class="btn" onclick={refresh}>&#x21bb; Refresh</button>
    <button
      class="btn"
      onclick={() => {
        showTemplates = !showTemplates;
        if (showTemplates) showForm = false;
      }}
    >
      &#x2630; Templates
    </button>
    <button
      class="btn"
      onclick={() => {
        showForm = !showForm;
        if (showForm) {
          showTemplates = false;
          editingTemplateIdx = null;
        }
      }}
    >
      {showForm ? 'Cancel' : '\uFF0B New Task'}
    </button>
  </div>
</div>

<!-- Disk usage -->
{#if disk.length > 0}
  <div class="disk-section">
    <h3>Disk Usage</h3>
    <div class="disk-grid">
      {#each disk as d}
        <div class="disk-item">
          <span class="disk-mount">{d.mount}</span>
          <div class="disk-bar">
            <div
              class="disk-fill"
              style="width: {d.usePercent}; background: {parseInt(d.usePercent) > 90
                ? 'var(--danger)'
                : parseInt(d.usePercent) > 70
                  ? 'var(--warning)'
                  : 'var(--success)'}"
            ></div>
          </div>
          <span class="disk-info">
            {d.used} / {d.total} ({d.usePercent})
            {#if d.fstype}<span class="disk-fstype">{d.fstype}</span>{/if}
            {#if d.device}<span class="disk-device" title={d.device}>{d.device.split('/').pop()}</span>{/if}
          </span>
        </div>
      {/each}
    </div>
  </div>
{/if}

<!-- Template panel with slide transition -->
<div class="template-section-wrapper" class:template-section-open={showTemplates}>
  {#if showTemplates}
    <div class="template-section">
      <div class="template-filters">
        <input type="text" class="template-search" placeholder="Search templates..." bind:value={templateSearch} />
        <div class="tag-bar">
          <button class="tag-btn" class:active={templateTag === ''} onclick={() => (templateTag = '')}
            >All ({allTemplates.length})</button
          >
          {#each allTags as tag}
            <button
              class="tag-btn"
              class:active={templateTag === tag}
              onclick={() => (templateTag = templateTag === tag ? '' : tag)}>{tag}</button
            >
          {/each}
        </div>
      </div>
      <div class="template-grid">
        {#each pagedTemplates as t}
          {@const isCustom = t.tags.includes('custom')}
          {@const customIdx = isCustom
            ? customTemplates.findIndex((c) => c.name === t.name && c.command === t.command)
            : -1}
          <div class="template-card" class:template-card-custom={isCustom}>
            {#if isCustom}
              <div class="template-custom-actions">
                <button
                  class="template-edit-btn"
                  title="Edit custom template"
                  onclick={(e) => {
                    e.stopPropagation();
                    if (customIdx >= 0) editCustomTemplate(customIdx);
                  }}>&#x270E;</button
                >
                <button
                  class="template-delete-btn"
                  title="Delete custom template"
                  onclick={(e) => {
                    e.stopPropagation();
                    if (customIdx >= 0) deleteCustomTemplate(customIdx);
                  }}>&#x2715;</button
                >
              </div>
            {/if}
            <button class="template-body" onclick={() => applyTemplate(t)}>
              <strong>{t.name}</strong>
              <span class="template-desc">{t.desc}</span>
              <code class="template-cmd">{t.command.slice(0, 70)}{t.command.length > 70 ? '...' : ''}</code>
              <div class="template-footer">
                <div class="template-tags">
                  {#each t.tags as tag}
                    <span class="template-tag" class:template-tag-custom={tag === 'custom'}>{tag}</span>
                  {/each}
                </div>
                {#if t.schedule}<span class="template-schedule">{t.schedule}</span>{/if}
              </div>
            </button>
            <button class="template-run-btn" onclick={() => runTemplate(t)} title="Create and run immediately"
              >▶ Run</button
            >
          </div>
        {/each}
      </div>
      {#if filteredTemplates.length === 0}
        <p class="template-empty">No templates match your search.</p>
      {/if}
      {#if templateTotalPages > 1}
        <div class="template-pagination">
          <button class="tool-btn" disabled={templatePage === 0} onclick={() => templatePage--}>‹ Prev</button>
          <span class="page-info">{templatePage + 1} / {templateTotalPages}</span>
          <button class="tool-btn" disabled={templatePage >= templateTotalPages - 1} onclick={() => templatePage++}
            >Next ›</button
          >
        </div>
      {/if}
    </div>
  {/if}
</div>

<!-- Template Runner Terminal -->
{#if terminalVisible}
  <div class="terminal-section">
    <div class="terminal-header">
      <span class="terminal-title">
        {terminalRunning ? '◌' : '●'}
        {terminalTaskName}
        {#if terminalRunning}<span class="terminal-spinner"></span>{/if}
      </span>
      <button class="terminal-close" onclick={closeTerminal} title="Close terminal">&#x2715;</button>
    </div>
    <pre class="terminal-output" bind:this={terminalEl}>{terminalOutput || 'Waiting for output...'}</pre>
  </div>
{/if}

{#if showForm}
  <div class="form-card">
    <h3>{editingTemplateIdx !== null ? 'Edit Template' : 'New Task'}</h3>
    <div class="form-grid">
      <div class="form-section">
        <span class="form-section-label">Basics</span>
        <label>
          <span>Task Name</span>
          <input type="text" bind:value={formName} placeholder="e.g., Disk space check" />
        </label>

        <label>
          <span>Shell Command</span>
          <textarea class="command-input" bind:value={formCommand} rows="3" placeholder="e.g., df -h / | grep dev"
          ></textarea>
        </label>

        {#if commandWarnings.length > 0}
          <div class="command-warnings">
            {#each commandWarnings as w}
              <div class="warning-item">&#x26A0; {w}</div>
            {/each}
          </div>
        {/if}
      </div>

      <div class="form-section">
        <span class="form-section-label">Schedule</span>
        <div class="preset-row">
          {#each SCHEDULE_PRESETS as p}
            <button
              class="preset-btn"
              class:active={formSchedule === p.value}
              onclick={() => (formSchedule = formSchedule === p.value ? '' : p.value)}>{p.label}</button
            >
          {/each}
        </div>
        <input type="text" bind:value={formSchedule} placeholder="Custom cron expression (leave empty for manual)" />
      </div>

      <div class="form-section form-advanced-toggle">
        <button class="btn btn-sm" onclick={() => (showAdvanced = !showAdvanced)}>
          {showAdvanced ? '&#x25B2; Hide' : '&#x25BC; Show'} Advanced
        </button>
      </div>

      {#if showAdvanced}
        <div class="form-section form-advanced">
          <span class="form-section-label">Timeout</span>
          <div class="preset-row">
            {#each TIMEOUT_PRESETS as p}
              <button class="preset-btn" class:active={formTimeout === p.value} onclick={() => (formTimeout = p.value)}
                >{p.label}</button
              >
            {/each}
          </div>
          <div class="form-row">
            <label><span>Custom (seconds)</span><input type="number" bind:value={formTimeout} min="5" /></label>
            <label><span>Max Retries</span><input type="number" bind:value={formRetries} min="0" max="10" /></label>
          </div>
        </div>
      {/if}
    </div>
    <div class="form-actions">
      {#if editingTemplateIdx !== null}
        <button class="btn btn-primary" onclick={saveEditedTemplate} disabled={!formName || !formCommand}
          >&#x1F4BE; Save Template</button
        >
        <button
          class="btn"
          onclick={() => {
            editingTemplateIdx = null;
            showForm = false;
            formName = '';
            formCommand = '';
            formTimeout = 300;
            formRetries = 3;
            formSchedule = '';
          }}>Cancel</button
        >
      {:else}
        <button class="btn btn-primary" onclick={createTask} disabled={!formName || !formCommand}
          >{'\uFF0B'} Create Task</button
        >
        {#if formName || formCommand}<button
            class="btn"
            onclick={() => {
              formName = '';
              formCommand = '';
              formTimeout = 300;
              formRetries = 3;
              formSchedule = '';
            }}>Clear</button
          >{/if}
      {/if}
    </div>
  </div>
{/if}

{#if statuses.length === 0 && !showForm}
  <EmptyState
    icon="⚙"
    title="No tasks configured"
    hint="Create shell command tasks to run on-demand or on a schedule"
    actionLabel="Browse Templates"
    onaction={() => (showTemplates = true)}
  />
{:else}
  {#if statuses.length > 3}
    <div class="task-search-bar">
      <input type="text" class="task-search" placeholder="Search tasks..." bind:value={taskSearch} />
      <span class="task-count">{filteredStatuses.length} of {statuses.length} tasks</span>
    </div>
  {/if}
  <div class="task-list">
    {#each pagedStatuses as status, i}
      <div class="task-card" class:task-running={status.isRunning} style="animation-delay: {i * 40}ms">
        <div class="task-top">
          <div class="task-info">
            <div class="task-title-row">
              {#if status.isRunning}
                <span class="task-status-icon icon-running">&#x25CC;</span>
              {:else if status.lastRun?.status === 'success'}
                <span class="task-status-icon icon-success">&#x2713;</span>
              {:else if status.lastRun?.status === 'failed' || status.lastRun?.status === 'timeout'}
                <span class="task-status-icon icon-failed">&#x2717;</span>
              {:else if status.config.schedule}
                <span class="task-status-icon icon-scheduled">&#x25F7;</span>
              {:else}
                <span class="task-status-icon icon-idle">&#x25CB;</span>
              {/if}
              <h3>{status.config.name}</h3>
              {#if status.isRunning}
                <span class="status-badge badge-running">running</span>
              {:else if status.lastRun?.status === 'success'}
                <span class="status-badge badge-success">success</span>
              {:else if status.lastRun?.status === 'failed' || status.lastRun?.status === 'timeout'}
                <span class="status-badge badge-failed">{status.lastRun.status}</span>
              {:else if status.config.schedule}
                <span class="status-badge badge-scheduled">scheduled</span>
              {:else}
                <span class="status-badge badge-idle">idle</span>
              {/if}
            </div>
            <code class="task-command">{status.config.command}</code>
            <div class="task-meta">
              timeout: {status.config.timeout}s · retries: {status.config.maxRetries}
              {#if status.config.schedule}
                · <span class="task-schedule">cron: {status.config.schedule}</span>
              {/if}
              {#if status.lastRun}
                · <span class="task-timestamp">{new Date(status.lastRun.startedAt).toLocaleString()}</span>
              {/if}
            </div>
          </div>
          <div class="task-actions">
            <button
              class="btn btn-sm btn-run"
              onclick={() => runTask(status.config.id)}
              disabled={status.isRunning}
              title="Run task"
            >
              {status.isRunning ? '&#x23F3;' : '&#x25B6;'} Run
            </button>
            <button
              class="btn btn-sm"
              onclick={() => (expandedTask = expandedTask === status.config.id ? null : status.config.id)}
            >
              {expandedTask === status.config.id ? '&#x25B2;' : '&#x25BC;'}
            </button>
            <button class="btn btn-sm" onclick={() => saveAsTemplate(status)} title="Save as template"
              >&#x1F4BE; Save</button
            >
            <button class="btn btn-sm btn-danger" onclick={() => deleteTask(status.config.id)} title="Delete task"
              >&#x2715;</button
            >
          </div>
        </div>

        {#if status.lastRun}
          <div class="last-run">
            <span class="run-dot" style="color: {statusColor(status.lastRun.status)}">●</span>
            <span class="run-status" style="color: {statusColor(status.lastRun.status)}">{status.lastRun.status}</span>
            {#if status.lastRun.duration}
              <span class="run-duration">{formatDuration(status.lastRun.duration)}</span>
            {/if}
            <span class="run-attempt">attempt {status.lastRun.attempt}</span>
            <button
              class="last-output-btn"
              onclick={() => (expandedTask = expandedTask === status.config.id ? null : status.config.id)}
              title="Toggle output"
            >
              📋 {expandedTask === status.config.id ? 'Hide output' : 'Last output'}
            </button>
          </div>
        {:else if status.config.schedule}
          <div class="last-run last-run-pending">
            <span class="run-pending">📋 Output shown after first scheduled run</span>
          </div>
        {/if}

        {#if expandedTask === status.config.id && status.lastRun}
          <div class="task-output">
            <div class="output-header">
              <span class="output-label">
                {status.isRunning ? 'Running...' : 'Output'}
                {#if status.isRunning}<span class="output-spinner"></span>{/if}
              </span>
              {#if status.lastRun.output}
                <button class="copy-btn" onclick={() => copyOutput(status.config.id, status.lastRun?.output || '')}>
                  {copied === status.config.id ? 'Copied!' : 'Copy'}
                </button>
              {/if}
            </div>
            <pre>{status.lastRun.output || '(no output)'}</pre>
          </div>
        {/if}
      </div>
    {/each}
  </div>
  {#if taskTotalPages > 1}
    <div class="template-pagination">
      <button class="tool-btn" disabled={taskPage === 0} onclick={() => taskPage--}>&#x2039; Prev</button>
      <span class="page-info">Page {taskPage + 1} of {taskTotalPages}</span>
      <button class="tool-btn" disabled={taskPage >= taskTotalPages - 1} onclick={() => taskPage++}
        >Next &#x203A;</button
      >
    </div>
  {/if}
{/if}

<style>
  .header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 16px;
  }
  h2 {
    font-size: 1.3rem;
  }
  .controls {
    display: flex;
    gap: 8px;
  }
  .btn {
    padding: 6px 14px;
    font-size: 0.8rem;
    border-radius: 6px;
    border: 1px solid var(--border);
    background: var(--btn-bg);
    color: var(--text-secondary);
    cursor: pointer;
    font-family: inherit;
  }
  .btn:hover:not(:disabled) {
    border-color: var(--accent);
  }
  .btn:disabled {
    opacity: 0.5;
    cursor: default;
  }
  .btn-sm {
    padding: 4px 10px;
    font-size: 0.75rem;
  }
  .btn-primary {
    background: var(--success);
    border-color: var(--success);
    color: #fff;
  }
  .btn-primary:hover:not(:disabled) {
    filter: brightness(1.15);
  }
  .btn-danger:hover {
    border-color: var(--danger);
    color: var(--danger);
  }

  /* Form improvements */
  .command-input {
    font-family: 'JetBrains Mono', monospace;
    font-size: 0.8rem;
    resize: vertical;
    min-height: 60px;
  }
  .command-warnings {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .warning-item {
    font-size: 0.75rem;
    color: var(--warning);
    padding: 4px 8px;
    background: var(--warning-bg);
    border-radius: 4px;
  }

  .form-section {
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding-top: 8px;
    border-top: 1px solid var(--border-subtle);
  }
  .form-section-label {
    font-size: 0.75rem;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.03em;
  }
  .preset-row {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
  }
  .preset-btn {
    padding: 3px 10px;
    font-size: 0.7rem;
    border-radius: 12px;
    border: 1px solid var(--border);
    background: var(--btn-bg);
    color: var(--text-muted);
    cursor: pointer;
    font-family: inherit;
    transition: all 0.15s;
  }
  .preset-btn:hover {
    border-color: var(--accent);
    color: var(--text-primary);
  }
  .preset-btn.active {
    background: var(--accent-bg);
    border-color: var(--accent);
    color: var(--accent);
  }
  .form-actions {
    display: flex;
    gap: 8px;
    margin-top: 12px;
  }

  /* Task search bar */
  .task-search-bar {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 12px;
  }
  .task-search {
    flex: 1;
    padding: 7px 12px;
    font-size: 0.8rem;
    border-radius: 6px;
    border: 1px solid var(--border);
    background: var(--input-bg);
    color: var(--text-primary);
    font-family: inherit;
  }
  .task-search:focus {
    outline: none;
    border-color: var(--accent);
  }
  .task-count {
    font-size: 0.75rem;
    color: var(--text-muted);
    white-space: nowrap;
  }

  .disk-section {
    margin-bottom: 20px;
    padding: 14px;
    background: var(--bg-secondary);
    border: 1px solid var(--border);
    border-radius: 8px;
  }
  .disk-section h3 {
    font-size: 0.85rem;
    color: var(--text-muted);
    margin-bottom: 10px;
    text-transform: uppercase;
    letter-spacing: 0.03em;
  }
  .disk-grid {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .disk-item {
    display: flex;
    align-items: center;
    gap: 10px;
    font-size: 0.8rem;
  }
  .disk-mount {
    width: 120px;
    font-family: monospace;
    font-size: 0.75rem;
    color: var(--text-secondary);
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .disk-bar {
    flex: 1;
    height: 8px;
    background: var(--btn-bg);
    border-radius: 4px;
    overflow: hidden;
  }
  .disk-fill {
    height: 100%;
    border-radius: 4px;
    transition: width 0.3s;
  }
  .disk-info {
    font-size: 0.7rem;
    color: var(--text-muted);
    width: 200px;
    text-align: right;
    display: flex;
    align-items: center;
    gap: 6px;
    justify-content: flex-end;
    flex-wrap: wrap;
  }
  .disk-fstype {
    font-size: 0.6rem;
    color: var(--text-faint);
    background: var(--bg-inset);
    padding: 1px 4px;
    border-radius: 3px;
    font-family: monospace;
  }
  .disk-device {
    font-size: 0.6rem;
    color: var(--text-faint);
    font-family: monospace;
    max-width: 80px;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .form-card {
    background: var(--bg-secondary);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 20px;
    margin-bottom: 16px;
  }
  .form-card h3 {
    font-size: 1rem;
    margin-bottom: 14px;
  }
  .form-grid {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .form-grid label {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .form-grid label span {
    font-size: 0.75rem;
    color: var(--text-muted);
    text-transform: uppercase;
  }
  .form-grid input {
    padding: 8px 12px;
    font-size: 0.85rem;
    border-radius: 6px;
    border: 1px solid var(--border);
    background: var(--input-bg);
    color: var(--text-primary);
    font-family: inherit;
  }
  .form-grid input:focus {
    outline: none;
    border-color: var(--accent);
  }
  .form-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
  }

  .empty {
    color: var(--text-muted);
    text-align: center;
    padding: 40px;
  }
  .task-list {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .task-card {
    background: var(--bg-secondary);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 14px 16px;
    transition: border-color 0.15s;
  }
  .task-card.task-running {
    border-color: var(--warning);
  }
  .task-top {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
  }
  .task-title-row {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 4px;
  }
  .task-info h3 {
    font-size: 0.95rem;
  }
  .task-command {
    font-size: 0.75rem;
    color: var(--text-muted);
    display: block;
    margin-bottom: 4px;
  }
  .task-meta {
    font-size: 0.7rem;
    color: var(--text-faint);
  }
  .task-schedule {
    color: var(--accent);
  }
  .task-timestamp {
    color: var(--text-faint);
  }

  .status-badge {
    font-size: 0.6rem;
    padding: 2px 8px;
    border-radius: 10px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.03em;
  }
  .badge-running {
    background: var(--warning-bg);
    color: var(--warning);
    animation: pulse 1s ease-in-out infinite alternate;
  }
  .badge-success {
    background: var(--success-bg);
    color: var(--success);
  }
  .badge-failed {
    background: var(--danger-bg);
    color: var(--danger);
  }
  .badge-scheduled {
    background: var(--accent-bg);
    color: var(--accent);
  }
  .badge-idle {
    background: var(--bg-hover);
    color: var(--text-faint);
  }
  @keyframes pulse {
    from {
      opacity: 0.7;
    }
    to {
      opacity: 1;
    }
  }

  .btn-run {
    font-size: 0.75rem;
  }
  .btn-run:not(:disabled):hover {
    border-color: var(--success);
    color: var(--success);
  }

  /* Template card with run button */
  .template-body {
    text-align: left;
    cursor: pointer;
    display: flex;
    flex-direction: column;
    gap: 4px;
    font-family: inherit;
    color: var(--text-primary);
    background: none;
    border: none;
    padding: 0;
    width: 100%;
  }
  .template-run-btn {
    margin-top: 6px;
    padding: 4px 10px;
    font-size: 0.7rem;
    border-radius: 6px;
    border: 1px solid var(--border);
    background: var(--btn-bg);
    color: var(--success);
    cursor: pointer;
    font-family: inherit;
    align-self: flex-start;
    transition: all 0.15s;
  }
  .template-run-btn:hover {
    background: var(--success-bg);
    border-color: var(--success);
  }

  .template-section {
    margin-bottom: 16px;
  }
  .template-filters {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin-bottom: 12px;
  }
  .template-search {
    padding: 7px 12px;
    font-size: 0.8rem;
    border-radius: 6px;
    border: 1px solid var(--border);
    background: var(--input-bg);
    color: var(--text-primary);
    font-family: inherit;
  }
  .template-search:focus {
    outline: none;
    border-color: var(--accent);
  }

  .tag-bar {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
  }
  .tag-btn {
    padding: 3px 10px;
    font-size: 0.7rem;
    border-radius: 12px;
    border: 1px solid var(--border);
    background: var(--btn-bg);
    color: var(--text-muted);
    cursor: pointer;
    font-family: inherit;
    transition: all 0.15s;
  }
  .tag-btn:hover {
    border-color: var(--accent);
    color: var(--text-primary);
  }
  .tag-btn.active {
    background: var(--accent-bg);
    border-color: var(--accent);
    color: var(--accent);
  }

  .template-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: 10px;
  }
  .template-card {
    background: var(--bg-secondary);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 12px 14px;
    display: flex;
    flex-direction: column;
    transition: border-color 0.15s;
  }
  .template-card:hover {
    border-color: var(--accent);
  }
  .template-card strong {
    font-size: 0.85rem;
  }
  .template-desc {
    font-size: 0.75rem;
    color: var(--text-muted);
    line-height: 1.4;
  }
  .template-cmd {
    font-size: 0.65rem;
    color: var(--text-faint);
    display: block;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    background: var(--code-bg);
    padding: 4px 6px;
    border-radius: 3px;
    margin-top: 2px;
  }
  .template-footer {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-top: 4px;
  }
  .template-tags {
    display: flex;
    gap: 4px;
    flex-wrap: wrap;
  }
  .template-tag {
    font-size: 0.6rem;
    padding: 1px 6px;
    border-radius: 8px;
    background: var(--bg-hover);
    color: var(--text-muted);
  }
  .template-schedule {
    font-size: 0.6rem;
    color: var(--accent);
    font-family: 'JetBrains Mono', monospace;
  }
  .template-empty {
    text-align: center;
    color: var(--text-muted);
    padding: 20px;
    font-size: 0.85rem;
  }

  .template-pagination {
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 12px;
    margin-top: 12px;
  }
  .tool-btn {
    padding: 4px 12px;
    font-size: 0.75rem;
    border-radius: 6px;
    border: 1px solid var(--border);
    background: var(--btn-bg);
    color: var(--text-muted);
    cursor: pointer;
    font-family: inherit;
  }
  .tool-btn:hover:not(:disabled) {
    border-color: var(--accent);
  }
  .tool-btn:disabled {
    opacity: 0.4;
    cursor: default;
  }
  .page-info {
    font-size: 0.7rem;
    color: var(--text-faint);
  }
  .task-actions {
    display: flex;
    gap: 6px;
  }

  .last-run {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-top: 10px;
    padding-top: 8px;
    border-top: 1px solid var(--border-subtle);
  }
  .run-dot {
    font-size: 0.6rem;
  }
  .run-status {
    font-size: 0.8rem;
  }
  .run-duration {
    font-size: 0.75rem;
    color: var(--text-muted);
  }
  .run-attempt {
    font-size: 0.7rem;
    color: var(--text-faint);
  }

  .task-output {
    margin-top: 8px;
  }
  .output-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 4px;
  }
  .output-label {
    font-size: 0.7rem;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.03em;
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .output-spinner {
    display: inline-block;
    width: 8px;
    height: 8px;
    border: 2px solid var(--border);
    border-top-color: var(--accent);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }
  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
  .copy-btn {
    padding: 2px 8px;
    font-size: 0.65rem;
    border-radius: 4px;
    border: 1px solid var(--border);
    background: var(--btn-bg);
    color: var(--text-muted);
    cursor: pointer;
    font-family: inherit;
  }
  .copy-btn:hover {
    border-color: var(--accent);
    color: var(--text-primary);
  }
  .task-output pre {
    background: var(--code-bg);
    padding: 10px;
    border-radius: 6px;
    font-size: 0.7rem;
    max-height: 300px;
    overflow: auto;
    color: var(--text-muted);
    white-space: pre-wrap;
    word-break: break-all;
  }

  /* Last output button inside last-run row */
  .last-output-btn {
    margin-left: auto;
    padding: 2px 8px;
    font-size: 0.65rem;
    border-radius: 4px;
    border: 1px solid var(--border);
    background: var(--btn-bg);
    color: var(--text-muted);
    cursor: pointer;
    font-family: inherit;
    white-space: nowrap;
    transition: all 0.15s;
  }
  .last-output-btn:hover {
    border-color: var(--accent);
    color: var(--accent);
  }
  .last-run-pending {
    border-top: 1px solid var(--border-subtle);
  }
  .run-pending {
    font-size: 0.7rem;
    color: var(--text-faint);
    font-style: italic;
  }

  /* Custom template card — delete button overlay */
  .template-card-custom {
    position: relative;
  }
  .template-delete-btn {
    position: absolute;
    top: 6px;
    right: 6px;
    width: 20px;
    height: 20px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.6rem;
    border-radius: 50%;
    border: 1px solid var(--border);
    background: var(--btn-bg);
    color: var(--text-faint);
    cursor: pointer;
    font-family: inherit;
    padding: 0;
    transition: all 0.15s;
    z-index: 1;
  }
  .template-delete-btn:hover {
    background: var(--danger-bg);
    border-color: var(--danger);
    color: var(--danger);
  }
  .template-tag-custom {
    background: var(--accent-bg);
    color: var(--accent);
  }

  /* Template section slide transition */
  .template-section-wrapper {
    overflow: hidden;
    max-height: 0;
    opacity: 0;
    transition:
      max-height 0.35s ease-out,
      opacity 0.25s ease-out;
  }
  .template-section-wrapper.template-section-open {
    max-height: 2000px;
    opacity: 1;
    transition:
      max-height 0.45s ease-in,
      opacity 0.3s ease-in;
  }

  /* Custom template edit button */
  .template-custom-actions {
    position: absolute;
    top: 6px;
    right: 6px;
    display: flex;
    gap: 4px;
    z-index: 1;
  }
  .template-edit-btn {
    width: 20px;
    height: 20px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.6rem;
    border-radius: 50%;
    border: 1px solid var(--border);
    background: var(--btn-bg);
    color: var(--text-faint);
    cursor: pointer;
    font-family: inherit;
    padding: 0;
    transition: all 0.15s;
  }
  .template-edit-btn:hover {
    background: var(--accent-bg);
    border-color: var(--accent);
    color: var(--accent);
  }
  /* Reposition delete button when inside actions container */
  .template-custom-actions .template-delete-btn {
    position: static;
  }

  /* Template Runner Terminal */
  .terminal-section {
    margin-bottom: 16px;
    border: 1px solid var(--border);
    border-radius: 8px;
    overflow: hidden;
    animation: slideDown 0.25s ease-out;
  }
  .terminal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 8px 14px;
    background: #1a1a2e;
    border-bottom: 1px solid #2a2a3e;
  }
  .terminal-title {
    font-size: 0.8rem;
    color: #a0e0a0;
    font-family: 'JetBrains Mono', monospace;
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .terminal-spinner {
    display: inline-block;
    width: 8px;
    height: 8px;
    border: 2px solid #444;
    border-top-color: #a0e0a0;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }
  .terminal-close {
    width: 22px;
    height: 22px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.7rem;
    border-radius: 4px;
    border: 1px solid #333;
    background: transparent;
    color: #888;
    cursor: pointer;
    font-family: inherit;
    padding: 0;
    transition: all 0.15s;
  }
  .terminal-close:hover {
    background: #333;
    color: #e88;
    border-color: #e88;
  }
  .terminal-output {
    background: #0d0d1a;
    color: #c8c8d8;
    font-family: 'JetBrains Mono', monospace;
    font-size: 0.75rem;
    padding: 12px 14px;
    margin: 0;
    max-height: 300px;
    overflow: auto;
    white-space: pre-wrap;
    word-break: break-all;
    line-height: 1.5;
  }

  /* Task card status icons */
  .task-status-icon {
    font-size: 0.9rem;
    line-height: 1;
  }
  .icon-running {
    color: var(--warning);
    animation: spinIcon 1.2s linear infinite;
  }
  .icon-success {
    color: var(--success);
  }
  .icon-failed {
    color: var(--danger);
  }
  .icon-scheduled {
    color: var(--accent);
  }
  .icon-idle {
    color: var(--text-faint);
  }
  @keyframes spinIcon {
    from {
      transform: rotate(0deg);
    }
    to {
      transform: rotate(360deg);
    }
  }

  /* Task card enter animation */
  .task-card {
    animation: cardEnter 0.3s ease-out both;
  }
  @keyframes cardEnter {
    from {
      opacity: 0;
      transform: translateY(8px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  /* Slide down animation for panels */
  @keyframes slideDown {
    from {
      opacity: 0;
      transform: translateY(-8px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  /* Form advanced toggle */
  .form-advanced-toggle {
    border-top: none;
    padding-top: 4px;
  }
  .form-advanced {
    animation: slideDown 0.2s ease-out;
  }
</style>

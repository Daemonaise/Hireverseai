/**
 * Client-side activity collector — captures raw interaction signals
 * for authenticity analysis. Lightweight, runs in the background.
 */

export interface ActivitySignals {
  // Mouse
  mouseMovements: number;
  mousePathLength: number;       // Total pixels traveled
  mouseDirectionChanges: number; // Sharp direction changes (real humans overshoot)
  mouseSpeedVariance: number;    // Low variance = jiggler
  mousePositions: Array<{ x: number; y: number; t: number }>; // Last 20 positions for pattern analysis

  // Clicks
  clicks: number;
  clicksOnElements: number;      // Clicks that hit actual interactive elements
  clickPositionVariance: number;

  // Keyboard
  keystrokes: number;
  keystrokeTimingVariance: number; // Low variance = auto-typer
  keystrokesInFields: number;      // Typing in actual input fields

  // Scroll
  scrollEvents: number;
  scrollDirectionChanges: number;
  scrollSpeedVariance: number;

  // Navigation
  pageChanges: number;
  tabSwitches: number;            // visibilitychange events

  // Timing
  windowStart: number;           // When collection started
  windowEnd: number;             // When snapshot was taken
  totalInteractions: number;
}

function variance(values: number[]): number {
  if (values.length < 2) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  return values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length;
}

export class ActivityCollector {
  private signals: ActivitySignals;
  private lastMousePos: { x: number; y: number; t: number } | null = null;
  private mouseSpeeds: number[] = [];
  private mouseAngles: number[] = [];
  private clickPositions: Array<{ x: number; y: number }> = [];
  private keystrokeTimes: number[] = [];
  private scrollSpeeds: number[] = [];
  private listeners: Array<[string, EventListener]> = [];
  private collecting = false;

  constructor() {
    this.signals = this.freshSignals();
  }

  private freshSignals(): ActivitySignals {
    return {
      mouseMovements: 0,
      mousePathLength: 0,
      mouseDirectionChanges: 0,
      mouseSpeedVariance: 0,
      mousePositions: [],
      clicks: 0,
      clicksOnElements: 0,
      clickPositionVariance: 0,
      keystrokes: 0,
      keystrokeTimingVariance: 0,
      keystrokesInFields: 0,
      scrollEvents: 0,
      scrollDirectionChanges: 0,
      scrollSpeedVariance: 0,
      pageChanges: 0,
      tabSwitches: 0,
      windowStart: Date.now(),
      windowEnd: Date.now(),
      totalInteractions: 0,
    };
  }

  start(): void {
    if (this.collecting) return;
    this.collecting = true;
    this.signals = this.freshSignals();
    this.mouseSpeeds = [];
    this.mouseAngles = [];
    this.clickPositions = [];
    this.keystrokeTimes = [];
    this.scrollSpeeds = [];
    this.lastMousePos = null;

    const onMouseMove = (e: Event) => this.handleMouseMove(e as MouseEvent);
    const onClick = (e: Event) => this.handleClick(e as MouseEvent);
    const onKeyDown = (e: Event) => this.handleKeyDown(e as KeyboardEvent);
    const onScroll = () => this.handleScroll();
    const onVisChange = () => this.handleVisibilityChange();

    document.addEventListener('mousemove', onMouseMove, { passive: true });
    document.addEventListener('click', onClick, { passive: true });
    document.addEventListener('keydown', onKeyDown, { passive: true });
    document.addEventListener('scroll', onScroll, { passive: true });
    document.addEventListener('visibilitychange', onVisChange);

    this.listeners = [
      ['mousemove', onMouseMove],
      ['click', onClick],
      ['keydown', onKeyDown],
      ['scroll', onScroll],
      ['visibilitychange', onVisChange],
    ];
  }

  stop(): void {
    this.collecting = false;
    for (const [event, listener] of this.listeners) {
      document.removeEventListener(event, listener);
    }
    this.listeners = [];
  }

  snapshot(): ActivitySignals {
    const snap = { ...this.signals };
    snap.windowEnd = Date.now();
    snap.mouseSpeedVariance = variance(this.mouseSpeeds);
    snap.clickPositionVariance = this.computeClickVariance();
    snap.keystrokeTimingVariance = variance(this.keystrokeTimes);
    snap.scrollSpeedVariance = variance(this.scrollSpeeds);
    snap.totalInteractions =
      snap.mouseMovements + snap.clicks + snap.keystrokes + snap.scrollEvents;

    // Reset for next window
    this.signals = this.freshSignals();
    this.mouseSpeeds = [];
    this.mouseAngles = [];
    this.clickPositions = [];
    this.keystrokeTimes = [];
    this.scrollSpeeds = [];
    this.lastMousePos = null;

    return snap;
  }

  private handleMouseMove(e: MouseEvent): void {
    const now = Date.now();
    this.signals.mouseMovements++;

    const pos = { x: e.clientX, y: e.clientY, t: now };

    if (this.lastMousePos) {
      const dx = pos.x - this.lastMousePos.x;
      const dy = pos.y - this.lastMousePos.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const dt = now - this.lastMousePos.t;

      this.signals.mousePathLength += dist;

      if (dt > 0) {
        this.mouseSpeeds.push(dist / dt);
      }

      // Direction change detection
      const angle = Math.atan2(dy, dx);
      if (this.mouseAngles.length > 0) {
        const lastAngle = this.mouseAngles[this.mouseAngles.length - 1];
        const angleDiff = Math.abs(angle - lastAngle);
        if (angleDiff > Math.PI / 4) { // >45 degree change
          this.signals.mouseDirectionChanges++;
        }
      }
      this.mouseAngles.push(angle);
    }

    // Keep last 20 positions
    this.signals.mousePositions.push(pos);
    if (this.signals.mousePositions.length > 20) {
      this.signals.mousePositions.shift();
    }

    this.lastMousePos = pos;
  }

  private handleClick(e: MouseEvent): void {
    this.signals.clicks++;
    this.clickPositions.push({ x: e.clientX, y: e.clientY });

    // Check if click hit an interactive element
    const target = e.target as HTMLElement;
    const interactive = target.closest('a, button, input, textarea, select, [role="button"], [tabindex]');
    if (interactive) {
      this.signals.clicksOnElements++;
    }
  }

  private handleKeyDown(e: KeyboardEvent): void {
    this.signals.keystrokes++;
    this.keystrokeTimes.push(Date.now());

    // Check if typing in an input field
    const target = e.target as HTMLElement;
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
      this.signals.keystrokesInFields++;
    }
  }

  private lastScrollDir: 'up' | 'down' | null = null;
  private lastScrollTime = 0;

  private handleScroll(): void {
    const now = Date.now();
    this.signals.scrollEvents++;

    const dir = window.scrollY > (this.lastScrollTime || 0) ? 'down' : 'up';
    if (this.lastScrollDir && dir !== this.lastScrollDir) {
      this.signals.scrollDirectionChanges++;
    }
    this.lastScrollDir = dir;

    if (this.lastScrollTime > 0) {
      const dt = now - this.lastScrollTime;
      if (dt > 0) this.scrollSpeeds.push(1 / dt);
    }
    this.lastScrollTime = now;
  }

  private handleVisibilityChange(): void {
    if (document.hidden) {
      this.signals.tabSwitches++;
    }
  }

  private computeClickVariance(): number {
    if (this.clickPositions.length < 2) return 0;
    const xs = this.clickPositions.map((p) => p.x);
    const ys = this.clickPositions.map((p) => p.y);
    return (variance(xs) + variance(ys)) / 2;
  }
}

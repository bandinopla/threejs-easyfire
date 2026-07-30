import { TemperatureColor } from "src/EasyFire";
import { Color } from "three";

export interface StopsModalOptions {
	baseColor: Color;
	tiers: TemperatureColor[];
	min?: number;
	max?: number;
	onChange: (tiers: TemperatureColor[]) => void;
}

export function openStopsModal(opts: StopsModalOptions): void {
	const min = opts.min ?? 0;
	const max = opts.max ?? 1;
	const EPS = 0.001;

	// Flatten each tier's [from, to] into one sequential points array
	const points: number[] = [];
	opts.tiers.forEach((t) => points.push(t.transition.from, t.transition.to));

	let changeTimeout: ReturnType<typeof setTimeout> | undefined;
	function emitChange() {
		opts.tiers.forEach((tier, i) => {
			tier.transition.from = points[2 * i];
			tier.transition.to = points[2 * i + 1];
		});
		opts.onChange(opts.tiers);
	}
	function scheduleChange() {
		if (changeTimeout) clearTimeout(changeTimeout);
		changeTimeout = setTimeout(emitChange, 300);
	}

	const overlay = document.createElement("div");
	overlay.style.cssText =
		"position:fixed;inset:0;background:transparent;display:flex;align-items:flex-end;justify-content:center;z-index:9999;font-family:monospace;pointer-events:none;";

	const panel = document.createElement("div");
	panel.style.cssText =
		"background:#1e1e1e;padding:24px;border-radius:8px;width:400px;color:#eee;pointer-events:auto;";

	const bar = document.createElement("div");
	bar.style.cssText = "position:relative;height:40px;border-radius:4px;margin:28px 0;";

	const pct = (v: number) => ((v - min) / (max - min)) * 100;
	const hex = (c: Color) => "#" + c.getHexString();

	const handles = points.map((_, k) => {
		const handle = document.createElement("div");
		handle.style.cssText =
			"position:absolute;top:-8px;bottom:-8px;width:16px;margin-left:-8px;cursor:ew-resize;touch-action:none;";

		const line = document.createElement("div");
		line.style.cssText =
			"position:absolute;left:7px;top:8px;bottom:8px;width:2px;background:#fff;box-shadow:0 0 2px #000;";
		handle.appendChild(line);

		const label = document.createElement("div");
		const labelTop = k % 2 === 0 ? -34 : -20;
		label.style.cssText = `position:absolute;top:${labelTop}px;left:-16px;width:32px;text-align:center;font-size:11px;color:#fff;`;
		handle.appendChild(label);

		let dragging = false;

		handle.addEventListener("pointerdown", (e) => {
			dragging = true;
			handle.setPointerCapture(e.pointerId);
		});
		handle.addEventListener("pointermove", (e) => {
			if (!dragging) return;
			const rect = bar.getBoundingClientRect();
			let t = (e.clientX - rect.left) / rect.width;
			t = Math.min(Math.max(t, 0), 1);
			const v = min + t * (max - min);

			const lo = k > 0 ? points[k - 1] + EPS : min;
			const hi = k < points.length - 1 ? points[k + 1] - EPS : max;
			points[k] = Math.min(Math.max(v, lo), hi);
			update();
			scheduleChange();
		});
		handle.addEventListener("pointerup", (e) => {
			dragging = false;
			handle.releasePointerCapture(e.pointerId);
		});

		bar.appendChild(handle);
		return { handle, label };
	});

	function update() {
		handles.forEach(({ handle, label }, k) => {
			handle.style.left = pct(points[k]) + "%";
			label.textContent = points[k].toFixed(3);
		});

		const stops: string[] = [`${hex(opts.baseColor)} 0%`];
		let prevColor = opts.baseColor;
		opts.tiers.forEach((tier, i) => {
			const fromP = pct(points[2 * i]);
			const toP = pct(points[2 * i + 1]);
			stops.push(`${hex(prevColor)} ${fromP}%`);
			stops.push(`${hex(tier.color)} ${toP}%`);
			prevColor = tier.color;
		});
		stops.push(`${hex(prevColor)} 100%`);

		bar.style.backgroundImage = `linear-gradient(to right, ${stops.join(", ")})`;
	}

	const closeBtn = document.createElement("button");
	closeBtn.textContent = "Close";
	closeBtn.style.cssText =
		"width:100%;padding:8px;background:#4ade80;border:none;border-radius:4px;cursor:pointer;font-weight:bold;";
	closeBtn.onclick = () => {
		if (changeTimeout) {
			clearTimeout(changeTimeout);
			emitChange();
		}
		document.body.removeChild(overlay);
	};

	panel.appendChild(bar);
	panel.appendChild(closeBtn);
	overlay.appendChild(panel);
	document.body.appendChild(overlay);
	update();
}

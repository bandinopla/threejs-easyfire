import { DataTexture, EasyFireShaderContext } from "src/EasyFireShaderContext";
import { any, float, floor, If, max, min, select, vec3, vec4 } from "three/tsl";

/**
 * 1. The Predictor Pass
 */
const advectDyePredictorPass =
	(
		context: EasyFireShaderContext,
		textures: {
			velocity: DataTexture;
			dyeIn: DataTexture;
			dyeHatOut: DataTexture; // Intermediate output for raw advection
		},
	) =>
	() => {
		const coord = context.grid.dye.coord;
		const uvw = context.grid.dye.uvw;

		const vel = textures.velocity.sample(uvw).xyz;
		const velUVW = vel.div(context.uVolumeWorldSize);
		const prevPos = uvw.sub(velUVW.mul(context.uDt)).toVar();

		// check if the prev pos is inside a collider....
		const localPos = prevPos.sub(0.5).mul(context.uVolumeWorldSize);
		const worldPos = context.worldMatrix.mul(localPos).xyz;
		const prevDist = context.collisions.distanceAtPoint(prevPos).toVar();

		// If the source position came from inside an object, push it back to the surface
		If(prevDist.lessThan(0.0), () => {
			const normal = context.collisions.normalAtPoint(prevPos);
			worldPos.addAssign(normal.mul(prevDist.abs()));
			const correctedLocalPos = context.invWorldMatrix.mul(vec4(worldPos, 1.0)).xyz;
			prevPos.assign(correctedLocalPos.div(context.uVolumeWorldSize).add(0.5));
		});

		// Pure advection only. Do not apply cooling/dissipation here.
		const dyeRaw = textures.dyeIn.sample(prevPos);
		textures.dyeHatOut.write(coord, dyeRaw);
	};

/**
 * 2. The Corrector Pass
 */
const advectDyeCorrectorPass =
	(
		context: EasyFireShaderContext,
		textures: {
			velocity: DataTexture;
			dyeOld: DataTexture; // Original dye field from BEFORE predictor
			dyeHat: DataTexture; // Output from the predictor pass
			dyeOut: DataTexture; // Final corrected and dissipated output
		},
	) =>
	() => {
		const coord = context.grid.dye.coord;
		const uvw = context.grid.dye.uvw;
		const grid = context.grid.dye;

		const vel = textures.velocity.sample(uvw).xyz;
		const velUVW = vel.div(context.uVolumeWorldSize);

		// 1. Forward trace from current position
		const forwardPos = uvw.add(velUVW.mul(context.uDt)).toVar();

		const forwardLocalPos = forwardPos.sub(0.5).mul(context.uVolumeWorldSize);
		const forwardWorldPos = context.worldMatrix.mul(forwardLocalPos).xyz;
		const forwardDist = context.collisions.distanceAtPoint(forwardPos).toVar();

		If(forwardDist.lessThan(0.0), () => {
			const normal = context.collisions.normalAtPoint(forwardPos);
			forwardWorldPos.addAssign(normal.mul(forwardDist.abs()));
			const correctedLocalPos = context.invWorldMatrix.mul(vec4(forwardWorldPos, 1.0)).xyz;
			forwardPos.assign(correctedLocalPos.div(context.uVolumeWorldSize).add(0.5));
		});

		// 2. Error Calculation
		const dyeStar = textures.dyeHat.sample(forwardPos);
		const dyeHatCurrent = textures.dyeHat.sample(uvw);
		const dyeOldCurrent = textures.dyeOld.sample(uvw);

		// MacCormack: dye_final = dye_hat + 0.5 * (dye_old - dye_star)
		const dyeCorrected = dyeHatCurrent.add(dyeOldCurrent.sub(dyeStar).mul(0.5)).toVar();

		// 3. Backward trace exactly as before to find Min/Max clamping bounds
		const prevPos = uvw.sub(velUVW.mul(context.uDt)).toVar();
		const localPos = prevPos.sub(0.5).mul(context.uVolumeWorldSize);
		const worldPos = context.worldMatrix.mul(localPos).xyz;
		const prevDist = context.collisions.distanceAtPoint(prevPos).toVar();

		If(prevDist.lessThan(0.0), () => {
			const normal = context.collisions.normalAtPoint(prevPos);
			worldPos.addAssign(normal.mul(prevDist.abs()));
			const correctedLocalPos = context.invWorldMatrix.mul(vec4(worldPos, 1.0)).xyz;
			prevPos.assign(correctedLocalPos.div(context.uVolumeWorldSize).add(0.5));
		});

		// 4. Clamping (Limiter) - Use proper neighborhood sampling WITHOUT snapping
		const texel = context.grid.dye.texel;

		// Sample the 3x3x3 neighborhood around the actual prevPos (no snapping!)
		const c = textures.dyeOld.sample(prevPos);
		const l = textures.dyeOld.sample(prevPos.add(vec3(texel.x.negate(), 0, 0)));
		const r = textures.dyeOld.sample(prevPos.add(vec3(texel.x, 0, 0)));
		const d = textures.dyeOld.sample(prevPos.add(vec3(0, texel.y.negate(), 0)));
		const u = textures.dyeOld.sample(prevPos.add(vec3(0, texel.y, 0)));
		const b = textures.dyeOld.sample(prevPos.add(vec3(0, 0, texel.z.negate())));
		const f = textures.dyeOld.sample(prevPos.add(vec3(0, 0, texel.z)));

		const minDye = min(c, min(l, min(r, min(d, min(u, min(b, f))))));
		const maxDye = max(c, max(l, max(r, max(d, max(u, max(b, f))))));

		const densityCorrected = select(
			dyeCorrected.r.lessThan(minDye.r).or(dyeCorrected.r.greaterThan(maxDye.r)),
			max(minDye.r, min(maxDye.r, dyeCorrected.r)),
			dyeCorrected.r,
		).toVar();

		const temperatureCorrected = select(
			dyeCorrected.g.lessThan(minDye.g).or(dyeCorrected.g.greaterThan(maxDye.g)),
			max(minDye.g, min(maxDye.g, dyeCorrected.g)),
			dyeCorrected.g,
		).toVar();

		// 5. Apply Dissipation, Cooling, and Age Modifications
		const dissipationFactor = max(float(1).sub(context.uDissipation.mul(context.uDt)), 0);
		const coolingFactor = max(float(1).sub(context.uCooling.mul(context.uDt)), 0);

		const density = densityCorrected.mul(dissipationFactor).toVar();
		const temperature = temperatureCorrected.mul(coolingFactor).toVar();
		const colorMassCorrected = select(
			dyeCorrected.a.lessThan(minDye.a).or(dyeCorrected.a.greaterThan(maxDye.a)),
			max(minDye.a, min(maxDye.a, dyeCorrected.a)),
			dyeCorrected.a,
		);

		const colorMass = colorMassCorrected.mul(dissipationFactor);

		const gridDims = context.grid.dye.size;
		const nearestUVW = floor(prevPos.mul(gridDims)).add(0.5).div(gridDims);
		const age = textures.dyeOld.sample(nearestUVW).b.add(context.uDt).toVar();

		If(density.lessThanEqual(0.01), () => {
			age.assign(0.0);
		});

		textures.dyeOut.write(coord, vec4(density, temperature, age, colorMass));
	};

export const MacCormackAdvection = {
	predictor: advectDyePredictorPass,
	corrector: advectDyeCorrectorPass,
} as const;

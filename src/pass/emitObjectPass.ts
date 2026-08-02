import { DataTexture, EasyFireShaderContext } from "src/EasyFireShaderContext";
import { ComputeNodeHook } from "src/EmitterManager";
import {
	ceil,
	Continue,
	distance,
	dot,
	float,
	If,
	int,
	ivec3,
	length,
	Loop,
	max,
	mix,
	mx_noise_float,
	smoothstep,
	sqrt,
	uvec3,
	vec3,
	vec4,
} from "three/tsl";

export const emitObjectPassFragment =
	(
		context: EasyFireShaderContext,
		textures: {
			dyeIn: DataTexture;
			dyeOut: DataTexture;
		},
	): ComputeNodeHook =>
	(vertexPos, worldPos, emitMultiplier, worldMatrix, objVelData, tintFactor) => {
		context.insideBoundingVolume(worldPos, (uvw) => {
			const grid = context.grid.dye;
			const gridDims = uvec3(grid.size);
			const centerCoord = uvec3(uvw.mul(gridDims));
			//const voxelSizeWorld = context.uVolumeWorldSize.div(gridDims);
			//const invGridDims = vec3(1.0).div(gridDims);

			const baseEmission = context.uEmitTemperature.greaterThan(0.0).select(float(1.0), float(0.0));
			const emissionFactor = baseEmission.mul(emitMultiplier);

			// Object velocity and motion vector over this frame
			const objVelocity = objVelData.xyz;
			const motionVec = objVelocity.mul(context.uDt); // Vector from prev -> current pos

			// Instant ignition density boost
			//const densityBaseVal = context.uEmitDensity.mul(float(1 / 20)).mul(emissionFactor);
			const densityBaseVal = context.uEmitDensity.mul(0.2).mul(emissionFactor);
			const tempBaseVal = context.uEmitTemperature.mul(0.05);

			If(densityBaseVal.greaterThan(0.0), () => {
				const currentDye = textures.dyeIn.sample(uvw);

				const addedDensity = densityBaseVal.mul(1);
				const addedTemp = tempBaseVal.mul(1);

				const newDensity = currentDye.r.add(addedDensity); // Clamped to 5.0 as you had in your edit
				const newTemp = currentDye.g.add(addedTemp);

				const addedColorMass = addedDensity.mul(tintFactor);
				const newColorMass = currentDye.a.add(addedColorMass);

				// Calculate the weight and strictly clamp it between 0.0 and 1.0
				const ageMixWeight = densityBaseVal.div(max(newDensity, 0.001)).clamp(0.0, 1.0);

				// Now it will safely interpolate between currentDye.b and 0.0
				const newAge = mix(currentDye.b, float(0.0), ageMixWeight); // 3. Reset age proportionally based on how much fresh fire was injected

				// 4. Safely write back to the correct offset coordinate
				textures.dyeOut.write(centerCoord, vec4(newDensity, newTemp, newAge, newColorMass));

				//});
			});
		});
	};

export const emitObjectsVelocityAndDyePassFragment =
	(
		context: EasyFireShaderContext,
		textures: {
			velocity: DataTexture;
		},
	): ComputeNodeHook =>
	(vertexPos, worldPos, emitMultiplier, worldMatrix, objVelData) => {
		//
		context.insideBoundingVolume(worldPos, (uvw) => {
			const grid = context.grid.phy;
			const coord = uvec3(uvw.mul(grid.size));

			const objVelocity = objVelData.xyz;
			const objSpeed = objVelData.w;

			If(objSpeed.greaterThan(0.001), () => {
				// Read directly from velTexA
				const currentVel = textures.velocity.sample(uvw).xyz;

				const velocityImpulse = objVelocity.mul(-0.1).mul(objSpeed); //
				const newVel = currentVel.add(velocityImpulse);

				//textures.velocity.write(coord, vec4(newVel, 1.0));
			});
		});
	};
